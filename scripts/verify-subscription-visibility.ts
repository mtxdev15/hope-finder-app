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
  currentPlanId,
  currentPlanCount,
  isCurrentPlan,
  planStatusKey,
  plusCtaIntent,
  freeCtaIntent,
  initialInterval,
  monthlyEquivalentCents,
  annualSavingPercent,
  PLAN_IDS,
  PRICING_ENABLED,
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
/* The plan card MOVED off /you to its own page. Billing management and
   plan comparison are different customer jobs; /you was a third surface
   rendering subscription state, and three readers of one fact is exactly
   how they end up disagreeing. These assertions moved with the markup
   they describe — none of them was dropped. */
const BILLING = read("src/pages/billing.astro");
const CONVEX_DATA = read("src/app/declare/convex-data.js");
const I18N = read("public/declare/i18n-strings.js");
const PLAN_DISPLAY = read("src/app/declare/plan-display.js");

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

/* A lifetime row has no lifecycle, so it must be decided BEFORE the
   subscription branches and never fall through to them. Falling through would
   be actively wrong rather than merely untidy: past_due grace is meaningless on
   a plan that never bills again, and an absent currentPeriodEnd would make the
   cancelAtPeriodEnd comparison silently pass. Source-asserted because
   entitlements.ts imports Convex and cannot be executed here. */
check("lifetime is interpreted before any subscription status branch",
  ENT_CODE.indexOf('planKey === "plus_lifetime"') > -1 &&
  ENT_CODE.indexOf('planKey === "plus_lifetime"') <
    ENT_CODE.indexOf("isFailingStatus(status)"));
check("lifetime grants Plus only on the paid status",
  /planKey === "plus_lifetime"[\s\S]{0,400}status === "paid"/.test(ENT_CODE));
check("an unrecognised lifetime status falls closed to free",
  /planKey === "plus_lifetime"[\s\S]{0,400}tier: "free"/.test(ENT_CODE));
check("lifetime claims no renewal date and no attention state",
  /planKey === "plus_lifetime"[\s\S]{0,400}needsAttention: false[\s\S]{0,120}graceEndsAt: null/
    .test(ENT_CODE));

/* ── 2. The shared state machine, executed ───────────────────────────────── */
section("2. The shared display state machine");

check("active monthly -> plus-active", planState(ACTIVE_MONTHLY) === "plus-active");
check("active annual -> plus-active", planState(ACTIVE_ANNUAL) === "plus-active");
check("cancel-at-period-end -> plus-cancelling", planState(CANCELLING) === "plus-cancelling");
check("payment attention -> plus-attention", planState(ATTENTION) === "plus-attention");
check("two providers -> plus-ambiguous", planState(AMBIGUOUS) === "plus-ambiguous");
check("free -> free", planState(FREE) === "free");

/* ── THE LAPSE: a failed payment whose grace window has expired ────────────
 *
 * THIS SUITE PASSED WHILE THIS WAS BROKEN, which is why the block is here.
 *
 * entitlements.ts:128 returns `{ tier: "free", needsAttention: true }` for a
 * past_due or unpaid subscription past its grace end. planState tested `tier`
 * FIRST and returned "free" before `paymentNeedsAttention` was ever read, so
 * the failure vanished: /billing said "You're using the essential Declare
 * experience", the Portal button disappeared with the rest of the billing
 * sections, and BLOCKS_NEW_CHECKOUT refused a fresh Checkout on exactly those
 * statuses. A subscriber whose card expired was silently downgraded and left
 * with no route back — not even a way to look at the unpaid invoice.
 *
 * Every check below is executed against the real module, and each one fails on
 * the old ordering. */
const LAPSED = {
  ...ACTIVE_MONTHLY,
  tier: "free",
  subscriptionStatus: "past_due",
  paymentNeedsAttention: true,
  remaining: { gentleGuidanceToday: 3, activeJourneySlots: 1 },
};

check("a free tier flagged for attention is a LAPSE, never plain free",
  planState(LAPSED) === "lapsed");
check("the lapse is its own state, not a re-use of attention",
  planState(LAPSED) !== "plus-attention" && PLAN_STATES.includes("lapsed"));

/* EVERY check below derives the state from the ENTITLEMENT rather than passing
   the literal "lapsed".
   Written the other way first, and it was nearly useless: removing the fix left
   18 of them still green, because they were asking what the machine does with a
   state it could no longer produce. Reading through planState makes each one
   fail the moment the lapse stops being detected — which is the only failure
   that matters. */
const LAPSED_STATE = planState(LAPSED);

/* THE FIX ITSELF. Without it the subscriber cannot reach the only place that
   can repair them, because a fresh Checkout is refused on past_due/unpaid. */
check("a lapsed subscriber can still reach billing management",
  showsManageBilling(LAPSED_STATE) === true);
check("and is offered the action that actually repairs it",
  plusCtaIntent(LAPSED_STATE) === "update-payment");

/* …while not being told they still have something they do not. */
check("a lapsed subscriber is not shown the Plus badge", showsPlusBadge(LAPSED_STATE) === false);
check("their current plan reads Free, truthfully", currentPlanId(LAPSED_STATE) === "free");
check("exactly one plan is current, as for every signed-in state",
  currentPlanCount(LAPSED_STATE) === 1);
check("the Plus card carries no badge for them", planStatusKey("plus", LAPSED_STATE) === null);
check("the Free card carries the lapse badge",
  planStatusKey("free", LAPSED_STATE) === "plan.stateLapsed");
check("no renewal or ending date is claimed", periodLabelKey(LAPSED_STATE) === null);
check("the plan name is Free, not Plus", planNameKey(LAPSED_STATE) === "plan.freeName");

/* A second Checkout is NOT the repair path: billing.ts refuses past_due and
   unpaid outright, so offering one would produce a dead button. */
check("a lapsed subscriber is never offered a purchase",
  mayStartCheckout(LAPSED_STATE) === false);
check("…including when purchasing is switched on",
  plusCtaIntent(LAPSED_STATE, true) !== "upgrade");

/* And the fix must not have widened into ordinary Free. A plain free account
   has never paid and has nothing to repair; showing it billing management
   would invent a subscription. */
check("a plain free account is still plain free", planState(FREE) === "free");
check("a plain free account is still offered no billing management",
  showsManageBilling("free") === false);
check("a plain free account may still start a checkout", mayStartCheckout("free") === true);

/* The ordering is the property. Asserted against source as well as behaviour,
   because a future edit could reintroduce the early return and still satisfy
   everything above by special-casing elsewhere. */
check("planState reads the attention flag BEFORE the tier shortcut",
  PLAN_DISPLAY.indexOf("=== 'lapsed'") > -1 &&
  PLAN_DISPLAY.indexOf("paymentNeedsAttention === true) return 'lapsed'") <
    PLAN_DISPLAY.indexOf("if (tier !== 'plus')"));

/* Still Plus while the grace window is open — the lapse must not swallow it. */
check("in-grace attention is unchanged and still grants Plus",
  planState({ ...LAPSED, tier: "plus" }) === "plus-attention");
check("in-grace still shows the Plus badge",
  showsPlusBadge(planState({ ...LAPSED, tier: "plus" })) === true);
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
check("it links to the Billing page", /href="\/billing"/.test(SUCCESS));
check("the continue action is present", /data-i18n="checkout\.continueToDeclare"/.test(SUCCESS));
check("the view-my-plan action is present", /data-i18n="checkout\.viewMyPlan"/.test(SUCCESS));
check("the cadence line exists", /id="corCadence"/.test(SUCCESS));
const CONFIRMED = SUCCESS.slice(
  SUCCESS.indexOf("state === 'confirmed'"),
  SUCCESS.indexOf("state === 'attention'"),
);
check("cadence renders only in the confirmed branch",
  CONFIRMED.length > 0 && /renderCadence\(ent\)/.test(CONFIRMED) &&
  (SUCCESS.match(/renderCadence\(ent\)/g) || []).length === 1);
/* A trial reaches 'confirmed' like any paid subscription, so the words are
   chosen here rather than by the state. "Your subscription is active" is false
   for somebody who has not been charged. */
check("a trial gets its own confirmation wording",
  /renderTrialOrPaid\(ent\)/.test(CONFIRMED) &&
  /checkout\.trialStartedT/.test(SUCCESS));
check("and it is decided from the entitlement, never from the URL",
  /ent && ent\.trialEndsAt/.test(SUCCESS) &&
  !/session_id[\s\S]{0,80}trial/i.test(SUCCESS));

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

/* ── 6. The Billing page ─────────────────────────────────────────────────── */
section("6. The focused Billing page");

check("the account page hands billing off instead of duplicating it",
  /href="\/billing"/.test(YOU) && !/openBillingPortal/.test(YOU));
check("the Billing page owns the plan card", /id="blPlan"/.test(BILLING));
/* UPDATED for the account redesign. This matched the plan card being ITSELF a
 * <section class="pbcard">. It is now a labelled <section> containing an <h2>
 * and the card, which is stronger semantics, not weaker: the heading is real
 * text in the outline rather than an aria-label on a card. The property —
 * "the plan lives in a real, headed, labelled section" — is asserted directly. */
check("the plan card sits inside a labelled section",
  /<section class="bl-card m-rise" id="blPlan" aria-labelledby="blPlanH"/.test(BILLING));
check("that section carries a real heading element",
  /<h2 class="bl-h" id="blPlanH"[^>]*>/.test(BILLING));
check("the page has exactly one h1", (BILLING.match(/<h1\b/g) || []).length === 1);
/* The PAGE is not dev-gated — it is a real customer route. The only DEV-gated
   thing on it is the state-preview fixture, which is asserted separately in
   verify-plans-billing-states.ts. */
check("the page itself is not behind a developer flag",
  !/getStaticPaths/.test(BILLING));
check("the plan card renders unconditionally",
  !/import\.meta\.env\.DEV[\s\S]{0,200}id="blPlan"/.test(BILLING));
/* Counted over CODE, not comments — the comment above the gate explains why
   DEV is the load-bearing half, and counting it would report two gates. */
check("only the preview fixture is developer-gated",
  (stripComments(BILLING).match(/import\.meta\.env\.DEV/g) || []).length === 1 &&
  /import\.meta\.env\.DEV && import\.meta\.env\.PUBLIC_PLANS_PREVIEW/.test(stripComments(BILLING)));
check("it reads the normal entitlement query", /myEntitlements/.test(BILLING));
check("it renders through the shared helper", /planState\(ent, opts\)/.test(BILLING));

const YOU_CODE = stripComments(YOU);
const BILLING_CODE = stripComments(BILLING);
/* Loading must never render Free. */
check("loading is rendered before the read, not Free",
  /render\(null, \{ loading: true \}\)[\s\S]{0,200}await myEntitlements\(\)/.test(BILLING_CODE));
check("a failed read renders the response, which is 'unavailable'",
  /catch \(e\) \{ ent = null; \} \}\s*\n\s*render\(ent\)/.test(BILLING_CODE));

/* Manage billing: click-only, single-flight, empty payload. */
check("manage billing is bound to a click, not page load",
  /addEventListener\('click', \(\) => onClick\(/.test(BILLING_CODE));

/* WHY THIS IS NO LONGER /if \(portalBusy\) return;/
   That matched one shared module-level flag, which was the correct design only
   while every state rendered exactly one action button. With Resume sitting
   beside Manage billing, one flag becomes a bug with no error message: clicking
   either latches it and the other silently does nothing. The guard is now keyed
   per action. The PROPERTY — a second click cannot fire the same request twice —
   is unchanged, so it is asserted directly instead of through the old shape. */
check("each billing action is single-flight",
  /if \(isBusy\('portal'\)\) return;/.test(BILLING_CODE) &&
  /if \(isBusy\('resume'\)\) return;/.test(BILLING_CODE));
check("the two actions do not share one in-flight flag",
  /const busy: Record<string, boolean> = \{\}/.test(BILLING_CODE) &&
  !/let portalBusy/.test(BILLING_CODE));
/* The click handler must act on the button that was clicked. Re-finding it with
   querySelector returns the FIRST button in the row, which disables the wrong
   control the moment a state renders two. */
check("a handler acts on its own button, not the first one in the row",
  !/acts\.querySelector\('button'\)/.test(BILLING_CODE));
check("the button disables before the request",
  /btn\.disabled = true;[\s\S]{0,160}await openBillingPortal\(\)/.test(BILLING_CODE));
check("no Portal call happens at page load",
  !/openBillingPortal\(\)[^\n]*\n[\s\S]{0,40}load\(\)/.test(BILLING_CODE));

/* The wrapper is where the empty payload is enforced. */
check("openBillingPortal sends an EMPTY payload",
  /createPortalSession, \{\}\)/.test(CONVEX_DATA));
const PORTAL_FN = CONVEX_DATA.slice(CONVEX_DATA.indexOf("export async function openBillingPortal"));
for (const banned of ["customer", "userId", "email", "subscription", "price", "return_url"]) {
  check(`the portal wrapper sends no "${banned}"`,
    !PORTAL_FN.slice(0, 200).includes(banned));
}
check("the browser cannot supply a Customer id anywhere on /billing",
  !/cus_|stripeCustomerId|customerId/.test(BILLING_CODE));

/* Each state's copy. */
check("the card can show ACTIVE", /STATE_LABEL_KEYS\['plus-active'\]/.test(BILLING));
check("the cancelling state has its own message", /'plan\.cancellingMsg'/.test(BILLING));
check("the attention state has its own message", /'plan\.attentionMsg'/.test(BILLING));
check("the ambiguous state has its own message", /'plan\.ambiguousMsg'/.test(BILLING));
check("the unavailable state has its own message", /'plan\.unavailableMsg'/.test(BILLING));
check("free shows remaining Gentle Guidance", /gentleGuidanceToday/.test(BILLING));
check("free shows remaining Journey slots", /activeJourneySlots/.test(BILLING));
check("free is sent to Plans, not offered billing management",
  /'billing\.viewPlans'[\s\S]{0,40}'\/pricing'/.test(BILLING));
check("unavailable offers retry, not upgrade",
  /state === 'unavailable'[\s\S]{0,120}'plan\.retry'/.test(BILLING));
check("benefits are listed", /'plan\.b1'/.test(BILLING) && /'plan\.b3'/.test(BILLING));

/* The badge. */
check("the badge markup exists", /id="yPlusBadge"/.test(YOU));
check("the badge is hidden by default", /id="yPlusBadge" hidden/.test(YOU));
check("the badge has an accessible label", /aria-label="Declare Plus subscriber"/.test(YOU));
check("the badge visibility comes from the shared helper",
  /showsPlusBadge\(planState\(ent\)\)/.test(YOU));
check("the badge says PLUS, never Active", />PLUS</.test(YOU));
/* Applied to CODE, not comments: the comments above the badge say "No crown",
 * and failing the file for documenting its own restraint would be absurd. */
check("no crown or trophy glyph is used", !/crown|👑|🏆|trophy/i.test(YOU_CODE));

/* ── 7. Pricing reflects the current plan ────────────────────────────────── */
section("7. Pricing reflects the authenticated current plan");

/* REWRITTEN, because the design these described was the defect.
 *
 * Each card used to reveal its own marker — `pcFreeCur` on Free, `pcPlusCur` on
 * Plus — with two DIFFERENT labels ("Current plan" and "Your current plan") for
 * one idea, computed twice, and nothing anywhere forbidding both from winning.
 * Asserting that each marker exists could never catch the state that actually
 * hurts: both of them showing at once.
 *
 * Current plan is now derived ONCE by currentPlanId(), and the cards only ask.
 * So the assertions are stronger rather than merely different: instead of
 * "each card has a marker", the invariant itself is executed over every state
 * the app can be in. */
check("both cards carry one shared badge element",
  /id="plFreeBadge"/.test(PRICING) && /id="plPlusBadge"/.test(PRICING));
check("neither card computes current plan for itself",
  !/pcFreeCur|pcPlusCur|yourCurrentPlan/.test(PRICING));
check("the page asks the shared derivation instead",
  /isCurrentPlan\(planId, state\)/.test(PRICING) && /planStatusKey\(planId, state\)/.test(PRICING));
check("one label, not two, for the one idea",
  /'plans\.currentPlan'/.test(I18N) && !/'pricing\.yourCurrentPlan'/.test(I18N));
check("a subscriber is sent to the Billing page",
  /a\.href = '\/billing'/.test(PRICING));

const PRICING_CODE = stripComments(PRICING);
/* The page must stay non-transactional. */
check("pricing imports NO billing action",
  !/createCheckoutSession|createPortalSession|api\.billing/.test(PRICING_CODE));
check("the CTA is still disabled in the served markup", /disabled data-i18n="plans\.launchSoon"/.test(PRICING));
check("a subscriber never gets a purchase control at all",
  /if \(!mayStartCheckout\(state\)\)/.test(PRICING_CODE) &&
  /b\.disabled = true;/.test(PRICING_CODE));
/* Narrowed from the bare string to the button it is about. The checkout handler
   re-enables its own button after a failure so a reader can retry; the purchase
   control is a different button and is never enabled while purchasing is off. */
check("the CTA is never set to enabled anywhere",
  !/plPlusBtn[^\n]*disabled = false/.test(PRICING_CODE));
/* Fail closed: an unresolved read changes nothing. */
/* Fail-closed is now a property of the derivation rather than an early return:
   currentPlanId() answers null for loading, unavailable AND guest, so no card
   can be marked current and no purchase intent is produced. Executed, not read. */
check("an unresolved read marks no card current",
  currentPlanCount("loading") === 0 && currentPlanCount("unavailable") === 0);
check("a signed-out reader marks no card current", currentPlanCount("guest") === 0);
check("an unresolved read produces no purchase intent",
  plusCtaIntent("loading", true) === "none" && plusCtaIntent("unavailable", true) === "none");
/* Scoped to the SCRIPT. Comparing against the whole file would compare a markup
 * position to a script position, which proves nothing about execution order. */
const PRICING_SCRIPT = PRICING_CODE.slice(PRICING_CODE.indexOf("<script>"));
check("a badge is only ever revealed through the shared status key",
  /const key = planStatusKey\(planId, state\)/.test(PRICING_SCRIPT));
check("no card is revealed without one",
  /if \(key\) \{/.test(PRICING_SCRIPT) && /badge\.hidden = true;/.test(PRICING_SCRIPT));
check("pricing shows real lifecycle instead of Active when not simply active",
  /'plus-cancelling': 'plan\.cancellingMsg'/.test(PRICING_CODE) &&
  /'plus-attention': 'plan\.attentionMsg'/.test(PRICING_CODE));
check("pricing double-checks checkout gating with the shared helper",
  /!mayStartCheckout\(state\)/.test(PRICING_CODE));

/* ── 8. Localization parity ──────────────────────────────────────────────── */
section("8. English / Spanish parity");

const NEW_KEYS = [
  "plan.plusName", "plan.freeName", "plan.stateActive", "plan.stateCancelling",
  "plan.stateAttention", "plan.monthly", "plan.annual", "plan.renews", "plan.cancels",
  "plan.manage", "plan.upgrade", "plan.retry", "plan.cancellingMsg", "plan.attentionMsg",
  "plan.ambiguousMsg", "plan.unavailableMsg", "plan.b1", "plan.b2", "plan.b3",
  "you.billing", "you.billingD", "checkout.welcomePlusT", "checkout.welcomePlusD",
  "checkout.continueToDeclare", "checkout.viewMyPlan",
  /* One label for one idea. "pricing.yourCurrentPlan" is deliberately gone:
     two spellings of "this is your plan" is what let the page say both. */
  "plans.currentPlan", "plan.stateEnding", "plan.updatePayment", "plan.keepPlus",
  "billing.h1", "billing.viewPlans", "billing.freeMsg", "billing.paymentNote",
  "plans.h1", "plans.sub", "plans.launchSoon", "plans.upgrade", "plans.monthly",
  "plans.annual",
  /* "plans.orgH" was the "For churches and groups" heading. That offer was
     removed from the product, so the key is gone from both languages and there
     is no longer a string to hold to parity. */
];
for (const k of NEW_KEYS) {
  check(`"${k}" has Spanish`, new RegExp(`'${k.replace(".", "\\.")}':`).test(I18N));
}
check("renews and cancels are DIFFERENT in Spanish too",
  (I18N.match(/'plan\.renews': '([^']*)'/) || [])[1] !==
  (I18N.match(/'plan\.cancels': '([^']*)'/) || [])[1]);

/* ── 9. Accessibility and design hooks ───────────────────────────────────── */
section("9. Accessibility and design");

check("the card exposes a busy state while loading", /aria-busy/.test(BILLING));
check("the card is labelled by its heading", /aria-labelledby="blPlanH"/.test(BILLING));
check("the message line is a live region", /id="blMsg" role="status"/.test(BILLING));
check("status is a WORD, not colour alone", /st\.textContent = tx\(shown/.test(BILLING));
check("buttons meet the 44px target", /\.billing \.bl-btn \{[^}]*min-height: 48px/.test(BILLING));
check("buttons have visible keyboard focus", /\.billing \.bl-btn:focus-visible \{[^}]*outline/.test(BILLING));
check("the card uses existing surface tokens", /\.billing \.bl-card \{[^}]*var\(--surface\)/.test(BILLING));
check("the badge uses existing accent tokens", /\.ybadge \{[^}]*var\(--goldd\)/.test(YOU));
check("no gradient decoration was added to the card", !/\.bl-card \{[^}]*gradient/.test(BILLING));
check("no second navigation landmark was added", !/<nav\b/.test(BILLING));
/* The Plans page carries its own accessibility contract. */
check("the plans page has exactly one h1", (PRICING.match(/<h1\b/g) || []).length === 1);
/* THREE now, not two: Lifetime joined Free and Plus on 2026-08-26. Asserted as
   a count AND by name, because a count alone passes if a card is duplicated and
   one is dropped. */
check("plan cards are labelled groups", (PRICING.match(/<article class="pl-card[^"]*"[^>]*aria-labelledby=/g) || []).length === 3);
for (const [id, label] of [["plFree", "plFreeNm"], ["plPlus", "plPlusNm"], ["plLife", "plLifeNm"]] as const) {
  check(`the ${id} card is labelled by its own name`,
    new RegExp(`<article class="pl-card[^"]*"[^>]*id="${id}"[^>]*aria-labelledby="${label}"`).test(PRICING));
}
check("the cadence control is a radiogroup", /role="radiogroup"/.test(PRICING));
check("the cadence options announce their state", (PRICING.match(/aria-checked=/g) || []).length >= 2);
check("cadence options meet the 44px target", /\.plans \.seg-o \{[^}]*min-height: 44px/.test(PRICING));
check("cadence options show keyboard focus", /\.plans \.seg-o:focus-visible \{[^}]*outline/.test(PRICING));
check("the comparison table has a caption", /<caption/.test(PRICING));
check("the comparison table stacks on mobile", /max-width: 620px[\s\S]{0,400}\.pl-table tr \{ display: block/.test(PRICING));
check("reduced motion is honoured", /prefers-reduced-motion: reduce/.test(PRICING));

/* ── 10. No identifier reaches any normal UI ─────────────────────────────── */
section("10. No Stripe identifier in normal UI");

for (const [name, src] of [["you.astro", YOU_CODE], ["success.astro", SUCCESS_CODE], ["pricing.astro", PRICING_CODE]] as const) {
  for (const banned of ["cus_", "sub_1", "price_", "in_1", "evt_", "cs_test", "billing.stripe.com"]) {
    check(`${name} contains no "${banned}"`, !src.includes(banned));
  }
  check(`${name} names no Stripe identifier field`,
    !/stripeCustomerId|stripeSubscriptionId|stripePriceId|latestInvoiceId/.test(src));
}

/* ── 10b. The founding round says only what the server said ──────────────
   Added 2026-08-26 with the Lifetime card.

   THE PROPERTY: this page cannot state a seat number of its own. The cap lives
   in convex/plusPlans.ts, which is also what refuses a purchase when it is
   reached, so a number written into the page could promise a round size the
   rule does not enforce. It is written in from the server or not at all.

   Each assertion below was confirmed by breaking what it guards. */
section("10b. The founding round");

const LIFE_CARD = (PRICING.match(/<article class="pl-card pl-once[\s\S]*?<\/article>/) || [""])[0];
check("the Lifetime card exists", LIFE_CARD.length > 0);
/* THE COLLISION THAT COST 12 PIXELS. .pl-life is the Plus card's lifecycle
   sentence, and while the Lifetime card also carried that class it inherited
   the sentence's type and its 12px top margin, so it rendered shorter than the
   other two inside a grid explicitly set to stretch. Caught by measuring the
   rendered cards, not by reading the CSS. */
check("the Lifetime card does not reuse the lifecycle class",
  !/<article class="[^"]*\bpl-life\b/.test(PRICING));
check("and .pl-life still styles the Plus lifecycle sentence",
  /<p class="pl-life" id="plPlusLife"/.test(PRICING) &&
  /\.plans \.pl-life \{ font-size/.test(PRICING));
check("the seat bullet ships empty", /<li id="plLifeSeats" hidden><\/li>/.test(LIFE_CARD));
/* The cap, spelled any way a page might spell it. 149 is the price and is
   allowed; 200 as a bare number is the cap and is not. */
check("the card states no seat count of its own", !/\b200\b/.test(LIFE_CARD));
check("the seat sentence is a template, not a number",
  /'plans\.lifeSeats': '\{seats\} /.test(PRICING));
check("the seat number is filled in from the server read",
  /lifetimeAvailability\(\)/.test(PRICING_CODE) &&
  /\.replace\('\{seats\}', String\(info\.seats\)\)/.test(PRICING_CODE));
/* Fails toward silence. A read that comes back wrong must leave the bullet
   hidden rather than render a partial sentence. */
check("a failed seat read renders nothing",
  /if \(!info \|\| typeof info\.seats !== 'number'\) return;/.test(PRICING_CODE));

/* ONE HOME FOR $149. The markup carries it as the pre-script default, exactly
   as the Plus card carries $8.99, and plan-display.js is the definition. If the
   card ever stopped painting from the constant the bundler would drop it, and
   the price would silently have only one home again: this page. */
check("the Lifetime price is painted from the shared constant",
  /lifeAmt\.textContent = moneyRound\(PLUS_LIFETIME_CENTS\)/.test(PRICING_CODE));
check("and that constant is the one /billing reads too",
  /export const PLUS_LIFETIME_CENTS = 14900;/.test(PLAN_DISPLAY));

/* THE ABSENCE OF A TRIAL, stated on the card. Lifetime runs in Stripe's
   `mode: "payment"`, so there is no first charge to delay. Somebody comparing
   three cards under a button that says "Start my 7 days free" will assume the
   seven days apply to all three unless told otherwise. */
check("the card says the free days do not apply to it",
  /data-i18n="plans\.lifeNoTrial"/.test(LIFE_CARD));
check("and that sentence exists in Spanish", /'plans\.lifeNoTrial':/.test(I18N));

/* The browser names an ALIAS. Not a Price, not $149, not a seat index. */
check("the Lifetime purchase names a plan alias only",
  /beginCheckout\(b, 'plus-lifetime', 'plLifeErr'\)/.test(PRICING_CODE));

/* A sold-out round and an unlaunched product are different sentences. Both
   leave the button disabled, and a reader who is shown the wrong one is told
   the wrong reason they cannot buy. */
check("sold out and launches-soon are separate strings",
  /'plans\.lifeSoldOut'/.test(PRICING) && /'plans\.launchSoon'/.test(PRICING) &&
  !/lifeSoldOut[^\n]*launches soon/i.test(PRICING));

/* Which card is "yours" is read from planKey. billingInterval is null for a
   guest, for a free account and for every lapsed row, so using it would put a
   current-plan badge on the Lifetime card of somebody who has never paid. */
check("lifetime ownership is read from planKey",
  /ent\.planKey === 'plus_lifetime'/.test(PLAN_DISPLAY) &&
  !/isLifetime[\s\S]{0,200}billingInterval/.test(PLAN_DISPLAY));
/* And only one of the two Plus cards may claim it. */
check("the Plus badge is dropped when Lifetime holds it",
  /if \(pb\) pb\.hidden = true;/.test(PRICING_CODE));

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
check("the account page ships the billing hand-off",
  readFileSync(join(DIST, "you/index.html"), "utf8").includes('href="/billing"'));
check("the billing page ships its plan card",
  readFileSync(join(DIST, "billing/index.html"), "utf8").includes('id="blPlan"'));
check("the success page ships the welcome copy",
  readFileSync(join(DIST, "checkout/success/index.html"), "utf8").includes("Welcome to Declare Plus"));
check("pricing ships the shared current-plan badges",
  readFileSync(join(DIST, "pricing/index.html"), "utf8").includes('id="plPlusBadge"'));
check("no shipped page still says 'Declare stays free'",
  !readFileSync(join(DIST, "pricing/index.html"), "utf8").includes("Declare stays free"));
check("no shipped page still says 'Opening soon'",
  !readFileSync(join(DIST, "pricing/index.html"), "utf8").includes("Opening soon"));
check("no shipped page still says 'Nothing here charges you'",
  !readFileSync(join(DIST, "pricing/index.html"), "utf8").includes("Nothing here charges you"));
/* The development billing controls must STILL be absent. */
check("dist/dev does not exist", !existsSync(join(DIST, "dev")));
/* `createCheckoutSession` delisted 2026-08-26, owner-authorised: the pricing CTA
   is wired, so the string ships. The dev controls stay banned. */
for (const needle of ["Stripe sandbox", "dbGoAnnual", "dbPortal"]) {
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
/* resumeSubscription ships for the same reason createPortalSession does — the
 * billing page's "Keep Plus" resolves in place instead of handing the user to
 * Stripe's portal — so it inherits the same obligation. It takes NO arguments at
 * all: the subscription is resolved server-side from the stored mapping for the
 * authenticated user. If a subscription id ever appeared in this payload, the
 * browser could aim the call at somebody else's subscription, which is exactly
 * the class of bug the retired customers-by-email portal lookup was.
 *
 * Asserted separately from the portal rather than folded into a shared loop:
 * these are two different actions with two different reasons to be safe, and a
 * shared loop would let deleting one silently stop proving anything. */
const resumeFiles = files.filter((f) => readFileSync(f, "utf8").includes("resumeSubscription"));
check("resumeSubscription reaches production (the billing page needs it)", resumeFiles.length > 0);
for (const f of resumeFiles) {
  const t = readFileSync(f, "utf8");
  const rel = f.slice(DIST.length + 1);
  check(`${rel} calls resume with an empty payload`,
    /resumeSubscription\s*,\s*\{\s*\}/.test(t) || /resumeSubscription[^)]{0,40}\{\}/.test(t));
  check(`${rel} sends no subscription identifier`, !/sub_|stripeSubscriptionId/.test(t));
  check(`${rel} sends no customer identifier`, !/cus_|stripeCustomerId/.test(t));
}

/* The two actions behind "Switch to annual" ship for the same reason
 * resumeSubscription does, and inherit the same obligation. Both take NO
 * arguments: the subscription, the customer and the TARGET PRICE are all
 * resolved server-side. That last one matters most — a browser that can name a
 * Price can name any Price, which is the exact hole createCheckoutSession's
 * env-var lookup exists to close. Asserted per action rather than in a shared
 * loop, so deleting one cannot silently stop proving the other. */
for (const action of ["upgradeToAnnual", "previewAnnualUpgrade"] as const) {
  const hits = files.filter((f) => readFileSync(f, "utf8").includes(action));
  check(`${action} reaches production (the billing page needs it)`, hits.length > 0);
  for (const f of hits) {
    const t = readFileSync(f, "utf8");
    const rel = f.slice(DIST.length + 1);
    check(`${rel} calls ${action} with an empty payload`,
      new RegExp(action + "\\s*,\\s*\\{\\s*\\}").test(t) ||
      new RegExp(action + "[^)]{0,40}\\{\\}").test(t));
    check(`${rel} sends no subscription identifier to ${action}`, !/sub_|stripeSubscriptionId/.test(t));
    check(`${rel} names no Stripe Price for ${action}`,
      !/\bprice_[A-Za-z0-9]{6}/.test(t) && !/STRIPE_PLUS_ANNUAL_PRICE_ID/.test(t));
  }
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
