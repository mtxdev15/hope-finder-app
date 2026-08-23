/* Declare & Believe — DEVELOPMENT-ONLY Stripe Test Clock harness.
 *
 * WHAT THIS IS FOR
 * The payment-failure and recovery path is the last unverified piece of sandbox
 * billing. It cannot be exercised with a one-off invoice: the webhook resolver
 * reads only `invoice.parent.subscription_details.subscription`, and
 * `paymentNeedsAttention` is a pure function of the SUBSCRIPTION's status, so a
 * failed side invoice would be ignored twice over. See §6.20 of
 * docs/operations/stage-2-sandbox-billing.md.
 *
 * The only honest instrument is a real subscription-cycle failure. This harness
 * provisions a throwaway subscription on a Stripe Test Clock, drives it through
 * exactly one failed renewal, recovers it, and cleans it up.
 *
 * WHAT IT DELIBERATELY IS NOT
 * It is not a fixture factory, not a data repair tool, and not reusable. There
 * is no reset, no resume, and no override. A fixture that ends up somewhere
 * unexpected is something to look at.
 *
 * THE BOUNDARY THAT MATTERS, STATED PLAINLY
 * Stripe does NOT prevent writes to ordinary sandbox objects. Nothing about a
 * plain sandbox Customer stops an API call from reaching it. The harness
 * enforces this boundary itself: every operation that touches an existing
 * Stripe object retrieves it first and rejects any target whose `test_clock` is
 * null or is not this fixture's clock. Stripe supplies the fact; we do the
 * refusing. Both existing subscribers report `test_clock: null`, so they fail
 * that precondition — but they fail it because of assertClockOwned below, not
 * because Stripe would have stopped us.
 *
 * Design source of truth: docs/implementation/billing-test-harness-brief.md
 * Decisions with no network in them: convex/testHarnessState.ts
 */

import { v } from "convex/values";
import { action, query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { stripeGet, stripePost, stripeDelete } from "./stripeApi";
import { environmentForSecret, PLAN_CATALOG, BILLING_SCHEMA_VERSION, CHECKOUT_SOURCE } from "./plusPlans";
import {
  admit,
  checkGates,
  idempotencyKey,
  isPhase,
  invoiceOwnershipVerdict,
  ownershipVerdict,
  paymentMethodOwnershipVerdict,
  planAdvance,
  isSingleFailedAttempt,
  fixtureListPath,
  safeError,
  safeStatus,
  type Command,
  type ErrorCode,
  type Phase,
  type SafeStatus,
} from "./testHarnessState";

/* Stripe's own published test aliases. Public documented values, not secrets.
 * The first attaches and charges successfully; the second attaches successfully
 * and FAILS when charged, which is the whole point of the exercise. */
const PM_SUCCESS = "pm_card_visa";
const PM_DECLINE_ON_CHARGE = "pm_card_chargeCustomerFail";

type AuthedUser = { _id: string; email?: string };

async function requireUser(ctx: any): Promise<AuthedUser | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  return user ? (user as AuthedUser) : null;
}

/* Hash the application user id once per call. Idempotency keys are built from
 * this digest, never from the raw id — see idempotencyKey() for why. */
async function fixtureTokenFor(userId: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

/* ── Fixture persistence (internal only) ─────────────────────────────────── */

export const getFixtureInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("billingTestFixtures")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    /* Fail closed on duplicates. Two fixtures for one user means something
       created state we did not model, and picking one would be a guess. */
    if (rows.length > 1) return { duplicate: true as const, row: null };
    return { duplicate: false as const, row: rows[0] ?? null };
  },
});

export const upsertFixtureInternal = internalMutation({
  args: {
    userId: v.string(),
    phase: v.string(),
    fixtureToken: v.optional(v.string()),
    patch: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (!isPhase(args.phase)) throw new Error("invalid-phase");
    const rows = await ctx.db
      .query("billingTestFixtures")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (rows.length > 1) throw new Error("duplicate-fixture");
    const now = Date.now();
    const patch = (args.patch || {}) as Record<string, unknown>;
    if (rows[0]) {
      await ctx.db.patch(rows[0]._id, {
        ...patch,
        phase: args.phase,
        updatedAt: now,
        lastOperationAt: now,
      });
      return null;
    }
    await ctx.db.insert("billingTestFixtures", {
      userId: args.userId,
      phase: args.phase,
      environment: "sandbox",
      fixtureToken: args.fixtureToken || "",
      attemptCount: 0,
      ...patch,
      createdAt: now,
      updatedAt: now,
      lastOperationAt: now,
    } as any);
    return null;
  },
});

/* ── The four gates, re-checked on every single call ─────────────────────── */

type Gated =
  | { ok: true; user: AuthedUser; secret: string }
  | { ok: false; error: ErrorCode };

async function gate(ctx: any): Promise<Gated> {
  const user = await requireUser(ctx);
  const secret = process.env.STRIPE_SECRET_KEY || "";
  const verdict = checkGates({
    authenticated: !!user,
    enabled: process.env.BILLING_TEST_HARNESS_ENABLED,
    expectedDeployment: process.env.BILLING_TEST_HARNESS_DEPLOYMENT,
    /* The ACTUAL deployment, from a URL Convex sets itself. This is the
       load-bearing half: the expected-name variable proves nothing on its own,
       because a variable that says "dev" can be set anywhere. */
    actualDeploymentUrl: process.env.CONVEX_CLOUD_URL || process.env.CONVEX_SITE_URL,
    stripeEnvironment: environmentForSecret(secret),
  });
  if (!verdict.ok) return { ok: false, error: verdict.error };
  return { ok: true, user: user as AuthedUser, secret };
}

/* ── assertClockOwned ────────────────────────────────────────────────────── */

/* Retrieve the target from Stripe and refuse it unless it is genuinely this
 * fixture's clock-owned object. Called at the top of EVERY operation that
 * mutates an existing Stripe object — never inlined, never assumed from the
 * fixture record alone, because the fixture record is our own writing and a
 * corrupted one must not be able to authorise a write.
 *
 * Again: Stripe would happily let these calls through. This function is what
 * does not. */
async function assertClockOwned(
  secret: string,
  resource: "customers" | "subscriptions",
  objectId: string,
  fixtureTestClockId: string | undefined,
): Promise<{ ok: true; object: any } | { ok: false; error: ErrorCode }> {
  if (!objectId || !fixtureTestClockId) return { ok: false, error: "clock-not-owned" };
  const res = await stripeGet("/" + resource + "/" + encodeURIComponent(objectId), secret);
  if (!res.ok || !res.data) return { ok: false, error: "stripe-error" };
  const verdict = ownershipVerdict({
    objectTestClock: res.data.test_clock,
    objectLivemode: res.data.livemode,
    fixtureTestClockId,
  });
  if (!verdict.ok) return { ok: false, error: verdict.error };
  /* The id must also be the one this fixture recorded: a clock-owned object
     that is not OUR clock-owned object is still not ours. */
  if (res.data.id !== objectId) return { ok: false, error: "clock-not-owned" };
  return { ok: true, object: res.data };
}

/* An Invoice has no `test_clock` of its own, so it is verified through the
 * subscription that does. Retrieved immediately before the pay call — the
 * fixture says WHICH invoice to fetch, and the fetched object's own
 * relationships decide whether it may be paid. */
async function assertInvoiceOwned(
  secret: string,
  invoiceId: string,
  fixtureSubscriptionId: string | undefined,
): Promise<{ ok: true; object: any } | { ok: false; error: ErrorCode }> {
  if (!invoiceId || !fixtureSubscriptionId) return { ok: false, error: "clock-not-owned" };
  const res = await stripeGet("/invoices/" + encodeURIComponent(invoiceId), secret);
  if (!res.ok || !res.data) return { ok: false, error: "stripe-error" };
  const verdict = invoiceOwnershipVerdict({
    invoiceLivemode: res.data.livemode,
    invoiceId: res.data.id,
    expectedInvoiceId: invoiceId,
    invoiceSubscription: res.data.parent?.subscription_details?.subscription,
    expectedSubscriptionId: fixtureSubscriptionId,
    invoiceStatus: res.data.status,
  });
  if (!verdict.ok) return { ok: false, error: verdict.error };
  return { ok: true, object: res.data };
}

/* Same shape for the temporary failing method: verified against the Customer
 * that is itself clock-verified, so a wrong stored id cannot detach a payment
 * method belonging to anyone else. */
async function assertPaymentMethodOwned(
  secret: string,
  paymentMethodId: string,
  fixtureCustomerId: string | undefined,
): Promise<{ ok: true; object: any } | { ok: false; error: ErrorCode }> {
  if (!paymentMethodId || !fixtureCustomerId) return { ok: false, error: "clock-not-owned" };
  const res = await stripeGet("/payment_methods/" + encodeURIComponent(paymentMethodId), secret);
  if (!res.ok || !res.data) return { ok: false, error: "stripe-error" };
  const verdict = paymentMethodOwnershipVerdict({
    pmLivemode: res.data.livemode,
    pmId: res.data.id,
    expectedPmId: paymentMethodId,
    pmCustomer: res.data.customer,
    expectedCustomerId: fixtureCustomerId,
  });
  if (!verdict.ok) return { ok: false, error: verdict.error };
  return { ok: true, object: res.data };
}

/* ── Operations ──────────────────────────────────────────────────────────── */

type OpResult = { ok: true; patch?: Record<string, unknown> } | { ok: false; error: ErrorCode };

async function opProvision(
  ctx: any,
  secret: string,
  user: AuthedUser,
  token: string,
): Promise<OpResult> {
  /* A user who already has billing is not a disposable fixture account. Both
     checks, not either: a mapping without a canonical row still means this
     account has been through Checkout. */
  const mapping = await ctx.runQuery(internal.subscriptions.getCustomerInternal, {
    userId: user._id,
  });
  if (mapping?.stripeCustomerId) return { ok: false, error: "already-has-billing" };
  const existing = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
    userId: user._id,
    provider: "stripe" as const,
  });
  if (existing) return { ok: false, error: "already-has-billing" };

  /* FIRST WRITE OF THE ENTIRE TEST, and deliberately the smallest one: an
     empty clock owns nothing, so a permission failure here costs nothing and a
     stray one is trivially deletable. It doubles as the subscription_write
     scope probe — we never probe scope against a real subscriber. */
  const clock = await stripePost(
    "/test_helpers/test_clocks",
    secret,
    { frozen_time: String(Math.floor(Date.now() / 1000)) },
    idempotencyKey(token, "clock"),
  );
  if (!clock.ok || !clock.data?.id) return { ok: false, error: "stripe-error" };
  const clockId = clock.data.id as string;
  /* Persist before the next write. If anything below fails, the clock id is
     recorded and the operator can clean up deliberately. */
  await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
    userId: user._id,
    phase: "provisioning",
    fixtureToken: token,
    patch: { testClockId: clockId },
  });

  /* Customer created DIRECTLY on the clock, and with NO email. Failure emails
     are disabled at the account level, but omitting the address removes the
     question entirely — ownership comes from subscription metadata, and
     nothing in classification, applyWebhook or entitlements reads it. */
  const cust = await stripePost(
    "/customers",
    secret,
    {
      test_clock: clockId,
      "metadata[userId]": user._id,
      "metadata[environment]": "sandbox",
    },
    idempotencyKey(token, "customer"),
  );
  if (!cust.ok || !cust.data?.id) return { ok: false, error: "stripe-error" };
  const customerId = cust.data.id as string;

  const owned = await assertClockOwned(secret, "customers", customerId, clockId);
  if (!owned.ok) return { ok: false, error: owned.error };

  const attach = await stripePost(
    "/payment_methods/" + encodeURIComponent(PM_SUCCESS) + "/attach",
    secret,
    { customer: customerId },
    idempotencyKey(token, "pm_attach_ok"),
  );
  if (!attach.ok || !attach.data?.id) return { ok: false, error: "stripe-error" };
  const workingPm = attach.data.id as string;

  const setDefault = await stripePost(
    "/customers/" + encodeURIComponent(customerId),
    secret,
    { "invoice_settings[default_payment_method]": workingPm },
    idempotencyKey(token, "pm_default_ok"),
  );
  if (!setDefault.ok) return { ok: false, error: "stripe-error" };

  /* The annual Plus Price, read from the same configured mapping production
     uses. Never a browser value — there is no argument that could carry one. */
  const priceId = process.env[PLAN_CATALOG.plus_annual.envVar];
  if (!priceId) return { ok: false, error: "stripe-error" };

  const sub = await stripePost(
    "/subscriptions",
    secret,
    {
      customer: customerId,
      "items[0][price]": priceId,
      "items[0][quantity]": "1",
      collection_method: "charge_automatically",
      "billing_mode[type]": "flexible",
      /* The five provenance fields, identical to what createCheckoutSession
         stamps. This is what lets a genuine webhook bind this subscription to
         the app user through the ordinary trusted path — no Checkout Session
         and no manual Convex insert required. */
      "metadata[userId]": user._id,
      "metadata[plan]": "plus_annual",
      "metadata[source]": CHECKOUT_SOURCE,
      "metadata[billing_schema_version]": BILLING_SCHEMA_VERSION,
      "metadata[environment]": "sandbox",
    },
    idempotencyKey(token, "subscription"),
  );
  if (!sub.ok || !sub.data?.id) return { ok: false, error: "stripe-error" };
  const subscriptionId = sub.data.id as string;

  const ownedSub = await assertClockOwned(secret, "subscriptions", subscriptionId, clockId);
  if (!ownedSub.ok) return { ok: false, error: ownedSub.error };

  /* Convergence is decided by the CANONICAL row, not by Stripe's response: the
     point of the exercise is that a genuine webhook created the mapping. */
  const canonical = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
    userId: user._id,
    provider: "stripe" as const,
  });
  if (!canonical || canonical.tier !== "plus" || canonical.planKey !== "plus_annual") {
    return { ok: false, error: "not-converged" };
  }

  return {
    ok: true,
    patch: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      originalCustomerDefaultPaymentMethodId: workingPm,
      originalSubscriptionDefaultPaymentMethodId:
        typeof ownedSub.object.default_payment_method === "string"
          ? ownedSub.object.default_payment_method
          : undefined,
      renewalAt: ownedSub.object?.items?.data?.[0]?.current_period_end,
    },
  };
}

async function opArmFailure(secret: string, fx: any, token: string): Promise<OpResult> {
  const cust = await assertClockOwned(secret, "customers", fx.stripeCustomerId, fx.testClockId);
  if (!cust.ok) return { ok: false, error: cust.error };
  const sub = await assertClockOwned(
    secret,
    "subscriptions",
    fx.stripeSubscriptionId,
    fx.testClockId,
  );
  if (!sub.ok) return { ok: false, error: sub.error };

  /* The working method must still be attached and still be the default. If it
     is not, the fixture is not in the state recovery assumes, and arming a
     failure on top of that would leave nothing to restore. */
  const current = cust.object?.invoice_settings?.default_payment_method;
  if (!current || current !== fx.originalCustomerDefaultPaymentMethodId) {
    return { ok: false, error: "not-converged" };
  }

  const attach = await stripePost(
    "/payment_methods/" + encodeURIComponent(PM_DECLINE_ON_CHARGE) + "/attach",
    secret,
    { customer: fx.stripeCustomerId },
    idempotencyKey(token, "pm_attach_fail"),
  );
  if (!attach.ok || !attach.data?.id) return { ok: false, error: "stripe-error" };
  const failingPm = attach.data.id as string;

  /* ONLY the Customer default. The subscription-level override stays where it
     is: §6.18 established that it outranks the Customer default, so leaving it
     alone is what makes the failing method the effective one. */
  const setDefault = await stripePost(
    "/customers/" + encodeURIComponent(fx.stripeCustomerId),
    secret,
    { "invoice_settings[default_payment_method]": failingPm },
    idempotencyKey(token, "pm_default_fail"),
  );
  if (!setDefault.ok) return { ok: false, error: "stripe-error" };

  const after = await assertClockOwned(
    secret,
    "subscriptions",
    fx.stripeSubscriptionId,
    fx.testClockId,
  );
  if (!after.ok) return { ok: false, error: after.error };
  const s = after.object;
  const renewalAt = s?.items?.data?.[0]?.current_period_end;
  if (
    s.status !== "active" ||
    s.cancel_at !== null ||
    s.cancel_at_period_end !== false ||
    renewalAt !== fx.renewalAt
  ) {
    return { ok: false, error: "not-converged" };
  }

  return { ok: true, patch: { failingPaymentMethodId: failingPm } };
}

async function opAdvance(ctx: any, secret: string, fx: any, token: string): Promise<OpResult> {
  const sub = await assertClockOwned(
    secret,
    "subscriptions",
    fx.stripeSubscriptionId,
    fx.testClockId,
  );
  if (!sub.ok) return { ok: false, error: sub.error };

  /* Read the boundary from Stripe. Never compute it, never trust the stored
     copy on its own — a stale renewalAt would move the ceiling. */
  const renewalAt = sub.object?.items?.data?.[0]?.current_period_end;
  const plan = planAdvance(renewalAt);
  /* The ceiling is enforced HERE, before the request. A ceiling checked after
     the call would be a log line, not a guard — and with the sandbox's final
     action set to CANCEL, an over-advance destroys the fixture outright. */
  if (!plan.ok) return { ok: false, error: plan.error };

  await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
    userId: fx.userId,
    phase: "renewal_advancing",
    patch: { renewalAt, advanceTarget: plan.target },
  });

  const advance = await stripePost(
    "/test_helpers/test_clocks/" + encodeURIComponent(fx.testClockId) + "/advance",
    secret,
    { frozen_time: String(plan.target) },
    idempotencyKey(token, "advance"),
  );
  if (!advance.ok) return { ok: false, error: "stripe-error" };

  /* Stripe holds the clock in `advancing` until every affected object has
     reached the requested time. Reading before `ready` reads a half-applied
     world. */
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const c = await stripeGet(
      "/test_helpers/test_clocks/" + encodeURIComponent(fx.testClockId),
      secret,
    );
    if (c.ok && c.data?.status === "ready") { ready = true; break; }
    if (c.ok && c.data?.status === "internal_failure") return { ok: false, error: "stripe-error" };
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!ready) return { ok: false, error: "not-converged" };

  /* FILTERED retrieval. A broad `GET /v1/invoices` omits test-clock objects
     entirely and would return calmly having found nothing — the easiest way to
     produce a confidently wrong verification. */
  const path = fixtureListPath("invoices", "subscription", fx.stripeSubscriptionId, {
    limit: "5",
  });
  if (!path) return { ok: false, error: "stripe-error" };
  const invoices = await stripeGet(path, secret);
  if (!invoices.ok || !Array.isArray(invoices.data?.data)) return { ok: false, error: "stripe-error" };

  const open = invoices.data.data.find(
    (i: any) =>
      i.status === "open" &&
      i.parent?.subscription_details?.subscription === fx.stripeSubscriptionId,
  );
  if (!open) return { ok: false, error: "not-converged" };

  /* Exactly one attempt, or stop. More than one means the advance overshot and
     the core safety property of this test was violated — that is a finding, not
     something to recover from automatically. */
  if (!isSingleFailedAttempt(open.attempt_count)) {
    return { ok: false, error: "unexpected-attempt-count" };
  }

  const after = await stripeGet(
    "/subscriptions/" + encodeURIComponent(fx.stripeSubscriptionId),
    secret,
  );
  if (!after.ok || after.data?.status !== "past_due") return { ok: false, error: "not-converged" };

  const canonical = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
    userId: fx.userId,
    provider: "stripe" as const,
  });
  if (!canonical || canonical.status !== "past_due") return { ok: false, error: "not-converged" };

  return {
    ok: true,
    patch: {
      renewalInvoiceId: open.id,
      attemptCount: 1,
      /* Observed, never asserted against a hardcoded time: the first retry is
         Stripe-selected and cannot be predicted. */
      nextPaymentAttempt:
        typeof open.next_payment_attempt === "number" ? open.next_payment_attempt : undefined,
    },
  };
}

async function opRestoreAndPay(ctx: any, secret: string, fx: any, token: string): Promise<OpResult> {
  /* No clock advancement anywhere in recovery. */
  const cust = await assertClockOwned(secret, "customers", fx.stripeCustomerId, fx.testClockId);
  if (!cust.ok) return { ok: false, error: cust.error };

  const restore = await stripePost(
    "/customers/" + encodeURIComponent(fx.stripeCustomerId),
    secret,
    {
      "invoice_settings[default_payment_method]":
        fx.originalCustomerDefaultPaymentMethodId,
    },
    idempotencyKey(token, "pm_restore"),
  );
  if (!restore.ok) return { ok: false, error: "stripe-error" };

  /* Prove precedence resolves to the working method BEFORE attempting payment.
     Paying first and checking after is how a second failed attempt happens. */
  const check = await assertClockOwned(secret, "customers", fx.stripeCustomerId, fx.testClockId);
  if (!check.ok) return { ok: false, error: check.error };
  if (
    check.object?.invoice_settings?.default_payment_method !==
    fx.originalCustomerDefaultPaymentMethodId
  ) {
    return { ok: false, error: "not-converged" };
  }
  const subCheck = await assertClockOwned(
    secret,
    "subscriptions",
    fx.stripeSubscriptionId,
    fx.testClockId,
  );
  if (!subCheck.ok) return { ok: false, error: subCheck.error };
  const subDefault = subCheck.object?.default_payment_method ?? null;
  if (subDefault !== (fx.originalSubscriptionDefaultPaymentMethodId ?? null)) {
    return { ok: false, error: "not-converged" };
  }

  /* The invoice is verified HERE, immediately before it is paid — not trusted
     from the fixture. This is the only money-moving call in the harness, so it
     is the last place that should take a stored id on faith. */
  const inv = await assertInvoiceOwned(secret, fx.renewalInvoiceId, fx.stripeSubscriptionId);
  if (!inv.ok) return { ok: false, error: inv.error };

  /* Exactly once, with a stable key. A repeated call returns Stripe's cached
     result rather than making a second payment. */
  const pay = await stripePost(
    "/invoices/" + encodeURIComponent(fx.renewalInvoiceId) + "/pay",
    secret,
    {},
    idempotencyKey(token, "invoice_pay"),
  );
  if (!pay.ok || pay.data?.status !== "paid") return { ok: false, error: "stripe-error" };

  const after = await stripeGet(
    "/subscriptions/" + encodeURIComponent(fx.stripeSubscriptionId),
    secret,
  );
  if (!after.ok || after.data?.status !== "active") return { ok: false, error: "not-converged" };

  const canonical = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
    userId: fx.userId,
    provider: "stripe" as const,
  });
  if (!canonical || canonical.status !== "active" || canonical.planKey !== "plus_annual") {
    return { ok: false, error: "not-converged" };
  }

  /* Only after recovery is proven, and only the temporary method — verified
     still attached to THIS fixture's Customer before it is detached.

     The key is `pm_detach`, not `pm_restore`. Those were the same value, which
     meant two different requests shared one idempotency key: Stripe refuses a
     key replayed with different parameters, and the result was never checked,
     so the detach failed silently. Found in review of PR #37. */
  if (fx.failingPaymentMethodId) {
    const pm = await assertPaymentMethodOwned(
      secret,
      fx.failingPaymentMethodId,
      fx.stripeCustomerId,
    );
    if (!pm.ok) return { ok: false, error: pm.error };
    const detached = await stripePost(
      "/payment_methods/" + encodeURIComponent(fx.failingPaymentMethodId) + "/detach",
      secret,
      {},
      idempotencyKey(token, "pm_detach"),
    );
    if (!detached.ok) return { ok: false, error: "stripe-error" };
  }

  return { ok: true, patch: { failingPaymentMethodId: undefined } };
}

async function opCancelFixture(ctx: any, secret: string, fx: any, token: string): Promise<OpResult> {
  const sub = await assertClockOwned(
    secret,
    "subscriptions",
    fx.stripeSubscriptionId,
    fx.testClockId,
  );
  if (!sub.ok) return { ok: false, error: sub.error };

  const cancelled = await stripeDelete(
    "/subscriptions/" + encodeURIComponent(fx.stripeSubscriptionId),
    secret,
    idempotencyKey(token, "cancel"),
  );
  if (!cancelled.ok) return { ok: false, error: "stripe-error" };

  const canonical = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
    userId: fx.userId,
    provider: "stripe" as const,
  });
  /* The disposable account must actually have lost Plus. Cancelling in Stripe
     without the canonical row following is exactly the state we must not leave
     behind before deleting the clock. */
  if (!canonical || canonical.tier === "plus") return { ok: false, error: "not-converged" };

  return { ok: true };
}

async function opDeleteClock(secret: string, fx: any, token: string): Promise<OpResult> {
  /* Deleting a clock deletes its Customer and subscriptions outright. Doing it
     before the terminal webhook has been applied would leave Convex pointing at
     objects that no longer exist, with the account still showing Plus. The
     phase gate is what enforces the order; this re-read is the second lock. */
  const clock = await stripeGet(
    "/test_helpers/test_clocks/" + encodeURIComponent(fx.testClockId),
    secret,
  );
  if (!clock.ok || clock.data?.id !== fx.testClockId) return { ok: false, error: "clock-not-owned" };
  if (clock.data?.livemode !== false) return { ok: false, error: "not-sandbox" };

  const deleted = await stripeDelete(
    "/test_helpers/test_clocks/" + encodeURIComponent(fx.testClockId),
    secret,
    idempotencyKey(token, "clock_delete"),
  );
  if (!deleted.ok) return { ok: false, error: "stripe-error" };
  return { ok: true };
}

/* ── Public surface ──────────────────────────────────────────────────────── */

/* The ENTIRE browser payload. There is no field here that could carry a
 * Customer, Subscription, Test Clock, PaymentMethod, Invoice or Price id, an
 * amount, a timestamp, a metadata blob, a Stripe path, a return URL or an
 * email — not because they are filtered, but because the schema has no room
 * for them. Same property that makes createCheckoutSession safe. */
export const runCommand = action({
  args: { command: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: ErrorCode; status?: SafeStatus }> => {
    const g = await gate(ctx);
    if (!g.ok) return { ok: false, error: g.error };
    const { user, secret } = g;

    const fxRead = await ctx.runQuery(internal.testHarness.getFixtureInternal, {
      userId: user._id,
    });
    if (fxRead.duplicate) return { ok: false, error: "duplicate-fixture" };
    const fx: any = fxRead.row;
    const phase: Phase = fx && isPhase(fx.phase) ? fx.phase : "empty";

    const admission = admit(args.command, phase);
    if (!admission.ok) return { ok: false, error: admission.error };
    const command: Command = admission.command;

    if (command !== "provision" && !fx) return { ok: false, error: "no-fixture" };

    const token: string = fx?.fixtureToken || (await fixtureTokenFor(user._id));

    /* Enter the in-flight phase BEFORE the network call. A second click now
       reads an in-flight phase and is refused as `already-running`, which is
       what stops a duplicate clock advance or a duplicate payment. */
    if (command !== "delete_clock") {
      await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
        userId: user._id,
        phase: admission.inFlight,
        fixtureToken: token,
      });
    }

    let result: OpResult;
    try {
      if (command === "provision") result = await opProvision(ctx, secret, user, token);
      else if (command === "arm_failure") result = await opArmFailure(secret, fx, token);
      else if (command === "advance_to_renewal") result = await opAdvance(ctx, secret, fx, token);
      else if (command === "restore_and_pay") result = await opRestoreAndPay(ctx, secret, fx, token);
      else if (command === "cancel_fixture") result = await opCancelFixture(ctx, secret, fx, token);
      else result = await opDeleteClock(secret, fx, token);
    } catch {
      /* An unknown result leaves the fixture in its in-flight phase and stops.
         There is no automatic retry: a retry on an uncertain external result is
         how one advance becomes two. */
      result = { ok: false, error: "stripe-error" };
    }

    if (!result.ok) {
      await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
        userId: user._id,
        phase: admission.inFlight,
        patch: { lastError: safeError(result.error) },
      });
      return { ok: false, error: safeError(result.error) };
    }

    await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
      userId: user._id,
      phase: admission.to,
      patch: { ...(result.patch || {}), lastError: undefined },
    });

    const fresh = await ctx.runQuery(internal.testHarness.getFixtureInternal, {
      userId: user._id,
    });
    return { ok: true, status: safeStatus(fresh.row) };
  },
});

/* Read-only status. No arguments at all, so nothing can be probed through it. */
export const fixtureStatus = query({
  args: {},
  handler: async (ctx): Promise<SafeStatus | null> => {
    const user = await requireUser(ctx);
    if (!user) return null;
    const rows = await ctx.db
      .query("billingTestFixtures")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (rows.length !== 1) return safeStatus(null);
    /* Allowlist projection — assembled field by field, never a redaction of the
       row, so a column added to the table later cannot leak by being missed. */
    return safeStatus(rows[0]);
  },
});
