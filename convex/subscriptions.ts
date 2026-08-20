import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";

/* Plus subscription state — the server-authoritative mirror of Stripe.
 *
 * WRITE PATH: internal mutations only, reachable solely through the
 * shared-secret httpAction in http.ts that our Worker calls after verifying
 * the Stripe signature. There is deliberately no public mutation here: a
 * signed-in browser must never be able to write plan state.
 *
 * READ PATH: `mySubscription` returns only the current user's own row, and
 * only the fields the UI legitimately needs. Stripe customer and subscription
 * ids are NOT returned — the browser has no use for them, and withholding
 * them means a compromised client cannot even name another customer.
 *
 * Phase 3 stores lifecycle. Phase 4 adds the entitlement resolver that decides
 * what `status` actually unlocks (including the past_due grace rule).
 */

// Derive the signed-in user server-side. Same helper shape as vault.ts.
async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user._id as string;
}

// Stripe statuses that represent a subscription worth treating as Plus-ish for
// storage purposes. This is NOT the entitlement decision — Phase 4 owns that.
// `past_due` is included because the paid period has not necessarily lapsed;
// dropping someone the instant a card retry fails would be the wrong pastoral
// default, and the grace window is Phase 4's to enforce.
const PLUS_STATUSES = new Set(["active", "trialing", "past_due"]);

function tierForStatus(status: string): string {
  return PLUS_STATUSES.has(status) ? "plus" : "free";
}

/* ── reads ───────────────────────────────────────────────────────────────── */

// AUTHED: the current user's own subscription, or null. Never another user's.
export const mySubscription = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null; // signed out is a normal state, not an error
    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id as string))
      .first();
    if (!row) return null;
    // Deliberately narrow: no stripeCustomerId, no stripeSubscriptionId.
    return {
      tier: row.tier,
      status: row.status,
      billingInterval: row.billingInterval ?? null,
      currentPeriodEnd: row.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd ?? false,
      updatedAt: row.updatedAt,
    };
  },
});

// INTERNAL: full row for trusted server code (checkout/portal actions).
export const getByUserInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// INTERNAL: the account -> Stripe customer mapping.
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

// INTERNAL: remember which Stripe customer belongs to this account.
// Idempotent, and refuses to silently repoint an account at a different
// customer — that would fragment billing history and is a sign something is
// wrong upstream, so it surfaces rather than self-heals.
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

/* INTERNAL: apply a verified Stripe subscription webhook.
 *
 * Three protections live here, because Stripe guarantees none of them:
 *
 * 1. IDEMPOTENCY — `billingEvents` records every processed event id. A retry
 *    returns ok without touching state. Recorded FIRST so a crash mid-apply
 *    cannot leave an event marked done that never landed... which is why the
 *    insert happens after the state write, not before. See below.
 *
 * 2. ORDERING — Stripe delivers out of order. We compare the event's `created`
 *    timestamp against `lastWebhookCreated` and ignore anything older, so a
 *    late `customer.subscription.updated` cannot resurrect a cancelled plan.
 *
 * 3. IDENTITY — userId is resolved from OUR record (by subscription id, then
 *    by customer id, then the metadata userId the Worker forwarded from the
 *    Checkout session we ourselves created). It is never taken from a browser.
 */
export const applyWebhook = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    eventCreated: v.number(), // Stripe `created`, seconds
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    status: v.string(),
    stripePriceId: v.optional(v.string()),
    billingInterval: v.optional(v.string()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    canceledAt: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    latestInvoiceId: v.optional(v.string()),
    // Only ever the client_reference_id/metadata we set ourselves at Checkout.
    metadataUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Replay: already processed?
    const seen = await ctx.db
      .query("billingEvents")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();
    if (seen) return { ok: true, deduped: true };

    // 2. Resolve the account. Most-authoritative first.
    const bySub = await ctx.db
      .query("subscriptions")
      .withIndex("by_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .first();

    let userId = bySub?.userId ?? null;
    if (!userId) {
      const byCustomer = await ctx.db
        .query("billingCustomers")
        .withIndex("by_customer", (q) =>
          q.eq("stripeCustomerId", args.stripeCustomerId),
        )
        .first();
      userId = byCustomer?.userId ?? null;
    }
    if (!userId && args.metadataUserId) userId = args.metadataUserId;

    if (!userId) {
      // Nothing to attach this to. Record the event so Stripe stops retrying,
      // but do not invent an owner — guessing here is how one account's
      // subscription lands on another's.
      await ctx.db.insert("billingEvents", {
        eventId: args.eventId,
        type: args.eventType,
        processedAt: Date.now(),
      });
      return { ok: true, unmatched: true };
    }

    // Make sure the customer mapping exists for future portal lookups.
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

    const now = Date.now();
    const existing =
      bySub ??
      (await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId as string))
        .first());

    // 3. Ordering: never let an older event overwrite newer state.
    if (existing && typeof existing.lastWebhookCreated === "number") {
      if (args.eventCreated < existing.lastWebhookCreated) {
        await ctx.db.insert("billingEvents", {
          eventId: args.eventId,
          type: args.eventType,
          processedAt: now,
        });
        return { ok: true, stale: true };
      }
    }

    const fields = {
      userId,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      tier: tierForStatus(args.status),
      status: args.status,
      lastWebhookEventId: args.eventId,
      lastWebhookCreated: args.eventCreated,
      updatedAt: now,
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
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("subscriptions", { ...fields, createdAt: now });
    }

    // Recorded last: if anything above throws, Stripe retries and we reprocess
    // rather than marking an event done that never applied.
    await ctx.db.insert("billingEvents", {
      eventId: args.eventId,
      type: args.eventType,
      processedAt: now,
    });
    return { ok: true };
  },
});
