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
 * an unbounded poll on a page a user may leave open is a slow request leak.
 *
 * WHY THIS IS A BACKOFF AND NOT ONE FLAT INTERVAL
 * It used to be a flat 2s poll for 30s, on the belief that "webhook confirmation
 * either lands in seconds or needs a human to look." The first real production
 * purchase (2026-08-26) disproved that: the entitlement landed correctly, but
 * after the 30s bound, so the buyer was shown "Still confirming" for a purchase
 * that had already succeeded. The chain is Stripe → Worker → Convex → a Stripe
 * re-fetch → write, and on a cold path every hop pays a start-up cost. Thirty
 * seconds was not a property of the system, it was a guess.
 *
 * Simply raising the flat bound to 120s would quadruple the request count for
 * the common case, which lands in the first few seconds. So the window widens
 * where it is cheap instead: fast while a normal confirmation is expected, slow
 * while waiting out a cold start.
 *
 *   0-20s    every 2s   10 polls   the overwhelming majority land here
 *   20-120s  every 5s   20 polls   cold Worker, cold Convex, slow re-fetch
 *
 * 30 requests over 120s, against 15 over 30s before: four times the window for
 * twice the requests. */
import { planState } from './plan-display.js';

export const POLL_INTERVAL_MS = 2000;
export const POLL_FAST_UNTIL_MS = 20000;
export const POLL_SLOW_INTERVAL_MS = 5000;
export const POLL_TIMEOUT_MS = 120000;

const FAST_POLLS = Math.floor(POLL_FAST_UNTIL_MS / POLL_INTERVAL_MS);
const SLOW_POLLS = Math.floor((POLL_TIMEOUT_MS - POLL_FAST_UNTIL_MS) / POLL_SLOW_INTERVAL_MS);
export const MAX_POLLS = FAST_POLLS + SLOW_POLLS;

/* How long to wait before attempt number `attempts` (0-based: the delay AFTER
 * that many attempts have already been made). Callers must use this rather than
 * POLL_INTERVAL_MS directly, or the slow phase silently never happens. */
export function pollDelayMs(attempts) {
  return attempts < FAST_POLLS ? POLL_INTERVAL_MS : POLL_SLOW_INTERVAL_MS;
}

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
 * DELEGATES to plan-display.js rather than deciding for itself. Before this,
 * the success page and the account page interpreted the same response with
 * two separate rule sets, which is how one surface ends up saying billing is
 * fine while another says it needs attention. There is now one rule set.
 *
 * A null response (offline, signed out mid-poll, a soft failure in
 * convex-data.js) is `pending`, not `confirmed` and not an error: the honest
 * answer is that we do not know yet. */
export function stateForEntitlement(ent) {
  const state = planState(ent);
  /* Ambiguity is not success. Two providers billing one account must not show
     a clean "Welcome to Declare Plus". */
  if (state === 'plus-attention' || state === 'plus-ambiguous') return 'attention';
  if (state === 'plus-active' || state === 'plus-cancelling') return 'confirmed';
  return 'pending';
}

/** True once polling has run out of attempts. */
export function pollExhausted(attempts) {
  return attempts >= MAX_POLLS;
}
