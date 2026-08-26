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

  /* The giving tables (giftStats, giftHistory, giftEvents) were removed with the
     donation product. Production giftHistory held ZERO rows — no gift was ever
     linked to a user — and the only donation was the owner's own signed-out
     test. Stripe keeps the payment records; this schema no longer models them.

     DEPLOY ORDER MATTERS: the three production rows must be deleted BEFORE this
     schema change reaches production, or the deploy fails validation against
     documents in tables the schema no longer declares. See
     docs/architecture/release-c1-legacy-giving-retention.md. */

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

    /* ── Provider-neutral core ────────────────────────────────────────────
       Convex owns the canonical entitlement. Stripe and Apple are billing
       providers, and neither is the source of truth. These fields carry the
       same meaning whichever one billed the money, which is what lets
       StoreKit be an addition later rather than a billing rewrite.
       See docs/architecture/cross-platform-subscriptions.md. */

    // Closed domain, so a typo is a deploy-time error rather than a row that
    // silently never matches a provider check.
    provider: v.union(v.literal("stripe"), v.literal("app_store")),
    // Canonical plan. Provider-independent: an Apple product and a Stripe
    // Price both resolve to the same key.
    planKey: v.union(
      v.literal("plus_monthly"),
      v.literal("plus_annual"),
      /* Bought once, in `mode: "payment"`. Its row carries no interval, no
         period and no cancellation — those fields stay absent rather than
         being filled with plausible-looking values, because a lifetime
         purchase genuinely has none of them. */
      v.literal("plus_lifetime"),
    ),
    // A sandbox purchase must never grant production Plus. Derived from the
    // credential in use, never from a request.
    environment: v.union(v.literal("sandbox"), v.literal("production")),
    // Coarse mirror. The resolver in entitlements.ts owns the real decision,
    // including the past_due grace rule.
    tier: v.union(v.literal("free"), v.literal("plus")),
    billingInterval: v.optional(v.union(v.literal("month"), v.literal("year"))),

    /* Provider-native status, stored VERBATIM and deliberately NOT a literal
       union. Stripe and Apple use different vocabularies, and Stripe may add
       states; collapsing or constraining them here would either lose the
       distinction between past_due and unpaid, or reject a lifecycle we have
       not seen yet. The resolver interprets; the mirror records. */
    status: v.string(),

    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    canceledAt: v.optional(v.number()),
    /* When the free trial converts to a charge. Stripe's own trial_end, in
       seconds. Read by the trial reminder so the date in that email is the date
       Stripe will actually bill, rather than three days from whenever the
       webhook happened to arrive. */
    trialEnd: v.optional(v.number()),

    /* Did a payment for this subscription EVER succeed?
       A stored fact, written the first time one does, never inferred from dates.

       It exists because a trial that never converted and a subscriber whose
       card just died arrive at Stripe status `past_due` looking identical, and
       they deserve opposite treatment. Grace protects somebody from losing what
       they paid for; there is nothing to protect for somebody who never paid.

       WRITTEN EXPLICITLY ON INSERT, including false. That is what lets absence
       mean exactly one thing: a row created before this column existed, which
       predates trials and so belongs to somebody who actually paid. Those rows
       keep their grace. Spread-omitting false instead left an unconverted trial
       indistinguishable from a legacy subscriber and made the whole rule
       inert. */
    hasEverPaid: v.optional(v.boolean()),

    /* When this account first started a free trial, if it ever did.
       Set once and never cleared, because the question it answers is "have you
       already had your trial", and cancelling does not un-have it.

       Without it, cancel-and-resubscribe hands out a fresh seven days on the
       same Stripe customer, indefinitely. The subscriptions row survives
       cancellation (applyWebhook patches one row per user and provider rather
       than inserting a new one), so this is the durable place for it. */
    trialStartedAt: v.optional(v.number()),

    /* When we sent this account its welcome, and the reason it is stored on the
       row rather than inferred.
       
       ONE-WAY, like trialStartedAt. A trial that converts to paid crosses into
       Plus twice by any transition test worth writing, and a second "welcome to
       Plus" a week after the first reads as a system talking to itself. Absent
       means never welcomed, which is correct for every row sold before this
       column existed: they subscribed before there was a welcome to send, and
       emailing them now would be stranger than not. */
    welcomedAt: v.optional(v.number()),

    /* ── Provider-specific identifiers ────────────────────────────────────
       Stored, but NEVER returned to a client response. Withholding them means
       a compromised browser cannot even name another customer's billing. */
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    /* The subscription a lifetime purchase on this row replaced.
       
       WRITTEN AT THE SAME MOMENT stripeSubscriptionId is CLEARED, and the pair
       is the point. A lifetime row must carry no live subscription id, or the
       by_subscription index would route that dead subscription's own
       cancellation events straight back onto the lifetime row and overwrite the
       $149 purchase with `planKey: plus_monthly, status: canceled`.

       Kept rather than dropped because those events still arrive, and the guard
       has to tell "the subscription we ourselves cancelled" (expected, quiet)
       apart from "a different subscription showed up" (a real conflict, alert).
       Absent on every row that never upgraded. */
    supersededSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    latestInvoiceId: v.optional(v.string()),
    appleOriginalTransactionId: v.optional(v.string()),
    appleAppAccountToken: v.optional(v.string()),

    /* The language to write to this person in, stamped by their own Checkout
       and carried through Stripe metadata (see plusPlans.stampedLang).

       ABSENT MEANS ENGLISH. Every row sold before this column existed is
       therefore already correct and nothing needs backfilling.

       A plain string rather than a v.union of the languages we ship, and that
       is deliberate: the value originates in a Stripe payload read inside a
       webhook mutation, and a union that rejects an unexpected value would
       throw there — which Stripe answers by retrying the same event forever.
       plusPlans.normalizeLang is the guard instead, and it returns only a
       language we ship or null, so nothing else can reach this column. */
    locale: v.optional(v.string()),

    // Ordering guards: providers deliver out of order, so an older event must
    // never overwrite newer state. See subscriptions.applyWebhook.
    lastProviderEventId: v.optional(v.string()),
    lastProviderEventAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    // One row per provider per user, so a web and an App Store subscription
    // coexist rather than overwriting each other.
    .index("by_user_provider", ["userId", "provider"])
    /* Counting sold lifetime seats. Scoped by environment so a sandbox
       purchase can never consume a production seat, and so the count reads a
       bounded slice rather than scanning every subscription. */
    .index("by_plan_environment", ["planKey", "environment"])
    .index("by_subscription", ["stripeSubscriptionId"])
    .index("by_customer", ["stripeCustomerId"])
    .index("by_apple_original_tx", ["appleOriginalTransactionId"]),

  /* The account -> Stripe customer mapping, kept separate from `subscriptions`
     because it must survive a subscription being deleted: a returning customer
     has to land on their existing Stripe customer rather than a fresh one, or
     their billing history fragments across duplicate customers.

     DELIBERATELY STRIPE-SPECIFIC, and not generalised for Apple. A Stripe
     Customer is a durable billing identity that outlives any one subscription;
     Apple has no equivalent object. Apple's identity lives on the subscription
     row itself as appleOriginalTransactionId / appleAppAccountToken. Inventing
     a shared "provider account" abstraction over two things that are not alike
     would add a layer that neither provider actually has.

     The provider-neutral abstraction is kept where it is real: subscriptions,
     provider event tracking, entitlement resolution, and the client contract. */
  billingCustomers: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_customer", ["stripeCustomerId"]),

  /* DEVELOPMENT-ONLY orchestration state for the Stripe Test Clock harness.
     See docs/implementation/billing-test-harness-brief.md.

     WHY A SEPARATE TABLE AND NOT A FLAG ON `subscriptions`
     The canonical subscription row is what grants Plus. Hanging test
     orchestration off it would put a development concern inside the one record
     the whole entitlement system trusts, and every future reader of that table
     would have to know to ignore some columns. This is scaffolding; it lives in
     its own building.

     This is the ONLY place the harness's provider identifiers exist. None of
     them is returned to a browser — see STATUS_FIELDS in testHarnessState.ts,
     which is an allowlist projection rather than a redaction. */
  billingTestFixtures: defineTable({
    // Ownership: the authenticated disposable QA user. One fixture per user.
    userId: v.string(),
    // Closed union, enforced again at runtime by isPhase().
    phase: v.union(
      v.literal("empty"),
      v.literal("provisioning"),
      v.literal("healthy"),
      v.literal("failure_armed"),
      v.literal("renewal_advancing"),
      v.literal("past_due"),
      v.literal("recovering"),
      v.literal("recovered"),
      v.literal("canceling"),
      v.literal("terminal"),
      v.literal("clock_deleted"),
    ),
    environment: v.string(), // always "sandbox"; refused otherwise
    /* Hash of userId. Idempotency keys are derived from this rather than from
       the raw application id, so no application identifier is sent to Stripe. */
    fixtureToken: v.string(),

    // Server-only provider state.
    testClockId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    renewalInvoiceId: v.optional(v.string()),
    /* Captured at PROVISION time, not at recovery time. Recording the recovery
       target before the thing that breaks it is the entire point; capturing it
       afterwards would record whatever the failure left behind. */
    originalCustomerDefaultPaymentMethodId: v.optional(v.string()),
    originalSubscriptionDefaultPaymentMethodId: v.optional(v.string()),
    failingPaymentMethodId: v.optional(v.string()),

    // Observed data, never asserted against a hardcoded time.
    renewalAt: v.optional(v.number()),
    advanceTarget: v.optional(v.number()),
    nextPaymentAttempt: v.optional(v.number()),
    attemptCount: v.number(),

    /* Allowlisted code only — never Stripe's own error text, which can carry
       request details and object ids. */
    lastError: v.optional(v.string()),
    lastOperationAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /* Somebody tried to start a Journey and the cap said no.
   *
   * WHY A REFUSAL NEEDS A ROW WHEN AN ALLOW DOES NOT
   * An allowed start leaves a journeySlots row that records everything. A
   * REFUSAL leaves nothing at all: doStart returns a reason to the caller and
   * the moment evaporates. So the one event worth knowing about — the cap
   * actually biting a real person — was the only one with no trace.
   *
   * It is the signal behind several different questions. Is the Free cap set
   * anywhere near right? Is anybody bumping into it often enough to be annoyed
   * rather than nudged? And, since grace expiry silently drops a lapsed
   * subscriber from no cap to two, did somebody just walk into a wall they had
   * no idea existed?
   *
   * NO JOURNEY CONTENT, EVER. Not the journeyId, not a struggle, not a word of
   * what they wrote. Who, which tier, what the cap was, how many they had, and
   * when. That is enough to answer every question above and nothing else. */
  journeyLimitBlocks: defineTable({
    userId: v.string(),
    // The tier as INTERPRETED at that moment, not the mirror column.
    tier: v.string(),
    limit: v.number(),
    // How many were already active. Normally equal to `limit`; larger means a
    // grandfathered account, which is a different situation and should not read
    // as the same one.
    active: v.number(),
    at: v.number(),
  }).index("by_user", ["userId"]),

  /* Did the failed-payment email actually arrive?
   *
   * WHY THIS EXISTS
   * Without it, a dunning email that silently fails to deliver is
   * indistinguishable from one that worked — and the difference between "we
   * told them" and "we tried to tell them" is the whole point of sending it.
   * Somebody loses Plus having genuinely never been warned, and nothing in the
   * system knows.
   *
   * IT IS NOT ANALYTICS. Opens and clicks are deliberately not recorded and
   * cannot be: open tracking needs a tracking pixel, and dunning.ts renders
   * none — a suite asserts there is no <img in these emails at all. Watching
   * whether somebody opened a message about their money is surveillance this
   * product has no use for. Only whether it was DELIVERABLE is kept.
   *
   * NO EMAIL ADDRESS IS STORED HERE. The Resend component already holds the
   * message, keyed by this emailId; duplicating the address would put a second
   * copy of somebody's contact details in a table that exists to hold
   * timestamps. userId and emailId are enough to find everything else. */
  dunningSends: defineTable({
    // The Resend component's id for the message. The join key to the message
    // itself, and to every later event about it.
    emailId: v.string(),
    userId: v.string(),
    // Which of the sequence's stages this was. Stored as a string rather than a
    // union for the same reason `status` is: this table records what happened,
    // it does not constrain it.
    stage: v.string(),
    sentAt: v.number(),
    /* The last thing Resend told us. Absent means nothing has come back yet —
       which for a few seconds after a send is the normal state, and hours later
       is itself the signal. */
    lastEvent: v.optional(v.string()),
    lastEventAt: v.optional(v.number()),
  })
    .index("by_email", ["emailId"])
    .index("by_user", ["userId"]),

  /* Webhook idempotency for SUBSCRIPTION events. Deliberately not giftEvents:
     that table is keyed by Checkout session and belongs to the donation
     archive, and mixing the two would let one product's replay suppress the
     other's legitimate event.

     `provider` namespaces the id: Stripe sends evt_… and Apple sends a
     notification UUID. Without it, two providers share one id space and an
     unlucky collision would silently suppress a real event. */
  billingEvents: defineTable({
    provider: v.union(v.literal("stripe"), v.literal("app_store")),
    eventId: v.string(), // Stripe evt_… / Apple notificationUUID
    type: v.string(),
    processedAt: v.number(),

    /* How the event was resolved. OPTIONAL so the rows written before this
       field existed stay valid — they are not migrated or rewritten, and an
       absent outcome reads as the ordinary applied path. Explicit fields
       rather than prose so an alert can query them. */
    outcome: v.optional(
      v.union(
        v.literal("applied"),
        v.literal("stale"),
        v.literal("unmatched"),
        v.literal("duplicate-subscription-conflict"),
        /* A refund we recorded but deliberately did NOT act on.
         *
         * Only a LIFETIME refund revokes anything — it is the sole signal that
         * plan has. For a subscription, access is governed by the subscription's
         * STATUS, and revoking on a refund would be wrong in the common case
         * (a goodwill refund on a subscription that is still running) and
         * redundant in the other (a refund alongside a cancellation, where
         * customer.subscription.deleted has already revoked).
         *
         * So the event is recorded rather than dropped: before this, a refunded
         * monthly or annual charge left no trace in Convex at all. */
        v.literal("refund-recorded"),
        /* The moment somebody actually lost Plus, written by the scheduled job
         * in subscriptions.recordGraceExpiry.
         *
         * Every other outcome on this table is a reaction to something a
         * provider TOLD us. This one has no provider event behind it at all,
         * because grace ends by the clock: entitlements.ts simply starts
         * reading a row as free once the window passes. Before this, the single
         * most consequential moment in the whole billing lifecycle — the one
         * where a paying subscriber stops being one — left no trace anywhere,
         * and any monitoring built on Stripe events missed it entirely. */
        v.literal("grace-expired"),
        /* A lifetime purchase taking over a row that still held a live
           subscription. Written once per upgrade, at the moment the grant
           lands and before the subscription has been cancelled, so an upgrade
           that fails halfway is visible rather than inferred. */
        v.literal("lifetime-superseded-subscription"),
        /* What actually happened to that subscription and its unused money.
           Separate from the row above because it is written by a scheduled
           job that can retry: the grant is final, the settlement is not. */
        v.literal("lifetime-upgrade-settled"),
        v.literal("lifetime-upgrade-needs-human"),
      ),
    ),
    /* Set only on a duplicate-subscription conflict. Enough to identify what
       happened without reopening Stripe: which subscription we kept, which one
       we refused, and whose account it was. No secret, no hosted URL, no
       payment method, no charge id, no email, no profile data — and none of it
       is readable through getMyEntitlements, which never queries this table. */
    conflictReason: v.optional(v.string()),
    canonicalSubscriptionId: v.optional(v.string()),
    incomingSubscriptionId: v.optional(v.string()),
    userId: v.optional(v.string()),
    /* Set only on the lifetime-upgrade outcomes. The amount is in minor units
       and is what we computed as unused, whether or not we managed to send it:
       on `needs-human` it is the number to refund by hand, which is the whole
       reason it is stored rather than logged. No card, no charge id, no email;
       nothing here is readable through getMyEntitlements, which never queries
       this table. */
    upgradeRefundCents: v.optional(v.number()),
    upgradeReason: v.optional(v.string()),
  }).index("by_provider_event", ["provider", "eventId"]),

  /* ===== Entitlements & usage (Release C1 Phase 4) ============================
     Every table here is server-authoritative. None is written by a public
     mutation that takes a user id, and none lives in `userData` — that table's
     `set({key, value})` is a PUBLIC mutation accepting an arbitrary key and
     value, so anything stored there is forgeable by any signed-in browser in
     one console call. Verified: calling it with key "db_journey_lock" fails on
     authentication, not on validation. ======================================= */

  // Trusted per-account settings. Currently only the IANA timezone used to
  // compute the account day. Deliberately NOT in userData for the reason above:
  // a forgeable timezone is a forgeable daily allowance.
  accountSettings: defineTable({
    userId: v.string(),
    timezone: v.optional(v.string()), // IANA, e.g. "America/New_York". UTC when absent.
    timezoneUpdatedAt: v.optional(v.number()),
    // Monotonic guard: the highest account day this user has ever reached.
    // The day key may never move backwards, so hopping to a timezone where it
    // is "yesterday" cannot hand back a spent allowance.
    lastAccountDay: v.optional(v.string()), // YYYY-MM-DD
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // One row per (user, feature, accountDay). `used` counts only SUCCESSFUL
  // responses; `reserved` holds in-flight requests so concurrent calls cannot
  // oversubscribe the allowance between check and finalize.
  usageCounters: defineTable({
    userId: v.string(),
    feature: v.string(), // 'gentleGuidance'
    accountDay: v.string(), // YYYY-MM-DD in the account's timezone
    used: v.number(),
    reserved: v.number(),
    successful: v.number(),
    failed: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_feature_day", ["userId", "feature", "accountDay"])
    .index("by_user", ["userId"]),

  // In-flight reservations. A row exists only between reserve and
  // finalize/release. `expiresAt` lets a crashed process's hold be reclaimed
  // instead of permanently consuming an allowance.
  usageReservations: defineTable({
    userId: v.string(),
    feature: v.string(),
    accountDay: v.string(),
    // Caller-supplied idempotency key, scoped per user. Reserving twice with
    // the same key returns the same reservation rather than taking two slots.
    requestId: v.string(),
    status: v.string(), // 'reserved' | 'finalized' | 'released'
    createdAt: v.number(),
    expiresAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_user_request", ["userId", "requestId"])
    .index("by_user_feature_day", ["userId", "feature", "accountDay"])
    .index("by_status_expiry", ["status", "expiresAt"]),

  /* Server-side cache and single-flight lock for Journey prose translation.
     The row IS the lock: the first caller inserts `pending` and becomes the
     leader, concurrent callers find it and wait instead of making a second
     model call. A `done` row is a cache hit and costs no quota.

     It holds ONLY Journey-authored translated copy. No reflection, no
     user-written prayer, no Vault content, no Scripture — those are rejected
     before anything reaches here, by the Convex action and again by the Worker.

     serverKey is computed SERVER-SIDE from the authenticated account, the
     locale pair, the normalized allowlisted fields and the schema version. The
     browser's own cache key is never trusted as identity, which is why the
     account is inside the key: two accounts with identical content can never
     share a slot or a result. */
  journeyTranslations: defineTable({
    userId: v.string(),
    serverKey: v.string(),
    status: v.string(), // 'pending' | 'done'
    createdAt: v.number(),
    // Present only once status is 'done'. JSON of the allowlisted fields.
    fields: v.optional(v.string()),
    model: v.optional(v.string()),
    translatedAt: v.optional(v.number()),
  })
    .index("by_user_key", ["userId", "serverKey"])
    .index("by_user", ["userId"]),

  /* Server-authoritative record of a user's ACTIVE Journeys.
     Journey progress itself lives in localStorage mirrored to userData, which
     is forgeable, so entitlement must never count it. This table is the only
     thing `canStartJourney` reads. It is written solely by authenticated
     mutations that derive the user from context. */
  journeySlots: defineTable({
    userId: v.string(),
    journeyId: v.string(), // the client's own journey id, scoped per user
    status: v.string(), // 'active' | 'completed' | 'archived'
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    // True for rows backfilled for users who already exceeded the limit before
    // it existed. They keep every Journey; they simply cannot start another
    // until they are back at or under the cap.
    grandfathered: v.optional(v.boolean()),

    /* WHAT THE CAP WAS WHEN THIS SLOT WAS CLAIMED.
       Optional because rows written before this existed are not migrated.

       The limit is computed fresh on every start, so without recording it there
       is no way to answer "what were they allowed when they started this?" a
       week later. That question matters most exactly when somebody's tier has
       changed since — a lapsed subscriber who started five Journeys on Plus and
       now sits under the Free cap of two has not done anything wrong, and the
       row should say so rather than leaving it to be reconstructed.

       `limitAtStart` is absent when the tier had no customer-visible cap. That
       is not the same as zero, and it is not the same as unknown. */
    tierAtStart: v.optional(v.string()),
    limitAtStart: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_journey", ["userId", "journeyId"]),
});
