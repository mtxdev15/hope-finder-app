/* Declare & Believe — the entitlement catalog.
 *
 * ONE place where a limit is a number. Nothing in Journey, pricing, the Worker
 * or any UI may hardcode `3` or `2`: a limit written in two places is a limit
 * that will disagree with itself, and the version the customer sees will not be
 * the version that is enforced.
 *
 * This module is server-only and has no mutation. The catalog is code, not
 * data, so there is no write path for a client to reach at all.
 *
 * `null` means NO CUSTOMER-VISIBLE QUOTA. It does not mean infinity: invisible
 * safety, abuse, concurrency and service-stability protections still apply, and
 * are deliberately kept out of this catalog so that raising a product limit can
 * never accidentally raise an abuse ceiling.
 */

export type Tier = "guest" | "free" | "plus";

export type Limits = {
  // Successful Gentle Guidance responses per account day. 0 = feature requires
  // an account (guests may SEE it, but must sign in before consent/submission).
  gentleGuidanceDaily: number | null;
  // Concurrently active Journeys. null = no customer-visible cap.
  activeJourneys: number | null;
  // Uncapped at launch, present so a future cap has a home rather than being
  // invented inline somewhere.
  collections: number | null;
  imageCards: number | null;
  monthlyNewJourneys: number | null;
};

export type TierDefinition = {
  tier: Tier;
  limits: Limits;
  // Room for what the product will need next, declared now so adding it later
  // is a value change rather than a schema change.
  seats: number | null;
  features: Record<string, boolean>;
};

const GUEST: TierDefinition = {
  tier: "guest",
  limits: {
    gentleGuidanceDaily: 0, // must sign in before consent or submission
    activeJourneys: null, // no ACCOUNT entitlement; guests are device-local
    collections: null,
    imageCards: null,
    monthlyNewJourneys: null,
  },
  seats: null,
  features: {},
};

const FREE: TierDefinition = {
  tier: "free",
  limits: {
    gentleGuidanceDaily: 3,
    activeJourneys: 2,
    collections: null, // uncapped at launch
    imageCards: null, // uncapped at launch
    monthlyNewJourneys: null, // no monthly limit at launch
  },
  seats: null,
  features: {},
};

const PLUS: TierDefinition = {
  tier: "plus",
  limits: {
    gentleGuidanceDaily: null,
    activeJourneys: null,
    collections: null,
    imageCards: null,
    monthlyNewJourneys: null,
  },
  seats: null,
  features: {},
};

/* Every tier a subscription can resolve to appears here, and nothing else
 * does. A tier that is merely CONTEMPLATED is deliberately absent rather than
 * defined-and-unused, so nothing can resolve to it by accident before its
 * limits are designed — which is why the seat-based Family and Church ideas
 * were removed from the product rather than parked here as empty rows. */
const CATALOG: Record<Tier, TierDefinition> = {
  guest: GUEST,
  free: FREE,
  plus: PLUS,
};

export function definitionFor(tier: Tier): TierDefinition {
  return CATALOG[tier] ?? FREE;
}

/* ── Billing grace ────────────────────────────────────────────────────────────
 * How long a `past_due` or `unpaid` subscription keeps Plus, in full, while
 * Stripe retries the card.
 *
 * APPROVED 2026-08-26 AT 16 DAYS. It was 3, carrying a note that it was "a
 * product setting awaiting approval, not a silently chosen default" — this is
 * that approval, and the number moved.
 *
 * WHY 16 AND NOT 3
 * Three days was shorter than the retries it was meant to cover. Stripe's Smart
 * Retries run for TWO WEEKS by default, so a subscriber lost Plus on day 4 and
 * could have it handed back on day 10 when an attempt succeeded — access
 * flapping off and on while we were still trying to charge them, with no
 * explanation for either transition.
 *
 * WHY 16 SPECIFICALLY
 * It is Apple's own default for monthly-and-longer subscriptions (their billing
 * grace period offers 3, 16 or 28 days, and keeps full access throughout —
 * Google Play works the same way, granting grace before any hold). And it
 * EXCEEDS Stripe's 14-day retry window by two days, which is the property that
 * matters: access now ends exactly once, after the retries have genuinely
 * finished, with margin rather than a race.
 *
 * WHAT IT COSTS
 * Up to 16 days of Plus for a card that may never recover. Set against $8.99
 * and an involuntary-churn rate near 40% — most failures are an expired card,
 * not a decision to leave — that is a good trade, and a cheap one.
 *
 * CHANGING IT IS ONE NUMBER. The dunning email schedule is DERIVED from this
 * (convex/dunningSchedule.ts) so the emails can never promise a date this
 * disagrees with, and scripts/verify-dunning-emails.ts proves the schedule
 * stays correct at 2, 3, 7, 14, 16 and 28 days. */
export const PAST_DUE_GRACE_DAYS = 16;
export const PAST_DUE_GRACE_MS = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

/* Minimum interval between account timezone changes. Prevents hopping between
 * zones to manufacture a fresh account day. Belt and braces: the day key is
 * also monotonic (see accountDay.ts), so even an allowed change cannot move the
 * day backwards. A legitimate traveller changes zones far less often than this. */
/* ── The free trial ───────────────────────────────────────────────────────
 *
 * APPROVED 2026-08-26 AT 7 DAYS, and the number is the category's, not ours.
 * Every comparable app checked runs seven: stoic., Pillow, Ahead, Alma,
 * DailyArt, bless. Not one runs fourteen. A first recommendation of 14 came
 * from B2B SaaS length data and was corrected once consumer apps were actually
 * looked at, which is the whole reason for copying rather than reasoning.
 *
 * Seven also puts the reminder inside the window where somebody still remembers
 * signing up. That matters more than trial length itself: the reminder is what
 * turns a card-required trial from a surprise charge into a kept promise.
 *
 * The trial unlocks EVERYTHING. A trial that withholds the thing being sold
 * tests nothing.
 *
 * Stripe fires customer.subscription.trial_will_end three days before the
 * charge, so at seven days the reminder lands on day four. */
export const TRIAL_DAYS = 7;

/* ── The grace arithmetic, in one place ───────────────────────────────────
 *
 * WHY THIS IS HERE AND NOT WHERE IT IS USED
 * Three places need to know exactly when Plus stops for a failing subscription:
 * the resolver that decides whether somebody has it, the email that prints the
 * date, and the scheduled job that records the moment it ended. Written out
 * three times, those would drift, and the failure would be a subscriber told
 * one date and cut off on another.
 *
 * So the arithmetic lives beside the number it depends on, and this module
 * imports nothing, so a suite can execute it directly.
 *
 * FAILING statuses are exactly the ones that get grace. Anything else has no
 * grace window because it is not failing. */
const FAILING: ReadonlySet<string> = new Set(["past_due", "unpaid"]);

export function isFailingStatus(status: unknown): boolean {
  return typeof status === "string" && FAILING.has(status);
}

/* When Plus actually stops.
 *
 * Measured from the end of the period they last PAID for, not from when the
 * failure was noticed: a renewal that fails on the day the period ends should
 * give sixteen days from that day, not sixteen days from whenever Stripe got
 * round to telling us.
 *
 * `currentPeriodEnd` is in SECONDS, because that is what Stripe sends and what
 * the row stores. Everything else here is milliseconds. Getting that wrong
 * would put the date fifty thousand years out, which is the kind of mistake
 * that is obvious in a test and invisible in a comment. */
export function graceEndsAtMs(
  currentPeriodEndSeconds: number | null | undefined,
  updatedAtMs: number | null | undefined,
  now: number,
  hasEverPaid?: boolean,
): number {
  const base =
    typeof currentPeriodEndSeconds === "number" && currentPeriodEndSeconds > 0
      ? currentPeriodEndSeconds * 1000
      : /* No period end. Fall back to when we last heard about them, so a
           missing field cannot grant an unbounded free ride. */
        (typeof updatedAtMs === "number" && updatedAtMs > 0 ? updatedAtMs : now);
  /* One rule, not two. This used to special-case an absent ARGUMENT separately
     from an absent FIELD, which meant graceDaysFor(undefined) and
     graceEndsAtMs(..., undefined) gave opposite answers. A suite can assert
     both of those and pass while the product is wrong, and that is exactly what
     happened. Now there is a single function deciding it. */
  return base + graceDaysFor(hasEverPaid) * 24 * 60 * 60 * 1000;
}

/* WHO GETS GRACE AT ALL.
 *
 * Grace exists to protect somebody who HAS BEEN PAYING from losing access over
 * a dead card. It is sized to outlast Stripe's retry window so their access
 * ends once rather than flickering while retries run.
 *
 * A trial that never converted is a different situation wearing the same
 * status. Stripe moves an unconverted trial to `past_due` exactly as it moves a
 * lapsed subscriber there, so without this distinction somebody who never paid
 * a cent would get seven trial days plus a full grace window on top. That makes
 * the trial itself meaningless to anyone who notices, and it costs a live model
 * call every time.
 *
 * DECIDED 2026-08-26: no grace for a subscription that never had a successful
 * payment. Not a shorter grace, none. Nothing was paid for, so there is nothing
 * to protect.
 *
 * `hasEverPaid` is a stored FACT, written explicitly on every row this system
 * creates, never inferred from dates. Inferring it from trialEnd or period
 * boundaries would be wrong in ways that stay invisible until they cut off a
 * real subscriber.
 *
 * WHAT ABSENT MEANS, AND WHY IT IS THE GENEROUS ANSWER RATHER THAN THE STRICT
 * ONE. An earlier version of this comment claimed absent meant false and called
 * that "the safe direction". Both halves were wrong, and the code disagreed
 * with the comment in a way that made the whole feature inert: applyWebhook
 * spread-omitted the field when false, so an unconverted trial had it ABSENT,
 * and absent read as "the caller did not say" and got the full window.
 *
 * Absent can now only mean one thing: a row written before this column existed.
 * Trials did not exist then either, so such a row belongs to somebody who
 * genuinely paid, and they keep their grace. That is also the safer error to
 * make: granting sixteen extra days to a lapsed trial costs model calls, while
 * cutting off a real subscriber with no warning costs a subscriber. */
export function graceDaysFor(hasEverPaid: boolean | undefined): number {
  /* Explicit false is the only thing that removes grace. Absent is a legacy
     row, which predates trials and therefore predates any way to reach this
     state without having paid. */
  return hasEverPaid === false ? 0 : PAST_DUE_GRACE_DAYS;
}

/** Is this failing subscription still inside its grace window? */
export function isWithinGrace(
  currentPeriodEndSeconds: number | null | undefined,
  updatedAtMs: number | null | undefined,
  now: number,
): boolean {
  return now <= graceEndsAtMs(currentPeriodEndSeconds, updatedAtMs, now);
}

export const TIMEZONE_CHANGE_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/* How long an in-flight usage reservation is held before it may be reclaimed.
 * Long enough for a slow model response, short enough that a crashed process
 * does not consume someone's allowance for the rest of the day. */
export const RESERVATION_TTL_MS = 5 * 60 * 1000;
