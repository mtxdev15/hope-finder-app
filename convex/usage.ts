import { v } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { definitionFor, RESERVATION_TTL_MS, type Tier } from "./entitlementCatalog";
import { dayKeyInZone, clampForward } from "./accountDay";

/* Usage counters and the reservation lifecycle.
 *
 * THE PROBLEM THIS SOLVES: "check the limit, then do the work, then increment"
 * is a race. Three concurrent requests all read "2 used" and all proceed, and a
 * 3-per-day allowance quietly serves five. So a request must take its slot
 * BEFORE the work starts, and give it back if the work does not produce a real
 * answer.
 *
 * LIFECYCLE
 *   reserveUsage(requestId)  -> takes a slot, or refuses
 *   finalizeUsage(requestId) -> the slot becomes a consumed use
 *   releaseUsage(requestId)  -> the slot returns to the pool, nothing consumed
 *
 * Convex mutations are transactional and serialized per document, so the
 * read-modify-write inside a single mutation is atomic. That is what makes the
 * counter safe without an explicit lock.
 *
 * WHAT MUST NOT CONSUME AN ALLOWANCE: a failed request, a malformed response,
 * an unavailable service, crisis routing, support-required routing, or a
 * cancellation that reaches the server. Someone in crisis must never be charged
 * a daily use for being routed to help. Callers signal these by calling
 * releaseUsage instead of finalizeUsage.
 *
 * EXPIRY: if a process crashes between reserve and finalize, the reservation
 * would otherwise hold a slot until midnight. Every reservation carries
 * `expiresAt`; expired ones are reclaimed lazily on the next reserve for that
 * (user, feature, day). Lazy reclamation is deliberate — it needs no scheduler,
 * and the only person affected by a stale hold is the one about to make the
 * next request, who is exactly who triggers the sweep.
 */

const FEATURES = new Set(["gentleGuidance"]);

async function requireUserId(ctx: MutationCtx): Promise<string> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("not-authenticated");
  return user._id as string;
}

async function accountDayFor(ctx: MutationCtx, userId: string, now: number): Promise<string> {
  const s = await ctx.db
    .query("accountSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return clampForward(dayKeyInZone(now, s?.timezone), s?.lastAccountDay);
}

async function tierFor(ctx: MutationCtx, userId: string): Promise<Tier> {
  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!sub) return "free";
  // Mirrors entitlements.interpret for the statuses that matter to metering.
  // past_due keeps Plus here; the grace-window boundary is applied by the
  // resolver, which this path consults for the authoritative limit.
  return sub.tier === "plus" ? "plus" : "free";
}

async function getOrCreateCounter(
  ctx: MutationCtx,
  userId: string,
  feature: string,
  accountDay: string,
  now: number,
) {
  const existing = await ctx.db
    .query("usageCounters")
    .withIndex("by_user_feature_day", (q) =>
      q.eq("userId", userId).eq("feature", feature).eq("accountDay", accountDay),
    )
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("usageCounters", {
    userId,
    feature,
    accountDay,
    used: 0,
    reserved: 0,
    successful: 0,
    failed: 0,
    updatedAt: now,
  });
  return (await ctx.db.get(id))!;
}

/* Reclaim expired reservations for this (user, feature, day) so a crashed
 * process cannot hold someone's allowance hostage. */
async function reclaimExpired(
  ctx: MutationCtx,
  userId: string,
  feature: string,
  accountDay: string,
  now: number,
  counterId: Id<"usageCounters">,
): Promise<number> {
  const rows = await ctx.db
    .query("usageReservations")
    .withIndex("by_user_feature_day", (q) =>
      q.eq("userId", userId).eq("feature", feature).eq("accountDay", accountDay),
    )
    .collect();
  let reclaimed = 0;
  for (const r of rows) {
    if (r.status === "reserved" && r.expiresAt <= now) {
      await ctx.db.patch(r._id, { status: "released", resolvedAt: now });
      reclaimed++;
    }
  }
  // Releasing the RESERVATION ROW is not enough: the counter's `reserved` tally
  // is what the limit check reads, so it must come down too. Without this the
  // TTL was cosmetic — a crashed process still consumed the allowance for the
  // rest of the day, which is precisely what the expiry exists to prevent.
  if (reclaimed > 0) {
    const c = await ctx.db.get(counterId);
    if (c) {
      await ctx.db.patch(counterId, {
        reserved: Math.max(0, c.reserved - reclaimed),
        updatedAt: now,
      });
    }
  }
  return reclaimed;
}

/* ── reserve ─────────────────────────────────────────────────────────────── */

type ReserveResult = {
  ok: boolean;
  reason?: string;
  requestId?: string;
  remaining?: number | null;
  accountDay?: string;
};

/* Core reserve logic, shared by the public mutation (browser, identity from
 * context) and the internal one (trusted server code such as the future Gentle
 * Guidance action, which resolves identity itself before calling in). One code
 * path means the two can never drift apart on something as load-bearing as a
 * quota check. */
async function doReserve(
  ctx: MutationCtx,
  userId: string,
  args: { feature: string; requestId: string },
): Promise<ReserveResult> {
  {
    if (!FEATURES.has(args.feature)) return { ok: false, reason: "unknown-feature" };
    if (!args.requestId || args.requestId.length > 128) {
      return { ok: false, reason: "invalid-request-id" };
    }

    const now = Date.now();
    const accountDay = await accountDayFor(ctx, userId, now);

    // Idempotency first: an existing reservation for this key is returned as-is.
    const prior = await ctx.db
      .query("usageReservations")
      .withIndex("by_user_request", (q) => q.eq("userId", userId).eq("requestId", args.requestId))
      .first();
    if (prior) {
      if (prior.status === "reserved" && prior.expiresAt > now) {
        return { ok: true, requestId: args.requestId, accountDay: prior.accountDay };
      }
      // Already finalized or released: this key is spent. Refuse rather than
      // silently issuing a second slot under a reused key.
      return { ok: false, reason: "request-already-resolved" };
    }

    // Counter first: reclaim needs somewhere to return the freed holds to.
    const counter0 = await getOrCreateCounter(ctx, userId, args.feature, accountDay, now);
    await reclaimExpired(ctx, userId, args.feature, accountDay, now, counter0._id);

    const tier = await tierFor(ctx, userId);
    const limit = definitionFor(tier).limits.gentleGuidanceDaily;

    // Re-read: reclaim may have just decremented `reserved`.
    const counter = (await ctx.db.get(counter0._id))!;

    // null = no customer-visible quota (Plus). Invisible abuse/concurrency
    // protections are intentionally NOT expressed here; they belong to the
    // service layer so raising a product limit cannot raise an abuse ceiling.
    if (limit !== null) {
      if (limit === 0) return { ok: false, reason: "requires-account", remaining: 0, accountDay };
      const inUse = counter.used + counter.reserved;
      if (inUse >= limit) {
        return { ok: false, reason: "daily-limit-reached", remaining: 0, accountDay };
      }
    }

    await ctx.db.patch(counter._id, { reserved: counter.reserved + 1, updatedAt: now });
    await ctx.db.insert("usageReservations", {
      userId,
      feature: args.feature,
      accountDay,
      requestId: args.requestId,
      status: "reserved",
      createdAt: now,
      expiresAt: now + RESERVATION_TTL_MS,
    });

    const after = await ctx.db.get(counter._id);
    const remaining =
      limit === null ? null : Math.max(0, limit - ((after?.used ?? 0) + (after?.reserved ?? 0)));
    return { ok: true, requestId: args.requestId, remaining, accountDay };
  }
}

export const reserveUsage = mutation({
  args: { feature: v.string(), requestId: v.string() },
  handler: async (ctx, args): Promise<ReserveResult> =>
    doReserve(ctx, await requireUserId(ctx), args),
});

// For trusted server code that has already resolved identity. internalMutation,
// so a browser cannot reach it and name someone else.
export const reserveUsageInternal = internalMutation({
  args: { userId: v.string(), feature: v.string(), requestId: v.string() },
  handler: async (ctx, args): Promise<ReserveResult> =>
    doReserve(ctx, args.userId, { feature: args.feature, requestId: args.requestId }),
});

/* ── finalize ────────────────────────────────────────────────────────────── */

/* Call ONLY when a valid, normal Gentle Guidance response was successfully
 * returned. Idempotent: finalizing twice counts once. */
async function doFinalize(
  ctx: MutationCtx,
  userId: string,
  args: { requestId: string },
): Promise<{ ok: boolean; reason?: string }> {
  {
    const now = Date.now();

    const res = await ctx.db
      .query("usageReservations")
      .withIndex("by_user_request", (q) => q.eq("userId", userId).eq("requestId", args.requestId))
      .first();
    if (!res) return { ok: false, reason: "no-such-reservation" };
    if (res.status === "finalized") return { ok: true }; // idempotent
    if (res.status === "released") return { ok: false, reason: "already-released" };

    const counter = await getOrCreateCounter(ctx, userId, res.feature, res.accountDay, now);
    // Move the hold into a consumed use. Guarded so a reclaimed-then-finalized
    // reservation cannot drive `reserved` negative.
    await ctx.db.patch(counter._id, {
      reserved: Math.max(0, counter.reserved - 1),
      used: counter.used + 1,
      successful: counter.successful + 1,
      updatedAt: now,
    });
    await ctx.db.patch(res._id, { status: "finalized", resolvedAt: now });
    return { ok: true };
  }
}

export const finalizeUsage = mutation({
  args: { requestId: v.string() },
  handler: async (ctx, args) => doFinalize(ctx, await requireUserId(ctx), args),
});

export const finalizeUsageInternal = internalMutation({
  args: { userId: v.string(), requestId: v.string() },
  handler: async (ctx, args) => doFinalize(ctx, args.userId, { requestId: args.requestId }),
});

/* ── release ─────────────────────────────────────────────────────────────── */

/* Give the slot back without consuming a use. `reason` is recorded so failures
 * can be told apart from crisis routing in later analysis — crisis routing is
 * NOT a failure, and must never look like one. */
async function doRelease(
  ctx: MutationCtx,
  userId: string,
  args: { requestId: string; reason?: string },
): Promise<{ ok: boolean; reason?: string }> {
  {
    const now = Date.now();

    const res = await ctx.db
      .query("usageReservations")
      .withIndex("by_user_request", (q) => q.eq("userId", userId).eq("requestId", args.requestId))
      .first();
    if (!res) return { ok: false, reason: "no-such-reservation" };
    if (res.status === "released") return { ok: true }; // idempotent
    if (res.status === "finalized") return { ok: false, reason: "already-finalized" };

    const counter = await getOrCreateCounter(ctx, userId, res.feature, res.accountDay, now);
    const isFailure = args.reason === "failed" || args.reason === "malformed";
    await ctx.db.patch(counter._id, {
      reserved: Math.max(0, counter.reserved - 1),
      failed: isFailure ? counter.failed + 1 : counter.failed,
      updatedAt: now,
    });
    await ctx.db.patch(res._id, { status: "released", resolvedAt: now });
    return { ok: true };
  }
}

export const releaseUsage = mutation({
  args: { requestId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => doRelease(ctx, await requireUserId(ctx), args),
});

export const releaseUsageInternal = internalMutation({
  args: { userId: v.string(), requestId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) =>
    doRelease(ctx, args.userId, { requestId: args.requestId, reason: args.reason }),
});

/* ── internal helpers ────────────────────────────────────────────────────── */

export const counterInternal = internalQuery({
  args: { userId: v.string(), feature: v.string(), accountDay: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("usageCounters")
      .withIndex("by_user_feature_day", (q) =>
        q.eq("userId", args.userId).eq("feature", args.feature).eq("accountDay", args.accountDay),
      )
      .first(),
});

/* Test/ops helper: force-expire a reservation so the reclaim path can be
 * exercised without waiting out the TTL. internalMutation — unreachable from a
 * browser. */
export const expireReservationInternal = internalMutation({
  args: { userId: v.string(), requestId: v.string() },
  handler: async (ctx, args) => {
    const res = await ctx.db
      .query("usageReservations")
      .withIndex("by_user_request", (q) =>
        q.eq("userId", args.userId).eq("requestId", args.requestId),
      )
      .first();
    if (!res) return { ok: false };
    await ctx.db.patch(res._id, { expiresAt: Date.now() - 1 });
    return { ok: true };
  },
});
