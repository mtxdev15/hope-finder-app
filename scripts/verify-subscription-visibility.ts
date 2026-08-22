/* Declare & Believe — persistent subscription visibility.
 *
 * WHAT THIS EXISTS TO PREVENT
 * The Portal smoke test returned a paying subscriber to /you and /you told them
 * nothing: no plan, no status, no route back into billing. Closing that gap
 * means three surfaces now render subscription state, and three surfaces
 * rendering the same response is exactly where the dangerous bugs live:
 *
 *   telling a cancelled subscriber their plan RENEWS
 *   telling a failing card it is ACTIVE
 *   telling a paying subscriber they are on FREE because a read failed
 *   offering a SECOND Checkout to somebody who already pays
 *
 * Each of those is a money or trust failure, not a cosmetic one. So the shared
 * decision module is IMPORTED and EXECUTED here rather than restated, and the
 * source assertions cover only what is genuinely structural.
 *
 * dist/ assertions need a build first:
 *   PUBLIC_BILLING_DEV_CONTROL=1 npx astro build && node scripts/verify-subscription-visibility.ts
 *
 * No network, no credential, no Stripe call, no Convex call, no Worker.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  planState,
  showsPlusBadge,
  showsManageBilling,
  mayStartCheckout,
  periodLabelKey,
  cadenceKey,
  formatPeriodEnd,
  planNameKey,
  STATE_LABEL_KEYS,
  PLAN_STATES,
} from "../src/app/declare/plan-display.js";
import { stateForEntitlement } from "../src/app/declare/checkout-return.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");
}

const ENTITLEMENTS = read("convex/entitlements.ts");
const YOU = read("src/pages/you.astro");
const SUCCESS = read("src/pages/checkout/success.astro");
const PRICING = read("src/pages/pricing.astro");
const CONVEX_DATA = read("src/app/declare/convex-data.js");
const I18N = read("public/declare/i18n-strings.js");

/* Realistic fixtures, shaped like what getMyEntitlements actually returns. */
const ACTIVE_MONTHLY = {
  tier: "plus", subscriptionStatus: "active", planKey: "plus_monthly",
  provider: "stripe", paymentNeedsAttention: false, duplicateProviders: false,
  periodEndAt: 1790020544000, cancelAtPeriodEnd: false, billingInterval: "month",
};
const ACTIVE_ANNUAL = { ...ACTIVE_MONTHLY, planKey: "plus_annual", billingInterval: "year" };
const CANCELLING = { ...ACTIVE_MONTHLY, cancelAtPeriodEnd: true };
const ATTENTION = { ...ACTIVE_MONTHLY, subscriptionStatus: "past_due", paymentNeedsAttention: true };
const AMBIGUOUS = { ...ACTIVE_MONTHLY, duplicateProviders: true };
const FREE = {
  tier: "free", subscriptionStatus: "none", planKey: null, provider: null,
  paymentNeedsAttention: false, duplicateProviders: false, periodEndAt: null,
  cancelAtPeriodEnd: false, billingInterval: null,
  remaining: { gentleGuidanceToday: 2, activeJourneySlots: 1 },
};

/* ── 1. The entitlement contract ─────────────────────────────────────────── */
section("1. The contract exposes lifecycle facts and no identifiers");

for (const field of ["periodEndAt", "cancelAtPeriodEnd", "billingInterval"]) {
  check(`Resolved declares "${field}"`, new RegExp(`\\n\\s+${field}[?]?:`).test(ENTITLEMENTS));
  check(`the query returns "${field}"`,
    new RegExp(`\\n\\s+${field}[,:]`).test(ENTITLEMENTS));
}
/* Every return path must carry them, including the signed-out guest shape —
 * a missing key there would make the guest response a different shape. */
check("the guest branch returns periodEndAt", /periodEndAt: null/.test(ENTITLEMENTS));
check("the guest branch returns cancelAtPeriodEnd", /cancelAtPeriodEnd: false/.test(ENTITLEMENTS));
check("the guest branch returns billingInterval", /billingInterval: null/.test(ENTITLEMENTS));

/* THE identifier ban, applied to code rather than comments. */
const ENT_CODE = stripComments(ENTITLEMENTS);
for (const banned of [
  "stripeCustomerId", "stripeSubscriptionId", "stripePriceId", "latestInvoiceId",
  "lastProviderEventId", "metadataUserId", "paymentMethod", "sessionId", "email",
]) {
  check(`the entitlement response never names "${banned}"`, !ENT_CODE.includes(banned));
}
/* The period comes from the winning row, converted to ms, and only while that
 * row grants Plus — otherwise a lapsed row leaves a stale renewal date. */
check("periodEndAt is milliseconds, converted from Stripe seconds",
  /currentPeriodEnd \* 1000/.test(ENTITLEMENTS));
check("periodEndAt is null unless the winner grants Plus",
  /winner\.verdict\.tier === "plus" && winner\.row\.currentPeriodEnd/.test(ENTITLEMENTS));
check("billingInterval is an enum, never a Price id",
  !/billingInterval[\s\S]{0,120}price/i.test(ENTITLEMENTS));

/* ── 2. The shared state machine, executed ───────────────────────────────── */
section("2. The shared display state machine");

check("active monthly -> plus-active", planState(ACTIVE_MONTHLY) === "plus-active");
check("active annual -> plus-active", planState(ACTIVE_ANNUAL) === "plus-active");
check("cancel-at-period-end -> plus-cancelling", planState(CANCELLING) === "plus-cancelling");
check("payment attention -> plus-attention", planState(ATTENTION) === "plus-attention");
check("two providers -> plus-ambiguous", planState(AMBIGUOUS) === "plus-ambiguous");
check("free -> free", planState(FREE) === "free");
check("guest -> guest", planState({ tier: "guest" }) === "guest");
check("loading is explicit", planState(ACTIVE_MONTHLY, { loading: true }) === "loading");

/* THE most important assertions in this file. */
check("a null response is UNAVAILABLE, never free", planState(null) === "unavailable");
check("undefined is UNAVAILABLE, never free", planState(undefined) === "unavailable");
check("a string is UNAVAILABLE, never free", planState("plus" as any) === "unavailable");
check("an unrecognised tier is UNAVAILABLE, never free",
  planState({ tier: "enterprise" }) === "unavailable");
check("attention OUTRANKS active — a failing card is never healthy",
  planState({ ...ACTIVE_MONTHLY, paymentNeedsAttention: true }) === "plus-attention");
check("an unknown status on Plus fails closed to attention",
  planState({ ...ACTIVE_MONTHLY, subscriptionStatus: "something_new" }) === "plus-attention");
check("ambiguity outranks a healthy-looking row",
  planState({ ...ACTIVE_MONTHLY, duplicateProviders: true }) === "plus-ambiguous");
check("every produced state is a declared state",
  [ACTIVE_MONTHLY, CANCELLING, ATTENTION, AMBIGUOUS, FREE, null, undefined]
    .every((e) => (PLAN_STATES as readonly string[]).includes(planState(e))));

/* ── 3. Cadence, dates and the renews/cancels word ───────────────────────── */
section("3. Cadence and the period-end wording");

check("monthly cadence key", cadenceKey(ACTIVE_MONTHLY) === "plan.monthly");
check("annual cadence key", cadenceKey(ACTIVE_ANNUAL) === "plan.annual");
check("no interval -> no cadence claim", cadenceKey(FREE) === null);
check("active says Renews", periodLabelKey("plus-active") === "plan.renews");
/* The bug this prevents: telling somebody who cancelled that it renews. */
check("cancelling says CANCELS, not Renews", periodLabelKey("plus-cancelling") === "plan.cancels");
check("attention makes no date claim", periodLabelKey("plus-attention") === null);
check("ambiguous makes no date claim", periodLabelKey("plus-ambiguous") === null);
check("free makes no date claim", periodLabelKey("free") === null);

check("a real timestamp formats", typeof formatPeriodEnd(1790020544000, "en") === "string");
check("Spanish formats differently from English",
  formatPeriodEnd(1790020544000, "es") !== formatPeriodEnd(1790020544000, "en"));
for (const junk of [null, undefined, 0, -1, NaN, "soon"]) {
  check(`no date invented from ${JSON.stringify(junk) ?? "undefined"}`,
    formatPeriodEnd(junk as any, "en") === null);
}

/* ── 4. Badge, billing entry and purchase gating ─────────────────────────── */
section("4. Badge, manage-billing and checkout gating");

check("active shows the badge", showsPlusBadge("plus-active") === true);
check("cancelling still shows the badge", showsPlusBadge("plus-cancelling") === true);
check("attention KEEPS the identity badge", showsPlusBadge("plus-attention") === true);
check("free NEVER shows the badge", showsPlusBadge("free") === false);
check("guest never shows the badge", showsPlusBadge("guest") === false);
check("loading never shows the badge", showsPlusBadge("loading") === false);
check("unavailable never shows the badge", showsPlusBadge("unavailable") === false);
check("ambiguity does not earn a badge", showsPlusBadge("plus-ambiguous") === false);

for (const s of ["plus-active", "plus-cancelling", "plus-attention"]) {
  check(`${s} offers manage billing`, showsManageBilling(s) === true);
}
for (const s of ["free", "guest", "loading", "unavailable"]) {
  check(`${s} offers no manage billing`, showsManageBilling(s) === false);
}

/* Fail-closed purchasing. A failed read must never unlock a purchase. */
check("free may start checkout", mayStartCheckout("free") === true);
check("guest may start checkout", mayStartCheckout("guest") === true);
for (const s of ["plus-active", "plus-cancelling", "plus-attention", "plus-ambiguous", "loading", "unavailable"]) {
  check(`${s} may NOT start checkout`, mayStartCheckout(s) === false);
}

/* Labels are keys, never raw enums. */
check("plus states use the Plus name key", planNameKey("plus-active") === "plan.plusName");
check("free uses the free name key", planNameKey("free") === "plan.freeName");
for (const raw of ["plus_monthly", "plus_annual", "past_due", "cancel_at_period_end", "incomplete_expired"]) {
  check(`no label is the raw enum "${raw}"`,
    !Object.values(STATE_LABEL_KEYS).includes(raw));
}

/* ── 5. Checkout success ─────────────────────────────────────────────────── */
section("5. Checkout success");

check("welcome copy exists", /data-i18n="checkout\.welcomePlusT"/.test(SUCCESS));
check("welcome names Declare Plus", /Welcome to Declare Plus/.test(SUCCESS));
check("it links to the account plan anchor", /href="\/you#plan-billing"/.test(SUCCESS));
check("the continue action is present", /data-i18n="checkout\.continueToDeclare"/.test(SUCCESS));
check("the view-my-plan action is present", /data-i18n="checkout\.viewMyPlan"/.test(SUCCESS));
check("the cadence line exists", /id="corCadence"/.test(SUCCESS));
check("cadence renders only in the confirmed branch",
  /state === 'confirmed'[\s\S]{0,60}renderCadence\(ent\)/.test(SUCCESS));

/* Welcome must be reachable ONLY through Convex confirmation. */
check("welcome copy lives inside the confirmed section",
  SUCCESS.indexOf('id="stConfirmed"') < SUCCESS.indexOf("checkout.welcomePlusT") &&
  SUCCESS.indexOf("checkout.welcomePlusT") < SUCCESS.indexOf('id="stAttention"'));
check("confirmation still comes from getMyEntitlements",
  /myEntitlements\(\)/.test(SUCCESS));
check("no price is duplicated onto the success page", !/\$\d/.test(SUCCESS));

/* Executed: which entitlement responses may show the welcome. */
check("active confirms", stateForEntitlement(ACTIVE_MONTHLY) === "confirmed");
check("annual confirms", stateForEntitlement(ACTIVE_ANNUAL) === "confirmed");
check("cancelling still confirms — they paid for the period",
  stateForEntitlement(CANCELLING) === "confirmed");
check("payment attention NEVER confirms", stateForEntitlement(ATTENTION) === "attention");
check("ambiguity NEVER confirms", stateForEntitlement(AMBIGUOUS) === "attention");
check("free never confirms", stateForEntitlement(FREE) === "pending");
check("a null read never confirms", stateForEntitlement(null) === "pending");

/* The original security model, unchanged. */
const SUCCESS_CODE = stripComments(SUCCESS);
check("session_id is still only detected, never read for a decision",
  /searchParams\.has\('session_id'\)/.test(SUCCESS_CODE));
check("session_id is stripped from the visible URL",
  /searchParams\.delete\('session_id'\)[\s\S]{0,160}history\.replaceState/.test(SUCCESS_CODE));
check("session_id is never assigned to a variable",
  !/=\s*[^\n]*searchParams\.get\('session_id'\)/.test(SUCCESS_CODE));
check("session_id never reaches the DOM or storage",
  !/session_id[^\n]*(textContent|innerHTML|localStorage|sessionStorage|fetch)/.test(SUCCESS_CODE));
check("polling stays single-flight", /inFlight/.test(SUCCESS_CODE));
check("polling stays bounded", /pollExhausted\(attempts\)/.test(SUCCESS_CODE));
check("the success page creates no Checkout or Portal session",
  !/createCheckoutSession|createPortalSession/.test(SUCCESS_CODE));

/* ── 6. The /you Plan & Billing card ─────────────────────────────────────── */
section("6. The persistent Plan & Billing section");

check("the stable anchor exists", /id="plan-billing"/.test(YOU));
/* UPDATED for the account redesign. This matched the plan card being ITSELF a
 * <section class="pbcard">. It is now a labelled <section> containing an <h2>
 * and the card, which is stronger semantics, not weaker: the heading is real
 * text in the outline rather than an aria-label on a card. The property —
 * "the plan lives in a real, headed, labelled section" — is asserted directly. */
check("the plan card sits inside a labelled section",
  /<section class="ysec" aria-labelledby="yPlanH">[\s\S]{0,400}id="plan-billing"/.test(YOU));
check("that section carries a real heading element",
  /<h2 class="ysec-h serif" id="yPlanH"[^>]*>/.test(YOU));
check("the card is still labelled by its plan name",
  /id="plan-billing"[^>]*aria-labelledby="pbTitle"/.test(YOU));
check("it is not behind a developer flag",
  !/import\.meta\.env\.DEV[\s\S]{0,400}plan-billing/.test(YOU));
check("it reads the normal entitlement query", /myEntitlements/.test(YOU));
check("it renders through the shared helper", /planState\(ent, opts\)/.test(YOU));

const YOU_CODE = stripComments(YOU);
/* Loading must never render Free. */
check("loading is rendered before the read, not Free",
  /pbRender\(null, \{ loading: true \}\)[\s\S]{0,200}await myEntitlements\(\)/.test(YOU_CODE));
check("a failed read renders the response, which is 'unavailable'",
  /catch \(e\) \{ ent = null; \}\s*\n\s*pbRender\(ent\)/.test(YOU_CODE));

/* Manage billing: click-only, single-flight, empty payload. */
check("manage billing is bound to a click, not page load",
  /addEventListener\('click', \(\) => onClick\(b\)\)/.test(YOU_CODE));
check("the portal call is single-flight", /if \(pbPortalBusy\) return;/.test(YOU_CODE));
check("the button disables before the request",
  /btn\.disabled = true;[\s\S]{0,120}await openBillingPortal\(\)/.test(YOU_CODE));
check("no Portal call happens at page load",
  !/openBillingPortal\(\)[^\n]*\n[\s\S]{0,40}pbLoad\(\)/.test(YOU_CODE));

/* The wrapper is where the empty payload is enforced. */
check("openBillingPortal sends an EMPTY payload",
  /createPortalSession, \{\}\)/.test(CONVEX_DATA));
const PORTAL_FN = CONVEX_DATA.slice(CONVEX_DATA.indexOf("export async function openBillingPortal"));
for (const banned of ["customer", "userId", "email", "subscription", "price", "return_url"]) {
  check(`the portal wrapper sends no "${banned}"`,
    !PORTAL_FN.slice(0, 200).includes(banned));
}
check("the browser cannot supply a Customer id anywhere on /you",
  !/cus_|stripeCustomerId|customerId/.test(YOU_CODE));

/* Each state's copy. */
check("the card can show ACTIVE", /'plan\.stateActive'/.test(YOU));
check("the cancelling state has its own message", /'plan\.cancellingMsg'/.test(YOU));
check("the attention state has its own message", /'plan\.attentionMsg'/.test(YOU));
check("the ambiguous state has its own message", /'plan\.ambiguousMsg'/.test(YOU));
check("the unavailable state has its own message", /'plan\.unavailableMsg'/.test(YOU));
check("free shows remaining Gentle Guidance", /gentleGuidanceToday/.test(YOU));
check("free shows remaining Journey slots", /activeJourneySlots/.test(YOU));
check("free offers upgrade to the existing pricing route",
  /pbLink\(pbTx\('plan\.upgrade'\), '\/pricing'\)/.test(YOU));
check("unavailable offers retry, not upgrade",
  /state === 'unavailable'[\s\S]{0,120}'plan\.retry'/.test(YOU));
check("benefits are listed", /'plan\.b1'/.test(YOU) && /'plan\.b3'/.test(YOU));

/* The badge. */
check("the badge markup exists", /id="yPlusBadge"/.test(YOU));
check("the badge is hidden by default", /id="yPlusBadge" hidden/.test(YOU));
check("the badge has an accessible label", /aria-label="Declare Plus subscriber"/.test(YOU));
check("the badge visibility comes from the shared helper",
  /els\.badge\.hidden = !showsPlusBadge\(state\)/.test(YOU));
check("the badge says PLUS, never Active", />PLUS</.test(YOU));
/* Applied to CODE, not comments: the comments above the badge say "No crown",
 * and failing the file for documenting its own restraint would be absurd. */
check("no crown or trophy glyph is used", !/crown|👑|🏆|trophy/i.test(YOU_CODE));

/* ── 7. Pricing reflects the current plan ────────────────────────────────── */
section("7. Pricing reflects the authenticated current plan");

check("the free card can be marked current", /id="pcFreeCur"/.test(PRICING));
check("the plus card can be marked current", /id="pcPlusCur"/.test(PRICING));
check("free marker copy exists", /data-i18n="pricing\.currentPlan"/.test(PRICING));
check("plus marker copy exists", /data-i18n="pricing\.yourCurrentPlan"/.test(PRICING));
check("a subscriber gets a manage link to the account anchor",
  /id="pcPlusManage"[^>]*href="\/you#plan-billing"/.test(PRICING));

const PRICING_CODE = stripComments(PRICING);
/* The page must stay non-transactional. */
check("pricing imports NO billing action",
  !/createCheckoutSession|createPortalSession|api\.billing/.test(PRICING_CODE));
check("the CTA is still disabled in the served markup", /disabled data-i18n="pricing\.plusCta"/.test(PRICING));
check("a subscriber's CTA is hidden, never enabled",
  /cta\.disabled = true; cta\.hidden = true;/.test(PRICING_CODE));
check("the CTA is never set to enabled anywhere", !/disabled = false/.test(PRICING_CODE));
/* Fail closed: an unresolved read changes nothing. */
check("loading/unavailable/guest return before any change",
  /if \(state === 'loading' \|\| state === 'unavailable' \|\| state === 'guest'\) return;/.test(PRICING_CODE));
/* Scoped to the SCRIPT. Comparing against the whole file would compare a markup
 * position to a script position, which proves nothing about execution order. */
const PRICING_SCRIPT = PRICING_CODE.slice(PRICING_CODE.indexOf("<script>"));
check("the fail-closed guard precedes any marker being revealed",
  PRICING_SCRIPT.indexOf("=== 'unavailable'") < PRICING_SCRIPT.indexOf("pcFreeCur") &&
  PRICING_SCRIPT.indexOf("=== 'unavailable'") < PRICING_SCRIPT.indexOf("pcPlusCur"));
check("the guard returns rather than falling through",
  /=== 'guest'\) return;/.test(PRICING_SCRIPT));
check("pricing shows real lifecycle instead of Active when not simply active",
  /state !== 'plus-active'[\s\S]{0,200}cancellingMsg/.test(PRICING_CODE));
check("pricing double-checks checkout gating with the shared helper",
  /!mayStartCheckout\(state\)/.test(PRICING_CODE));

/* ── 8. Localization parity ──────────────────────────────────────────────── */
section("8. English / Spanish parity");

const NEW_KEYS = [
  "plan.plusName", "plan.freeName", "plan.stateActive", "plan.stateCancelling",
  "plan.stateAttention", "plan.monthly", "plan.annual", "plan.renews", "plan.cancels",
  "plan.manage", "plan.upgrade", "plan.retry", "plan.cancellingMsg", "plan.attentionMsg",
  "plan.ambiguousMsg", "plan.unavailableMsg", "plan.b1", "plan.b2", "plan.b3",
  "you.planBillingH", "checkout.welcomePlusT", "checkout.welcomePlusD",
  "checkout.continueToDeclare", "checkout.viewMyPlan",
  "pricing.currentPlan", "pricing.yourCurrentPlan", "pricing.manageBilling",
];
for (const k of NEW_KEYS) {
  check(`"${k}" has Spanish`, new RegExp(`'${k.replace(".", "\\.")}':`).test(I18N));
}
check("renews and cancels are DIFFERENT in Spanish too",
  (I18N.match(/'plan\.renews': '([^']*)'/) || [])[1] !==
  (I18N.match(/'plan\.cancels': '([^']*)'/) || [])[1]);

/* ── 9. Accessibility and design hooks ───────────────────────────────────── */
section("9. Accessibility and design");

check("the card exposes a busy state while loading", /aria-busy/.test(YOU));
check("the card is labelled by its heading", /aria-labelledby="pbTitle"/.test(YOU));
check("the message line is a live region", /id="pbMsg" role="status"/.test(YOU));
check("status is a WORD, not colour alone", /els\.state\.textContent = pbTx\(stateKey\)/.test(YOU));
check("buttons meet the 44px target", /\.pb-btn \{[^}]*min-height: 44px/.test(YOU));
check("buttons have visible keyboard focus", /\.pb-btn:focus-visible \{[^}]*outline/.test(YOU));
check("the card uses existing surface tokens", /\.pbcard \{[^}]*var\(--surface\)/.test(YOU));
check("the badge uses existing accent tokens", /\.ybadge \{[^}]*var\(--goldd\)/.test(YOU));
check("no gradient decoration was added to the card", !/\.pbcard \{[^}]*gradient/.test(YOU));
check("no second navigation landmark was added", !/<nav[^>]*plan-billing/.test(YOU));

/* ── 10. No identifier reaches any normal UI ─────────────────────────────── */
section("10. No Stripe identifier in normal UI");

for (const [name, src] of [["you.astro", YOU_CODE], ["success.astro", SUCCESS_CODE], ["pricing.astro", PRICING_CODE]] as const) {
  for (const banned of ["cus_", "sub_1", "price_", "in_1", "evt_", "cs_test", "billing.stripe.com"]) {
    check(`${name} contains no "${banned}"`, !src.includes(banned));
  }
  check(`${name} names no Stripe identifier field`,
    !/stripeCustomerId|stripeSubscriptionId|stripePriceId|latestInvoiceId/.test(src));
}

/* ── 11. Production build ────────────────────────────────────────────────── */
section("11. Production build");

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
check("the build produced files", files.length > 0);
check("the account page ships the plan anchor",
  readFileSync(join(DIST, "you/index.html"), "utf8").includes('id="plan-billing"'));
check("the success page ships the welcome copy",
  readFileSync(join(DIST, "checkout/success/index.html"), "utf8").includes("Welcome to Declare Plus"));
check("pricing ships the current-plan markers",
  readFileSync(join(DIST, "pricing/index.html"), "utf8").includes('id="pcPlusCur"'));
/* The development billing controls must STILL be absent. */
check("dist/dev does not exist", !existsSync(join(DIST, "dev")));
for (const needle of ["createCheckoutSession", "Stripe sandbox", "dbGoAnnual", "dbPortal"]) {
  const hits = files.filter((f) => readFileSync(f, "utf8").includes(needle));
  check(`production contains no "${needle}"`, hits.length === 0);
}
/* createPortalSession DOES now ship — /you needs it. It must reach production
 * only through the wrapper that sends an empty payload. */
const portalFiles = files.filter((f) => readFileSync(f, "utf8").includes("createPortalSession"));
check("createPortalSession reaches production (the account page needs it)", portalFiles.length > 0);
for (const f of portalFiles) {
  const t = readFileSync(f, "utf8");
  const rel = f.slice(DIST.length + 1);
  check(`${rel} calls the portal with an empty payload`,
    /createPortalSession\s*,\s*\{\s*\}/.test(t) || /createPortalSession[^)]{0,40}\{\}/.test(t));
  check(`${rel} sends no customer identifier`, !/cus_|stripeCustomerId/.test(t));
}
for (const f of files) {
  const t = readFileSync(f, "utf8");
  check(`${f.slice(DIST.length + 1)} leaks no Stripe object id`,
    !/\bcus_[A-Za-z0-9]{6}|\bsub_[A-Za-z0-9]{6}|\bprice_[A-Za-z0-9]{6}/.test(t));
}

/* ── Result ──────────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
