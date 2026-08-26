import { v } from "convex/values";
import { classifyIncomingSubscription } from "./subscriptionGuard";
import { LIFETIME_SEATS } from "./plusPlans";
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

/* A lifetime row's status is Stripe's payment_status on the one-time Checkout
 * Session, so it shares no vocabulary with the subscription statuses above:
 * `paid` is its only Plus-ish value, and `active` never appears on one. Keeping
 * the two vocabularies apart — rather than adding `paid` to PLUS_STATUSES —
 * means a subscription that somehow arrived with `paid` is still not treated as
 * Plus, and a lifetime row that somehow arrived with `active` is not either. */
const LIFETIME_PLUS_STATUSES = new Set(["paid"]);

function tierForStatus(status: string, planKey: string): "free" | "plus" {
  const set = planKey === "plus_lifetime" ? LIFETIME_PLUS_STATUSES : PLUS_STATUSES;
  return set.has(status) ? "plus" : "free";
}

const providerValidator = v.union(v.literal("stripe"), v.literal("app_store"));
const planKeyValidator = v.union(
  v.literal("plus_monthly"),
  v.literal("plus_annual"),
  v.literal("plus_lifetime"),
);
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

/* INTERNAL: how many lifetime seats are actually sold in this environment.
 *
 * Counts only rows that are still PAID. A refunded lifetime returns its seat —
 * the money went back, so holding the seat would shrink the founding round by
 * someone who is no longer in it.
 *
 * Reads a bounded slice: `by_plan_environment` narrows to lifetime rows in one
 * environment, and there can never be many more of those than the cap, since
 * the cap is what gates creating them. Takes LIFETIME_SEATS + 1 rather than
 * collecting, so an unexpected overshoot cannot turn this into an unbounded
 * read — the caller only needs to know whether the cap is reached, not the
 * true total. */
export const countLifetimeSoldInternal = internalQuery({
  args: { environment: environmentValidator },
  handler: async (ctx, args): Promise<number> => {
    const rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_plan_environment", (q) =>
        q.eq("planKey", "plus_lifetime" as const).eq("environment", args.environment),
      )
      .take(LIFETIME_SEATS + 1);
    return rows.filter((r) => LIFETIME_PLUS_STATUSES.has(r.status)).length;
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
 *
 * 5. ONE CANONICAL STRIPE SUBSCRIPTION — a webhook for a DIFFERENT Stripe
 *    subscription id must never repoint the row holding a live one. The
 *    checkout-time guard in billing.ts cannot cover this: a Session minted
 *    before the first subscription existed stays payable for 24 hours, and
 *    completing it later produces a second real subscription the checkout
 *    guard never saw. See subscriptionGuard.ts.
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

    type EventOutcome = "applied" | "stale" | "unmatched" | "duplicate-subscription-conflict";
    type ConflictDetail = {
      conflictReason: string;
      /* Absent on a lifetime conflict: that row has no subscription to name. */
      canonicalSubscriptionId?: string;
      incomingSubscriptionId?: string;
      userId: string;
    };
    /* Still exactly one row per (provider, eventId) — the replay check above is
       unchanged and remains authoritative. This only records HOW the event
       resolved, so a conflict is visible rather than indistinguishable from an
       ordinary apply. */
    const recordEvent = async (outcome: EventOutcome, detail?: ConflictDetail) => {
      await ctx.db.insert("billingEvents", {
        provider: args.provider,
        eventId: args.eventId,
        type: args.eventType,
        processedAt: Date.now(),
        outcome,
        ...(detail ?? {}),
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
      await recordEvent("unmatched");
      return { ok: true, unmatched: true };
    }

    // Scoped by provider: a Stripe event must never overwrite an Apple row.
    // Resolved BEFORE the customer mapping below, so a conflicting event can
    // return having written nothing but its own event record.
    const existing =
      bySub ??
      (await ctx.db
        .query("subscriptions")
        .withIndex("by_user_provider", (q) =>
          q.eq("userId", userId as string).eq("provider", args.provider),
        )
        .first());

    /* 3. ONE CANONICAL STRIPE SUBSCRIPTION.
     *
     * Runs inside this mutation, which Convex serialises per document, so two
     * different subscription ids arriving together cannot both win: the first
     * transaction to commit becomes canonical and the second reads it here and
     * conflicts. That is why the check lives in the mutation rather than as a
     * read-then-write in the caller, where the two could interleave.
     *
     * Every event type reaches this point — http.ts calls applyWebhook exactly
     * once, for all seven — so invoice.paid arriving before
     * customer.subscription.created is decided the same way as any other. */
    const verdict = classifyIncomingSubscription({
      provider: args.provider,
      existing: existing ?? null,
      incomingSubscriptionId: args.stripeSubscriptionId ?? null,
    });
    if (!verdict.ok) {
      /* Structured and alertable, and deliberately WITHOUT the subscription
       * ids: http.ts already established that provider ids have no business in
       * logs. The ids are on the billingEvents row this writes, keyed by the
       * event id printed here, which is how an operator finds them. */
      console.log(
        "[billing] duplicate-subscription-conflict provider=" + args.provider +
          " event=" + args.eventId +
          " type=" + args.eventType +
          " existingStatus=" + verdict.existingStatus +
          " — canonical subscription left unchanged; detail on the billingEvents row",
      );
      await recordEvent("duplicate-subscription-conflict", {
        conflictReason: verdict.reason,
        ...(verdict.canonicalSubscriptionId
          ? { canonicalSubscriptionId: verdict.canonicalSubscriptionId }
          : {}),
        ...(verdict.incomingSubscriptionId
          ? { incomingSubscriptionId: verdict.incomingSubscriptionId }
          : {}),
        userId,
      });
      /* Acknowledged, not applied. Returning 200 stops Stripe retrying an
       * event we will never apply; the conflict is durable on the event row
       * and in the log rather than in a retry queue. */
      return { ok: true, duplicateSubscription: true };
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

    // 4. Ordering: never let an older event overwrite newer state.
    if (existing && typeof existing.lastProviderEventAt === "number") {
      if (args.eventCreated < existing.lastProviderEventAt) {
        await recordEvent("stale");
        return { ok: true, stale: true };
      }
    }

    const fields = {
      userId,
      provider: args.provider,
      environment: args.environment,
      planKey: args.planKey,
      tier: tierForStatus(args.status, args.planKey),
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
    await recordEvent("applied");
    return { ok: true };
  },
});

/* Record a refund that we deliberately did NOT act on.
 *
 * WHY THIS IS NOT PART OF applyWebhook
 * applyWebhook exists to change the canonical row. This changes nothing — that
 * is the entire point. Folding a no-op path into the mutation whose job is to
 * mutate would mean every future reader of applyWebhook has to hold "…except
 * when it does not apply anything" in their head, which is how the escape
 * hatches that break security checks get added.
 *
 * WHY A REFUND ON A SUBSCRIPTION IS RECORDED AND NOT APPLIED
 * A lifetime purchase has no lifecycle: a refund is the only signal it will
 * ever get, so `charge.refunded` revokes it through applyWebhook as usual. A
 * subscription has a STATUS, and that status already governs access — so
 * revoking on a refund would be actively wrong for a goodwill refund on a
 * subscription that is still running, and redundant next to the
 * customer.subscription.deleted that accompanies a real cancellation.
 *
 * Before this existed, such a refund was acknowledged and dropped, leaving no
 * trace in Convex at all. Now it is visible to whoever goes looking, without
 * touching anybody's access. */
export const recordRefundInternal = internalMutation({
  args: {
    provider: providerValidator,
    eventId: v.string(),
    eventType: v.string(),
    /* Which plan the refunded charge belonged to, for the operator reading
       this row later. Not used to decide anything here. */
    planKey: v.string(),
    /* Only ever the metadata WE stamped at Checkout, after provenance was
       verified upstream. Never a browser-supplied id. */
    metadataUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    /* Same replay rule as applyWebhook, and for the same reason: Stripe retries,
       and one event must produce one row however it resolved. */
    const seen = await ctx.db
      .query("billingEvents")
      .withIndex("by_provider_event", (q) =>
        q.eq("provider", args.provider).eq("eventId", args.eventId),
      )
      .first();
    if (seen) return { ok: true, deduped: true };

    await ctx.db.insert("billingEvents", {
      provider: args.provider,
      eventId: args.eventId,
      type: args.eventType,
      processedAt: Date.now(),
      outcome: "refund-recorded" as const,
      /* conflictReason is the existing free-text column for "why did this
         resolve the way it did". Reused rather than adding a near-duplicate
         field, and written in the same spirit: enough to understand the row
         without reopening Stripe, and no identifier that could address a Stripe
         object. */
      conflictReason: "refund on " + args.planKey + " — entitlement unchanged; subscription status governs access",
      ...(args.metadataUserId ? { userId: args.metadataUserId } : {}),
    });
    return { ok: true, deduped: false };
  },
});
