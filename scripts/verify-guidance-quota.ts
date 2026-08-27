/* Declare & Believe — the Gentle Guidance daily limit.
 *
 * WHAT THIS EXISTS TO PREVENT, and it had already happened.
 *
 * /pricing promised Free three Gentle Guidance responses a day and Plus no
 * limit. Neither ceiling existed. convex/usage.ts held a complete, careful
 * meter — reserve, finalize, release, expiry, idempotence — and nothing in the
 * browser ever called it:
 *
 *     reserveUsage    -> 0 call sites in src/ and public/
 *     finalizeUsage   -> 0 call sites in src/ and public/
 *     releaseUsage    -> 0 call sites in src/ and public/
 *
 * The counter was read, which is why /billing could display "3 left today"
 * forever, and never written. Free and Plus were the same product, so turning
 * purchasing on would have sold a plan that changed nothing.
 *
 * THE POLICY IS IMPORTED AND EXECUTED, not grepped. A grep would pass against a
 * policy that never runs, which is the exact failure this file is about.
 *
 * No network, no credential, no deployment, no model call.
 * Run:  node scripts/verify-guidance-quota.ts
 */
import { readFileSync } from "node:fs";
import {
  GUIDANCE_FEATURE,
  GuidanceLimitError,
  RELEASE_REASONS,
  REFUSING_REASONS,
  interpretReserve,
  isGuidanceLimit,
  newRequestId,
} from "../src/app/declare/guidance-quota.js";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

const API = read("src/app/declare/declare-api.js");
const DATA = read("src/app/declare/convex-data.js");
const TODAY = read("src/pages/today.astro");
const I18N = read("public/declare/i18n-strings.js");
const CATALOG = read("convex/entitlementCatalog.ts");
const USAGE = read("convex/usage.ts");

const ID = "req-abc";

/* ── 1. The meter is actually called now ─────────────────────────────────── */
section("1. The meter that nothing called");

for (const fn of ["reserveUsage", "finalizeUsage", "releaseUsage"]) {
  check(`convex/usage.ts still exports ${fn}`, new RegExp("export const " + fn + " =").test(USAGE));
  check(`and the browser now calls ${fn}`, new RegExp("apiRef\\.usage\\." + fn).test(DATA));
}
/* HELD AT THE ONE DOOR. Inside generateContent rather than at each call site,
   so a third caller written next year cannot forget it. */
check("the hold is taken inside generateContent",
  /export async function generateContent\([\s\S]{0,1400}?reserveGuidance\(GUIDANCE_FEATURE, requestId\)/.test(API));
check("the unchanged brain moved down a level rather than being threaded through",
  /async function generateContentInner\(/.test(API));
check("and generateContent is the only thing that calls it",
  (API.match(/generateContentInner\(/g) || []).length === 2);
check("the feature key has one definition",
  /GUIDANCE_FEATURE = 'gentle_guidance'/.test(read("src/app/declare/guidance-quota.js")) &&
  !/'gentle_guidance'/.test(API));

/* ── 2. Fails open, and only one thing refuses ───────────────────────────── */
section("2. Only a counted three may stop somebody");

check("exactly one reason refuses", REFUSING_REASONS.length === 1);
check("and it is the counted limit", REFUSING_REASONS[0] === "daily-limit-reached");

/* A guest, an unreachable backend, a thrown transport error and a nonsense
   answer are the SAME case: we could not ask, so we do not refuse. Billing
   fails closed because being wrong grants something unpaid; this fails open
   because being wrong refuses Scripture to somebody at 3am over a blip. */
for (const [name, res] of [
  ["a signed-out reader (null)", null],
  ["an undefined answer", undefined],
  ["a string answer", "nope"],
  ["an empty object", {}],
  ["a refusal with no reason", { ok: false }],
  ["an unrecognised refusal", { ok: false, reason: "something-new" }],
  ["requires-account reaching a signed-in reader", { ok: false, reason: "requires-account" }],
] as const) {
  const v = interpretReserve(res as any, ID);
  check(`${name} proceeds`, v.proceed === true);
  check(`${name} proceeds unmetered`, v.proceed === true && v.metered === false);
  check(`${name} holds nothing to settle`, v.proceed === true && v.requestId === null);
}

const ok = interpretReserve({ ok: true, remaining: 2 }, ID);
check("a granted hold proceeds", ok.proceed === true);
check("and is metered", ok.proceed === true && ok.metered === true);
check("and carries the id to settle", ok.proceed === true && ok.requestId === ID);

const no = interpretReserve({ ok: false, reason: "daily-limit-reached", remaining: 0 }, ID);
check("the counted limit refuses", no.proceed === false);
check("and says which limit", no.proceed === false && no.reason === "daily-limit-reached");
check("and how many are left", no.proceed === false && no.remaining === 0);
/* A refusal with a missing remaining must not print undefined on screen. */
const noBare = interpretReserve({ ok: false, reason: "daily-limit-reached" }, ID);
check("a refusal with no count still gives a number",
  noBare.proceed === false && noBare.remaining === 0);

/* ── 3. The hold is settled, and settled correctly ───────────────────────── */
section("3. A slot is only spent on an answer worth showing");

check("a good answer finalizes", /finalizeGuidance\(id\)/.test(API));
check("a thrown error gives the slot back", /giveBack\(RELEASE_REASONS\.FAILED\)/.test(API));
/* AN INCOMPLETE ANSWER IS NOT ONE OF YOUR THREE. It renders as an error, and
   charging somebody for an error is the small unfairness nobody reports and
   everybody remembers. */
check("an incomplete answer gives the slot back",
  /if \(!isCompleteResult\(result\)\) \{[\s\S]{0,200}?giveBack\(RELEASE_REASONS\.MALFORMED\)/.test(API));
check("the release is awaited before the error reaches the page",
  /await giveBack\(RELEASE_REASONS\.FAILED\);\s*throw err;/.test(API));
/* The hold is cleared before settling so a second settle cannot double count. */
check("a hold cannot be settled twice",
  /held = null;[\s\S]{0,120}?releaseGuidance\(id, why\)/.test(API) &&
  /held = null;[\s\S]{0,120}?finalizeGuidance\(id\)/.test(API));
check("settling never breaks the answer",
  (API.match(/catch \(e\) \{ \/\* the answer matters more \*\//g) || []).length === 1);

check("release reasons are named, not typed at each call site",
  RELEASE_REASONS.FAILED === "failed" && RELEASE_REASONS.MALFORMED === "malformed");
/* usage.ts counts exactly these two as failures. A caller inventing a third
   would land in the wrong bucket silently. */
check("and the two failure reasons match what usage.ts counts",
  /args\.reason === "failed" \|\| args\.reason === "malformed"/.test(USAGE));

/* ── 4. Request ids ──────────────────────────────────────────────────────── */
section("4. Each request holds its own slot");

const ids = new Set(Array.from({ length: 200 }, () => newRequestId()));
check("ids do not collide", ids.size === 200);
check("ids are non-empty strings", [...ids].every((i) => typeof i === "string" && i.length > 6));

/* ── 5. The limit is not an error ────────────────────────────────────────── */
section("5. The one screen that tells somebody no");

const err = new GuidanceLimitError("daily-limit-reached", 0);
check("the refusal is its own error class", isGuidanceLimit(err));
check("an ordinary error is not mistaken for it", !isGuidanceLimit(new Error("API error: 500")));
check("nor is a null", !isGuidanceLimit(null));
check("it carries the reason", err.reason === "daily-limit-reached");

/* Told apart by CLASS, not by matching a message, so the page cannot break when
   the wording changes. */
check("the page tells them apart by class", /isGuidanceLimit\(err\)/.test(TODAY));
check("the limit gets its own view, not the error view",
  /id="resultsLimit"/.test(TODAY) && /resultsLimit\.hidden = false/.test(TODAY));
check("and is not logged as a failure",
  /if \(isGuidanceLimit\(err\)\) \{[\s\S]{0,260}?\} else \{[\s\S]{0,120}?console\.error/.test(TODAY));
/* A "Try again" button that cannot work is worse than no button. */
const LIMIT_VIEW = (TODAY.match(/<div id="resultsLimit"[\s\S]*?<\/div>\s*<\/div>/) || [""])[0];
check("the limit view exists", LIMIT_VIEW.length > 100);
check("it offers no Try again", !/id="tryAgain"/.test(LIMIT_VIEW));
/* The ways out that cost nothing come first; the plan is last and quiet. */
check("it points at the Word first", LIMIT_VIEW.indexOf('href="/word"') < LIMIT_VIEW.indexOf('href="/pricing"'));
check("and at the Vault before the plan", LIMIT_VIEW.indexOf('href="/vault"') < LIMIT_VIEW.indexOf('href="/pricing"'));
check("the plan line is not a button", !/class="btn[^"]*"[^>]*href="\/pricing"/.test(LIMIT_VIEW));
check("the view is hidden when a new request starts", /resultsLimit\.hidden = true/.test(TODAY));

/* ── 6. Both languages ───────────────────────────────────────────────────── */
section("6. It says the same thing in Spanish");

for (const k of ["limitTitle", "limitDesc", "limitWord", "limitVault", "limitPlusNote", "limitPlusCta"]) {
  check(`today.${k} has English in the markup`, new RegExp('data-i18n="today\\.' + k + '"').test(TODAY));
  check(`today.${k} is translated`, new RegExp("'today\\." + k + "':").test(I18N));
}
/* Locked brand rules, on a screen somebody reaches while struggling. */
const ES_LIMIT = (I18N.match(/'today\.limit[\s\S]{0,900}?'today\.limitPlusCta':[^\n]*/) || [""])[0];
check("the Spanish limit copy uses no em or en dash", !/[—–]/.test(ES_LIMIT));
const EN_LIMIT = (TODAY.match(/id="resultsLimit"[\s\S]*?rlimit-plus[\s\S]{0,400}?<\/p>/) || [""])[0];
check("the English limit copy uses no em or en dash", !/[—–]/.test(EN_LIMIT));

/* ── 7. Guests are untouched ─────────────────────────────────────────────── */
section("7. The front door stays open");

/* GUEST.gentleGuidanceDaily is 0 with a comment saying sign-in should come
   first. That is a product decision nobody has taken, and this wiring does NOT
   take it: a signed-out reader never reaches the meter at all, because
   convex-data's authenticated wrappers return null without a session, and null
   proceeds. Recorded here so a future reader knows the 0 is unenforced ON
   PURPOSE and not by oversight. */
check("the catalog still says guests get zero", /gentleGuidanceDaily: 0/.test(CATALOG));
/* The authenticated wrapper is what makes the guest case automatic: runMutation
   goes through authed(), which returns null without a session, so a signed-out
   reader never reaches convex/usage.ts at all. Asserted for all three so none
   can be quietly switched to an unauthenticated path later. */
for (const fn of ["reserveGuidance", "finalizeGuidance", "releaseGuidance"]) {
  const body = (DATA.match(new RegExp("export async function " + fn + "[\\s\\S]{0,240}?\\n\\}")) || [""])[0];
  check(`${fn} goes through the authenticated wrapper`,
    /\(await ensure\(\)\) \? runMutation/.test(body) && /: null;/.test(body));
}
check("so a signed-out reader is never refused",
  interpretReserve(null, ID).proceed === true);
check("the feature name is the one usage.ts meters",
  GUIDANCE_FEATURE === "gentle_guidance");

/* ── 7b. Every stated limit matches the catalog ──────────────────────────
 *
 * WHY THIS EXISTS. The Journey cap moved from 2 to 3 on 2026-08-27, and the
 * number is written out in EIGHT places across two languages: the Free card,
 * the comparison table, the sign-up welcome, and two preview fixtures. Nothing
 * tied any of them to convex/entitlementCatalog.ts, so the page could have gone
 * on promising two while the product allowed three, and no test would have
 * noticed. A limit that is enforced and a limit that is advertised drifting
 * apart is the exact failure this whole workstream started from.
 *
 * Read from the catalog rather than typed here, so raising it again is one
 * edit and this fails until every reader is updated. */
section("7b. The advertised limits match the enforced ones");

const FREE_BLOCK = (CATALOG.match(/const FREE: TierDefinition = \{[\s\S]*?\n\};/) || [""])[0];
const guidanceLimit = Number((FREE_BLOCK.match(/gentleGuidanceDaily: (\d+)/) || [])[1]);
const journeyLimit = Number((FREE_BLOCK.match(/activeJourneys: (\d+)/) || [])[1]);
check("the catalog states a guidance limit", Number.isInteger(guidanceLimit) && guidanceLimit > 0);
check("the catalog states a journey limit", Number.isInteger(journeyLimit) && journeyLimit > 0);

const PRICING = read("src/pages/pricing.astro");
const BILLING_PAGE = read("src/pages/billing.astro");
const SCHEDULE = read("convex/dunningSchedule.ts");

/* The Free card, both languages. */
check("the Free card advertises the enforced guidance limit",
  new RegExp('plans\\.freeF2">' + guidanceLimit + ' Gentle Guidance').test(PRICING));
check("the Free card advertises the enforced journey limit",
  new RegExp('plans\\.freeF3">' + journeyLimit + ' Journeys open at a time').test(PRICING));
check("and in Spanish", new RegExp("'plans\\.freeF3': '" + journeyLimit + " Caminos abiertos a la vez").test(I18N));
check("Spanish guidance matches too",
  new RegExp("'plans\\.freeF2': '" + guidanceLimit + " respuestas").test(I18N));

/* The comparison table. */
check("the comparison table states the enforced journey limit",
  new RegExp('plans\\.rActiveFree">' + journeyLimit + '<').test(PRICING));
check("and in Spanish", new RegExp("'plans\\.rActiveFree': '" + journeyLimit + "'").test(I18N));
check("the comparison table states the enforced guidance limit",
  new RegExp('plans\\.rGuidanceFree">' + guidanceLimit + ' a day').test(PRICING));

/* The sign-up welcome, which is the first place a new account hears either
   number and therefore the worst place for a stale one. */
check("the sign-up welcome states both enforced limits",
  new RegExp('You have ' + guidanceLimit + ' Gentle Guidance responses a day and ' +
    journeyLimit + ' Journeys open at a time').test(SCHEDULE));
check("and in Spanish",
  new RegExp('Tienes ' + guidanceLimit + ' respuestas de Guía Suave al día y ' +
    journeyLimit + ' Caminos abiertos a la vez').test(SCHEDULE));

/* The development preview fixtures. A fixture showing a limit the product no
   longer has is how a stale screenshot becomes a stale decision. */
for (const [name, src] of [["pricing", PRICING], ["billing", BILLING_PAGE]] as const) {
  check(`the ${name} preview fixture matches the catalog`,
    new RegExp('gentleGuidanceToday: ' + guidanceLimit +
      ', activeJourneySlots: ' + journeyLimit).test(src));
}

/* And nothing anywhere still advertises the OLD number. Written as a scan for
   any journey count that is not the enforced one, so this keeps working the
   next time it moves rather than only catching the 2 it was written for. */
for (const [name, src] of [["pricing.astro", PRICING], ["i18n-strings.js", I18N],
                            ["dunningSchedule.ts", SCHEDULE]] as const) {
  const stale = (src.match(/(\d+) (?:Journeys open at a time|Caminos abiertos a la vez)/g) || [])
    .filter((m) => Number(m.match(/\d+/)![0]) !== journeyLimit);
  check(`${name} advertises no other journey count`, stale.length === 0);
}

/* ── 7c. The Journey cap means what a slot counts ────────────────────────
 *
 * THE BUG THIS CLOSES. journey.astro sent `<id>:<seed>` as the slot id, and
 * beginJourney() re-rolls the seed on every start. doStart is idempotent per
 * journeyId, so a restart of the SAME Journey arrived under a new id and
 * claimed a SECOND slot, which nothing ever released. The cap counted RESTARTS.
 *
 * And the client has only ever shown ONE Journey at a time: beginJourney sets
 * the previous one aside. So "Journeys active at once" described an experience
 * nobody has had. A slot counts a Journey somebody began and did not finish,
 * and the copy now says exactly that. */
section("7c. The Journey cap counts open Journeys, not restarts");

const JOURNEY = read("src/pages/journey.astro");
const SLOTS = read("convex/journeySlots.ts");

check("the slot id carries no seed", /function slotId\(\) \{[\s\S]{0,400}?return active\.id;/.test(JOURNEY));
check("and the seeded form is gone", !/return active\.id \+ ':' \+ \(active\._seed/.test(JOURNEY));
/* Rows the old client wrote must be collapsed, or they count forever and can
   never be released, because release resolves by the id the client now sends. */
check("old seeded rows have a migration",
  /export const normalizeSlotIdsInternal = internalMutation/.test(SLOTS));
check("the migration is bounded and resumable",
  /\.paginate\(\{ cursor:/.test(SLOTS) && /continueCursor/.test(SLOTS));
check("it keeps the most alive status", /STATUS_RANK/.test(SLOTS));

/* THE ORDER THAT MAKES THE REFUSAL SAFE. beginJourney sets the old Journey
   aside, re-rolls the plan and clears the lock before it would ever reach
   slotStart. Refusing after that has destroyed what it refused to replace. */
check("the slot is claimed before anything local moves",
  JOURNEY.indexOf("claimSlot(id).then(") < JOURNEY.indexOf("function commitPreview("));
check("and beginJourney is only reached on success",
  /commitPreview\(id, seed\);[\s\S]{0,80}?\}\);/.test(JOURNEY));
/* Only a stated refusal stops anybody: a signed-out reader or an unreachable
   backend must not block somebody planting a Journey. */
check("the refusal is named, not inferred",
  /verdict\.reason === 'active-journey-limit'/.test(JOURNEY));
check("a null verdict proceeds",
  /verdict && verdict\.ok === false && verdict\.reason === 'active-journey-limit'/.test(JOURNEY));

/* The sheet. Free ways out first, Plus last and never a button. */
const SHEET = (JOURNEY.match(/<div class="sheet" id="openSheet"[\s\S]*?<\/div>\s*<!-- choose-struggle sheet -->/) || [""])[0];
check("the still-open sheet exists", SHEET.length > 200);
check("it offers to continue one", /journey\.openContinue/.test(JOURNEY));
check("and to let one go", /journey\.openLetGo/.test(JOURNEY));
check("letting go archives the slot rather than deleting anything",
  /slotArchive\(c\.id\)/.test(JOURNEY) && /journeyRelease\(journeyId, 'archived'\)/.test(JOURNEY));
check("Plus comes after both free ways out",
  SHEET.indexOf('journey.openContinue') === -1 || // built in script, not markup
    SHEET.indexOf('journey.openPlusNote') > SHEET.indexOf('journey.openKeep'));
check("the Plus line is not a button", !/class="btn[^"]*"[^>]*href="\/pricing"/.test(SHEET));
/* Hopkins: specifics are believed, generalities roll off. The offer names the
   price and the trial rather than sending somebody away to find out. */
check("the Plus line names the price and the trial",
  /\$8\.99 a month, and the first 7 days are free/.test(JOURNEY));
check("and in Spanish", /\$8\.99 al mes, y los primeros 7 días son gratis/.test(I18N));

/* The promise about what survives has to match what the code does.
   beginJourney clears the lock and the instance, so a Journey started again
   begins at day one. Saying otherwise would be a promise we break. */
check("it does not promise progress is resumed",
  !/resume|where you left|día 3|day 3/i.test(SHEET));
check("it promises only what the Vault actually keeps",
  /journey\.openKeep/.test(SHEET) && /begins it fresh, at day one/.test(JOURNEY));

for (const k of ["openH","openD","openContinue","openLetGo","openKeep","openBack","openPlusNote","openPlusCta"]) {
  check(`journey.${k} is translated`, new RegExp("'journey\\." + k + "':").test(I18N));
}
const ES_SHEET = (I18N.match(/'journey\.openH'[\s\S]{0,1200}?'journey\.openPlusCta':[^\n]*/) || [""])[0];
check("the Spanish sheet copy uses no em or en dash", !/[—–]/.test(ES_SHEET));
check("the English sheet copy uses no em or en dash", !/[—–]/.test(SHEET));

/* ── 7d. Every event fired is an event that survives ─────────────────────
 *
 * WHAT THIS CATCHES, AND IT HAD ALREADY HAPPENED TWICE.
 *
 * analytics.js is an allowlist: `track()` drops any event name not in ALLOWED,
 * silently, by design. That is the right failure mode for a privacy choke point
 * and a terrible one for a typo. The file's own comment records the first time
 * it bit: signin_completed was fired from auth-store.js for months and was
 * never listed, so every one of those events went nowhere.
 *
 * It bit again on 2026-08-27. `guidance_limit_reached` was added to today.astro
 * with the daily limit and never allowlisted, so the event measuring the whole
 * point of the limit was being dropped.
 *
 * So this asserts the relationship rather than either side of it: every event
 * name fired anywhere in src/ must appear in ALLOWED. Discovered by scanning,
 * so an event added next year is covered without anybody remembering to come
 * back here. */
section("7d. No fired event is silently dropped");

const ANALYTICS = read("src/app/declare/analytics.js");
const ALLOWED_BLOCK = (ANALYTICS.match(/const ALLOWED = \{[\s\S]*?\n\};/) || [""])[0];
check("the allowlist is readable", ALLOWED_BLOCK.length > 200);

/* Names on the left of a `:` inside ALLOWED, ignoring anything in a comment. */
const allowedNames = new Set(
  (ALLOWED_BLOCK.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
    .match(/^\s{2}([a-z][a-z0-9_]*):/gm) || [])
    .map((m) => m.trim().replace(":", "")),
);
check("the allowlist parsed to real names", allowedNames.size >= 12);

/* Every track('...') call across the app. */
const SOURCES: [string, string][] = [
  ["today.astro", read("src/pages/today.astro")],
  ["journey.astro", JOURNEY],
  ["pricing.astro", PRICING],
  ["billing.astro", BILLING_PAGE],
  ["auth-store.js", read("src/app/declare/auth-store.js")],
];
const fired = new Map<string, string>();
for (const [name, src] of SOURCES) {
  for (const m of src.matchAll(/\btrack\(\s*'([a-z][a-z0-9_]*)'/g)) {
    if (!fired.has(m[1])) fired.set(m[1], name);
  }
}
check("events are actually fired somewhere", fired.size >= 8);
for (const [event, where] of fired) {
  check(`${event} (fired in ${where}) is allowlisted`, allowedNames.has(event));
}

/* And the five that measure the limits are all present. */
for (const e of [
  "guidance_limit_reached",
  "journey_limit_reached",
  "journey_continue_selected",
  "journey_let_go_selected",
  "journey_upsell_selected",
]) {
  check(`${e} is allowlisted`, allowedNames.has(e));
}
/* Each one is reached, or the copy above is measuring nothing. */
check("the guidance limit is measured where it refuses",
  /isGuidanceLimit\(err\)[\s\S]{0,300}?track\('guidance_limit_reached'/.test(read("src/pages/today.astro")));
check("the journey limit is measured at the refusal, not after",
  JOURNEY.indexOf("track('journey_limit_reached'") < JOURNEY.indexOf("openSheet('openSheet')"));
check("letting one go is measured", /track\('journey_let_go_selected'/.test(JOURNEY));
check("continuing one is measured", /track\('journey_continue_selected'/.test(JOURNEY));
check("and the Plus click is measured on the way out",
  /openPlusLink[\s\S]{0,200}?track\('journey_upsell_selected'/.test(JOURNEY));

/* THE PRIVACY RULE HOLDS. The event layer exists to stop free text leaving, and
   the one new key that carries a struggle is bounded by the authored catalog. */
/* Tested against the KEYS, not the block: the block's comments legitimately
   mention "email" while describing that method is google or email. */
const ALLOWED_KEYS = new Set(
  (ALLOWED_BLOCK.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
    .match(/'[a-z][a-z0-9_]*'/g) || []).map((q) => q.replace(/'/g, "")),
);
check("the property keys parsed", ALLOWED_KEYS.size >= 10);
for (const banned of ["struggle_text", "raw_struggle", "reflection", "email", "user_id", "price_id"]) {
  check(`no event may carry ${banned}`, !ALLOWED_KEYS.has(banned));
}
check("journey_category is sent only from a catalog id",
  /journey_category: c\.id/.test(JOURNEY) && !/journey_category: [^c]/.test(JOURNEY));

/* ── 8. The policy stays executable ──────────────────────────────────────── */
section("8. The policy stays testable");

const POLICY = read("src/app/declare/guidance-quota.js");
check("guidance-quota imports no Convex client", !/convex\/browser|_generated/.test(POLICY));
check("and makes no network call", !/fetch\(/.test(POLICY));
/* The property is that it IMPORTS nothing, not that it never says the word:
   the header explains where the plumbing lives, and prose is not a dependency. */
check("the policy imports nothing at all",
  !/^\s*import\s/m.test(POLICY));
check("and declare-api is what wires the two together",
  /from '\.\/guidance-quota\.js'/.test(API) && /from '\.\/convex-data\.js'/.test(API));

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
