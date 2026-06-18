import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";

// Per-user key/value blob store (profile, journey progress, etc.). userId is
// always derived server-side from the authenticated Better Auth user.
async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user._id as string;
}

// All of the signed-in user's blobs as { key: value } so the client can apply
// them to localStorage in one pull.
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("userData")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  },
});

// Upsert one blob (by user + key).
export const set = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("userData")
      .withIndex("by_user_and_key", (q) =>
        q.eq("userId", userId).eq("key", args.key),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("userData", { userId, key: args.key, value: args.value });
    }
    return null;
  },
});
