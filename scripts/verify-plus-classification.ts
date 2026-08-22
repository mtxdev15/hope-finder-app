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
import { PAST_DUE_GRACE_MS } from "../convex/entitlementCatalog.ts";

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

/* ── 8. Pinned-version field readers (2026-06-24.dahlia) ─────────────────────
 *
 * These fixtures are the REAL shapes read back from the sandbox on 2026-08-21,
 * after a genuine $8.99 monthly purchase completed through the app. Ids and
 * timestamps are the actual ones; nothing here is invented.
 *
 * The readers were provisional until that purchase — they accepted both the
 * old root-level locations and the new ones. They are now narrowed to the one
 * location each field actually occupies. These tests are what stop someone
 * widening them back "just in case": a payload carrying ONLY the old fields is
 * not a valid pinned-version payload, and accepting it would let version drift
 * flow into the entitlement tables looking healthy.
 *
 * The functions are EXTRACTED FROM convex/http.ts VERBATIM by brace-walking,
 * the same technique verify-webhook-signature.ts uses on the Worker. Testing a
 * copy would prove nothing about the code that runs.
 */
section("8. Pinned-version field readers — narrowed to dahlia");

/* Slice a TOP-LEVEL function out of a Convex source file.
 *
 * Brace-walking from the first `{` — the technique verify-webhook-signature.ts
 * uses on the plain-JS Worker — does NOT work here: a TypeScript return type
 * like `: { start?: number; end?: number }` contains braces of its own and the
 * walk terminates on the type annotation instead of the body. These functions
 * are top level, so their closing brace is the first `}` at column zero. */
function extractFn(src: string, signature: string): string {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error("not found: " + signature);
  const end = src.indexOf("\n}", start);
  if (end < 0) throw new Error("no top-level terminator for: " + signature);
  return src.slice(start, end + 2);
}

/* Strip the TypeScript signature so plain node can evaluate the body verbatim.
 * Deliberately an exact-string swap and not a clever regex: if a signature ever
 * changes, this throws loudly rather than silently testing something else. */
function deType(fnSrc: string, from: string, to: string): string {
  if (!fnSrc.includes(from)) {
    throw new Error("signature changed, update this test — expected: " + from);
  }
  return fnSrc.replace(from, to);
}

const readers: any = await import(
  "data:text/javascript," +
    encodeURIComponent(
      deType(
        extractFn(HTTP, "function readPeriod"),
        "function readPeriod(sub: any): { start?: number; end?: number } {",
        "function readPeriod(sub) {",
      ) +
        "\n" +
        deType(
          extractFn(HTTP, "function readInvoiceSubscriptionId"),
          "function readInvoiceSubscriptionId(obj: any): string | null {",
          "function readInvoiceSubscriptionId(obj) {",
        ) +
        "\nexport { readPeriod, readInvoiceSubscriptionId };",
    )
);
const { readPeriod, readInvoiceSubscriptionId } = readers;

/* The real values from sub_1U6yXVLShxhb4mBzedFqJMQ0. */
const PERIOD_START = 1787342144;
const PERIOD_END = 1790020544;
const REAL_SUB_ID = "sub_1U6yXVLShxhb4mBzedFqJMQ0";

/* Exactly the shape dahlia returned: period on the ITEM, absent from the root. */
const DAHLIA_SUB = {
  id: REAL_SUB_ID,
  object: "subscription",
  status: "active",
  cancel_at_period_end: false,
  customer: "cus_V7BLkBE2Tz1hPY",
  latest_invoice: "in_1U6yXULShxhb4mBzLJTRiksn",
  items: {
    object: "list",
    total_count: 1,
    data: [
      {
        id: "si_V7CxTE1NcDXn0s",
        object: "subscription_item",
        current_period_start: PERIOD_START,
        current_period_end: PERIOD_END,
        quantity: 1,
        price: {
          id: MONTHLY_PRICE,
          lookup_key: "plus_monthly_usd_v1",
          recurring: { interval: "month", interval_count: 1 },
        },
      },
    ],
  },
  metadata: {
    plan: "plus_monthly",
    source: CHECKOUT_SOURCE,
    billing_schema_version: BILLING_SCHEMA_VERSION,
    environment: "sandbox",
    userId: "REDACTED_USER_ID",
  },
};

/* Exactly the shape dahlia returned for in_1U6yXULShxhb4mBzLJTRiksn: the
 * subscription link nested under `parent`, with NO top-level `subscription`. */
const DAHLIA_INVOICE = {
  id: "in_1U6yXULShxhb4mBzLJTRiksn",
  object: "invoice",
  status: "paid",
  billing_reason: "subscription_create",
  parent: {
    type: "subscription_details",
    quote_details: null,
    subscription_details: { subscription: REAL_SUB_ID, metadata: {} },
  },
};

/* ── 8a. The dahlia shapes are accepted ──────────────────────────────────── */
const p = readPeriod(DAHLIA_SUB);
check("dahlia: period start read from items.data[0]", p.start === PERIOD_START);
check("dahlia: period end read from items.data[0]", p.end === PERIOD_END);
check("dahlia: invoice subscription read from parent.subscription_details",
  readInvoiceSubscriptionId(DAHLIA_INVOICE) === REAL_SUB_ID);
check("dahlia: expanded subscription object at the same location still works",
  readInvoiceSubscriptionId({
    parent: { subscription_details: { subscription: { id: REAL_SUB_ID, object: "subscription" } } },
  }) === REAL_SUB_ID);

/* ── 8b. The obsolete root-level shapes are NOT accepted ─────────────────── */
const OBSOLETE_SUB = {
  id: REAL_SUB_ID,
  status: "active",
  // Pre-dahlia location, and ONLY that location.
  current_period_start: PERIOD_START,
  current_period_end: PERIOD_END,
  items: { data: [{ id: "si_x", price: { id: MONTHLY_PRICE } }] },
};
const op = readPeriod(OBSOLETE_SUB);
check("obsolete: root current_period_start yields NO start", op.start === undefined);
check("obsolete: root current_period_end yields NO end", op.end === undefined);

check("obsolete: top-level invoice.subscription yields NO id",
  readInvoiceSubscriptionId({ id: "in_x", object: "invoice", subscription: REAL_SUB_ID }) === null);
check("obsolete: expanded top-level invoice.subscription yields NO id",
  readInvoiceSubscriptionId({ id: "in_x", subscription: { id: REAL_SUB_ID } }) === null);

/* Belt and braces: if BOTH shapes are present, the pinned one must win and the
 * obsolete one must never be consulted. A payload like this can only come from
 * a version mismatch, and taking the old value would hide it. */
const p2 = readPeriod({
  current_period_start: 1,
  current_period_end: 2,
  items: { data: [{ current_period_start: PERIOD_START, current_period_end: PERIOD_END }] },
});
check("both present: the ITEM values win, never the root", p2.start === PERIOD_START && p2.end === PERIOD_END);
check("both present: the NESTED invoice id wins, never the root",
  readInvoiceSubscriptionId({
    subscription: "sub_OBSOLETE",
    parent: { subscription_details: { subscription: REAL_SUB_ID } },
  }) === REAL_SUB_ID);

/* ── 8c. Fail closed on malformed or missing pinned fields ───────────────── */
for (const [name, sub] of [
  ["no items array", { id: "sub_x" }],
  ["empty items", { id: "sub_x", items: { data: [] } }],
  ["item without period", { id: "sub_x", items: { data: [{ id: "si_x" }] } }],
  ["period as string", { id: "sub_x", items: { data: [{ current_period_start: "1787342144" }] } }],
  ["period as null", { id: "sub_x", items: { data: [{ current_period_start: null, current_period_end: null }] } }],
  ["undefined subscription", undefined],
  ["null subscription", null],
] as [string, any][]) {
  const r = readPeriod(sub);
  check(`fail closed: ${name} -> no period values`, r.start === undefined && r.end === undefined);
}

for (const [name, inv] of [
  ["no parent", { id: "in_x" }],
  ["parent without subscription_details", { id: "in_x", parent: { type: "quote_details" } }],
  ["subscription_details without subscription", { id: "in_x", parent: { subscription_details: {} } }],
  ["subscription empty string", { id: "in_x", parent: { subscription_details: { subscription: "" } } }],
  ["subscription is a number", { id: "in_x", parent: { subscription_details: { subscription: 42 } } }],
  ["object without id", { id: "in_x", parent: { subscription_details: { subscription: {} } } }],
  ["undefined invoice", undefined],
  ["null invoice", null],
] as [string, any][]) {
  check(`fail closed: invoice ${name} -> null`, readInvoiceSubscriptionId(inv) === null);
}

/* A missing period must not corrupt the row: applyWebhook spreads the field in
 * only when it is present, so a bad payload leaves prior good state intact
 * rather than overwriting it with undefined. */
check("a missing period is OMITTED from the mutation, not written as undefined",
  /\.\.\.\(period\.start != null[\s\S]{0,80}currentPeriodStart: period\.start/.test(HTTP));
check("a missing period end is likewise omitted",
  /\.\.\.\(period\.end != null[\s\S]{0,80}currentPeriodEnd: period\.end/.test(HTTP));
check("no subscription id -> acknowledge without applying",
  /if \(!subscriptionId\) return ACK\(\);/.test(HTTP));

/* ── 8d. The old fallbacks are gone from the source ──────────────────────── */
const READER_SRC =
  extractFn(HTTP, "function readPeriod") + extractFn(HTTP, "function readInvoiceSubscriptionId");
check("readPeriod no longer reads the subscription root",
  !/sub\?\.current_period_start|sub\?\.current_period_end/.test(READER_SRC));
check("readInvoiceSubscriptionId no longer reads obj.subscription",
  !/const direct = obj\?\.subscription/.test(READER_SRC));
check("readers are no longer labelled provisional", !/PROVISIONAL FIELD READERS/.test(HTTP));
check("the pinned version is named where the readers are defined",
  /PINNED FIELD READERS \(2026-06-24\.dahlia\)/.test(HTTP));

/* ── 8e. Unchanged by design ─────────────────────────────────────────────── */
check("Checkout Session subscription reader is UNCHANGED (session.subscription)",
  /subscriptionId = asId\(obj\.subscription\);/.test(HTTP));
/* UPDATED by the C6 cancellation finding, deliberately.
 *
 * This asserted that `cancel_at_period_end` is read at the subscription root
 * with a `typeof === "boolean"` guard. That was true, and it was ALSO the bug:
 * the root boolean was the ONLY thing read. Under 2026-06-24.dahlia with
 * flexible billing, an end-of-period cancellation leaves that boolean FALSE and
 * expresses the schedule in `cancel_at` instead, so Convex stored "not
 * cancelling" for a cancelled subscriber.
 *
 * The field did not move — the root boolean is still consulted, and is still
 * authoritative when true. What changed is that it is no longer sufficient on
 * its own. Both signals are now asserted, at the place that reads them. */
check("the root cancel_at_period_end is still consulted",
  /cancelAtPeriodEnd: sub\.cancel_at_period_end,/.test(HTTP));
check("cancel_at is ALSO consulted, at the subscription root",
  /cancelAt: sub\.cancel_at,/.test(HTTP));
check("both are fed through the shared normalizer, not compared inline",
  /cancelAtPeriodEnd: deriveCancelAtPeriodEnd\(\{/.test(HTTP));
check("the normalizer compares cancel_at against the item period end",
  /currentPeriodEnd: period\.end,/.test(HTTP));
check("canceled_at still read at the subscription root",
  /typeof sub\.canceled_at === "number"/.test(HTTP));

/* ── 9. Classification and entitlement still pass on the REAL payload ─────── */
section("9. The real purchase still classifies and grants Plus");

const REAL_ENV = {
  STRIPE_PLUS_MONTHLY_PRICE_ID: MONTHLY_PRICE,
  STRIPE_PLUS_ANNUAL_PRICE_ID: ANNUAL_PRICE,
};
const realVerdict = classifyPlusSubscription({
  subscription: DAHLIA_SUB,
  session: null,
  approvedPrices: approvedPricesFromEnv(REAL_ENV),
  environment: "sandbox",
});
check("the real dahlia subscription classifies as Plus", realVerdict.ok === true);
check("and resolves to plus_monthly",
  realVerdict.ok === true && realVerdict.planKey === "plus_monthly");

/* The entitlement interpreter, extracted verbatim from convex/entitlements.ts.
 * The row below is the one Convex actually wrote. */
const ENT_SRC = readFileSync(new URL("../convex/entitlements.ts", import.meta.url), "utf8");
const ent: any = await import(
  "data:text/javascript," +
    encodeURIComponent(
      "const PAST_DUE_GRACE_MS = " + PAST_DUE_GRACE_MS + ";\n" +
        deType(
          extractFn(ENT_SRC, "function interpret"),
          "function interpret(\n  sub: any,\n  now: number,\n): { tier: Tier; status: string; needsAttention: boolean; graceEndsAt: number | null } {",
          "function interpret(sub, now) {",
        ) +
        "\nexport { interpret };",
    )
);

const REAL_ROW = {
  provider: "stripe",
  planKey: "plus_monthly",
  environment: "sandbox",
  tier: "plus",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodStart: PERIOD_START,
  currentPeriodEnd: PERIOD_END,
  updatedAt: 1787342148189,
};
const NOW = 1787342200000; // just after the purchase
check("the real row grants Plus", ent.interpret(REAL_ROW, NOW).tier === "plus");
check("and needs no attention", ent.interpret(REAL_ROW, NOW).needsAttention === false);

/* Fail closed: a row whose period never arrived must not become an unbounded
 * free ride. past_due with no period falls back to updatedAt, so grace still
 * ENDS. This is the case a widened reader would have produced. */
const NO_PERIOD_ROW = { ...REAL_ROW, status: "past_due", currentPeriodEnd: undefined };
const pastDue = ent.interpret(NO_PERIOD_ROW, NOW);
check("past_due with no period still has a bounded grace deadline",
  typeof pastDue.graceEndsAt === "number" && pastDue.graceEndsAt < NOW + PAST_DUE_GRACE_MS + 1000);
check("past_due surfaces paymentNeedsAttention", pastDue.needsAttention === true);
check("past_due beyond grace drops to free",
  ent.interpret(NO_PERIOD_ROW, NOW + PAST_DUE_GRACE_MS * 3).tier === "free");
check("an unclassifiable status is free, never plus",
  ent.interpret({ ...REAL_ROW, status: "incomplete_expired" }, NOW).tier === "free");

/* ── 10. Out-of-order delivery stays safe ─────────────────────────────────── */
section("10. Out-of-order webhook delivery");

/* This is not hypothetical. On 2026-08-21 the real purchase delivered
 * invoice.paid BEFORE customer.subscription.created. Anyone who assumes Stripe
 * delivers lifecycle events in causal order will write a bug. */
const SUBS_SRC = readFileSync(new URL("../convex/subscriptions.ts", import.meta.url), "utf8");

check("replay is refused before any write",
  SUBS_SRC.indexOf("if (seen) return { ok: true, deduped: true }") <
    SUBS_SRC.indexOf("const fields = {"));
check("an older event never overwrites newer state",
  /if \(args\.eventCreated < existing\.lastProviderEventAt\)/.test(SUBS_SRC));
/* recordEvent now carries the outcome, so this pins that too: the event is
 * still recorded and then dropped, and it is recorded AS stale rather than
 * being indistinguishable from an ordinary apply. */
check("a stale event is recorded, then dropped",
  /await recordEvent\("stale"\);\s*\n\s*return \{ ok: true, stale: true \}/.test(SUBS_SRC));
check("dedup is indexed, not a table scan", /by_provider_event/.test(SUBS_SRC));
check("every applied event is recorded", /insert\("billingEvents"/.test(SUBS_SRC));

/* The ordering predicate itself, exercised directly. */
const stale = (incoming: number, lastSeen: number) => incoming < lastSeen;
check("invoice.paid arriving first is NOT stale (nothing seen yet)", stale(1787342147, 0) === false);
check("subscription.created arriving second is not stale", stale(1787342147, 1787342147) === false);
check("a genuinely older event IS stale", stale(1787342100, 1787342147) === true);
check("an equal timestamp is applied, not dropped — Stripe batches within a second",
  stale(1787342147, 1787342147) === false);

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
