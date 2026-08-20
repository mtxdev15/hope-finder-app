/* Deterministic verification for the pure Journey locale modules.
 *
 * The repo has no test runner (package.json defines dev, build, preview, astro
 * and nothing else), so this is a plain script with no dependencies. Node 26
 * strips TypeScript natively:
 *
 *   node scripts/verify-journey-locale.ts
 *
 * It exercises only pure functions — no network, no DOM, no storage — so it is
 * fully deterministic. It is NOT a substitute for the browser checks that must
 * run once surfaces are wired.
 */

import {
  adoptLegacyRecord,
  assertWritable,
  isStaleKey,
  localeCacheKey,
  makeDisplayCopy,
  makeOriginalRecord,
  parseLocaleCacheKey,
  sourceHash,
} from "../src/app/declare/journey-locale/locale-cache.ts";
import {
  displayableVersionLabel,
  extractVerses,
  fetchVerse,
  parseReference,
  validateChapterResponse,
} from "../src/app/declare/journey-locale/verified-scripture.ts";
import {
  assertNoUserAuthoredContent,
  createMockTransport,
  translationRequestKey,
  validateTranslation,
  withSingleFlight,
} from "../src/app/declare/journey-locale/translation-transport.ts";
import { LOCALE_SCHEMA_VERSION } from "../src/app/declare/journey-locale/types.ts";
import {
  ENGLISH_CONTENT_SELECTORS,
  resolveReviewViewState,
} from "../src/app/declare/journey-review-state.ts";

import { readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; return; }
  failures.push(name + (detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""));
}
async function rejects(name: string, fn: () => Promise<unknown>, match?: RegExp) {
  try { await fn(); failures.push(name + " — expected a rejection, got none"); }
  catch (e) {
    const msg = String((e as Error).message);
    if (match && !match.test(msg)) failures.push(`${name} — wrong message: ${msg}`);
    else passed++;
  }
}
function throws(name: string, fn: () => unknown, match?: RegExp) {
  try { fn(); failures.push(name + " — expected a throw, got none"); }
  catch (e) {
    const msg = String((e as Error).message);
    if (match && !match.test(msg)) failures.push(`${name} — wrong message: ${msg}`);
    else passed++;
  }
}
const section = (s: string) => console.log("\n" + s);

/* ── 1. Source hashing ─────────────────────────────────────────────────── */
section("1. Source hashing");
check("stable across calls", sourceHash({ title: "A", prayer: "B" }) === sourceHash({ title: "A", prayer: "B" }));
check("key order independent", sourceHash({ title: "A", prayer: "B" }) === sourceHash({ prayer: "B", title: "A" }));
check("content change alters hash", sourceHash({ title: "A" }) !== sourceHash({ title: "B" }));
check("absent equals empty", sourceHash({ title: "A" }) === sourceHash({ title: "A", prayer: "   " }));
check("field identity matters", sourceHash({ title: "X" }) !== sourceHash({ prayer: "X" }));
check("empty is stable", sourceHash({}) === sourceHash({}));

/* ── 2. Cache key identity ─────────────────────────────────────────────── */
section("2. Cache key identity");
const key = localeCacheKey({ instance: "fear", day: 1, sourceLocale: "en", displayLocale: "es", sourceHash: "abc123-7" });
check("shape", key === "db_journey_locale:fear:day1:en:es:abc123-7:v" + LOCALE_SCHEMA_VERSION, key);
const round = parseLocaleCacheKey(key);
check("round-trips", !!round && round.instance === "fear" && round.day === 1 && round.displayLocale === "es", round);
check("foreign key ignored", parseLocaleCacheKey("db_journey_inst:fear") === null);
check("stale on content change", isStaleKey(key, "different-hash") === true);
check("fresh on same content", isStaleKey(key, "abc123-7") === false);
check("locale pair is part of identity",
  localeCacheKey({ instance: "fear", day: 1, sourceLocale: "en", displayLocale: "es", sourceHash: "h" }) !==
  localeCacheKey({ instance: "fear", day: 1, sourceLocale: "en", displayLocale: "en", sourceHash: "h" }));
throws("rejects ':' in instance", () => localeCacheKey({ instance: "a:b", day: 1, sourceLocale: "en", displayLocale: "es", sourceHash: "h" }), /must not contain/);
throws("rejects day 0", () => localeCacheKey({ instance: "a", day: 0, sourceLocale: "en", displayLocale: "es", sourceHash: "h" }), /positive integer/);

/* ── 3. Legacy adoption ────────────────────────────────────────────────── */
section("3. Legacy adoption");
const noLang = adoptLegacyRecord({ plan: [] });
check("no lang -> english", noLang.sourceLocale === "en", noLang);
check("no lang -> legacy-adopted", noLang.localeStatus === "legacy-adopted", noLang);
check("no lang -> marked inferred", noLang.inferred === true);
check("lang es -> authored es", adoptLegacyRecord({ lang: "es" }).localeStatus === "authored");
check("lang es not inferred", adoptLegacyRecord({ lang: "es" }).inferred === false);
check("null record -> english legacy", adoptLegacyRecord(null).localeStatus === "legacy-adopted");
check("never silently claims spanish", adoptLegacyRecord({ plan: [] }).sourceLocale !== "es");

/* ── 4. Immutability of the English original ───────────────────────────── */
section("4. Immutability");
const original = makeOriginalRecord({ instance: "fear", day: 1, locale: "en", fields: { title: "Name the fear" } });
check("original is immutable", original.immutable === true);
check("original is authored", original.localeStatus === "authored");
throws("refuses to overwrite original", () => assertWritable(original, "k"), /immutable original/);
const copy = makeDisplayCopy({
  instance: "fear", day: 1, sourceLocale: "en", displayLocale: "es",
  sourceHash: original.sourceHash, fields: { title: "Nombra el temor" },
  translation: { translatedAt: 0, model: "m", transportVersion: "v" },
});
check("display copy is mutable", copy.immutable === false);
check("display copy is translated", copy.localeStatus === "translated");
check("display copy carries source hash", copy.sourceHash === original.sourceHash);
check("display copy may be rewritten", (() => { try { assertWritable(copy, "k"); return true; } catch { return false; } })());

/* ── 5. Reference parsing ──────────────────────────────────────────────── */
section("5. Reference parsing");
const psalm = parseReference("Psalm 56:3");
check("alias Psalm -> Psalms", "book" in psalm && psalm.book === "Psalms", psalm);
check("usfm PSA", "usfm" in psalm && psalm.usfm === "PSA", psalm);
check("chapter/verse", "chapter" in psalm && psalm.chapter === 56 && psalm.verse === 3, psalm);
const range = parseReference("1 Corinthians 13:4-7");
check("multiword book", "usfm" in range && range.usfm === "1CO", range);
check("range end", "verseEnd" in range && range.verseEnd === 7, range);
check("Song of Songs alias", (() => { const r = parseReference("Song of Songs 2:1"); return "book" in r && r.book === "Song of Solomon"; })());
check("Revelations alias", (() => { const r = parseReference("Revelations 21:4"); return "book" in r && r.usfm === "REV"; })());
check("unknown book fails", (() => { const r = parseReference("Hesitations 3:1"); return "ok" in r && r.ok === false && r.reason === "unknown-book"; })());
check("garbage fails", (() => { const r = parseReference("not a reference"); return "ok" in r && r.reason === "unparseable-reference"; })());
check("inverted range fails", (() => { const r = parseReference("Psalm 56:9-3"); return "ok" in r && r.reason === "verse-out-of-range"; })());

/* ── 6. Chapter validation — the mislabelling defence ──────────────────── */
section("6. Chapter validation");
const realShape = { reference: "Salmos 56", translation: "RVR1909", book: "PSA", chapter: 56,
  verses: [{ n: 1, t: "TEN misericordia" }, { n: 3, t: "En el día que temo, Yo en ti confío." }] };
const validated = validateChapterResponse(realShape, "RVR1909");
check("accepts the verified live shape", "ok" in validated && validated.ok === true, validated);
check("case-insensitive translation match", (() => { const v = validateChapterResponse(realShape, "rvr1909"); return "ok" in v && v.ok === true; })());
check("REJECTS translation mismatch", (() => {
  const v = validateChapterResponse({ ...realShape, translation: "ESV" }, "RVR1909");
  return "reason" in v && v.reason === "translation-mismatch";
})());
check("rejects missing verses", (() => { const v = validateChapterResponse({ translation: "RVR1909" }, "RVR1909"); return "reason" in v && v.reason === "bad-response-shape"; })());
check("rejects non-object", (() => { const v = validateChapterResponse(null, "RVR1909"); return "reason" in v && v.reason === "bad-response-shape"; })());

/* ── 7. Extraction and the label guard ─────────────────────────────────── */
section("7. Extraction and labelling");
const chapterOk = validateChapterResponse(realShape, "RVR1909") as Extract<ReturnType<typeof validateChapterResponse>, { ok: true }>;
const verse = extractVerses(chapterOk, parseReference("Psalm 56:3") as never, 1234);
check("extracts the right verse", verse.ok === true && verse.text === "En el día que temo, Yo en ti confío.", verse);
check("label comes FROM THE SOURCE", verse.ok === true && verse.versionLabel === "RVR1909");
check("provenance records source id", verse.ok === true && verse.provenance.translationId === "RVR1909");
check("keeps the source reference", verse.ok === true && verse.sourceReference === "Salmos 56");
check("out-of-range withheld", (() => {
  const r = extractVerses(chapterOk, parseReference("Psalm 56:99") as never, 0);
  return r.ok === false && r.reason === "verse-out-of-range";
})());
check("NO LABEL without a verse", displayableVersionLabel({ ok: false, reason: "network" }) === null);
check("label allowed with provenance", displayableVersionLabel(verse) === "RVR1909");

/* ── 8. fetchVerse orchestration, offline ──────────────────────────────── */
section("8. fetchVerse orchestration");
const okFetch = async () => realShape;
const v1 = await fetchVerse({ reference: "Psalm 56:3", translation: "rvr1909", expectedTranslationLabel: "RVR1909", fetchChapter: okFetch, now: () => 7 });
check("happy path", v1.ok === true && v1.provenance.fetchedAt === 7, v1);
const v2 = await fetchVerse({ reference: "Psalm 56:3", translation: "rvr1909", expectedTranslationLabel: "RVR1909", fetchChapter: async () => { throw new Error("offline"); } });
check("network failure withholds", v2.ok === false && v2.reason === "network", v2);
const v3 = await fetchVerse({ reference: "Psalm 56:3", translation: "rvr1909", expectedTranslationLabel: "RVR1909", fetchChapter: async () => ({ ...realShape, translation: "ESV" }) });
check("English source can never be labelled RVR1909", v3.ok === false && v3.reason === "translation-mismatch", v3);

/* ── 9. Translation privacy guard ──────────────────────────────────────── */
section("9. Translation privacy");
const goodReq = { instance: "fear", day: 1, sourceLocale: "en" as const, displayLocale: "es" as const,
  sourceHash: "h", schemaVersion: LOCALE_SCHEMA_VERSION, fields: { title: "Name the fear" } };
check("clean request passes", (() => { try { assertNoUserAuthoredContent(goodReq); return true; } catch { return false; } })());
throws("rejects reflection", () => assertNoUserAuthoredContent({ ...goodReq, reflection: "mine" }), /reflection/);
throws("rejects userId", () => assertNoUserAuthoredContent({ ...goodReq, userId: "u" }), /userId/);
throws("rejects verse text", () => assertNoUserAuthoredContent({ ...goodReq, verseText: "..." }), /verseText/);
throws("rejects vault content", () => assertNoUserAuthoredContent({ ...goodReq, vault: [] }), /vault/);
throws("rejects crisis disclosure", () => assertNoUserAuthoredContent({ ...goodReq, crisis: "..." }), /crisis/);
throws("rejects unknown field", () => assertNoUserAuthoredContent({ ...goodReq, fields: { userNote: "x" } }), /not translatable/);

/* ── 10. Mock transport and single-flight ──────────────────────────────── */
section("10. Transport and single-flight");
const reqKey = translationRequestKey(goodReq);
const mock = createMockTransport({ fixtures: { [reqKey]: { title: "Nombra el temor" } }, now: () => 99 });
const r1 = await mock.translate(goodReq);
check("mock returns fixture", r1.ok === true && r1.translation.fields.title === "Nombra el temor", r1);
check("mock stamps provenance", r1.ok === true && r1.translation.provenance.translatedAt === 99);
check("dedup key equals cache key", reqKey === localeCacheKey({ ...goodReq }));

const single = withSingleFlight(createMockTransport({ fixtures: { [reqKey]: { title: "Nombra el temor" } } }));
const [a, b] = await Promise.all([single.translate(goodReq), single.translate(goodReq)]);
check("both callers get a result", a.ok === true && b.ok === true);
check("in-flight map drains", single.inFlightCount() === 0);

let callCount = 0;
const counted = withSingleFlight(createMockTransport({ fixtures: { [reqKey]: { title: "x" } }, onCall: () => { callCount++; } }));
await Promise.all([counted.translate(goodReq), counted.translate(goodReq), counted.translate(goodReq)]);
check("THREE taps produce ONE call", callCount === 1, callCount);

const failing = createMockTransport({ failWith: { ok: false, reason: "rate-limited", retryable: true } });
const rl = await failing.translate(goodReq);
check("failure is retryable-flagged", rl.ok === false && rl.retryable === true);
const empty = await createMockTransport().translate({ ...goodReq, fields: {} });
check("empty request spends nothing", empty.ok === false && empty.reason === "empty-request");
// The guard runs inside an async method, so it surfaces as a rejected promise
// rather than a synchronous throw. Either way the request never reaches a model.
await rejects("mock enforces privacy too", () => createMockTransport().translate({ ...goodReq, reflection: "x" } as never), /reflection/);

/* ── 11. Response validation ───────────────────────────────────────────── */
section("11. Response validation");
const goodT = { sourceLocale: "en", displayLocale: "es", sourceHash: "h", schemaVersion: LOCALE_SCHEMA_VERSION,
  fields: { title: "T" }, provenance: { translatedAt: 0, model: "m", transportVersion: "v" } };
check("accepts a good response", "fields" in (validateTranslation(goodT, goodReq) as object));
check("rejects hash mismatch", (() => { const r = validateTranslation({ ...goodT, sourceHash: "other" }, goodReq); return "reason" in r; })());
check("rejects schema mismatch", (() => { const r = validateTranslation({ ...goodT, schemaVersion: 99 }, goodReq); return "reason" in r; })());
check("rejects smuggled field", (() => { const r = validateTranslation({ ...goodT, fields: { title: "T", reflection: "x" } }, goodReq); return "reason" in r; })());
check("rejects wrong locale pair", (() => { const r = validateTranslation({ ...goodT, displayLocale: "fr" }, goodReq); return "reason" in r; })());

/* ── 12. Review view state ─────────────────────────────────────────────────
 * The rule this section defends: whenever the interface is Spanish and the
 * content on screen is the immutable English original, the review must say so.
 * Derived from the content relationship, never from authentication, so the
 * signed-out path and the signed-in "view the original" path cannot diverge. */
section("12. Review view state");

const esOriginal = resolveReviewViewState({ interfaceLocale: "es", translationShown: false, reviewing: true });
check("es chrome + English original => original-english", esOriginal.provenanceKind === "original-english", esOriginal.provenanceKind);
check("es chrome + English original => contentLocale en", esOriginal.contentLocale === "en");
check("es chrome + English original => origin original", esOriginal.contentOrigin === "original");
check("es chrome + English original => read only", esOriginal.readOnly === true);

const esTranslated = resolveReviewViewState({ interfaceLocale: "es", translationShown: true, reviewing: true });
check("es chrome + Spanish copy => translated-spanish", esTranslated.provenanceKind === "translated-spanish", esTranslated.provenanceKind);
check("Spanish copy is never called original", esTranslated.contentOrigin === "translation");

const enReview = resolveReviewViewState({ interfaceLocale: "en", translationShown: false, reviewing: true });
check("English chrome + English original => no provenance", enReview.provenanceKind === "none", enReview.provenanceKind);

const live = resolveReviewViewState({ interfaceLocale: "es", translationShown: false, reviewing: false });
check("the live day is not a review", live.provenanceKind === "none" && live.readOnly === false);

// The whole point of the fix: the state cannot be a function of who is signed in.
check("state has no authentication input", !("signedIn" in (esOriginal as object)) && !("isGuest" in (esOriginal as object)));

/* Content vs chrome. A selector that reached into interface text would mark
 * Spanish words as English; one that reached into the reflection would claim a
 * language for words the reader wrote. Both are guarded here. */
const CHROME_SELECTORS = [".lab", ".df-sh", ".intro", ".lie-q", ".mic-hint", ".cast-done", ".act-check"];
for (const sel of CHROME_SELECTORS) {
  check("lang=en never marks chrome " + sel, !ENGLISH_CONTENT_SELECTORS.includes(sel));
}
const USER_AUTHORED_SELECTORS = ["#reflectText", ".reflect-review", "#reflectReviewBox"];
for (const sel of USER_AUTHORED_SELECTORS) {
  check("lang=en never marks user text " + sel, !ENGLISH_CONTENT_SELECTORS.includes(sel));
}
check("the authored PROMPT is marked, the answer is not",
  ENGLISH_CONTENT_SELECTORS.includes("#reflectPrompt") && !ENGLISH_CONTENT_SELECTORS.includes("#reflectText"));
check("Scripture reference and quotation are marked",
  ENGLISH_CONTENT_SELECTORS.includes(".verse") && ENGLISH_CONTENT_SELECTORS.includes(".vref-link"));

/* Copy contract. Every user-facing string this surface renders must resolve
 * from the canonical catalog, not from a module constant and not from a literal
 * in the view. The runtime-registration shim that used to inject them is gone,
 * so the catalog is now the only source. */
const CATALOG = readFileSync(
  new URL("../public/declare/i18n-strings.js", import.meta.url), "utf8");

/* EVALUATE the catalog, do not text-match it. A key can appear in the file and
 * still not exist at runtime — an unterminated block comment above the block
 * swallowed sixteen of these once, and a substring check passed the whole time
 * because the text was right there in the file. Parsing is the only check that
 * knows the difference between present and reachable. */
const CATALOG_ES: Record<string, string> = (() => {
  const w: { __I18N_STRINGS?: { es?: Record<string, string> } } = {};
  new Function("window", CATALOG)(w);
  return (w.__I18N_STRINGS && w.__I18N_STRINGS.es) || {};
})();
const VIEW = readFileSync(new URL("../src/pages/journey.astro", import.meta.url), "utf8");

const REVIEW_KEYS = [
  "journey.review.originalEnglishBanner",
  "journey.review.originalEnglishSupport",
  "journey.review.genericBanner",
  "journey.review.translatedBanner",
  "journey.review.viewOriginalEnglish",
  "journey.review.preparingButton",
  "journey.review.preparingBody",
  "journey.review.guestTitle",
  "journey.review.guestBody",
  "journey.review.failTitle",
  "journey.review.failBody",
  "journey.review.scriptureFailTitle",
  "journey.review.scriptureFailBody",
  "journey.review.continueInEnglish",
  "journey.review.signInForSpanish",
  "journey.review.tryAgain",
  "journey.review.returnToToday",
  "journey.review.signInPrompt",
];
for (const k of REVIEW_KEYS) {
  check("catalog RESOLVES " + k, typeof CATALOG_ES[k] === "string" && CATALOG_ES[k].length > 0);
  check("view reads " + k, VIEW.includes("'" + k + "'"));
}
check("no duplicate review keys in the catalog", (() => {
  const found = CATALOG.match(/'journey\.review\.[A-Za-z]+'/g) || [];
  return new Set(found).size === found.length;
})());

/* The approved es-LA wording, verbatim. These are the exact strings a native
 * reviewer signed off on; a silent edit to any of them is a copy change that
 * never went through review. */
const APPROVED: Array<[string, string]> = [
  ["journey.review.originalEnglishBanner", "Contenido original en inglés · Solo lectura"],
  ["journey.review.originalEnglishSupport", "Este día se completó originalmente en inglés."],
  ["journey.review.translatedBanner", "Traducción al español del contenido original en inglés · Solo lectura"],
  ["journey.review.preparingButton", "Preparando tu camino de hoy…"],
  ["journey.review.preparingBody", "Estamos preparando el camino de hoy con cuidado."],
  ["journey.review.continueInEnglish", "Continuar en inglés"],
  ["journey.review.signInForSpanish", "Iniciar sesión para verlo en español"],
  ["journey.review.tryAgain", "Intentar de nuevo"],
  ["journey.review.returnToToday", "Volver al camino de hoy"],
  ["journey.review.viewOriginalEnglish", "Ver el original en inglés"],
];
for (const [k, v] of APPROVED) {
  check("approved wording intact: " + k, CATALOG_ES[k] === v);
}

/* Copy that passed review but was deliberately NOT built. Approval is not
 * implementation; these must stay out until their UI actually exists. */
for (const s of ["Tus palabras · Sin traducir", "Volver más tarde"]) {
  check("approved-but-unbuilt stays out: " + s, !CATALOG.includes(s) && !VIEW.includes(s));
}

/* The promotion must not re-enable other surfaces. */
check("Day-Opening keeps its own development guard", VIEW.includes("ES_DAY_OPENING_DEV"));
check("the broad review flag is gone", !VIEW.includes("ES_REVIEW_ON"));
check("the runtime catalog shim is gone", !VIEW.includes("__I18N_STRINGS"));

/* ── Summary ───────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
