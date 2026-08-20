/* Declare & Believe — the Fruit Log in Spanish.
 *
 * The Fruit Log lists one entry per COMPLETED day, and each entry shows two
 * authored fields: the fruit name and its one-line truth. Both are already part
 * of the translation contract, so nothing new is sent and nothing new is stored.
 * What is new is the SHAPE of the problem.
 *
 * WHY THIS IS NOT THE COMPLETED-DAY REVIEW AGAIN
 * The review showed one day. It could resolve one translation and paint once.
 * The Fruit Log shows N days and the locale cache is keyed per day, so a reader
 * who reviewed days 1 and 3 has two translations and three gaps. Painting that
 * naively produces a half-Spanish list, which is exactly the unlabelled-English-
 * under-Spanish-chrome case the whole locale effort exists to prevent.
 *
 * So this module is an ALL-OR-NOTHING gate. It reports ready only when every
 * completed day has verified Spanish; until then the view shows the original
 * English, labelled. There is no partial success state to render, on purpose.
 *
 * WHY NOTHING HAPPENS ON LOAD
 * Preparing a five-day Fruit Log is the most expensive thing this app does. A
 * reader who scrolls past the section must not pay for it. Preparation is
 * therefore started only by an explicit action, never by rendering.
 *
 * WHAT IT WILL NEVER DO
 *   - mutate PLAN[] or any day record (the merge happens at the render site)
 *   - translate a day that already has a valid cached copy
 *   - send anything but the approved authored fields
 *   - run more than one translation at a time
 *   - reveal a partially translated list
 *   - fall back to unlabelled English
 *
 * Returns states, never throws.
 */

import { LOCALE_SCHEMA_VERSION } from './types.ts';
import { localeCacheKey, makeDisplayCopy, sourceHash } from './locale-cache.ts';
import { pickTranslatable } from './payload.ts';
import { fruitRow, inventory, sourceLocale, sourceState, isRowTranslatable } from './fruit-log-merge.ts';
import { journeyTranslate } from '../convex-data.js';
import { isSignedIn } from '../auth-store.js';

/* ── Locale cache (browser) ───────────────────────────────────────────────────
 * Same identity the completed-day review uses — instance, day, locale pair,
 * source-content hash and schema version. That shared key is what makes the two
 * surfaces reuse each other's work: a day prepared by the review is free here,
 * and a day prepared here is free when the reader opens that day's review. */

function cacheKeyFor(instance, day, english) {
  const source = pickTranslatable(english);
  if (!Object.keys(source).length) return null;
  return {
    key: localeCacheKey({
      instance, day, sourceLocale: 'en', displayLocale: 'es',
      sourceHash: sourceHash(source), schemaVersion: LOCALE_SCHEMA_VERSION,
    }),
    source,
    hash: sourceHash(source),
  };
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function writeCache(key, record) {
  try { localStorage.setItem(key, JSON.stringify(record)); } catch (e) { /* quota — degrade to a re-fetch */ }
}

/* ── Eligibility ──────────────────────────────────────────────────────────────
 * Identical rule to the review, and deliberately so: a signed-out reader keeps
 * full access to the original English Fruit Log and is never silently
 * translated, never served a cached copy prepared under an account, and never
 * given an anonymous translation route. */
export function fruitLogEligibility(locale) {
  if (locale !== 'es') return { mode: 'english' };
  if (!isSignedIn()) return { mode: 'guest-notice' };
  return { mode: 'translate' };
}

/* ── Inventory and display merge ──────────────────────────────────────────
 * Both live in fruit-log-merge.ts so the harness can exercise them in plain
 * Node, and are re-exported here so the view has one import. */
export { fruitRow, inventory, sourceLocale, sourceState, isRowTranslatable };

/* Which of those already have verified Spanish, and which are missing. A day
 * whose source content changed, or whose schema version moved, simply misses:
 * its old key no longer matches, so a stale copy cannot be served. */
export function inspectCache({ instance, plan, completedCount }) {
  const ready = [], missing = [], alreadySpanish = [], unresolved = [], translations = {};
  for (const item of inventory({ plan, completedCount })) {
    /* Neither of the next two is translatable English-to-Spanish, but they are
       not the same thing and must not be counted together.

       A day whose canonical source is ALREADY Spanish needs no translation: it
       is on screen in Spanish right now, at no cost. It counts TOWARD a fully
       Spanish list.

       A mixed-legacy day has no single source language, so nothing can make it
       coherently Spanish. It counts AGAINST one, permanently. */
    const src = sourceLocale(item.english);
    if (src === 'es') { alreadySpanish.push(item.day); continue; }
    if (src === 'mixed-legacy') { unresolved.push(item.day); continue; }
    const id = cacheKeyFor(instance, item.day, item.english);
    if (!id) { missing.push(item.day); continue; }
    const rec = readCache(id.key);
    if (rec && rec.fields) { ready.push(item.day); translations[item.day] = rec.fields; }
    else missing.push(item.day);
  }
  const total = ready.length + missing.length + alreadySpanish.length + unresolved.length;
  /* THE question this surface asks: would every completed row read as Spanish?
     Not "did we translate everything" — a natively Spanish day already reads as
     Spanish and was never ours to translate. An empty list is not ready either;
     `!missing.length` alone was true of a list with nothing in it. */
  const spanishReady = total > 0 && !missing.length && !unresolved.length;
  return { ready, missing, alreadySpanish, unresolved,
           /* Kept as the union both callers used before the split. */
           untranslatable: alreadySpanish.concat(unresolved),
           translations, spanishReady, total };
}

/* ── Stale-request handling ───────────────────────────────────────────────────
 * A reader can leave the page, switch language, or complete another day while a
 * multi-day preparation is running. Each run takes a token; a run whose token is
 * no longer current stops at the next day boundary and reports `stale` rather
 * than painting over whatever they are now looking at. */
let currentToken = 0;
export function beginRequest() { return ++currentToken; }
export function isCurrent(token) { return token === currentToken; }
export function cancelPending() { currentToken++; }

/* ── Preparation ──────────────────────────────────────────────────────────────
 * Sequential on purpose. The transport already enforces one active translation
 * per account, so firing five at once would simply produce four joiners waiting
 * on a leader; doing it one at a time keeps the progress count honest and the
 * account's quota legible.
 *
 * Returns exactly one of:
 *   { state: 'ready', translations }        every completed day reads as Spanish
 *   { state: 'unresolved', unresolved }     a mixed-legacy day makes it impossible
 *   { state: 'error', reason, retryable, missing }
 *   { state: 'stale' }                      superseded; the view discards it
 *   { state: 'guest-notice' } / { state: 'english' }
 *
 * `translations` is a plain map of day -> translated fields. It is data for the
 * view to merge at render time; this module never touches the day records. */
export async function prepare({ instance, plan, completedCount, locale, token, onProgress }) {
  const eligibility = fruitLogEligibility(locale);
  if (eligibility.mode !== 'translate') return { state: eligibility.mode };

  const scan = inspectCache({ instance, plan, completedCount });
  if (!scan.total) return { state: 'error', reason: 'nothing-to-translate', retryable: false, missing: [] };

  /* One mixed-legacy day is enough to make the whole list unresolvable. Spending
     requests on the others would buy a list that still cannot be shown, so this
     returns before any translation is attempted. Not an error: nothing failed,
     and the honest per-row English list is a legitimate resting state. */
  if (scan.unresolved.length) return { state: 'unresolved', unresolved: scan.unresolved };

  // Already complete: nothing to do, nothing to spend.
  if (!scan.missing.length) return { state: 'ready', translations: scan.translations };

  const translations = Object.assign({}, scan.translations);
  const stillMissing = [];
  let done = scan.ready.length;

  for (const day of scan.missing) {
    if (!isCurrent(token)) return { state: 'stale' };
    if (typeof onProgress === 'function') {
      try { onProgress({ completed: done, total: scan.total, day }); } catch (e) {}
    }

    const english = plan[day - 1];
    const id = cacheKeyFor(instance, day, english);
    if (!id) { stillMissing.push(day); continue; }

    /* Re-read immediately before requesting. Another surface — the completed-day
       review, most likely — may have prepared this exact day while this run was
       working through earlier ones, and paying for it twice would be a waste the
       reader can see in their quota. */
    const late = readCache(id.key);
    if (late && late.fields) { translations[day] = late.fields; done++; continue; }

    let res = null;
    try { res = await journeyTranslate(id.source); } catch (e) { res = null; }
    if (!isCurrent(token)) return { state: 'stale' };

    if (!res || res.ok !== true) { stillMissing.push(day); continue; }

    const record = makeDisplayCopy({
      instance, day, sourceLocale: 'en', displayLocale: 'es',
      sourceHash: id.hash, fields: res.fields, translation: res.provenance,
    });
    writeCache(id.key, record);
    translations[day] = record.fields;
    done++;
  }

  if (stillMissing.length) {
    /* Successful days stay cached — they are paid for and valid, and a retry
       must not buy them again. But the list stays English until every day is
       ready, because a half-Spanish Fruit Log is the thing we are preventing. */
    return { state: 'error', reason: 'preparation-incomplete', retryable: true, missing: stillMissing };
  }

  if (typeof onProgress === 'function') {
    try { onProgress({ completed: scan.total, total: scan.total, day: null }); } catch (e) {}
  }
  return { state: 'ready', translations };
}
