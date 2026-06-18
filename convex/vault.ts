import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";

// Derive the signed-in user server-side (never trust a client-supplied id).
// Uses the same Better Auth helper as getCurrentUser in auth.ts; the user's
// _id is the stable per-user scope key for every row.
async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user._id as string;
}

// Validators for a Vault item's client-supplied fields (everything except the
// server-derived userId). Mirrors the shape in src/app/declare/vault-store.js.
const itemArgs = {
  clientId: v.string(),
  type: v.string(),
  ts: v.number(),
  struggle: v.optional(v.string()),
  translation: v.optional(v.string()),
  explanation: v.optional(v.string()),
  prayer: v.optional(v.string()),
  text: v.optional(v.string()),
  ref: v.optional(v.string()),
  coll: v.optional(v.string()),
  verses: v.optional(v.array(v.object({ ref: v.string(), text: v.string() }))),
  declarations: v.optional(v.array(v.string())),
};

// Shape a stored row back into the client item shape (id = clientId; drop the
// userId + system fields). Spreading the row keeps only fields that are actually
// present, so we never return `undefined` values (not a valid Convex value).
function toClientItem(r: any) {
  const { _id, _creationTime, userId, clientId, ...rest } = r;
  return { id: clientId, ...rest };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    // A personal vault is bounded; take a generous cap, newest first.
    const rows = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000);
    return rows.map(toClientItem);
  },
});

export const save = mutation({
  args: itemArgs,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("vaultItems")
      .withIndex("by_user_and_client", (q) =>
        q.eq("userId", userId).eq("clientId", args.clientId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args });
    } else {
      await ctx.db.insert("vaultItems", { userId, ...args });
    }
    return args.clientId;
  },
});

export const remove = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("vaultItems")
      .withIndex("by_user_and_client", (q) =>
        q.eq("userId", userId).eq("clientId", args.clientId),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

const collKind = v.union(
  v.literal("verse"),
  v.literal("declaration"),
  v.literal("prayer"),
  v.null(),
);

export const listCollections = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("vaultCollections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(500);
    return rows.map((r) => ({ name: r.name, kind: r.kind, ts: r.ts }));
  },
});

export const addCollection = mutation({
  args: { name: v.string(), kind: collKind, ts: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("vaultCollections")
      .withIndex("by_user_and_name", (q) =>
        q.eq("userId", userId).eq("name", args.name),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("vaultCollections", {
        userId,
        name: args.name,
        kind: args.kind,
        ts: args.ts,
      });
    }
    return null;
  },
});

export const removeCollection = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("vaultCollections")
      .withIndex("by_user_and_name", (q) =>
        q.eq("userId", userId).eq("name", args.name),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});
