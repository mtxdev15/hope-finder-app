/* Declare & Believe — the hybrid /you account experience.
 *
 * WHY THIS EXISTS
 * The first visual verification of the subscription work STOPPED because the
 * Plus identity badge computed as gold: text #9A7A24 (--goldd) on a #C9A84C
 * (--gold) border and fill. That was not a taste problem. Gold is the reward
 * colour, and using it for paid identity conflates two different things:
 *
 *     PLUS      says who you are      (membership)
 *     ACTIVE    says how billing is   (lifecycle)
 *
 * A gold trinket beside someone's name reads as a prize, and it also implies
 * health that the badge is explicitly not allowed to claim -- a subscriber
 * whose payment needs attention still keeps the badge.
 *
 * So this suite locks three things that are easy to regress by accident:
 * the badge is not gold, the account hierarchy puts identity and plan first,
 * and Your Formation never becomes a scoreboard.
 *
 * dist/ assertions need a build first:
 *   PUBLIC_BILLING_DEV_CONTROL=1 npx astro build && node scripts/verify-account-profile-hybrid.ts
 *
 * No network, no credential, no Stripe call, no Convex call, no Worker.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { planState, showsPlusBadge } from "../src/app/declare/plan-display.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
}

const YOU = read("src/pages/you.astro");
const YOU_CODE = stripComments(YOU);
const I18N = read("public/declare/i18n-strings.js");
/* Markup only — everything before the client <script>. */
const MARKUP = YOU.slice(0, YOU.indexOf("<script>"));
const STYLE = YOU.slice(YOU.indexOf("<style"));

/* ── 1. The badge is not gold ────────────────────────────────────────────── */
section("1. The Plus badge is a membership marker, and it is NOT gold");

/* .yplus, NOT .ybadge: that class belongs to the church-finder "Home" marker,
 * which is gold and sits later in the stylesheet. Asserting on .ybadge would
 * pass against a rule the browser never applies to this element. */
const BADGE_RULE = (STYLE.match(/\.you \.yplus \{[\s\S]*?\}/) || [])[0] || "";
check("the Plus badge does NOT reuse the church-finder .ybadge class",
  !/<span class="ybadge"[^>]*id="yPlusBadge"/.test(MARKUP));
check("the church-finder Home badge is left untouched",
  /\.you \.ybadge\.home \{/.test(STYLE));
check("the badge rule can be located", BADGE_RULE.length > 0);
/* The exact values the first visual pass rejected. */
for (const banned of ["--goldd", "var(--gold)", "#C9A84C", "#9A7A24", "C9A84C", "9A7A24"]) {
  check(`the badge rule does not use "${banned}"`, !BADGE_RULE.includes(banned));
}
check("the badge rule uses a neutral/forest text token", /color: var\(--text\)/.test(BADGE_RULE));
check("the badge border is a hairline token", /border: 1px solid var\(--line2\)/.test(BADGE_RULE));
/* Ornamentation bans. */
for (const banned of ["gradient", "box-shadow", "filter:", "text-shadow"]) {
  check(`the badge rule has no "${banned}"`, !BADGE_RULE.includes(banned));
}
check("the badge is 22-24px high", /height: 2[2-4]px/.test(BADGE_RULE));
check("the badge type is 10-11px", /font-size: 1[01]px/.test(BADGE_RULE));
check("the badge weight is medium or semibold", /font-weight: [56]00/.test(BADGE_RULE));
check("the badge tracking is restrained", /letter-spacing: \.(0[5-9]|1[0-2])?e?m?/.test(BADGE_RULE));

const BADGE_EL = (MARKUP.match(/<span class="yplus"[\s\S]*?<\/span>/) || [])[0] || "";
check("the badge element can be located", BADGE_EL.length > 0);
check("the badge is hidden by default (never flashes before load)", /\bhidden\b/.test(BADGE_EL));
check("the badge has an accessible name", /aria-label="Declare Plus subscriber"/.test(BADGE_EL));
check("the badge text is PLUS", />PLUS</.test(BADGE_EL));
check("the badge never says Active", !/Active/i.test(BADGE_EL.replace(/aria-label="[^"]*"/, "")));
check("the badge carries no icon or svg", !/<svg|<img/.test(BADGE_EL));
for (const g of ["crown", "sparkle", "👑", "🏆", "✨", "⭐"]) {
  check(`the badge has no "${g}"`, !BADGE_EL.includes(g));
}
check("the badge sits beside the display name",
  /<h1 class="yname[\s\S]{0,400}<span class="yplus"/.test(MARKUP));

/* Executed: WHICH states show it. */
check("badge shows for active Plus", showsPlusBadge("plus-active") === true);
check("badge shows for cancelling Plus", showsPlusBadge("plus-cancelling") === true);
check("badge shows for payment attention (still a member)", showsPlusBadge("plus-attention") === true);
for (const s of ["free", "guest", "loading", "unavailable", "plus-ambiguous"]) {
  check(`badge hidden for "${s}"`, showsPlusBadge(s) === false);
}
check("badge visibility is driven by the shared helper",
  /els\.badge\.hidden = !showsPlusBadge\(state\)/.test(YOU_CODE));
check("loading resolves to a state that hides the badge",
  showsPlusBadge(planState({ tier: "plus" }, { loading: true })) === false);

/* ── 2. The account hierarchy ────────────────────────────────────────────── */
section("2. Identity, then plan, then formation, then settings");

const ORDER = [
  ["identity", 'class="ysec yident'],
  ["plan & billing", 'id="plan-billing"'],
  ["your formation", 'id="yFormation"'],
  ["account", 'id="yAccH"'],
  ["experience", 'id="yExpH"'],
  ["privacy & support", 'id="yHelpH"'],
  ["mobile app", 'id="yAppH"'],
  ["sign out", 'id="ySignOut"'],
] as const;
const idx = ORDER.map(([name, needle]) => ({ name, i: MARKUP.indexOf(needle) }));
for (const o of idx) check(`"${o.name}" is present`, o.i !== -1);
for (let i = 1; i < idx.length; i++) {
  check(`"${idx[i].name}" comes after "${idx[i - 1].name}"`, idx[i].i > idx[i - 1].i);
}
/* The two that matter most, stated directly. */
check("Plan & Billing is directly after identity, before any settings group",
  MARKUP.indexOf('id="plan-billing"') < MARKUP.indexOf('id="yAccH"'));
check("Your Formation is directly after Plan & Billing",
  MARKUP.indexOf('id="yFormation"') > MARKUP.indexOf('id="plan-billing"') &&
  MARKUP.indexOf('id="yFormation"') < MARKUP.indexOf('id="yAccH"'));
check("sign out is last and visually separated",
  /class="ysec ysec-end"/.test(MARKUP) &&
  MARKUP.indexOf('id="ySignOut"') > MARKUP.indexOf('id="yAppH"'));

/* Layout restraint. */
check("the content column is width-capped, not full bleed",
  /\.you \.yflow \{[^}]*width: min\(1040px/.test(STYLE));
check("the old two-column rail is gone", !/\.yrail|\.ygrid/.test(YOU));
check("no second navigation landmark was added",
  (MARKUP.match(/<nav\b/g) || []).length === (MARKUP.match(/aria-label="(Theme|Language)"/g) || []).length);

/* ── 3. Your Formation is reflective, not gamified ───────────────────────── */
section("3. Your Formation carries no gamification");

const FORM_FN = YOU_CODE.slice(YOU_CODE.indexOf("function yfRender"), YOU_CODE.indexOf("wireSignOut"));
check("the formation renderer can be located", FORM_FN.length > 0);
/* WORD BOUNDARIES, not substrings. A bare `.includes("xp")` matches
 * "experience" and a bare "rank" matches "frank" -- the live page check caught
 * exactly that false positive, so the suite must not repeat it. */
for (const banned of [
  "streak", "streaks", "xp", "score", "scores", "trophy", "trophies",
  "achievement", "achievements", "leaderboard", "rank", "ranking", "points",
]) {
  check(`formation has no "${banned}"`, !new RegExp(`\\b${banned}\\b`, "i").test(FORM_FN));
}
check("formation renders no percentage of spiritual growth", !/%/.test(FORM_FN));
for (const guilt of ["missed", "you didn't", "don't lose", "keep your streak", "broken"]) {
  check(`formation has no guilt language "${guilt}"`, !FORM_FN.toLowerCase().includes(guilt));
}
/* Data provenance: only keys and stores that already exist. */
check("formation reads the existing active-Journey key", /db_active_journey/.test(FORM_FN));
check("formation reads the existing rooted-Journey list", /db_journeys_done/.test(FORM_FN));
check("formation reads the existing vault store", /listItems\(\)/.test(FORM_FN));
check("formation adds no new backend aggregation",
  !/runQuery|myEntitlements|anyApi|convex/.test(FORM_FN));
/* Destinations must be routes that exist in this repo. */
const routes = [...FORM_FN.matchAll(/href: '([^']+)'/g)].map((m) => m[1]);
check("formation links to at least one destination", routes.length > 0);
for (const r of routes) {
  const clean = r.replace(/^\//, "").replace(/#.*$/, "");
  const exists = existsSync(join(ROOT, "src/pages", clean + ".astro")) ||
                 existsSync(join(ROOT, "src/pages", clean, "index.astro"));
  check(`formation destination "${r}" is a real route`, exists);
}
for (const invented of ["/journeys", "/saved", "/profile", "/settings", "/account"]) {
  check(`formation invents no "${invented}" route`, !routes.includes(invented));
}
/* No fabricated numbers: every count comes from a real length. */
check("saved count comes from the real vault length", /listItems\(\)\.length/.test(FORM_FN));
check("rooted count comes from the real done-list length",
  /Array\.isArray\(done\) \? done\.length : 0/.test(FORM_FN));
check("an empty state shows an invitation, not a zero",
  /formSaveFirst|formFruitNone|formBegin/.test(FORM_FN));

/* ── 4. Settings rows are real ───────────────────────────────────────────── */
section("4. Every settings row does something real");

for (const [group, id] of [["Account", "yAccH"], ["Experience", "yExpH"],
                           ["Privacy & Support", "yHelpH"], ["Mobile App", "yAppH"]] as const) {
  check(`the "${group}" group exists`, MARKUP.includes(`id="${id}"`));
}
/* Each row is a link to a real route, a wired control, or visibly disabled. */
/* Match ROWS, not the .yrows container -- "yrow" is a prefix of "yrows", so an
 * unanchored match swept up the wrapper and reported it as a dead end. */
const rows = [...MARKUP.matchAll(/<(a|button|div) class="yrow(?![a-z])[^"]*"([^>]*)>/g)];
check("rows were found", rows.length > 0);
let deadRows = 0;
const deadDetail: string[] = [];
for (const m of rows) {
  const whole = m[0];          // includes the class attribute
  const attrs = m[2];          // everything after class="..."
  const hasHref = /href="[^"]+"/.test(attrs);
  const hasId = /id="[^"]+"/.test(attrs);
  const isDisabled = /\bdisabled\b/.test(attrs);
  /* yrow-static lives in the CLASS attribute, which is outside the attrs
   * capture — test the whole tag, or the two static preference rows read as
   * dead ends when they are simply rows that host a control. */
  const isStatic = /yrow-static/.test(whole);
  if (!(hasHref || hasId || isDisabled || isStatic)) { deadRows++; deadDetail.push(whole.slice(0, 60)); }
}
check(`no dead-end row exists${deadDetail.length ? " (" + deadDetail.join(" | ") + ")" : ""}`, deadRows === 0);
check("the disabled row is marked for assistive tech", /aria-disabled="true"/.test(MARKUP));
check("Mobile app says Coming soon",
  /id="yMobileApp"[\s\S]{0,400}data-i18n="you\.soon"/.test(MARKUP));
/* Applied to comment-stripped markup: the comment above the row says "no QR",
 * and failing the file for documenting its own restraint would be absurd. */
const MARKUP_CODE = stripComments(MARKUP);
for (const fake of ["apps.apple.com", "play.google.com", "itunes.apple", "testflight", "QR"]) {
  check(`no fake store link "${fake}"`, !MARKUP_CODE.includes(fake));
}
check("sign out is wired to the real signOut()", /await signOut\(\)/.test(YOU_CODE));
check("sign out only appears when there is a session",
  /btn\.hidden = !\(isConfigured\(\) && isSignedIn\(\)\)/.test(YOU_CODE));

/* ── 5. Plan & Billing behaviour is unchanged ────────────────────────────── */
section("5. Billing behaviour is preserved exactly");

check("the stable anchor survives", /id="plan-billing"/.test(MARKUP));
check("status still lives in the plan card, not the badge",
  /els\.state\.textContent = pbTx\(stateKey\)/.test(YOU_CODE));
check("cancelling still says Cancels", /'plan\.cancels'/.test(YOU) );
check("manage billing is still single-flight", /if \(pbPortalBusy\) return;/.test(YOU_CODE));
check("manage billing still disables before the request",
  /btn\.disabled = true;[\s\S]{0,120}await openBillingPortal\(\)/.test(YOU_CODE));
check("no Portal call at page load",
  !/openBillingPortal\(\)[^\n]*\n[\s\S]{0,40}pbLoad\(\)/.test(YOU_CODE));
check("loading never renders Free",
  /pbRender\(null, \{ loading: true \}\)[\s\S]{0,200}await myEntitlements\(\)/.test(YOU_CODE));
for (const banned of ["cus_", "stripeCustomerId", "customerId", "sub_1", "price_", "bpc_"]) {
  check(`no "${banned}" anywhere on the page`, !YOU_CODE.includes(banned));
}

/* ── 6. Accessibility ────────────────────────────────────────────────────── */
section("6. Accessibility");

check("exactly one h1", (MARKUP.match(/<h1\b/g) || []).length === 1);
check("the h1 is the account identity", /<h1 class="yname serif" id="yName">/.test(MARKUP));
check("sections use h2 beneath it", (MARKUP.match(/<h2\b/g) || []).length >= 5);
check("every section is labelled", (MARKUP.match(/aria-labelledby="/g) || []).length >= 6);
check("rows meet the 44px target", /\.you \.yrow \{[^}]*min-height: 60px/.test(STYLE));
check("sign out meets the 44px target", /\.you \.ysignout \{[^}]*min-height: 44px/.test(STYLE));
check("rows show keyboard focus", /\.you \.yrow:focus-visible \{[^}]*outline/.test(STYLE));
check("formation cards show keyboard focus", /\.you \.yfcard:focus-visible \{[^}]*outline/.test(STYLE));
check("long emails wrap safely", /\.you \.yrole \{[^}]*overflow-wrap: anywhere/.test(STYLE));
check("reduced motion is honoured", /prefers-reduced-motion: reduce[\s\S]{0,300}\.you \.m-rise/.test(STYLE));
check("the session heading is available to screen readers", /class="ysec-h sr-only"/.test(MARKUP));
check("status is never colour alone — the chip carries a word",
  /pb-state[\s\S]{0,200}textContent/.test(YOU_CODE) || /els\.state\.textContent/.test(YOU_CODE));

/* ── 7. Localization ─────────────────────────────────────────────────────── */
section("7. English / Spanish parity");

for (const k of [
  "you.accountH", "you.experienceH", "you.privacySupportH", "you.mobileAppH",
  "you.mobileAppT", "you.formationH", "you.formationD", "you.formWalking",
  "you.formTruths", "you.formFruit", "you.privacy", "you.terms", "you.planRowD",
]) {
  check(`"${k}" has Spanish`, new RegExp(`'${k.replace(".", "\\.")}':`).test(I18N));
}

/* ── 8. Production output ────────────────────────────────────────────────── */
section("8. Production output");

const DIST = join(ROOT, "dist");
if (!existsSync(DIST)) {
  console.log("\ndist/ is missing. Build first:\n  PUBLIC_BILLING_DEV_CONTROL=1 npx astro build\n");
  process.exit(1);
}
function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if ([".html", ".js", ".css"].includes(extname(p))) acc.push(p);
  }
  return acc;
}
const files = walk(DIST);
const YOU_HTML = readFileSync(join(DIST, "you/index.html"), "utf8");
check("the account page ships the plan anchor", YOU_HTML.includes('id="plan-billing"'));
check("the account page ships the formation section", YOU_HTML.includes('id="yFormation"'));
check("the account page ships the mobile-app row", YOU_HTML.includes('id="yMobileApp"'));
check("the shipped badge markup carries no gold", !/ybadge[^>]*gold/i.test(YOU_HTML));
/* Development billing controls remain excluded. */
check("dist/dev does not exist", !existsSync(join(DIST, "dev")));
for (const needle of ["createCheckoutSession", "Stripe sandbox", "dbGoAnnual", "dbPortal", "dbInspect"]) {
  check(`production contains no "${needle}"`,
    files.filter((f) => readFileSync(f, "utf8").includes(needle)).length === 0);
}
/* No new public route. */
const routeCount = files.filter((f) => f.endsWith("index.html")).length;
check("no new public route was introduced", routeCount === 13);

/* ── Result ──────────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
