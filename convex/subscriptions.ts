import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";

/* Plus subscription state — the server-authoritative mirror of whichever
 * provider billed the money.
 *
 * PROVIDER-NEUTRAL. Convex owns the canonical entitlement; Stripe and Apple are
 * billing providers and neither is the source of truth. A row records what a
 * provider told us. What that entitles an account to is decided in
 * entitlements.ts and nowhere else.
 * See docs/architecture/cross-platform-subscriptions.md.
 *
 * WRITE PATH: internal mutations only, reachable solely through the
 * shared-secret httpAction in http.ts that our Worker calls after verifying the
 * provider's signature. There is deliberately no public mutation here: a
 * signed-in browser must never be able to write plan state.
 *
 * READ PATH: `mySubscription` returns only the current user's own row, and only
 * the fields the UI legitimately needs. Provider identifiers — Stripe customer
 * and subscription ids, Apple transaction ids — are NOT returned. The browser
 * has no use for them, and withholding them means a compromised client cannot
 * even name another customer.
 */

// Derive the signed-in user server-side. Same helper shape as vault.ts.
async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user._id as string;
}

/* Statuses worth storing as Plus-ish. This is NOT the entitlement decision —
 * entitlements.ts owns that, including the 3-day past_due grace. `past_due` is
 * included because the paid period has not necessarily lapsed; dropping someone
 * the instant a card retry fails would be the wrong pastoral default. */
const PLUS_STATUSES = new Set(["active", "trialing", "past_due"]);

function tierForStatus(status: string): "free" | "plus" {
  return PLUS_STATUSES.has(status) ? "plus" : "free";
}

const providerValidator = v.union(v.literal("stripe"), v.literal("app_store"));
const planKeyValidator = v.union(v.literal("plus_monthly"), v.literal("plus_annual"));
const environmentValidator = v.union(v.literal("sandbox"), v.literal("production"));

/* ── reads ───────────────────────────────────────────────────────────────── */

/* AUTHED: the current user's own subscriptions, never another user's.
 *
 * Returns the row that currently carries the entitlement when more than one
 * provider is present, so the billing UI has something definite to render.
 * `provider` IS returned — it is an enum, not an identifier, and the UI needs
 * it to route a customer to the Stripe Portal or to Apple's subscription
 * management. It reveals nothing that could address another account. */
export const mySubscription = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null; // signed out is a normal state, not an error
    const rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id as string))
      .collect();
    if (rows.length === 0) return null;

    // Prefer a row that is currently Plus; otherwise the most recently updated.
    const plus = rows.filter((r) => r.tier === "plus");
    const pool = plus.length > 0 ? plus : rows;
    const row = pool.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));

    // Deliberately narrow. No stripeCustomerId, no stripeSubscriptionId, no
    // Apple transaction id.
    return {
      provider: row.provider,
      planKey: row.planKey,
      tier: row.tier,
      status: row.status,
      billingInterval: row.billingInterval ?? null,
      currentPeriodEnd: row.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd ?? false,
      updatedAt: row.updatedAt,
      // True when more than one provider independently bills this account, so
      // the UI can warn rather than let someone quietly pay twice.
      duplicateProviders: new Set(rows.filter((r) => r.tier === "plus").map((r) => r.provider)).size > 1,
    };
  },
});

/* INTERNAL: this user's row for one provider. Used by the checkout action to
 * decide whether a new Stripe purchase is allowed. Scoped by provider so an
 * Apple subscription never blocks or satisfies a Stripe code path by accident. */
export const getByUserProviderInternal = internalQuery({
  args: { userId: v.string(), provider: providerValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", args.provider),
      )
      .first();
  },
});

/* INTERNAL: the account -> Stripe customer mapping. Stripe-specific by design;
 * Apple has no equivalent object. */
export const getCustomerInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("billingCustomers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/* ── writes (internal only) ──────────────────────────────────────────────── */

/* INTERNAL: remember which Stripe customer belongs to this account.
 * Idempotent, and refuses to silently repoint an account at a different
 * customer — that would fragment billing history and is a sign something is
 * wrong upstream, so it surfaces rather than self-heals. */
export const linkCustomer = internalMutation({
  args: { userId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("billingCustomers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      if (existing.stripeCustomerId !== args.stripeCustomerId) {
        throw new Error(
          "customer-mapping-conflict: account already mapped to a different Stripe customer",
        );
      }
      return existing.stripeCustomerId;
    }
    await ctx.db.insert("billingCustomers", {
      userId: args.userId,
      stripeCustomerId: args.stripeCustomerId,
      createdAt: Date.now(),
    });
    return args.stripeCustomerId;
  },
});

/* INTERNAL: apply a verified, ALREADY-CLASSIFIED provider event.
 *
 * `planKey` is REQUIRED and is a closed union. That is the structural half of
 * the C2 fix: this mutation cannot represent "a subscription with no plan", so
 * a recurring gift — which has no canonical plan and would fail classification
 * upstream in plusPlans.classifyPlusSubscription — has no shape to be written
 * in. It is not merely rejected by a check; it is unrepresentable.
 *
 * Four protections live here, because no provider guarantees them:
 *
 * 1. IDEMPOTENCY — `billingEvents` records every processed event, keyed by
 *    (provider, eventId). A retry returns ok without touching state.
 *
 * 2. ORDERING — events arrive out of order. We compare the event timestamp
 *    against `lastProviderEventAt` and ignore anything older, so a late update
 *    cannot resurrect a cancelled plan.
 *
 * 3. IDENTITY — userId is resolved from OUR record (by subscription id, then by
 *    customer id, then the metadata userId we ourselves stamped at Checkout and
 *    which classification has already verified). Never from a browser.
 *
 * 4. ENVIRONMENT — carried on the row, so a sandbox purchase cannot grant Plus
 *    in production.
 */
export const applyWebhook = internalMutation({
  args: {
    provider: providerValidator,
    environment: environmentValidator,
    planKey: planKeyValidator,
    eventId: v.string(),
    eventType: v.string(),
    eventCreated: v.number(), // provider timestamp, seconds
    status: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    billingInterval: v.optional(v.union(v.literal("month"), v.literal("year"))),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    canceledAt: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    latestInvoiceId: v.optional(v.string()),
    appleOriginalTransactionId: v.optional(v.string()),
    appleAppAccountToken: v.optional(v.string()),
    // Only ever the metadata WE set at Checkout, after classification verified
    // its provenance. Never a browser-supplied id.
    metadataUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Replay: already processed?
    const seen = await ctx.db
      .query("billingEvents")
      .withIndex("by_provider_event", (q) =>
        q.eq("provider", args.provider).eq("eventId", args.eventId),
      )
      .first();
    if (seen) return { ok: true, deduped: true };

    const recordEvent = async () => {
      await ctx.db.insert("billingEvents", {
        provider: args.provider,
        eventId: args.eventId,
        type: args.eventType,
        processedAt: Date.now(),
      });
    };

    // 2. Resolve the account. Most-authoritative first.
    let bySub = null;
    if (args.stripeSubscriptionId) {
      bySub = await ctx.db
        .query("subscriptions")
        .withIndex("by_subscription", (q) =>
          q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
        )
        .first();
    }
    if (!bySub && args.appleOriginalTransactionId) {
      bySub = await ctx.db
        .query("subscriptions")
        .withIndex("by_apple_original_tx", (q) =>
          q.eq("appleOriginalTransactionId", args.appleOriginalTransactionId),
        )
        .first();
    }

    let userId = bySub?.userId ?? null;
    if (!userId && args.stripeCustomerId) {
      const byCustomer = await ctx.db
        .query("billingCustomers")
        .withIndex("by_customer", (q) =>
          q.eq("stripeCustomerId", args.stripeCustomerId as string),
        )
        .first();
      userId = byCustomer?.userId ?? null;
    }
    if (!userId && args.metadataUserId) userId = args.metadataUserId;

    if (!userId) {
      // Nothing to attach this to. Record the event so the provider stops
      // retrying, but do not invent an owner — guessing here is how one
      // account's subscription lands on another's.
      await recordEvent();
      return { ok: true, unmatched: true };
    }

    // Keep the Stripe customer mapping current for future portal lookups.
    if (args.provider === "stripe" && args.stripeCustomerId) {
      const mapping = await ctx.db
        .query("billingCustomers")
        .withIndex("by_user", (q) => q.eq("userId", userId as string))
        .first();
      if (!mapping) {
        await ctx.db.insert("billingCustomers", {
          userId,
          stripeCustomerId: args.stripeCustomerId,
          createdAt: Date.now(),
        });
      }
    }

    const now = Date.now();
    // Scoped by provider: a Stripe event must never overwrite an Apple row.
    const existing =
      bySub ??
      (await ctx.db
        .query("subscriptions")
        .withIndex("by_user_provider", (q) =>
          q.eq("userId", userId as string).eq("provider", args.provider),
        )
        .first());

    // 3. Ordering: never let an older event overwrite newer state.
    if (existing && typeof existing.lastProviderEventAt === "number") {
      if (args.eventCreated < existing.lastProviderEventAt) {
        await recordEvent();
        return { ok: true, stale: true };
      }
    }

    const fields = {
      userId,
      provider: args.provider,
      environment: args.environment,
      planKey: args.planKey,
      tier: tierForStatus(args.status),
      status: args.status,
      lastProviderEventId: args.eventId,
      lastProviderEventAt: args.eventCreated,
      updatedAt: now,
      ...(args.stripeCustomerId ? { stripeCustomerId: args.stripeCustomerId } : {}),
      ...(args.stripeSubscriptionId
        ? { stripeSubscriptionId: args.stripeSubscriptionId }
        : {}),
      ...(args.stripePriceId ? { stripePriceId: args.stripePriceId } : {}),
      ...(args.billingInterval ? { billingInterval: args.billingInterval } : {}),
      ...(args.currentPeriodStart != null
        ? { currentPeriodStart: args.currentPeriodStart }
        : {}),
      ...(args.currentPeriodEnd != null
        ? { currentPeriodEnd: args.currentPeriodEnd }
        : {}),
      ...(args.cancelAtPeriodEnd != null
        ? { cancelAtPeriodEnd: args.cancelAtPeriodEnd }
        : {}),
      ...(args.canceledAt != null ? { canceledAt: args.canceledAt } : {}),
      ...(args.trialEnd != null ? { trialEnd: args.trialEnd } : {}),
      ...(args.latestInvoiceId ? { latestInvoiceId: args.latestInvoiceId } : {}),
      ...(args.appleOriginalTransactionId
        ? { appleOriginalTransactionId: args.appleOriginalTransactionId }
        : {}),
      ...(args.appleAppAccountToken
        ? { appleAppAccountToken: args.appleAppAccountToken }
        : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("subscriptions", { ...fields, createdAt: now });
    }

    // Recorded last: if anything above throws, the provider retries and we
    // reprocess rather than marking an event done that never applied.
    await recordEvent();
    return { ok: true };
  },
});
