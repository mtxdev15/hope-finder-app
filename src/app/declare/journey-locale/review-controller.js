/* Declare & Believe — completed-day review, Spanish display copy.
 *
 * This module owns the whole Spanish path for reviewing a COMPLETED day, so
 * journey.astro coordinates a view and never owns a translation system. It is
 * the only place that knows about the locale cache, the transport, Scripture
 * retrieval, provenance assembly and stale-request handling.
 *
 * WHAT IT WILL NEVER DO
 *   - regenerate a completed day (it translates the record that exists)
 *   - modify the English original (that record is never written here)
 *   - send a reflection or a user-written prayer anywhere
 *   - render a verse, or a version label, without fetch provenance
 *   - fall back to English content on failure
 *
 * Returns states, never throws: "no verified Spanish available yet" is a normal
 * product state with its own screen, not an exception.
 */

import { LOCALE_SCHEMA_VERSION } from './types.ts';
import { localeCacheKey, makeDisplayCopy, sourceHash } from './locale-cache.ts';
import { fetchVerse } from './verified-scripture.ts';
import { pickTranslatable } from './payload.ts';
import { journeyTranslate } from '../convex-data.js';
import { isSignedIn } from '../auth-store.js';

/* Scripture is fetched browser -> Worker directly (NOT through Convex), so it
 * needs its own base URL or development silently reads production's /bible,
 * spending production API.Bible quota and warming its KV cache. Defaults to
 * production, so nothing changes unless PUBLIC_WORKER_URL is set. */
const WORKER = (import.meta.env.PUBLIC_WORKER_URL || 'https://hope-finder-worker.thinktoro.workers.dev').replace(/\/+$/, '');



/* ── Locale cache (browser) ───────────────────────────────────────────────── */

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function writeCache(key, record) {
  try { localStorage.setItem(key, JSON.stringify(record)); } catch (e) { /* quota — degrade to a re-fetch */ }
}

/* ── Scripture ────────────────────────────────────────────────────────────── */

async function chapterFetcher({ translation, usfm, chapter }) {
  const url = WORKER + '/bible?translation=' + encodeURIComponent(translation) +
    '&book=' + encodeURIComponent(usfm) + '&chapter=' + encodeURIComponent(chapter);
  const res = await fetch(url);
  if (!res.ok) throw new Error('chapter-' + res.status);
  return res.json();
}

/* ── Eligibility ──────────────────────────────────────────────────────────── */

/* Signed-out readers keep full access to the original English day and are never
 * silently translated. That is a product decision, enforced here rather than in
 * the view so it cannot be forgotten at a call site. */
export function reviewEligibility(locale) {
  if (locale !== 'es') return { mode: 'english' };
  if (!isSignedIn()) return { mode: 'guest-notice' };
  return { mode: 'translate' };
}

/* ── Stale-request handling ───────────────────────────────────────────────────
 * A reader can page between days faster than a translation resolves. Each call
 * takes a token; a result whose token is no longer current is discarded rather
 * than painted over whatever they are now looking at. */
let currentToken = 0;
export function beginRequest() { return ++currentToken; }
export function isCurrent(token) { return token === currentToken; }
export function cancelPending() { currentToken++; }

/* ── The one entry point ──────────────────────────────────────────────────────
 * Returns exactly one of:
 *   { state: 'english' }                       render the original, unchanged
 *   { state: 'guest-notice' }                  original + Spanish sign-in notice
 *   { state: 'ready', fields, scripture, provenance }
 *   { state: 'error', reason, retryable }
 *
 * `scripture` is null when the reference could not be verified. The view must
 * then render no quotation and no version label — never a fallback. */
export async function getReviewContent({ instance, day, english, locale, token }) {
  const eligibility = reviewEligibility(locale);
  if (eligibility.mode !== 'translate') return { state: eligibility.mode };

  const source = pickTranslatable(english);
  if (!Object.keys(source).length) return { state: 'error', reason: 'nothing-to-translate', retryable: false };

  const hash = sourceHash(source);
  const key = localeCacheKey({
    instance, day, sourceLocale: 'en', displayLocale: 'es',
    sourceHash: hash, schemaVersion: LOCALE_SCHEMA_VERSION,
  });

  // 1. Browser cache. Keyed by content hash and schema version, so a stale copy
  //    cannot be served after the English changed or the contract moved.
  let record = readCache(key);

  // 2. Server. The action handles its own dedup, quota and caching; a second
  //    device reuses the account-level result without another model call.
  if (!record) {
    let res = null;
    try { res = await journeyTranslate(source); } catch (e) { res = null; }
    if (!isCurrent(token)) return { state: 'stale' };
    if (!res || res.ok !== true) {
      const reason = (res && res.reason) || 'translation-unavailable';
      const retryable = res ? res.retryable !== false : true;
      return { state: 'error', reason, retryable };
    }
    record = makeDisplayCopy({
      instance, day, sourceLocale: 'en', displayLocale: 'es',
      sourceHash: hash, fields: res.fields, translation: res.provenance,
    });
    writeCache(key, record);
  }

  // 3. Scripture, always separate. The reference is preserved from the English
  //    original and the Spanish text is fetched — never translated.
  let scripture = null;
  if (english && english.ref) {
    const verse = await fetchVerse({
      reference: english.ref,
      translation: 'rvr1909',
      expectedTranslationLabel: 'RVR1909',
      fetchChapter: chapterFetcher,
    });
    if (!isCurrent(token)) return { state: 'stale' };
    if (verse.ok) {
      /* Display reference in Spanish, built from the book name the SOURCE
         reported ("Salmos 56") plus the verse we asked for — never translated
         and never invented locally. Showing "PSALM 56:3 · RVR1909" put an
         English book name beside a Spanish translation label, which reads as a
         mismatch to the one reader it is for. Falls back to the English
         reference if the source did not supply one. */
      const r = verse.ref;
      const tail = ':' + r.verse + (r.verseEnd ? '-' + r.verseEnd : '');
      const refDisplay = verse.sourceReference ? verse.sourceReference + tail : english.ref;
      scripture = { text: verse.text, versionLabel: verse.versionLabel, provenance: verse.provenance,
                    ref: english.ref, refDisplay: refDisplay };
    } else {
      // Withheld, not faked. The view shows the Spanish Scripture-retry state.
      return { state: 'error', reason: 'scripture-unverified', retryable: true, prose: record.fields };
    }
  }

  return {
    state: 'ready',
    fields: record.fields,
    scripture,
    provenance: { translation: record.translation, scripture: scripture ? scripture.provenance : null },
  };
}
