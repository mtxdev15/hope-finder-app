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

let inited = false;
function init() {
  if (inited) return;
  inited = true;
  if (!dataConfigured()) { resolveSynced(); return; }
  initAuth()
    .then(() => { if (isSignedIn()) return syncDown(); })
    .catch(() => {})
    .finally(() => resolveSynced());
  onAuthChange(() => { if (isSignedIn()) syncDown(); });
}
init();
