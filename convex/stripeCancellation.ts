/* Is this Stripe subscription scheduled to end when the paid period runs out?
 *
 * WHY THIS FILE EXISTS (the C6 finding)
 * The sandbox cancellation test cancelled a real monthly subscription through
 * the Stripe Portal at end of period. Stripe returned:
 *
 *     status                : "active"
 *     cancel_at             : 1790020544      <- the period end
 *     cancel_at_period_end  : false           <- Stripe itself says FALSE
 *     canceled_at           : 1787427936
 *     cancellation_details  : { reason: "cancellation_requested", ... }
 *
 * Under API version 2026-06-24.dahlia with `billing_mode: flexible`, an
 * end-of-period cancellation is expressed by SETTING `cancel_at` to the period
 * end, not by flipping the `cancel_at_period_end` boolean. The webhook reader
 * looked only at the boolean, so Convex stored `cancelAtPeriodEnd: false` and
 * the account page told a cancelled subscriber their plan "Renews September 21,
 * 2026" — on the exact date it will actually end.
 *
 * That is the same shape of bug as the period fields moving to
 * `items.data[0]`: a field did not disappear, it moved, and a reader that knows
 * only the old location fails silently rather than loudly.
 *
 * DEPENDENCY-FREE on purpose, like plusPlans.ts and subscriptionGuard.ts, so
 * scripts/verify-stripe-cancel-at-normalization.ts imports and EXECUTES this
 * rather than restating it.
 */

/* Statuses where the subscription is already over. A subscription that has
 * ENDED is not "scheduled to end" — reporting it as merely scheduled would tell
 * someone they still have access they no longer have. Kept consistent with
 * subscriptionGuard.REPLACEABLE_STATUSES. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
  "ended",
]);

/* A usable Unix-second timestamp. Stripe sends seconds, never milliseconds, and
 * `null` is its normal "not set" value — so null, 0, negatives, NaN, Infinity
 * and non-numbers all mean "no schedule", never "cancel now". */
function isUsableTimestamp(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

export type CancellationInput = {
  /** Raw Stripe subscription status. */
  status: unknown;
  /** Stripe `cancel_at_period_end`. */
  cancelAtPeriodEnd: unknown;
  /** Stripe `cancel_at`, Unix seconds or null. */
  cancelAt: unknown;
  /** Already-normalised period end, from items.data[0].current_period_end. */
  currentPeriodEnd: unknown;
};

/* Derive the provider-neutral flag the rest of the app already understands.
 *
 * THE RULE
 *   explicit cancel_at_period_end === true
 *   OR cancel_at is a real timestamp that IS the current period end
 *
 * EXACT equality, deliberately, with no tolerance window. The observed payload
 * had cancel_at === current_period_end to the second (1790020544 both), because
 * Stripe derives one from the other rather than computing it independently. A
 * tolerance would be a guess dressed as robustness, and it would let a genuine
 * mid-period `cancel_at` — a real future-dated cancellation that is NOT at the
 * period boundary — be misreported as end-of-period. If a real payload ever
 * shows drift, widen this deliberately and record the evidence.
 *
 * `canceled_at` is NOT consulted. It records when the cancellation was
 * REQUESTED, and Stripe sets it the moment someone schedules a future
 * cancellation. Treating it as proof of a schedule would mark subscriptions as
 * ending on the strength of a timestamp that says nothing about when.
 *
 * No Date.now(): the same inputs must always produce the same answer, so a
 * replayed webhook cannot normalise differently from the original.
 */
export function deriveCancelAtPeriodEnd(input: CancellationInput): boolean {
  const status = typeof input.status === "string" ? input.status : "";

  /* Already over. Not "scheduled". */
  if (TERMINAL_STATUSES.has(status)) return false;

  /* Stripe said so outright — still valid, and still the primary signal for
   * accounts on the older non-flexible billing mode. */
  if (input.cancelAtPeriodEnd === true) return true;

  /* Flexible billing mode: the schedule lives in cancel_at. */
  if (!isUsableTimestamp(input.cancelAt)) return false;
  if (!isUsableTimestamp(input.currentPeriodEnd)) return false;
  return input.cancelAt === input.currentPeriodEnd;
}

/* True when `cancel_at` names a moment that is NOT the period end — a real
 * future-dated cancellation Stripe supports but our product does not offer.
 * Exposed so the suite can prove such a payload is not silently folded into the
 * end-of-period case; nothing in the write path depends on it today. */
export function isOffCycleCancellation(input: CancellationInput): boolean {
  if (!isUsableTimestamp(input.cancelAt)) return false;
  if (!isUsableTimestamp(input.currentPeriodEnd)) return false;
  return input.cancelAt !== input.currentPeriodEnd;
}

/* ── Where the billing period lives ─────────────────────────────────────────
 *
 * MOVED HERE FROM http.ts on 2026-08-26, unchanged, because billing.ts needs
 * the same answer when it settles a superseded subscription. Two copies of a
 * reader this codebase has ALREADY been bitten by twice is how the copies
 * drift, and this file exists for exactly this class of quirk.
 *
 * Dahlia carries the period on the subscription ITEM, never on the
 * subscription root. Our Checkout sends exactly one line item, and
 * classification rejects `unexpected-multiple-items`, so item[0] is the only
 * item there can be.
 *
 * NARROWED DELIBERATELY. `subscription.current_period_start` / `.end` do not
 * exist under the pinned version, and accepting them would let a payload from
 * a different version flow into the entitlement tables looking healthy. Tied
 * to stripeApi.STRIPE_API_VERSION: if that pin moves, re-capture real payloads
 * and re-narrow, never widen speculatively. */
export function readPeriod(sub: any): { start?: number; end?: number } {
  const item = sub?.items?.data?.[0];
  const start = item?.current_period_start;
  const end = item?.current_period_end;
  return {
    start: typeof start === "number" ? start : undefined,
    end: typeof end === "number" ? end : undefined,
  };
}
