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
const MERGE_SRC = readFileSync(new URL(
  "../src/app/declare/journey-locale/fruit-log-merge.ts", import.meta.url), "utf8");
const FL_CONTROLLER = readFileSync(new URL(
  "../src/app/declare/journey-locale/fruit-log-controller.js", import.meta.url), "utf8");

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
/* The runtime shim existed only to hold copy that had not passed native review.
 * Both sets are now reviewed and shipped in the catalog, so there is nothing
 * left for it to carry. A shim reappearing means unreviewed Spanish is being
 * injected past the catalog, where the bundle audit cannot see it. */
check("no runtime registration of ANY Spanish copy",
  (VIEW.match(/__I18N_STRINGS\.es\s*=/g) || []).length === 0);
check("the dev-only copy exports are gone from the merge module",
  !MERGE_SRC.includes("FRUIT_LOG_COPY_ES") && !MERGE_SRC.includes("FRUIT_LOG_COPY_EN"));

/* ── 13. Fruit Log ─────────────────────────────────────────────────────────
 * Two properties matter more than the rest of this surface combined: the day
 * record must never be mutated, and the four out-of-scope consumers of `fruit`
 * and `fruitTruth` must keep reading English. */
section("13. Fruit Log");

const { fruitRow, inventory } = await import(
  "../src/app/declare/journey-locale/fruit-log-merge.ts");

const DAY = Object.freeze({
  title: "Lay It Down", fruit: "Untensed Trust",
  fruitTruth: "Peace grows where control is released.", insight: "…",
});
const ES = { fruit: "Confianza destensada", fruitTruth: "La paz crece donde se suelta el control." };

const row = fruitRow(DAY, ES);
check("translated row shows Spanish fruit", row.fruit === ES.fruit);
check("translated row shows Spanish truth", row.fruitTruth === ES.fruitTruth);
check("translated row is labelled es", row.locale === "es");

/* THE test for this surface. If fruitRow mutated its input, the Today card's
 * focus line, the Today card's fruit preview, the Vine and the past-Journeys
 * grid would all silently become Spanish, because every one of them reads the
 * same record. Object.freeze would throw on write in strict mode; comparing the
 * values catches a non-strict silent write too. */
check("PLAN record is NOT mutated (fruit)", DAY.fruit === "Untensed Trust");
check("PLAN record is NOT mutated (fruitTruth)", DAY.fruitTruth === "Peace grows where control is released.");
check("fruitRow returns a NEW object", fruitRow(DAY, ES) !== DAY);
check("no translated key leaks onto the record", !Object.keys(DAY).includes("locale"));

const plain = fruitRow(DAY, null);
check("untranslated row falls back to English", plain.fruit === DAY.fruit && plain.fruitTruth === DAY.fruitTruth);
check("untranslated row is labelled en", plain.locale === "en");
check("a partial translation still yields one language per field",
  fruitRow(DAY, { fruit: ES.fruit }).fruitTruth === DAY.fruitTruth);

/* Inventory covers only COMPLETED days and never over-runs the plan. */
const PLAN5 = [DAY, DAY, DAY, DAY, DAY];
check("inventory lists exactly the completed days", inventory({ plan: PLAN5, completedCount: 3 }).length === 3);
check("inventory is empty at zero completed", inventory({ plan: PLAN5, completedCount: 0 }).length === 0);
check("inventory cannot exceed the plan", inventory({ plan: PLAN5, completedCount: 99 }).length === 5);
check("inventory tolerates a negative count", inventory({ plan: PLAN5, completedCount: -1 }).length === 0);

/* The four out-of-scope consumers must still read the record directly. If any
 * of these render sites started reading a translations map, this surface would
 * have quietly grown into four others. */
const OUT_OF_SCOPE = ["focusLine", "fpName", "fpTruth", "vineCfg", "cell-fruit"];
for (const sel of OUT_OF_SCOPE) {
  const line = VIEW.split("\n").find((l) => l.includes(sel) && l.includes("fruit"));
  if (line) check(sel + " still reads the English record", !line.includes("flTranslations"));
}
check("only the Fruit Log render site merges translations",
  (VIEW.match(/flCtrl\.fruitRow\(/g) || []).length === 1);
check("PLAN is never assigned a translated field",
  !/PLAN\[[^\]]+\]\.(fruit|fruitTruth)\s*=/.test(VIEW));
check("Fruit Log keeps its OWN development guard", VIEW.includes("FRUIT_LOG_ES_DEV"));
check("rendering never triggers preparation",
  !/function renderFruitLog\(\)[\s\S]{0,900}prepareFruitLogEs\(/.test(VIEW));

/* Fruit Log copy, approved by a native es-LA speaker on 2026-08-20 and promoted
 * into the shipped catalog. It is asserted the same way the review copy is:
 * the catalog must RESOLVE each key, the view must read it, the wording must be
 * verbatim what was approved, and English must survive at the call site so the
 * surface degrades to English rather than to a raw key. */
const FRUIT_LOG_APPROVED: Array<[string, string]> = [
  ["journey.fruitLog.prepareAction", "Preparar mi Registro del Fruto en español"],
  ["journey.fruitLog.preparing", "Preparando tu Registro del Fruto en español…"],
  ["journey.fruitLog.progress", "Día {n} de {total}"],
  ["journey.fruitLog.failBody", "No pudimos preparar todo tu Registro del Fruto. Nada se perdió y lo que ya estaba listo se guardó. Puedes intentarlo de nuevo."],
];
for (const [k, v] of FRUIT_LOG_APPROVED) {
  check("catalog RESOLVES " + k, typeof CATALOG_ES[k] === "string" && CATALOG_ES[k].length > 0);
  check("approved wording intact: " + k, CATALOG_ES[k] === v);
  check("view reads " + k, VIEW.includes("'" + k + "'"));
  check("call site keeps an English fallback for " + k,
    new RegExp("tj\\('" + k.replace(/\./g, "\\.") + "',\\s*'[A-Za-z]").test(VIEW));
}
/* The product term was settled once, for every string that carries it. A string
 * drifting to the other form is a copy change that never went through review. */
for (const [k, v] of FRUIT_LOG_APPROVED) {
  if (!v.includes("Registro")) continue;
  check("product term is 'Registro del Fruto' in " + k, v.includes("Registro del Fruto"));
}
check("no duplicate Fruit Log keys in the catalog", (() => {
  const found = CATALOG.match(/'journey\.fruitLog\.[A-Za-z]+'/g) || [];
  return new Set(found).size === found.length;
})());
check("progress copy carries both placeholders",
  CATALOG_ES["journey.fruitLog.progress"].includes("{n}") &&
  CATALOG_ES["journey.fruitLog.progress"].includes("{total}"));
/* The catalog is loaded from a VERSIONED url. Promoting copy without bumping it
 * leaves every returning reader on the old catalog, where these keys do not
 * exist and the surface silently falls back to English. That has bitten once. */
const STAMPS = [
  ["../src/layouts/DeclareLayout.astro", "layout"],
  ["../src/pages/index.astro", "index"],
] as const;
const stampValues = STAMPS.map(([rel]) => {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  const m = src.match(/i18n-strings\.js\?v=([0-9.]+)/);
  return m ? m[1] : null;
});
for (let i = 0; i < STAMPS.length; i++) {
  check("catalog is cache-busted in " + STAMPS[i][1], stampValues[i] !== null);
}
check("both catalog stamps agree", stampValues[0] === stampValues[1]);
check("catalog stamp moved past the pre-promotion version", stampValues[0] !== "3.21.0");
/* READINESS. A list with nothing missing is not the same as a list that reads
 * as Spanish. Three fixtures, because the difference is where the banner
 * started claiming a translation that never happened. */
check("the view gates readiness on spanishReady, not on missing alone",
  VIEW.includes("scan.spanishReady") && !/scan\.total && !scan\.missing\.length/.test(VIEW));
check("an empty translations map is not a translated list",
  /Object\.keys\(flTranslations\)\.length > 0/.test(VIEW));
check("the translated banner is conditional on original-english provenance",
  /showingEs\)[\s\S]{0,700}src === 'original-english'[\s\S]{0,200}translatedBanner/.test(VIEW));
check("an unresolved set costs nothing and is not an error",
  FL_CONTROLLER.includes("state: 'unresolved'") &&
  /scan\.unresolved\.length\) return \{ state: 'unresolved'/.test(FL_CONTROLLER));
check("unresolved returns BEFORE any translation is attempted",
  FL_CONTROLLER.indexOf("state: 'unresolved'") < FL_CONTROLLER.indexOf("await journeyTranslate("));
check("already-Spanish and mixed-legacy days are counted apart",
  FL_CONTROLLER.includes("alreadySpanish") && FL_CONTROLLER.includes("unresolved") &&
  /src === 'es'[\s\S]{0,80}alreadySpanish\.push/.test(FL_CONTROLLER));
check("Fruit Log reuses the APPROVED provenance strings",
  VIEW.includes("journey.review.translatedBanner") && VIEW.includes("journey.review.originalEnglishBanner"));
/* The marker phrase itself, not the substring "Tus palabras" — that also opens
 * a legitimate account-modal line about where a reader's words are stored. */
check("reader-text marker is NOT used here",
  !VIEW.includes("Sin traducir") && !CATALOG.includes("Tus palabras · Sin traducir"));

/* ── 14. PLAN locale integrity ─────────────────────────────────────────────
 * The boundary: PLAN[] is canonical content, never the translated display copy,
 * and every day carries the language it was written in. */
section("14. PLAN locale integrity");

const JOURNEY = readFileSync(new URL("../src/pages/journey.astro", import.meta.url), "utf8");
const ENGINE = readFileSync(new URL("../public/declare/journey-engine.js", import.meta.url), "utf8");

/* Both content entry points stamp a language. There are exactly two. */
check("the authored bank is stamped en", /return stampLang\(clone\(bespoke/.test(JOURNEY));
check("generated days are stamped with the generated language", /obj\.lang\s*=\s*es\s*\?\s*'es'\s*:\s*'en'/.test(ENGINE));

/* Restore repairs per day rather than per instance. */
/* Restored days that carry no stamp must default to ENGLISH, never to the
 * instance label. Stamping them with the label would mark stale English days as
 * matching the reader and legitimise the mixed record instead of repairing it —
 * a bug this suite caught in the first implementation. */
check("restore stamps unstamped days as en", /PLAN = stampLang\(o\.plan, 'en'\)/.test(JOURNEY));
check("restore does NOT stamp from the instance label",
  !/stampLang\(o\.plan, o\.lang/.test(JOURNEY));
check("restore repairs stale days", /staleDays\(PLAN, curLang\(\)\)/.test(JOURNEY));
check("stale days are reset to the authored baseline", /PLAN\[i\] = baseline\[i\];/.test(JOURNEY));
check("stale days have their generated flag cleared", /delete active\._ai\[i\]/.test(JOURNEY));
check("the old instance-level flag-clear is gone",
  !/active\._ai = \(o\.lang && o\.lang !== curLang\(\)\)/.test(JOURNEY));

/* The instance label must describe the days, not the moment of writing. */
check("saved lang is derived from the days", /const planLang = /.test(JOURNEY));
check("saved lang can report a mixed record", /'mixed'/.test(JOURNEY));
check("saveInstance no longer writes curLang() as the label",
  !/activeStep: activeStep, lang: curLang\(\)/.test(JOURNEY));

/* The transport asserts its assumption instead of trusting it. This is the one
 * that stops a Spanish day being sent for English-to-Spanish translation. */
const CONTROLLER = readFileSync(
  new URL("../src/app/declare/journey-locale/review-controller.js", import.meta.url), "utf8");
check("transport refuses a non-English source",
  /english\.lang !== 'en'/.test(CONTROLLER) && /source-not-english/.test(CONTROLLER));
check("the refusal is not retryable", /reason: 'source-not-english', retryable: false/.test(CONTROLLER));

/* Unstamped days are pre-boundary records and must be treated as English, or
 * every existing instance would be wiped on first load after the upgrade. */
check("missing stamp defaults to en", /function dayLang\(d\) \{ return \(d && d\.lang\) \|\| 'en'; \}/.test(JOURNEY));
check("stampLang never overwrites an existing stamp", /!d\.lang\) \? Object\.assign/.test(JOURNEY));
check("stampLang does not mutate the day", /Object\.assign\(\{\}, d, \{ lang: lang \}\)/.test(JOURNEY));

/* The rule itself, stated where a future reader will meet it. */
check("the boundary rule is documented at the helper", /PLAN\[\] is CANONICAL Journey content/.test(JOURNEY));
check("the stale claim about PLAN being the English original is gone",
  !/PLAN\[\] — the English original —/.test(JOURNEY));

/* ── 15. Completed-day immutability ────────────────────────────────────────
 * A completed day is a record of something a person actually walked. A language
 * mismatch is never sufficient reason to rewrite it. */
section("15. Completed-day immutability");

const { classifyDayLocale, isInternallyMixed, isTranslatable, looksSpanish, looksEnglish: looksEnglishRef } = await import(
  "../src/app/declare/journey-review-state.ts");

const EN_DAY = Object.freeze({ lang: "en", title: "Lay It Down", fruit: "Untensed Trust",
  fruitTruth: "Peace grows where control is released.", insight: "The voice inside sounds like responsibility but it is fear.", declare: "I am not the one holding this." });
const ES_DAY = Object.freeze({ lang: "es", title: "El gran intercambio", fruit: "Mente guardada",
  fruitTruth: "La paz crece donde se suelta el control.", insight: "La voz interior suena como responsabilidad pero es miedo.", declare: "Yo no soy quien sostiene esto." });
const LEGACY_EN = Object.freeze({ title: "Hurling the Weight", fruit: "Unburdened",
  fruitTruth: "He carries what you were never meant to hold.", insight: "You were never the load-bearer here.", declare: "I hand it over." });
/* THE PRODUCTION DEFECT, as a fixture: one day, two languages. */
const MIXED_DAY = Object.freeze({ fruit: "Confianza arraigada", fruitTruth: "Stayed Mind",
  title: "El gran intercambio", insight: "A mind stayed on Him is kept in perfect peace." });

check("1. completed English generated day classifies en", classifyDayLocale(EN_DAY) === "en");
check("2. completed Spanish generated day classifies es", classifyDayLocale(ES_DAY) === "es");
check("3. completed unstamped historical day is adopted as en", classifyDayLocale(LEGACY_EN) === "en");
check("4. an unknown/empty day does not throw and defaults en", classifyDayLocale({}) === "en");
check("5. completed internally mixed day classifies mixed-legacy", classifyDayLocale(MIXED_DAY) === "mixed-legacy");
check("   the mixed fixture is genuinely detected as mixed", isInternallyMixed(MIXED_DAY) === true);
check("   a coherent English day is not flagged mixed", isInternallyMixed(EN_DAY) === false);
check("   a coherent Spanish day is not flagged mixed", isInternallyMixed(ES_DAY) === false);

/* Translation eligibility follows the classification, never the reader. */
check("an English completed day stays eligible for translation", isTranslatable(EN_DAY) === true);
check("a Spanish completed day is never translated es->es", isTranslatable(ES_DAY) === false);
check("an internally mixed completed day is refused", isTranslatable(MIXED_DAY) === false);
check("a legacy unstamped English day stays eligible", isTranslatable(LEGACY_EN) === true);

/* Classification NEVER transforms. */
check("classification does not mutate the day",
  EN_DAY.title === "Lay It Down" && ES_DAY.fruit === "Mente guardada" && MIXED_DAY.fruitTruth === "Stayed Mind");
check("an explicit stamp outranks the sniff",
  classifyDayLocale({ lang: "en", fruit: "Confianza arraigada", title: "El gran intercambio",
    insight: "La voz interior suena como responsabilidad pero es miedo." }) === "en");
check("the sniff finds Spanish", looksSpanish("La paz crece donde se suelta el control.") === true);
check("the sniff does not flag English", looksSpanish("Peace grows where control is released.") === false);
check("a Spanish line with a stopword is detected as Spanish",
  looksSpanish("Yo no soy quien sostiene esto") === true);
/* A short phrase carrying neither an accent, a Spanish stopword nor an English
 * one votes for NOTHING. That is the point: ambiguity must not be read as
 * English, or a coherent Spanish day gets falsely flagged mixed. */
check("an ambiguous phrase is neither Spanish nor English",
  looksSpanish("Confianza arraigada") === false && looksEnglishRef("Confianza arraigada") === false);
check("ambiguity alone never produces mixed",
  isInternallyMixed({ fruit: "Confianza arraigada", fruitTruth: "Mente guardada firme" }) === false);

/* THE REGRESSION THAT MATTERS: the production defect cannot recur. A completed
 * wrong-language day must never be replaced by the authored-bank day, and the
 * completion predicate must not be derived from state.day, which is still at its
 * default while restore runs — that is exactly how walked days were rewritten. */
check("restore skips walked days before rewriting", /if \(isWalkedIndex\(i\)\) return;/.test(JOURNEY));
check("the walked predicate reads PERSISTED progress, not state.day",
  /function walkedDayCount\(\)/.test(JOURNEY) && /lockFor\(\)/.test(JOURNEY) && /loadActiveSaved\(\)/.test(JOURNEY));
check("the walked predicate does not use completed()",
  !/function walkedDayCount\(\)[\s\S]{0,400}completed\(\)/.test(JOURNEY));
check("it takes the HIGHER of the two persisted records",
  /Math\.max\(day, l\.day \| 0\)/.test(JOURNEY) && /Math\.max\(day, a\.day \| 0\)/.test(JOURNEY));
check("completed days receive metadata only", /if \(!isWalkedIndex\(i\) \|\| !d \|\| typeof d !== 'object'\) return;/.test(JOURNEY));
/* stampLang defaults unstamped days to English, so classification must read the
 * RAW restored record or the mixed-legacy branch is unreachable. */
check("classification reads the raw restored days, not the stamped ones",
  /const rawDays = Array\.isArray\(o\.plan\)/.test(JOURNEY) && /classifyDayLocale\(raw \|\| d\)/.test(JOURNEY));
check("an explicit raw stamp always wins over classification",
  /raw\.lang === 'en' \|\| raw\.lang === 'es'/.test(JOURNEY));
check("a second restore writes nothing when nothing changed", /if \(repaired\) saveInstance\(\);/.test(JOURNEY));
check("mixed-legacy is refused before any reservation",
  CONTROLLER.includes("source-unresolved") && /english\.lang === 'mixed-legacy'/.test(CONTROLLER));
check("the mixed refusal is non-retryable", /reason: 'source-unresolved', retryable: false/.test(CONTROLLER));
/* ── 16. Fruit Log source-locale honesty ───────────────────────────────────
 * The Fruit Log must never give a row or a section one blanket language when
 * the canonical sources disagree. */
section("16. Fruit Log source honesty");

const { sourceLocale, sourceState, isRowTranslatable: isRowTranslatableRef } = await import(
  "../src/app/declare/journey-locale/fruit-log-merge.ts");

check("a Spanish canonical day reports es", sourceLocale({ lang: "es" }) === "es");
/* A mixed-legacy day must NOT collapse to "en". Collapsing it is what put an
 * English marker on Spanish text — the mixed-record defect one layer up. */
check("a mixed-legacy day reports mixed-legacy", sourceLocale({ lang: "mixed-legacy" }) === "mixed-legacy");
check("a mixed-legacy row is not translatable", isRowTranslatableRef({ lang: "mixed-legacy" }) === false);
check("a mixed-legacy row carries NO lang attribute",
  fruitRow({ lang: "mixed-legacy", fruit: "Confianza arraigada" }, null).locale === "mixed-legacy");
check("the view marks lang=en only for an unambiguously English row",
  /esL\(\) && row\.locale === 'en'/.test(VIEW));
/* One card, one language. Spanish chrome around an English day used to render
 * "Honest Courage DÍA 1" — the day label taking the PAGE's language while the
 * content kept its own. The label must follow the row. */
check("the day label follows the ROW's language, not the page's",
  /esRow \? 'Día ' : 'Day '/.test(VIEW) && !/esL\(\) \? 'Día ' : 'Day ' \) \+ i \+ '<\/span>/.test(VIEW));
check("the accessible name follows the ROW's language too",
  /esRow \? 'Revisitar día ' : 'Revisit day '/.test(VIEW));
check("an English row is derived, not assumed", /const esRow = esL\(\) && !rowEn;/.test(VIEW));
check("a set containing a mixed-legacy day is mixed",
  sourceState([{ lang: "en" }, { lang: "mixed-legacy" }]) === "mixed");
check("an English canonical day reports en", sourceLocale({ lang: "en" }) === "en");
check("an unstamped legacy day is adopted as en", sourceLocale({}) === "en");
check("a null day does not throw", sourceLocale(null) === "en");

/* An untranslated row reports its SOURCE language, not "not translated". */
check("untranslated Spanish source is labelled es",
  fruitRow({ fruit: "Confianza arraigada", lang: "es" }, null).locale === "es");
check("untranslated English source is labelled en",
  fruitRow({ fruit: "Honest Courage", lang: "en" }, null).locale === "en");
check("a translated row is always es",
  fruitRow({ fruit: "Honest Courage", lang: "en" }, { fruit: "Valentía Honesta" }).locale === "es");

/* THE HISTORICAL DEFECT, as a fixture. A day carrying a Spanish fruit beside an
 * English truth is exactly what shipped before the locale boundary. It must be
 * classified as mixed and must never receive one blanket lang or a false
 * original-English provenance. */
const DEFECT = { fruit: "Confianza arraigada", fruitTruth: "Stayed Mind" };
check("the historical defect fixture has no stamp", !("lang" in DEFECT));
check("it is adopted as en rather than guessed", sourceLocale(DEFECT) === "en");
check("a set containing a Spanish day is mixed",
  sourceState([{ lang: "en" }, DEFECT, { lang: "es" }]) === "mixed");
check("an all-English set is original-english",
  sourceState([{ lang: "en" }, DEFECT, {}]) === "original-english");
check("an all-Spanish set is not called original-english",
  sourceState([{ lang: "es" }, { lang: "es" }]) === "all-spanish");
check("an empty set claims nothing", sourceState([]) === "none");

/* The view must consult the source state before claiming provenance, and must
 * label rows from the row's own locale. */
check("the section consults sourceState before claiming original-English",
  /sourceState\(PLAN\.slice/.test(VIEW));
check("a non-English set gets no original-English provenance",
  /srcState !== 'original-english'/.test(VIEW));
check("rows are marked from their own content locale",
  /esL\(\) && row\.locale === 'en'/.test(VIEW));
check("preparation skips days whose source is not English",
  /src === 'es'[\s\S]{0,80}continue;/.test(FL_CONTROLLER) &&
  /src === 'mixed-legacy'[\s\S]{0,80}continue;/.test(FL_CONTROLLER));

/* ── Summary ───────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
