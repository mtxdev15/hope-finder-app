/* The duplicate-Stripe-subscription guard.
 *
 * WHAT THIS EXISTS TO PREVENT
 * `createCheckoutSession` refuses to open a second purchase while the user
 * already holds a live subscription. That guard runs at CHECKOUT time, which
 * is too early to be sufficient: a Checkout Session minted BEFORE the first
 * subscription existed stays payable for 24 hours, and completing it later
 * creates a genuine second Stripe subscription that the checkout guard never
 * saw.
 *
 * What happened next was the real problem. `applyWebhook` resolves the row to
 * write by falling back to `by_user_provider`, so a webhook carrying
 * subscription B would PATCH the row holding subscription A — repointing
 * `stripeSubscriptionId` in place. Convex would then show one tidy row reading
 * Plus while Stripe billed twice and subscription A became invisible to us:
 * unreachable from the Portal mapping, absent from every read, and impossible
 * to reconcile from our own data.
 *
 * This module answers one question, and every webhook event answers it the
 * same way because `applyWebhook` is the single mutation that writes the
 * `subscriptions` table.
 *
 * DELIBERATELY DEPENDENCY-FREE. No Convex imports, no `v` validators, no ctx.
 * That is what lets scripts/verify-duplicate-subscription-guard.ts import and
 * exercise the real decision under plain `node`, rather than grepping the
 * source and hoping. Same reason plusPlans.ts is structured this way.
 *
 * WHAT THIS DOES NOT DO
 * It protects OUR state. It does not cancel either Stripe subscription, issue
 * a refund, write a credit note or touch an invoice — a duplicate charge is a
 * money decision and belongs to a remediation policy a human runs, not to a
 * webhook handler. See docs/operations/stage-2-sandbox-billing.md §6.10.
 */

/** The subset of a `subscriptions` row this decision reads. */
export type SubscriptionRowLike = {
  stripeSubscriptionId?: string;
  status: string;
  cancelAtPeriodEnd?: boolean;
  /* Read only to recognise a lifetime row, which is the one row that legitimately
     carries no subscription id. See the lifetime rule in the classifier. */
  planKey?: string;
};

/* Statuses after which a subscription can never grant entitlement again, so a
 * different subscription id may legitimately take its place.
 *
 * TRANSCRIBED, NOT INVENTED. These are exactly the statuses billing.ts already
 * treats as "finished, a new Checkout is the right answer":
 *
 *   ALLOWS_NEW_CHECKOUT = canceled, incomplete_expired, ended
 *   plus `incomplete`, which billing.ts lets fall through with the comment
 *   "their last attempt never completed, so a fresh Checkout Session is the
 *   correct recovery".
 *
 * `incomplete` being replaceable is load-bearing, not an oversight: it is the
 * documented recovery path. A user whose first attempt never completed retries,
 * gets subscription B, and B must be allowed to replace A — otherwise this
 * guard would break the one flow billing.ts explicitly supports.
 *
 * Everything else is NONTERMINAL, including:
 *   active, trialing   — entitlements.interpret grants Plus
 *   past_due, unpaid   — interpret still grants Plus during the 3-day grace
 *                        window, so these are recoverable, not finished
 *   anything unrecognised — billing.ts refuses to guess at an unknown
 *                        lifecycle and so does this
 */
export const REPLACEABLE_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
  "ended",
  "incomplete",
]);

/** True when `row` is finished and a different subscription may replace it. */
export function isReplaceable(row: SubscriptionRowLike): boolean {
  if (!REPLACEABLE_STATUSES.has(row.status)) return false;
  /* Cancelling but still inside the paid period is NOT finished — they hold
   * Plus through currentPeriodEnd. billing.ts makes this same check
   * independently of the status set, so this mirrors it rather than folding
   * the two together and quietly changing one of them. */
  if (row.cancelAtPeriodEnd && row.status !== "canceled") return false;
  return true;
}

export type GuardVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: "duplicate-subscription" | "lifetime-not-replaceable";
      /** The subscription id we already hold and are refusing to overwrite.
       *  Absent on a lifetime conflict: a lifetime row has no subscription. */
      canonicalSubscriptionId?: string;
      /** The id the incoming event carried. `null` when it carried none. */
      incomingSubscriptionId: string | null;
      /** The status that made the existing row nonterminal. */
      existingStatus: string;
    };

/* The whole decision, for every event type.
 *
 * Allows:
 *   - any non-Stripe provider (Apple has its own identity column)
 *   - no existing row for this user+provider
 *   - an existing row that carries no subscription id yet
 *   - an event for the SAME subscription id we already hold
 *   - a genuinely terminal existing row
 *
 * Refuses everything else, including an event with NO subscription id when we
 * hold one. That last case fails closed on purpose: http.ts already returns
 * before calling the mutation when it cannot resolve a subscription id, so it
 * should be unreachable — but if it ever became reachable, applying such an
 * event would let an unattributable payload move the canonical row's status
 * and tier. Refusing costs nothing and removes the possibility.
 */
export function classifyIncomingSubscription(input: {
  provider: string;
  existing: SubscriptionRowLike | null | undefined;
  incomingSubscriptionId?: string | null;
}): GuardVerdict {
  const { provider, existing } = input;
  const incoming = input.incomingSubscriptionId ?? null;

  if (provider !== "stripe") return { ok: true };
  if (!existing) return { ok: true };

  /* ── The lifetime rule, BEFORE the no-canonical-id allowance below ───────
   *
   * A lifetime row legitimately carries no `stripeSubscriptionId` — it was
   * bought in `mode: "payment"` and no Subscription object was ever created.
   * That makes it the one row for which `!canonical` is normal rather than
   * "we have not learned the id yet", and the allowance below would therefore
   * let ANY subscription event patch it in place.
   *
   * The window is real, not theoretical, and it is the same one this file
   * already documents: a Checkout Session minted before the lifetime purchase
   * stays payable for 24 hours, so a monthly subscription can genuinely arrive
   * afterwards. Applying it would overwrite a purchase that cannot be re-bought
   * with a recurring row — the customer keeps Plus, but the $149 they paid
   * stops existing in our data.
   *
   * Refused rather than merged: which one they should end up on is a money
   * decision (refund the lifetime? cancel the subscription?) and belongs to a
   * human running a remediation policy, exactly as the duplicate-charge case
   * above does. */
  if (existing.planKey === "plus_lifetime" && incoming) {
    return {
      ok: false,
      reason: "lifetime-not-replaceable",
      incomingSubscriptionId: incoming,
      existingStatus: existing.status,
    };
  }

  const canonical = existing.stripeSubscriptionId;
  if (!canonical) return { ok: true };
  if (incoming === canonical) return { ok: true };
  if (isReplaceable(existing)) return { ok: true };

  return {
    ok: false,
    reason: "duplicate-subscription",
    canonicalSubscriptionId: canonical,
    incomingSubscriptionId: incoming,
    existingStatus: existing.status,
  };
}
