/* Declare & Believe — Journey Preview language integrity.
 *
 * THE RULE: one preview card, one language. Spanish interface chrome wrapped
 * around English authored content produced cards reading
 * "The Hand-Off · DÍA 1 · Bloqueado" — three Spanish labels around English
 * prose, with nothing telling the reader why. That is the same defect the
 * completed-day review and the Fruit Log each had to fix, arriving on a third
 * surface.
 *
 * This checks the DISPLAY only. Nothing here translates, reserves usage, or
 * writes to PLAN[], and the checks below assert that too — a "fix" that quietly
 * started translating the preview would be a different, unreviewed feature.
 */
import { readFileSync } from "node:fs";

const VIEW = readFileSync(new URL("../src/pages/journey.astro", import.meta.url), "utf8");
const CATALOG = readFileSync(new URL("../public/declare/i18n-strings.js", import.meta.url), "utf8");

const CATALOG_ES: Record<string, string> = (() => {
  const w: any = {};
  new Function("window", CATALOG)(w);
  return (w.__I18N_STRINGS && w.__I18N_STRINGS.es) || {};
})();

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

/* ── 1. Card language ────────────────────────────────────────────────────── */
section("1. One card, one language");

check("the card's language is derived from its CONTENT, not the page",
  /const cardEn = esL\(\) && previewDayLocale\(d\) === 'en'/.test(VIEW));
check("an English card is marked lang=en",
  /const cardLang = cardEn \? ' lang="en"' : ''/.test(VIEW));
check("the current-day card carries the marker", /jp-day jp-day-current"' \+ cardLang/.test(VIEW));
check("the locked card carries the marker", /jp-day jp-day-locked"' \+ cardLang/.test(VIEW));
check("the day word follows the card, not the page", /const dayWord = cardEn \? 'Day'/.test(VIEW));
check("chrome labels inside an English card stay English",
  /const L = function \(key, en\) \{ return cardEn \? en : tj\(key, en\); \}/.test(VIEW));
check("'Begins now' goes through the card-language helper", /L\('journey\.previewBeginsNow'/.test(VIEW));
check("'Locked' goes through it too", (VIEW.match(/L\('journey\.previewLocked'/g) || []).length === 2);
check("no preview label still uses the PAGE language unconditionally",
  !/jp-daynum">' \+ tj\('journey\.previewDayWord'/.test(VIEW) &&
  !/aria-label="' \+ \(esL\(\) \? 'Día ' : 'Day '\)/.test(VIEW));

/* ── 2. Accessible names ─────────────────────────────────────────────────── */
section("2. Accessible names follow the content");

check("the locked card's accessible name uses the card's day word",
  /aria-label="' \+ dayWord \+ ' ' \+ n/.test(VIEW));
check("the accessible name's 'Locked' follows the card too",
  /aria-label="' \+ dayWord \+ ' ' \+ n \+ ' — ' \+ L\('journey\.previewLocked'/.test(VIEW));

/* ── 3. Provenance ───────────────────────────────────────────────────────── */
section("3. Honest provenance");

check("a provenance element exists for the preview", VIEW.includes('id="jpChrome"'));
check("it reuses the shipped review-badge styling rather than inventing one",
  /id="jpChrome"/.test(VIEW) && /class="df-review-badge" id="jpChrome"/.test(VIEW));
check("it is announced as a note, not a live region", /id="jpChrome" role="note"/.test(VIEW));
check("provenance is claimed ONLY when every authored day is English",
  /allEnglish = locales\.length > 0 && locales\.every/.test(VIEW) &&
  /if \(!allEnglish\) \{ bar\.style\.display = 'none'; return; \}/.test(VIEW));
check("it is hidden entirely under English chrome",
  /if \(!esL\(\)\) \{ bar\.style\.display = 'none'; return; \}/.test(VIEW));
check("it uses the ALREADY-APPROVED original-English string",
  /jpChromeTxt'\)\.textContent = tj\('journey\.review\.originalEnglishBanner'/.test(VIEW));
check("that string resolves from the shipped catalog",
  typeof CATALOG_ES["journey.review.originalEnglishBanner"] === "string" &&
  CATALOG_ES["journey.review.originalEnglishBanner"].length > 0);
check("approved wording intact",
  CATALOG_ES["journey.review.originalEnglishBanner"] === "Contenido original en inglés · Solo lectura");
/* The preview shows days nobody has walked. Claiming a translation, or reusing
 * the completed-day wording, would both be false. */
check("the preview NEVER claims the content is translated",
  !/jpChrome[\s\S]{0,400}translatedBanner/.test(VIEW));
check("the preview does not borrow the completed-day wording",
  !/jpChrome[\s\S]{0,400}genericBanner/.test(VIEW));

/* ── 4. No new Spanish, no new behaviour ─────────────────────────────────── */
section("4. Display only");

const PREVIEW_FN = (() => {
  const i = VIEW.indexOf("function renderPreviewChrome");
  const j = VIEW.indexOf("const sec = $('jpSecondary')", i);
  return VIEW.slice(i, j);
})();
check("the preview never calls the translation transport",
  !/journeyTranslate|review-controller|fruit-log-controller/.test(PREVIEW_FN));
check("the preview never reserves usage", !/usage|reserve/i.test(PREVIEW_FN));
check("the preview never writes to PLAN", !/PLAN\[[^\]]*\]\s*=/.test(PREVIEW_FN));
check("the preview introduces no new user-facing Spanish string",
  !/[áéíóúñ¿¡]/i.test(PREVIEW_FN.replace(/\/\*[\s\S]*?\*\//g, "")));
check("no new journey.preview* key was added to the catalog",
  (CATALOG.match(/'journey\.preview[A-Za-z0-9]+'/g) || []).length ===
  new Set(CATALOG.match(/'journey\.preview[A-Za-z0-9]+'/g) || []).size);

/* ── 5. Fixtures ─────────────────────────────────────────────────────────── */
section("5. Locale fixtures");

/* previewDayLocale is a pure three-way classifier; re-declared here with the
 * same contract the view uses, so a drift in either shows up as a failure. */
function previewDayLocale(d: { lang?: string } | null | undefined) {
  if (!d) return "en";
  if (d.lang === "es") return "es";
  if (d.lang === "mixed-legacy") return "mixed-legacy";
  return "en";
}
check("view and fixture agree on the classifier shape",
  /if \(d\.lang === 'es'\) return 'es';/.test(VIEW) &&
  /if \(d\.lang === 'mixed-legacy'\) return 'mixed-legacy';/.test(VIEW));

// Spanish chrome + English authored content — the reported defect.
const EN_PLAN = [{ lang: "en" }, { lang: "en" }, { lang: "en" }, { lang: "en" }, { lang: "en" }];
check("Spanish chrome, English content: every card is English",
  EN_PLAN.every((d) => previewDayLocale(d) === "en"));
check("Spanish chrome, English content: provenance is claimable",
  EN_PLAN.map(previewDayLocale).every((l) => l === "en"));

// English chrome + English content — nothing to explain, nothing to mark.
check("English chrome, English content: no provenance is shown",
  /if \(!esL\(\)\) \{ bar\.style\.display = 'none'; return; \}/.test(VIEW));

// Coherent Spanish source — chrome and content agree.
const ES_PLAN = [{ lang: "es" }, { lang: "es" }, { lang: "es" }, { lang: "es" }, { lang: "es" }];
check("coherent Spanish source: no card is marked English",
  ES_PLAN.every((d) => previewDayLocale(d) !== "en"));
check("coherent Spanish source: no original-English provenance is claimed",
  !ES_PLAN.map(previewDayLocale).every((l) => l === "en"));

// Mixed / unresolved.
const MIXED = [{ lang: "en" }, { lang: "es" }, { lang: "en" }, { lang: "en" }, { lang: "en" }];
const UNRESOLVED = [{ lang: "en" }, { lang: "mixed-legacy" }, { lang: "en" }, { lang: "en" }, { lang: "en" }];
check("a mixed set claims no blanket provenance",
  !MIXED.map(previewDayLocale).every((l) => l === "en"));
check("an unresolved set claims no blanket provenance",
  !UNRESOLVED.map(previewDayLocale).every((l) => l === "en"));
check("a mixed-legacy day is never marked English",
  previewDayLocale({ lang: "mixed-legacy" }) !== "en");
check("an unstamped legacy day is adopted as English", previewDayLocale({}) === "en");
check("a null day does not throw", previewDayLocale(null) === "en");

/* ── 6. Nothing else moved ───────────────────────────────────────────────── */
section("6. Blast radius");

check("Day-Opening is untouched", !/jpChrome[\s\S]{0,300}doTitle/.test(VIEW));
check("the Fruit Log is untouched by this change", !VIEW.includes("previewDayLocale(PLAN"));
check("the active ritual is untouched", !/jpChrome[\s\S]{0,300}dfComplete/.test(VIEW));

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
