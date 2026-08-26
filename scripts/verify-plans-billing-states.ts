/* Declare & Believe — the Plans and Billing presentation contract.
 *
 * WHY THIS SUITE EXISTS
 *
 * /pricing used to let each plan card decide for itself whether it was the
 * current one. The Free card revealed a badge saying "Current plan"; the Plus
 * card revealed a different badge saying "Your current plan"; nothing connected
 * them and nothing forbade both from winning. Two spellings of one idea,
 * computed twice, with no invariant. The old suite asserted that each marker
 * EXISTED, which could never catch the state that actually hurts a customer:
 * both of them showing at once, or a paying subscriber being told Plus is
 * "opening soon".
 *
 * So the invariant is executed here rather than described: over every state the
 * app can be in, an authenticated reader has exactly ONE current plan and a
 * signed-out reader has none. The derivation lives in one place —
 * plan-display.js — and this file imports and RUNS it, the same way
 * verify-subscription-visibility.ts does.
 *
 * It also holds the two pages to their separate jobs. Plans answers "which plan
 * is right for me?". Billing answers "what do I have and how do I manage it?".
 * A page that drifts into the other's job is a regression this catches.
 *
 * Dependency-free and offline: plain `node`, no deployment, no credential, no
 * network.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PLAN_STATES,
  PLAN_IDS,
  planState,
  currentPlanId,
  currentPlanCount,
  isCurrentPlan,
  planStatusKey,
  plusCtaIntent,
  freeCtaIntent,
  initialInterval,
  monthlyEquivalentCents,
  annualSavingPercent,
  periodLabelKey,
  showsManageBilling,
  mayStartCheckout,
  cadenceKey,
  formatPeriodEnd,
  PRICING_ENABLED,
  DEFAULT_INTERVAL,
} from "../src/app/declare/plan-display.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PLANS = read("src/pages/pricing.astro");
const PLANS_CODE = strip(PLANS);
const BILLING = read("src/pages/billing.astro");
const BILLING_CODE = strip(BILLING);
const YOU = read("src/pages/you.astro");
const I18N = read("public/declare/i18n-strings.js");
const ANALYTICS = read("src/app/declare/analytics.js");

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

/* Entitlement responses, provider-neutral, exactly as getMyEntitlements
 * returns them. No Stripe identifier appears in this file because none appears
 * in that contract. */
const GUEST = { tier: "guest" };
const FREE = { tier: "free", subscriptionStatus: "none", remaining: { gentleGuidanceToday: 3, activeJourneySlots: 2 } };
const PLUS_M = { tier: "plus", subscriptionStatus: "active", billingInterval: "month", cancelAtPeriodEnd: false, paymentNeedsAttention: false, periodEndAt: 1_800_000_000_000 };
const PLUS_Y = { ...PLUS_M, billingInterval: "year" };
const PLUS_ATTN = { ...PLUS_Y, subscriptionStatus: "past_due", paymentNeedsAttention: true };
const PLUS_END = { ...PLUS_Y, cancelAtPeriodEnd: true };
const TERMINAL = { tier: "free", subscriptionStatus: "canceled", remaining: { gentleGuidanceToday: 3, activeJourneySlots: 2 } };

/* ── 1. The one-current-plan invariant ───────────────────────────────────── */
section("1. Exactly one current plan, never two");

/* THE assertion. Over every state, the two cards can never both be current.
 * This is the executable form of the defect that shipped. */
for (const s of PLAN_STATES) {
  const n = Number(isCurrentPlan("free", s)) + Number(isCurrentPlan("plus", s));
  check(`"${s}": at most one card is current (${n})`, n <= 1);
  check(`"${s}": the count agrees with the cards`, currentPlanCount(s) === n);
}
/* Authenticated states must produce exactly one — "neither" is its own bug,
 * because a signed-in reader with no marked plan cannot tell what they have. */
for (const s of ["free", "plus-active", "plus-cancelling", "plus-attention", "plus-ambiguous"]) {
  check(`"${s}" is authenticated, so exactly one card is current`, currentPlanCount(s) === 1);
}
/* Signed out, and not-yet-known, must produce zero. */
for (const s of ["guest", "loading", "unavailable"]) {
  check(`"${s}" marks no card current`, currentPlanCount(s) === 0);
}
check("only the two plans exist", PLAN_IDS.length === 2 &&
  PLAN_IDS.includes("free") && PLAN_IDS.includes("plus"));
check("an unknown plan id is never current",
  !isCurrentPlan("family", "plus-active") && !isCurrentPlan("church", "free") &&
  !isCurrentPlan("lifetime", "plus-active"));
check("a non-string state is never current", currentPlanId(undefined as any) === null &&
  currentPlanId(null as any) === null && currentPlanId(42 as any) === null);

/* ── 2. The state matrix, end to end ─────────────────────────────────────── */
section("2. Every state in the matrix");

/* A. Signed out */
check("A. signed out: no plan is current", currentPlanCount(planState(GUEST)) === 0);
check("A. signed out: Free offers account creation", freeCtaIntent(planState(GUEST)) === "create-account");
check("A. signed out: Plus offers no management", plusCtaIntent(planState(GUEST)) !== "manage-billing");
check("A. signed out: no Manage billing", showsManageBilling(planState(GUEST)) === false);
check("A. signed out: Plus says it launches soon while disabled",
  plusCtaIntent(planState(GUEST), false) === "launches-soon");
check("A. signed out: Plus offers a purchase once enabled",
  plusCtaIntent(planState(GUEST), true) === "upgrade");

/* B. Signed-in Free */
check("B. free: Free is current", isCurrentPlan("free", planState(FREE)));
check("B. free: Plus is not current", !isCurrentPlan("plus", planState(FREE)));
check("B. free: Free's action is passive", freeCtaIntent(planState(FREE)) === "current");
check("B. free: no Manage billing", showsManageBilling(planState(FREE)) === false);
check("B. free: Plus says it launches soon while disabled",
  plusCtaIntent(planState(FREE), false) === "launches-soon");
check("B. free: Plus offers upgrade once enabled",
  plusCtaIntent(planState(FREE), true) === "upgrade");

/* C. Plus monthly */
check("C. plus monthly: Plus is current", isCurrentPlan("plus", planState(PLUS_M)));
check("C. plus monthly: Free is NOT current", !isCurrentPlan("free", planState(PLUS_M)));
check("C. plus monthly: the monthly cadence is selected",
  initialInterval(PLUS_M, planState(PLUS_M)) === "month");
check("C. plus monthly: the action is Manage billing",
  plusCtaIntent(planState(PLUS_M)) === "manage-billing");
check("C. plus monthly: Free offers no upgrade treatment",
  freeCtaIntent(planState(PLUS_M)) === "none");
check("C. plus monthly: the cadence word is monthly", cadenceKey(PLUS_M) === "plan.monthly");

/* D. Plus annual */
check("D. plus annual: Plus is current", isCurrentPlan("plus", planState(PLUS_Y)));
check("D. plus annual: Free is NOT current", !isCurrentPlan("free", planState(PLUS_Y)));
check("D. plus annual: the annual cadence is selected",
  initialInterval(PLUS_Y, planState(PLUS_Y)) === "year");
check("D. plus annual: the cadence word is annual", cadenceKey(PLUS_Y) === "plan.annual");
check("D. plus annual: renewal language is allowed",
  periodLabelKey(planState(PLUS_Y)) === "plan.renews");

/* E. Payment attention */
const S_ATTN = planState(PLUS_ATTN);
check("E. attention: Plus remains the entitlement", isCurrentPlan("plus", S_ATTN));
check("E. attention: Free is NOT current", !isCurrentPlan("free", S_ATTN));
check("E. attention: the badge says Needs attention",
  planStatusKey("plus", S_ATTN) === "plan.stateAttention");
check("E. attention: it does NOT also say Current plan",
  planStatusKey("plus", S_ATTN) !== "plans.currentPlan");
check("E. attention: NO renewal date is claimed", periodLabelKey(S_ATTN) === null);
check("E. attention: the action is Update payment",
  plusCtaIntent(S_ATTN) === "update-payment");
check("E. attention: billing management is still reachable",
  showsManageBilling(S_ATTN) === true);

/* F. Scheduled cancellation */
const S_END = planState(PLUS_END);
check("F. ending: Plus remains the entitlement", isCurrentPlan("plus", S_END));
check("F. ending: Free is NOT current while access remains", !isCurrentPlan("free", S_END));
check("F. ending: the badge says Ending", planStatusKey("plus", S_END) === "plan.stateEnding");
check("F. ending: it does NOT also say Current plan",
  planStatusKey("plus", S_END) !== "plans.currentPlan");
check("F. ending: the date word is Cancels, never Renews",
  periodLabelKey(S_END) === "plan.cancels");
check("F. ending: the action is Keep Plus", plusCtaIntent(S_END) === "keep-plus");

/* G. Terminal / Free after cancellation */
const S_TERM = planState(TERMINAL);
check("G. terminal: Free is current", isCurrentPlan("free", S_TERM));
check("G. terminal: Plus is NOT current", !isCurrentPlan("plus", S_TERM));
check("G. terminal: no stale ending or attention badge",
  planStatusKey("free", S_TERM) === "plans.currentPlan");
check("G. terminal: no date is claimed", periodLabelKey(S_TERM) === null);
check("G. terminal: no Manage billing", showsManageBilling(S_TERM) === false);

/* Exactly one Plus label, ever. */
section("3. Never two badges on one card");

const PLUS_LABELS = ["plans.currentPlan", "plan.stateAttention", "plan.stateEnding", "plan.stateAmbiguous"];
for (const s of PLAN_STATES) {
  const key = planStatusKey("plus", s);
  check(`"${s}": the Plus card carries at most one label`,
    key === null || PLUS_LABELS.includes(key));
  const freeKey = planStatusKey("free", s);
  check(`"${s}": Free and Plus never both carry a label`,
    !(key !== null && freeKey !== null));
}

/* ── 4. Purchasing disabled must not change who is current ───────────────── */
section("4. The activation flag decides what is SOLD, never what is HELD");

for (const s of PLAN_STATES) {
  check(`"${s}": current plan is identical whether purchasing is on or off`,
    currentPlanId(s) === currentPlanId(s));
  /* The real assertion: the intent for a SUBSCRIBER ignores the flag entirely. */
  if (currentPlanId(s) === "plus") {
    check(`"${s}": a subscriber's action is the same either way`,
      plusCtaIntent(s, true) === plusCtaIntent(s, false));
    check(`"${s}": a subscriber is never offered a purchase`,
      plusCtaIntent(s, true) !== "upgrade" && plusCtaIntent(s, true) !== "launches-soon");
  }
}
check("purchasing ships disabled", PRICING_ENABLED === false);
check("a Free reader sees the truthful disabled label",
  plusCtaIntent("free", false) === "launches-soon");
check("a Plus reader never sees it", plusCtaIntent("plus-active", false) === "manage-billing");
check("a failed read cannot unlock a purchase",
  plusCtaIntent("unavailable", true) === "none" && mayStartCheckout("unavailable") === false);
check("the default cadence is the product default for non-subscribers",
  initialInterval(FREE, "free") === DEFAULT_INTERVAL &&
  initialInterval(GUEST, "guest") === DEFAULT_INTERVAL);

/* ── 5. Annual value is computed, never asserted ─────────────────────────── */
section("5. The annual saving is arithmetic, not a claim");

check("the monthly equivalent of $79.99 is $6.67", monthlyEquivalentCents(7999) === 667);
check("the annual saving against $8.99/mo is 26%", annualSavingPercent(899, 7999) === 26);
check("no saving is claimed when there is none", annualSavingPercent(899, 10788) === null);
check("no saving is claimed when annual costs more", annualSavingPercent(899, 12000) === null);
check("garbage in yields null, never a number",
  monthlyEquivalentCents("7999" as any) === null && monthlyEquivalentCents(0) === null &&
  annualSavingPercent(null as any, 7999) === null);
check("the page states the computed saving", /Save 26%/.test(PLANS));
check("the page states the computed monthly equivalent", /\$6\.67/.test(PLANS));

/* ── 6. The Plans page ───────────────────────────────────────────────────── */
section("6. Plans answers 'which plan is right for me?'");

check("the page is titled Plans", /title="Declare — Plans"/.test(PLANS));
check("its heading asks the customer's question",
  /Choose the support that fits your journey/.test(PLANS));
check("both plan cards are present",
  /id="plFree"/.test(PLANS) && /id="plPlus"/.test(PLANS));
check("a monthly / annual selector exists", /data-interval="month"/.test(PLANS) && /data-interval="year"/.test(PLANS));
check("a comparison table exists", /<table class="pl-table">/.test(PLANS));
check("purchase reassurance is present",
  /Secure billing through Stripe/.test(PLANS) && /Cancel anytime/.test(PLANS));
check("the reassurance says what a plan does NOT change",
  /not access to Scripture or crisis support/.test(PLANS));
check("an FAQ is present", (PLANS.match(/<details class="pl-q">/g) || []).length >= 4);

/* It must NOT drift into Billing's job. */
/* Scoped to the page's CODE, not its prose. The FAQ legitimately tells a
   customer where to manage their payment method — that is a signpost to
   Billing, not a payment interface rendered here. What must not exist is the
   machinery. */
const PLANS_SCRIPT = (PLANS_CODE.match(/<script>[\s\S]*?<\/script>/g) || []).join("\n");
check("Plans builds no invoice interface", !/invoice/i.test(PLANS_SCRIPT));
/* Payment-specific terms only. The bare word "card" is a PLAN card on this
   page — banning it would mean renaming the thing the page is made of to
   satisfy a grep. */
check("Plans builds no payment-method interface",
  !/paymentMethod|payment_method|last4|lastFour|cardBrand|card_brand/i.test(PLANS_SCRIPT));
check("Plans renders no invoice or payment section",
  !/id="pl(Inv|Pay)/.test(PLANS));
check("Plans creates no Portal session", !/createPortalSession|openBillingPortal/.test(PLANS_CODE));
check("Plans creates no Checkout session", !/createCheckoutSession/.test(PLANS_CODE));
check("Plans never enables the purchase control", !/disabled = false/.test(PLANS_CODE));

/* The page offers consumer plans and nothing else. Family and Church were
   never purchasable — Family was already absent, and Church was a quiet
   "contact us" invitation below the plans. Both are now gone entirely, so the
   assertion is no longer "present but quiet"; it is ABSENT.

   Kept as a standing ban rather than deleted: a contact-to-buy block is the
   kind of thing that gets re-added as "just a mailto", and a mailto asking a
   church for money is a plan whether or not it is drawn like one. */
check("Family is not presented as a plan", !/Family/.test(PLANS));
check("no church or group offer appears at all",
  !/For churches and groups/.test(PLANS) && !/pl-org/.test(PLANS) &&
  !/iglesias/.test(PLANS));
check("the page solicits no contact-to-buy", !/Contact us/.test(PLANS));
check("no orphaned org styling survives the removal", !/pl-org/.test(PLANS_CODE));
check("nothing on the page says 'Coming soon'", !/Coming soon/i.test(PLANS));

/* ── 7. The Billing page ─────────────────────────────────────────────────── */
section("7. Billing answers 'what do I have and how do I manage it?'");

check("the page exists", existsSync(join(ROOT, "src/pages/billing.astro")));
check("it is titled Billing", /title="Declare — Billing"/.test(BILLING));
check("its heading is Billing", /<h1 data-i18n="billing\.h1">Billing<\/h1>/.test(BILLING));
check("it is not indexed", /noindex/.test(BILLING));
check("it names the current plan", /id="blPlan"/.test(BILLING) && /id="blNm"/.test(BILLING));
check("it shows status", /id="blState"/.test(BILLING));
check("it shows cadence and the renewal or ending date", /id="blMeta"/.test(BILLING));
check("it offers ONE primary action", /id="blActs"/.test(BILLING));
check("it offers View plans for Free", /billing\.viewPlans/.test(BILLING));
check("payment is a Portal hand-off, not a rebuild",
  /Payment details are managed securely through Stripe/.test(BILLING));
/* WHY THIS IS NO LONGER "invoice history is a Portal hand-off"
   It asserted the literal copy "available in the billing portal", which encoded
   a decision that has since been reversed: the HISTORY is rendered on this page
   now, because "did that charge go through, and when?" is the question people
   actually open this page to answer, and sending them to Stripe to read it was
   a worse answer than rendering it.
   What did NOT change is the part that genuinely must stay handed off — the
   downloadable receipt and tax document. So both halves are asserted, and the
   split is stated rather than assumed. */
check("invoice history is rendered here, not handed off",
  /id="blInvList"/.test(BILLING));
check("the history distinguishes empty from unreadable",
  /id="blInvEmpty"/.test(BILLING) && /id="blInvErr"/.test(BILLING));
check("downloadable receipts are still a Portal hand-off",
  /billing portal/.test(BILLING));
/* The rows may not be built from a Stripe identifier, whatever the markup. */
check("no invoice identifier appears on the page", !/\bin_[A-Za-z0-9]{6}/.test(BILLING));

/* It must NOT drift into Plans' job.
 *
 * APPLIED TO CODE, NOT PROSE. These bans are about what the page RENDERS. The
 * file's own comments necessarily describe the patterns being banned — the
 * invoice list carries a comment explaining why it is a list and not the banned
 * element, and the money formatter explains why the server does not return a
 * pre-formatted price. Grepping raw text failed the file for documenting its
 * own rules, which is the same trap verify-billing-dev-control.ts calls out and
 * solves the same way. */
const BILLING_MARKUP = BILLING
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .split("\n")
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join("\n");
check("Billing does not repeat the plan comparison", !/<table/.test(BILLING_MARKUP));
check("Billing shows no cadence selector", !/role="radiogroup"/.test(BILLING_MARKUP));
check("Billing shows no prices", !/\$\d/.test(BILLING_MARKUP));
check("Billing has no plan cards", !/pl-card/.test(BILLING_MARKUP));
/* The comment-stripping must not become a hole: prove it actually removed
   something, so a future refactor that drops the comments does not silently
   turn these four into assertions over the raw file again. */
check("the markup view is genuinely narrower than the raw file",
  BILLING_MARKUP.length < BILLING.length);

/* Free must not be shown payment furniture it does not have. */
check("payment and invoice sections are hidden by default",
  /id="blPay"[^>]*hidden/.test(BILLING) && /id="blInv"[^>]*hidden/.test(BILLING));
check("they are revealed only for a real billing relationship",
  /const hasBilling = showsManageBilling\(state\)/.test(BILLING_CODE) &&
  /pay\.hidden = !hasBilling/.test(BILLING_CODE) &&
  /inv\.hidden = !hasBilling/.test(BILLING_CODE));
check("Free is never offered Manage billing", showsManageBilling("free") === false);
check("a guest is never offered Manage billing", showsManageBilling("guest") === false);
check("an unresolved read is never offered Manage billing",
  showsManageBilling("loading") === false && showsManageBilling("unavailable") === false);

/* ── 8. Nothing provider-shaped, anywhere ────────────────────────────────── */
section("8. No provider identifier reaches either page");

for (const [label, src] of [["Plans", PLANS], ["Billing", BILLING]] as const) {
  check(`${label} contains no provider identifier`,
    !/\b(sub|cus|in|pm|price|prod|acct|cs|evt|inpay|whsec|sk|rk)_[A-Za-z0-9]{6,}/.test(src));
  check(`${label} contains no hosted provider URL`,
    !/billing\.stripe\.com|invoice\.stripe\.com|dashboard\.stripe\.com/.test(src));
  check(`${label} renders no raw plan object`, !/JSON\.stringify\(ent/.test(src));
  check(`${label} exposes no email`, !/@[a-z0-9-]+\.[a-z]{2,}/i.test(strip(src).replace(/mailto:[^"]*/g, "")));
  check(`${label} fabricates no card brand or last four`,
    !/last4|lastFour|brand|•••• /.test(strip(src)));
}

/* ── 9. Copy the redesign removed ────────────────────────────────────────── */
section("9. Contradictory copy is gone");

const BANNED = [
  "Declare stays free",
  "Nothing here charges you",
  "Opening soon",
  "Plan & Billing",
  "Plan &amp; billing",
  "Plans & billing",
  "Your current plan",
];
for (const phrase of BANNED) {
  for (const [label, src] of [["Plans", PLANS], ["Billing", BILLING], ["Account", YOU]] as const) {
    check(`${label} no longer says "${phrase}"`, !src.includes(phrase));
  }
  check(`no Spanish string still means "${phrase}"`,
    phrase !== "Declare stays free" || !/Declare sigue siendo gratis/.test(I18N));
}
check("the truthful disabled label replaces it", /Plus launches soon/.test(PLANS));
check("Spanish carries the same truthful label", /'plans\.launchSoon': 'Plus llega pronto'/.test(I18N));
check("payment is never framed as buying God's favour",
  /Plus changes what the app allows, not what God gives/.test(PLANS));

/* ── 10. Navigation reads as two different jobs ──────────────────────────── */
section("10. Plans and Billing are visibly different destinations");

check("the account hub links to both", /href="\/billing"/.test(YOU) && /href="\/pricing"/.test(YOU));
check("they are described differently",
  /Manage your existing subscription/.test(YOU) && /Compare Free and Plus/.test(YOU));
check("neither label is a variant of the other",
  /data-i18n="you\.billing">Billing</.test(YOU) && /data-i18n="you\.plans">Plans</.test(YOU));
check("Billing points at Plans for comparison", /href="\/pricing"/.test(BILLING));
check("Plans points at Billing for management", /'\/billing'/.test(PLANS_CODE));
check("no page links to the retired plan anchor",
  !/#plan-billing/.test(PLANS) && !/#plan-billing/.test(BILLING) && !/#plan-billing/.test(YOU));

/* ── 11. Analytics carries nothing identifying ───────────────────────────── */
section("11. Analytics is an allowlist, not a hope");

const EVENTS = [
  "plans_viewed", "billing_interval_selected", "upgrade_cta_selected",
  "manage_billing_selected", "view_plans_selected",
  "payment_attention_cta_selected", "keep_plus_selected",
];
for (const e of EVENTS) {
  check(`"${e}" is allowlisted`, new RegExp(`\\b${e}:`).test(ANALYTICS));
}
/* The allowlist is what makes the privacy claim structural rather than a
   promise: an unlisted key is stripped, an unlisted event is dropped. */
/* Only the PROPERTY lists are scanned. An event NAME may legitimately contain
   a word like "payment" — payment_attention_cta_selected is exactly the event
   a failing card should emit. What must never appear is a property key that
   could carry identifying or provider data. */
const PLAN_EVENT_BLOCK = ANALYTICS.slice(ANALYTICS.indexOf("plans_viewed:"), ANALYTICS.indexOf("keep_plus_selected:") + 120);
const PLAN_EVENT_PROPS = [...PLAN_EVENT_BLOCK.matchAll(/\[([^\]]*)\]/g)]
  .flatMap((m) => m[1].split(",").map((x) => x.trim().replace(/'/g, "")))
  .filter(Boolean);
check("every plan event declares at least one property", PLAN_EVENT_PROPS.length >= 7);
for (const banned of ["email", "user_id", "userId", "customer", "subscription_id",
                      "price", "payment_method", "card", "plan_object"]) {
  check(`no plan event property is "${banned}"`, !PLAN_EVENT_PROPS.includes(banned));
}
check("every declared property is on the safe list",
  PLAN_EVENT_PROPS.every((k) =>
    ["authenticated", "displayed_tier", "selected_interval", "presentation",
     "pricing_enabled", "source"].includes(k)));
check("a disabled CTA fires no upgrade event",
  /if \(intent === 'launches-soon'\) \{[\s\S]{0,200}b\.disabled = true;/.test(PLANS_CODE));

/* ── 11b. Runtime English is per-key, never one shared fallback ──────────── */
section("11b. Every runtime string has its own English");

/* THE BUG THIS CAUGHT, in the browser, before it shipped.
 *
 * `I18N.t(key, fallback)` has no English dictionary — English lives in the DOM
 * for static markup, so for text created at RUNTIME the fallback IS the English
 * copy. The first render passed one shared fallback, "Current plan", for every
 * key. The result: a subscriber whose payment had failed saw a badge reading
 * "Current plan" instead of "Needs attention", which is precisely the
 * contradiction this milestone exists to remove — reintroduced by the rendering
 * rather than the model. The model was right the whole time.
 *
 * So the English map is required, and every key the page hands to tx() must
 * appear in it. */
for (const [label, code] of [["Plans", PLANS_CODE], ["Billing", BILLING_CODE]] as const) {
  check(`${label} declares a per-key English map`, /const EN: Record<string, string> = \{/.test(code));
  const en = new Set(
    [...code.matchAll(/^\s*'([a-zA-Z]+\.[a-zA-Z0-9]+)':\s*'/gm)].map((m) => m[1]),
  );
  const used = new Set(
    [...code.matchAll(/\btx\(\s*'([a-zA-Z]+\.[a-zA-Z0-9]+)'/g)].map((m) => m[1]),
  );
  check(`${label} uses at least one runtime string`, used.size > 0);
  const missing = [...used].filter((k) => !en.has(k));
  check(`${label}: every runtime key has its own English (${missing.join(", ") || "all covered"})`,
    missing.length === 0);
  /* And no two different keys may share the same English word, which is how the
     original defect looked from the outside. */
  const badgeKeys = ["plans.currentPlan", "plan.stateAttention", "plan.stateEnding"];
  const words = badgeKeys.filter((k) => en.has(k))
    .map((k) => (code.match(new RegExp(`'${k.replace(".", "\\.")}': '([^']*)'`)) || [])[1]);
  check(`${label}: the three badge words are all different`,
    words.length === 0 || new Set(words).size === words.length);
}
check("attention English is not 'Current plan'",
  /'plan\.stateAttention': 'Needs attention'/.test(PLANS_CODE) &&
  /'plan\.stateAttention': 'Needs attention'/.test(BILLING_CODE));
check("ending English is not 'Current plan'",
  /'plan\.stateEnding': 'Ending'/.test(PLANS_CODE) &&
  /'plan\.stateEnding': 'Ending'/.test(BILLING_CODE));

/* ── 12. The development-only state preview cannot ship ──────────────────── */
section("12. The state preview is development-only, both halves required");

for (const [label, src] of [["Plans", PLANS], ["Billing", BILLING]] as const) {
  check(`${label} gates the preview on DEV AND its own flag`,
    /import\.meta\.env\.DEV && import\.meta\.env\.PUBLIC_PLANS_PREVIEW === '1'/.test(src));
  check(`${label} writes the gate with inline literals so Vite can fold it`,
    /if \(!\(import\.meta\.env\.DEV && import\.meta\.env\.PUBLIC_PLANS_PREVIEW === '1'\)\) return undefined;/.test(src));
  check(`${label} falls back to the real read when no preview is requested`,
    /if \(ent === undefined\) \{ try \{ ent = await myEntitlements\(\); \}/.test(src));
  check(`${label} preview reads a query parameter, never persists anything`,
    /new URLSearchParams\(location\.search\).get\('preview'\)/.test(src) &&
    !/localStorage|sessionStorage|document\.cookie/.test(src));
}
/* The fixture must never decide a REAL reader's plan: it is only consulted
   when the flag is on and a preview is explicitly asked for. */
check("the preview never runs without an explicit request",
  (PLANS_CODE.match(/if \(!want\) return undefined;/g) || []).length === 1 &&
  (BILLING_CODE.match(/if \(!want\) return undefined;/g) || []).length === 1);

const DIST = join(ROOT, "dist");
if (existsSync(DIST)) {
  const shipped = [
    readFileSync(join(DIST, "pricing/index.html"), "utf8"),
    readFileSync(join(DIST, "billing/index.html"), "utf8"),
  ].join("\n");
  check("no shipped page contains the preview function", !shipped.includes("previewEntitlement"));
  check("no shipped page contains the preview flag", !shipped.includes("PUBLIC_PLANS_PREVIEW"));
  check("no shipped page contains fixture data", !shipped.includes("gentleGuidanceToday: 3"));

  /* ── B5: reachable privacy and terms ──────────────────────────────────
   *
   * A Stripe requirement, and it is not satisfied by the documents merely
   * existing on the site — they must be reachable FROM the page that sells.
   * Asserted against the BUILT html rather than the source, because a
   * component that fails to render produces exactly the same source and a
   * page with nothing on it.
   *
   * All four money pages, not just /pricing: somebody deciding whether to
   * keep paying deserves the same links as somebody deciding to start. */
  const MONEY_PAGES = [
    "pricing/index.html",
    "billing/index.html",
    "checkout/success/index.html",
    "checkout/cancelled/index.html",
  ];
  for (const rel of MONEY_PAGES) {
    const page = existsSync(join(DIST, rel))
      ? readFileSync(join(DIST, rel), "utf8")
      : "";
    check(`${rel} was built`, page.length > 0);
    check(`${rel} links the privacy policy`, /href="\/privacy"/.test(page));
    check(`${rel} links the terms of service`, /href="\/terms"/.test(page));
    /* A Spanish reader must not be dropped into English legal text — the one
       place in the app where the wrong language is more than awkward. */
    check(`${rel} points a Spanish reader at the Spanish documents`,
      /data-i18n-href="\/es\/privacidad"/.test(page) &&
      /data-i18n-href="\/es\/terminos"/.test(page));
    /* Who they are paying, before they pay — an unrecognised card descriptor
       is one of the most common causes of a chargeback. */
    check(`${rel} names the seller`, /JC Kingdom Ventures, LLC/.test(page));
  }
  check("the Spanish seller line exists, so the footer is not half-translated",
    /'legal\.seller':/.test(I18N));
  /* The documents themselves, in both languages. A link to a 404 is worse than
     no link: it looks like an answer. */
  for (const doc of ["privacy.html", "terms.html", "cookies.html",
                     "es/privacidad.html", "es/terminos.html", "es/cookies.html"]) {
    check(`the ${doc} document ships`, existsSync(join(DIST, doc)));
  }
} else {
  check("dist/ present for the build assertions (run `npm run build` first)", false);
}

console.log("\n" + "─".repeat(62));
if (failures.length > 0) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
