/* Declare & Believe — real accounts (Convex + Better Auth).
   Single source of truth for sign-up / sign-in / session state, same
   one-module pattern as vault-store and profile-store.

   The Convex SITE url is public-class: the client only does what the
   Better Auth backend (deployment good-dotterel-906) allows. It lives in
   the gitignored .env:
     PUBLIC_CONVEX_SITE_URL=https://good-dotterel-906.convex.site
     PUBLIC_AUTH_PROVIDERS=google   (read by auth-modal.js to render buttons)

   UNCONFIGURED (url missing): isConfigured() is false and every gate fails
   OPEN — the app keeps working ungated rather than breaking. */

import { createAuthClient } from 'better-auth/client';
import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins';
import { track } from './analytics.js';

const SITE_URL = import.meta.env.PUBLIC_CONVEX_SITE_URL || '';

let client = null;
let sessionData = null; // { user, session } | null
let inited = null;
const subs = [];

export function isConfigured() {
  return !!SITE_URL;
}

function ac() {
  if (!client && isConfigured()) {
    client = createAuthClient({
      baseURL: SITE_URL,
      plugins: [convexClient(), crossDomainClient()],
      // After a Google redirect the get-session call fails CORS because of an
      // Authorization header (get-convex/better-auth #129). Strip it on every request.
      fetchOptions: {
        onRequest(context) {
          if (context && context.headers) context.headers.delete('Authorization');
        },
      },
    });
  }
  return client;
}

/* The underlying Better Auth client — exposed so the Convex data layer
   (convex-data.js) can mint a Convex JWT via ac().convex.token() for
   authenticated queries/mutations. Returns null when accounts aren't configured. */
export function getAuthClient() { return ac(); }

function fire() { subs.forEach((cb) => { try { cb(); } catch (e) {} }); }

/* Bound every auth network call so a stalled cross-domain request can never hang
   the UI (the failure mode that hung sign-in on a mobile browser holding a stale
   token). On timeout we resolve to a clean guest state and drop the bad token. */
const AUTH_TIMEOUT_MS = 9000;
function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('auth-timeout')), AUTH_TIMEOUT_MS)),
  ]);
}
/* Drop the cross-domain client's cached token/session so the next attempt starts
   fresh (keys come from @convex-dev/better-auth's crossDomainClient). */
function clearStaleAuth() {
  try {
    localStorage.removeItem('better-auth_cookie');
    localStorage.removeItem('better-auth_session_data');
  } catch (e) {}
}
/* Sign-out wipes device-local personal info so a signed-out device is a clean
   guest: no name, church, anchor verse, about, interests, or rate state left for
   the next person. This data mirrors to the account, so signing back in restores
   it. Saved words/verses (the vault) are left intact on purpose. */
function clearPersonalData() {
  try {
    localStorage.removeItem('declare-profile-v1');
    localStorage.removeItem('declare-rate-v1');
    localStorage.removeItem('declare-words-received');
  } catch (e) {}
}

/* ── Expired sessions ─────────────────────────────────────────────────────────
 * A session that has simply aged out is the most ordinary thing that can happen
 * to a signed-in device, and it was leaving a 401 in the console on EVERY page
 * load, forever. The cause was not the 401 itself: the library clears
 * `better-auth_session_data` when the server refuses, but the dead
 * `better-auth_cookie` stayed behind, so the next load presented it again and
 * got refused again. Nothing converged.
 *
 * Two rules fix it. Never present credentials the device itself already knows
 * are dead, and when the server refuses, stop keeping them.
 *
 * What this deliberately does NOT do is swallow every 401. Four things look
 * alike from here and must not be treated alike:
 *
 *   expired    the stored session's own expiry has passed. Expected. Quiet.
 *   rejected   still inside its validity window, and the server refused anyway.
 *              That is not routine — it stays visible as a console error.
 *   offline    the device has no network. The session may be perfectly good.
 *   unreachable the request timed out or threw. Same: assume nothing.
 *
 * Only the first two are grounds for ending the session. The other two leave
 * the stored credentials alone and let the next load try again, because
 * throwing away a valid session over a dropped connection would sign people out
 * of their own account for being on a train. */

/* The device's own copy of when this session dies, in ms, or null if it cannot
 * be read. Never throws: a corrupt record is simply unknown, not expired. */
function sessionExpiryMs() {
  try {
    const o = JSON.parse(localStorage.getItem('better-auth_session_data') || 'null');
    const raw = o && (o.session ? o.session.expiresAt : o.expiresAt);
    const t = raw ? Date.parse(raw) : NaN;
    return Number.isFinite(t) ? t : null;
  } catch (e) { return null; }
}

function hasStoredAuth() {
  try {
    return !!localStorage.getItem('better-auth_cookie') ||
           !!localStorage.getItem('better-auth_session_data');
  } catch (e) { return false; }
}

/* End the session on this device. Same shape as signing out, because from the
 * device's point of view that is what has happened.
 *
 * `clearPersonalData()` is deliberate: the profile, rate state and words-received
 * are personal content that must not keep rendering under an identity the server
 * no longer accepts. It mirrors to the account, so signing back in restores it.
 * Journey progress and the Vault are NOT touched — those are the reader's own
 * work, they survive a signed-out device by design, and deleting them over an
 * expiry would be the data-loss failure all over again.
 *
 * The locale cache is left in place too. It is already withheld from a guest by
 * fruitLogEligibility()/review eligibility, so an invalid identity cannot see
 * it; deleting it would only throw away translations that become valid again
 * the moment the reader signs back in. */
function endSession(reason) {
  sessionData = null;
  clearStaleAuth();
  clearPersonalData();
  if (reason === 'rejected') {
    // Not routine. Something refused credentials that had not expired yet, and
    // that must stay observable rather than being folded into normal expiry.
    console.error('[auth] session credentials were refused while still inside their validity window; treating this device as signed out.');
  }
}

/* Runs BEFORE the auth client is built. If the device's own record says the
 * session is already dead, there is nothing to validate, and presenting it would
 * produce exactly the 401 this is here to stop. Dropping it here means the
 * request is never made at all — which is the difference between "the error
 * appears once" and "the error appears on every load". */
function dropExpiredAuthBeforeInit() {
  if (!hasStoredAuth()) return false;
  const exp = sessionExpiryMs();
  if (exp === null || exp > Date.now()) return false;
  endSession('expired');
  return true;
}

async function refreshSession() {
  const hadStoredAuth = hasStoredAuth();
  try {
    const res = await withTimeout(ac().getSession());
    sessionData = (res && res.data) || null;
  } catch (e) {
    // Timed out or threw: network or server, not a verdict on the session.
    // Fall back to guest for THIS load and keep the credentials for the next.
    sessionData = null;
    return sessionData;
  }
  if (sessionData || !hadStoredAuth) return sessionData;

  /* The request completed and came back with no session, while this device was
     holding credentials. That is a verdict, not a connection problem — a dropped
     connection throws above rather than resolving. Offline is still checked,
     because a browser that answers from a dead cache should not cost anyone
     their session. */
  try { if (navigator && navigator.onLine === false) return sessionData; } catch (e) {}

  /* Only shout when there is positive evidence something is wrong. A readable
     expiry still in the future means credentials were refused early, which is
     worth seeing. An expiry that is past, OR one that cannot be read at all —
     the common case, because the library has usually already dropped its own
     session record by this point — is ordinary expiry and stays quiet.
     Treating "unknown" as suspicious would put a permanent error in the console
     for the most routine event a signed-in device experiences, which is the
     thing this change exists to remove. */
  const exp = sessionExpiryMs();
  endSession(exp !== null && exp > Date.now() ? 'rejected' : 'expired');
  return sessionData;
}

/* Google (OAuth) return leg. The provider redirect lands back here with a
   one-time token in the URL (?ott=…) — the session token itself never crosses
   domains. It MUST be exchanged at /cross-domain/one-time-token/verify to
   become a session this browser can hold; the library only does that exchange
   inside its React provider, which this vanilla app doesn't use, so we do it
   here. Without this, Google sign-in creates the account server-side but the
   user lands back signed out — "nothing happened". */
async function consumePendingOAuth() {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('ott');
    if (!token) return;
    // Strip the token from the URL first: it is single-use, and a reload or
    // share of the URL must not retry (or leak) it.
    url.searchParams.delete('ott');
    window.history.replaceState({}, '', url);
    const res = await withTimeout(ac().crossDomain.oneTimeToken.verify({ token }));
    const user = res && res.data && res.data.user;
    if (user) {
      // New account if Better Auth created the user within this flow (~3 min
      // ott lifetime); otherwise it's a returning Google sign-in.
      const isNew = user.createdAt && (Date.now() - new Date(user.createdAt).getTime()) < 3 * 60 * 1000;
      track(isNew ? 'signup_completed' : 'signin_completed', { method: 'google' });
    }
  } catch (e) {
    // A dead/expired token must not block the page — they can just retry.
    if (e && e.message === 'auth-timeout') clearStaleAuth();
  }
}

/* Resolve the persisted session once per page load; after this resolves,
   isSignedIn()/currentUser() are synchronous. */
export function initAuth() {
  if (inited) return inited;
  if (!isConfigured()) {
    console.warn('[auth] PUBLIC_CONVEX_SITE_URL not set — sign-in gates are open.');
    inited = Promise.resolve(null);
    return inited;
  }
  /* Before anything is asked of the network. A session the device already knows
     is dead is dropped here, so the client is never handed it and the token
     request that produced the recurring 401 is never made. */
  dropExpiredAuthBeforeInit();
  /* Listeners are notified exactly once per page load, whether this resolved to
     a live session or to a clean guest. Firing again from inside the expiry path
     would repaint every subscriber twice for a state that never changed. */
  inited = consumePendingOAuth().then(refreshSession).then((s) => { fire(); return s; });
  return inited;
}

/* pages that display session state (e.g. /you) re-render on change */
export function onAuthChange(cb) { subs.push(cb); }

export function isSignedIn() {
  return !!(sessionData && sessionData.user);
}

export function currentUser() {
  if (!sessionData || !sessionData.user) return null;
  const u = sessionData.user;
  const first = ((u.name || '').trim().split(/\s+/)[0]) || '';
  // B1.5B: additive only — email/firstName keep their exact prior meaning and
  // position; name/image are the session's own fields, passed through as-is
  // (never fetched separately, never cached elsewhere).
  return { email: u.email || '', firstName: first, name: u.name || '', image: u.image || '' };
}

/* All return { ok, error } — error is a human sentence, never a code.
   Matches Better Auth error shape { message, code, status }. */
function nice(err) {
  const m = ((err && err.message) || '') + ' ' + ((err && err.code) || '');
  const status = err && err.status;
  if (/not.?verified|EMAIL_NOT_VERIFIED|verify (your )?email/i.test(m)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/invalid.*(email|password|credentials)|INVALID_EMAIL_OR_PASSWORD/i.test(m)) return 'That email and password don’t match. Try again?';
  if (/already.*exist|already registered|USER_ALREADY_EXISTS/i.test(m)) return 'That email already has an account — sign in instead.';
  if (status === 429 || /rate.?limit|too many/i.test(m)) return 'Too many tries — wait a moment and try again.';
  if (/valid email|INVALID_EMAIL/i.test(m)) return 'That doesn’t look like an email address.';
  if (/password.*(short|at least|8)|PASSWORD_TOO_SHORT/i.test(m)) return 'Use at least 8 characters for your password.';
  if (/failed to fetch|network|load failed/i.test(m)) return 'Can’t reach the server — check your connection and try again.';
  if (/provider.*(not enabled|disabled)|not enabled/i.test(m)) return 'That sign-in option isn’t turned on yet.';
  if (/same.*password|should be different/i.test(m)) return 'Choose a password different from your old one.';
  if (/token|expired|invalid|session.*missing|INVALID_TOKEN/i.test(m)) return 'This reset link has expired — request a new one.';
  return (err && err.message) || 'Something went wrong — please try again.';
}

export async function signUp({ name, email, password }) {
  if (!isConfigured()) return { ok: false, error: 'Accounts aren’t set up yet.' };
  // Simple sign-up: creates the account and a session immediately (no email
  // verification step), so the caller can take them straight into the app.
  try {
    const { error } = await withTimeout(ac().signUp.email({ name: name || '', email, password }));
    if (error) return { ok: false, error: nice(error) };
  } catch (e) {
    if (e && e.message === 'auth-timeout') { clearStaleAuth(); return { ok: false, error: 'That took too long — please try again.' }; }
    return { ok: false, error: nice(e) };
  }
  await refreshSession(); fire();
  track('signup_completed', { method: 'email' }); // Google goes through OAuth (signInWithProvider), tracked later
  return { ok: true };
}

export async function signIn({ email, password }) {
  if (!isConfigured()) return { ok: false, error: 'Accounts aren’t set up yet.' };
  try {
    const { error } = await withTimeout(ac().signIn.email({ email, password }));
    if (error) return { ok: false, error: nice(error) };
  } catch (e) {
    // A stalled request (e.g. a stale cross-domain token wedging the call) must
    // not hang the button: drop the bad token and let them retry clean.
    if (e && e.message === 'auth-timeout') { clearStaleAuth(); return { ok: false, error: 'That took too long — please try again.' }; }
    return { ok: false, error: nice(e) };
  }
  await refreshSession(); fire();
  // Mirrors signup_completed on the email path. Without this only Google
  // sign-ins were ever counted, so the allowlisted method values would have
  // read google-only and made email look unused rather than untracked.
  track('signin_completed', { method: 'email' });
  return { ok: true };
}

/* Forgot password — emails a reset link to `redirectTo?token=…`. The link lands
   on /reset-password, which reads the token and calls updatePassword(). */
export async function resetPassword(email, redirectTo) {
  if (!isConfigured()) return { ok: false, error: 'Accounts aren’t set up yet.' };
  const { error } = await ac().requestPasswordReset({ email, redirectTo });
  if (error) return { ok: false, error: nice(error) };
  return { ok: true };
}

/* Set a new password using the token from the reset link in the URL.
   Interface stays single-arg: the token is read here, not passed by the caller. */
export async function updatePassword(password) {
  if (!isConfigured()) return { ok: false, error: 'Accounts aren’t set up yet.' };
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) return { ok: false, error: 'This reset link has expired — request a new one.' };
  const { error } = await ac().resetPassword({ newPassword: password, token });
  if (error) return { ok: false, error: nice(error) };
  return { ok: true };
}

/* OAuth (Google). LEAVES the page: the browser redirects to the provider and
   returns to `redirectTo` (callbackURL), where initAuth() re-establishes the
   session on next load. */
export async function signInWithProvider(provider, redirectTo) {
  if (!isConfigured()) return { ok: false, error: 'Accounts aren’t set up yet.' };
  try {
    // errorCallbackURL: if the provider leg fails after the redirect (denied
    // consent, expired state, …), come back to OUR page flagged with
    // ?authError=1 — never strand the user on a blank backend error page.
    const back = new URL(redirectTo);
    back.searchParams.set('authError', '1');
    const { data, error } = await withTimeout(ac().signIn.social({
      provider, callbackURL: redirectTo, errorCallbackURL: back.toString(),
    }));
    if (error) return { ok: false, error: nice(error) };
    // Defensive: if the client returned a URL without auto-navigating, go there.
    if (data && data.url && typeof window !== 'undefined') window.location.href = data.url;
    return { ok: true }; // success = the browser is now navigating away
  } catch (e) {
    // A wedged request must not leave the button dead — clear and let them retry.
    if (e && e.message === 'auth-timeout') { clearStaleAuth(); return { ok: false, error: 'That took too long — please try again.' }; }
    return { ok: false, error: nice(e) };
  }
}

export async function signOut() {
  if (!isConfigured()) return;
  try { await ac().signOut(); } catch (e) {}
  sessionData = null;
  clearPersonalData();   // a signed-out device is a guest; nothing personal lingers
  clearStaleAuth();
  fire();
}
