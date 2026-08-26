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
 * How long a `past_due` or `unpaid` subscription keeps Plus while Stripe
 * retries the card.
 *
 * THIS IS A PRODUCT SETTING AWAITING APPROVAL, not a silently chosen default.
 * 3 days is the recommendation: a failed retry is usually a bank hiccup or an
 * expired card, and dropping someone out of Plus the moment a retry fails is
 * the wrong default for an app people reach for at 3am. Documented in
 * docs/implementation/release-c1-phase4-entitlements.md for sign-off. */
export const PAST_DUE_GRACE_DAYS = 3;
export const PAST_DUE_GRACE_MS = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

/* Minimum interval between account timezone changes. Prevents hopping between
 * zones to manufacture a fresh account day. Belt and braces: the day key is
 * also monotonic (see accountDay.ts), so even an allowed change cannot move the
 * day backwards. A legitimate traveller changes zones far less often than this. */
export const TIMEZONE_CHANGE_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/* How long an in-flight usage reservation is held before it may be reclaimed.
 * Long enough for a slow model response, short enough that a crashed process
 * does not consume someone's allowance for the rest of the day. */
export const RESERVATION_TTL_MS = 5 * 60 * 1000;
