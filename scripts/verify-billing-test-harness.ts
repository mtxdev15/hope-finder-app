/* Verify the development-only Stripe Test Clock harness.
 *
 * WHAT THIS SUITE IS FOR
 * Every rule the harness enforces is a safety rule, and most of them are only
 * visible at the moment something goes wrong: a double-clicked advance, a
 * corrupted fixture, a target that is one hour too far. None of those can be
 * proved by reading the file.
 *
 * So this suite does two things and refuses to do a third:
 *   1. It IMPORTS convex/testHarnessState.ts and executes the real decisions.
 *   2. It parses convex/testHarness.ts structurally — call graph, argument
 *      shapes, the order of guards relative to network calls.
 *   3. It never asserts on a comment. This repository has been bitten four
 *      times by assertions that matched the prose documenting a banned pattern
 *      rather than the pattern, so comments are STRIPPED before any structural
 *      check runs.
 *
 * It makes no network request of any kind. Importing the state module cannot
 * reach Stripe: it has no imports at all.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PHASES,
  COMMANDS,
  TRANSITIONS,
  IN_FLIGHT_PHASES,
  ERROR_CODES,
  STATUS_FIELDS,
  FORBIDDEN_STATUS_FIELDS,
  ADVANCE_MARGIN_SECONDS,
  IDEMPOTENT_OPERATIONS,
  HARNESS_ENABLED_VALUE,
  admit,
  allowedCommands,
  checkGates,
  clockIdOf,
  deploymentNameFromUrl,
  fixtureListPath,
  idempotencyKey,
  isCommand,
  isInFlight,
  isPhase,
  isSingleFailedAttempt,
  ownershipVerdict,
  planAdvance,
  safeError,
  safeStatus,
} from "../convex/testHarnessState.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/* Comments stripped. See the header: this is not optional hygiene, it is the
 * difference between testing the code and testing the prose about the code. */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const HARNESS_REL = "convex/testHarness.ts";
const STATE_REL = "convex/testHarnessState.ts";
const PAGE_REL = "src/pages/dev/[control].astro";
const SCHEMA_REL = "convex/schema.ts";

const HARNESS = strip(read(HARNESS_REL));
const STATE = strip(read(STATE_REL));
const PAGE_RAW = read(PAGE_REL);
const PAGE = strip(PAGE_RAW);
const SCHEMA = strip(read(SCHEMA_REL));

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean) {
  if (ok) { passed++; } else { failed++; console.log("  FAIL  " + name); }
}
function section(title: string) { console.log("\n" + title + "\n"); }

/* Extract a function body by brace-walking from its declaration. */
function fnBody(src: string, marker: string): string {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error("marker not found: " + marker);
  /* The BODY brace, not a return-type object literal. A signature may contain
     `): Promise<{ ok: true } | { ok: false }>`, whose braces sit mid-line; the
     body's opening brace is always the one that ends its line. Getting this
     wrong silently tests the type annotation instead of the code. */
  const m = /\{[ \t]*\r?\n/.exec(src.slice(at));
  if (!m) throw new Error("no body brace: " + marker);
  const open = at + m.index;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  throw new Error("unbalanced: " + marker);
}


/* Ordering assertions must require BOTH strings to exist. `indexOf` returns -1
 * for a missing needle and -1 < anything is true, so a guard that was deleted
 * outright would otherwise read as "correctly ordered". Two mutation tests
 * caught exactly that. */
function before(hay: string, a: string, b: string): boolean {
  const i = hay.indexOf(a);
  const j = hay.indexOf(b);
  return i >= 0 && j >= 0 && i < j;
}

/* ── 1. The browser can send only a command ──────────────────────────────── */
section("1. The browser surface carries a command and nothing else");

const runCommandDecl = HARNESS.slice(HARNESS.indexOf("export const runCommand"));
const argsLine = runCommandDecl.slice(0, runCommandDecl.indexOf("handler:"));
check("runCommand args are exactly { command: v.string() }",
  /args:\s*\{\s*command:\s*v\.string\(\),?\s*\}/.test(argsLine));

/* The property is that no OTHER validator key exists — a field that does not
   exist cannot carry a Customer id, an amount, or a timestamp. */
const argKeys = [...argsLine.matchAll(/(\w+):\s*v\./g)].map((m) => m[1]);
check("the args validator declares exactly one key", argKeys.length === 1 && argKeys[0] === "command");

for (const banned of [
  "userId", "customer", "customerId", "subscription", "subscriptionId",
  "testClock", "testClockId", "clock", "paymentMethod", "paymentMethodId",
  "invoice", "invoiceId", "price", "priceId", "amount", "currency",
  "timestamp", "frozenTime", "target", "metadata", "path", "returnUrl", "email",
]) {
  check(`the browser cannot submit "${banned}"`, !argKeys.includes(banned));
}

check("fixtureStatus takes no arguments at all",
  /export const fixtureStatus = query\(\{\s*args:\s*\{\s*\},/.test(HARNESS));

/* ── 2. Exactly six commands, allowlisted ────────────────────────────────── */
section("2. Exactly six commands are accepted");

check("six commands are declared", COMMANDS.length === 6);
for (const c of ["provision", "arm_failure", "advance_to_renewal",
                 "restore_and_pay", "cancel_fixture", "delete_clock"]) {
  check(`"${c}" is a command`, isCommand(c));
}
for (const junk of ["", "PROVISION", " provision", "provision ", "reset", "resume",
                    "repair", "delete_customer", "advance", "__proto__", "0", "null"]) {
  check(`"${junk}" is rejected`, !isCommand(junk));
}
check("an unknown command is rejected before the phase is consulted",
  admit("nonsense", "empty").ok === false &&
  (admit("nonsense", "empty") as any).error === "unknown-command");
check("a non-string command is rejected", !isCommand(42 as any) && !isCommand(null as any));

/* ── 3. All four gates, every call ───────────────────────────────────────── */
section("3. Four gates run on every command");

const GOOD = {
  authenticated: true,
  enabled: "true",
  expectedDeployment: "good-dotterel-906",
  actualDeploymentUrl: "https://good-dotterel-906.convex.cloud",
  stripeEnvironment: "sandbox",
};
check("a fully configured dev environment passes", checkGates(GOOD).ok === true);
check("missing authentication rejects",
  (checkGates({ ...GOOD, authenticated: false }) as any).error === "not-authenticated");
check("missing harness flag rejects (default is DISABLED)",
  (checkGates({ ...GOOD, enabled: undefined }) as any).error === "harness-disabled");

/* A flag that accepts anything truthy is a flag that turns itself on. */
for (const truthy of ["1", "yes", "TRUE", "True", " true", "true ", "on", 1 as any, true as any]) {
  check(`enabled=${JSON.stringify(truthy)} does NOT enable the harness`,
    (checkGates({ ...GOOD, enabled: truthy }) as any).error === "harness-disabled");
}
check("the exact documented value enables it", HARNESS_ENABLED_VALUE === "true");

check("a mismatched deployment rejects",
  (checkGates({ ...GOOD, actualDeploymentUrl: "https://keen-hamster-650.convex.cloud" }) as any)
    .error === "wrong-deployment");
check("a missing actual-deployment URL rejects",
  (checkGates({ ...GOOD, actualDeploymentUrl: undefined }) as any).error === "wrong-deployment");
check("a missing expected-deployment pin rejects",
  (checkGates({ ...GOOD, expectedDeployment: undefined }) as any).error === "wrong-deployment");
check("production Stripe rejects",
  (checkGates({ ...GOOD, stripeEnvironment: "production" }) as any).error === "not-sandbox");
check("an unresolvable Stripe environment rejects",
  (checkGates({ ...GOOD, stripeEnvironment: null }) as any).error === "not-sandbox");

/* The ACTUAL deployment must come from a platform-provided URL, not from the
   expected-name variable — a variable that says "dev" can be set anywhere. */
check("deployment name is parsed from a convex URL",
  deploymentNameFromUrl("https://good-dotterel-906.convex.cloud") === "good-dotterel-906" &&
  deploymentNameFromUrl("https://good-dotterel-906.convex.site") === "good-dotterel-906");
check("a non-convex URL yields no deployment name",
  deploymentNameFromUrl("https://evil.example.com") === null &&
  deploymentNameFromUrl("good-dotterel-906") === null &&
  deploymentNameFromUrl(undefined) === null);
check("the gate reads CONVEX_CLOUD_URL / CONVEX_SITE_URL, not the pin, for the ACTUAL value",
  /actualDeploymentUrl:\s*process\.env\.CONVEX_CLOUD_URL/.test(HARNESS));
check("the gate helper is called at the top of runCommand",
  before(HARNESS, "const g = await gate(ctx)", "internal.testHarness.getFixtureInternal"));

/* ── 4. assertClockOwned is in the executable call graph ─────────────────── */
section("4. Every existing-object mutation passes assertClockOwned");

check("assertClockOwned is defined", /async function assertClockOwned\(/.test(HARNESS));
check("assertClockOwned RETRIEVES the object from Stripe",
  /stripeGet\(\s*"\/" \+ resource/.test(fnBody(HARNESS, "async function assertClockOwned(")));
check("assertClockOwned delegates the verdict to the pure module",
  /ownershipVerdict\(/.test(fnBody(HARNESS, "async function assertClockOwned(")));

/* Each operation that touches an EXISTING object must call it. provision is
   exempt only for its first write, which has no existing target. */
/* PER-OBJECT, not per-function. "assertClockOwned appears somewhere in this
   body" is too weak — an operation that verifies the Subscription but writes to
   an unverified Customer would still pass it. So: for every existing object an
   operation MUTATES, that same object must have been retrieved and verified. */
for (const op of ["opArmFailure", "opAdvance", "opRestoreAndPay", "opCancelFixture"]) {
  const body = fnBody(HARNESS, "async function " + op + "(");
  check(`${op} calls assertClockOwned`, /assertClockOwned\(/.test(body));
  const mutatesCustomer = /stripe(Post|Delete)\(\s*\n?\s*"\/customers\/" \+ encodeURIComponent\(fx\.stripeCustomerId\)/.test(body);
  const mutatesSubscription = /stripe(Post|Delete)\(\s*\n?\s*"\/subscriptions\/" \+ encodeURIComponent\(fx\.stripeSubscriptionId\)/.test(body);
  if (mutatesCustomer) {
    check(`${op} verifies the CUSTOMER it mutates`,
      /assertClockOwned\(secret, "customers", fx\.stripeCustomerId/.test(body));
  }
  if (mutatesSubscription) {
    check(`${op} verifies the SUBSCRIPTION it mutates`,
      /assertClockOwned\(\s*\n?\s*secret,\s*\n?\s*"subscriptions",\s*\n?\s*fx\.stripeSubscriptionId/.test(body));
  }
}
check("opProvision verifies ownership of the objects it creates",
  (fnBody(HARNESS, "async function opProvision(").match(/assertClockOwned\(/g) || []).length >= 2);
check("opDeleteClock re-reads and verifies the exact clock",
  /clock\.data\?\.id !== fx\.testClockId/.test(fnBody(HARNESS, "async function opDeleteClock(")));

/* The verdict itself, executed. */
const CLOCK = "clock_abc";
check("test_clock=null is REJECTED (this is what keeps real subscribers out)",
  (ownershipVerdict({ objectTestClock: null, objectLivemode: false, fixtureTestClockId: CLOCK }) as any)
    .error === "clock-not-owned");
check("a missing test_clock field is rejected",
  (ownershipVerdict({ objectTestClock: undefined, objectLivemode: false, fixtureTestClockId: CLOCK }) as any)
    .error === "clock-not-owned");
check("a DIFFERENT clock is rejected",
  (ownershipVerdict({ objectTestClock: "clock_other", objectLivemode: false, fixtureTestClockId: CLOCK }) as any)
    .error === "clock-not-owned");
check("the fixture's own clock is accepted",
  ownershipVerdict({ objectTestClock: CLOCK, objectLivemode: false, fixtureTestClockId: CLOCK }).ok === true);
check("an expanded clock object is accepted by id",
  ownershipVerdict({ objectTestClock: { id: CLOCK }, objectLivemode: false, fixtureTestClockId: CLOCK }).ok === true);
check("livemode true is rejected",
  (ownershipVerdict({ objectTestClock: CLOCK, objectLivemode: true, fixtureTestClockId: CLOCK }) as any)
    .error === "not-sandbox");
check("a MISSING livemode is rejected (undefined is not 'probably test')",
  (ownershipVerdict({ objectTestClock: CLOCK, objectLivemode: undefined, fixtureTestClockId: CLOCK }) as any)
    .error === "not-sandbox");
check("a fixture with no recorded clock cannot authorise anything",
  (ownershipVerdict({ objectTestClock: CLOCK, objectLivemode: false, fixtureTestClockId: undefined }) as any)
    .error === "clock-not-owned");
check("clockIdOf handles string, object and neither",
  clockIdOf("c") === "c" && clockIdOf({ id: "c" }) === "c" &&
  clockIdOf(null) === null && clockIdOf({}) === null);

/* ── 5. Idempotency ──────────────────────────────────────────────────────── */
section("5. Every external write carries a stable idempotency key");

check("keys are stable for the same fixture and operation",
  idempotencyKey("tok", "clock") === idempotencyKey("tok", "clock"));
check("keys differ per operation",
  new Set(IDEMPOTENT_OPERATIONS.map((o) => idempotencyKey("tok", o))).size ===
    IDEMPOTENT_OPERATIONS.length);
check("keys differ per fixture",
  idempotencyKey("tok1", "clock") !== idempotencyKey("tok2", "clock"));
check("the four provisioning writes use four distinct keys",
  new Set(["clock", "customer", "pm_attach_ok", "subscription"]
    .map((o) => idempotencyKey("tok", o as any))).size === 4);

/* The token is a DIGEST of the user id, never the raw id: no application
   identifier is sent to a third party. */
check("the token is hashed, not the raw user id",
  /crypto\.subtle\.digest\("SHA-256"/.test(HARNESS) &&
  /async function fixtureTokenFor\(/.test(HARNESS));
check("no raw user id is interpolated into a key",
  !/idempotencyKey\([^)]*user\._id/.test(HARNESS));
check("no email appears in key derivation", !/idempotencyKey\([^)]*email/.test(HARNESS));

/* Every stripePost / stripeDelete in the harness supplies a key. */
const writeCalls = [...HARNESS.matchAll(/stripe(Post|Delete)\(([\s\S]{0,600}?)\n  \);/g)];
check("harness Stripe writes were found to inspect", writeCalls.length >= 8);
const missingKey = writeCalls.filter((m) => !/idempotencyKey\(/.test(m[2]));
check("every harness Stripe write supplies an idempotency key" +
  (missingKey.length ? ` (${missingKey.length} without)` : ""), missingKey.length === 0);

/* ── 6. The phase machine ────────────────────────────────────────────────── */
section("6. Forward-only phase machine with in-flight protection");

check("eleven phases, in the documented order",
  PHASES.join(",") === "empty,provisioning,healthy,failure_armed,renewal_advancing," +
    "past_due,recovering,recovered,canceling,terminal,clock_deleted");
for (const banned of ["reset", "resume", "repair", "override", "force"]) {
  check(`there is no "${banned}" phase`, !(PHASES as readonly string[]).includes(banned));
}
check("isPhase rejects junk", !isPhase("nope") && !isPhase("") && !isPhase(null));

/* The full matrix: for every (command, phase) pair, admission must match the
   transition table exactly. 6 x 11 = 66 combinations, all executed. */
let matrixOk = true;
for (const c of COMMANDS) {
  for (const p of PHASES) {
    const got = admit(c, p).ok;
    const t = TRANSITIONS[c];
    const blockedByInFlight = c !== "delete_clock" && isInFlight(p);
    const want = !blockedByInFlight && p === t.from;
    if (got !== want) { matrixOk = false; console.log(`  matrix ${c}@${p}: got ${got}, want ${want}`); }
  }
}
check("the full 6x11 command/phase matrix matches the transition table", matrixOk);

check("provision only from empty", admit("provision", "empty").ok && !admit("provision", "healthy").ok);
check("arm_failure only from healthy", admit("arm_failure", "healthy").ok && !admit("arm_failure", "empty").ok);
check("advance only from failure_armed",
  admit("advance_to_renewal", "failure_armed").ok && !admit("advance_to_renewal", "healthy").ok);
check("restore_and_pay ONLY from past_due (it cannot un-arm a fixture)",
  admit("restore_and_pay", "past_due").ok &&
  !admit("restore_and_pay", "failure_armed").ok &&
  !admit("restore_and_pay", "healthy").ok);
check("cancel_fixture only from recovered",
  admit("cancel_fixture", "recovered").ok && !admit("cancel_fixture", "past_due").ok);

/* Cleanup ordering: the clock may not be deleted before the terminal webhook. */
for (const p of PHASES.filter((x) => x !== "terminal")) {
  check(`delete_clock is refused from "${p}"`, !admit("delete_clock", p).ok);
}
check("delete_clock is allowed from terminal", admit("delete_clock", "terminal").ok);

/* In-flight re-entry — the double-click guard. */
check("in-flight phases are the four documented ones",
  IN_FLIGHT_PHASES.join(",") === "provisioning,renewal_advancing,recovering,canceling");
check("a second advance during renewal_advancing is refused as already-running",
  (admit("advance_to_renewal", "renewal_advancing") as any).error === "already-running");
check("a second payment during recovering is refused as already-running",
  (admit("restore_and_pay", "recovering") as any).error === "already-running");
check("a second provision during provisioning is refused as already-running",
  (admit("provision", "provisioning") as any).error === "already-running");
check("a second cancel during canceling is refused as already-running",
  (admit("cancel_fixture", "canceling") as any).error === "already-running");

check("allowedCommands agrees with admit for every phase",
  PHASES.every((p) => allowedCommands(p).every((c) => admit(c, p).ok)));
check("an in-flight phase allows no command at all",
  IN_FLIGHT_PHASES.every((p) => allowedCommands(p).length === 0));

/* The in-flight phase is entered BEFORE the network call — that is what makes
   the second click read an in-flight phase. */
const handler = HARNESS.slice(HARNESS.indexOf("export const runCommand"));
check("the in-flight phase is persisted before the operation runs",
  before(handler, "phase: admission.inFlight", "let result: OpResult"));
check("an unknown result stops in the in-flight phase rather than retrying",
  /catch \{[\s\S]{0,200}result = \{ ok: false, error: "stripe-error" \}/.test(handler));
check("there is no retry loop around an operation", !/for \(let attempt/.test(handler));

/* ── 7. The advance ceiling ──────────────────────────────────────────────── */
section("7. The advance target is bounded before the Stripe call");

check("ADVANCE_MARGIN_SECONDS is 3600, as the brief defines", ADVANCE_MARGIN_SECONDS === 3600);
const R = 1_000_000;
check("the default target is the renewal boundary itself",
  (planAdvance(R) as any).target === R);
check("a target inside the margin is allowed",
  (planAdvance(R, R + 60) as any).target === R + 60);
check("the ceiling exactly is allowed",
  (planAdvance(R, R + ADVANCE_MARGIN_SECONDS) as any).target === R + ADVANCE_MARGIN_SECONDS);
check("one second past the ceiling is REJECTED",
  planAdvance(R, R + ADVANCE_MARGIN_SECONDS + 1).ok === false);
check("a two-week over-advance is rejected (this is the one that cancels the fixture)",
  planAdvance(R, R + 14 * 24 * 3600).ok === false);
check("a target before the renewal is rejected", planAdvance(R, R - 1).ok === false);
check("a non-numeric renewal is rejected",
  planAdvance("soon" as any).ok === false && planAdvance(null as any).ok === false);
check("NaN and Infinity are rejected",
  planAdvance(R, NaN).ok === false && planAdvance(R, Infinity).ok === false);
check("a zero or negative renewal is rejected",
  planAdvance(0).ok === false && planAdvance(-5).ok === false);

/* Order matters: the guard must precede the request, or it is a log line. */
const advBody = fnBody(HARNESS, "async function opAdvance(");
check("planAdvance is called before the advance request",
  before(advBody, "planAdvance(", "/test_helpers/test_clocks/"));
check("an unsafe target RETURNS before the advance request",
  before(advBody, "if (!plan.ok) return", "/advance"));
check("the ceiling guard exists at all", /if \(!plan\.ok\) return/.test(advBody));
check("the boundary is read from Stripe, not from the stored fixture value",
  /const renewalAt = sub\.object\?\.items\?\.data\?\.\[0\]\?\.current_period_end/.test(advBody));
check("the clock is polled to ready before anything is read",
  before(advBody, 'status === "ready"', "fixtureListPath("));
check("exactly one failed attempt is required",
  /isSingleFailedAttempt\(open\.attempt_count\)/.test(advBody));
check("more than one attempt is a hard stop, not a recovery",
  /return \{ ok: false, error: "unexpected-attempt-count" \}/.test(advBody));
check("next_payment_attempt is recorded, never asserted against a fixed time",
  /nextPaymentAttempt:/.test(advBody) &&
  /typeof open\.next_payment_attempt === "number"/.test(advBody) &&
  !/next_payment_attempt\s*[<>=!]+\s*\d/.test(advBody));
check("isSingleFailedAttempt accepts only 1",
  isSingleFailedAttempt(1) && !isSingleFailedAttempt(0) && !isSingleFailedAttempt(2) &&
  !isSingleFailedAttempt("1") && !isSingleFailedAttempt(null));

/* ── 8. Filtered queries for test-clock resources ────────────────────────── */
section("8. Test-clock resources are read with a scoped query");

check("a scoped invoice path is produced",
  fixtureListPath("invoices", "subscription", "sub_x") === "/invoices?subscription=sub_x");
check("customer and clock scopes work",
  fixtureListPath("invoices", "customer", "cus_x") === "/invoices?customer=cus_x" &&
  fixtureListPath("invoices", "test_clock", "clock_x") === "/invoices?test_clock=clock_x");
check("an unscoped query cannot be constructed",
  fixtureListPath("invoices", "" as any, "x") === null &&
  fixtureListPath("invoices", "limit" as any, "x") === null);
check("a missing id yields no path", fixtureListPath("invoices", "customer", "") === null);
check("the harness reads fixture invoices through the scoped builder",
  /fixtureListPath\("invoices", "subscription"/.test(advBody));
check("no broad unscoped list is treated as authoritative for fixture objects",
  !/stripeGet\("\/invoices"\s*,/.test(HARNESS) && !/stripeGet\("\/invoices\?limit/.test(HARNESS));

/* ── 9. Nothing provider-shaped reaches the browser ──────────────────────── */
section("9. The response is an allowlist, not a redaction");

const FIXTURE = {
  phase: "past_due",
  attemptCount: 1,
  lastError: "not-converged",
  userId: "user_secret",
  testClockId: "clock_secret",
  stripeCustomerId: "cus_secret",
  stripeSubscriptionId: "sub_secret",
  renewalInvoiceId: "in_secret",
  failingPaymentMethodId: "pm_secret",
  originalCustomerDefaultPaymentMethodId: "pm_orig",
  renewalAt: 123,
  nextPaymentAttempt: 456,
  fixtureToken: "tok_secret",
};
const projected = safeStatus(FIXTURE);
const projectedJson = JSON.stringify(projected);
check("the projection returns exactly the allowlisted fields",
  JSON.stringify(Object.keys(projected).sort()) === JSON.stringify([...STATUS_FIELDS].sort()));
for (const f of FORBIDDEN_STATUS_FIELDS) {
  check(`"${f}" is absent from the projection`, !(f in (projected as any)));
}
for (const secret of ["user_secret", "clock_secret", "cus_secret", "sub_secret",
                      "in_secret", "pm_secret", "pm_orig", "tok_secret"]) {
  check(`the value "${secret}" does not appear in the response`, !projectedJson.includes(secret));
}
check("numbers that could correlate a fixture are absent",
  !projectedJson.includes("123") && !projectedJson.includes("456"));
check("a null fixture projects safely, not as an error",
  safeStatus(null).phase === "empty" && safeStatus(null).hasFixture === false);
check("a fixture with a junk phase falls back to empty rather than trusting it",
  safeStatus({ phase: "whatever" }).phase === "empty");

/* Stripe's own error text can carry request details, so only codes escape. */
check("an unknown error becomes stripe-error", safeError("Card was declined: cus_123") === "stripe-error");
check("an allowlisted code is preserved", safeError("wrong-phase") === "wrong-phase");
check("every allowlisted code round-trips", ERROR_CODES.every((c) => safeError(c) === c));
check("a non-allowlisted lastError is dropped from the projection",
  safeStatus({ phase: "healthy", lastError: "raw stripe text cus_1" }).lastError === null);
check("the handler returns only safeStatus, never a raw fixture row",
  /return \{ ok: true, status: safeStatus\(/.test(handler) && !/status: fresh\.row/.test(handler));

/* ── 10. Protected production paths are untouched ────────────────────────── */
section("10. Production billing behaviour is unchanged");

const PROTECTED = ["convex/http.ts", "convex/subscriptions.ts", "convex/subscriptionGuard.ts",
                   "convex/entitlements.ts", "convex/plusPlans.ts"];
for (const rel of PROTECTED) {
  const src = read(rel);
  check(`${rel} contains no harness reference`,
    !/testHarness|billingTestFixtures|test_clock|TestClock/.test(src));
}
check("the narrow invoice reader still reads ONE location and never a line",
  /const nested = obj\?\.parent\?\.subscription_details\?\.subscription;/.test(read("convex/http.ts")) &&
  !/subscription_item_details/.test(strip(read("convex/http.ts"))));
check("the harness never imports the webhook handler", !/from "\.\/http"/.test(HARNESS));
check("the harness does not import the duplicate guard", !/subscriptionGuard/.test(HARNESS));
check("the harness reads canonical state through existing internal queries only",
  /internal\.subscriptions\.getByUserProviderInternal/.test(HARNESS) &&
  !/ctx\.db\.(patch|insert|delete)\(/.test(HARNESS.slice(HARNESS.indexOf("async function opProvision"))));
check("the harness never inserts a billing row itself",
  !/insert\("subscriptions"/.test(HARNESS) && !/insert\("billingCustomers"/.test(HARNESS));
check("no Checkout Session endpoint is referenced", !/checkout\/sessions/.test(HARNESS));
check("no Billing Portal endpoint is referenced", !/billing_portal/.test(HARNESS));

/* ── 11. Provisioning shape ──────────────────────────────────────────────── */
section("11. Provisioning creates the right objects in the right order");

const prov = fnBody(HARNESS, "async function opProvision(");
check("the FIRST Stripe write is the empty test clock (the scope probe)",
  before(prov, "/test_helpers/test_clocks", '"/customers"'));
check("the clock id is persisted before the next write",
  before(prov, "upsertFixtureInternal", '"/customers"'));
check("the Customer is created ON the clock", /test_clock: clockId/.test(prov));
check("NO email is sent when creating the Customer", !/email/.test(prov));
check("the annual Price comes from the configured env mapping",
  /process\.env\[PLAN_CATALOG\.plus_annual\.envVar\]/.test(prov));
check("no Price id is hardcoded", !/price_1[A-Za-z0-9]/.test(HARNESS));
for (const field of ["userId", "plan", "source", "billing_schema_version", "environment"]) {
  check(`the subscription stamps metadata[${field}]`, prov.includes('"metadata[' + field + ']"'));
}
check("the provenance uses the SAME constants production stamps",
  /CHECKOUT_SOURCE/.test(prov) && /BILLING_SCHEMA_VERSION/.test(prov));
check("flexible billing mode matches production shape", /"billing_mode\[type\]": "flexible"/.test(prov));
check("no trial is configured", !/trial/.test(prov));
check("provisioning refuses an account that already has billing",
  /error: "already-has-billing"/.test(prov));
check("healthy is reached only after the CANONICAL row exists",
  before(prov, "getByUserProviderInternal", "return {\n    ok: true,") &&
  /error: "not-converged"/.test(prov));

/* ── 12. Arm, recover, clean up ──────────────────────────────────────────── */
section("12. Arming, recovery and cleanup");

const arm = fnBody(HARNESS, "async function opArmFailure(");
check("arming attaches the documented decline-on-charge alias",
  /PM_DECLINE_ON_CHARGE/.test(arm));
check("the decline alias is Stripe's published test value",
  /const PM_DECLINE_ON_CHARGE = "pm_card_chargeCustomerFail"/.test(HARNESS));
check("arming sets ONLY the customer default",
  /"invoice_settings\[default_payment_method\]"/.test(arm) &&
  !/"default_payment_method":/.test(arm));
check("arming does not touch the subscription-level default",
  !/\/subscriptions\/" \+ encodeURIComponent\(fx\.stripeSubscriptionId\),\s*\n\s*secret,\s*\n\s*\{ *"default_payment_method/.test(arm));
check("arming makes no payment attempt and no clock advance",
  !/\/pay"/.test(arm) && !/invoices\//.test(arm) && !/test_clocks/.test(arm));
check("arming requires the working method to still be default",
  /fx\.originalCustomerDefaultPaymentMethodId/.test(arm));

const rec = fnBody(HARNESS, "async function opRestoreAndPay(");
check("recovery never advances the clock", !/test_clocks/.test(rec));
check("recovery restores the EXACT original customer default",
  /fx\.originalCustomerDefaultPaymentMethodId/.test(rec));
check("precedence is proven BEFORE payment is attempted",
  before(rec, "originalCustomerDefaultPaymentMethodId", '/pay"'));
check("the same invoice is paid, not a new one",
  /\/invoices\/" \+ encodeURIComponent\(fx\.renewalInvoiceId\)/.test(rec) &&
  !/stripePost\(\s*"\/invoices"/.test(rec));
check("payment happens exactly once in the function",
  (rec.match(/\/pay"/g) || []).length === 1);
check("no alternative payment method is created",
  !/PM_SUCCESS/.test(rec) && !/payment_methods\/pm_card/.test(rec));
check("the failing method is detached only after recovery is proven",
  before(rec, 'error: "not-converged"', "detach"));

const can = fnBody(HARNESS, "async function opCancelFixture(");
check("cancellation targets only the clock-owned subscription",
  /assertClockOwned\(/.test(can) && /fx\.stripeSubscriptionId/.test(can));
check("cancellation requires the account to actually lose Plus",
  /canonical\.tier === "plus"/.test(can) && /error: "not-converged"/.test(can));

const del = fnBody(HARNESS, "async function opDeleteClock(");
check("clock deletion verifies livemode false", /livemode !== false/.test(del));
check("clock deletion deletes only the fixture clock",
  (del.match(/stripeDelete\(/g) || []).length === 1 && /fx\.testClockId/.test(del));
check("no general-purpose Convex billing cleanup mutation was added",
  !/deleteBillingCustomer|purgeBilling|removeMapping/.test(HARNESS));

/* ── 13. The development surface ─────────────────────────────────────────── */
section("13. The dev page is gated and leaks nothing");

check("the harness route has its OWN public flag",
  /PUBLIC_BILLING_HARNESS_CONTROL/.test(PAGE_RAW));
check("GATE A gates the harness path on DEV && its own flag",
  /import\.meta\.env\.DEV && import\.meta\.env\.PUBLIC_BILLING_HARNESS_CONTROL === '1'/.test(PAGE_RAW));
check("GATE B repeats it with inline literals so Vite can fold it",
  /if \(import\.meta\.env\.DEV && import\.meta\.env\.PUBLIC_BILLING_HARNESS_CONTROL === '1'\)/.test(PAGE_RAW));
check("the two controls have INDEPENDENT flags",
  /PUBLIC_BILLING_DEV_CONTROL/.test(PAGE_RAW) &&
  !/PUBLIC_BILLING_HARNESS_CONTROL === '1' \|\| /.test(PAGE_RAW));
check("the page sends only { command }", /runCommand, \{ command \}/.test(PAGE_RAW));
check("the page renders only safe status fields",
  /\['phase', 'inFlight', 'attemptCount', 'hasFixture', 'lastError'\]/.test(PAGE_RAW));
check("six command buttons exist", COMMANDS.every((c) => PAGE_RAW.includes('id="hx_' + c + '"')));
check("buttons start disabled", (PAGE_RAW.match(/class="db-btn" disabled/g) || []).length >= 6);
check("a client-side double-submit guard exists",
  /if \(pending\) return;/.test(PAGE_RAW) && /pending = true;/.test(PAGE_RAW));
check("the page labels itself development-only",
  /Development only/.test(PAGE_RAW) && /sandbox tooling/.test(PAGE_RAW));
check("no provider identifier is written to storage, URL or console from the harness block",
  !/localStorage|sessionStorage|history\.replaceState|console\.log/.test(
    PAGE_RAW.slice(PAGE_RAW.indexOf("GATE B for the Test Clock harness"))));
check("no production navigation points at the harness",
  !readdirSync(join(ROOT, "src/components"), { withFileTypes: true })
    .filter((d) => d.isFile())
    .some((d) => readFileSync(join(ROOT, "src/components", d.name), "utf8")
      .includes("billing-harness")));

/* ── 14. Build output contains none of it ────────────────────────────────── */
section("14. Nothing harness-shaped survives a production build");

const DIST = join(ROOT, "dist");
if (!existsSync(DIST)) {
  console.log("  dist/ missing — run `npm run build` first.");
  process.exit(1);
}
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(DIST);
check("dist/ contains files to inspect", files.length > 0);
check("dist/dev/ does not exist", !existsSync(join(DIST, "dev")));
for (const needle of ["runCommand", "billing-harness", "PUBLIC_BILLING_HARNESS_CONTROL",
                      "testHarness", "pm_card_chargeCustomerFail", "test_helpers",
                      "advance_to_renewal", "arm_failure", "delete_clock"]) {
  const hits = files.filter((f) => readFileSync(f, "utf8").includes(needle))
    .map((f) => f.slice(DIST.length + 1));
  check(`no production file contains "${needle}"` +
    (hits.length ? ` (found in ${hits.slice(0, 3).join(", ")})` : ""), hits.length === 0);
}

/* ── 15. Schema and isolation ────────────────────────────────────────────── */
section("15. The fixture table is separate and closed");

check("a dedicated fixture table exists", /billingTestFixtures: defineTable\(/.test(SCHEMA));
check("it is indexed by user", /\.index\("by_user", \["userId"\]\)/.test(
  SCHEMA.slice(SCHEMA.indexOf("billingTestFixtures"))));
check("the phase column is a closed union, not a free string",
  /phase: v\.union\(/.test(SCHEMA.slice(SCHEMA.indexOf("billingTestFixtures"))));
check("every phase is representable in the schema union",
  PHASES.every((p) => SCHEMA.slice(SCHEMA.indexOf("billingTestFixtures")).includes(`v.literal("${p}")`)));
check("the production subscriptions table was NOT repurposed",
  !/testClockId|fixtureToken|failingPaymentMethodId/.test(
    SCHEMA.slice(SCHEMA.indexOf("subscriptions: defineTable"), SCHEMA.indexOf("billingCustomers"))));
check("duplicate fixtures fail closed rather than picking one",
  /rows\.length > 1/.test(HARNESS) && /duplicate-fixture/.test(HARNESS));

/* ── 16. No network on import ────────────────────────────────────────────── */
section("16. Importing the decision module reaches nothing");

check("the state module has no imports at all", !/^import /m.test(read(STATE_REL)));
check("the state module contains no fetch", !/fetch\(/.test(STATE));
check("the state module contains no Date.now in any decision", !/Date\.now\(\)/.test(STATE));
check("this suite imported it without a network call", typeof admit === "function");

console.log("\n" + "─".repeat(62));
if (failed > 0) {
  console.log(`FAILED — ${failed} of ${passed + failed} checks`);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed + failed} checks`);
