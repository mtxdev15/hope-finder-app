/* Declare & Believe — what "return to where you left off" actually means.
 *
 * WHY THIS FILE EXISTS AT ALL
 *
 * Until 2026-08-27 there was exactly one way back into a Journey, and it was
 * beginJourney(): new seed, clearLock(), clearInstance(), Day 1. Two surfaces
 * offered a return path in words and routed through it anyway. The reset sheet
 * said "your progress is kept, and you can return to it whenever you're ready."
 * The limit sheet put it on a button labelled "Continue this one". Both deleted
 * the progress they were offering.
 *
 * The rules that tell resuming apart from starting are small, and they are the
 * part that must never be wrong again, so they live here rather than inline in
 * src/pages/journey.astro. A rule in a page's <script> can only be checked by
 * reading it. A rule in a module can be RUN, which is what
 * scripts/verify-journey-resume.ts does.
 *
 * PURE ON PURPOSE. No DOM, no localStorage, no network, no imports — not even
 * a relative one. journey.astro owns the storage and the rendering and passes
 * in what it read. Same shape as guidance-quota.js, and for the same reason.
 */

/* The day a Journey can be returned to, or 0 when there is nothing to return
 * to. `lockMap` is the parsed db_journey_lock object, `doneList` the parsed
 * db_journeys_done array. Both may be missing or malformed; a reader whose
 * storage is unreadable gets 0, which routes them to a clean start rather than
 * into a guess.
 *
 * DAY 1 DOES NOT COUNT. A Journey opened and never walked has nothing to
 * preserve, so resuming it and starting it are the same act — and starting is
 * the one that earns the Preview.
 *
 * A ROOTED JOURNEY DOES NOT COUNT EITHER. Walking it again is a fresh planting,
 * which is already what the still-open sheet tells people in as many words:
 * "Starting it again later begins it fresh, at day one." */
export function resumableDay(id, lockMap, doneList) {
  if (!id) return 0;
  if (Array.isArray(doneList) && doneList.indexOf(id) >= 0) return 0;
  const row = lockMap && typeof lockMap === 'object' ? lockMap[id] : null;
  if (!row || typeof row !== 'object') return 0;
  const day = Number(row.day);
  if (!Number.isFinite(day)) return 0;
  const n = Math.floor(day);
  return n > 1 ? n : 0;
}

/* Which way a pick should go: back into a Journey, or into the Preview that
 * fronts a new one.
 *
 * `reclaim` rides along because the two are one decision, not two. A Journey
 * with a walked day that the reader is not currently standing in was either set
 * aside or left on another device, so its slot may well have been released.
 * Taking it back is a fresh claim the cap is entitled to refuse, and saying so
 * here keeps the caller from having to work it out. */
export function resumeDecision(id, lockMap, doneList) {
  const day = resumableDay(id, lockMap, doneList);
  if (day > 1) return { action: 'resume', day: day, reclaim: true };
  return { action: 'preview', day: 0, reclaim: false };
}

/* The db_journey_lock row written for a Journey being LEFT, so that leaving it
 * is not the same as losing it.
 *
 * THE PACING DATE IS CARRIED ACROSS, NEVER RESTAMPED. Walking away from a
 * Journey is not walking a day of it. Restamping would tell the reader tomorrow
 * that they had already had today, and the one-day-per-day lock is the whole
 * shape of the product.
 *
 * A Journey left before any day was completed has no row at all, which is
 * precisely why one is written here: without it there is nothing to resume by,
 * and setLock() only ever runs on the far side of a completed day. */
export function parkRecord(prevRow, day, returned) {
  const prev = prevRow && typeof prevRow === 'object' ? prevRow : {};
  const d = Number(day);
  const r = Number(returned);
  return {
    date: prev.date || null,
    time: prev.time || null,
    day: Number.isFinite(d) && d >= 1 ? Math.floor(d) : 1,
    returned: Number.isFinite(r) && r >= 0 ? Math.floor(r) : 0,
  };
}

/* FAILS OPEN, and that is the point.
 *
 * A null answer means a signed-out reader or a backend we could not reach.
 * Journey progress is local and is the reader's own work; neither of those is a
 * reason to lock somebody out of a Journey they already walked. Only a stated
 * refusal, naming the cap, stops anything. */
export function isSlotRefusal(verdict) {
  return !!(verdict && verdict.ok === false && verdict.reason === 'active-journey-limit');
}
