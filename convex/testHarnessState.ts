/* Declare & Believe — the Test Clock harness's decisions, with no network in them.
 *
 * WHY THIS FILE IS SEPARATE FROM testHarness.ts
 * Every rule that matters here is a safety rule: which phase may run which
 * command, how far the clock may be advanced, what may be returned to a
 * browser. A safety rule that lives inside an action can only be checked by
 * reading it and hoping. Keeping the decisions here lets
 * scripts/verify-billing-test-harness.ts import and EXECUTE them, the same way
 * subscriptionGuard.ts and stripeCancellation.ts are exercised rather than
 * described.
 *
 * Dependency-free on purpose: plain `node` must be able to run it. No Convex
 * import, no fetch, no Date.now() in any decision.
 *
 * Design source of truth: docs/implementation/billing-test-harness-brief.md
 */

/* ── PHASES ──────────────────────────────────────────────────────────────── */

/* Forward-only. There is deliberately no `repair`, `resume`, `reset` or
 * override phase: a fixture that has gone somewhere unexpected is a thing to
 * look at, not a thing to nudge back into line. */
export const PHASES = [
  "empty",
  "provisioning",
  "healthy",
  "failure_armed",
  "renewal_advancing",
  "past_due",
  "recovering",
  "recovered",
  "canceling",
  "terminal",
  "clock_deleted",
] as const;

export type Phase = (typeof PHASES)[number];

export function isPhase(x: unknown): x is Phase {
  return typeof x === "string" && (PHASES as readonly string[]).includes(x);
}

/* The phases a command is actively running in. Re-entering one of these is a
 * double-click, not a retry — and a double-click that reached Stripe twice is
 * exactly how a second clock advance or a second payment attempt happens. */
export const IN_FLIGHT_PHASES: readonly Phase[] = [
  "provisioning",
  "renewal_advancing",
  "recovering",
  "canceling",
];

export function isInFlight(phase: Phase): boolean {
  return IN_FLIGHT_PHASES.includes(phase);
}

/* ── COMMANDS ────────────────────────────────────────────────────────────── */

export const COMMANDS = [
  "provision",
  "arm_failure",
  "advance_to_renewal",
  "restore_and_pay",
  "cancel_fixture",
  "delete_clock",
] as const;

export type Command = (typeof COMMANDS)[number];

export function isCommand(x: unknown): x is Command {
  return typeof x === "string" && (COMMANDS as readonly string[]).includes(x);
}

/* One row per command: where it may start, where it sits while running, and
 * where it lands. Data rather than a switch, so the verification suite can
 * assert on the table itself instead of re-deriving control flow. */
export type Transition = {
  from: Phase;
  inFlight: Phase;
  to: Phase;
};

export const TRANSITIONS: Readonly<Record<Command, Transition>> = {
  provision: { from: "empty", inFlight: "provisioning", to: "healthy" },
  arm_failure: { from: "healthy", inFlight: "failure_armed", to: "failure_armed" },
  advance_to_renewal: {
    from: "failure_armed",
    inFlight: "renewal_advancing",
    to: "past_due",
  },
  restore_and_pay: { from: "past_due", inFlight: "recovering", to: "recovered" },
  cancel_fixture: { from: "recovered", inFlight: "canceling", to: "terminal" },
  delete_clock: { from: "terminal", inFlight: "terminal", to: "clock_deleted" },
};

/* ── SAFE ERROR CODES ────────────────────────────────────────────────────── */

/* The complete set a browser may ever see. Stripe's own error text can carry
 * request details and object ids, so it never leaves the server: an unexpected
 * upstream result becomes `stripe-error` and stops the fixture where it is. */
export const ERROR_CODES = [
  "not-authenticated",
  "harness-disabled",
  "wrong-deployment",
  "not-sandbox",
  "unknown-command",
  "wrong-phase",
  "already-running",
  "no-fixture",
  "duplicate-fixture",
  "already-has-billing",
  "not-free-account",
  "clock-not-owned",
  "advance-target-unsafe",
  "unexpected-attempt-count",
  "not-converged",
  "stripe-error",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(x: unknown): x is ErrorCode {
  return typeof x === "string" && (ERROR_CODES as readonly string[]).includes(x);
}

/* ── COMMAND ADMISSION ───────────────────────────────────────────────────── */

export type Admission =
  | { ok: true; command: Command; inFlight: Phase; to: Phase }
  | { ok: false; error: ErrorCode };

/* The one place a command is allowed to start.
 *
 * Order matters and is deliberate: an unknown command is rejected before the
 * phase is consulted, and an in-flight phase is reported as `already-running`
 * rather than `wrong-phase`, because those two mean very different things to
 * whoever is reading the screen. One is "you clicked twice"; the other is "the
 * fixture is not where you think it is".
 *
 * Nothing here infers, repairs, or resumes. A fixture in an unexpected phase
 * produces a rejection and stays exactly where it was. */
export function admit(rawCommand: unknown, phase: Phase, fixture?: unknown): Admission {
  if (!isCommand(rawCommand)) return { ok: false, error: "unknown-command" };
  const command = rawCommand;
  const t = TRANSITIONS[command];

  /* ADOPTION. A `provisioning` fixture that satisfies the strict predicate may
     re-run `provision`, which then takes the read-only path. This is the one
     exception to in-flight refusal, and it is safe precisely because the
     adoption branch issues no Stripe write at all — a double-click can produce
     at worst a second round of reads. */
  if (command === "provision" && phase === "provisioning" && isAdoptable(fixture)) {
    return { ok: true, command, inFlight: "provisioning", to: "healthy" };
  }

  /* Re-entry check first. `delete_clock` starts from `terminal` and also uses
     `terminal` as its in-flight phase, so it is exempt from this check — it is
     protected instead by requiring terminal webhook convergence before the
     delete, and by being unreachable from any earlier phase. */
  if (command !== "delete_clock" && isInFlight(phase)) {
    return { ok: false, error: "already-running" };
  }
  if (phase !== t.from) return { ok: false, error: "wrong-phase" };
  return { ok: true, command, inFlight: t.inFlight, to: t.to };
}

/** Which commands a given phase may start. Used to disable UI buttons. */
export function allowedCommands(phase: Phase, fixture?: unknown): Command[] {
  return COMMANDS.filter((c) => admit(c, phase, fixture).ok);
}

/* ── PRE-WRITE FAILURE ROLLBACK ──────────────────────────────────────────── */

/* Every provider identifier the fixture can hold. If none is set, the harness
 * has persisted no reference to anything in Stripe. */
export const PROVIDER_ID_FIELDS = [
  "testClockId",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "renewalInvoiceId",
  "failingPaymentMethodId",
  "originalCustomerDefaultPaymentMethodId",
  "originalSubscriptionDefaultPaymentMethodId",
] as const;

/** True when the fixture references at least one Stripe object. */
export function hasPersistedProviderState(fixture: unknown): boolean {
  if (!fixture || typeof fixture !== "object") return false;
  const f = fixture as Record<string, unknown>;
  return PROVIDER_ID_FIELDS.some((k) => typeof f[k] === "string" && (f[k] as string).length > 0);
}

/* Where a FAILED command leaves the fixture.
 *
 * WHY THIS EXISTS
 * The first attempt at a real run failed on the very first Stripe write — the
 * Test Clock creation, which is deliberately the scope probe. Nothing was
 * created. But the fixture stayed in `provisioning`, an in-flight phase, and
 * in-flight phases refuse re-entry so a double-click cannot produce a second
 * advance or a second payment. That refusal is correct and stays. Its
 * side-effect was not: the account became permanently unusable, with no
 * authorized recovery, because a failure that created nothing was
 * indistinguishable from one that created something.
 *
 * The distinction the machine was missing is not "did the command fail" but
 * "did we persist a reference to anything". So:
 *
 *   - No provider id persisted -> nothing exists to orphan -> return to the
 *     starting phase, and the account may be provisioned again.
 *   - Any provider id persisted -> stay in-flight. Something may exist in
 *     Stripe, and a fixture that quietly reset would invite a second
 *     provisioning run on top of it.
 *
 * Restricted to `provision` on purpose. Every later command begins with
 * identifiers already stored, so it can never satisfy the empty-state
 * condition, and widening this to them would be a claim about partially
 * applied external state that we cannot make from here.
 *
 * This changes only where a FAILURE lands. Success paths, the transition
 * table, and in-flight re-entry refusal are all untouched. */
export function phaseAfterFailure(command: Command, fixture: unknown): Phase {
  const t = TRANSITIONS[command];
  if (command !== "provision") return t.inFlight;
  if (hasPersistedProviderState(fixture)) return t.inFlight;
  return t.from;
}

/* ── ADVANCE CEILING ─────────────────────────────────────────────────────── */

/* The safety budget, in seconds, past the renewal boundary.
 *
 * The sandbox is configured with Smart Retries, up to 8 retries over two weeks,
 * and a FINAL ACTION OF CANCEL. So an over-advanced clock does not merely
 * retry — it destroys the fixture subscription and fires a terminal webhook in
 * the middle of the test. Two weeks of simulated time is the distance between a
 * working fixture and a dead one, and this constant is what keeps the advance
 * nowhere near it.
 *
 * One hour, from the design brief. Do not raise it to "make the renewal land"
 * — if a renewal has not been produced within the margin, that is a finding to
 * report, not a number to grow. */
export const ADVANCE_MARGIN_SECONDS = 3600;

export type AdvancePlan =
  | { ok: true; target: number }
  | { ok: false; error: ErrorCode };

/* Compute the single permitted advance target, and refuse anything past the
 * ceiling. This runs BEFORE the Stripe request is issued — a ceiling checked
 * after the call would be a log message, not a guard. */
export function planAdvance(renewalAt: unknown, requested?: unknown): AdvancePlan {
  if (typeof renewalAt !== "number" || !Number.isFinite(renewalAt) || renewalAt <= 0) {
    return { ok: false, error: "advance-target-unsafe" };
  }
  const ceiling = renewalAt + ADVANCE_MARGIN_SECONDS;
  /* Default target is the boundary itself. A caller may ask for a little more
     — the small step used when the renewal has not appeared yet — but never
     past the ceiling. */
  const target = requested === undefined ? renewalAt : requested;
  if (typeof target !== "number" || !Number.isFinite(target)) {
    return { ok: false, error: "advance-target-unsafe" };
  }
  if (target < renewalAt) return { ok: false, error: "advance-target-unsafe" };
  if (target > ceiling) return { ok: false, error: "advance-target-unsafe" };
  return { ok: true, target };
}

/** True only for the one attempt this test permits. */
export function isSingleFailedAttempt(attemptCount: unknown): boolean {
  return attemptCount === 1;
}

/* ── IDEMPOTENCY ─────────────────────────────────────────────────────────── */

/* Stable per (fixture, operation) so a retried action can never create a second
 * clock, customer or subscription, and a double-clicked payment can never
 * become a second charge.
 *
 * `fixtureToken` is a HASH of the application user id, computed once by the
 * caller — never the raw id. The design brief sketched these keys as
 * `hz:clock:<userId>`; embedding a raw application identifier in a value that
 * is sent to a third party is worse than the alternative, and the hash is
 * equally stable, so the key is derived from the digest instead. That is a
 * tightening of the brief, not a relaxation of it.
 *
 * Distinct per provisioning sub-operation, so the four provisioning writes
 * cannot collide with one another. */
export const IDEMPOTENCY_PREFIX = "hz";

export const IDEMPOTENT_OPERATIONS = [
  "clock",
  "customer",
  "pm_attach_ok",
  "pm_default_ok",
  "subscription",
  "pm_attach_fail",
  "pm_default_fail",
  "advance",
  "pm_restore",
  "pm_detach",
  "invoice_pay",
  "cancel",
  "clock_delete",
] as const;

export type IdempotentOperation = (typeof IDEMPOTENT_OPERATIONS)[number];

export function idempotencyKey(
  fixtureToken: string,
  operation: IdempotentOperation,
): string {
  return IDEMPOTENCY_PREFIX + ":" + operation + ":" + fixtureToken;
}

/* ── SAFE PROJECTION ─────────────────────────────────────────────────────── */

/* Exactly what the browser may see. Every one of these is provider-NEUTRAL:
 * a phase name, a boolean, a count, an allowlisted error code. There is no
 * Stripe identifier here, and there is no field into which one could be
 * smuggled, because the projection is an allowlist rather than a redaction. */
export const STATUS_FIELDS = [
  "phase",
  "allowed",
  "inFlight",
  "attemptCount",
  "hasFixture",
  "lastError",
] as const;

/* Named so the suite can assert on the list rather than on a regex someone can
 * outrun. None of these is returned by the projection below. */
export const FORBIDDEN_STATUS_FIELDS = [
  "testClockId",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "renewalInvoiceId",
  "originalCustomerDefaultPaymentMethodId",
  "originalSubscriptionDefaultPaymentMethodId",
  "failingPaymentMethodId",
  "userId",
  "email",
  "nextPaymentAttempt",
  "renewalAt",
  "fixtureToken",
] as const;

export type SafeStatus = {
  phase: Phase;
  allowed: Command[];
  inFlight: boolean;
  attemptCount: number;
  hasFixture: boolean;
  lastError: ErrorCode | null;
};

/* Project a fixture row down to what may cross the wire.
 *
 * Built by CONSTRUCTION, not by deletion: the returned object is assembled
 * field by field from the allowlist, so a new column added to the fixture table
 * later cannot leak by being forgotten here. */
export function safeStatus(fixture: unknown): SafeStatus {
  const f = (fixture && typeof fixture === "object" ? fixture : {}) as Record<string, unknown>;
  const phase: Phase = isPhase(f.phase) ? f.phase : "empty";
  const rawErr = f.lastError;
  const adoptable = isAdoptable(f);
  return {
    phase,
    allowed: allowedCommands(phase, f),
    /* An adoptable fixture is stopped, not running. Reporting it as in-flight
       would tell the operator to wait for something that will never finish. */
    inFlight: isInFlight(phase) && !adoptable,
    attemptCount: typeof f.attemptCount === "number" ? f.attemptCount : 0,
    hasFixture: Boolean(fixture && typeof fixture === "object"),
    lastError: isErrorCode(rawErr) ? rawErr : null,
  };
}

/** Any non-allowlisted error becomes `stripe-error`. Upstream text never leaves. */
export function safeError(x: unknown): ErrorCode {
  return isErrorCode(x) ? x : "stripe-error";
}

/* ── FILTERED QUERIES ────────────────────────────────────────────────────── */

/* Stripe omits test-clock objects from broad list calls unless the request is
 * scoped to a customer, subscription, or clock. A broad `GET /v1/invoices`
 * would return nothing for this fixture and look calm doing it — which is the
 * easiest possible way to produce a confidently wrong verification.
 *
 * So fixture reads are built here, and the builder REFUSES to produce an
 * unscoped path. */
export const FIXTURE_QUERY_SCOPES = ["customer", "subscription", "test_clock"] as const;
export type FixtureQueryScope = (typeof FIXTURE_QUERY_SCOPES)[number];

export function fixtureListPath(
  resource: "invoices" | "subscriptions" | "payment_methods" | "customers",
  scope: FixtureQueryScope,
  id: string,
  extra?: Record<string, string>,
): string | null {
  if (!FIXTURE_QUERY_SCOPES.includes(scope)) return null;
  if (typeof id !== "string" || !id) return null;
  const p = new URLSearchParams();
  p.set(scope, id);
  for (const [k, v] of Object.entries(extra || {})) p.set(k, v);
  return "/" + resource + "?" + p.toString();
}

/* ── CLOCK OWNERSHIP ─────────────────────────────────────────────────────── */

/* The decision half of assertClockOwned, kept here so it can be executed by the
 * suite. The retrieval half lives in testHarness.ts because it needs network.
 *
 * WHAT THIS DOES AND DOES NOT CLAIM
 * Stripe does not prevent writes to ordinary sandbox objects. Nothing about a
 * plain sandbox Customer stops an API call from reaching it. This function is
 * the boundary: the harness retrieves the object, reads the `test_clock` Stripe
 * reports, and refuses anything that is null or not this fixture's clock. The
 * enforcement is ours. Stripe only supplies the fact. */
export type OwnershipInput = {
  objectTestClock: unknown; // as returned by Stripe: id, expanded object, or null
  objectLivemode: unknown;
  fixtureTestClockId: unknown;
};

export function clockIdOf(x: unknown): string | null {
  if (typeof x === "string" && x) return x;
  if (x && typeof x === "object" && typeof (x as any).id === "string" && (x as any).id) {
    return (x as any).id;
  }
  return null;
}

export function ownershipVerdict(
  input: OwnershipInput,
): { ok: true } | { ok: false; error: ErrorCode } {
  /* livemode must be explicitly false. `undefined` is not "probably test" — a
     missing field means we did not read what we thought we read. */
  if (input.objectLivemode !== false) return { ok: false, error: "not-sandbox" };
  const fixtureClock = clockIdOf(input.fixtureTestClockId);
  if (!fixtureClock) return { ok: false, error: "clock-not-owned" };
  const objectClock = clockIdOf(input.objectTestClock);
  /* The null case is the one that matters: both existing subscribers report
     `test_clock: null`, so this is the branch that keeps a real subscriber out
     of every harness write. */
  if (!objectClock) return { ok: false, error: "clock-not-owned" };
  if (objectClock !== fixtureClock) return { ok: false, error: "clock-not-owned" };
  return { ok: true };
}

/* ── RECOVERY-TARGET OWNERSHIP ───────────────────────────────────────────── */

/* An Invoice and a PaymentMethod carry no `test_clock` of their own, so
 * ownershipVerdict above cannot speak for them. They are reached instead
 * through the object that IS clock-verified:
 *
 *   clock -> subscription (verified) -> invoice        (verified against it)
 *   clock -> customer     (verified) -> paymentMethod  (verified against it)
 *
 * WHY THIS EXISTS AT ALL
 * Both were previously mutated straight from the fixture record. The fixture is
 * our own writing, and the whole reason assertClockOwned retrieves rather than
 * trusts is that a wrong stored id must not be able to authorise a write. The
 * invoice pay is the only money-moving call in the harness, so it was exactly
 * the wrong place to make an exception. Found in review of PR #37.
 *
 * As above: Stripe does not prevent these writes. These functions do. */

export type InvoiceOwnershipInput = {
  invoiceLivemode: unknown;
  invoiceId: unknown;
  expectedInvoiceId: unknown;
  /* The trusted root association — the SAME field convex/http.ts reads, and
   * deliberately not the invoice line, which is not a subscription-health
   * signal and which the production reader refuses to consult. */
  invoiceSubscription: unknown;
  expectedSubscriptionId: unknown;
  invoiceStatus: unknown;
};

export function invoiceOwnershipVerdict(
  i: InvoiceOwnershipInput,
): { ok: true } | { ok: false; error: ErrorCode } {
  if (i.invoiceLivemode !== false) return { ok: false, error: "not-sandbox" };
  if (typeof i.expectedInvoiceId !== "string" || !i.expectedInvoiceId) {
    return { ok: false, error: "clock-not-owned" };
  }
  if (i.invoiceId !== i.expectedInvoiceId) return { ok: false, error: "clock-not-owned" };
  if (typeof i.expectedSubscriptionId !== "string" || !i.expectedSubscriptionId) {
    return { ok: false, error: "clock-not-owned" };
  }
  const linked = clockIdOf(i.invoiceSubscription);
  /* A null association is the branch that matters: an invoice not owned by this
     fixture's verified subscription must never be paid. */
  if (!linked || linked !== i.expectedSubscriptionId) {
    return { ok: false, error: "clock-not-owned" };
  }
  /* Only the open renewal invoice is payable here. A `paid` invoice needs no
     recovery, and anything else is not the object this phase expects. */
  if (i.invoiceStatus !== "open") return { ok: false, error: "not-converged" };
  return { ok: true };
}

export type PaymentMethodOwnershipInput = {
  pmLivemode: unknown;
  pmId: unknown;
  expectedPmId: unknown;
  pmCustomer: unknown;
  expectedCustomerId: unknown;
};

export function paymentMethodOwnershipVerdict(
  m: PaymentMethodOwnershipInput,
): { ok: true } | { ok: false; error: ErrorCode } {
  if (m.pmLivemode !== false) return { ok: false, error: "not-sandbox" };
  if (typeof m.expectedPmId !== "string" || !m.expectedPmId) {
    return { ok: false, error: "clock-not-owned" };
  }
  if (m.pmId !== m.expectedPmId) return { ok: false, error: "clock-not-owned" };
  if (typeof m.expectedCustomerId !== "string" || !m.expectedCustomerId) {
    return { ok: false, error: "clock-not-owned" };
  }
  /* A detached method reports `customer: null`. Detaching something attached to
     nothing, or to somebody else, is refused. */
  const attachedTo = clockIdOf(m.pmCustomer);
  if (!attachedTo || attachedTo !== m.expectedCustomerId) {
    return { ok: false, error: "clock-not-owned" };
  }
  return { ok: true };
}


/* ── CONVERGENCE POLLING ─────────────────────────────────────────────────── */

/* Webhook delivery is asynchronous. The first real provisioning run created the
 * Stripe objects correctly, the webhook applied correctly, and provisioning
 * still reported `not-converged` — because the canonical row was read ONCE,
 * immediately after the subscription was created, before the event could
 * possibly have landed.
 *
 * opAdvance already polls the clock to `ready` with these same bounds. This is
 * the same idea applied to the half that was missing it. Bounded, never
 * recursive, and reads only: a convergence timeout is a reason to stop and look,
 * never permission to create a second object. */
export const CONVERGENCE_POLL_ATTEMPTS = 30;
export const CONVERGENCE_POLL_INTERVAL_MS = 2000;

/* ── HEALTHY FIXTURE COMPLETENESS ────────────────────────────────────────── */

/* Exactly what a fixture must hold for the rest of the lifecycle to run without
 * rediscovering anything. Derived from what the downstream operations actually
 * read, not from what provisioning happens to write:
 *
 *   arm_failure      testClockId, stripeCustomerId, stripeSubscriptionId,
 *                    originalCustomerDefaultPaymentMethodId, renewalAt
 *   advance          testClockId, stripeSubscriptionId
 *   restore_and_pay  + originalSubscriptionDefaultPaymentMethodId
 *
 * `originalSubscriptionDefaultPaymentMethodId` is deliberately NOT in this list.
 * Its correct value for this fixture is `null` — the subscription-level override
 * is left unset so the Customer default is the effective method — and a field
 * whose right answer is absence cannot be checked for presence. */
export const HEALTHY_FIXTURE_FIELDS = [
  "testClockId",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "originalCustomerDefaultPaymentMethodId",
] as const;

export function isHealthyFixtureComplete(fixture: unknown): boolean {
  if (!fixture || typeof fixture !== "object") return false;
  const f = fixture as Record<string, unknown>;
  const ids = HEALTHY_FIXTURE_FIELDS.every(
    (k) => typeof f[k] === "string" && (f[k] as string).length > 0,
  );
  const renewal = typeof f.renewalAt === "number" && Number.isFinite(f.renewalAt) && f.renewalAt > 0;
  return ids && renewal;
}

/* ── ADOPTION PREDICATE ──────────────────────────────────────────────────── */

/* The ONLY convergence classifications a fixture may be adopted from. A generic
 * `stripe-error` is not here on purpose: it means an external call failed in a
 * way we did not classify, so what exists in Stripe is unknown. */
export const ADOPTABLE_ERRORS: readonly string[] = ["not-converged"];

/* Whether a stuck `provisioning` fixture may be recovered by re-running
 * `provision` as a READ-ONLY adoption.
 *
 * This is deliberately narrow, and it must not make every provisioning fixture
 * retryable. The first failed disposable fixture — no clock id, generic
 * `stripe-error` — stays permanently unrecoverable, because nothing about it
 * tells us whether anything exists in Stripe. This one is recoverable for a
 * specific reason: the clock id IS known, and from a clock the entire object
 * graph can be re-derived and re-verified without creating anything.
 *
 * Every later stage is excluded. Once a failure method is attached, a renewal
 * invoice exists, the clock has advanced, or cancellation has begun, the world
 * is no longer "provisioning succeeded but we failed to write it down". */
export function isAdoptable(fixture: unknown): boolean {
  if (!fixture || typeof fixture !== "object") return false;
  const f = fixture as Record<string, unknown>;
  if (f.phase !== "provisioning") return false;
  if (typeof f.testClockId !== "string" || !f.testClockId) return false;
  if (!ADOPTABLE_ERRORS.includes(String(f.lastError))) return false;
  /* No part of the failure lifecycle may have started. */
  if (f.attemptCount !== 0) return false;
  for (const later of ["failingPaymentMethodId", "renewalInvoiceId", "advanceTarget", "nextPaymentAttempt"]) {
    if (f[later] !== undefined && f[later] !== null && f[later] !== "") return false;
  }
  return true;
}


/* ── GATES ───────────────────────────────────────────────────────────────── */

export const HARNESS_ENABLED_VAR = "BILLING_TEST_HARNESS_ENABLED";
export const HARNESS_DEPLOYMENT_VAR = "BILLING_TEST_HARNESS_DEPLOYMENT";
export const HARNESS_ENABLED_VALUE = "true";

/* The ACTUAL deployment, read from the URL Convex itself provides.
 *
 * This is the load-bearing half of the deployment gate. `CONVEX_CLOUD_URL` and
 * `CONVEX_SITE_URL` are set by the platform, not by us — see the existing use
 * at convex/auth.ts:18 — so they report where the code is really running.
 * `BILLING_TEST_HARNESS_DEPLOYMENT` is only the EXPECTED value; on its own it
 * proves nothing, since a variable that says "dev" can be set anywhere. The
 * gate compares the two. */
export function deploymentNameFromUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.convex\.(cloud|site)\/?$/i);
  return m ? m[1].toLowerCase() : null;
}

export type GateEnv = {
  enabled: unknown;
  expectedDeployment: unknown;
  actualDeploymentUrl: unknown;
  stripeEnvironment: unknown; // "sandbox" | "production" | null
  authenticated: unknown;
};

/* All four gates, every call. Missing variables mean DISABLED — the default
 * with nothing configured is off, never on. And `enabled` must equal the exact
 * string: "1", "yes" and "TRUE" are all refused, because a flag that accepts
 * anything truthy is a flag that turns itself on by accident. */
export function checkGates(env: GateEnv): { ok: true } | { ok: false; error: ErrorCode } {
  if (!env.authenticated) return { ok: false, error: "not-authenticated" };
  if (env.enabled !== HARNESS_ENABLED_VALUE) return { ok: false, error: "harness-disabled" };
  const expected =
    typeof env.expectedDeployment === "string" ? env.expectedDeployment.toLowerCase() : null;
  const actual = deploymentNameFromUrl(env.actualDeploymentUrl);
  if (!expected || !actual || expected !== actual) {
    return { ok: false, error: "wrong-deployment" };
  }
  if (env.stripeEnvironment !== "sandbox") return { ok: false, error: "not-sandbox" };
  return { ok: true };
}
