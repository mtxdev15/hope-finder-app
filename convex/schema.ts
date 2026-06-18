import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// App data schema. Auth tables are owned by the Better Auth component and are
// NOT defined here. These tables hold each signed-in user's Vault so it follows
// their account across devices. Rows are scoped by `userId` (the Better Auth
// user's _id, derived server-side — never passed from the client).
export default defineSchema({
  vaultItems: defineTable({
    userId: v.string(),
    // Deterministic client-generated id (the same id vault-store.js uses), so a
    // save toggles/updates instead of duplicating, and removes can target it.
    clientId: v.string(),
    type: v.string(), // 'word' | 'verse' | 'declaration' | 'prayer'
    ts: v.number(),
    struggle: v.optional(v.string()),
    translation: v.optional(v.string()),
    explanation: v.optional(v.string()),
    prayer: v.optional(v.string()),
    text: v.optional(v.string()),
    ref: v.optional(v.string()),
    coll: v.optional(v.string()),
    // Bounded by the app's response shape (verses <= 3, declarations <= 5).
    verses: v.optional(v.array(v.object({ ref: v.string(), text: v.string() }))),
    declarations: v.optional(v.array(v.string())),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_client", ["userId", "clientId"]),

  vaultCollections: defineTable({
    userId: v.string(),
    name: v.string(),
    // null = a user-curated space; otherwise auto-grouped by truth kind.
    kind: v.union(
      v.literal("verse"),
      v.literal("declaration"),
      v.literal("prayer"),
      v.null(),
    ),
    ts: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_name", ["userId", "name"]),
});
