import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { definitionFor } from "./entitlementCatalog";

/* Server-authoritative record of which Journeys are ACTIVE.
 *
 * WHY THIS TABLE HAS TO EXIST
 * Journey progress lives in localStorage and is mirrored into Convex `userData`
 * via account-sync. `userdata.set({key, value})` is a PUBLIC mutation accepting
 * an arbitrary key and an arbitrary value, so any signed-in browser can write
 * `db_journey_lock` to whatever it likes. Counting active Journeys from that
 * data would be security theatre: the number being enforced would be a number
 * the user controls. So entitlement counts THIS table and nothing else.
 *
 * DEFINITION OF "ACTIVE" — a slot is active from the moment a Journey is
 * started until it is completed or archived. Explicitly NOT counted:
 *   - completed Journeys        (status 'completed')
 *   - archived Journeys         (status 'archived')
 *   - deleted Journeys          (row removed)
 *   - abandoned cache entries that the product does not treat as resumable
 * The product currently treats a started-but-unfinished Journey as resumable,
 * so it counts. That is the honest reading of the data model rather than a
 * convenient one.
 *
 * CURRENT STATUS: the Journey UI does not call these mutations yet — wiring it
 * is its own reviewed phase, and the limit sheet is deliberately not activated.
 * Until then the trusted count is 0 for everyone and the limit is inert. That
 * is the correct failure mode: an unwired limit lets people through, whereas
 * counting forgeable data would block honest users while letting anyone who
 * opens a console straight past.
 */

async function requireUserId(ctx: MutationCtx): Promise<string> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("not-authenticated");
  return user._id as string;
}

const VALID_END = new Set(["completed", "archived"]);

/* Claim an active-Journey slot. Enforces the limit server-side and is
 * idempotent per journeyId, so a retried start cannot consume two slots. */
type StartResult = { ok: boolean; reason?: string; active?: number; limit?: number | null };

/* Core logic shared by the public mutation (identity from context) and the
 * internal one (trusted server code that already resolved identity). */
async function doStart(ctx: MutationCtx, userId: string, args: { journeyId: string }): Promise<StartResult> {
  {
    if (!args.journeyId || args.journeyId.length > 128) {
      return { ok: false, reason: "invalid-journey-id" };
    }
    const now = Date.now();

    // Idempotent: same journey started twice keeps one slot.
    const existing = await ctx.db
      .query("journeySlots")
      .withIndex("by_user_journey", (q) => q.eq("userId", userId).eq("journeyId", args.journeyId))
      .first();
    if (existing) {
      if (existing.status === "active") return { ok: true };
      // Re-opening a completed or archived Journey reclaims its slot, and is
      // therefore subject to the limit again.
      const activeNow = await countActive(ctx, userId);
      const lim = await limitFor(ctx, userId);
      if (lim !== null && activeNow >= lim) {
        return { ok: false, reason: "active-journey-limit", active: activeNow, limit: lim };
      }
      await ctx.db.patch(existing._id, { status: "active", endedAt: undefined });
      return { ok: true, active: activeNow + 1, limit: lim };
    }

    const active = await countActive(ctx, userId);
    const limit = await limitFor(ctx, userId);
    if (limit !== null && active >= limit) {
      return { ok: false, reason: "active-journey-limit", active, limit };
    }

    await ctx.db.insert("journeySlots", {
      userId,
      journeyId: args.journeyId,
      status: "active",
      startedAt: now,
    });
    return { ok: true, active: active + 1, limit };
  }
}

export const registerJourneyStart = mutation({
  args: { journeyId: v.string() },
  handler: async (ctx, args): Promise<StartResult> => doStart(ctx, await requireUserId(ctx), args),
});

export const registerJourneyStartInternal = internalMutation({
  args: { userId: v.string(), journeyId: v.string() },
  handler: async (ctx, args): Promise<StartResult> =>
    doStart(ctx, args.userId, { journeyId: args.journeyId }),
});

/* Release a slot by completing or archiving. Never deletes Journey content —
 * this only changes what the entitlement counter sees. */
async function doRelease(
  ctx: MutationCtx,
  userId: string,
  args: { journeyId: string; status: string },
): Promise<{ ok: boolean; reason?: string }> {
  {
    if (!VALID_END.has(args.status)) return { ok: false, reason: "invalid-status" };
    const row = await ctx.db
      .query("journeySlots")
      .withIndex("by_user_journey", (q) => q.eq("userId", userId).eq("journeyId", args.journeyId))
      .first();
    if (!row) return { ok: false, reason: "no-such-journey" };
    if (row.status === args.status) return { ok: true }; // idempotent
    await ctx.db.patch(row._id, { status: args.status, endedAt: Date.now() });
    return { ok: true };
  }
}

export const releaseJourneySlot = mutation({
  args: { journeyId: v.string(), status: v.string() },
  handler: async (ctx, args) => doRelease(ctx, await requireUserId(ctx), args),
});

export const releaseJourneySlotInternal = internalMutation({
  args: { userId: v.string(), journeyId: v.string(), status: v.string() },
  handler: async (ctx, args) =>
    doRelease(ctx, args.userId, { journeyId: args.journeyId, status: args.status }),
});

async function countActive(ctx: MutationCtx, userId: string): Promise<number> {
  const rows = await ctx.db
    .query("journeySlots")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
    .collect();
  return rows.length;
}

async function limitFor(ctx: MutationCtx, userId: string): Promise<number | null> {
  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const tier = sub?.tier === "plus" ? "plus" : "free";
  return definitionFor(tier).limits.activeJourneys;
}

/* GRANDFATHERING
 *
 * A Free user who already has more active Journeys than the new limit keeps
 * every one of them. Nothing is force-completed, force-archived or deleted.
 * They may open, continue, complete and archive all of them; they simply cannot
 * START another until they are back at or under the cap.
 *
 * That falls out of the design rather than needing special handling:
 * registerJourneyStart is the only thing that checks the limit, and it is only
 * called when starting something NEW. Existing rows are never re-validated.
 *
 * This internal mutation exists for the backfill that will run when the Journey
 * UI is wired: it records pre-existing Journeys as active slots and marks them
 * grandfathered, without ever refusing to record one. internalMutation, so no
 * browser can mint itself slots. */
export const backfillSlotInternal = internalMutation({
  args: { userId: v.string(), journeyId: v.string(), startedAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("journeySlots")
      .withIndex("by_user_journey", (q) =>
        q.eq("userId", args.userId).eq("journeyId", args.journeyId),
      )
      .first();
    if (existing) return { ok: true, deduped: true };
    // Deliberately no limit check: backfill records reality, it does not judge it.
    await ctx.db.insert("journeySlots", {
      userId: args.userId,
      journeyId: args.journeyId,
      status: "active",
      startedAt: args.startedAt ?? Date.now(),
      grandfathered: true,
    });
    return { ok: true };
  },
});
