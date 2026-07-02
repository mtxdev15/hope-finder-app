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
import { dataConfigured, udGetAll, udSet } from './convex-data.js';

const keys = new Set();
const subs = [];

export function registerSyncKey(key) { if (key) keys.add(key); }
export function onChange(cb) { if (typeof cb === 'function') subs.push(cb); }
function fire() { subs.forEach((cb) => { try { cb(); } catch (e) {} }); }

function readLocal(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function writeLocal(key, v) { try { localStorage.setItem(key, v); } catch (e) {} }

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
  let acct = null;
  try { acct = localStorage.getItem('declare-lang'); } catch (e) {}
  if (acct !== 'es' && acct !== 'en') return;
  let rendered = 'en';
  try { rendered = document.documentElement.getAttribute('data-lang') || 'en'; } catch (e) {}
  if (acct === rendered) return; // already in sync
  let already = false;
  try { already = sessionStorage.getItem('declare-lang-synced') === '1'; } catch (e) {}
  if (already) { // never loop: apply what we can live and stop
    try { if (window.I18N && window.I18N.apply) window.I18N.apply(acct); } catch (e) {}
    return;
  }
  try { sessionStorage.setItem('declare-lang-synced', '1'); } catch (e) {}
  try { location.reload(); }
  catch (e) { try { if (window.I18N && window.I18N.apply) window.I18N.apply(acct); } catch (_) {} }
}

let inited = false;
function init() {
  if (inited) return;
  inited = true;
  registerSyncKey('declare-lang'); // language rides the same account sync
  // Push the language up whenever the user changes it (menu toggle or banner).
  try { document.addEventListener('declare-lang', function () { mirror('declare-lang'); }); } catch (e) {}
  if (!dataConfigured()) { resolveSynced(); return; }
  initAuth()
    .then(() => { if (isSignedIn()) return syncDown(); })
    .catch(() => {})
    .finally(() => { reconcileLang(); resolveSynced(); });
  onAuthChange(() => { if (isSignedIn()) syncDown().then(reconcileLang); });
}
init();
