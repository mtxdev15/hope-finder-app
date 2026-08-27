/* Declare & Believe — what the reader actually has going.
 *
 * WHY THIS EXISTS
 *
 * The app already knew all of this and never said it. `myOpenJourneys` had one
 * caller in the whole codebase: the sheet that refuses somebody a new Journey.
 * `db_journey_lock` is structurally a per-struggle progress ledger, one row for
 * every struggle ever started on the device, and only ever read at the ONE id
 * the app considered current. So the device knew a reader had reached Day 3 of
 * Shame before switching, and the only place that fact ever surfaced was as a
 * wall.
 *
 * This turns the same records into an inventory: what you are walking, what you
 * set aside, what has rooted. Pure, so scripts/verify-journey-inventory.ts runs
 * it rather than reads it. No DOM, no storage, no network, no imports.
 *
 * IT WORKS SIGNED OUT, WHICH IS THE POINT. The 3am user is usually not signed
 * in. The device records are the primary source and the server's open-slot rows
 * only ADD to them — a Journey started on a phone and opened later on a laptop
 * would otherwise be invisible on the laptop. Neither source is allowed to
 * delete from the other: a missing server row is not evidence that local
 * progress is fake, and a server row with no local record is still a real
 * Journey the reader began.
 */

const TOTAL_DAYS = 5;

function dayOf(lockMap, id) {
  const row = lockMap && typeof lockMap === 'object' ? lockMap[id] : null;
  if (!row || typeof row !== 'object') return null;
  const n = Number(row.day);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(TOTAL_DAYS, Math.floor(n));
}

/* Three groups, from records that already exist.
 *
 * input:
 *   knownIds   ids the catalog still ships. Anything else is dropped: a record
 *              for a Journey we no longer offer is our data problem, not
 *              something to show somebody as a choice.
 *   activeId   the Journey currently on screen, or null
 *   lockMap    parsed db_journey_lock
 *   doneList   parsed db_journeys_done
 *   openIds    journeyIds from myOpenJourneys, or null when signed out
 *
 * returns { walking, setAside, rooted }, each an array of
 *   { id, day, dayKnown }
 * where `day` is the day reached (1..5) and `dayKnown` is false for a Journey
 * the server knows about but this device has never held. Saying "Day 1" about
 * one of those would be a guess presented as a fact.
 */
export function buildInventory(input) {
  const inp = input || {};
  const known = new Set(Array.isArray(inp.knownIds) ? inp.knownIds : []);
  const lockMap = inp.lockMap && typeof inp.lockMap === 'object' ? inp.lockMap : {};
  const doneList = Array.isArray(inp.doneList) ? inp.doneList : [];
  const openIds = Array.isArray(inp.openIds) ? inp.openIds : [];
  const activeId = typeof inp.activeId === 'string' && inp.activeId ? inp.activeId : null;

  /* Rooted wins over everything. A finished Journey is a finished Journey even
     if a stale lock row or an unreleased server slot still names it. */
  const rootedSet = new Set();
  const rooted = [];
  doneList.forEach(function (id) {
    if (!known.has(id) || rootedSet.has(id)) return;
    rootedSet.add(id);
    rooted.push({ id: id, day: TOTAL_DAYS, dayKnown: true });
  });

  const walking = [];
  if (activeId && known.has(activeId) && !rootedSet.has(activeId)) {
    walking.push({ id: activeId, day: dayOf(lockMap, activeId) || 1, dayKnown: true });
  }

  /* Union of both sources, minus what is rooted and minus the one on screen. */
  const seen = new Set(walking.map(function (x) { return x.id; }));
  const candidates = [];
  Object.keys(lockMap).forEach(function (id) { candidates.push(id); });
  openIds.forEach(function (id) { candidates.push(id); });

  const setAside = [];
  candidates.forEach(function (id) {
    if (typeof id !== 'string' || !known.has(id) || rootedSet.has(id) || seen.has(id)) return;
    seen.add(id);
    const d = dayOf(lockMap, id);
    setAside.push({ id: id, day: d || 1, dayKnown: d !== null });
  });

  /* Furthest along first. That is the one closest to finishing, which is both
     the honest ordering and the one the still-open sheet already argues for:
     "Finishing the one closest to done makes room on its own." Ties break on
     the id so the list does not reshuffle between renders. */
  setAside.sort(function (a, b) {
    if (b.day !== a.day) return b.day - a.day;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  });

  return { walking: walking, setAside: setAside, rooted: rooted };
}

/* Is there anything at all to show? The surface stays hidden for a brand-new
   visitor, because three empty groups are not a front door, they are noise. */
export function inventoryHasAnything(inv) {
  if (!inv) return false;
  return !!((inv.walking && inv.walking.length)
    || (inv.setAside && inv.setAside.length)
    || (inv.rooted && inv.rooted.length));
}
