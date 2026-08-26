/* Buying Lifetime while already subscribed.
 *
 * WHAT WAS ACTUALLY BROKEN, and it was not the double charge
 * `createCheckoutSession` lets a live subscriber buy Lifetime on purpose —
 * `buyingLifetimeOnTop` bypasses all three stacking guards. The webhook then
 * REFUSED to record it:
 *
 *     classifyIncomingSubscription({
 *       existing: { stripeSubscriptionId: "sub_...", status: "active" },
 *       incomingSubscriptionId: null,        // a one-time purchase has none
 *     })
 *     -> { ok: false, reason: "duplicate-subscription" }
 *
 * A lifetime purchase carries no Subscription object, so `incoming` is null,
 * which is not the canonical id, and an `active` row is not replaceable. The
 * $149 was charged, the event was acknowledged, a conflict row was written and
 * no entitlement was granted. Proven by running the real classifier against
 * that input, not by reading it.
 *
 * So this file does three things, in this order, and the order is the design:
 *   1. the grant lands  (nobody is ever left having paid for nothing)
 *   2. the old subscription is cancelled  (nobody is ever billed again)
 *   3. the overlap is settled  (nobody silently pays twice for one window)
 *
 * DELIBERATELY DEPENDENCY-FREE, like plusPlans.ts and subscriptionGuard.ts. No
 * Convex imports, no `v`, no fetch. That is what lets
 * scripts/verify-lifetime-upgrade.ts import and EXECUTE these decisions under
 * plain `node` — which matters more here than anywhere else in the codebase,
 * because these functions decide how much money to send back.
 */

/* ── Where an invoice keeps its payment ─────────────────────────────────────
 *
 * REFUSES TO GUESS, and that is the whole point of the shape.
 *
 * This codebase has already been bitten twice by a Stripe field that MOVED
 * rather than disappeared: the period fields to `items.data[0]`, and
 * end-of-period cancellation from the `cancel_at_period_end` boolean to
 * `cancel_at`. Both failed silently, because a reader that knows only the old
 * location finds nothing and carries on.
 *
 * A refund is the wrong place to carry on. So the shapes are tried in a stated
 * order, and an invoice matching NONE of them returns null, which the caller
 * turns into "record the amount and alert a human" rather than into a refund
 * aimed at a field we hoped was there.
 *
 * Order is newest-first because the pinned API version is 2026-06-24.dahlia:
 *   1. payments[].payment.payment_intent   the 2025+ invoice payments array
 *   2. payment_intent                      the long-standing top-level field
 *   3. charge                              the oldest, still present on some
 */
export type PaymentRef =
  | { kind: "payment_intent"; id: string }
  | { kind: "charge"; id: string };

function asId(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  /* Stripe returns either an id string or an expanded object. Both are normal;
     an expanded object is not an error and must not read as absent. */
  if (v && typeof v === "object" && typeof (v as any).id === "string") {
    return (v as any).id as string;
  }
  return null;
}

export function readInvoicePaymentRef(invoice: any): PaymentRef | null {
  if (!invoice || typeof invoice !== "object") return null;

  const payments = invoice.payments && invoice.payments.data;
  if (Array.isArray(payments)) {
    for (const p of payments) {
      const pi = asId(p && p.payment && p.payment.payment_intent);
      if (pi) return { kind: "payment_intent", id: pi };
      const ch = asId(p && p.payment && p.payment.charge);
      if (ch) return { kind: "charge", id: ch };
    }
  }
  const pi = asId(invoice.payment_intent);
  if (pi) return { kind: "payment_intent", id: pi };
  const ch = asId(invoice.charge);
  if (ch) return { kind: "charge", id: ch };
  return null;
}

/* ── How much of the paid period is still unused ────────────────────────────
 *
 * FLOORED, NEVER ROUNDED. Rounding up would refund a cent that was never
 * charged. Over a founding round that is trivial money and a real
 * reconciliation problem, and the asymmetry costs the customer nothing they
 * would notice.
 *
 * Every input is treated as untrusted, because every one of them comes from a
 * payload rather than from us. Anything unusable yields 0, which settles as
 * "cancel, refund nothing" — the safe direction. A wrong 0 is a support email;
 * a wrong large number is money out the door.
 *
 * Times are Unix SECONDS, matching every other Stripe timestamp in this
 * codebase. Amounts are integer minor units, matching Stripe's amount fields.
 */
export function unusedCents(input: {
  amountPaid: unknown;
  amountRefunded?: unknown;
  periodStart: unknown;
  periodEnd: unknown;
  nowSeconds: unknown;
}): number {
  const paid = intOrZero(input.amountPaid);
  const already = intOrZero(input.amountRefunded);
  const refundable = paid - already;
  if (refundable <= 0) return 0;                    // nothing left to give back

  const start = finite(input.periodStart);
  const end = finite(input.periodEnd);
  const now = finite(input.nowSeconds);
  if (start === null || end === null || now === null) return 0;

  const span = end - start;
  if (span <= 0) return 0;                          // not a period we can divide
  if (now >= end) return 0;                         // fully used
  const remaining = end - Math.max(now, start);     // early clock skew uses none
  if (remaining <= 0) return 0;

  const share = Math.floor((refundable * remaining) / span);
  /* Belt and braces. The arithmetic above cannot exceed `refundable` for
     remaining <= span, and this is what makes that a guarantee rather than an
     argument. */
  return Math.max(0, Math.min(share, refundable));
}

function intOrZero(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.trunc(v);
}
function finite(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

/* ── The whole settlement, decided in one place ─────────────────────────────
 *
 * CANCELS IMMEDIATELY rather than at period end, and the two are not equivalent
 * here. At period end the subscription stays `active` for up to a year with a
 * renewal still scheduled, which is one failed job away from charging somebody
 * who paid $149 to never be charged again. Access does not depend on it: the
 * lifetime row grants Plus on its own. Cancelling now removes the possibility
 * instead of relying on a later event.
 *
 * The refund is separate from the cancellation on purpose. A cancellation that
 * succeeds while a refund fails must leave the person cancelled and the money
 * flagged, never roll the cancellation back.
 */
export type Settlement = {
  /** Always true when we hold a subscription id: nobody keeps being billed. */
  cancel: boolean;
  /** Integer minor units to send back, 0 when there is nothing to settle. */
  refundCents: number;
  /** Where to send it. Null means we could not read one; see `needsHuman`. */
  ref: PaymentRef | null;
  /** True when money is owed and we cannot safely send it ourselves. */
  needsHuman: boolean;
  /** Stated so the recorded row explains itself without reopening Stripe. */
  reason:
    | "refund-unused-period"
    | "nothing-unused"
    | "no-payment-reference"
    | "no-invoice";
};

export function settlementPlan(input: {
  /** The subscription's latest invoice, or null if it has none. */
  invoice: any;
  /** Period bounds from the subscription, already normalised to seconds. */
  periodStart: unknown;
  periodEnd: unknown;
  nowSeconds: unknown;
}): Settlement {
  if (!input.invoice || typeof input.invoice !== "object") {
    return { cancel: true, refundCents: 0, ref: null, needsHuman: false, reason: "no-invoice" };
  }

  const refundCents = unusedCents({
    amountPaid: input.invoice.amount_paid,
    amountRefunded: input.invoice.amount_refunded,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    nowSeconds: input.nowSeconds,
  });

  /* A trial that never converted invoices at zero, so this is the ordinary
     path for anybody upgrading during their seven days, not an edge case. */
  if (refundCents === 0) {
    return { cancel: true, refundCents: 0, ref: null, needsHuman: false, reason: "nothing-unused" };
  }

  const ref = readInvoicePaymentRef(input.invoice);
  if (!ref) {
    /* Money IS owed and we cannot name where it came from. Cancel anyway —
       leaving the subscription running would keep charging them — and say so
       loudly rather than quietly keeping the difference. */
    return { cancel: true, refundCents, ref: null, needsHuman: true, reason: "no-payment-reference" };
  }
  return { cancel: true, refundCents, ref, needsHuman: false, reason: "refund-unused-period" };
}
