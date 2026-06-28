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

  // Generic per-user key/value store for small JSON blobs that should follow the
  // account (profile, journey progress, and future device-local state). `value`
  // is the JSON-stringified blob the client keeps in localStorage; one row per
  // (userId, key). Blobs are tiny and bounded, well under the 1MB doc limit.
  userData: defineTable({
    userId: v.string(),
    key: v.string(),
    value: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_key", ["userId", "key"]),

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

  // Rate & Review submissions. One row per submission (a user may submit more
  // than once over time; moderation handles duplicates). userId + firstName are
  // derived server-side from the authenticated user. Every row is written as
  // `pending`; nothing user-written goes public until manually set `approved`.
  reviews: defineTable({
    userId: v.string(),
    firstName: v.string(),
    score_met_you: v.number(),
    score_the_word: v.number(),
    score_coming_back: v.number(),
    testimonial: v.optional(v.string()),
    isPublic: v.boolean(),
    status: v.union(v.literal("pending"), v.literal("approved")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    // For the future testimonial wall: approved + public, newest first.
    .index("by_status_public", ["status", "isPublic", "createdAt"]),

  // Public giving counter — a single denormalized "total" row (Convex has no
  // count operator). Incremented by the Stripe webhook on each completed gift.
  giftStats: defineTable({
    key: v.string(), // always "total"
    totalCents: v.number(),
    giftCount: v.number(),
  }).index("by_key", ["key"]),

  // Per-user giving history (only when the giver was signed in). userId is the
  // Better Auth user _id, attached via Stripe metadata at checkout.
  giftHistory: defineTable({
    userId: v.string(),
    amountCents: v.number(),
    currency: v.string(),
    recurring: v.boolean(),
    frequency: v.optional(v.string()),
    sessionId: v.string(),
    giftedAt: v.number(),
    subscriptionId: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // Idempotency: one row per processed Stripe Checkout session, so webhook
  // retries never double-count.
  giftEvents: defineTable({
    sessionId: v.string(),
  }).index("by_session", ["sessionId"]),
});
