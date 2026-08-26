import { v } from "convex/values";
import { classifyIncomingSubscription } from "./subscriptionGuard";
import { LIFETIME_SEATS } from "./plusPlans";
import { query, internalQuery, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { internal } from "./_generated/api";
import { dunningSchedule, dunningDelayMs } from "./dunningSchedule";
import {
  graceEndsAtMs,
  isFailingStatus,
  PAST_DUE_GRACE_MS,
} from "./entitlementCatalog";

/* The statuses that mean Stripe is still trying and access is on borrowed time.
 * Deliberately the same pair entitlements.ts grants grace to — if these two ever
 * disagreed, we would either email somebody whose access was never at risk or
 * stay silent while it ran out. */
/* Imported rather than restated. entitlementCatalog owns which statuses are
   failing, because the resolver, the emails and the grace-expiry job must all
   agree on it or a subscriber gets one answer from the product and another from
   their inbox. */

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
    /* True only when this event is proof a payment SUCCEEDED. Never sent
       speculatively: http.ts decides, and it decides from Stripe's own status
       rather than from the event's name. */
    paymentSucceeded: v.optional(v.boolean()),
    latestInvoiceId: v.optional(v.string()),
    appleOriginalTransactionId: v.optional(v.string()),
    appleAppAccountToken: v.optional(v.string()),
    // Only ever the metadata WE set at Checkout, after classification verified
    // its provenance. Never a browser-supplied id.
    metadataUserId: v.optional(v.string()),
    /* The reader's language, already normalised by plusPlans.normalizeLang to
       one we actually ship. Absent means English — see the schema comment. */
    locale: v.optional(v.string()),
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

    /* Has a payment for this subscription EVER succeeded, counting history?
       Read once here because three separate decisions below depend on it: what
       the row stores, whether the failed-payment sequence is scheduled, and how
       long grace runs. Computing it three times is how they drift apart. */
    const everPaid = args.paymentSucceeded === true || existing?.hasEverPaid === true;

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
      /* ONE-WAY ON UPDATE. Once a payment has succeeded it has succeeded, so an
         existing row's `true` is never written back to false: a later failure
         changes the status, not the history. That distinction is the whole
         point — "paid, then the card died" and "never paid at all" arrive at
         the same Stripe status and deserve opposite treatment.

         Spread-omitted when false so a patch cannot clear a stored true. The
         INSERT below writes it explicitly instead, which matters more than it
         looks: see the note there. */
      ...(everPaid ? { hasEverPaid: true } : {}),
      ...(args.latestInvoiceId ? { latestInvoiceId: args.latestInvoiceId } : {}),
      ...(args.appleOriginalTransactionId
        ? { appleOriginalTransactionId: args.appleOriginalTransactionId }
        : {}),
      ...(args.appleAppAccountToken
        ? { appleAppAccountToken: args.appleAppAccountToken }
        : {}),
      /* Spread-omitted when absent, never written as undefined. An event whose
         metadata we could not read must leave a previously-stamped language
         alone rather than quietly resetting somebody to English. */
      ...(args.locale ? { locale: args.locale } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      /* hasEverPaid IS WRITTEN EXPLICITLY HERE, INCLUDING FALSE, and that is
       * load-bearing rather than tidy.
       *
       * The first version of this spread-omitted it when false, exactly like
       * the patch above. That left an unconverted trial with the column ABSENT
       * rather than false — and absent is indistinguishable from "a row written
       * before this column existed", which is a real paying subscriber who must
       * keep their grace window. The resolver therefore handed every trialist
       * the full sixteen days, which is precisely the bug the flag was added to
       * prevent. The suite passed, because it tested graceDaysFor(false) while
       * the code produced undefined.
       *
       * Writing it on insert is what makes absence mean only one thing. */
      await ctx.db.insert("subscriptions", {
        ...fields,
        hasEverPaid: everPaid,
        createdAt: now,
      });
    }

    /* ── Tell them their card failed ──────────────────────────────────────
     *
     * ON THE TRANSITION, not on the event. Stripe sends several events per
     * failure — invoice.payment_failed plus the customer.subscription.updated
     * that actually carries the status — and Smart Retries produce more with
     * every attempt. Scheduling on "the status became failing, having not been
     * before" fires the sequence exactly once per episode, where scheduling on
     * the event would send a fresh set of three emails after every retry.
     *
     * A brand-new row is deliberately NOT a transition: a subscription whose
     * very first event already reads past_due did not lapse, it never started,
     * and the copy ("your Plus pauses on…") would be wrong for it.
     *
     * The sends are scheduled, not sent here. This is a mutation and email is
     * an action; more importantly each stage re-checks the subscription before
     * sending, so a card fixed on day one silently cancels the rest. */
    const wasFailing = existing ? isFailingStatus(existing.status) : false;
    const isFailing = isFailingStatus(fields.status);
    /* AND NOT SOMEBODY WHO NEVER PAID.
     *
     * A trial that never converts lands on `past_due` looking exactly like a
     * subscriber whose card died, but every word of the failed-payment sequence
     * is false for them. "Your payment for Declare Plus didn't go through"
     * describes a payment they never made, and "your Plus stays on until…"
     * names a date that has already passed, because a never-paid subscription
     * gets no grace at all.
     *
     * They are not left in silence: the trial reminder reaches them three days
     * before the charge, which is the moment that can still change something.
     * Four emails afterwards about a lapse that never happened would be noise
     * at best and misleading at worst. */
    if (
      existing &&
      isFailing &&
      !wasFailing &&
      everPaid &&
      fields.planKey !== "plus_lifetime"
    ) {
      for (const stage of dunningSchedule(PAST_DUE_GRACE_MS)) {
        const delay = dunningDelayMs(stage, PAST_DUE_GRACE_MS);
        if (delay === null) continue;
        await ctx.scheduler.runAfter(delay, internal.dunning.sendDunningEmail, {
          userId: fields.userId,
          stage,
        });
      }

      /* AND ONE OBSERVATION, at the moment access actually ends.
       *
       * Grace expires by the CLOCK, not by an event: entitlements.ts simply
       * starts reading the row as free once the window passes. Nothing in
       * Stripe fires, nothing is written, and if the person never opens the app
       * again the single most consequential moment in the billing lifecycle
       * happens in complete silence.
       *
       * Scheduled from graceEndsAt rather than "grace milliseconds from now",
       * because the window runs from the end of the period they last PAID for,
       * and Stripe may take a while to tell us. Those are the same instant only
       * if the webhook was instant. */
      const graceEnds = graceEndsAtMs(
        fields.currentPeriodEnd,
        fields.updatedAt,
        now,
        everPaid,
      );
      await ctx.scheduler.runAfter(
        Math.max(0, graceEnds - now),
        internal.subscriptions.recordGraceExpiryInternal,
        { userId: fields.userId },
      );
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

/* ── The moment somebody actually lost Plus ───────────────────────────────── */

/* Scheduled by applyWebhook when a subscription first turns failing, to fire at
 * the instant its grace window closes.
 *
 * WHY THIS EXISTS AT ALL, AND WHY IT CHANGES NOTHING
 * Grace expiry is the one transition in the whole billing lifecycle with no
 * event behind it. A card fails and Stripe tells us. A subscription cancels and
 * Stripe tells us. But grace ENDING is a comparison against the clock inside
 * entitlements.ts: the row is read as Plus one second and free the next, with
 * no webhook, no write and no log. Monitoring built purely on Stripe events
 * misses it completely, and if the person never opens the app again, nobody
 * ever knows it happened.
 *
 * So this records it. It does NOT decide it. entitlements.ts remains the sole
 * authority on who has Plus, and this job would be redundant to access if it
 * never ran at all. That separation is deliberate: an observer that can also
 * revoke is an observer that can revoke wrongly.
 *
 * The one thing it does write is the `tier` mirror, and that is a correction
 * rather than a decision. `tierForStatus` writes "plus" for a past_due row,
 * which is right while grace holds and wrong the moment it does not. Left
 * alone, the column claims Plus for ever. */
export const recordGraceExpiryInternal = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", "stripe" as const),
      )
      .first();

    /* Gone. Nothing to record and nothing to correct. */
    if (!sub) return { recorded: false, reason: "no-subscription" };

    /* RECOVERED OR ENDED, which is the common case and the happy one. Most
       failing cards are fixed inside the window, and a cancellation writes its
       own event. Either way this row is no longer mid-grace and there is no
       expiry to record. */
    if (!isFailingStatus(sub.status)) {
      return { recorded: false, reason: "recovered-or-ended" };
    }

    /* Fired early. Only really possible if the period end moved forward since
       this was scheduled, which means a payment succeeded, which means the
       branch above should have caught it. Checked anyway rather than trusting
       the timer, because recording an expiry that has not happened would be
       worse than recording none. */
    const now = Date.now();
    const graceEnds = graceEndsAtMs(
      sub.currentPeriodEnd,
      sub.updatedAt,
      now,
      sub.hasEverPaid,
    );
    if (now < graceEnds) return { recorded: false, reason: "still-in-grace" };

    /* Deterministic, so a re-schedule or a retry cannot write two rows for one
       expiry. Not a Stripe id and never confusable with one: no provider event
       exists for this. */
    const eventId = "grace:" + args.userId + ":" + String(graceEnds);
    const seen = await ctx.db
      .query("billingEvents")
      .withIndex("by_provider_event", (q) =>
        q.eq("provider", "stripe" as const).eq("eventId", eventId),
      )
      .first();
    if (seen) return { recorded: false, reason: "already-recorded" };

    await ctx.db.insert("billingEvents", {
      provider: "stripe" as const,
      eventId,
      type: "convex.grace.expired",
      processedAt: now,
      outcome: "grace-expired" as const,
      conflictReason:
        "grace window closed on a " + sub.status + " " + sub.planKey +
        "; access ended by the clock, not by a provider event",
      userId: args.userId,
    });

    /* The mirror, corrected. Not the entitlement: entitlements.ts already reads
       this row as free and did so from the instant the window closed, whether
       or not this job ran. */
    if (sub.tier === "plus") {
      await ctx.db.patch(sub._id, { tier: "free" as const, updatedAt: now });
    }

    /* Alertable, and the only line anywhere that marks this transition. */
    console.log(
      "[billing] grace-expired status=" + sub.status +
        " plan=" + sub.planKey +
        " — Plus ended; no provider event exists for this",
    );
    return { recorded: true };
  },
});
