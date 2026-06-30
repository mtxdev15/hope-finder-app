/* Declare & Believe — Vault store (local-first, with Convex account sync).

   localStorage stays the instant local cache and the full store for guests. When
   the user is signed in AND data sync is configured (PUBLIC_CONVEX_URL set), the
   Vault is mirrored to Convex so it follows the account across devices:
     • on sign-in / load: push any local (guest) items up once, then pull the
       account's items and make them authoritative locally (so cross-device
       deletes propagate);
     • saveItem / removeItem / collections also write through to Convex.
   Every Convex call fails soft — if anything goes wrong we stay on localStorage,
   so the app never breaks (matches the auth "fail open" stance).

   The synchronous public API below is UNCHANGED, so call sites don't change.
   Pages that render a live list (vault, you) subscribe via onChange(). */

import { initAuth, isSignedIn, currentUser, onAuthChange } from './auth-store.js';
import {
  dataConfigured, vaultList, vaultSave, vaultRemove,
  collList, collAdd, collRemove,
} from './convex-data.js';

const KEY = 'declare-vault-v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.items)) return data;
    }
  } catch (e) { /* corrupted or unavailable -> start fresh */ }
  return { items: [] };
}

function persist(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* quota/private mode */ }
}

export function listItems() {
  return load().items.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function isSaved(id) {
  return load().items.some((it) => it.id === id);
}

export function saveItem(item) {
  const data = load();
  if (!item.id) item.id = item.type + ':' + Date.now();
  if (!data.items.some((it) => it.id === item.id)) {
    data.items.push({ ...item, ts: item.ts || Date.now() });
    persist(data);
  }
  mirror(() => vaultSave(toPayload(item)));
  return item.id;
}

export function removeItem(id) {
  const data = load();
  const before = data.items.length;
  data.items = data.items.filter((it) => it.id !== id);
  if (data.items.length !== before) persist(data);
  mirror(() => vaultRemove(id));
}

/* Deterministic id for a full "word" result so re-saving the same word toggles
   rather than duplicating. */
export function wordId(struggle, verses) {
  const refs = (verses || []).map((v) => v.ref).join('|');
  return 'word:' + struggle + ':' + refs;
}

/* ── collections (device-local, same persistence decision) ──
   { name, kind: 'verse'|'declaration'|'prayer'|null, ts }
   kind-collections gather every truth of that kind automatically;
   null = a named space the user curates. */
const COLLS_KEY = 'declare-vault-colls-v1';

function loadColls() {
  try {
    const raw = localStorage.getItem(COLLS_KEY);
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a)) return a;
    }
  } catch (e) {}
  return [];
}

function persistColls(colls) {
  try { localStorage.setItem(COLLS_KEY, JSON.stringify(colls)); } catch (e) {}
}

export function listCollections() {
  return loadColls().slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function addCollection(name, kind) {
  const colls = loadColls();
  if (!colls.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    const ts = Date.now();
    colls.push({ name, kind: kind || null, ts });
    persistColls(colls);
    mirror(() => collAdd(name, kind || null, ts));
  }
}

export function removeCollection(name) {
  const colls = loadColls().filter((c) => c.name !== name);
  persistColls(colls);
  mirror(() => collRemove(name));
}

/* ─────────────────────────── Convex sync layer ─────────────────────────── */

const subs = [];
/* Subscribe to re-render when a server pull lands. Used by /vault and /you. */
export function onChange(cb) { if (typeof cb === 'function') subs.push(cb); }
function fire() { subs.forEach((cb) => { try { cb(); } catch (e) {} }); }

/* Mirror a local change to Convex, best-effort with one retry. No-op for guests
   or when sync isn't configured. Never throws into the synchronous caller. */
function mirror(op) {
  if (!dataConfigured() || !isSignedIn()) return;
  Promise.resolve()
    .then(op)
    .catch(() => Promise.resolve().then(op).catch(() => {}));
}

/* Map a client item to the Convex `save` payload (clientId + only-defined fields;
   undefined is not a valid Convex value). */
function toPayload(item) {
  const p = { clientId: item.id, type: item.type, ts: item.ts || Date.now() };
  ['struggle', 'translation', 'explanation', 'prayer', 'text', 'ref', 'coll',
   'bgKind', 'bgPhotoId', 'bgSrc', 'bgBy', 'bgByLink', 'bgColor'].forEach((k) => {
    if (item[k] != null) p[k] = item[k];
  });
  if (Array.isArray(item.verses)) p.verses = item.verses.map((v) => ({ ref: v.ref || '', text: v.text || '' }));
  if (Array.isArray(item.declarations)) p.declarations = item.declarations.slice();
  return p;
}

let syncing = false;
async function syncDown() {
  if (!dataConfigured() || !isSignedIn() || syncing) return;
  syncing = true;
  try {
    const u = currentUser();
    const mergedKey = 'declare-vault-merged:' + ((u && u.email) || 'user');
    let firstTime = false;
    try { firstTime = !localStorage.getItem(mergedKey); } catch (e) {}

    // First sign-in on this device: lift any local (guest) data up before we
    // start trusting the server, so nothing is lost.
    if (firstTime) {
      for (const it of load().items) { try { await vaultSave(toPayload(it)); } catch (e) {} }
      for (const c of loadColls()) { try { await collAdd(c.name, c.kind || null, c.ts || Date.now()); } catch (e) {} }
      try { localStorage.setItem(mergedKey, String(Date.now())); } catch (e) {}
    }

    // Pull the account's data and make it authoritative locally.
    const serverItems = await vaultList();
    const serverColls = await collList();
    let changed = false;
    if (Array.isArray(serverItems)) { persist({ items: serverItems }); changed = true; }
    if (Array.isArray(serverColls)) { persistColls(serverColls); changed = true; }
    if (changed) fire();
  } finally {
    syncing = false;
  }
}

let inited = false;
function initVaultSync() {
  if (inited) return;
  inited = true;
  if (!dataConfigured()) return;
  // Run after the persisted session resolves on load, and on every sign-in.
  initAuth().then(() => { if (isSignedIn()) syncDown(); }).catch(() => {});
  onAuthChange(() => { if (isSignedIn()) syncDown(); });
}

// Auto-init on import (each page that uses the Vault triggers this once).
initVaultSync();
