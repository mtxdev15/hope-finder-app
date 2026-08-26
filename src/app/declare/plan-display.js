/* Declare & Believe — the ONE interpretation of subscription state for the UI.
 *
 * WHY THIS EXISTS
 * Three surfaces must agree about what a subscription means: /checkout/success,
 * the Plan & Billing card on /you, and /pricing. If each interprets the
 * entitlement response for itself, they drift — and the way they drift is
 * always the same, telling someone their billing is fine on one page while
 * another says it needs attention. The Portal smoke test exposed the version of
 * this bug where /you said nothing at all.
 *
 * So the mapping from entitlement response -> display state lives here once,
 * dependency-free, and scripts/verify-subscription-visibility.ts imports and
 * EXECUTES it rather than describing it.
 *
 * WHAT THIS IS NOT
 * Not a billing dashboard, and not a second source of truth. Convex remains
 * authoritative. This turns an already-resolved response into a label. It never
 * fetches, never decides entitlement, and never sees a Stripe identifier —
 * getMyEntitlements does not return one.
 *
 * THE SAFETY RULE
 * Every ambiguous or unknown input resolves to a state that does NOT claim a
 * healthy subscription. Failing closed here means a confused user, which is
 * recoverable. Failing open means telling someone their payment is fine when it
 * is not, or offering a second Checkout to somebody who already pays.
 */

/* The display states. Deliberately more granular than `tier`, because "plus"
 * covers three situations a user experiences very differently. */
export const PLAN_STATES = /** @type {const} */ ([
  'loading',      // no answer yet — never render Free here
  'unavailable',  // the read failed — never render Free here either
  'guest',        // signed out
  'free',         // signed in, no subscription
  'plus-trial',   // inside the 7-day free trial: everything unlocked, nothing charged yet
  'plus-active',  // healthy, paid, renewing
  'plus-cancelling', // paid through the period, then ends
  'plus-attention',  // payment needs attention; access may still be live
  'plus-ambiguous',  // more than one provider is billing — do not guess
  'lapsed',          // a payment failed AND the grace window has now expired
]);

/* Statuses we recognise as a live subscription. Anything outside this set is
 * unknown, and unknown must not render as healthy. */
const HEALTHY_STATUSES = new Set(['active', 'trialing']);

/**
 * Map an entitlement response to exactly one display state.
 *
 * @param {unknown} ent  the getMyEntitlements response, or null/undefined
 * @param {{ loading?: boolean }} [opts]
 * @returns {string} one of PLAN_STATES
 */
export function planState(ent, opts) {
  if (opts && opts.loading) return 'loading';
  /* A null response is NOT a free account. It means we do not know: offline,
   * signed out mid-read, or a soft failure in convex-data.js. Rendering Free
   * here would tell a paying subscriber they have nothing. */
  if (!ent || typeof ent !== 'object') return 'unavailable';

  const tier = ent.tier;
  if (tier === 'guest') return 'guest';

  /* Ambiguity outranks everything except not-knowing. Two providers billing the
     same account is a real problem and the UI must not silently pick one. */
  if (ent.duplicateProviders === true) return 'plus-ambiguous';

  /* LAPSED — a failed payment whose grace window has run out.
   *
   * This MUST be tested before the tier shortcut below. entitlements.ts returns
   * `{ tier: 'free', needsAttention: true }` for exactly one situation — a
   * past_due or unpaid subscription past its grace end (entitlements.ts:128) —
   * and the old ordering returned 'free' before that flag was ever read.
   *
   * The consequence was not cosmetic. 'free' hides the billing sections, so the
   * one route to the Stripe Portal disappeared; `past_due` is in
   * BLOCKS_NEW_CHECKOUT so they could not buy again either; and the page told
   * them they were "using the essential Declare experience" without once
   * mentioning that their card had failed. A subscriber whose card expired was
   * silently downgraded and left with no way back.
   *
   * No other branch of interpret() pairs a free tier with needsAttention: the
   * lifetime, cancelled-past-period and fallback branches all return
   * needsAttention: false. So this pair identifies the lapse unambiguously. */
  if (tier === 'free' && ent.paymentNeedsAttention === true) return 'lapsed';

  if (tier !== 'plus') {
    /* Not Plus. `free` is only correct for a tier we actually recognise. */
    return tier === 'free' ? 'free' : 'unavailable';
  }

  /* Attention outranks active: a failing card during the grace window still
     grants access, and saying "Active" there is the lie this guards against. */
  if (ent.paymentNeedsAttention === true) return 'plus-attention';

  /* THE TRIAL, checked before cancelling and before active.
     A trial is not "Active": nothing has been charged. Calling it active and
     labelling its end date "Renews" tells somebody their plan is already
     running, and then charges them. That sentence is the reason this state
     exists rather than being folded into plus-active.
     It sits AFTER attention because a trial whose card is already failing is a
     payment problem first. It sits BEFORE cancelling because somebody who
     cancels during a trial is still in the trial until it ends, and the date
     they need is the same one. */
  if (String(ent.subscriptionStatus || '') === 'trialing') return 'plus-trial';

  if (ent.cancelAtPeriodEnd === true) return 'plus-cancelling';

  /* Plus on a status we do not recognise: fail closed rather than claim health. */
  if (!HEALTHY_STATUSES.has(String(ent.subscriptionStatus || ''))) return 'plus-attention';

  return 'plus-active';
}

/** True when the state should show the Plus identity badge. */
export function showsPlusBadge(state) {
  /* A subscriber whose payment needs attention is still a subscriber, so the
     badge stays — but the badge says PLUS, never "Active". The Plan & Billing
     card carries the lifecycle truth. Ambiguity does not earn a badge. */
  return state === 'plus-active' || state === 'plus-cancelling' ||
         state === 'plus-attention' || state === 'plus-trial';
}

/** True when this state may start a new Checkout. Fails closed. */
export function mayStartCheckout(state) {
  /* Only a recognised non-subscriber. Notably NOT `loading` or `unavailable`:
     a failed entitlement read must never unlock a purchase button. */
  return state === 'free' || state === 'guest';
}

/** True when this state should offer the Stripe Portal. */
export function showsManageBilling(state) {
  /* `lapsed` is here for the reason the whole state exists: their subscription
     is in past_due or unpaid, which is recoverable through the Portal and ONLY
     through the Portal — BLOCKS_NEW_CHECKOUT refuses them a fresh Checkout on
     exactly those statuses. Withholding this control is what turned an expired
     card into a dead end. */
  /* A trialist needs it MOST: their card is on file and a charge is coming, so
     the way to stop it has to be reachable without hunting. */
  return state === 'plus-active' || state === 'plus-cancelling' ||
         state === 'plus-attention' || state === 'lapsed' || state === 'plus-trial';
}

/* Which word goes in front of the period-end date. Getting this wrong tells
 * someone their cancelled plan renews, so it is its own function with its own
 * test rather than an inline ternary repeated three times. */
export function periodLabelKey(state) {
  if (state === 'plus-cancelling') return 'plan.cancels';
  if (state === 'plus-active') return 'plan.renews';
  /* NOT "Renews". A trial has never been paid, so nothing renews: it starts.
     The date is the same instant Stripe reports as the period end, and calling
     it a renewal is how somebody reads "your plan is running" and is then
     surprised by the first charge. */
  if (state === 'plus-trial') return 'plan.trialEnds';
  return null; // attention/ambiguous/free/lapsed: no date claim
}

/* Cadence, from the provider-neutral interval the contract now returns. Never
 * derived from a Price id or an amount. */
export function cadenceKey(ent) {
  const i = ent && ent.billingInterval;
  if (i === 'month') return 'plan.monthly';
  if (i === 'year') return 'plan.annual';
  return null;
}

/**
 * Format a period-end timestamp with the app's current locale.
 * Returns null when there is no date — the UI must then show no date at all
 * rather than a placeholder that looks like a real one.
 *
 * @param {unknown} ms
 * @param {string} [lang] 'en' | 'es'
 * @returns {string | null}
 */
export function formatPeriodEnd(ms, lang) {
  if (typeof ms !== 'number' || !isFinite(ms) || ms <= 0) return null;
  try {
    return new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en', {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(new Date(ms));
  } catch (e) {
    return null;
  }
}

/* Human labels, keyed so the existing i18n layer can translate them. Raw enum
 * values (`plus_monthly`, `past_due`, `cancel_at_period_end`) must never reach
 * the screen, so there is no passthrough branch here. */
/** @type {Record<string, string>} */
export const STATE_LABEL_KEYS = {
  'plus-trial': 'plan.stateTrial',
  'plus-active': 'plan.stateActive',
  'plus-cancelling': 'plan.stateCancelling',
  'plus-attention': 'plan.stateAttention',
  'plus-ambiguous': 'plan.stateAmbiguous',
  lapsed: 'plan.stateLapsed',
  free: 'plan.stateFree',
  guest: 'plan.stateGuest',
  loading: 'plan.stateLoading',
  unavailable: 'plan.stateUnavailable',
};

/** The plan's display name key. Never the canonical planKey. */
export function planNameKey(state) {
  return state.startsWith('plus-') ? 'plan.plusName' : 'plan.freeName';
}

/* ── ONE CURRENT PLAN ────────────────────────────────────────────────────── */

/* WHY THIS EXISTS
 *
 * /pricing used to let each card decide for itself whether it was current: the
 * Free card revealed a "Current plan" badge, the Plus card revealed a "Your
 * current plan" badge, and nothing connected the two. Two different labels for
 * one idea, computed twice, with no invariant saying only one may win. A read
 * that resolved oddly could show both, or neither, and the page had no way to
 * notice.
 *
 * Current plan is one fact about a person, so it is derived once, here, from
 * the same state every other surface already uses. Cards ask; they never
 * decide.
 *
 * PROVIDER-NEUTRAL. This reads a display state, which was itself derived from
 * `tier` — never a Price id, never a card order, never a URL parameter, never
 * local storage, and never the pricing-activation flag. Whether Plus can be
 * BOUGHT has nothing to do with whether it is already HELD, and conflating the
 * two is how a paying subscriber gets told Plus is "opening soon". */

/** The two plans a customer can hold. Order is presentation, not authority. */
export const PLAN_IDS = /** @type {const} */ (['free', 'plus']);

/**
 * The single plan that is current, or null when nobody is signed in.
 *
 * Every `plus-*` state is Plus: a failing card during grace and a subscription
 * scheduled to end are both still Plus, and telling that person Free is their
 * current plan would be false. `loading` and `unavailable` resolve to null
 * because we do not know yet, and claiming a plan we cannot see is the failure
 * this whole module exists to prevent.
 *
 * @param {string} state one of PLAN_STATES
 * @returns {'free' | 'plus' | null}
 */
export function currentPlanId(state) {
  if (typeof state !== 'string') return null;
  /* A lapsed subscriber holds FREE. Their Plus subscription still exists in
     Stripe and is recoverable, but access has genuinely stopped — saying "your
     current plan is Plus" to somebody who lost Plus this morning is the lie
     this module exists to prevent. Tested before the prefix rule, which is also
     why the state is named `lapsed` and not `plus-lapsed`: one exception is
     easier to keep true than a name that reads as its own opposite. */
  if (state === 'lapsed') return 'free';
  if (state.indexOf('plus-') === 0) return 'plus';
  if (state === 'free') return 'free';
  return null; // guest, loading, unavailable
}

/**
 * Whether a given card is the current plan. The ONLY question a card may ask.
 *
 * @param {'free' | 'plus' | string} planId
 * @param {string} state
 * @returns {boolean}
 */
export function isCurrentPlan(planId, state) {
  return currentPlanId(state) === planId;
}

/**
 * The invariant, executable rather than described.
 *
 * Exactly one current plan for anyone signed in; zero for a guest. `loading`
 * and `unavailable` also yield zero, which is deliberate — an unresolved read
 * must show no claim at all rather than a guess that later flips.
 *
 * @param {string} state
 * @returns {number} 0 or 1, never 2
 */
export function currentPlanCount(state) {
  return currentPlanId(state) === null ? 0 : 1;
}

/* ── EXCLUSIVE PLAN STATUS LABEL ─────────────────────────────────────────── */

/* At most ONE badge per card. "Current plan", "Needs attention" and
 * "Ends <date>" are three answers to one question, and stacking them produces
 * the contradiction a customer notices first: a card that says it is both
 * current and in trouble. Attention and ending outrank current, because when
 * something needs doing, that is the thing to say. */

/**
 * The single status key for a card, or null when it carries no badge.
 *
 * @param {'free' | 'plus' | string} planId
 * @param {string} state
 * @returns {string | null} an i18n key
 */
export function planStatusKey(planId, state) {
  if (!isCurrentPlan(planId, state)) return null;
  if (state === 'plus-attention') return 'plan.stateAttention';
  if (state === 'plus-cancelling') return 'plan.stateEnding';
  if (state === 'plus-ambiguous') return 'plan.stateAmbiguous';
  /* Outranks "Current plan" for the same reason the others do: a charge is
     coming, and that is the thing to say. */
  if (state === 'plus-trial') return 'plan.stateTrial';
  /* Reached through the FREE card, since currentPlanId('lapsed') is 'free'. It
     outranks "Current plan" for the same reason attention does: when something
     needs doing, that is the thing to say. */
  if (state === 'lapsed') return 'plan.stateLapsed';
  return 'plans.currentPlan';
}

/* ── PRICING ACTIVATION ──────────────────────────────────────────────────── */

/* The ONE place that says whether the product can be bought.
 *
 * There was no such flag: /pricing hardcoded a disabled button and the
 * disabled-ness itself was the guard. That worked, but it meant "can I buy
 * this" was expressed as markup, so nothing could test the enabled branch and
 * nothing stopped the two ideas — held and purchasable — from being read as
 * one.
 *
 * Flipping this to true does NOT by itself open purchasing. Production Convex
 * still holds none of the four billing variables and the Worker's billing route
 * still fails closed, so a Checkout call would be refused server-side. This
 * decides what the page SAYS. Activation is a separate, authorized task; see
 * docs/operations/billing-production-activation-readiness.md. */
export const PRICING_ENABLED = false;

/* ── CALL-TO-ACTION INTENT ───────────────────────────────────────────────── */

/* What each card's button is FOR, decided once. Returning an intent rather
 * than a label keeps this dependency-free and lets each surface render and
 * translate it however it needs to. */

/**
 * @param {string} state
 * @param {boolean} [pricingEnabled]
 * @returns {'create-account'|'upgrade'|'launches-soon'|'manage-billing'|'update-payment'|'keep-plus'|'cancel-trial'|'none'}
 */
export function plusCtaIntent(state, pricingEnabled) {
  const enabled = pricingEnabled === undefined ? PRICING_ENABLED : pricingEnabled === true;
  /* A subscriber never sees a purchase control, enabled or not. What they need
     is a way to manage what they already have — and which management action
     depends on what is wrong, if anything. */
  /* Same action as attention, and deliberately so: the fix is identical — put a
     working card on the existing subscription. What differs is only whether
     access is still running while they do it. */
  if (state === 'plus-attention' || state === 'lapsed') return 'update-payment';
  /* A trialist's one question is "how do I stop before I am charged", and the
     answer must be a control on our page rather than a hunt through the Portal
     while a date approaches. Offering it costs some conversions and is the
     thing that makes the trial's promise real. */
  if (state === 'plus-trial') return 'cancel-trial';
  if (state === 'plus-cancelling') return 'keep-plus';
  if (state === 'plus-active' || state === 'plus-ambiguous') return 'manage-billing';
  /* Not a subscriber. Only a state we RECOGNISE may offer a purchase: a failed
     read must never unlock one, which is what mayStartCheckout already says. */
  if (!mayStartCheckout(state)) return 'none';
  return enabled ? 'upgrade' : 'launches-soon';
}

/**
 * @param {string} state
 * @returns {'create-account'|'current'|'none'}
 */
export function freeCtaIntent(state) {
  if (state === 'guest') return 'create-account';
  if (isCurrentPlan('free', state)) return 'current';
  return 'none';
}

/* ── PLUS PRICING, IN CENTS ──────────────────────────────────────────────── */

/* The two recurring prices, in minor units, in ONE place.
 *
 * These used to be local constants inside src/pages/pricing.astro. That was
 * fine while exactly one page rendered a price. /billing now needs them too —
 * to say what an annual switch costs and what it saves — and two pages each
 * holding their own copy of a price is how a promotion gets applied on one
 * screen and not the other.
 *
 * These are DISPLAY figures. They are not what anybody is charged: the charge
 * comes from the Stripe Price resolved server-side from an env var, and Convex
 * never reads these. If they ever disagree with Stripe, Stripe is right and
 * these are a bug. */
export const PLUS_MONTHLY_CENTS = 899;
export const PLUS_ANNUAL_CENTS = 7999;

/* ── ANNUAL VALUE ────────────────────────────────────────────────────────── */

/* The per-month equivalent of an annual price, in cents, or null when it cannot
 * be computed exactly. Shown only when it is right: an approximate saving
 * printed as a precise number is the kind of small dishonesty that costs trust
 * on a page asking for money. */

/**
 * @param {unknown} annualCents
 * @returns {number | null} cents per month, rounded to the nearest cent
 */
export function monthlyEquivalentCents(annualCents) {
  if (typeof annualCents !== 'number' || !isFinite(annualCents) || annualCents <= 0) return null;
  return Math.round(annualCents / 12);
}

/**
 * Whole-percent saving of annual against twelve months of monthly, or null.
 *
 * @param {unknown} monthlyCents
 * @param {unknown} annualCents
 * @returns {number | null}
 */
export function annualSavingPercent(monthlyCents, annualCents) {
  if (typeof monthlyCents !== 'number' || !isFinite(monthlyCents) || monthlyCents <= 0) return null;
  if (typeof annualCents !== 'number' || !isFinite(annualCents) || annualCents <= 0) return null;
  const twelve = monthlyCents * 12;
  if (annualCents >= twelve) return null; // no saving to claim
  return Math.round(((twelve - annualCents) / twelve) * 100);
}

/* ── CADENCE SELECTION ───────────────────────────────────────────────────── */

/* Which cadence the selector opens on. A subscriber sees the one they are
 * actually on, so the page never appears to describe someone else's plan.
 * Everyone else gets the product default. Selecting a cadence changes what is
 * PRICED; it can never change which plan is current. */

export const DEFAULT_INTERVAL = 'month';

/**
 * @param {unknown} ent the entitlement response
 * @param {string} state
 * @returns {'month' | 'year'}
 */
export function initialInterval(ent, state) {
  if (currentPlanId(state) === 'plus') {
    const i = ent && ent.billingInterval;
    if (i === 'month' || i === 'year') return i;
  }
  return DEFAULT_INTERVAL;
}
