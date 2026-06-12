/* Declare & Believe — device-local profile (V1 persistence decision).
   Who the user is, on THIS device — no accounts yet ("Saved on this device");
   Supabase migrates this later. Shape:
     { name, about, favoriteVerse, interests: [..],
       church: { name, address, placeId } | null,
       since: ts (first time the app saw this person) } */

const KEY = 'declare-profile-v1';

export function getProfile() {
  let p = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) p = JSON.parse(raw);
  } catch (e) {}
  if (!p || typeof p !== 'object') p = {};
  if (!p.since) { p.since = Date.now(); persist(p); }
  if (!Array.isArray(p.interests)) p.interests = [];
  return p;
}

function persist(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
}

export function setProfile(patch) {
  const p = getProfile();
  Object.assign(p, patch);
  persist(p);
  return p;
}

export function daysWith(p) {
  const d = Math.floor((Date.now() - (p.since || Date.now())) / 86400000);
  return d < 1 ? 1 : d + 1; // day 1 inclusive
}
