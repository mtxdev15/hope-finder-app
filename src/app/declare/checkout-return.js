/* Declare & Believe — the checkout return pages' decisions, in one place.
 *
 * WHY THIS IS A SEPARATE MODULE
 * The two rules that matter here are security rules, and a security rule that
 * only exists inside an .astro <script> can only be tested by grepping for it.
 * Keeping them here lets scripts/verify-checkout-return-pages.ts import and
 * EXECUTE the real functions, the same way subscriptionGuard.ts is exercised
 * by its suite rather than described by it.
 *
 * THE SECURITY MODEL, IN ONE LINE
 * Convex entitlement state is the only thing that confirms a subscription.
 * The redirect from Stripe proves nothing: `session_id` is attacker-supplied
 * as far as this page is concerned, since anyone can type it into the URL bar.
 */

/* Polling bounds for the success page's "confirming" state. Bounded on purpose:
 * an unbounded poll on a page a user may leave open is a slow request leak, and
 * webhook confirmation either lands in seconds or needs a human to look. */
export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 30000;
export const MAX_POLLS = Math.floor(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

/* Plan aliases we will render copy for. An allowlist, not a passthrough: the
 * value arrives in the query string, so echoing it would put attacker-chosen
 * text on the page. Anything unrecognised resolves to null and the page says
 * nothing about a plan rather than guessing.
 *
 * `plus-annual` is here so the annual plan needs no code change later — it is
 * the same alias vocabulary convex/plusPlans.ts already uses. */
const PLAN_LABELS = {
  'plus-monthly': 'Plus monthly',
  'plus-annual': 'Plus annual',
};

/** A display label for an allowlisted plan alias, or null. Never echoes input. */
export function planLabel(raw) {
  if (typeof raw !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(PLAN_LABELS, raw)
    ? PLAN_LABELS[raw]
    : null;
}

/* Which state the success page should show, from the entitlement response
 * ALONE. No session id, no query parameter, no Stripe call feeds this.
 *
 *   confirmed  the account actually holds Plus
 *   attention  the account needs to fix billing — never claim success here
 *   pending    not yet; keep waiting within the bound
 *
 * A null response (offline, signed out mid-poll, a soft failure in
 * convex-data.js) is `pending`, not `confirmed` and not an error: the honest
 * answer is that we do not know yet. */
export function stateForEntitlement(ent) {
  if (!ent || typeof ent !== 'object') return 'pending';
  if (ent.paymentNeedsAttention === true) return 'attention';
  if (ent.tier === 'plus') return 'confirmed';
  return 'pending';
}

/** True once polling has run out of attempts. */
export function pollExhausted(attempts) {
  return attempts >= MAX_POLLS;
}
