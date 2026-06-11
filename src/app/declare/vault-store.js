/* Declare & Believe — device-local Vault store (V1 persistence decision).
   Everything a user keeps lives in localStorage under 'declare-vault-v1' —
   no accounts yet ("Saved on this device"). Supabase migrates this later.
   Item shape (forward-compatible):
     { id, type: 'word' | 'verse' | 'declaration' | 'prayer',
       struggle?, translation?, verses?, explanation?, declarations?, prayer?,
       text?, ref?, coll?, ts } */

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
  return item.id;
}

export function removeItem(id) {
  const data = load();
  const before = data.items.length;
  data.items = data.items.filter((it) => it.id !== id);
  if (data.items.length !== before) persist(data);
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

export function listCollections() {
  return loadColls().slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function addCollection(name, kind) {
  const colls = loadColls();
  if (!colls.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    colls.push({ name, kind: kind || null, ts: Date.now() });
    try { localStorage.setItem(COLLS_KEY, JSON.stringify(colls)); } catch (e) {}
  }
}

export function removeCollection(name) {
  const colls = loadColls().filter((c) => c.name !== name);
  try { localStorage.setItem(COLLS_KEY, JSON.stringify(colls)); } catch (e) {}
}
