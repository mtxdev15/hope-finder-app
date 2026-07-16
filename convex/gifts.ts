import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";
import { authComponent } from "./auth";

// $1.25 reaches one person (mirrors PER_PERSON in public/declare/give.js).
const PER_PERSON_CENTS = 125;

// PUBLIC: the running giving total for the live impact counter on /give.
// Unauthenticated (like reviews.listApprovedPublic) — exposes only aggregate
// numbers, never any donor data. Reads the single denormalized "total" row.
export const getTotal = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("giftStats")
      .withIndex("by_key", (q) => q.eq("key", "total"))
      .unique();
    const totalCents = row?.totalCents ?? 0;
    const giftCount = row?.giftCount ?? 0;
    return {
      totalCents,
      giftCount,
      people: Math.round(totalCents / PER_PERSON_CENTS),
    };
  },
});

// INTERNAL: called only by the Stripe webhook httpAction (http.ts). Increments
// the public counter once per Stripe session (idempotent via giftEvents), and
// records per-user history when the giver was signed in. Never exposed publicly.
export const record = internalMutation({
  args: {
    sessionId: v.string(),
    amountCents: v.number(),
    currency: v.string(),
    recurring: v.boolean(),
    frequency: v.optional(v.string()),
    userId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    customerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.amountCents) || args.amountCents <= 0) return null;

    // Idempotency: skip if this Stripe session was already counted.
    const seen = await ctx.db
      .query("giftEvents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (seen) return null;
    await ctx.db.insert("giftEvents", { sessionId: args.sessionId });

    // Increment the public counter (denormalized single row).
    const row = await ctx.db
      .query("giftStats")
      .withIndex("by_key", (q) => q.eq("key", "total"))
      .unique();
    if (row) {
      await ctx.db.patch(row._id, {
        totalCents: row.totalCents + args.amountCents,
        giftCount: row.giftCount + 1,
      });
    } else {
      await ctx.db.insert("giftStats", {
        key: "total",
        totalCents: args.amountCents,
        giftCount: 1,
      });
    }

    // Per-user history (only when the giver was signed in at checkout).
    if (args.userId) {
      await ctx.db.insert("giftHistory", {
        userId: args.userId,
        amountCents: args.amountCents,
        currency: args.currency,
        recurring: args.recurring,
        ...(args.frequency ? { frequency: args.frequency } : {}),
        ...(args.subscriptionId ? { subscriptionId: args.subscriptionId } : {}),
        ...(args.customerId ? { customerId: args.customerId } : {}),
        sessionId: args.sessionId,
        giftedAt: Date.now(),
      });
    }
    return null;
  },
});

// INTERNAL: called only by the Worker's /give/portal endpoint (via the
// /give/customer-lookup httpAction, shared-secret guarded — see http.ts) to
// resolve which Stripe customer to open a billing portal session for. Returns
// the most recent recurring gift's customerId/subscriptionId, or null if the
// user has never made a recurring gift.
export const mostRecentRecurring = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("giftHistory")
      .withIndex("by_user_and_recurring", (q) =>
        q.eq("userId", args.userId).eq("recurring", true),
      )
      .order("desc")
      .first();
    if (!row) return null;
    return {
      customerId: row.customerId ?? null,
      subscriptionId: row.subscriptionId ?? null,
    };
  },
});

// AUTHED: the signed-in user's own giving history, newest first. Scoped to the
// caller; never takes a userId arg (derived server-side).
export const myGifts = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const userId = user._id as string;
    const rows = await ctx.db
      .query("giftHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    return rows.map((r) => ({
      amountCents: r.amountCents,
      currency: r.currency,
      recurring: r.recurring,
      giftedAt: r.giftedAt,
      ...(r.frequency ? { frequency: r.frequency } : {}),
      ...(r.subscriptionId ? { subscriptionId: r.subscriptionId } : {}),
    }));
  },
});

// INTERNAL admin/test helper: wipe the counter + dedupe rows back to zero.
// Run with `npx convex run gifts:clearStats --prod`.
export const clearStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const r of await ctx.db.query("giftStats").take(100)) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("giftEvents").take(2000)) await ctx.db.delete(r._id);
    return null;
  },
});
