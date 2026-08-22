/* Declare & Believe — Stripe end-of-period cancellation normalization.
 *
 * THE BUG THIS EXISTS TO PREVENT
 * A real sandbox subscription was cancelled at end of period through the Stripe
 * Portal. Stripe returned `cancel_at_period_end: false` and set `cancel_at` to
 * the period end instead — that is how 2026-06-24.dahlia expresses the schedule
 * under `billing_mode: flexible`. The webhook reader looked only at the
 * boolean, stored `false`, and the account page told a cancelled subscriber
 * their plan "Renews September 21, 2026" — the exact date it will end.
 *
 * Telling someone who cancelled that they will be billed again is a trust
 * failure, and it is the precise thing the Cancels/Renews split was built to
 * avoid. So the normalizer is IMPORTED and EXECUTED here against a sanitized
 * copy of the real payload, not described.
 *
 * No network, no credential, no Stripe call, no Convex call, no Worker.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveCancelAtPeriodEnd,
  isOffCycleCancellation,
  TERMINAL_STATUSES,
} from "../convex/stripeCancellation.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

/* ── The fixture ─────────────────────────────────────────────────────────────
 * A sanitized copy of the subscription Stripe actually returned after the
 * Portal cancellation. Every identifier is removed: no Customer, Subscription,
 * Price, invoice or event id, no email, no payment method. What remains is only
 * the shape needed to reproduce the failure. The two timestamps are the real
 * ones, because their EQUALITY is the whole point. */
const PERIOD_END = 1790020544;   // the real period end (Sept 21 2026)
const REQUESTED_AT = 1787427936; // when cancellation was requested

const DAHLIA_FLEXIBLE_CANCELLED = {
  status: "active",
  billing_mode: { type: "flexible" },
  cancel_at: PERIOD_END,
  cancel_at_period_end: false,
  canceled_at: REQUESTED_AT,
  cancellation_details: { reason: "cancellation_requested", feedback: "other" },
  ended_at: null,
  livemode: false,
  items: { data: [{ current_period_start: 1787342144, current_period_end: PERIOD_END }] },
};

/* How http.ts calls the normalizer: period end comes from items.data[0]. */
const fromPayload = (sub: any) =>
  deriveCancelAtPeriodEnd({
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelAt: sub.cancel_at,
    currentPeriodEnd: sub?.items?.data?.[0]?.current_period_end,
  });

/* ── 1. The real payload ─────────────────────────────────────────────────── */
section("1. The observed Dahlia flexible-billing payload");

check("the fixture carries Stripe's own cancel_at_period_end: false",
  DAHLIA_FLEXIBLE_CANCELLED.cancel_at_period_end === false);
check("the fixture's cancel_at equals the item period end",
  DAHLIA_FLEXIBLE_CANCELLED.cancel_at === DAHLIA_FLEXIBLE_CANCELLED.items.data[0].current_period_end);
check("the fixture is still a live subscription", DAHLIA_FLEXIBLE_CANCELLED.status === "active");
check("the fixture has not ended", DAHLIA_FLEXIBLE_CANCELLED.ended_at === null);

/* THE regression. Before the fix this was false. */
check("the observed payload normalizes to cancelAtPeriodEnd = TRUE",
  fromPayload(DAHLIA_FLEXIBLE_CANCELLED) === true);

/* The fixture must never grow an identifier. */
const fixtureBlob = JSON.stringify(DAHLIA_FLEXIBLE_CANCELLED);
for (const banned of ["cus_", "sub_", "price_", "in_", "evt_", "pm_", "@", "secret"]) {
  check(`the fixture carries no "${banned}"`, !fixtureBlob.includes(banned));
}

/* ── 2. The explicit boolean still works ─────────────────────────────────── */
section("2. The legacy explicit boolean is unchanged");

check("cancel_at_period_end true stays true",
  deriveCancelAtPeriodEnd({ status: "active", cancelAtPeriodEnd: true, cancelAt: null, currentPeriodEnd: PERIOD_END }) === true);
check("the boolean wins even with no cancel_at at all",
  deriveCancelAtPeriodEnd({ status: "active", cancelAtPeriodEnd: true, cancelAt: undefined, currentPeriodEnd: undefined }) === true);
check("trialing honours the boolean too",
  deriveCancelAtPeriodEnd({ status: "trialing", cancelAtPeriodEnd: true, cancelAt: null, currentPeriodEnd: PERIOD_END }) === true);

/* ── 3. Everything that must NOT count as scheduled ──────────────────────── */
section("3. Nothing else is read as a cancellation schedule");

check("cancel_at null stays false", fromPayload({ ...DAHLIA_FLEXIBLE_CANCELLED, cancel_at: null }) === false);
check("cancel_at missing stays false",
  deriveCancelAtPeriodEnd({ status: "active", cancelAtPeriodEnd: false, cancelAt: undefined, currentPeriodEnd: PERIOD_END }) === false);
for (const bad of [0, -1, NaN, Infinity, -Infinity, "1790020544", true, {}, []]) {
  check(`cancel_at ${JSON.stringify(bad) ?? String(bad)} is not a schedule`,
    deriveCancelAtPeriodEnd({ status: "active", cancelAtPeriodEnd: false, cancelAt: bad as any, currentPeriodEnd: PERIOD_END }) === false);
}
check("no period end means no comparison, so no schedule",
  deriveCancelAtPeriodEnd({ status: "active", cancelAtPeriodEnd: false, cancelAt: PERIOD_END, currentPeriodEnd: undefined }) === false);

/* The over-classification guard: a real mid-period cancel_at is NOT
 * end-of-period, and must not be folded into it. */
check("a mid-period cancel_at is NOT end-of-period",
  fromPayload({ ...DAHLIA_FLEXIBLE_CANCELLED, cancel_at: PERIOD_END - 86400 }) === false);
check("a cancel_at one second early is NOT end-of-period",
  fromPayload({ ...DAHLIA_FLEXIBLE_CANCELLED, cancel_at: PERIOD_END - 1 }) === false);
check("a cancel_at after the period end is NOT end-of-period",
  fromPayload({ ...DAHLIA_FLEXIBLE_CANCELLED, cancel_at: PERIOD_END + 1 }) === false);
check("an off-cycle cancellation is recognisably off-cycle",
  isOffCycleCancellation({ status: "active", cancelAtPeriodEnd: false, cancelAt: PERIOD_END - 86400, currentPeriodEnd: PERIOD_END }) === true);
check("the observed payload is NOT off-cycle",
  isOffCycleCancellation({ status: "active", cancelAtPeriodEnd: false, cancelAt: PERIOD_END, currentPeriodEnd: PERIOD_END }) === false);

/* canceled_at alone proves nothing: Stripe sets it the moment a FUTURE
 * cancellation is requested. */
check("canceled_at alone does not schedule anything",
  deriveCancelAtPeriodEnd({ status: "active", cancelAtPeriodEnd: false, cancelAt: null, currentPeriodEnd: PERIOD_END }) === false);
const NORMALIZER_SRC = read("convex/stripeCancellation.ts");
check("the normalizer never reads canceled_at",
  !/\bcanceledAt\b|canceled_at/.test(
    NORMALIZER_SRC.replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n")));

/* ── 4. Terminal states are not "scheduled" ──────────────────────────────── */
section("4. An ended subscription is not merely scheduled to end");

for (const s of ["canceled", "incomplete_expired", "ended"]) {
  check(`${s} with a matching cancel_at is NOT scheduled`,
    fromPayload({ ...DAHLIA_FLEXIBLE_CANCELLED, status: s }) === false);
  check(`${s} with the explicit boolean is NOT scheduled`,
    deriveCancelAtPeriodEnd({ status: s, cancelAtPeriodEnd: true, cancelAt: PERIOD_END, currentPeriodEnd: PERIOD_END }) === false);
  check(`${s} is a declared terminal status`, TERMINAL_STATUSES.has(s));
}
check("active is not terminal", !TERMINAL_STATUSES.has("active"));
check("past_due is not terminal — billing needs attention, access may remain",
  !TERMINAL_STATUSES.has("past_due"));

/* ── 5. Determinism ──────────────────────────────────────────────────────── */
section("5. Deterministic, so a replay normalizes identically");

/* Applied to CODE, not comments: the module documents its own "no Date.now()"
 * rule, and failing the file for explaining its determinism would be absurd.
 * This trap has now appeared four times in this codebase. */
const NORM_CODE = NORMALIZER_SRC
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
check("the normalizer never calls Date.now()", !NORM_CODE.includes("Date.now"));
check("the normalizer never constructs a Date", !/new Date\(/.test(NORM_CODE));
const twice = [fromPayload(DAHLIA_FLEXIBLE_CANCELLED), fromPayload(DAHLIA_FLEXIBLE_CANCELLED)];
check("repeated normalization agrees", twice[0] === twice[1] && twice[0] === true);
check("the normalizer is dependency-free", !/^\s*import\s/m.test(NORMALIZER_SRC));

/* ── 6. The write path actually uses it ──────────────────────────────────── */
section("6. The webhook write path uses the normalizer");

const HTTP = read("convex/http.ts");
check("http.ts imports the normalizer", /import \{ deriveCancelAtPeriodEnd \} from "\.\/stripeCancellation"/.test(HTTP));
check("cancelAtPeriodEnd is derived, not read raw",
  /cancelAtPeriodEnd: deriveCancelAtPeriodEnd\(\{/.test(HTTP));
check("the raw boolean is no longer written directly",
  !/\{ cancelAtPeriodEnd: sub\.cancel_at_period_end \}/.test(HTTP));
check("the derivation is fed the period end from items.data[0]",
  /currentPeriodEnd: period\.end,/.test(HTTP));
check("cancelAtPeriodEnd is sent unconditionally, so true can be written back to false",
  !/\.\.\.\([^)]*cancelAtPeriodEnd/.test(HTTP));
/* The provider-neutral contract must not leak the raw Stripe field. */
const ENT = read("convex/entitlements.ts");
check("the entitlement contract exposes no raw cancel_at", !/\bcancel_at\b/.test(ENT));
check("the entitlement contract keeps the provider-neutral name", /cancelAtPeriodEnd/.test(ENT));
check("no Stripe identifier is introduced by this change",
  !/cus_|sub_1|price_1|bpc_/.test(NORMALIZER_SRC));

/* ── 7. The two-event sequence ───────────────────────────────────────────── */
section("7. One Portal cancellation, two distinct update events");

/* Stripe emitted TWO customer.subscription.updated events for the single
 * cancellation, with different event ids. Both are legitimate. They must NOT be
 * collapsed — idempotency exists to drop a RETRY of the same event id, not to
 * discard a genuinely different event. */
const EVENT_A = { ...DAHLIA_FLEXIBLE_CANCELLED, cancel_at: PERIOD_END, cancel_at_period_end: false };
const EVENT_B = { ...DAHLIA_FLEXIBLE_CANCELLED, cancel_at: PERIOD_END, cancel_at_period_end: false,
                  cancellation_details: { reason: "cancellation_requested", feedback: "other" } };

check("event A normalizes to scheduled", fromPayload(EVENT_A) === true);
check("event B normalizes to scheduled", fromPayload(EVENT_B) === true);
check("the sequence converges — order cannot change the answer",
  fromPayload(EVENT_A) === fromPayload(EVENT_B));
check("neither event changes the period end",
  EVENT_A.items.data[0].current_period_end === PERIOD_END &&
  EVENT_B.items.data[0].current_period_end === PERIOD_END);
check("neither event makes the subscription terminal",
  EVENT_A.status === "active" && EVENT_B.status === "active");

/* Deduplication stays keyed on the provider event id, so two DIFFERENT ids both
 * apply and no second canonical subscription is created. */
const SUBS = read("convex/subscriptions.ts");
check("dedup is keyed on the provider event id", /by_provider_event/.test(SUBS));
check("the duplicate-subscription guard is still consulted",
  /classifyIncomingSubscription|isReplaceable/.test(SUBS));
check("applyWebhook still writes a single canonical row per user+provider",
  /by_user_provider|getByUserProviderInternal|userId.*provider/.test(SUBS));

/* ── Result ──────────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
