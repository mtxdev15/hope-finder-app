/* The Gentle Guidance daily limit, decided in one place.
 *
 * WHY THIS EXISTS (the pre-launch audit, 2026-08-26)
 * /pricing promised Free three Gentle Guidance responses a day and Plus no
 * limit. Neither ceiling existed. convex/usage.ts held a complete, careful
 * meter — reserve, finalize, release, expiry, idempotence — and NOTHING in the
 * browser ever called it:
 *
 *     reserveUsage    -> 0 call sites in src/ and public/
 *     finalizeUsage   -> 0 call sites in src/ and public/
 *     releaseUsage    -> 0 call sites in src/ and public/
 *
 * The counter was read (that is why /billing could display "3 left today"
 * forever) and never written. Free and Plus were the same product, which meant
 * turning purchasing on would have sold a plan that changed nothing.
 *
 * THE POLICY, and every part of it is a deliberate choice rather than a default:
 *
 *   FAILS OPEN. If Convex is unreachable, if the reservation errors, if the
 *   answer is a shape we do not recognise, the request PROCEEDS. The only thing
 *   that may stop somebody is us having actually counted three today. This is
 *   the opposite of how the billing code fails, and the difference is the
 *   point: billing fails closed because the cost of being wrong is granting
 *   something unpaid, and this fails open because the cost of being wrong is
 *   refusing Scripture to somebody at 3am over a network blip.
 *
 *   GUESTS ARE NOT METERED HERE. A signed-out reader has no account to count
 *   against, so the reservation is never attempted and nothing is refused. See
 *   the note on GUEST.gentleGuidanceDaily below.
 *
 *   ONE STATED REASON REFUSES. `daily-limit-reached` and nothing else. Any
 *   other refusal the server could return means our own state is confusing, and
 *   the right answer to confusion is to let the person pray.
 *
 * DELIBERATELY FREE OF CONVEX IMPORTS. The plumbing lives in convex-data.js and
 * is injected. That is what lets scripts/verify-guidance-quota.ts import and
 * EXECUTE this policy under plain node, with no deployment and no credential —
 * the same reason convex/plusPlans.ts is shaped this way.
 */

/* The feature key convex/usage.ts counts under. One string, one home: a typo
   here would silently meter a feature nobody has limits for, which reads
   exactly like the bug this file was written to fix. */
export const GUIDANCE_FEATURE = 'gentle_guidance';

/* THE ONLY REFUSAL THAT REFUSES. Named as a constant so the suite asserts the
   set has exactly one member rather than asserting a string appears. */
export const REFUSING_REASONS = Object.freeze(['daily-limit-reached']);

/* A per-request id, used to tie the finalize or release back to the hold.
   crypto.randomUUID where it exists; the fallback is not security-sensitive
   because the server scopes every reservation to the authenticated user, so
   the worst a collision can do is finalize the caller's own other request. */
export function newRequestId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) { /* fall through */ }
  return 'g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * What to do with whatever reserveUsage came back with.
 *
 * @param {any} res  the raw mutation result, or null when it could not be made
 * @param {string} requestId  the id we asked to hold
 * @returns {{proceed: true, metered: boolean, requestId: string|null}
 *          |{proceed: false, reason: string, remaining: number|null}}
 */
export function interpretReserve(res, requestId) {
  /* NULL IS "WE COULD NOT ASK", never "no". convex-data returns null for a
     signed-out reader and for every transport failure, and those two must
     behave the same way: proceed, unmetered. */
  if (!res || typeof res !== 'object') {
    return { proceed: true, metered: false, requestId: null };
  }
  if (res.ok === true) {
    return { proceed: true, metered: true, requestId };
  }
  const reason = typeof res.reason === 'string' ? res.reason : '';
  if (REFUSING_REASONS.includes(reason)) {
    return {
      proceed: false,
      reason,
      remaining: typeof res.remaining === 'number' ? res.remaining : 0,
    };
  }
  /* A refusal we do not recognise, or `requires-account` reaching a reader who
     IS signed in. Both mean our own state is confusing, and confusion must not
     cost somebody the thing they came for. */
  return { proceed: true, metered: false, requestId: null };
}

/* Thrown by generateContent when, and only when, the limit actually refused.
   A distinct class rather than a flag on Error, so the page can tell "you have
   used today's three" apart from "the model call failed" without matching on a
   message string. */
export class GuidanceLimitError extends Error {
  constructor(reason, remaining) {
    super('gentle-guidance-limit:' + reason);
    this.name = 'GuidanceLimitError';
    this.reason = reason;
    this.remaining = typeof remaining === 'number' ? remaining : 0;
  }
}

export function isGuidanceLimit(err) {
  return !!err && err.name === 'GuidanceLimitError';
}

/* Why a held slot was given back. `failed` and `malformed` are counted as
   failures by convex/usage.ts; anything else is not. Kept as a named set so a
   future caller cannot invent a reason that silently lands in the wrong bucket. */
export const RELEASE_REASONS = Object.freeze({
  FAILED: 'failed',
  MALFORMED: 'malformed',
  ABANDONED: 'abandoned',
});
