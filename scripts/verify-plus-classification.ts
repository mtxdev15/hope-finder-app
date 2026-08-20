/* Declare & Believe — Plus classification (C2) and Stripe API versioning (C5).
 *
 * WHAT THIS EXISTS TO PREVENT
 * The retired donation flow used `mode: "subscription"` for recurring gifts.
 * The Worker's old guard was:
 *
 *     if (obj.mode !== 'subscription') return ok;
 *
 * with a comment claiming it excluded recurring gifts. It did not — a recurring
 * gift IS mode 'subscription'. A completed gift would have been forwarded as a
 * Plus purchase and granted Plus to a donor who never bought it.
 *
 * Fixtures A and B below are built from REAL archived Checkout Sessions read out
 * of the Declare checkout dev sandbox during the Stage 2 audit. Their Price ids,
 * Product ids, intervals and amounts are the genuine values. They are permanent
 * negative tests: if either is ever accepted, the contamination bug is back.
 *
 * No network, no credential, no deployment. Run:  node scripts/verify-plus-classification.ts
 */
import { readFileSync } from "node:fs";
import {
  classifyPlusSubscription,
  approvedPricesFromEnv,
  environmentForSecret,
  BILLING_SCHEMA_VERSION,
  CHECKOUT_SOURCE,
  PLAN_CATALOG,
} from "../convex/plusPlans.ts";
import { STRIPE_API_VERSION } from "../convex/stripeApi.ts";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) {
  if (ok) passed++;
  else failures.push(name);
}
function section(t: string) { console.log("\n" + t + "\n"); }

/* Stand-in Price ids for the Plus prices that do not exist yet. The sandbox
 * objects have not been created — that is the point of the stop gate — so the
 * suite supplies its own and does not depend on any Stripe state. */
const MONTHLY_PRICE = "price_TEST_plus_monthly";
const ANNUAL_PRICE = "price_TEST_plus_annual";

const ENV = {
  STRIPE_PLUS_MONTHLY_PRICE_ID: MONTHLY_PRICE,
  STRIPE_PLUS_ANNUAL_PRICE_ID: ANNUAL_PRICE,
};
const approvedPrices = approvedPricesFromEnv(ENV);

const USER = "user_abc123";

function provenance(over: Record<string, any> = {}) {
  return {
    userId: USER,
    plan: "plus_monthly",
    source: CHECKOUT_SOURCE,
    billing_schema_version: BILLING_SCHEMA_VERSION,
    environment: "sandbox",
    ...over,
  };
}

function subscription(priceOver: Record<string, any>, metadata: Record<string, any>, extra: Record<string, any> = {}) {
  return {
    id: "sub_test",
    status: "active",
    metadata,
    items: { data: [{ price: { id: "price_unknown", recurring: { interval: "month" }, ...priceOver } }] },
    ...extra,
  };
}

function classify(sub: any, session: any = null, environment: any = "sandbox") {
  return classifyPlusSubscription({ subscription: sub, session, approvedPrices, environment });
}

/* ── The real archived donation shapes ───────────────────────────────────── */
section("1. Retired donation fixtures must NEVER become Plus");

/* FIXTURE A — cs_test_a17DEPT5…, created 2026-06-27, $50.00, every 2 weeks,
 * Product prod_UlsbiVg5ZSHMgD "Recurring gift — Declare & Believe".
 * mode WAS "subscription". Real values from the sandbox. */
const giftRecurringBiweekly = subscription(
  {
    id: "price_1Tn06KLShxhb4mBzjdWxGYBV",
    lookup_key: null,
    product: "prod_UlsbiVg5ZSHMgD",
    recurring: { interval: "week", interval_count: 2 },
    unit_amount: 5000,
  },
  {}, // gifts carried no canonical plan and no provenance
);
const sessionA = { mode: "subscription", client_reference_id: null, metadata: {} };
const rA = classify(giftRecurringBiweekly, sessionA);
check("A: real biweekly recurring gift is REJECTED", rA.ok === false);
check("A: rejected on the Price, not on mode", rA.ok === false && rA.reason === "price-not-approved");

/* FIXTURE B — cs_test_a1X0CFpe…, created 2026-06-25, $50.00, monthly,
 * same "Recurring gift" Product. mode WAS "subscription". */
const giftRecurringMonthly = subscription(
  {
    id: "price_1TmKqdLShxhb4mBzrVO2hN9n",
    lookup_key: null,
    product: "prod_UlsbiVg5ZSHMgD",
    recurring: { interval: "month", interval_count: 1 },
    unit_amount: 5000,
  },
  {},
);
const rB = classify(giftRecurringMonthly, { mode: "subscription", client_reference_id: null, metadata: {} });
check("B: real monthly recurring gift is REJECTED", rB.ok === false);

/* The nastiest variant: a gift whose Price somehow carried our metadata. The
 * Price is still not ours, so it must still fail. Belt and braces on E1. */
const rB2 = classify(subscription(
  { id: "price_1TmKqdLShxhb4mBzrVO2hN9n", product: "prod_UlsbiVg5ZSHMgD", recurring: { interval: "month" } },
  provenance(),
), null);
check("B2: gift Price + forged-looking metadata still REJECTED", rB2.ok === false && rB2.reason === "price-not-approved");

/* FIXTURE C — cs_test_a1EryL1g…, the completed PAID $250 one-time gift.
 * mode "payment", so no subscription exists at all. */
const rC = classify(null, { mode: "payment", metadata: {} });
check("C: completed one-time gift ($250, paid) is REJECTED", rC.ok === false && rC.reason === "no-subscription");

/* ── Valid Plus ──────────────────────────────────────────────────────────── */
section("2. Genuine Plus purchases are accepted");

const validMonthly = subscription({ id: MONTHLY_PRICE, recurring: { interval: "month" } }, provenance());
const sessionD = { mode: "subscription", client_reference_id: USER, metadata: provenance() };
const rD = classify(validMonthly, sessionD);
check("D: valid Plus monthly ACCEPTED", rD.ok === true);
check("D: resolves to plus_monthly", rD.ok === true && rD.planKey === "plus_monthly");

const validAnnual = subscription(
  { id: ANNUAL_PRICE, recurring: { interval: "year" } },
  provenance({ plan: "plus_annual" }),
);
const rE = classify(validAnnual, { mode: "subscription", client_reference_id: USER, metadata: provenance({ plan: "plus_annual" }) });
check("E: valid Plus annual ACCEPTED", rE.ok === true);
check("E: resolves to plus_annual", rE.ok === true && rE.planKey === "plus_annual");

/* Lifecycle events after checkout carry NO session. They must still classify,
 * which is the whole reason provenance is stamped onto subscription_data. */
const rE2 = classify(validMonthly, null);
check("E2: later lifecycle event (no session) still ACCEPTED", rE2.ok === true);

/* Price id unknown but lookup_key is ours — the documented fallback. */
const rE3 = classify(subscription(
  { id: "price_rotated_unknown", lookup_key: PLAN_CATALOG.plus_monthly.lookupKey, recurring: { interval: "month" } },
  provenance(),
), null);
check("E3: unknown Price id but approved lookup_key ACCEPTED", rE3.ok === true);

/* ── Each evidence check individually ────────────────────────────────────── */
section("3. Every piece of evidence is load-bearing");

const rF = classify(subscription({ id: MONTHLY_PRICE }, {}), null);
check("F: approved Price but NO metadata.plan is REJECTED", rF.ok === false && rF.reason === "plan-metadata-missing");

const rG = classify(subscription({ id: "price_not_ours" }, provenance()), null);
check("G: canonical plan but unapproved Price is REJECTED", rG.ok === false && rG.reason === "price-not-approved");

const rH = classify(subscription({ id: MONTHLY_PRICE }, provenance({ plan: "plus_annual" })), null);
check("H: plan/Price mismatch is REJECTED", rH.ok === false && rH.reason === "plan-price-mismatch");

const rI = classify(
  subscription({ id: MONTHLY_PRICE }, provenance()),
  { mode: "subscription", client_reference_id: "user_someone_else", metadata: provenance() },
);
check("I: client_reference_id != metadata.userId is REJECTED", rI.ok === false && rI.reason === "provenance-client-reference-mismatch");

const rJ = classify(subscription({ id: MONTHLY_PRICE }, provenance()), null, "production");
check("J: sandbox purchase seen by production is REJECTED", rJ.ok === false && rJ.reason === "environment-mismatch");

const rK = classify(subscription({ id: MONTHLY_PRICE }, provenance({ source: "somewhere-else" })), null);
check("K: wrong provenance source is REJECTED", rK.ok === false && rK.reason === "provenance-source");

const rL = classify(subscription({ id: MONTHLY_PRICE }, provenance({ billing_schema_version: "0" })), null);
check("L: wrong billing_schema_version is REJECTED", rL.ok === false && rL.reason === "provenance-schema-version");

const rM = classify(subscription({ id: MONTHLY_PRICE }, provenance({ userId: undefined })), null);
check("M: missing stamped userId is REJECTED", rM.ok === false && rM.reason === "provenance-user-missing");

const multi = {
  id: "sub_multi", status: "active", metadata: provenance(),
  items: { data: [
    { price: { id: MONTHLY_PRICE, recurring: { interval: "month" } } },
    { price: { id: "price_something_else", recurring: { interval: "month" } } },
  ] },
};
const rN = classify(multi, null);
check("N: multi-item subscription is REJECTED", rN.ok === false && rN.reason === "unexpected-multiple-items");

const rO = classify(subscription({ id: MONTHLY_PRICE }, provenance()), null, null);
check("O: unresolvable environment is REJECTED", rO.ok === false && rO.reason === "environment-unresolvable");

/* ── Environment derivation ──────────────────────────────────────────────── */
section("4. Environment is derived from the credential, not asserted");

check("sk_test_ -> sandbox", environmentForSecret("sk_test_abc") === "sandbox");
check("rk_test_ -> sandbox", environmentForSecret("rk_test_abc") === "sandbox");
check("sk_live_ -> production", environmentForSecret("sk_live_abc") === "production");
check("rk_live_ -> production", environmentForSecret("rk_live_abc") === "production");
check("unrecognised key shape -> null, never a guess", environmentForSecret("whatever") === null);
check("absent key -> null", environmentForSecret(undefined) === null);

/* ── Source-level guarantees (C5 + runtime split) ────────────────────────── */
section("5. The Worker holds no Stripe credential");

const WORKER = readFileSync(new URL("../worker/src/index.js", import.meta.url), "utf8");
const HTTP = readFileSync(new URL("../convex/http.ts", import.meta.url), "utf8");
const BILLING = readFileSync(new URL("../convex/billing.ts", import.meta.url), "utf8");
const STRIPE_API_SRC = readFileSync(new URL("../convex/stripeApi.ts", import.meta.url), "utf8");

check("Worker never reads env.STRIPE_SECRET_KEY", !/env\.STRIPE_SECRET_KEY/.test(WORKER));
check("Worker never calls the Stripe API", !/api\.stripe\.com/.test(WORKER));
check("Worker has no subscription fetch", !/fetchStripeSubscription/.test(WORKER));
check("Worker forwards the payload verbatim", /body:\s*payload/.test(WORKER));
check("Worker still verifies the Stripe signature", /verifyStripeSignature\(/.test(WORKER));
check("Worker bounds the body", /MAX_WEBHOOK_BYTES/.test(WORKER));
check("Worker no longer classifies on mode",
  !/obj\.mode\s*!==\s*'subscription'/.test(WORKER));

section("6. One pinned Stripe API version, sent on every request");

check("stripeApi pins an explicit version", /STRIPE_API_VERSION\s*=\s*"20\d\d-\d\d-\d\d/.test(STRIPE_API_SRC));
check("every request sends Stripe-Version", /"Stripe-Version":\s*STRIPE_API_VERSION/.test(STRIPE_API_SRC));
check("pinned version is 2026-06-24.dahlia", STRIPE_API_VERSION === "2026-06-24.dahlia");
check("Convex billing uses the shared client, not raw fetch",
  /from "\.\/stripeApi"/.test(BILLING) && !/api\.stripe\.com/.test(BILLING));

section("7. Provenance is stamped where later events can read it");

check("checkout stamps metadata AND subscription_data metadata",
  /form\["metadata\[" \+ k \+ "\]"\]/.test(BILLING) &&
  /form\["subscription_data\[metadata\]\[" \+ k \+ "\]"\]/.test(BILLING));
check("checkout stamps the canonical plan key, not the browser alias",
  /plan:\s*planKey/.test(BILLING));
check("automatic tax is explicitly disabled for this phase",
  /"automatic_tax\[enabled\]":\s*"false"/.test(BILLING));
check("no trial is configured", !/trial_period_days|trial_end/.test(BILLING));
check("Convex webhook classifies before applying",
  HTTP.indexOf("classifyPlusSubscription") < HTTP.indexOf("internal.subscriptions.applyWebhook"));
check("Convex webhook does not decide Plus from mode",
  !/obj\.mode\s*!==\s*["']subscription["']/.test(HTTP));

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
