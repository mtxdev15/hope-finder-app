/* Declare & Believe — authenticated Convex data client (vault + userData sync).

   Talks to the Convex DATA endpoint (PUBLIC_CONVEX_URL, the .convex.cloud URL,
   distinct from the .site auth URL). The auth token is minted from the Better
   Auth session via ac().convex.token().

   IMPORTANT: the heavy Convex client (`convex/browser`) and the generated `api`
   are LAZY-loaded — only when a real query/mutation runs. This keeps the Convex
   client OUT of the static import graph of the auth modal / profile-store / the
   sign-in path (importing it there once hung sign-in on mobile).

   Every call fails SOFT: if data isn't configured, the user isn't signed in, or
   the network hiccups, these return null and the caller stays on localStorage. */

import { getAuthClient, initAuth, isConfigured, isSignedIn } from './auth-store.js';

const URL = import.meta.env.PUBLIC_CONVEX_URL || '';

let http = null;
let apiRef = null;

/* Lightweight, synchronous — safe to call from anywhere without loading anything. */
export function dataConfigured() {
  return !!URL && isConfigured();
}

/* Lazy-load the client + api on first real use. Returns false if not configured. */
async function ensure() {
  if (!URL) return false;
  try {
    if (!http) {
      const { ConvexHttpClient } = await import('convex/browser');
      http = new ConvexHttpClient(URL);
    }
    if (!apiRef) {
      apiRef = (await import('../../../convex/_generated/api')).api;
    }
    return true;
  } catch (e) { return false; }
}

async function freshToken() {
  try {
    const ac = getAuthClient();
    if (!ac || !ac.convex) return null;
    const res = await ac.convex.token({ fetchOptions: { throw: false } });
    return (res && res.data && res.data.token) || null;
  } catch (e) { return null; }
}

async function authed() {
  /* Never mint a token for a device that has no session.
   *
   * This used to ask unconditionally, so a guest — including anyone whose
   * session had simply aged out — hit /api/auth/convex/token on every Convex
   * call, got a 401 every time, and left one console error per call per page
   * load, permanently. The endpoint was answering correctly; the mistake was
   * asking at all.
   *
   * initAuth() is awaited rather than assumed: it is memoised, so this is free
   * after the first call, and without it a call racing page start would read
   * isSignedIn() before the session had resolved and wrongly skip a request a
   * signed-in reader was entitled to make. */
  try { await initAuth(); } catch (e) {}
  if (!isSignedIn()) return null;
  if (!(await ensure())) return null;
  const t = await freshToken();
  if (!t) return null;
  http.setAuth(t);
  return http;
}

async function runQuery(fn, args) {
  try { const c = await authed(); return c ? await c.query(fn, args || {}) : null; }
  catch (e) { return null; }
}
async function runMutation(fn, args) {
  try { const c = await authed(); return c ? await c.mutation(fn, args || {}) : null; }
  catch (e) { return null; }
}
async function runAction(fn, args) {
  try { const c = await authed(); return c ? await c.action(fn, args || {}) : null; }
  catch (e) { return null; }
}

/* Journey prose translation. Journey-authored fields only — the action rejects
   anything else server-side, and the browser must never send a reflection or a
   user-written prayer. Identity is derived server-side; no userId is sent.

   Referenced by name through anyApi rather than the generated api, for the same
   reason as the slot wrappers above: convex/journeyTranslate.ts reaches into
   usage and entitlement code, and vendoring it would pull that source into a
   Journey release for no benefit. The action is already deployed and verified
   in production; the client only needs a reference. */
export async function journeyTranslate(fields) {
  const { anyApi } = await import('convex/server');
  return (await ensure())
    ? runAction(anyApi.journeyTranslate.translateJourneyDay, {
        fields, sourceLocale: 'en', displayLocale: 'es',
      })
    : null;
}

/* ── Vault ── */
/* ── Active-Journey slots ──────────────────────────────────────────────────
 * Partial extraction from cdb8d11, which also removed the retired giving data
 * model. Only these three wrappers are taken; none of that commit's donation,
 * schema or Worker changes are part of this release.
 *
 * These reference the deployed functions BY NAME through anyApi rather than the
 * generated api, deliberately. convex/journeySlots.ts imports the entitlement
 * catalog, so vendoring it here would pull monetization source into a Journey
 * release for no benefit: the functions are already live in production, and the
 * client only needs a reference to call them.
 *
 * Every call is fire-and-forget at the call site. Journey progress lives
 * locally and is the user's real work; a sync failure must never block it. */
async function slotApi() {
  const { anyApi } = await import('convex/server');
  return anyApi.journeySlots;
}
export async function journeyStart(journeyId) {
  return (await ensure()) ? runMutation((await slotApi()).registerJourneyStart, { journeyId }) : null;
}
export async function journeyEnsure(journeyId) {
  return (await ensure()) ? runMutation((await slotApi()).ensureJourneySlot, { journeyId }) : null;
}
export async function journeyRelease(journeyId, status) {
  return (await ensure()) ? runMutation((await slotApi()).releaseJourneySlot, { journeyId, status }) : null;
}

export async function vaultList() { return (await ensure()) ? runQuery(apiRef.vault.list, {}) : null; }
export async function vaultSave(payload) { return (await ensure()) ? runMutation(apiRef.vault.save, payload) : null; }
export async function vaultRemove(clientId) { return (await ensure()) ? runMutation(apiRef.vault.remove, { clientId }) : null; }
export async function collList() { return (await ensure()) ? runQuery(apiRef.vault.listCollections, {}) : null; }
export async function collAdd(name, kind, ts) { return (await ensure()) ? runMutation(apiRef.vault.addCollection, { name, kind: kind ?? null, ts }) : null; }
export async function collRemove(name) { return (await ensure()) ? runMutation(apiRef.vault.removeCollection, { name }) : null; }

/* ── generic per-user key/value blobs (profile, journey, …) ── */
export async function udGetAll() { return (await ensure()) ? runQuery(apiRef.userdata.getAll, {}) : null; }
export async function udSet(key, value) { return (await ensure()) ? runMutation(apiRef.userdata.set, { key, value }) : null; }
/* Like udSet but returns a REAL success boolean. The server mutation returns null
   on success, so udSet's fail-soft null is indistinguishable from failure — callers
   that must know (e.g. the language push flag) use this instead. */
export async function udSetOk(key, value) {
  if (!(await ensure())) return false;
  try {
    const c = await authed(); if (!c) return false;
    await c.mutation(apiRef.userdata.set, { key, value });
    return true;
  } catch (e) { return false; }
}

/* ── reviews (rate & review) — submit requires sign-in; the approved/public
   read is for a future testimonial wall (currently authed-only, same as the
   other helpers; a signed-out read path can be added when that wall ships). ── */
export async function reviewsSubmit(payload) { return (await ensure()) ? runMutation(apiRef.reviews.submit, payload) : null; }
export async function reviewsListApprovedPublic() { return (await ensure()) ? runQuery(apiRef.reviews.listApprovedPublic, {}) : null; }
export async function reviewsMine() { return (await ensure()) ? runQuery(apiRef.reviews.myReview, {}) : null; }

/* ── entitlements (the account's own tier) ──────────────────────────────────
   The ONLY confirmation the checkout success page trusts. Server-resolved from
   the session; no userId is sent and none could be. Fails soft like every other
   helper here, and the success page treats null as "not yet", never as
   "confirmed". */
export async function myEntitlements() {
  return (await ensure()) ? runQuery(apiRef.entitlements.getMyEntitlements, {}) : null;
}

/* ── giving history (signed-in user's own gifts, newest first) ── */
export async function myGifts() { return (await ensure()) ? runQuery(apiRef.gifts.myGifts, {}) : null; }

/* ── Stripe Billing Portal ────────────────────────────────────────────────
 * The ONE place the app asks for a Portal session, so the empty payload is a
 * property of the wrapper rather than something each caller has to remember.
 *
 * The browser sends `{}`. It cannot send a Stripe Customer id, a Subscription
 * id, a user id or a return URL, because the deployed action has no such
 * argument — it accepts `lang` only, resolves the Customer from our own
 * billingCustomers mapping for the authenticated user, and builds return_url
 * from SITE_URL server-side.
 *
 * The retired donation portal resolved its customer from a browser-supplied
 * email, which meant submitting someone else's address opened THEIR billing
 * portal. Sending nothing is what makes that class of bug unrepresentable.
 *
 * Returns { url } on success, { error } for a handled refusal
 * (`no-subscription`, `not-authenticated`, `billing-not-configured`,
 * `stripe-error`), or null when the client is unavailable. Callers must treat
 * null as "unknown", never as success. */
export async function openBillingPortal() {
  return (await ensure()) ? runAction(apiRef.billing.createPortalSession, {}) : null;
}
