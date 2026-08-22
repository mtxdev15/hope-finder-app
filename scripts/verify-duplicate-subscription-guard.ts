/* Declare & Believe — the duplicate-Stripe-subscription guard.
 *
 * WHAT THIS EXISTS TO PREVENT
 * `createCheckoutSession` refuses a second purchase while a live subscription
 * exists, but that runs at CHECKOUT time. A Session minted before the first
 * subscription existed stays payable for 24 hours; completing it later creates
 * a second real Stripe subscription the checkout guard never saw.
 *
 * `applyWebhook` then resolved its target row by falling back to
 * `by_user_provider`, so a webhook for subscription B would PATCH the row
 * holding subscription A and repoint `stripeSubscriptionId` in place. Convex
 * would show one tidy row reading Plus while Stripe billed twice and
 * subscription A became invisible to us. That is the failure this suite pins
 * down.
 *
 * The decision under test is IMPORTED from convex/subscriptionGuard.ts, the
 * same module applyWebhook calls. Not a copy, and not a source grep — a copy
 * would prove nothing and a grep would pass against a guard that never runs.
 *
 * No network, no credential, no deployment, no Stripe call.
 * Run:  node scripts/verify-duplicate-subscription-guard.ts
 */
import { readFileSync } from "node:fs";
import {
  classifyIncomingSubscription,
  isReplaceable,
  REPLACEABLE_STATUSES,
} from "../convex/subscriptionGuard.ts";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

/* Real ids from the 2026-08-21 sandbox purchase. A is the subscription that
 * actually exists; B is the one a stale Checkout Session would have produced. */
const A = "sub_1U6yXVLShxhb4mBzedFqJMQ0";
const B = "sub_1STALEsessionWouldCreateThis";
const USER = "REDACTED_USER_ID";

const rowA = (over: Record<string, any> = {}) => ({
  stripeSubscriptionId: A,
  status: "active",
  cancelAtPeriodEnd: false,
  ...over,
});

const decide = (existing: any, incoming: string | null, provider = "stripe") =>
  classifyIncomingSubscription({ provider, existing, incomingSubscriptionId: incoming });

/* ── 1. The allow cases ──────────────────────────────────────────────────── */
section("1. Legitimate writes are still allowed");

check("no existing row -> incoming A accepted", decide(null, A).ok === true);
check("no existing row -> incoming B accepted", decide(null, B).ok === true);
check("existing A + event for A accepted", decide(rowA(), A).ok === true);
check("existing A with no subscription id yet -> accepted",
  decide(rowA({ stripeSubscriptionId: undefined }), B).ok === true);
check("a non-Stripe provider is never touched by this guard",
  decide(rowA(), B, "app_store").ok === true);
/* The whole point of the ordering guard is that these all arrive in any order
 * and all resolve identically. */
for (const t of ["checkout.session.completed", "customer.subscription.created",
                 "customer.subscription.updated", "invoice.paid"]) {
  check(`same-id event (${t}) accepted regardless of type`, decide(rowA(), A).ok === true);
}

/* ── 2. The conflict cases ───────────────────────────────────────────────── */
section("2. A different subscription id never replaces a live one");

for (const status of ["active", "trialing", "past_due", "unpaid"]) {
  const v = decide(rowA({ status }), B);
  check(`existing ${status} A + incoming B -> CONFLICT`,
    v.ok === false && v.reason === "duplicate-subscription");
  check(`existing ${status} A -> conflict names A as canonical`,
    v.ok === false && v.canonicalSubscriptionId === A);
  check(`existing ${status} A -> conflict names B as incoming`,
    v.ok === false && v.incomingSubscriptionId === B);
}

/* Cancelling but still inside the paid period is NOT finished — they hold Plus
 * through currentPeriodEnd, which is exactly why billing.ts blocks a new
 * checkout in this state too. */
const cape = decide(rowA({ status: "active", cancelAtPeriodEnd: true }), B);
check("cancel-at-period-end but still active -> CONFLICT", cape.ok === false);
check("cancel-at-period-end on a trialing row -> CONFLICT",
  decide(rowA({ status: "trialing", cancelAtPeriodEnd: true }), B).ok === false);

/* An unrecognised lifecycle must fail closed. billing.ts refuses to guess at
 * one; so does this. */
check("unrecognised status -> CONFLICT (fails closed)",
  decide(rowA({ status: "some_future_stripe_status" }), B).ok === false);
check("empty status -> CONFLICT (fails closed)",
  decide(rowA({ status: "" }), B).ok === false);

/* Missing incoming id. http.ts returns before calling the mutation when it
 * cannot resolve one, so this should be unreachable — but an unattributable
 * payload must never be allowed to move the canonical row's status and tier. */
const noId = decide(rowA(), null);
check("missing incoming subscription id -> CONFLICT (fails closed)", noId.ok === false);
check("missing incoming id is reported as null, not invented",
  noId.ok === false && noId.incomingSubscriptionId === null);

/* ── 3. Replacement only when genuinely terminal ─────────────────────────── */
section("3. Terminal rows may be replaced");

for (const status of ["canceled", "incomplete_expired", "ended", "incomplete"]) {
  check(`terminal ${status} A + incoming B -> replacement ALLOWED`,
    decide(rowA({ status }), B).ok === true);
  check(`${status} is in REPLACEABLE_STATUSES`, REPLACEABLE_STATUSES.has(status));
}
for (const status of ["active", "trialing", "past_due", "unpaid"]) {
  check(`${status} is NOT replaceable`, !REPLACEABLE_STATUSES.has(status));
}
/* `incomplete` being replaceable is load-bearing: billing.ts lets an
 * `incomplete` row fall through to a fresh Checkout on purpose, so the retry
 * that produces B must be able to replace A. If this ever flips, that
 * documented recovery path breaks. */
check("incomplete is replaceable — the documented retry path depends on it",
  isReplaceable({ stripeSubscriptionId: A, status: "incomplete" }));
/* …but a cancelled-at-period-end row is still not finished even when its
 * status is otherwise replaceable. */
check("terminal-looking status + cancelAtPeriodEnd -> still NOT replaceable",
  !isReplaceable({ stripeSubscriptionId: A, status: "incomplete", cancelAtPeriodEnd: true }));
check("status canceled + cancelAtPeriodEnd IS replaceable (it really ended)",
  isReplaceable({ stripeSubscriptionId: A, status: "canceled", cancelAtPeriodEnd: true }));

/* ── 4. Out-of-order delivery ────────────────────────────────────────────── */
section("4. Out-of-order delivery for the second subscription");

/* The real 2026-08-21 run delivered invoice.paid BEFORE
 * customer.subscription.created. Whichever event for B lands first must lose,
 * and every later one must keep losing. */
const liveA = rowA({ status: "active" });
check("invoice.paid for B arriving FIRST -> conflict, A untouched",
  decide(liveA, B).ok === false);
check("customer.subscription.created for B arriving second -> still conflict",
  decide(liveA, B).ok === false);
check("checkout.session.completed for B arriving third -> still conflict",
  decide(liveA, B).ok === false);
check("a legitimate later update for A still applies",
  decide(liveA, A).ok === true);
/* Order independence is the property, so assert it rather than implying it. */
const orders = [[B, B, A], [B, A, B], [A, B, B]];
check("every arrival order yields the same per-event decision",
  orders.every((seq) => seq.every((id) => decide(liveA, id).ok === (id === A))));

/* ── 5. Source-level guarantees ──────────────────────────────────────────── */
section("5. The guard sits on the ONE authoritative write path");

const SUBS = readFileSync(new URL("../convex/subscriptions.ts", import.meta.url), "utf8");
const HTTP = readFileSync(new URL("../convex/http.ts", import.meta.url), "utf8");
const WORKER = readFileSync(new URL("../worker/src/index.js", import.meta.url), "utf8");
const ENT = readFileSync(new URL("../convex/entitlements.ts", import.meta.url), "utf8");
const SCHEMA = readFileSync(new URL("../convex/schema.ts", import.meta.url), "utf8");

/* Ordering assertions are scoped to the applyWebhook BODY: subscriptions.ts
 * also inserts billingCustomers inside linkCustomer, far earlier in the file,
 * and an unscoped indexOf finds that one instead. */
const APPLY = SUBS.slice(SUBS.indexOf("export const applyWebhook"));

/* applyWebhook must remain the only writer of this table, or the guard can be
 * bypassed by adding a second one. */
check("only applyWebhook writes the subscriptions table",
  (SUBS.match(/ctx\.db\.(insert\("subscriptions"|patch\(existing\._id)/g) || []).length === 2);
check("the guard is called inside applyWebhook",
  /classifyIncomingSubscription\(\{/.test(SUBS));
check("the guard runs BEFORE the row is written",
  APPLY.indexOf("classifyIncomingSubscription({") < APPLY.indexOf("ctx.db.patch(existing._id"));
check("the guard runs BEFORE the customer mapping is written",
  APPLY.indexOf("classifyIncomingSubscription({") < APPLY.indexOf('ctx.db.insert("billingCustomers"'));
check("a conflict returns without applying",
  /return \{ ok: true, duplicateSubscription: true \};/.test(SUBS));
check("a conflict is recorded as its own outcome",
  /recordEvent\("duplicate-subscription-conflict"/.test(SUBS));
check("a conflict emits a structured log line",
  /duplicate-subscription-conflict provider=/.test(SUBS));
/* http.ts already established that provider ids do not belong in logs. */
check("the log line carries no subscription id",
  !/duplicate-subscription-conflict[\s\S]{0,400}canonicalSubscriptionId \+/.test(SUBS));

check("http.ts still calls applyWebhook exactly once, for every event type",
  (HTTP.match(/runMutation\(\s*internal\.subscriptions\.applyWebhook/g) || []).length === 1);
check("the Worker remains a verify-and-relay boundary — no guard added there",
  !/duplicateSubscription|classifyIncomingSubscription/.test(WORKER));
check("the Worker still holds no Stripe credential", !/env\.STRIPE_SECRET_KEY/.test(WORKER));

/* ── 6. Deduplication and the entitlement contract ───────────────────────── */
section("6. Deduplication and the client contract are unchanged");

check("replay is still refused before any work",
  APPLY.indexOf("if (seen) return { ok: true, deduped: true }") < APPLY.indexOf("classifyIncomingSubscription({"));
check("dedup is still keyed on (provider, eventId)", /by_provider_event/.test(SUBS));
check("a conflict records exactly one event row",
  (SUBS.match(/recordEvent\("duplicate-subscription-conflict"/g) || []).length === 1);

/* The new columns must be optional, or the three existing sandbox rows become
 * invalid the moment this schema ships. */
for (const f of ["outcome", "conflictReason", "canonicalSubscriptionId", "incomingSubscriptionId"]) {
  check(`billingEvents.${f} is optional (existing rows stay valid)`,
    new RegExp(f + ":\\s*v\\.optional\\(").test(SCHEMA));
}

/* Provider ids must not leak to the browser. getMyEntitlements never reads
 * billingEvents, and its response shape is unchanged by this work. */
check("getMyEntitlements does not read billingEvents", !/billingEvents/.test(ENT));
for (const leak of ["stripeSubscriptionId", "stripeCustomerId", "stripePriceId", "latestInvoiceId", "canonicalSubscriptionId"]) {
  const returned = ENT.slice(ENT.indexOf("  return {"), ENT.indexOf("/* ── client-facing reads"));
  check(`the entitlement response exposes no ${leak}`, !returned.includes(leak));
}

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
