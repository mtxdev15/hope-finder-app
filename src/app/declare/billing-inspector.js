/* Declare & Believe — the development-only lifecycle inspector's projection.
 *
 * WHY A PROJECTION FUNCTION AND NOT JUST CAREFUL RENDERING
 * The rule this enforces is "no Stripe identifier ever reaches the inspector".
 * A rule enforced by remembering to render the right fields can only be
 * checked by reading the page and hoping. An ALLOWLIST projection makes it
 * structural: the inspector renders what this returns, and this returns only
 * what is named below. scripts/verify-billing-lifecycle-controls.ts imports and
 * executes it, so the guarantee is tested rather than described.
 *
 * Same shape of decision as subscriptionGuard.ts and checkout-return.js:
 * dependency-free, so plain `node` can run it.
 */

/* Exactly what the inspector may show. Every one of these is provider-NEUTRAL:
 * `provider` is an enum ("stripe" | "app_store"), not an identifier, and
 * `planKey` is our own canonical key, not a Stripe Price. */
export const INSPECTOR_FIELDS = [
  'tier',
  'subscriptionStatus',
  'planKey',
  'provider',
  'paymentNeedsAttention',
  'graceEndsAt',
  'duplicateProviders',
  'limits',
  'usage',
  'remaining',
];

/* Fields that must NEVER appear, named explicitly so the test can assert on
 * the list rather than on a regex someone can outrun. These are not merely
 * absent from INSPECTOR_FIELDS — getMyEntitlements does not return them at all,
 * and this is the second lock on that. */
export const FORBIDDEN_FIELDS = [
  'stripeCustomerId',
  'stripeSubscriptionId',
  'stripePriceId',
  'latestInvoiceId',
  'lastProviderEventId',
  'metadataUserId',
  'userId',
  'email',
  'paymentMethod',
  'sessionId',
];

/* Project an entitlement response down to what the inspector may display.
 *
 * The JSDoc is load-bearing, not decoration: this file is plain JS, so without
 * it the return infers as `{}` and every consumer has to re-declare the shape.
 * Typing it here fixes it once, at the source.
 *
 * @param {unknown} ent
 * @returns {Record<string, unknown> | null}
 */
export function projectEntitlement(ent) {
  if (!ent || typeof ent !== 'object') return null;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const k of INSPECTOR_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(ent, k)) out[k] = ent[k];
  }
  return out;
}

/* Bounded auto-refresh for later cancellation / payment-failure watching. A
 * lifecycle change arrives by webhook seconds after it happens in Stripe, so a
 * short bounded watch is enough; an unbounded one left open in a tab is a slow
 * request leak. */
export const REFRESH_INTERVAL_MS = 3000;
export const REFRESH_MAX_TICKS = 40; // ~2 minutes

export function refreshExhausted(ticks) {
  return ticks >= REFRESH_MAX_TICKS;
}
