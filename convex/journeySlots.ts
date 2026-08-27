import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { definitionFor, type Tier } from "./entitlementCatalog";
import { interpret } from "./entitlements";

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

/* The same resolution for a READ, and deliberately not the same function.
 * requireUserId throws, which is right for a mutation: refusing to write is
 * the safe outcome. A query that throws for a signed-out reader turns an empty
 * list into an error the page has to handle, so this returns null instead. */
async function readUserId(ctx: QueryCtx): Promise<string | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  return user ? (user._id as string) : null;
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
      const { tier, limit: lim } = await limitFor(ctx, userId);
      if (lim !== null && activeNow >= lim) {
        await recordBlock(ctx, userId, tier, lim, activeNow);
        return { ok: false, reason: "active-journey-limit", active: activeNow, limit: lim };
      }
      /* Re-opening is a fresh claim, so the cap in force NOW is the one that
         applies and the one worth recording. The original tierAtStart would be
         stale and misleading. */
      await ctx.db.patch(existing._id, {
        status: "active",
        endedAt: undefined,
        tierAtStart: tier,
        ...(lim !== null ? { limitAtStart: lim } : {}),
      });
      return { ok: true, active: activeNow + 1, limit: lim };
    }

    const active = await countActive(ctx, userId);
    const { tier, limit } = await limitFor(ctx, userId);
    if (limit !== null && active >= limit) {
      await recordBlock(ctx, userId, tier, limit, active);
      return { ok: false, reason: "active-journey-limit", active, limit };
    }

    await ctx.db.insert("journeySlots", {
      userId,
      journeyId: args.journeyId,
      status: "active",
      startedAt: now,
      /* What they were allowed at the moment they started. Absent limitAtStart
         means the tier had no customer-visible cap, which is not zero and not
         unknown. */
      tierAtStart: tier,
      ...(limit !== null ? { limitAtStart: limit } : {}),
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

/* Record a slot for a Journey the user ALREADY has open, without enforcing the
 * limit. This is the resume/backfill path and it is deliberately separate from
 * registerJourneyStart.
 *
 * Why it must not enforce: a grandfathered user over the cap has to be able to
 * resume their existing Journeys. Running the limit check here would refuse to
 * record a Journey they are already in, which both loses the slot and blocks
 * legitimate work. The limit belongs on STARTING something new, and nowhere
 * else. Idempotent, so resuming repeatedly never duplicates. */
export const ensureJourneySlot = mutation({
  args: { journeyId: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; reason?: string }> => {
    const userId = await requireUserId(ctx);
    if (!args.journeyId || args.journeyId.length > 128) {
      return { ok: false, reason: "invalid-journey-id" };
    }
    const existing = await ctx.db
      .query("journeySlots")
      .withIndex("by_user_journey", (q) => q.eq("userId", userId).eq("journeyId", args.journeyId))
      .first();
    if (existing) {
      if (existing.status !== "active") {
        await ctx.db.patch(existing._id, { status: "active", endedAt: undefined });
      }
      return { ok: true };
    }
    await ctx.db.insert("journeySlots", {
      userId,
      journeyId: args.journeyId,
      status: "active",
      startedAt: Date.now(),
      grandfathered: true, // pre-existed the limit
    });
    return { ok: true };
  },
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

async function limitFor(
  ctx: MutationCtx,
  userId: string,
): Promise<{ tier: Tier; limit: number | null }> {
  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  /* INTERPRETED, NOT READ OFF THE ROW.
   *
   * `subscriptions.tier` is a coarse mirror written at webhook time, and for a
   * failing subscription `tierForStatus` writes "plus" — correctly, because
   * grace keeps Plus on. But grace ENDS by the clock rather than by an event,
   * so nothing rewrites that column when it does. Reading it directly therefore
   * handed a lapsed subscriber unlimited Journeys for ever, which is a paid
   * benefit and a live model call every time.
   *
   * entitlements.interpret is the one thing allowed to decide this. It reads
   * the same row and applies the grace window, so a lapsed account drops to the
   * Free cap the moment it actually lapses, with nothing needing to have run.
   *
   * subscriptions.recordGraceExpiry also corrects the mirror when the window
   * closes, but that is a scheduled job and a scheduled job can fail to run.
   * This is the check that does not depend on anything having happened. */
  const tier = sub ? interpret(sub, Date.now()).tier : "free";
  return { tier, limit: definitionFor(tier).limits.activeJourneys };
}

/* The cap said no. Written down, because this is the one outcome that otherwise
 * leaves no trace: an allowed start creates a journeySlots row, a refusal
 * creates nothing and the moment is gone. */
async function recordBlock(
  ctx: MutationCtx,
  userId: string,
  tier: string,
  limit: number,
  active: number,
): Promise<void> {
  await ctx.db.insert("journeyLimitBlocks", { userId, tier, limit, active, at: Date.now() });
  /* Structured and greppable. No journeyId and no content: this line says the
     cap bit, not what they were writing about. */
  console.log(
    "[journey] active-journey-limit tier=" + tier +
      " limit=" + limit + " active=" + active,
  );
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
/* The Journeys this reader has open and has not finished.
 *
 * WHAT THE SCREEN NEEDS. When somebody is refused a new Journey, telling them
 * "you have three open" without saying WHICH three is not an answer they can
 * act on. This returns the ids; the browser already holds the names, the
 * from-and-to pairs and the descriptive lines in journey-data.js, so nothing
 * here needs to carry copy.
 *
 * IDS AND TIMES ONLY. No reflections, no day, no generated content. A slot row
 * has never held any of that, and this is not the place to start.
 *
 * Bounded by the cap plus a small margin: a reader can hold at most `limit`
 * of these, and the margin only exists so a grandfathered account over the cap
 * still sees all of them rather than a truncated list it cannot act on. */
export const myOpenJourneys = query({
  args: {},
  handler: async (ctx): Promise<{ journeyId: string; startedAt: number }[]> => {
    const userId = await readUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("journeySlots")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .take(24);
    return rows
      .map((r) => ({ journeyId: r.journeyId, startedAt: r.startedAt }))
      .sort((a, b) => a.startedAt - b.startedAt);
  },
});

/* ── COLLAPSING THE SEEDED SLOT IDS ─────────────────────────────────────────
 *
 * WHAT WENT WRONG. journey.astro sent `journeyId` as `<id>:<seed>`, and
 * beginJourney() re-rolls the seed on every start. doStart is idempotent per
 * journeyId, which was exactly right, but a restart of the SAME Journey arrived
 * under a different journeyId and claimed a SECOND slot. Nothing ever released
 * the first one: the only release call fires on completion, under the new seed.
 *
 * So the cap counted RESTARTS, not Journeys. Somebody who began Anxiety three
 * times held three slots for one Journey, and the fourth attempt at anything
 * would have been refused.
 *
 * The client now sends the bare journey id. This collapses what the old client
 * already wrote, and without it those rows count against the cap forever and
 * can never be released, because release resolves by the id the client now
 * sends.
 *
 * KEEPS THE MOST ALIVE STATUS AND THE EARLIEST START. Two rows for one Journey
 * mean one attempt was abandoned and another may still be running; the survivor
 * has to be the one that still grants something. Completed outranks archived,
 * because finishing is the fact worth keeping.
 *
 * BOUNDED AND RESUMABLE. Takes a page at a time and returns a cursor, so this
 * cannot exceed a mutation's limits on an account with many rows. Idempotent:
 * running it twice collapses nothing the second time. */
const STATUS_RANK: Record<string, number> = { active: 3, completed: 2, archived: 1 };

function baseJourneyId(id: string): string {
  const cut = id.indexOf(":");
  return cut === -1 ? id : id.slice(0, cut);
}

export const normalizeSlotIdsInternal = internalMutation({
  args: { cursor: v.optional(v.string()), pageSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ scanned: number; collapsed: number; cursor: string | null; done: boolean }> => {
    const size = Math.min(Math.max(args.pageSize ?? 200, 1), 500);
    const page = await ctx.db
      .query("journeySlots")
      .paginate({ cursor: args.cursor ?? null, numItems: size });

    let collapsed = 0;
    for (const row of page.page) {
      const base = baseJourneyId(row.journeyId);
      if (base === row.journeyId) continue; // already bare

      const target = await ctx.db
        .query("journeySlots")
        .withIndex("by_user_journey", (q) => q.eq("userId", row.userId).eq("journeyId", base))
        .first();

      if (!target) {
        /* No bare row yet: rename this one in place rather than insert and
           delete, so nothing is lost if this run is interrupted here. */
        await ctx.db.patch(row._id, { journeyId: base });
        collapsed++;
        continue;
      }
      /* A bare row already exists. Merge into it and drop this one. */
      const keepStatus =
        (STATUS_RANK[row.status] ?? 0) > (STATUS_RANK[target.status] ?? 0)
          ? row.status
          : target.status;
      const keepStarted = Math.min(target.startedAt, row.startedAt);
      await ctx.db.patch(target._id, {
        status: keepStatus,
        startedAt: keepStarted,
        ...(keepStatus === "active" ? { endedAt: undefined } : {}),
      });
      await ctx.db.delete(row._id);
      collapsed++;
    }
    return {
      scanned: page.page.length,
      collapsed,
      cursor: page.isDone ? null : page.continueCursor,
      done: page.isDone,
    };
  },
});

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
