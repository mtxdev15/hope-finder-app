import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import {
  definitionFor,
  graceEndsAtMs,
  isFailingStatus,
  TIMEZONE_CHANGE_MIN_INTERVAL_MS,
  type Tier,
} from "./entitlementCatalog";
import { dayKeyInZone, clampForward, isValidTimeZone } from "./accountDay";

/* The entitlement resolver — the ONE place that decides what an account may do.
 *
 * Inputs are exclusively trusted: identity from context, subscription state
 * from the webhook-written `subscriptions` table, usage from `usageCounters`,
 * active Journeys from `journeySlots`. It never reads localStorage, `userData`,
 * a browser-submitted plan or user id, a Stripe redirect parameter, or the
 * pricing page's selection.
 *
 * Phase 4 resolves and reports. It does not yet BLOCK anything in the product:
 * Gentle Guidance does not exist and the Journey limit sheet is a later phase.
 */

async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("not-authenticated");
  return user._id as string;
}

export type Resolved = {
  tier: Tier;
  subscriptionStatus: string; // 'none' | raw provider status
  paymentNeedsAttention: boolean;
  graceEndsAt: number | null;
  /* Which provider currently carries the entitlement, and on what plan. Both
   * null for a free account. `provider` is an enum, not an identifier — the
   * billing UI needs it to route to the Stripe Portal or Apple's subscription
   * management, and it cannot be used to address another account. */
  provider: "stripe" | "app_store" | null;
  planKey: "plus_monthly" | "plus_annual" | null;
  /* More than one provider is independently billing this account. Someone is
   * paying twice. Computed here, never trusted from a client. */
  duplicateProviders: boolean;
  /* ── Lifecycle facts the account UI needs (C-visibility) ──────────────────
   * Added so the app can answer "which plan, is it active, monthly or annual,
   * when does it renew or end" WITHOUT sending anyone to Stripe. Every one is
   * provider-neutral: a millisecond timestamp, a boolean, and an interval enum.
   * None is a Stripe identifier, and none can address another account.
   *
   * periodEndAt is milliseconds (the row stores Stripe seconds) so the browser
   * can format it with the existing locale without a second conversion. It is
   * null when we have no period, which the UI must render as "no date" rather
   * than inventing one.
   *
   * cancelAtPeriodEnd is the difference between "Renews" and "Cancels" on
   * screen. It was already read by `interpret` internally; it simply was never
   * returned, which is exactly the gap the Portal smoke test exposed. */
  periodEndAt: number | null;
  cancelAtPeriodEnd: boolean;
  billingInterval: "month" | "year" | null;
  accountDay: string;
  timezone: string;
  limits: ReturnType<typeof definitionFor>["limits"];
  usage: { gentleGuidanceToday: number; activeJourneys: number };
  remaining: { gentleGuidanceToday: number | null; activeJourneySlots: number | null };
};

/* Interpret a Stripe subscription row into a tier.
 *
 * Every branch is deliberate; see the table in the implementation doc.
 *   active                  -> plus
 *   trialing                -> plus, only if a real Stripe trial exists. No
 *                              trial is advertised or configured; this exists
 *                              so legacy or manually-created state is honoured
 *                              rather than silently downgraded.
 *   cancel_at_period_end    -> plus THROUGH currentPeriodEnd. They paid for the
 *                              period; taking it early would be theft.
 *   past_due / unpaid       -> plus during the configurable grace window, then
 *                              free. paymentNeedsAttention is exposed so the UI
 *                              can ask them to fix billing without a hard stop.
 *   canceled / anything else-> free
 *
 * Content is NEVER deleted by any of these transitions. Losing Plus caps what
 * you can do next; it never removes what you already have. */
export function interpret(
  sub: any,
  now: number,
): { tier: Tier; status: string; needsAttention: boolean; graceEndsAt: number | null } {
  if (!sub) return { tier: "free", status: "none", needsAttention: false, graceEndsAt: null };

  const status = String(sub.status || "");

  /* A lifetime purchase has no lifecycle to interpret: no renewal to fail, no
   * period to end, nothing to cancel. So none of the branches below apply, and
   * reaching them would be actively wrong — `past_due` grace on a plan that
   * never bills again is meaningless, and an absent currentPeriodEnd would
   * make the cancelAtPeriodEnd comparison silently pass.
   *
   * `paid` is Stripe's own payment_status on the one-time Checkout Session,
   * stored verbatim like every other status here. `refunded` is written only
   * by a refund event. Anything else fails closed to free: an unrecognised
   * status on a plan that cannot change status is a bug, not a lifecycle. */
  if (sub.planKey === "plus_lifetime") {
    return status === "paid"
      ? { tier: "plus", status, needsAttention: false, graceEndsAt: null }
      : { tier: "free", status: status || "none", needsAttention: false, graceEndsAt: null };
  }
  const periodEndMs = sub.currentPeriodEnd ? sub.currentPeriodEnd * 1000 : null;

  if (status === "active" || status === "trialing") {
    // cancelAtPeriodEnd still means Plus until that date actually passes.
    if (sub.cancelAtPeriodEnd && periodEndMs && now > periodEndMs) {
      return { tier: "free", status, needsAttention: false, graceEndsAt: null };
    }
    return { tier: "plus", status, needsAttention: false, graceEndsAt: null };
  }

  if (isFailingStatus(status)) {
    /* The arithmetic lives in entitlementCatalog beside the number it depends
       on, because the email that prints this date and the job that records the
       moment it passes must both get the same answer. Written here as well, the
       three would drift and a subscriber would be told one date and cut off on
       another. */
    const graceEndsAt = graceEndsAtMs(sub.currentPeriodEnd, sub.updatedAt, now);
    if (now <= graceEndsAt) {
      return { tier: "plus", status, needsAttention: true, graceEndsAt };
    }
    return { tier: "free", status, needsAttention: true, graceEndsAt };
  }

  return { tier: "free", status: status || "none", needsAttention: false, graceEndsAt: null };
}

/* Resolve across EVERY provider the account holds.
 *
 * A user who bought Plus on the web and then signs into the iOS app must get
 * Plus without buying again, and vice versa. That works because entitlement is
 * canonical here rather than owned by whichever provider happens to have
 * billed: each row is interpreted with the same rules, and the most generous
 * result wins.
 *
 * `needsAttention` is OR-ed, not taken from the winning row, so a failing card
 * on one provider is still surfaced while another provider carries the
 * entitlement. Silence there would let a subscription lapse unnoticed. */
function resolveAcrossProviders(rows: any[], now: number) {
  if (rows.length === 0) {
    return {
      tier: "free" as Tier,
      status: "none",
      needsAttention: false,
      graceEndsAt: null as number | null,
      provider: null as Resolved["provider"],
      planKey: null as Resolved["planKey"],
      duplicateProviders: false,
      periodEndAt: null as number | null,
      cancelAtPeriodEnd: false,
      billingInterval: null as Resolved["billingInterval"],
    };
  }

  const judged = rows.map((row) => ({ row, verdict: interpret(row, now) }));
  const plus = judged.filter((j) => j.verdict.tier === "plus");

  // Any provider granting Plus grants Plus.
  const winner =
    plus.length > 0
      ? plus.reduce((a, b) => (a.row.updatedAt >= b.row.updatedAt ? a : b))
      : judged.reduce((a, b) => (a.row.updatedAt >= b.row.updatedAt ? a : b));

  const needsAttention = judged.some((j) => j.verdict.needsAttention);
  // The soonest grace deadline among those that have one, so the UI warns about
  // the most urgent rather than the most recent.
  const graceCandidates = judged
    .map((j) => j.verdict.graceEndsAt)
    .filter((g): g is number => typeof g === "number");
  const graceEndsAt = graceCandidates.length ? Math.min(...graceCandidates) : null;

  const payingProviders = new Set(plus.map((j) => j.row.provider));

  return {
    tier: winner.verdict.tier,
    status: winner.verdict.status,
    needsAttention,
    graceEndsAt,
    provider: (winner.verdict.tier === "plus" ? winner.row.provider : null) as Resolved["provider"],
    planKey: (winner.verdict.tier === "plus" ? winner.row.planKey : null) as Resolved["planKey"],
    duplicateProviders: payingProviders.size > 1,
    /* Taken from the SAME row that won the tier, never merged across rows: a
     * period end from one provider paired with a plan from another would be a
     * date that describes nothing. Reported only while that row grants Plus,
     * so a lapsed row cannot leave a stale renewal date on screen. */
    periodEndAt:
      winner.verdict.tier === "plus" && winner.row.currentPeriodEnd
        ? winner.row.currentPeriodEnd * 1000
        : null,
    cancelAtPeriodEnd:
      winner.verdict.tier === "plus" ? winner.row.cancelAtPeriodEnd === true : false,
    billingInterval: (winner.verdict.tier === "plus" && winner.row.billingInterval === "year"
      ? "year"
      : winner.verdict.tier === "plus" && winner.row.billingInterval === "month"
        ? "month"
        : null) as Resolved["billingInterval"],
  };
}

/* Shared resolution used by both the public query and internal callers. */
async function resolveFor(ctx: QueryCtx, userId: string, now: number): Promise<Resolved> {
  const subs = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const settings = await ctx.db
    .query("accountSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const timezone = settings?.timezone || "UTC";
  const accountDay = clampForward(dayKeyInZone(now, timezone), settings?.lastAccountDay);

  const {
    tier, status, needsAttention, graceEndsAt, provider, planKey, duplicateProviders,
    periodEndAt, cancelAtPeriodEnd, billingInterval,
  } = resolveAcrossProviders(subs, now);
  const def = definitionFor(tier);

  const counter = await ctx.db
    .query("usageCounters")
    .withIndex("by_user_feature_day", (q) =>
      q.eq("userId", userId).eq("feature", "gentleGuidance").eq("accountDay", accountDay),
    )
    .first();

  // Reserved requests count against the allowance while in flight, otherwise
  // three concurrent calls could each see "2 used" and all proceed.
  const guidanceUsed = (counter?.used ?? 0) + (counter?.reserved ?? 0);

  const activeJourneys = (
    await ctx.db
      .query("journeySlots")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect()
  ).length;

  const gLimit = def.limits.gentleGuidanceDaily;
  const jLimit = def.limits.activeJourneys;

  return {
    tier,
    subscriptionStatus: status,
    paymentNeedsAttention: needsAttention,
    graceEndsAt,
    provider,
    planKey,
    duplicateProviders,
    periodEndAt,
    cancelAtPeriodEnd,
    billingInterval,
    accountDay,
    timezone,
    limits: def.limits,
    usage: { gentleGuidanceToday: guidanceUsed, activeJourneys },
    remaining: {
      // null limit => null remaining (no customer-visible quota), never a number.
      gentleGuidanceToday: gLimit === null ? null : Math.max(0, gLimit - guidanceUsed),
      activeJourneySlots: jLimit === null ? null : Math.max(0, jLimit - activeJourneys),
    },
  };
}

/* ── client-facing reads ─────────────────────────────────────────────────── */

/* The only entitlement API a browser gets. Takes NO arguments, so there is
 * nothing to point at another account. Returns the guest shape when signed out
 * rather than throwing, because being signed out is a normal state. */
export const getMyEntitlements = query({
  args: {},
  handler: async (ctx): Promise<Resolved> => {
    const user = await authComponent.safeGetAuthUser(ctx);
    const now = Date.now();
    if (!user) {
      const def = definitionFor("guest");
      return {
        tier: "guest",
        subscriptionStatus: "none",
        paymentNeedsAttention: false,
        graceEndsAt: null,
        provider: null,
        planKey: null,
        duplicateProviders: false,
        periodEndAt: null,
        cancelAtPeriodEnd: false,
        billingInterval: null,
        accountDay: dayKeyInZone(now, "UTC"),
        timezone: "UTC",
        limits: def.limits,
        usage: { gentleGuidanceToday: 0, activeJourneys: 0 },
        remaining: { gentleGuidanceToday: 0, activeJourneySlots: null },
      };
    }
    return await resolveFor(ctx, user._id as string, now);
  },
});

/* Trusted eligibility for starting another Journey.
 *
 * Reads ONLY `journeySlots`. It deliberately does not look at the Journey
 * progress mirrored into `userData`, because `userdata.set` is a public
 * mutation accepting an arbitrary key and value — counting that would be
 * security theatre.
 *
 * Returns a stable reason code, never an English sentence. */
export const canStartJourney = query({
  args: {},
  handler: async (ctx): Promise<{ allowed: boolean; reason: string; active: number; limit: number | null }> => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      // Guests have no account entitlement; Journeys are device-local for them.
      return { allowed: true, reason: "guest", active: 0, limit: null };
    }
    const r = await resolveFor(ctx, user._id as string, Date.now());
    const limit = r.limits.activeJourneys;
    if (limit === null) return { allowed: true, reason: "unlimited", active: r.usage.activeJourneys, limit: null };
    if (r.usage.activeJourneys < limit) {
      return { allowed: true, reason: "ok", active: r.usage.activeJourneys, limit };
    }
    return { allowed: false, reason: "active-journey-limit", active: r.usage.activeJourneys, limit };
  },
});

// INTERNAL: for trusted server code (usage reservation, future Worker metering).
export const resolveInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => resolveFor(ctx, args.userId, Date.now()),
});

/* ── account timezone ────────────────────────────────────────────────────── */

/* Set the account timezone. Authenticated, self-only, validated, rate-limited.
 *
 * The rate limit exists because the day key drives the daily allowance: without
 * it someone could hop zones to manufacture a fresh day. The monotonic clamp in
 * accountDay.ts is the second layer, so even a permitted change cannot rewind a
 * spent allowance. A genuine traveller changes zones far less than once a day. */
export const setTimezone = mutation({
  args: { timezone: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; reason?: string }> => {
    const userId = await requireUserId(ctx);
    if (!isValidTimeZone(args.timezone)) return { ok: false, reason: "invalid-timezone" };

    const now = Date.now();
    const existing = await ctx.db
      .query("accountSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existing) {
      await ctx.db.insert("accountSettings", {
        userId,
        timezone: args.timezone,
        timezoneUpdatedAt: now,
        lastAccountDay: dayKeyInZone(now, args.timezone),
        createdAt: now,
        updatedAt: now,
      });
      return { ok: true };
    }

    if (existing.timezone === args.timezone) return { ok: true }; // no-op, not a change

    if (
      existing.timezoneUpdatedAt &&
      now - existing.timezoneUpdatedAt < TIMEZONE_CHANGE_MIN_INTERVAL_MS
    ) {
      return { ok: false, reason: "timezone-change-too-soon" };
    }

    // Advance the monotonic floor to whichever day is later, so the change can
    // move the clock forward but never back.
    const nextDay = clampForward(dayKeyInZone(now, args.timezone), existing.lastAccountDay);
    await ctx.db.patch(existing._id, {
      timezone: args.timezone,
      timezoneUpdatedAt: now,
      lastAccountDay: nextDay,
      updatedAt: now,
    });
    return { ok: true };
  },
});
