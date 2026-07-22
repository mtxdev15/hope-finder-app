import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";

// Derive the signed-in user server-side (never trust a client-supplied id) —
// same helper vault.ts uses.
async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user._id as string;
}

// Fire-and-forget from today.astro right after a successful "Receive the
// Word" response. The client wraps this call in the same fail-soft
// convex-data.js pattern every other mutation uses (guests/unconfigured
// environments simply never call it, since `ensure()`/`authed()` return
// null first) — this mutation itself still requires auth so a client bug
// can never silently attribute history to the wrong user.
export const log = mutation({
  args: { struggle: v.string(), askedAt: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await ctx.db.insert("struggleHistory", {
      userId,
      struggle: args.struggle,
      askedAt: args.askedAt,
    });
    return null;
  },
});

// Bounded read for the insight generator (and any future UI) — newest first,
// capped well above the "enough real signal" threshold Root-Pattern Insight
// needs, per the schema guidelines' "always bound a collection" rule.
export const recent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("struggleHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    return rows.map((r) => ({ struggle: r.struggle, askedAt: r.askedAt }));
  },
});

// Just the count + distinct-category count, cheap enough to check on every
// profile visit to decide whether to even attempt an insight (the "enough
// real signal" threshold lives in the insight generator, not here).
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("struggleHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    const distinct = new Set(rows.map((r) => r.struggle));
    return { total: rows.length, distinctStruggles: distinct.size };
  },
});

// Privacy control: "Clear my history" in You/profile settings. Deletes in
// bounded batches and reschedules itself if a single user somehow has more
// than one batch's worth (per the query guidelines — mutations must stay
// within a single transaction's read/write limits).
const CLEAR_BATCH = 200;

export const clearMine = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("struggleHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(CLEAR_BATCH);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === CLEAR_BATCH) {
      await ctx.scheduler.runAfter(0, internal.struggleHistory.clearMineInternal, { userId });
    }
    return null;
  },
});

// Continuation step for clearMine — takes an explicit userId since a
// scheduled function runs outside the original caller's auth context.
export const clearMineInternal = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("struggleHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(CLEAR_BATCH);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === CLEAR_BATCH) {
      await ctx.scheduler.runAfter(0, internal.struggleHistory.clearMineInternal, { userId: args.userId });
    }
    return null;
  },
});
