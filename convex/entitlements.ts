import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import {
  definitionFor,
  PAST_DUE_GRACE_MS,
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
  subscriptionStatus: string; // 'none' | raw Stripe status
  paymentNeedsAttention: boolean;
  graceEndsAt: number | null;
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
function interpret(
  sub: any,
  now: number,
): { tier: Tier; status: string; needsAttention: boolean; graceEndsAt: number | null } {
  if (!sub) return { tier: "free", status: "none", needsAttention: false, graceEndsAt: null };

  const status = String(sub.status || "");
  const periodEndMs = sub.currentPeriodEnd ? sub.currentPeriodEnd * 1000 : null;

  if (status === "active" || status === "trialing") {
    // cancelAtPeriodEnd still means Plus until that date actually passes.
    if (sub.cancelAtPeriodEnd && periodEndMs && now > periodEndMs) {
      return { tier: "free", status, needsAttention: false, graceEndsAt: null };
    }
    return { tier: "plus", status, needsAttention: false, graceEndsAt: null };
  }

  if (status === "past_due" || status === "unpaid") {
    // Grace runs from the end of the period they last paid for. When Stripe
    // gives us no period end, fall back to when we last heard about them, so a
    // missing field cannot grant an unbounded free ride.
    const base = periodEndMs ?? (sub.updatedAt || now);
    const graceEndsAt = base + PAST_DUE_GRACE_MS;
    if (now <= graceEndsAt) {
      return { tier: "plus", status, needsAttention: true, graceEndsAt };
    }
    return { tier: "free", status, needsAttention: true, graceEndsAt };
  }

  return { tier: "free", status: status || "none", needsAttention: false, graceEndsAt: null };
}

/* Shared resolution used by both the public query and internal callers. */
async function resolveFor(ctx: QueryCtx, userId: string, now: number): Promise<Resolved> {
  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const settings = await ctx.db
    .query("accountSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const timezone = settings?.timezone || "UTC";
  const accountDay = clampForward(dayKeyInZone(now, timezone), settings?.lastAccountDay);

  const { tier, status, needsAttention, graceEndsAt } = interpret(sub, now);
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
