/* Declare & Believe — buying Lifetime while already subscribed.
 *
 * WHAT THIS EXISTS TO PREVENT, and it was NOT the double charge.
 *
 * `createCheckoutSession` deliberately lets a live subscriber buy Lifetime:
 * `buyingLifetimeOnTop` bypasses all three stacking guards in billing.ts. The
 * webhook then REFUSED to record it, because a one-time purchase creates no
 * Subscription object, so the incoming id is null, which is neither the
 * canonical id nor a replaceable status:
 *
 *     classifyIncomingSubscription({
 *       existing: { stripeSubscriptionId: "sub_LIVE", status: "active" },
 *       incomingSubscriptionId: null,
 *     })
 *     -> { ok: false, reason: "duplicate-subscription" }
 *
 * $149 charged, event acknowledged, conflict row written, nothing granted.
 * Found by RUNNING the classifier against that input, not by reading it.
 *
 * The three properties this suite pins down, in the order they must hold:
 *   1. the grant lands            nobody pays for nothing
 *   2. the subscription is cancelled and its id is CLEARED from the row
 *                                 nobody is billed again, and the cancellation
 *                                 we cause cannot come back and overwrite the
 *                                 purchase that caused it
 *   3. the unused window is refunded, floored, never more than was paid
 *                                 nobody silently pays twice for one window
 *
 * Both decisions are IMPORTED and EXECUTED, never grepped: subscriptionGuard.ts
 * is the module applyWebhook calls, and lifetimeUpgrade.ts is the module that
 * decides how much money to send back.
 *
 * No network, no credential, no deployment, no Stripe call.
 * Run:  node scripts/verify-lifetime-upgrade.ts
 */
import { readFileSync } from "node:fs";
import { classifyIncomingSubscription } from "../convex/subscriptionGuard.ts";
import {
  readInvoicePaymentRef,
  settlementPlan,
  unusedCents,
} from "../convex/lifetimeUpgrade.ts";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const GUARD = read("convex/subscriptionGuard.ts");
const UPGRADE = read("convex/lifetimeUpgrade.ts");
const SUBS = read("convex/subscriptions.ts");
const BILLING = read("convex/billing.ts");
const SCHEMA = read("convex/schema.ts");

const LIVE = "sub_1U6yXVLShxhb4mBzedFqJMQ0";
const OTHER = "sub_1SOMEONEelsesSubscription";

/* ── 1. The bug itself ───────────────────────────────────────────────────── */
section("1. A subscriber buying Lifetime is recorded, not refused");

const monthlyRow = { stripeSubscriptionId: LIVE, status: "active", planKey: "plus_monthly" };
const buyLifetime = (existing: any, status = "paid") =>
  classifyIncomingSubscription({
    provider: "stripe",
    existing,
    incomingSubscriptionId: null,      // a one-time purchase HAS no subscription
    incomingPlanKey: "plus_lifetime",
    incomingStatus: status,
  });

const v1 = buyLifetime(monthlyRow);
check("an active monthly subscriber's lifetime purchase is allowed", v1.ok === true);
check("and it names the subscription to cancel",
  v1.ok === true && v1.supersedes === LIVE);

for (const status of ["trialing", "past_due", "unpaid"]) {
  const v = buyLifetime({ stripeSubscriptionId: LIVE, status, planKey: "plus_monthly" });
  check(`a ${status} subscription is superseded too`, v.ok === true && v.supersedes === LIVE);
}
/* Someone mid-trial has paid nothing yet, so there is nothing to refund — but
   the subscription still has to be cancelled or it converts in a few days. */

for (const status of ["canceled", "incomplete_expired", "ended"]) {
  const v = buyLifetime({ stripeSubscriptionId: LIVE, status, planKey: "plus_monthly" });
  check(`a ${status} subscription is not cancelled again`, v.ok === true && v.supersedes === undefined);
}
const noSub = buyLifetime({ status: "none", planKey: "plus_monthly" });
check("a free account's lifetime purchase cancels nothing",
  noSub.ok === true && noSub.supersedes === undefined);

/* THE ONE THAT MUST NOT SUPERSEDE. A refund arrives as planKey plus_lifetime
   with status "refunded". Acting on it would cancel a working subscription
   because somebody got their $149 back. */
const refunded = buyLifetime(monthlyRow, "refunded");
check("a REFUNDED lifetime never cancels a live subscription",
  refunded.ok === false || refunded.supersedes === undefined);

/* ── 2. The tail of the upgrade ──────────────────────────────────────────── */
section("2. The subscription we cancelled cannot overwrite the purchase");

const lifetimeRow = {
  status: "paid",
  planKey: "plus_lifetime",
  supersededSubscriptionId: LIVE,
  /* NO stripeSubscriptionId. That is the property, not an omission in the
     fixture: applyWebhook clears it, so `by_subscription` no longer routes the
     dead subscription's events onto this row. */
};
const tail = classifyIncomingSubscription({
  provider: "stripe", existing: lifetimeRow,
  incomingSubscriptionId: LIVE, incomingPlanKey: "plus_monthly", incomingStatus: "canceled",
});
check("its own deleted event is refused", tail.ok === false);
check("and quietly, as superseded rather than as a conflict",
  tail.ok === false && tail.reason === "lifetime-superseded");

const stranger = classifyIncomingSubscription({
  provider: "stripe", existing: lifetimeRow,
  incomingSubscriptionId: OTHER, incomingPlanKey: "plus_monthly", incomingStatus: "active",
});
check("a DIFFERENT subscription is still a loud conflict",
  stranger.ok === false && stranger.reason === "lifetime-not-replaceable");

check("applyWebhook clears the live id when superseding",
  /stripeSubscriptionId: undefined, supersededSubscriptionId: supersedes/.test(SUBS));
check("and the schema has somewhere to keep it",
  /supersededSubscriptionId: v\.optional\(v\.string\(\)\)/.test(SCHEMA));
check("the guard reads that field rather than re-deriving it",
  /supersededSubscriptionId\?: string;/.test(GUARD));

/* ── 3. Nothing else changed ─────────────────────────────────────────────── */
section("3. Every pre-existing verdict is untouched");

check("an ordinary duplicate is still refused",
  classifyIncomingSubscription({
    provider: "stripe", existing: monthlyRow, incomingSubscriptionId: OTHER,
  }).ok === false);
check("the same subscription is still allowed",
  classifyIncomingSubscription({
    provider: "stripe", existing: monthlyRow, incomingSubscriptionId: LIVE,
  }).ok === true);
check("Apple is still untouched",
  classifyIncomingSubscription({
    provider: "app_store", existing: monthlyRow, incomingSubscriptionId: null,
  }).ok === true);
/* THE OLD CALLERS. Every existing call site omits incomingPlanKey, and the new
   rule must be unreachable without it, or a plain subscription event could
   start cancelling things. */
check("without a plan key the new rule cannot fire",
  classifyIncomingSubscription({
    provider: "stripe", existing: monthlyRow, incomingSubscriptionId: null,
  }).ok === false);

/* ── 4. The money ────────────────────────────────────────────────────────── */
section("4. How much of the paid window is unused");

const DAY = 86400;
const START = 1_780_000_000;
const MONTH_END = START + 30 * DAY;

check("half a month of $8.99 is 449 cents",
  unusedCents({ amountPaid: 899, periodStart: START, periodEnd: MONTH_END,
    nowSeconds: START + 15 * DAY }) === 449);
check("the very first second refunds nearly all of it",
  unusedCents({ amountPaid: 899, periodStart: START, periodEnd: MONTH_END,
    nowSeconds: START + 1 }) === 898);
check("never MORE than was paid",
  unusedCents({ amountPaid: 899, periodStart: START, periodEnd: MONTH_END,
    nowSeconds: START }) <= 899);
check("the last second refunds nothing",
  unusedCents({ amountPaid: 899, periodStart: START, periodEnd: MONTH_END,
    nowSeconds: MONTH_END }) === 0);
check("a period already over refunds nothing",
  unusedCents({ amountPaid: 899, periodStart: START, periodEnd: MONTH_END,
    nowSeconds: MONTH_END + DAY }) === 0);

/* FLOORED, NEVER ROUNDED. One third of 899 is 299.67; refunding 300 would send
   back a cent that was never charged. */
check("the share is floored, not rounded",
  unusedCents({ amountPaid: 899, periodStart: START, periodEnd: START + 3 * DAY,
    nowSeconds: START + 2 * DAY }) === 299);

/* A trial invoices at zero, so this is the ordinary path for anyone upgrading
   inside their seven days, not an edge case. */
check("a zero-amount trial invoice refunds nothing",
  unusedCents({ amountPaid: 0, periodStart: START, periodEnd: MONTH_END,
    nowSeconds: START + DAY }) === 0);
check("an already-refunded charge is not refunded twice",
  unusedCents({ amountPaid: 899, amountRefunded: 899, periodStart: START,
    periodEnd: MONTH_END, nowSeconds: START + DAY }) === 0);
check("a partial previous refund is subtracted first",
  unusedCents({ amountPaid: 899, amountRefunded: 400, periodStart: START,
    periodEnd: MONTH_END, nowSeconds: START + 15 * DAY }) === 249);

/* Every input arrives from a payload. Anything unusable must settle at 0,
   which cancels and refunds nothing: a wrong 0 is a support email, a wrong
   large number is money out the door. */
for (const [name, bad] of [
  ["a missing period", { periodStart: undefined, periodEnd: MONTH_END }],
  ["a zero-length period", { periodStart: START, periodEnd: START }],
  ["a reversed period", { periodStart: MONTH_END, periodEnd: START }],
  ["milliseconds where seconds belong", { periodStart: START * 1000, periodEnd: MONTH_END }],
  ["a NaN boundary", { periodStart: START, periodEnd: NaN }],
  ["an Infinite boundary", { periodStart: START, periodEnd: Infinity }],
  ["a string amount", { periodStart: START, periodEnd: MONTH_END }],
] as const) {
  const cents = unusedCents({
    amountPaid: name === "a string amount" ? ("899" as any) : 899,
    nowSeconds: START + DAY, ...(bad as any),
  });
  check(`${name} refunds nothing`, cents === 0);
}
check("a negative amount refunds nothing",
  unusedCents({ amountPaid: -899, periodStart: START, periodEnd: MONTH_END,
    nowSeconds: START + DAY }) === 0);

/* ── 5. Where the money came from ────────────────────────────────────────── */
section("5. Reading the payment, or refusing to guess");

check("the 2025+ payments array is read first",
  JSON.stringify(readInvoicePaymentRef({
    payments: { data: [{ payment: { payment_intent: "pi_NEW" } }] },
    payment_intent: "pi_OLD",
  })) === JSON.stringify({ kind: "payment_intent", id: "pi_NEW" }));
check("a top-level payment_intent still works",
  JSON.stringify(readInvoicePaymentRef({ payment_intent: "pi_X" })) ===
    JSON.stringify({ kind: "payment_intent", id: "pi_X" }));
check("a bare charge still works",
  JSON.stringify(readInvoicePaymentRef({ charge: "ch_X" })) ===
    JSON.stringify({ kind: "charge", id: "ch_X" }));
check("an expanded object is read, not treated as absent",
  JSON.stringify(readInvoicePaymentRef({ payment_intent: { id: "pi_E" } })) ===
    JSON.stringify({ kind: "payment_intent", id: "pi_E" }));

/* THE POINT OF THE WHOLE SHAPE. This codebase has been bitten twice by a
   Stripe field that MOVED rather than vanished, and both times the reader
   failed silently. A refund is the wrong place to carry on. */
check("an unrecognised invoice shape returns null", readInvoicePaymentRef({}) === null);
check("so does a null invoice", readInvoicePaymentRef(null) === null);
check("so does an empty payments array",
  readInvoicePaymentRef({ payments: { data: [] } }) === null);

/* ── 6. The settlement ───────────────────────────────────────────────────── */
section("6. Cancel always; refund only what is owed and reachable");

const halfUsed = {
  invoice: { amount_paid: 899, payment_intent: "pi_1" },
  periodStart: START, periodEnd: MONTH_END, nowSeconds: START + 15 * DAY,
};
const p1 = settlementPlan(halfUsed);
check("it cancels", p1.cancel === true);
check("and refunds the unused half", p1.refundCents === 449);
check("against the payment it read", p1.ref?.id === "pi_1");
check("with no human needed", p1.needsHuman === false);

const p2 = settlementPlan({ ...halfUsed, invoice: { amount_paid: 899 } });
check("an unreadable payment still cancels", p2.cancel === true);
check("keeps the exact amount owed", p2.refundCents === 449);
check("and asks for a human rather than guessing",
  p2.needsHuman === true && p2.reason === "no-payment-reference");

const p3 = settlementPlan({ ...halfUsed, invoice: { amount_paid: 0 } });
check("a trial cancels and refunds nothing",
  p3.cancel === true && p3.refundCents === 0 && p3.needsHuman === false);

const p4 = settlementPlan({ ...halfUsed, invoice: null });
check("no invoice at all still cancels",
  p4.cancel === true && p4.refundCents === 0 && p4.reason === "no-invoice");

/* CANCEL IS UNCONDITIONAL. Somebody who paid $149 to stop being charged must
   stop being charged whether or not we can also refund them. */
check("every settlement cancels",
  [p1, p2, p3, p4].every((p) => p.cancel === true));

/* ── 7. How it is wired ──────────────────────────────────────────────────── */
section("7. The order that makes a half-finished upgrade safe");

/* Scheduled from INSIDE the mutation, so Convex only runs it if the grant
   committed. Scheduling from http.ts would let a cancellation fire for a grant
   that rolled back, leaving somebody with neither. */
check("the settlement is scheduled from the granting mutation",
  /ctx\.scheduler\.runAfter\(\s*0,\s*internal\.billing\.settleSupersededSubscription/.test(SUBS));
check("it is not scheduled from the webhook route",
  !/settleSupersededSubscription/.test(read("convex/http.ts")));
check("the grant is recorded before the settlement runs",
  SUBS.indexOf('outcome: "lifetime-superseded-subscription"') <
    SUBS.indexOf("settleSupersededSubscription"));

/* The invoice is read BEFORE the cancel, because cancelling can move
   latest_invoice, and the window being settled is the one they paid for. */
check("the invoice is read before the subscription is cancelled",
  BILLING.indexOf('stripeGet("/invoices/"') < BILLING.indexOf('stripeDelete('));
check("the refund is attempted after the cancel",
  BILLING.indexOf("stripeDelete(") < BILLING.indexOf('stripePost(\n      "/refunds"'));

check("a retry cannot send the money twice",
  /"lifetime-refund:" \+ args\.eventId/.test(BILLING));
check("nor cancel under a second request",
  /"lifetime-cancel:" \+ args\.eventId/.test(BILLING));
check("an already-cancelled subscription is success, not a stall",
  /goneAlready/.test(BILLING));
check("retries are bounded", /UPGRADE_MAX_ATTEMPTS/.test(BILLING));
check("and giving up records that a human is needed",
  /gave-up-after-/.test(BILLING));

/* The amount is stored, not just logged, because on the needs-human path it is
   the figure somebody has to refund by hand. */
check("the owed amount is stored on the event row",
  /upgradeRefundCents: v\.optional\(v\.number\(\)\)/.test(SCHEMA));

/* Both decision modules stay executable by this suite. */
for (const [name, src] of [["subscriptionGuard", GUARD], ["lifetimeUpgrade", UPGRADE]] as const) {
  check(`${name} imports nothing from Convex`,
    !/from "convex\//.test(src) && !/_generated/.test(src));
  check(`${name} makes no network call`, !/fetch\(/.test(src));
}

/* ── Result ──────────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
