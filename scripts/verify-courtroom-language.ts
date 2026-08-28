/* Declare & Believe — the courtroom-language guard.
 *
 * WHY THIS EXISTS
 *
 * A locked brand rule bans courtroom framing: no "verdict", no "courtroom", no
 * "gavel", no "defendant", no "judge" as a noun, no "sentence" in the punishment
 * sense. Guilt as a FEELING is fine. The ban is on the frame, because somebody
 * who arrives at 3am carrying shame should not be handed a metaphor in which
 * they are the accused, even one that ends in acquittal.
 *
 * The rule was written and then violated 28 times, most of it in content that is
 * read aloud during the Journey ritual, including three day and prayer titles.
 * It was swept on 2026-08-27. Without this file that sweep is a one-time cleanup
 * that drifts back the next time somebody writes a day.
 *
 * WHAT MAKES THIS DIFFERENT FROM A GREP
 *
 * A plain grep for these words is useless here, because the words have innocent
 * senses that appear all over the content and MUST NOT be "fixed":
 *
 *   "sentence" as a unit of grammar   "Write one sentence", "1 to 2 sentences",
 *                                     "the fall is not the end of the sentence.
 *                                      Failure got a comma, not a period."
 *   "conviction" as firm belief       Hebrews 11:1 is quoted verbatim in four
 *                                     places. SCRIPTURE IS NEVER REWRITTEN.
 *   "judge" as a verb                 "not waiting at the bottom to judge it"
 *
 * So this file works from an ALLOW LIST of exact approved phrases, and fails on
 * any occurrence outside it. That cuts both ways on purpose: a new violation
 * fails, and so does quietly deleting an approved exception or widening one.
 *
 * No network, no credential, no DOM. Run: node scripts/verify-courtroom-language.ts
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; return; }
  failures.push(name + (detail !== undefined ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""));
}
function section(t: string) { console.log("\n" + t + "\n"); }
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

/* ── The four approved exceptions ────────────────────────────────────────────
 *
 * Every one was decided by the owner on 2026-08-27, each with a reason, and
 * each is an exception to the RULE rather than a one-off override. They are
 * listed here as exact phrases so that neither adding a fifth nor deleting one
 * of these four can happen quietly. */
type Approved = { phrase: string; files: string[]; count: number; why: string };

const APPROVED: Approved[] = [
  {
    /* 2 Timothy 4:8, nearly word for word. The rule exists so a hurting person
       is never cast as the accused — and here they are not. God is judging the
       one who hurt them, which is the entire comfort of the prayer. */
    phrase: "just Judge",
    count: 1,
    files: ["public/declare/journey-data.js"],
    why: "God judging the offender, not the reader (2 Timothy 4:8)",
  },
  {
    /* The same phrase, the same situation, on the page that teaches it. Found
       after the owner's ruling and covered by it: identical construction,
       identical context, the debt handed to God. */
    phrase: "just judge",
    count: 2,
    files: ["public/unforgiveness.html"],
    why: "same 2 Timothy 4:8 case, on the unforgiveness page",
  },
  {
    /* "Sentence" here is a length of time, not a ruling — it is paired against
       "season", a time word — and no replacement matched the rhythm. */
    phrase: "a season, not a sentence",
    count: 2,
    files: ["public/declare/journey-data.js"],
    why: "sentence meaning duration, paired against a time word",
  },
  {
    /* Exegesis, not accusation: it names what Paul's Greek meant IN ORDER TO
       dismantle it. Naming a legal term to take it apart is allowed; framing
       the reader as the accused is not. The four lines after this one, which
       did the second thing, were rewritten. */
    phrase: "Condemnation is a courtroom word, a guilty sentence",
    count: 1,
    files: ["public/shame.html"],
    why: "exegesis of Romans 8:1, dismantling the term rather than applying it",
  },
];

/* ── The banned frames ───────────────────────────────────────────────────────
 * "judge" is matched only where a determiner or adjective makes it a NOUN, so
 * "to judge it" (a verb, and ordinary English) does not trip the guard. */
const BANNED: { name: string; re: RegExp }[] = [
  { name: "verdict", re: /\bverdicts?\b/gi },
  { name: "courtroom", re: /\bcourtrooms?\b/gi },
  { name: "gavel", re: /\bgavels?\b/gi },
  { name: "defendant", re: /\bdefendants?\b/gi },
  { name: "judge as a noun", re: /\b(?:the|a|an|just|harsh|righteous|myself)\s+judges?\b/gi },
  { name: "on trial", re: /\bon trial\b/gi },
  { name: "acquittal", re: /\bacquit(?:s|ted|tal)?\b/gi },
  { name: "life sentence", re: /\blife[- ]sentences?\b/gi },
  { name: "guilty sentence", re: /\bguilty (?:verdict|sentence)\b/gi },
];

/* Files a reader's eyes actually reach. journey.astro is excluded from the
   `verdict` sweep on purpose and checked separately below: it holds an internal
   identifier of that name for a classification result, which is never rendered. */
const CONTENT_FILES = [
  "public/declare/journey-data.js",
  "public/declare/journey-engine.js",
  ...globSync("public/*.html", { cwd: new URL("../", import.meta.url) }).map((f) => "public/" + f.split("/").pop()),
];

/* ── 1. No courtroom framing outside the approved four ───────────────────── */
section("1. The content a reader actually reads");

let scanned = 0;
const offences: string[] = [];
for (const file of CONTENT_FILES) {
  let src: string;
  try { src = read(file); } catch { continue; }
  scanned++;
  for (const { name, re } of BANNED) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const around = src.slice(Math.max(0, m.index - 120), m.index + m[0].length + 120);
      const allowed = APPROVED.some((a) => a.files.includes(file) && around.includes(a.phrase));
      if (allowed) continue;
      const line = src.slice(0, m.index).split("\n").length;
      offences.push(`${file}:${line} [${name}] ...${around.replace(/\s+/g, " ").trim().slice(0, 150)}...`);
    }
  }
}
/* Pinned near the real count so a glob that silently stops matching (a moved
   directory, a changed extension) fails loudly instead of passing by scanning
   nothing. */
check("there are content files to scan", scanned >= 26, `scanned ${scanned}`);
check("no courtroom framing outside the approved exceptions",
  offences.length === 0, offences.length ? "\n      " + offences.join("\n      ") : undefined);

/* ── 2. Each approved exception is still exactly where it was approved ───── */
section("2. The four approved exceptions, still four");

/* EXACT COUNTS, not "at least one". Several of these appear twice — the drought
   line is both the teaching and the declaration spoken aloud, and the
   unforgiveness page says "the just judge" in a step and again in its prayer.
   A ">= 1" check passes while half a rewrite lands, which is precisely the
   half-done state that is hardest to spot by reading. This suite's own first
   draft made that mistake and two mutations walked straight through it. */
for (const a of APPROVED) {
  for (const f of a.files) {
    const n = read(f).split(a.phrase).length - 1;
    check(`"${a.phrase}" appears ${a.count}x in ${f.split("/").pop()} — ${a.why}`,
      n === a.count, `found ${n}`);
  }
}
const DATA = read("public/declare/journey-data.js");

/* ── 3. The rewrites that were made are still made ───────────────────────── */
section("3. The sweep itself has not been reverted");

const TITLES: [string, string][] = [
  ["Not Your Name", "Not Your Verdict"],
  ["Out of That Room", "Out of the Courtroom"],
  ["You Settle It", "You Are the Judge"],
];
for (const [now, was] of TITLES) {
  check(`the title reads "${now}"`, DATA.includes("'" + now + "'"));
  check(`and no longer "${was}"`, !DATA.includes(was));
}
/* "Not Your Name" is the line that day was already making: its own fruit truth
   reads "A failure is an event, not your name." A title that argues a different
   metaphor than the day under it is the defect this replaced. */
check("the failure day's title and its fruit truth agree",
  /\{title:'Not Your Name', fruit:'Honesty', fruitTruth:'A failure is an event, not your name\.'/.test(DATA));

/* The two rewrites that were reworked after reading the whole day, and would be
   the first things a careless re-edit would flatten back. */
check("the grace day stays inside its own ledger metaphor",
  DATA.includes("yesterday’s failure is today’s bill"));
check("the unforgiveness day keeps its lock and key",
  DATA.includes("a lock you’re turning on the other person"));

/* ── 4. Innocent senses are left alone ───────────────────────────────────── */
section("4. The false positives a grep would have 'fixed'");

/* Scripture is never rewritten. Hebrews 11:1 uses "conviction" to mean firm
   belief, and appears verbatim in four places. */
const ENGINE = read("public/declare/journey-engine.js");
const HEB = "the conviction of things not seen";
/* Twice in journey-data (the verse itself, then the declaration that quotes it)
   and once in the engine's own bank. Counted, because rewriting one and leaving
   the other is how a quoted verse and the line quoting it end up disagreeing. */
check("Hebrews 11:1 still reads 'the conviction of things not seen', both places in journey-data",
  DATA.split(HEB).length - 1 === 2, DATA.split(HEB).length - 1);
check("and once in journey-engine", ENGINE.split(HEB).length - 1 === 1);
/* "Sentence" as a unit of grammar. */
check("'Write one sentence' survives", DATA.includes("Write one sentence"));
check("'Write the failure as a sentence' survives", DATA.includes("Write the failure as a sentence"));
check("the model is still told to write '1 to 2 sentences'", /1 to 2 sentences/.test(ENGINE));
check("the failure page's comma-not-a-period line survives",
  read("public/failure.html").includes("the fall is not the end of the sentence"));
/* "Judge" as a verb. */
check("'not waiting at the bottom to judge it' survives",
  read("public/failure.html").includes("waiting at the bottom to judge it"));

/* ── 5. The internal identifiers are internal ────────────────────────────── */
section("5. Code named `verdict` is code");

const PAGE = read("src/pages/journey.astro");
check("journey.astro still uses `verdict` as an identifier", /\bverdict\b/.test(PAGE));
/* It is a classification result passed between functions, never rendered. The
   moment it reaches anything a person can read, it stops being an identifier
   and becomes copy that breaks the rule.

   The first version of this check looked only for textContent and innerHTML,
   and a mutation that wrote the word into document.title walked past it. Every
   route to a reader is listed now. */
const RENDER_SINKS = /(?:textContent|innerText|innerHTML|outerHTML|insertAdjacentHTML|document\.title|setAttribute\s*\(\s*['"`](?:aria-label|title|alt|placeholder)['"`])/;
const rendersVerdict = PAGE.split("\n").some((line) => {
  if (!/\bverdict\b/i.test(line)) return false;
  if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) return false;   // prose about it is not rendering it
  return RENDER_SINKS.test(line);
});
check("and never puts it anywhere a person can read", !rendersVerdict);

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
