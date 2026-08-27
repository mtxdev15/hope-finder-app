/* Declare & Believe — My Journeys, the front door that was missing.
 *
 * WHAT THIS EXISTS TO PREVENT
 *
 * The app knew all of this and never said it. `myOpenJourneys` had exactly one
 * caller in the whole codebase — the sheet that REFUSES somebody a new Journey.
 * `db_journey_lock` is structurally a per-struggle progress ledger, one row for
 * every struggle ever started on the device, and it was only ever read at the
 * one id the app considered current. So a reader could reach Day 3 of Shame,
 * switch to something else, and nothing anywhere would ever tell them Shame was
 * still waiting. The only inventory the system owned was shown once, as a wall.
 *
 * THE GROUPING IS EXECUTED, NOT GREPPED. src/app/declare/journey-inventory.js is
 * imported and run. Only the WIRING — which surface renders it, and when it is
 * allowed to be hidden — is checked against the page source.
 *
 * No network, no credential, no DOM, no deployment.
 * Run:  node scripts/verify-journey-inventory.ts
 */
import { readFileSync } from "node:fs";
import { buildInventory, inventoryHasAnything } from "../src/app/declare/journey-inventory.js";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; return; }
  failures.push(name + (detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""));
}
function section(t: string) { console.log("\n" + t + "\n"); }
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

const PAGE = read("src/pages/journey.astro");
const MODULE = read("src/app/declare/journey-inventory.js");
const I18N = read("public/declare/i18n-strings.js");

function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}
function body(name: string): string {
  const start = PAGE.indexOf("function " + name + "(");
  if (start < 0) return "";
  const i = PAGE.indexOf("{", start);
  if (i < 0) return "";
  let depth = 0;
  for (let j = i; j < PAGE.length; j++) {
    if (PAGE[j] === "{") depth++;
    else if (PAGE[j] === "}") { depth--; if (depth === 0) return PAGE.slice(start, j + 1); }
  }
  return "";
}

const KNOWN = ["anxiety", "shame", "fear", "doubt", "grief"];
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

/* ── 1. The three groups ─────────────────────────────────────────────────── */
section("1. What the reader has going");

const full = buildInventory({
  knownIds: KNOWN,
  activeId: "anxiety",
  lockMap: { anxiety: { day: 3 }, shame: { day: 1 }, fear: { day: 5 } },
  doneList: ["doubt"],
  openIds: null,
});
check("the Journey on screen is the one being walked", ids(full.walking).join() === "anxiety", full.walking);
check("and it carries the day it reached", full.walking[0].day === 3, full.walking);
check("everything else started is set aside", ids(full.setAside).join() === "fear,shame", full.setAside);
check("and what was finished is rooted", ids(full.rooted).join() === "doubt", full.rooted);
/* Furthest along first: the one closest to finishing, which is the same
   argument the still-open sheet already makes for it. */
check("set aside is ordered furthest-along first",
  full.setAside[0].id === "fear" && full.setAside[0].day === 5, full.setAside);

/* ── 2. Rooted wins over every other record ──────────────────────────────── */
section("2. A finished Journey is finished");

const stale = buildInventory({
  knownIds: KNOWN,
  activeId: null,
  lockMap: { doubt: { day: 5 } },     // a lock row left behind by the walk that finished it
  doneList: ["doubt"],
  openIds: ["doubt"],                  // and a server slot nobody released
  });
check("a stale lock row does not resurrect it", ids(stale.setAside).length === 0, stale.setAside);
check("an unreleased server slot does not either", ids(stale.rooted).join() === "doubt", stale.rooted);
check("and it is never shown as the one being walked",
  buildInventory({ knownIds: KNOWN, activeId: "doubt", lockMap: {}, doneList: ["doubt"], openIds: null })
    .walking.length === 0);

/* ── 3. Signed out is not empty ──────────────────────────────────────────── */
section("3. The device is the primary source");

/* The 3am user is usually not signed in, and their Journeys are no less real
   for it. A null openIds means we never asked or there is nobody to ask. */
const guest = buildInventory({
  knownIds: KNOWN, activeId: null,
  lockMap: { fear: { day: 4 } }, doneList: [], openIds: null,
});
check("a signed-out reader still sees what they walked", ids(guest.setAside).join() === "fear", guest.setAside);
check("and the surface knows there is something to show", inventoryHasAnything(guest));

/* And the server only ever ADDS. A Journey begun on a phone must be reachable
   on a laptop that has never held its records. */
const otherDevice = buildInventory({
  knownIds: KNOWN, activeId: null, lockMap: {}, doneList: [], openIds: ["shame"],
});
check("a server row with no local record still appears", ids(otherDevice.setAside).join() === "shame");
/* Saying "Day 1" about it would be a guess presented as a fact. */
check("and is marked as a day we do not actually know", otherDevice.setAside[0].dayKnown === false, otherDevice.setAside[0]);
check("while a local row is marked known", guest.setAside[0].dayKnown === true);

/* Neither source may delete from the other. */
const both = buildInventory({
  knownIds: KNOWN, activeId: null,
  lockMap: { fear: { day: 4 } }, doneList: [], openIds: ["shame"],
});
check("both sources are unioned, not intersected", ids(both.setAside).sort().join() === "fear,shame", both.setAside);
check("a Journey in both sources appears once",
  ids(buildInventory({ knownIds: KNOWN, activeId: null, lockMap: { fear: { day: 2 } }, doneList: [], openIds: ["fear"] }).setAside).join() === "fear");

/* ── 4. Nothing is invented, and nothing throws ──────────────────────────── */
section("4. Records the reader can write");

check("an id the catalog no longer ships is dropped",
  ids(buildInventory({ knownIds: KNOWN, activeId: null, lockMap: { retired: { day: 3 } }, doneList: [], openIds: ["gone"] }).setAside).length === 0);
check("no input at all returns three empty groups", (() => {
  const e = buildInventory(undefined as never);
  return e.walking.length === 0 && e.setAside.length === 0 && e.rooted.length === 0;
})());
check("a garbage lock map does not throw",
  buildInventory({ knownIds: KNOWN, activeId: null, lockMap: "nope" as never, doneList: null as never, openIds: 7 as never }).setAside.length === 0);
check("a row with no usable day still counts as started, at day 1", (() => {
  const r = buildInventory({ knownIds: KNOWN, activeId: null, lockMap: { fear: { day: "x" } } as never, doneList: [], openIds: null });
  return r.setAside.length === 1 && r.setAside[0].day === 1 && r.setAside[0].dayKnown === false;
})());
check("a day beyond the journey's length is clamped",
  buildInventory({ knownIds: KNOWN, activeId: null, lockMap: { fear: { day: 99 } }, doneList: [], openIds: null }).setAside[0].day === 5);
check("a duplicated done entry is listed once",
  ids(buildInventory({ knownIds: KNOWN, activeId: null, lockMap: {}, doneList: ["doubt", "doubt"], openIds: null }).rooted).join() === "doubt");

/* ── 5. Nothing to show is not a screen ──────────────────────────────────── */
section("5. A brand-new visitor sees no inventory at all");

check("an empty inventory has nothing",
  !inventoryHasAnything(buildInventory({ knownIds: KNOWN, activeId: null, lockMap: {}, doneList: [], openIds: null })));
check("one rooted Journey is enough to have something",
  inventoryHasAnything(buildInventory({ knownIds: KNOWN, activeId: null, lockMap: {}, doneList: ["doubt"], openIds: null })));
check("so is one being walked",
  inventoryHasAnything(buildInventory({ knownIds: KNOWN, activeId: "fear", lockMap: {}, doneList: [], openIds: null })));
check("and null is not something", !inventoryHasAnything(null as never));

/* ── 6. Wiring: it is reachable where it was not ─────────────────────────── */
section("6. Reachable in every state that has anything in it");

const ZERO = code(body("showZeroUI"));
check("showZeroUI was found", ZERO.length > 0);
/* THE ONE THE PLAN IS ABOUT. "Past journeys" was display:none in the zero
   state, which is the exact moment somebody is deciding what to do next. */
check("the zero state no longer hides the inventory outright", !/\$\('seeAll'\)\.style\.display = 'none'/.test(ZERO));
check("it asks whether there is anything to show instead", /syncMyJourneys\(\)/.test(ZERO));

const SYNC = code(body("syncMyJourneys"));
check("syncMyJourneys was found", SYNC.length > 0);
check("it hides the surface only when the inventory is empty", /myJourneysHasContent\(\)/.test(SYNC));

const HOME = code(body("renderHome"));
check("the home render keeps the inventory in step", /syncMyJourneys\(\)/.test(HOME));
/* Two writers for one number is how a heading ends up disagreeing with the
   rows beneath it. */
check("and no longer writes the rooted count itself", !/doneCount/.test(HOME));

const RENDER = code(body("renderMyJourneys"));
check("renderMyJourneys was found", RENDER.length > 0);
check("it builds from the shared inventory", /currentInventory\(\)/.test(RENDER));
check("it renders all three groups",
  /mjWalkList/.test(RENDER) && /mjAsideList/.test(RENDER) && /renderGrid\(\)/.test(RENDER));
/* Every card is a way back in, and "back in" means the same thing here as
   everywhere else — the resume decision, not a second opinion about it. */
check("and every card routes through the one entry funnel", /beginNewJourneyFlow\(id, 'myJourneys'\)/.test(RENDER));

const SLOTS = code(body("refreshOpenSlots"));
check("the server is asked at most once per load", /openSlotsAsked/.test(SLOTS));
/* A null must stay a null on BOTH paths. It means "we did not get an answer",
   which is not the same claim as "the answer was none" — and the first draft of
   this check passed against a version that turned the no-answer case into an
   empty list, because the catch block below happened to contain the same line.
   So both branches are pinned, separately. */
check("no answer stays null rather than becoming an empty list",
  /Array\.isArray\(rows\)[\s\S]{0,160}?:\s*null;/.test(SLOTS), SLOTS.slice(0, 400));
check("and a thrown call stays null too",
  /catch\(function \(\) \{ openSlotIds = null;/.test(SLOTS.replace(/\s*\.\s*catch/g, ".catch").replace(/\.catch\(/g, "catch(")));

/* ── 6b. D1: a way to choose another, on every viewport ──────────────────── */
section("6b. The switch control cannot be hidden by a breakpoint");

const SIDEBAR = read("public/declare/sidebar.css");
/* This is why the old control did not exist on a desktop: it was injected into
   the mast, and the rail layout hides the whole mast at 768px. The rule is
   correct and stays; what was wrong was putting the only switch control inside
   something the rule turns off. */
check("the rail still hides the mast on desktop", /\.app-shell \.mast \{ display: none; \}/.test(SIDEBAR));
check("so the switch control now lives on the card instead", /id="jcSwitch"/.test(PAGE));
check("and is a labelled control, not a glyph", /id="jcSwitchTxt"/.test(PAGE));
/* Nothing inside the mast may be the only way to reach the chooser again. */
const injected = PAGE.slice(PAGE.indexOf("body > .mast"), PAGE.indexOf("body > .mast") + 900);
check("the mast control is no longer the sole route",
  /overflowBtn/.test(injected) && /id="jcSwitch"/.test(PAGE) && /id="mjNew"/.test(PAGE));

const FLOW2 = code(body("openChooseFlow"));
check("openChooseFlow was found", FLOW2.length > 0);
check("it reaches the chooser", /openChooseList\(\)/.test(FLOW2));
/* Warning somebody about setting aside nothing is noise, and the sheet's own
   sentence would be false. */
check("and only confirms when there is something to set aside",
  /active\.status === 'active'/.test(FLOW2) && /openSheet\('resetSheet'\)/.test(FLOW2));
for (const id of ["mSwitch", "jcSwitch", "mjNew"]) {
  check(`${id} routes through that one funnel`,
    new RegExp("\\$\\('" + id + "'\\)\\.addEventListener\\('click', function \\(\\) \\{ openChooseFlow\\(").test(PAGE));
}

/* Dead code that was left "for future reuse" and could not be reached. */
check("plantAndBegin is gone", !/function plantAndBegin/.test(PAGE));
check("and so are the styles only it used",
  !/\.plant-seed \{/.test(PAGE) && !/\.plant-bloom \{/.test(PAGE));
check("and the pointer-events rule left over from the retired top bar",
  !/\.mast \.mright \{ pointer-events/.test(PAGE));

/* ── 6c. All of them, and each one labelled ──────────────────────────────── */
section("6c. The chooser stops hiding the app from the people using it");

const CHOOSE = code(body("openChooseList"));
check("openChooseList was found", CHOOSE.length > 0);
/* It filtered to status === 'open', which quietly means "the ones you have
   never touched": the Journey being walked was missing, every finished one was
   missing, and the more of the app somebody used the less of it they saw. */
check("it no longer filters to the untouched ones",
  !/CATALOG\.filter\(function \(c\) \{ return c\.status === 'open'; \}\)/.test(CHOOSE));
check("it renders the whole catalog", /CATALOG\.map\(/.test(CHOOSE));
check("and says how many that is, from the catalog rather than a number typed in",
  /CATALOG\.length \+ ' journeys/.test(CHOOSE));

/* Every row says what tapping it will do, because a rooted Journey begins
   fresh and a set-aside one resumes, and neither may be a surprise. */
check("the one being walked is marked", /ch-st on/.test(CHOOSE) && /activeId/.test(CHOOSE));
check("rooted ones are marked", /rootedSet\[c\.id\]/.test(CHOOSE));
check("and a set-aside one carries the day it waits on", /asideDay\[c\.id\]/.test(CHOOSE));
/* The day comes from the same inventory the rest of the surface is built from,
   not from a second reading of storage that could disagree with it. */
check("all three come from the shared inventory", /currentInventory\(\)/.test(CHOOSE));
/* Tapping the Journey you are already in is not a pick, and must not open a
   confirm about replacing it with itself. */
check("tapping the active one goes to it rather than through the funnel",
  /if \(id === activeId\)/.test(CHOOSE) && /activeCard'\)\.scrollIntoView/.test(CHOOSE));

check("the chooser's own copy carries no em dash",
  !/Name the false identity[^<]*&mdash;/.test(PAGE));

/* ── 7. Both languages ───────────────────────────────────────────────────── */
section("7. All of it in English and Spanish");

for (const key of ["journey.mj.title", "journey.mj.hide", "journey.mj.walking",
                   "journey.mj.setAside", "journey.mj.rooted", "journey.mj.open",
                   "journey.mj.elsewhere"]) {
  check(`${key} has Spanish`, new RegExp("'" + key.replace(/\./g, "\\.") + "':\\s*'[^']+'").test(I18N));
  check(`and the page asks for it`, PAGE.includes("'" + key + "'"));
}
/* A key removed from the page but left in the strings file is dead weight that
   the next person has to work out is dead. */
const declared = (I18N.match(/'journey\.mj\.[a-zA-Z]+'/g) || []).map((q) => q.replace(/'/g, ""));
check("no orphaned journey.mj key is left behind",
  declared.every((k) => PAGE.includes("'" + k + "'")), declared.filter((k) => !PAGE.includes("'" + k + "'")));

/* ── 8. The rules stay runnable ──────────────────────────────────────────── */
section("8. The grouping stays executable");

const M = code(MODULE);
check("journey-inventory imports nothing at all", !/^\s*import\s/m.test(M));
check("and makes no network call", !/fetch\(/.test(M));
check("and touches no storage", !/localStorage|sessionStorage/.test(M));
check("and touches no DOM", !/document\.|window\./.test(M));
check("the page reads its grouping from there", /from '\.\.\/app\/declare\/journey-inventory\.js'/.test(PAGE));

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
