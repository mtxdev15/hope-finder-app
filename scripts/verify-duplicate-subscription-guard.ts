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

/* THE PROPERTY IS "ONE MUTATION", NOT "ONE CALL SITE".
 *
 * This used to assert a single call site, which was the same thing while every
 * event was subscription-shaped. Lifetime added two paths that cannot share
 * that code — a one-time purchase has no Subscription to fetch, and a refund
 * resolves through a PaymentIntent — so there are now three call sites.
 *
 * What must remain true is what the guard actually depends on: every path
 * writes subscription state through applyWebhook and nothing else, so the
 * duplicate check runs on all of them. A path that wrote the table directly
 * would bypass the guard entirely, which is the regression to catch. */
const APPLY_CALLS =
  (HTTP.match(/runMutation\(\s*internal\.subscriptions\.applyWebhook/g) || []).length;
check("http.ts routes every event through applyWebhook", APPLY_CALLS === 3);
/* WHY THIS IS NO LONGER "applyWebhook is the ONLY subscriptions mutation"
 *
 * A second mutation now exists — recordRefundInternal — and the distinction
 * matters more than the count. The property the guard depends on is that
 * everything which CHANGES subscription state goes through applyWebhook, so the
 * duplicate check runs on all of it. A mutation that changes nothing cannot
 * bypass a guard it never reaches.
 *
 * It exists because a refunded MONTHLY or ANNUAL charge used to be dropped
 * without trace: for a subscription, access is governed by its status, so
 * revoking on a refund would be wrong for a goodwill refund on a running
 * subscription and redundant beside the deletion event of a real cancellation.
 * Recording it makes the refund visible without touching anyone's access.
 *
 * So the allowlist is explicit — a THIRD mutation appearing here fails this,
 * which is the point — and the no-write property of the new one is proven
 * against its own source rather than assumed from its name. */
const SUBS_MUTATIONS = [
  ...new Set(
    (HTTP.match(/runMutation\(\s*internal\.subscriptions\.(\w+)/g) || [])
      .map((m) => m.replace(/[\s\S]*subscriptions\./, "")),
  ),
].sort();
check("http.ts calls exactly the two known subscriptions mutations",
  JSON.stringify(SUBS_MUTATIONS) === JSON.stringify(["applyWebhook", "recordRefundInternal"]));

/* BOUNDED AT THE NEXT EXPORT, and the reason is a bug this very assertion
   caught. The slice used to run to the end of the file, so it grew every time
   anything was appended to subscriptions.ts. When recordGraceExpiry was added
   below it — a function that legitimately DOES patch the subscriptions table —
   these checks failed, correctly reporting that "recordRefundInternal" writes a
   tier. It does not. The slice did.
   An unbounded slice quietly turns "this function is safe" into "everything
   after this function is safe", which is a much weaker claim wearing the same
   words. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const sliceExport = (src: string, name: string): string => {
  const start = src.indexOf("export const " + name);
  if (start < 0) return "";
  const next = src.indexOf("\nexport const ", start + 1);
  /* COMMENTS STRIPPED, because the slice necessarily runs up to the next
     export and therefore swallows that function's doc comment. The claim being
     made is about CODE: "this function cannot write a tier". A neighbouring
     comment that merely says the word is not a write, and letting prose fail a
     behavioural assertion trains people to loosen the assertion. */
  return stripComments(next < 0 ? src.slice(start) : src.slice(start, next));
};
const RECORD_REFUND = sliceExport(SUBS, "recordRefundInternal");
check("the refund slice stops before the next export",
  RECORD_REFUND.length > 0 && !RECORD_REFUND.includes("recordGraceExpiryInternal"));
check("recordRefundInternal can be located", RECORD_REFUND.length > 0);
/* It may insert into billingEvents — that IS its job — but it must never touch
   the subscriptions table, which is what would let it bypass the guard. */
check("recordRefundInternal writes only billingEvents",
  /ctx\.db\.insert\("billingEvents"/.test(RECORD_REFUND) &&
  !/ctx\.db\.insert\("subscriptions"/.test(RECORD_REFUND) &&
  !/ctx\.db\.patch/.test(RECORD_REFUND) &&
  !/ctx\.db\.replace/.test(RECORD_REFUND));
/* And it must dedupe on replay like every other event path, or a Stripe retry
   would write a second row for one refund. */
check("recordRefundInternal is replay-safe",
  /by_provider_event/.test(RECORD_REFUND) && /deduped: true/.test(RECORD_REFUND));

/* The lifetime path must still REVOKE. If a future edit routed lifetime through
   the recording path too, refunding $149 would return the money and leave Plus
   granted forever — the exact bug charge.refunded was added to prevent. */
check("a lifetime refund still revokes rather than merely being recorded",
  /md\.plan !== "plus_lifetime"[\s\S]{0,400}recordRefundInternal/.test(HTTP) &&
  /charge\.refunded[\s\S]{0,4000}status: "refunded"/.test(HTTP));

/* THE INVERSE, AND IT IS A DELIBERATE PRODUCT DECISION, NOT AN OVERSIGHT.
 *
 * Decided by the owner on 2026-08-26: a refund on a MONTHLY or ANNUAL
 * subscription must never revoke access. The reasoning is that a refund and a
 * cancellation are different acts. Refunding a month as a goodwill gesture to
 * somebody who is still subscribed and still paying, and having that silently
 * cut off their access, would punish the person we were trying to look after.
 * When a refund really does accompany the end of a subscription,
 * customer.subscription.deleted has already revoked — so revoking here is
 * either harmful or redundant, never necessary.
 *
 * Asserted because it is the kind of decision a later reader could mistake for
 * an incomplete implementation and "fix". The refund IS recorded; what it must
 * not do is touch entitlement.
 *
 * The REFUND_BRANCH slice is everything between the plan test and the return —
 * i.e. exactly the code that runs for a subscription refund. */
const REFUND_BRANCH = (() => {
  const start = HTTP.indexOf('if (md.plan !== "plus_lifetime")');
  if (start < 0) return "";
  return HTTP.slice(start, HTTP.indexOf("applyWebhook", start));
})();
check("the subscription-refund branch can be located", REFUND_BRANCH.length > 0);
check("a subscription refund records and returns, without applying anything",
  /recordRefundInternal/.test(REFUND_BRANCH) && /return ACK\(\)/.test(REFUND_BRANCH));
check("a subscription refund sets no status",
  !/status:/.test(REFUND_BRANCH));
check("a subscription refund never reaches applyWebhook",
  !/applyWebhook/.test(REFUND_BRANCH));
/* And the recording mutation itself has no way to grant or remove a tier, so
   the property holds even if the branch above were rearranged. */
check("recordRefundInternal cannot change a tier or a status",
  !/\btier\b/.test(RECORD_REFUND) && !/status:/.test(RECORD_REFUND));
check("no path writes the subscriptions table directly",
  !/ctx\.db\.(insert|patch|replace)/.test(HTTP));
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

/* ── A lifetime row is the one row that legitimately has no id ──────────── */
section("5. A lifetime purchase is never replaced by a subscription");

/* WHY THIS SECTION EXISTS
 *
 * Section 1 asserts "existing row with no subscription id yet -> accepted".
 * That allowance is correct for a subscription row we have not yet learned the
 * id of — but a LIFETIME row has no id permanently, because it was bought in
 * `mode: "payment"` and no Subscription object was ever created.
 *
 * Without the lifetime rule, that allowance would let any subscription event
 * patch the lifetime row in place. The window is the same 24-hour stale-session
 * window this whole file exists for: a Checkout Session minted before the
 * lifetime purchase stays payable afterwards. The customer would keep Plus via
 * the new subscription, and the $149 they paid would stop existing in our data. */
const lifetimeRow = (over: Record<string, any> = {}) => ({
  status: "paid",
  planKey: "plus_lifetime",
  ...over,
});

const lifeVsB = decide(lifetimeRow(), B);
check("lifetime row + incoming subscription -> CONFLICT", lifeVsB.ok === false);
check("the conflict is reported as lifetime-not-replaceable",
  lifeVsB.ok === false && lifeVsB.reason === "lifetime-not-replaceable");
check("it names the incoming subscription", 
  lifeVsB.ok === false && lifeVsB.incomingSubscriptionId === B);
check("it names no canonical subscription, because there is none",
  lifeVsB.ok === false && lifeVsB.canonicalSubscriptionId === undefined);

/* The rule is about the PLAN, not the status: a refunded lifetime row must not
   become a silent upgrade path either. Whether a refunded buyer may subscribe
   again is a checkout-time decision, not something a stale session settles. */
check("a refunded lifetime row is still not replaceable",
  decide(lifetimeRow({ status: "refunded" }), B).ok === false);

/* It must not over-refuse. An event carrying no subscription id is not a
   subscription trying to take the row — it is the lifetime path itself. */
check("lifetime row + no incoming id -> accepted (its own webhook)",
  decide(lifetimeRow(), null).ok === true);
check("a non-Stripe provider is still never touched",
  decide(lifetimeRow(), B, "app_store").ok === true);

/* And it must not change any existing verdict for subscription rows. */
check("a normal row with no id yet is still accepted",
  decide(rowA({ stripeSubscriptionId: undefined, planKey: "plus_monthly" }), B).ok === true);
check("a live subscription row still conflicts as duplicate-subscription",
  (() => { const v = decide(rowA({ planKey: "plus_monthly" }), B);
    return v.ok === false && v.reason === "duplicate-subscription"; })());

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
