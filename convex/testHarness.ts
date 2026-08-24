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
  PROVIDER_ID_FIELDS,
  checkGates,
  idempotencyKey,
  isPhase,
  invoiceOwnershipVerdict,
  ownershipVerdict,
  paymentMethodOwnershipVerdict,
  phaseAfterFailure,
  planAdvance,
  CONVERGENCE_POLL_ATTEMPTS,
  CONVERGENCE_POLL_INTERVAL_MS,
  isAdoptable,
  isHealthyFixtureComplete,
  isNormalizable,
  isAdvanceResumable,
  isRecoveryResumable,
  resolveEffectivePaymentMethod,
  effectiveMethodPolicy,
  assessRecoveryInvoiceState,
  shouldRestoreCustomerDefault,
  assessFailureMethodState,
  isCancelResumable,
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

/* Stripe returns a reference as either a bare id or an expanded object. Local
 * on purpose: convex/http.ts has an identical helper, but that file is a
 * protected production path and the harness must not reach into it. */
function asId(x: unknown): string | null {
  if (typeof x === "string" && x) return x;
  if (x && typeof x === "object" && typeof (x as any).id === "string") return (x as any).id;
  return null;
}

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
    /* Explicit clear signal.
     *
     * `lastError: undefined` inside `patch` CANNOT work: Convex function
     * arguments are serialized, `undefined` has no serialized form, and the key
     * simply disappears before this mutation ever sees it. The old value then
     * survives, which is exactly how a healthy fixture ended up reporting
     * `not-converged`. A boolean survives serialization; the removal is
     * performed locally against ctx.db.patch below. */
    clearLastError: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!isPhase(args.phase)) throw new Error("invalid-phase");
    const wantsClear = args.clearLastError === true;
    const setsError =
      !!args.patch && typeof args.patch === "object" &&
      (args.patch as Record<string, unknown>).lastError !== undefined;
    /* Setting and clearing in one call is a caller mistake, not a precedence
       question to resolve silently. */
    if (wantsClear && setsError) throw new Error("last-error-set-and-clear");
    const rows = await ctx.db
      .query("billingTestFixtures")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (rows.length > 1) throw new Error("duplicate-fixture");
    const now = Date.now();
    const patch = (args.patch || {}) as Record<string, unknown>;
    if (rows[0]) {
      const existing = rows[0] as unknown as Record<string, unknown>;
      /* A provider identifier may be written once, or rewritten with the
         identical value during idempotent recovery. It may never be changed to
         a different object and never cleared: either would silently repoint the
         fixture at something other than what was created. */
      for (const k of PROVIDER_ID_FIELDS) {
        if (!(k in patch)) continue;
        const incoming = patch[k];
        const current = existing[k];
        if (typeof current === "string" && current) {
          if (incoming !== current) throw new Error("provider-id-conflict");
        }
        if (typeof current === "string" && current && (incoming === undefined || incoming === "")) {
          throw new Error("provider-id-clear");
        }
      }
      await ctx.db.patch(rows[0]._id, {
        ...patch,
        /* Constructed HERE, never relayed. `undefined` removes the optional
           field, which is what makes safeStatus report `null`. */
        ...(wantsClear ? { lastError: undefined } : {}),
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
  /* `payments` is EXPANDED on purpose. An invoice's own status cannot tell a
     single payment from two; the payment list can, and a resumed recovery has
     to be able to prove it did not add one. */
  const res = await stripeGet(
    "/invoices/" + encodeURIComponent(invoiceId) + "?expand[]=payments",
    secret,
  );
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

  /* Persist BEFORE touching it again. The same rule the clock already followed:
     if the next call fails, the fixture must still know what exists. */
  await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
    userId: user._id,
    phase: "provisioning",
    patch: { stripeCustomerId: customerId },
  });

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

  /* Read the Customer back and confirm the working method is genuinely the
     invoice default before recording it as the value recovery will restore to.
     Recording what we asked for rather than what Stripe stored is how a
     recovery target ends up pointing at something that was never set. */
  const confirmed = await assertClockOwned(secret, "customers", customerId, clockId);
  if (!confirmed.ok) return { ok: false, error: confirmed.error };
  if (confirmed.object?.invoice_settings?.default_payment_method !== workingPm) {
    return { ok: false, error: "not-converged" };
  }
  await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
    userId: user._id,
    phase: "provisioning",
    patch: { originalCustomerDefaultPaymentMethodId: workingPm },
  });

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

  /* Everything downstream needs, persisted BEFORE waiting on the webhook. The
     first real run created all of this and then failed the convergence check,
     leaving a fixture that knew the clock but not what was on it. */
  await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
    userId: user._id,
    phase: "provisioning",
    patch: {
      stripeSubscriptionId: subscriptionId,
      ...(typeof ownedSub.object.default_payment_method === "string"
        ? { originalSubscriptionDefaultPaymentMethodId: ownedSub.object.default_payment_method }
        : {}),
      renewalAt: ownedSub.object?.items?.data?.[0]?.current_period_end,
    },
  });

  /* Convergence is decided by the CANONICAL row, not by Stripe's response: the
     point of the exercise is that a genuine webhook created the mapping.
     BOUNDED polling, reads only — webhook delivery takes seconds, and reading
     once immediately is how a healthy provisioning run reports failure. */
  const converged = await pollCanonicalConvergence(ctx, user._id, subscriptionId);
  if (!converged) return { ok: false, error: "not-converged" };

  return { ok: true, patch: {} };
}

/* Bounded, read-only wait for the webhook-created canonical row.
 *
 * Identity matters as much as health: it is not enough that the account is
 * Plus, it must be Plus BECAUSE of the subscription we just created. A tier
 * check alone would pass on a pre-existing subscription and call a foreign
 * object our fixture. */
/* One bounded poller for every webhook-driven convergence point. Reads only,
 * never recursive, same bounds throughout. Every place that waited on a webhook
 * with a single immediate read has now been bitten by it. */
async function pollUntil(check: () => Promise<boolean>): Promise<boolean> {
  for (let i = 0; i < CONVERGENCE_POLL_ATTEMPTS; i++) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, CONVERGENCE_POLL_INTERVAL_MS));
  }
  return false;
}

async function pollCanonicalConvergence(
  ctx: any,
  userId: string,
  subscriptionId: string,
): Promise<boolean> {
  for (let i = 0; i < CONVERGENCE_POLL_ATTEMPTS; i++) {
    const canonical = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
      userId,
      provider: "stripe" as const,
    });
    const mapping = await ctx.runQuery(internal.subscriptions.getCustomerInternal, { userId });
    if (
      canonical &&
      canonical.stripeSubscriptionId === subscriptionId &&
      canonical.tier === "plus" &&
      canonical.planKey === "plus_annual" &&
      canonical.status === "active" &&
      canonical.billingInterval === "year" &&
      canonical.cancelAtPeriodEnd === false &&
      mapping?.stripeCustomerId
    ) {
      return true;
    }
    await new Promise((r) => setTimeout(r, CONVERGENCE_POLL_INTERVAL_MS));
  }
  return false;
}

/* Recover a fixture whose Stripe objects exist but whose record does not.
 *
 * WHY THIS IS SAFE TO OFFER AT ALL
 * The first real provisioning run created a clock, a customer, a paid annual
 * subscription and a correct canonical row, then reported `not-converged`
 * because it read the canonical row once, immediately, before the webhook could
 * land. Everything was right except our bookkeeping. Without a way back, the
 * only remedy was to abandon an account and leave live objects orphaned.
 *
 * THE RULE THAT MAKES IT SAFE
 * This path issues NO Stripe write. Not a create, update, attach, pay, cancel,
 * advance, detach or delete. It re-derives the object graph from the one thing
 * the fixture does know — the clock id — verifies every edge of it, and then
 * writes only to our own fixture row. A double-click costs a second round of
 * reads and nothing else.
 *
 * It also refuses to guess. Any ambiguity — no customer, two customers, a
 * subscription on a different clock, metadata naming a different user — is a
 * rejection, never a best-effort match. */
async function opAdopt(
  ctx: any,
  secret: string,
  user: AuthedUser,
  fx: any,
): Promise<OpResult> {
  const clockId: string = fx.testClockId;

  /* A — the clock itself must still exist and be a sandbox clock. */
  const clock = await stripeGet(
    "/test_helpers/test_clocks/" + encodeURIComponent(clockId),
    secret,
  );
  if (!clock.ok || clock.data?.id !== clockId) return { ok: false, error: "clock-not-owned" };
  if (clock.data?.livemode !== false) return { ok: false, error: "not-sandbox" };
  if (clock.data?.status === "internal_failure") return { ok: false, error: "stripe-error" };

  /* B — the customer, found THROUGH the clock. Stripe omits clock-owned
     customers from an unfiltered list, so an unscoped query would find nothing
     and look calm doing it. Exactly one, or refuse. */
  const custPath = fixtureListPath("customers", "test_clock", clockId, { limit: "3" });
  if (!custPath) return { ok: false, error: "stripe-error" };
  const custList = await stripeGet(custPath, secret);
  if (!custList.ok || !Array.isArray(custList.data?.data)) return { ok: false, error: "stripe-error" };
  if (custList.data.data.length !== 1) return { ok: false, error: "clock-not-owned" };
  const customer = custList.data.data[0];
  const customerId: string = customer.id;
  if (fx.stripeCustomerId && fx.stripeCustomerId !== customerId) {
    return { ok: false, error: "clock-not-owned" };
  }
  const custOwned = await assertClockOwned(secret, "customers", customerId, clockId);
  if (!custOwned.ok) return { ok: false, error: custOwned.error };
  /* Email omission is a locked invariant of this fixture, not a preference. */
  if (customer.email) return { ok: false, error: "clock-not-owned" };

  /* C — the working default, which recovery will later restore to. */
  const workingPm = customer?.invoice_settings?.default_payment_method;
  if (typeof workingPm !== "string" || !workingPm) return { ok: false, error: "not-converged" };
  const pmOwned = await assertPaymentMethodOwned(secret, workingPm, customerId);
  if (!pmOwned.ok) return { ok: false, error: pmOwned.error };
  if (fx.originalCustomerDefaultPaymentMethodId &&
      fx.originalCustomerDefaultPaymentMethodId !== workingPm) {
    return { ok: false, error: "clock-not-owned" };
  }

  /* D — the subscription, found THROUGH the verified customer. */
  const subPath = fixtureListPath("subscriptions", "customer", customerId, {
    status: "active", limit: "3",
  });
  if (!subPath) return { ok: false, error: "stripe-error" };
  const subList = await stripeGet(subPath, secret);
  if (!subList.ok || !Array.isArray(subList.data?.data)) return { ok: false, error: "stripe-error" };
  if (subList.data.data.length !== 1) return { ok: false, error: "clock-not-owned" };
  const sub = subList.data.data[0];
  const subscriptionId: string = sub.id;
  if (fx.stripeSubscriptionId && fx.stripeSubscriptionId !== subscriptionId) {
    return { ok: false, error: "clock-not-owned" };
  }
  const subOwned = await assertClockOwned(secret, "subscriptions", subscriptionId, clockId);
  if (!subOwned.ok) return { ok: false, error: subOwned.error };

  const item = sub?.items?.data?.[0];
  const priceId = process.env[PLAN_CATALOG.plus_annual.envVar];
  if (
    sub.status !== "active" ||
    sub.cancel_at_period_end !== false ||
    sub.cancel_at !== null ||
    sub.ended_at !== null ||
    asId(sub.customer) !== customerId ||
    sub?.items?.data?.length !== 1 ||
    item?.quantity !== 1 ||
    item?.price?.id !== priceId ||
    item?.price?.recurring?.interval !== "year"
  ) {
    return { ok: false, error: "clock-not-owned" };
  }

  /* The five provenance fields, and the user binding above all: a subscription
     stamped with somebody else's userId is not this fixture's. */
  const md = (sub.metadata && typeof sub.metadata === "object" ? sub.metadata : {}) as Record<string, string>;
  if (
    md.userId !== user._id ||
    md.plan !== "plus_annual" ||
    md.source !== CHECKOUT_SOURCE ||
    md.billing_schema_version !== BILLING_SCHEMA_VERSION ||
    md.environment !== "sandbox"
  ) {
    return { ok: false, error: "clock-not-owned" };
  }

  /* E — the initial invoice must be paid, with the trusted ROOT association. */
  const invoiceId = asId(sub.latest_invoice);
  if (!invoiceId) return { ok: false, error: "not-converged" };
  const inv = await stripeGet("/invoices/" + encodeURIComponent(invoiceId), secret);
  if (!inv.ok || !inv.data) return { ok: false, error: "stripe-error" };
  if (
    inv.data.livemode !== false ||
    inv.data.status !== "paid" ||
    asId(inv.data.customer) !== customerId ||
    inv.data.parent?.subscription_details?.subscription !== subscriptionId ||
    inv.data.attempt_count > 1
  ) {
    return { ok: false, error: "not-converged" };
  }

  /* F — Convex must already agree, created by a genuine webhook. Adoption
     records what happened; it does not make it true. */
  const canonical = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
    userId: user._id,
    provider: "stripe" as const,
  });
  const mapping = await ctx.runQuery(internal.subscriptions.getCustomerInternal, {
    userId: user._id,
  });
  if (
    !canonical ||
    canonical.stripeSubscriptionId !== subscriptionId ||
    canonical.tier !== "plus" ||
    canonical.planKey !== "plus_annual" ||
    canonical.status !== "active" ||
    canonical.billingInterval !== "year" ||
    canonical.cancelAtPeriodEnd !== false ||
    mapping?.stripeCustomerId !== customerId
  ) {
    return { ok: false, error: "not-converged" };
  }

  /* G — reconstruct exactly what a successful provision would have written. */
  const renewalAt = item?.current_period_end;
  const patch: Record<string, unknown> = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    originalCustomerDefaultPaymentMethodId: workingPm,
    ...(typeof subOwned.object.default_payment_method === "string"
      ? { originalSubscriptionDefaultPaymentMethodId: subOwned.object.default_payment_method }
      : {}),
    renewalAt,
    attemptCount: 0,
  };
  /* Refuse to call it healthy unless it really is complete enough for
     arm_failure to run without rediscovering anything. */
  if (!isHealthyFixtureComplete({ ...fx, ...patch })) {
    return { ok: false, error: "not-converged" };
  }
  return { ok: true, patch };
}

/* Clear a stranded adoption label on an already-healthy fixture.
 *
 * This does not repair anything and does not move the phase. It re-proves that
 * the fixture is exactly what it claims to be, then clears a label that a
 * serialization bug left behind. If any part of the graph no longer checks out,
 * it refuses — a stale label is a smaller problem than a fixture we have
 * stopped being able to verify.
 *
 * Read-only externally. No create, update, attach, pay, cancel, advance, detach
 * or delete. The only write is to our own fixture row. */
async function opNormalize(
  ctx: any,
  secret: string,
  user: AuthedUser,
  fx: any,
): Promise<OpResult> {
  const clockId: string = fx.testClockId;

  const clock = await stripeGet(
    "/test_helpers/test_clocks/" + encodeURIComponent(clockId),
    secret,
  );
  if (!clock.ok || clock.data?.id !== clockId) return { ok: false, error: "clock-not-owned" };
  if (clock.data?.livemode !== false) return { ok: false, error: "not-sandbox" };

  const cust = await assertClockOwned(secret, "customers", fx.stripeCustomerId, clockId);
  if (!cust.ok) return { ok: false, error: cust.error };
  if (cust.object.email) return { ok: false, error: "clock-not-owned" };
  /* The stored working default must still be the EFFECTIVE default, not merely
     attached — that is the value recovery will restore to. */
  if (cust.object?.invoice_settings?.default_payment_method !==
      fx.originalCustomerDefaultPaymentMethodId) {
    return { ok: false, error: "not-converged" };
  }
  const pm = await assertPaymentMethodOwned(
    secret, fx.originalCustomerDefaultPaymentMethodId, fx.stripeCustomerId,
  );
  if (!pm.ok) return { ok: false, error: pm.error };

  const sub = await assertClockOwned(
    secret, "subscriptions", fx.stripeSubscriptionId, clockId,
  );
  if (!sub.ok) return { ok: false, error: sub.error };
  const o = sub.object;
  const item = o?.items?.data?.[0];
  const priceId = process.env[PLAN_CATALOG.plus_annual.envVar];
  if (
    o.status !== "active" ||
    o.cancel_at_period_end !== false ||
    o.cancel_at !== null ||
    o.ended_at !== null ||
    asId(o.customer) !== fx.stripeCustomerId ||
    o?.items?.data?.length !== 1 ||
    item?.quantity !== 1 ||
    item?.price?.id !== priceId ||
    item?.price?.recurring?.interval !== "year" ||
    item?.current_period_end !== fx.renewalAt
  ) {
    return { ok: false, error: "clock-not-owned" };
  }
  const md = (o.metadata && typeof o.metadata === "object" ? o.metadata : {}) as Record<string, string>;
  if (
    md.userId !== user._id ||
    md.plan !== "plus_annual" ||
    md.source !== CHECKOUT_SOURCE ||
    md.billing_schema_version !== BILLING_SCHEMA_VERSION ||
    md.environment !== "sandbox"
  ) {
    return { ok: false, error: "clock-not-owned" };
  }

  const canonical = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
    userId: user._id,
    provider: "stripe" as const,
  });
  const mapping = await ctx.runQuery(internal.subscriptions.getCustomerInternal, {
    userId: user._id,
  });
  if (
    !canonical ||
    canonical.stripeSubscriptionId !== fx.stripeSubscriptionId ||
    canonical.tier !== "plus" ||
    canonical.planKey !== "plus_annual" ||
    canonical.status !== "active" ||
    canonical.billingInterval !== "year" ||
    canonical.cancelAtPeriodEnd !== false ||
    mapping?.stripeCustomerId !== fx.stripeCustomerId
  ) {
    return { ok: false, error: "not-converged" };
  }

  /* Nothing to write but the cleared label — the success path supplies
     clearLastError, and no provider field is touched. */
  return { ok: true, patch: {} };
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

  /* THE BASE IS THE STORED BOUNDARY, and this is load-bearing.
   *
   * Once the clock crosses the renewal, Stripe rolls the subscription forward
   * and `current_period_end` becomes the NEXT year. Re-reading it on a resumed
   * advance would compute a target roughly a year ahead — and with this
   * account's final action set to cancel, that destroys the fixture rather
   * than failing one payment.
   *
   * `fx.renewalAt` is the boundary captured at provisioning and verified
   * against Stripe then. It is the only stable base for this test. The live
   * value is still read below, but only to tell whether the period has already
   * rolled — never to aim at. */
  const livePeriodEnd = sub.object?.items?.data?.[0]?.current_period_end;
  const renewalAt = typeof fx.renewalAt === "number" ? fx.renewalAt : livePeriodEnd;
  /* Target the ceiling, not the boundary: Stripe holds the cycle invoice in
     draft for an hour before finalizing and attempting payment. */
  const plan = planAdvance(renewalAt);
  /* No extra guard is needed here beyond the ceiling: planAdvance refuses any
     target above `renewalAt + ADVANCE_MARGIN_SECONDS`, and the resume predicate
     refuses once a payment attempt exists. Between them, the clock can never be
     pushed past one finalization window from the original boundary. */
  /* The ceiling is enforced HERE, before the request. A ceiling checked after
     the call would be a log line, not a guard — and with the sandbox's final
     action set to CANCEL, an over-advance destroys the fixture outright. */
  if (!plan.ok) return { ok: false, error: plan.error };

  await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
    userId: fx.userId,
    phase: "renewal_advancing",
    /* Do NOT overwrite the stored boundary with the rolled-forward value. */
    patch: { advanceTarget: plan.target },
  });

  /* PRE-FLIGHT, before any advance. Two questions the stored label cannot
     answer: has a payment already been attempted, and has the clock already
     reached the target? Both are read from Stripe, and both can veto. */
  const preInvPath = fixtureListPath("invoices", "subscription", fx.stripeSubscriptionId, { limit: "5" });
  if (!preInvPath) return { ok: false, error: "stripe-error" };
  const preInv = await stripeGet(preInvPath, secret);
  if (!preInv.ok || !Array.isArray(preInv.data?.data)) return { ok: false, error: "stripe-error" };
  const priorCycle = preInv.data.data.filter(
    (i: any) => i.billing_reason === "subscription_cycle" &&
      i.parent?.subscription_details?.subscription === fx.stripeSubscriptionId,
  );
  /* An attempt already happened. This is a result to read, not an advance to
     repeat — repeating it is how one failed attempt becomes two. */
  if (priorCycle.some((i: any) => (i.attempt_count || 0) >= 1)) {
    return { ok: false, error: "unexpected-attempt-count" };
  }

  const clockNow = await stripeGet(
    "/test_helpers/test_clocks/" + encodeURIComponent(fx.testClockId), secret,
  );
  if (!clockNow.ok || clockNow.data?.id !== fx.testClockId) return { ok: false, error: "clock-not-owned" };
  if (clockNow.data?.livemode !== false) return { ok: false, error: "not-sandbox" };
  const frozenNow = clockNow.data?.frozen_time;

  /* Already at or past the target: the advance has happened. Skip it entirely
     and go observe. This is what makes a resume safe no matter what label the
     previous attempt happened to leave behind. */
  const alreadyThere = typeof frozenNow === "number" && frozenNow >= plan.target;

  const advance = alreadyThere ? { ok: true, status: 200, data: null } : await stripePost(
    "/test_helpers/test_clocks/" + encodeURIComponent(fx.testClockId) + "/advance",
    secret,
    { frozen_time: String(plan.target) },
    /* Scoped to the target: a resumed advance aims at a later frozen_time, and
       reusing the first attempt's key made Stripe refuse the call outright. */
    idempotencyKey(token, "advance", String(plan.target)),
  );
  /* Distinct from stripe-error on purpose: a refused advance REQUEST means the
     clock did not move, which is provably safe to resume from. */
  if (!advance.ok) return { ok: false, error: "advance-rejected" };

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

  /* The renewal invoice must be FINALIZED and failed. A `draft` means the
     one-hour finalization window has not elapsed in clock time — the advance
     did not go far enough, and that is a stop, not a reason to advance again
     on the spot. */
  const cycle = invoices.data.data.filter(
    (i: any) =>
      i.billing_reason === "subscription_cycle" &&
      i.parent?.subscription_details?.subscription === fx.stripeSubscriptionId,
  );
  const open = cycle.find((i: any) => i.status === "open");
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

  /* Restore the working Customer default — but only when it is not already
     there. A resumed run that rewrites a value which is already correct is a
     needless mutation, and on a path whose whole job is to be safe to repeat,
     every avoidable write is one more call that can fail. */
  const wantsRestore = shouldRestoreCustomerDefault({
    currentCustomerDefault: cust.object?.invoice_settings?.default_payment_method,
    originalCustomerDefault: fx.originalCustomerDefaultPaymentMethodId,
  });
  if (wantsRestore) {
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
  }

  /* Re-read only what we changed. If nothing was written, `cust` IS the fresh
     read, and fetching it twice would prove nothing new. */
  const check = wantsRestore
    ? await assertClockOwned(secret, "customers", fx.stripeCustomerId, fx.testClockId)
    : cust;
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

  /* THE INVOICE IS READ BEFORE THE PAYMENT METHOD IS JUDGED, and the order is
     the point: whether money is still owed is what decides how strict the
     method has to be. Verified HERE, immediately before it could be paid — not
     trusted from the fixture. */
  const inv = await assertInvoiceOwned(secret, fx.renewalInvoiceId, fx.stripeSubscriptionId);
  if (!inv.ok) return { ok: false, error: inv.error };

  const invoiceState = assessRecoveryInvoiceState({
    invoiceStatus: inv.object?.status,
    paymentCount: Array.isArray(inv.object?.payments?.data)
      ? inv.object.payments.data.length
      : undefined,
    amountOverpaid: inv.object?.amount_overpaid,
  });
  if (!invoiceState.ok) return { ok: false, error: invoiceState.error };

  /* Which method would ACTUALLY be charged, by Stripe's own precedence — not
     which method we wrote down at provisioning.
     See resolveEffectivePaymentMethod for why that distinction cost a run. */
  const effective = resolveEffectivePaymentMethod({
    subscriptionDefault: subCheck.object?.default_payment_method,
    customerDefault: check.object?.invoice_settings?.default_payment_method,
  });
  const policy = effectiveMethodPolicy({
    mustPay: invoiceState.mustPay,
    effectiveId: effective?.id,
    originalWorkingId: fx.originalCustomerDefaultPaymentMethodId,
    failingId: fx.failingPaymentMethodId,
  });
  if (!policy.ok) return { ok: false, error: policy.error };

  /* An id in a field is not proof the object behind it is ours. Retrieve it and
     let its own attachment decide — the same rule assertClockOwned follows. */
  const effOwned = await assertPaymentMethodOwned(
    secret,
    (effective as { id: string }).id,
    fx.stripeCustomerId,
  );
  if (!effOwned.ok) return { ok: false, error: effOwned.error };

  if (invoiceState.mustPay) {
    /* Exactly once, with a stable key. A repeated call returns Stripe's cached
       result rather than making a second payment. */
    const pay = await stripePost(
      "/invoices/" + encodeURIComponent(fx.renewalInvoiceId) + "/pay",
      secret,
      {},
      idempotencyKey(token, "invoice_pay"),
    );
    if (!pay.ok || pay.data?.status !== "paid") return { ok: false, error: "stripe-error" };
  }

  /* BOUNDED polling, not a single read. Recovery converges through a webhook
     exactly as provisioning does, and reading once immediately is how a
     successful recovery reports failure.

     `paymentNeedsAttention` is not asserted directly because it is not stored:
     it is a pure function of this status, so `active` IS that assertion. */
  const recovered = await pollUntil(async () => {
    const after = await stripeGet(
      "/subscriptions/" + encodeURIComponent(fx.stripeSubscriptionId), secret,
    );
    if (!after.ok || after.data?.status !== "active") return false;
    /* A pending cancellation must not be carried into cleanup: cancel_fixture
       expects to be the thing that ends this subscription, and a scheduled end
       already in flight would make its terminal webhook ambiguous. */
    if (after.data?.cancel_at !== null) return false;
    const canonical = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
      userId: fx.userId, provider: "stripe" as const,
    });
    return (
      !!canonical &&
      canonical.status === "active" &&
      canonical.tier === "plus" &&
      canonical.planKey === "plus_annual" &&
      canonical.billingInterval === "year" &&
      canonical.cancelAtPeriodEnd === false
    );
  });
  if (!recovered) return { ok: false, error: "not-converged" };

  /* Only after recovery is proven, and only the temporary method.

     The key is `pm_detach`, not `pm_restore`. Those were the same value, which
     meant two different requests shared one idempotency key: Stripe refuses a
     key replayed with different parameters, and the result was never checked,
     so the detach failed silently. Found in review of PR #37.

     A method that is ALREADY detached is observed and accepted rather than
     refused — see assessFailureMethodState. Refusing it punished a resumed run
     for having already done the right thing. */
  if (fx.failingPaymentMethodId) {
    const pmRes = await stripeGet(
      "/payment_methods/" + encodeURIComponent(fx.failingPaymentMethodId),
      secret,
    );
    if (!pmRes.ok || !pmRes.data) return { ok: false, error: "stripe-error" };
    const state = assessFailureMethodState({
      pmLivemode: pmRes.data.livemode,
      pmId: pmRes.data.id,
      expectedPmId: fx.failingPaymentMethodId,
      pmCustomer: pmRes.data.customer,
      expectedCustomerId: fx.stripeCustomerId,
    });
    if (!state.ok) return { ok: false, error: state.error };
    if (state.action === "detach") {
      const detached = await stripePost(
        "/payment_methods/" + encodeURIComponent(fx.failingPaymentMethodId) + "/detach",
        secret,
        {},
        idempotencyKey(token, "pm_detach"),
      );
      if (!detached.ok) return { ok: false, error: "stripe-error" };
      /* Inspect the RESULT, not just the status code. A detach that really
         happened reports no customer; anything else means the method is still
         attached and the fixture would be left dirty. */
      if (asId(detached.data?.customer) !== null) {
        return { ok: false, error: "not-converged" };
      }
    }
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

  /* Already terminal in Stripe? Then the cancel happened; do not repeat it. */
  const alreadyCanceled = sub.object?.status === "canceled" || sub.object?.ended_at !== null;
  if (!alreadyCanceled) {
    const cancelled = await stripeDelete(
      "/subscriptions/" + encodeURIComponent(fx.stripeSubscriptionId),
      secret,
      idempotencyKey(token, "cancel"),
    );
    if (!cancelled.ok) return { ok: false, error: "stripe-error" };
  }

  /* The disposable account must actually have lost Plus. Cancelling in Stripe
     without the canonical row following is exactly the state we must not leave
     behind before deleting the clock — so wait for it rather than reading once. */
  const terminal = await pollUntil(async () => {
    const canonical = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
      userId: fx.userId, provider: "stripe" as const,
    });
    return !!canonical && canonical.tier !== "plus";
  });
  if (!terminal) return { ok: false, error: "not-converged" };

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

    const admission = admit(args.command, phase, fx);
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
      if (command === "provision") {
        /* Same command, two paths. A fixture that already satisfies the strict
           adoption predicate is recovered read-only; anything else provisions
           normally. No seventh command, and no way to reach adoption from a
           state that has not earned it. */
        result = isNormalizable(fx)
          ? await opNormalize(ctx, secret, user, fx)
          : isAdoptable(fx)
            ? await opAdopt(ctx, secret, user, fx)
            : await opProvision(ctx, secret, user, token);
      }
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
      /* Re-read before deciding where a failure lands: opProvision persists the
         clock id mid-way, so the fixture we opened with is not necessarily the
         fixture we now have. Deciding from the stale copy would roll back over
         a clock that really exists. */
      const afterFail = await ctx.runQuery(internal.testHarness.getFixtureInternal, {
        userId: user._id,
      });
      await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
        userId: user._id,
        phase: phaseAfterFailure(command, afterFail.row),
        patch: { lastError: safeError(result.error) },
      });
      return { ok: false, error: safeError(result.error) };
    }

    await ctx.runMutation(internal.testHarness.upsertFixtureInternal, {
      userId: user._id,
      phase: admission.to,
      patch: { ...(result.patch || {}) },
      /* Every command's success clears any error it was recovering from. */
      clearLastError: true,
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
