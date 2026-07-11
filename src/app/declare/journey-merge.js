/* Merge policies for the journey sync keys.

   account-sync's default rule is "server wins" — right for preferences, wrong for
   journey progress: a guest who finishes Day 1 and THEN signs in would have their
   local progress overwritten by whatever the account held (often the literal
   string 'null' that clearActiveSaved() mirrors up as a tombstone). These
   resolvers make sign-in always keep the side with the real (or further) journey,
   so creating an account can never destroy the progress it exists to save.

   Pure functions over the raw localStorage strings: (serverStr, localStr) ->
   winning string, or null when neither side has anything to sync. */

function parseJson(raw) {
  if (raw == null || raw === '' || raw === 'null') return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/* db_active_journey: {id, day, returned, ts?} or a 'null' tombstone.
   One real side wins. Both real: same journey -> the further day wins (ties go
   local — it's the device the user is on right now); different journeys -> the
   newer write wins when both carry ts, else local. */
export function mergeActiveJourney(serverStr, localStr) {
  const s = parseJson(serverStr), l = parseJson(localStr);
  if (!s && !l) return null;
  if (!s) return localStr;
  if (!l) return serverStr;
  if (s.id === l.id) return ((s.day || 0) > (l.day || 0)) ? serverStr : localStr;
  if (typeof s.ts === 'number' && typeof l.ts === 'number') return (s.ts > l.ts) ? serverStr : localStr;
  return localStr;
}

/* db_journeys_done: array of rooted journey ids — union, never lose a rooting. */
export function mergeDoneList(serverStr, localStr) {
  const s = parseJson(serverStr), l = parseJson(localStr);
  const sa = Array.isArray(s) ? s : [], la = Array.isArray(l) ? l : [];
  if (!sa.length && !la.length) return null;
  const union = sa.slice();
  la.forEach((id) => { if (union.indexOf(id) < 0) union.push(id); });
  if (union.length === sa.length) return serverStr; // nothing new locally
  if (union.length === la.length && la.every((id, i) => union[i] === id)) return localStr;
  return JSON.stringify(union);
}

/* db_journey_lock: { [journeyId]: {date, time, day, returned} } — merge per
   journey, keeping whichever entry has walked further (ties go local). */
export function mergeLockMap(serverStr, localStr) {
  const s = parseJson(serverStr), l = parseJson(localStr);
  const so = (s && typeof s === 'object') ? s : {}, lo = (l && typeof l === 'object') ? l : {};
  const sKeys = Object.keys(so), lKeys = Object.keys(lo);
  if (!sKeys.length && !lKeys.length) return null;
  const merged = {};
  sKeys.forEach((id) => { merged[id] = so[id]; });
  lKeys.forEach((id) => {
    const sv = merged[id];
    if (!sv || ((lo[id] && lo[id].day) || 0) >= ((sv && sv.day) || 0)) merged[id] = lo[id];
  });
  const out = JSON.stringify(merged);
  if (serverStr != null && out === JSON.stringify(so)) return serverStr; // no local news
  return out;
}
