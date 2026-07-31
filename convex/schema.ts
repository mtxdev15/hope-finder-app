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
    type: v.string(), // 'word' | 'verse' | 'declaration' | 'prayer' | 'journeyReflection'
    ts: v.number(), // created; preserved across updates
    struggle: v.optional(v.string()),
    translation: v.optional(v.string()),
    explanation: v.optional(v.string()),
    prayer: v.optional(v.string()),
    text: v.optional(v.string()),
    ref: v.optional(v.string()),
    coll: v.optional(v.string()),
    // Journey reflections (B3.3): a Step 6 write-up for one day of an active
    // Journey. `text` holds the reflection body (same convention as 'verse');
    // updatedTs tracks edits after the first save, since `ts` stays the
    // original created time.
    day: v.optional(v.number()),
    updatedTs: v.optional(v.number()),
    journeyTitle: v.optional(v.string()),
    prompt: v.optional(v.string()),
    route: v.optional(v.string()),
    // Verse-image cards saved from Card Studio: a lightweight background reference
    // (a hotlinked Unsplash photo + its credit, or a solid color). No blob storage.
    bgKind: v.optional(v.string()), // 'photo' | 'solid'
    bgPhotoId: v.optional(v.string()),
    bgSrc: v.optional(v.string()),
    bgBy: v.optional(v.string()),
    bgByLink: v.optional(v.string()),
    bgColor: v.optional(v.string()),
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
    // Stripe Customer id (cus_...), captured at webhook time so the billing
    // portal can open a session without an extra live Stripe lookup.
    customerId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    // For the billing-portal lookup: most recent recurring gift for a user.
    .index("by_user_and_recurring", ["userId", "recurring"]),

  // Idempotency: one row per processed Stripe Checkout session, so webhook
  // retries never double-count.
  giftEvents: defineTable({
    sessionId: v.string(),
  }).index("by_session", ["sessionId"]),

  /* ===== Plus subscriptions (Release C1 Phase 3) ==============================
     Deliberately SEPARATE from the gift tables above. A donation and a Plus
     subscription are different products: a recurring gift's `subscriptionId`
     is NOT a Plus subscription, and a donor is a Free user unless they
     subscribe separately. Nothing here ever reads gift history to grant Plus.

     Trust boundary: rows are written ONLY by internal mutations, reachable
     only through the shared-secret httpAction the Worker calls after it has
     verified the Stripe signature. No signed-in browser can write this table,
     and plan state deliberately does NOT live in `userData` (userdata.set
     accepts arbitrary key/value from any authed browser, so anything stored
     there is forgeable in one console line).

     Stripe remains the source of truth; this table mirrors verified webhook
     state so the app can answer "what is this account entitled to" without a
     live Stripe call on every request. Phase 3 stores lifecycle only — the
     entitlement resolver that reads it arrives in Phase 4. ================== */
  subscriptions: defineTable({
    // Better Auth user _id, derived server-side. Never client-supplied.
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.optional(v.string()),
    // 'plus' | 'free' — a coarse mirror of Stripe lifecycle. Phase 4's resolver
    // owns the real entitlement decision (including the past_due grace rule).
    tier: v.string(),
    billingInterval: v.optional(v.string()), // 'month' | 'year'
    // Raw Stripe status, stored verbatim rather than collapsed, so Phase 4 can
    // distinguish past_due from unpaid from canceled without re-querying.
    status: v.string(),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    canceledAt: v.optional(v.number()),
    // Present only if legacy/manual Stripe state ever produces a trial. No
    // trial is configured or advertised.
    trialEnd: v.optional(v.number()),
    latestInvoiceId: v.optional(v.string()),
    // Ordering guards: Stripe delivers webhooks out of order, so an older event
    // must never overwrite newer state. See subscriptions.applyWebhook.
    lastWebhookEventId: v.optional(v.string()),
    lastWebhookCreated: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_subscription", ["stripeSubscriptionId"])
    .index("by_customer", ["stripeCustomerId"]),

  // The account -> Stripe customer mapping, kept separate from `subscriptions`
  // because it must survive a subscription being deleted: a returning customer
  // has to land on their existing Stripe customer rather than a fresh one, or
  // their billing history fragments across duplicate customers.
  billingCustomers: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_customer", ["stripeCustomerId"]),

  // Webhook idempotency for SUBSCRIPTION events. Deliberately not giftEvents:
  // that table is keyed by Checkout session and belongs to the donation
  // archive, and mixing the two would let one product's replay suppress the
  // other's legitimate event.
  billingEvents: defineTable({
    eventId: v.string(), // Stripe evt_...
    type: v.string(),
    processedAt: v.number(),
  }).index("by_event", ["eventId"]),
});
