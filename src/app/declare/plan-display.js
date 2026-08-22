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
  'plus-active',  // healthy, paid, renewing
  'plus-cancelling', // paid through the period, then ends
  'plus-attention',  // payment needs attention; access may still be live
  'plus-ambiguous',  // more than one provider is billing — do not guess
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

  if (tier !== 'plus') {
    /* Not Plus. `free` is only correct for a tier we actually recognise. */
    return tier === 'free' ? 'free' : 'unavailable';
  }

  /* Attention outranks active: a failing card during the grace window still
     grants access, and saying "Active" there is the lie this guards against. */
  if (ent.paymentNeedsAttention === true) return 'plus-attention';
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
  return state === 'plus-active' || state === 'plus-cancelling' || state === 'plus-attention';
}

/** True when this state may start a new Checkout. Fails closed. */
export function mayStartCheckout(state) {
  /* Only a recognised non-subscriber. Notably NOT `loading` or `unavailable`:
     a failed entitlement read must never unlock a purchase button. */
  return state === 'free' || state === 'guest';
}

/** True when this state should offer the Stripe Portal. */
export function showsManageBilling(state) {
  return state === 'plus-active' || state === 'plus-cancelling' || state === 'plus-attention';
}

/* Which word goes in front of the period-end date. Getting this wrong tells
 * someone their cancelled plan renews, so it is its own function with its own
 * test rather than an inline ternary repeated three times. */
export function periodLabelKey(state) {
  if (state === 'plus-cancelling') return 'plan.cancels';
  if (state === 'plus-active') return 'plan.renews';
  return null; // attention/ambiguous/free: no date claim
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
  'plus-active': 'plan.stateActive',
  'plus-cancelling': 'plan.stateCancelling',
  'plus-attention': 'plan.stateAttention',
  'plus-ambiguous': 'plan.stateAmbiguous',
  free: 'plan.stateFree',
  guest: 'plan.stateGuest',
  loading: 'plan.stateLoading',
  unavailable: 'plan.stateUnavailable',
};

/** The plan's display name key. Never the canonical planKey. */
export function planNameKey(state) {
  return state.startsWith('plus-') ? 'plan.plusName' : 'plan.freeName';
}
