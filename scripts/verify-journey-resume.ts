/* Declare & Believe — resuming a Journey is not starting one.
 *
 * WHAT THIS EXISTS TO PREVENT, AND IT HAD ALREADY HAPPENED
 *
 * There was exactly one way back into a Journey — beginJourney() — and it
 * clears: a new seed, clearLock(), clearInstance(), Day 1. Two surfaces
 * promised a return path in words and routed through it anyway:
 *
 *   the reset sheet   "your progress is kept, and you can return to it
 *                      whenever you're ready"
 *   the limit sheet   a button labelled "Continue this one"
 *
 * Both destroyed the progress they were offering, and the second one was in the
 * screen the billing launch was about to put in front of paying people.
 *
 * Nothing had to be stored to fix it. db_journey_lock[id] already held the day
 * reached for EVERY Journey and db_journey_inst:<id> already held each one's
 * whole plan and per-step state. restoreProgress() and restoreInstance() were
 * simply only ever called for the one Journey the device treated as current.
 *
 * THE RULES ARE EXECUTED, NOT GREPPED. src/app/declare/journey-resume.js is
 * imported and run below. Only the WIRING — which call site reaches which
 * function — is checked against the page source, because that part genuinely is
 * a property of the text.
 *
 * No network, no credential, no DOM, no deployment.
 * Run:  node scripts/verify-journey-resume.ts
 */
import { readFileSync } from "node:fs";
import {
  resumableDay,
  resumeDecision,
  parkRecord,
  isSlotRefusal,
} from "../src/app/declare/journey-resume.js";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; return; }
  failures.push(name + (detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""));
}
function section(t: string) { console.log("\n" + t + "\n"); }
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

const PAGE = read("src/pages/journey.astro");
const POLICY = read("src/app/declare/journey-resume.js");
const I18N = read("public/declare/i18n-strings.js");

/* Pull one function's source out of the page so a claim about ITS body cannot
   be satisfied by an identical line somewhere else in a 3,000-line file. */
/* Comments are prose, and prose is not behaviour. Every claim below about what
   a function DOES is made against its code with the comments removed — this
   file's own first draft passed an ordering check on a comment that named the
   call it was looking for, in the right order, in a paragraph explaining why
   the order mattered. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function body(name: string): string {
  const start = PAGE.indexOf("function " + name + "(");
  if (start < 0) return "";
  let i = PAGE.indexOf("{", start);
  if (i < 0) return "";
  let depth = 0;
  for (let j = i; j < PAGE.length; j++) {
    const ch = PAGE[j];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return PAGE.slice(start, j + 1); }
  }
  return "";
}

/* ── 1. The day a Journey can be returned to ─────────────────────────────── */
section("1. resumableDay — what counts as somewhere to return to");

check("a Journey walked to day 3 returns 3", resumableDay("shame", { shame: { day: 3 } }, []) === 3);
check("day 5 returns 5", resumableDay("fear", { fear: { day: 5 } }, []) === 5);
/* Day 1 is not progress. Resuming it and starting it are the same act, and
   starting is the one that earns the Preview. */
check("day 1 is not resumable state", resumableDay("fear", { fear: { day: 1 } }, []) === 0);
check("a Journey with no lock row is not resumable", resumableDay("fear", { shame: { day: 3 } }, []) === 0);
check("an empty lock map is not resumable", resumableDay("fear", {}, []) === 0);
/* A rooted Journey walked again is a fresh planting — the still-open sheet
   already says so: "Starting it again later begins it fresh, at day one." */
check("a rooted Journey is not resumable, even with a stale lock row",
  resumableDay("fear", { fear: { day: 4 } }, ["fear"]) === 0);
check("a rooted Journey among several is still caught",
  resumableDay("fear", { fear: { day: 4 } }, ["shame", "fear", "anxiety"]) === 0);

/* Storage is user-writable and can be anything. None of it may throw, and none
   of it may resolve to a day. */
check("a null lock map returns 0", resumableDay("fear", null as never, []) === 0);
check("a non-object row returns 0", resumableDay("fear", { fear: 7 } as never, []) === 0);
check("a non-numeric day returns 0", resumableDay("fear", { fear: { day: "abc" } } as never, []) === 0);
check("a negative day returns 0", resumableDay("fear", { fear: { day: -3 } }, []) === 0);
check("an empty id returns 0", resumableDay("", { "": { day: 3 } }, []) === 0);
check("a fractional day floors rather than throwing", resumableDay("fear", { fear: { day: 3.7 } }, []) === 3);

/* ── 2. Which way a pick goes ────────────────────────────────────────────── */
section("2. resumeDecision — resume, or the Preview that fronts a new one");

const back = resumeDecision("shame", { shame: { day: 3 } }, []);
check("a walked Journey resumes", back.action === "resume", back);
check("and resumes at the day it reached", back.day === 3, back);
/* Set aside means the slot was released, so taking it back is a fresh claim
   the cap is entitled to refuse. */
check("and reclaims its slot", back.reclaim === true, back);

const fresh = resumeDecision("shame", {}, []);
check("an unwalked Journey goes to Preview", fresh.action === "preview", fresh);
check("with no day", fresh.day === 0, fresh);
check("and claims nothing here", fresh.reclaim === false, fresh);
check("a rooted Journey goes to Preview too",
  resumeDecision("shame", { shame: { day: 5 } }, ["shame"]).action === "preview");

/* ── 3. Leaving a Journey must not lose it ───────────────────────────────── */
section("3. parkRecord — the row written for the Journey being left");

const parked = parkRecord({ date: "2026-8-27", time: "07:00", day: 1, returned: 0 }, 3, 2);
check("the day reached is written", parked.day === 3, parked);
check("the days returned are written", parked.returned === 2, parked);
/* THE ONE THAT MATTERS. Walking away from a Journey is not walking a day of it.
   Restamping the pacing date would tell the reader tomorrow that they had
   already had today, which is the entire shape of the product. */
check("the pacing date is carried across, never restamped", parked.date === "2026-8-27", parked);
check("the reminder time survives too", parked.time === "07:00", parked);

/* setLock() only ever runs on the far side of a completed day, so a Journey
   left on day 1 has no row at all. Without one there is nothing to resume by. */
const first = parkRecord(undefined, 1, 0);
check("a Journey with no prior row still gets one", !!first);
check("and it carries no pacing date", first.date === null, first);
check("so nothing about it reads as locked", first.time === null, first);
check("a malformed prior row does not throw", parkRecord(42 as never, 2, 1).day === 2);
check("a missing day floors to 1", parkRecord({}, undefined as never, 0).day === 1);
check("a missing returned floors to 0", parkRecord({}, 2, undefined as never).returned === 0);

/* ── 4. Only a stated refusal stops anything ─────────────────────────────── */
section("4. isSlotRefusal — fails open, on purpose");

check("the cap refusal is a refusal",
  isSlotRefusal({ ok: false, reason: "active-journey-limit", active: 3, limit: 3 }));
/* A null means signed out, or a backend we could not reach. Journey progress is
   local and is the reader's own work; neither is a reason to lock them out of
   a Journey they already walked. */
check("a null answer is not", !isSlotRefusal(null));
check("undefined is not", !isSlotRefusal(undefined));
check("a granted claim is not", !isSlotRefusal({ ok: true }));
check("some other failure is not", !isSlotRefusal({ ok: false, reason: "invalid-journey-id" }));

/* ── 5. Starting must STILL clear ────────────────────────────────────────── */
section("5. beginJourney still plants a fresh vine");

const BEGIN = code(body("beginJourney"));
check("beginJourney is still in the page", BEGIN.length > 0);
check("and still clears the pacing lock", /clearLock\(\)/.test(BEGIN));
check("and still clears the instance cache", /clearInstance\(\)/.test(BEGIN));
check("and still opens at day 1", /state\.day = 1/.test(BEGIN));
/* If starting stopped clearing, a fresh planting would inherit the last walk of
   that struggle — the opposite bug, and a worse one. */
check("and never restores", !/restoreInstance\(|restoreProgress\(/.test(BEGIN));
/* The Journey being left is written out before it is demoted, or "set aside"
   would still mean "lost". */
check("but it now parks the Journey being left first",
  BEGIN.indexOf("parkActive()") > 0 && BEGIN.indexOf("parkActive()") < BEGIN.indexOf("x.status = 'open'"));

/* ── 6. Resuming must restore ────────────────────────────────────────────── */
section("6. enterResumed restores what starting would have cleared");

const ENTER = code(body("enterResumed"));
check("enterResumed exists", ENTER.length > 0);
check("it restores the instance", /restoreInstance\(\)/.test(ENTER));
check("it restores the day reached", /restoreProgress\(\)/.test(ENTER));
check("and it clears NOTHING", !/clearLock\(|clearInstance\(|clearActiveSaved\(/.test(ENTER));
check("it parks the Journey being left", /parkActive\(\)/.test(ENTER));
check("and persists the one being entered", /saveActive\(\)/.test(ENTER));

/* ORDER, and it is load-bearing. restoreInstance() returns false when a Journey
   has no cached instance — walked on another device, or cleared. If the per-day
   fields still held the PREVIOUS Journey's values at that point, the reader
   would land inside somebody else's day. */
const iReset = ENTER.indexOf("daySpoken = {}");
const iRestore = ENTER.indexOf("restoreInstance()");
check("the per-day state is reset before the restore is attempted",
  iReset > 0 && iRestore > 0 && iReset < iRestore, { iReset, iRestore });
const iProgress = ENTER.indexOf("restoreProgress()");
check("and the day is restored after the instance, not before",
  iProgress > iRestore, { iRestore, iProgress });
/* saveActive() writes the day it finds, so writing before the restore would
   persist a day 1 the reader never went back to. */
check("and the active record is written after both",
  ENTER.indexOf("saveActive()") > iProgress);

/* ── 7. The two surfaces that were lying ─────────────────────────────────── */
section("7. Continue continues, and picking a set-aside Journey returns to it");

/* D2 — the limit sheet. */
const CONT = code(PAGE.slice(
  PAGE.indexOf("journey_continue_selected"),
  PAGE.indexOf("journey_let_go_selected"),
));
check("the limit sheet's Continue button was found", CONT.length > 0);
check("it now resumes", /resumeJourney\(c\.id/.test(CONT));
check("and no longer routes through the funnel that clears",
  !/beginNewJourneyFlow\(/.test(CONT));
/* Those rows come from myOpenJourneys, so every slot is already active. A
   re-entry is not a new claim and must not be capped a second time. */
check("and does not re-claim a slot it already holds", !/reclaim: true/.test(CONT));

/* D3 — picking the same struggle again from anywhere. */
const FLOW = code(body("beginNewJourneyFlow"));
check("beginNewJourneyFlow was found", FLOW.length > 0);
check("it asks whether there is somewhere to return to", /pickDecision\(c\.id\)/.test(FLOW));
check("and resumes when there is", /resumeJourney\(c\.id/.test(FLOW));
check("reclaiming the slot, because a set-aside Journey released its own",
  /reclaim: decision\.reclaim/.test(FLOW));
/* Nothing local may move before the cap has answered, or a refusal would have
   already destroyed what it was refusing to replace. */
check("a refusal lands in the same still-open sheet as any other",
  /onRefused: function \(verdict\) \{ openOpenJourneysSheet\(c\.id, verdict\); \}/.test(FLOW));
check("and the Preview still fronts a genuinely new Journey",
  /showJourneyPreview\(c, entrySource\)/.test(FLOW));
/* The decision is consulted BEFORE the Preview, not after it. */
check("the decision is consulted before the Preview",
  FLOW.indexOf("pickDecision") < FLOW.indexOf("showJourneyPreview"));

/* ── 7b. Switching twice in one page session ─────────────────────────────── */
section("7b. The Preview's commit button survives a first commit");

/* jpBegin's handler sets previewCommitting AND disables the button.
   commitPreview() cleared only the flag, and only the cap-refusal branch ever
   re-enabled the button — so the SECOND Preview of a page session opened with
   Begin Day 1 already dead. Start one Journey, switch to another without
   reloading, and there was no way to commit the second. Exactly the path this
   rework is about, and it took a browser walk to see. */
const PREVIEW = code(body("showJourneyPreview"));
check("showJourneyPreview was found", PREVIEW.length > 0);
check("it releases the double-commit flag", /previewCommitting = false/.test(PREVIEW));
check("and re-enables the button that flag disabled",
  /\$\('jpBegin'\)\.disabled = false/.test(PREVIEW));

/* ── 8. The promise the reset sheet makes is now one the code keeps ──────── */
section("8. The reset sheet");

check("the reset sheet still promises the progress is kept",
  /Your progress is kept, and it waits for you under My Journeys/.test(PAGE));
/* And it now says WHERE. A promise nobody can act on is the same as no
   promise, and for as long as this sentence existed there was no return path
   anywhere in the app. */
check("and it names the surface that keeps it", /under My Journeys, on the day you left it/.test(PAGE));
check("the Spanish says the same thing", /te espera en Mis caminos, en el día donde lo dejaste/.test(I18N));
/* Pinning the copy to the mechanism means removing the mechanism fails the
   suite rather than quietly turning the sentence back into a lie. */
check("and resumeJourney exists to keep it", body("resumeJourney").length > 0);
check("and My Journeys exists to be returned from", body("renderMyJourneys").length > 0);
/* No em dash: locked brand rule, and this sentence used to carry one. */
check("the promise carries no em dash",
  !/Only one journey grows at a time[^<]*—/.test(PAGE));

/* ── 9. The policy stays runnable ────────────────────────────────────────── */
section("9. The rules stay executable");

const POLICY_CODE = code(POLICY);
check("journey-resume imports nothing at all", !/^\s*import\s/m.test(POLICY_CODE));
check("and makes no network call", !/fetch\(/.test(POLICY_CODE));
check("and touches no storage", !/localStorage|sessionStorage/.test(POLICY_CODE));
check("and touches no DOM", !/document\.|window\./.test(POLICY_CODE));
check("and exports every rule the page needs",
  ["resumableDay", "resumeDecision", "parkRecord", "isSlotRefusal"]
    .every((f) => new RegExp("export function " + f + "\\(").test(POLICY)));
check("the page reads its rules from there rather than restating them",
  /from '\.\.\/app\/declare\/journey-resume\.js'/.test(PAGE));

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
