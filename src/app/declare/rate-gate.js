/* Declare & Believe — Rate & Review gating (device-local counters).
   Decides when the AUTOMATIC results toast may appear. Submission itself lives
   in Convex; these counters are localStorage only (per the feature spec).

   Gate (cro-refined): signed in, >= 3 lifetime Words received, not already
   submitted, under the 2-dismissal cap, and past the 30-day cooldown. The
   "once per session" guard lives in rate-review.js (the toast's own behavior).
   The three explicit entry points (profile/footer/menu) bypass all of this. */

import { isSignedIn } from './auth-store.js';

const WORDS_KEY = 'declare-words-received'; // lifetime count
const STATE_KEY = 'declare-rate-v1';        // { submitted, dismissals, cooldownUntil }
const MIN_WORDS = 3;
const MAX_DISMISSALS = 2;
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) { const s = JSON.parse(raw); if (s && typeof s === 'object') return s; }
  } catch (e) {}
  return { submitted: false, dismissals: 0, cooldownUntil: 0 };
}
function writeState(s) { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) {} }

/* Count one Word received (called from /today's render after a Word lands). */
export function recordWordReceived() {
  try {
    const n = parseInt(localStorage.getItem(WORDS_KEY) || '0', 10) || 0;
    localStorage.setItem(WORDS_KEY, String(n + 1));
  } catch (e) {}
}
export function wordsReceived() {
  try { return parseInt(localStorage.getItem(WORDS_KEY) || '0', 10) || 0; } catch (e) { return 0; }
}

/* The business gate for the auto toast. */
export function isToastEligible() {
  if (!isSignedIn()) return false;
  if (wordsReceived() < MIN_WORDS) return false;
  const s = readState();
  if (s.submitted) return false;
  if ((s.dismissals || 0) >= MAX_DISMISSALS) return false;
  if (Date.now() < (s.cooldownUntil || 0)) return false;
  return true;
}

/* "Not now": back off — bump the dismissal count and start a 30-day cooldown. */
export function noteDismissed() {
  const s = readState();
  s.dismissals = (s.dismissals || 0) + 1;
  s.cooldownUntil = Date.now() + COOLDOWN_MS;
  writeState(s);
}

/* Submitted: never auto-ask again. */
export function noteSubmitted() {
  const s = readState();
  s.submitted = true;
  writeState(s);
}
