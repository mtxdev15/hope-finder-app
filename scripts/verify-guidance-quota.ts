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
