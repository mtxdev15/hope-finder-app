/* Declare & Believe — generic account sync for small localStorage blobs.

   Same local-first model as vault-store: localStorage stays the instant cache;
   when signed in (and PUBLIC_CONVEX_URL is set) registered keys mirror to the
   Convex `userData` table so they follow the account across devices. Guests and
   unconfigured builds are untouched.

   Usage from a store/page:
     registerSyncKey('declare-profile-v1');     // declare what syncs
     mirror('declare-profile-v1');               // call after a local write
     onChange(rerender);                         // re-render when a pull lands
     whenSynced().then(buildUI);                 // build after the initial pull */

import { initAuth, isSignedIn, onAuthChange } from './auth-store.js';
import { dataConfigured, udGetAll, udSet, udSetOk } from './convex-data.js';

const keys = new Set();
const subs = [];
/* Optional per-key merge policies. Default (no resolver) stays "server wins /
   lift local when server is empty" — right for preferences. Progress-like keys
   (journey) pass a resolver so signing in can never destroy local progress. */
const resolvers = new Map();

export function registerSyncKey(key, resolve) {
  if (!key) return;
  keys.add(key);
  if (typeof resolve === 'function') resolvers.set(key, resolve);
}
export function onChange(cb) { if (typeof cb === 'function') subs.push(cb); }
function fire() { subs.forEach((cb) => { try { cb(); } catch (e) {} }); }

function readLocal(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function writeLocal(key, v) { try { localStorage.setItem(key, v); } catch (e) {} }

/* A language change reloads the page immediately, which can cancel the Convex push
   mid-flight — then the next syncDown would pull the OLD server language back and
   the user is stuck. So the change sets this flag first; while it's set, the local
   value is authoritative for that key (pushed up, never pulled down). Cleared only
   once a push actually completes. */
const LANG_PUSH_FLAG = 'declare-lang-push';
function langPushPending() { try { return localStorage.getItem(LANG_PUSH_FLAG) === '1'; } catch (e) { return false; } }
function clearLangPush() { try { localStorage.removeItem(LANG_PUSH_FLAG); } catch (e) {} }

let syncing = false;
async function syncDown() {
  if (!dataConfigured() || !isSignedIn() || syncing) return;
  syncing = true;
  try {
    const all = await udGetAll();
    if (!all || typeof all !== 'object') return;
    let changed = false;
    for (const key of keys) {
      const server = all[key];
      if (key === 'declare-lang' && langPushPending()) {
        // The user just chose a language on this device: local wins over the account.
        // Clear the flag ONLY on confirmed success — a failed push must keep local
        // authority, or the next sync would pull the stale server language back.
        const local = readLocal(key);
        if (local != null) { const ok = await udSetOk(key, local); if (ok) clearLangPush(); }
        continue;
      }
      const resolve = resolvers.get(key);
      if (resolve) {
        // Merge policy: the resolver picks (or builds) the winning blob; it flows
        // both ways so neither the account nor this device loses real progress.
        const local = readLocal(key);
        let winner = null;
        try { winner = resolve(server != null ? server : null, local); } catch (e) { winner = null; }
        if (winner != null) {
          if (winner !== local) { writeLocal(key, winner); changed = true; }
          if (winner !== server) { try { await udSet(key, winner); } catch (e) {} }
        }
        continue;
      }
      if (server != null) {
        // Account is authoritative: bring the server blob down to this device.
        if (readLocal(key) !== server) { writeLocal(key, server); changed = true; }
      } else {
        // Server has nothing yet: lift this device's local blob up (first sign-in).
        const local = readLocal(key);
        if (local != null) { try { await udSet(key, local); } catch (e) {} }
      }
    }
    if (changed) fire();
  } finally {
    syncing = false;
  }
}

/* Push a single key's current localStorage value up. Call after writing it. */
export function mirror(key) {
  if (!dataConfigured() || !isSignedIn()) return;
  const v = readLocal(key);
  if (v != null) Promise.resolve().then(() => udSet(key, v)).catch(() => {});
}

let resolveSynced;
const syncedPromise = new Promise((r) => { resolveSynced = r; });
/* Resolves after the initial sign-in pull (or immediately for guests). Pages
   that render from synced state (e.g. /journey) should build inside this. */
export function whenSynced() { return syncedPromise; }

/* Language preference follows the account across devices. It lives in the same
   'declare-lang' localStorage key the i18n engine reads, so registering it here
   lifts a device's choice up on first sign-in and pulls the account's choice
   down on every other device. When a pulled language differs from what this
   device rendered, reload ONCE so the whole app (including JS-built strings)
   re-renders in the account's language. i18n.js can't import this module (it's a
   plain global script), so it just emits a 'declare-lang' event we bridge up. */
function reconcileLang() {
  // The user's fresh, not-yet-pushed choice always wins — do not touch anything.
  if (langPushPending()) return;
  let acct = null;
  try { acct = localStorage.getItem('declare-lang'); } catch (e) {}
  if (acct !== 'es' && acct !== 'en') return;
  let cur = 'en';
  try { cur = (window.I18N && window.I18N.lang && window.I18N.lang()) || 'en'; } catch (e) {}
  if (acct === cur) return; // already in sync
  // Align the WHOLE stack (cookie + DOM + event) through setLang — the old code
  // reloaded without moving the cookie, so the mismatch survived the reload and
  // the app thrashed between languages.
  try { if (window.I18N && window.I18N.setLang) window.I18N.setLang(acct); } catch (e) {}
  // One guarded reload so JS-rendered strings rebuild in the account's language.
  let already = false;
  try { already = sessionStorage.getItem('declare-lang-synced') === '1'; } catch (e) {}
  if (!already) {
    try { sessionStorage.setItem('declare-lang-synced', '1'); } catch (e) {}
    try { location.reload(); } catch (e) {}
  }
}

let inited = false;
function init() {
  if (inited) return;
  inited = true;
  registerSyncKey('declare-lang'); // language rides the same account sync
  // Push the language up whenever the user changes it (menu toggle or banner).
  // Flag first: the page usually reloads right after, cancelling the push — the
  // flag makes the local choice authoritative until a push actually lands.
  try {
    document.addEventListener('declare-lang', function () {
      try { localStorage.setItem(LANG_PUSH_FLAG, '1'); } catch (e) {}
      const v = readLocal('declare-lang');
      if (dataConfigured() && isSignedIn() && v != null) {
        Promise.resolve().then(() => udSetOk('declare-lang', v))
          .then((ok) => { if (ok) clearLangPush(); }).catch(() => {});
      }
    });
  } catch (e) {}
  if (!dataConfigured()) { resolveSynced(); return; }
  initAuth()
    .then(() => { if (isSignedIn()) return syncDown(); })
    .catch(() => {})
    .finally(() => { reconcileLang(); resolveSynced(); });
  onAuthChange(() => { if (isSignedIn()) syncDown().then(reconcileLang); });
}
init();
