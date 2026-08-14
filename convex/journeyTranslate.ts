import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { dayKeyInZone, clampForward } from "./accountDay";

/* Journey prose translation — authenticated transport.
 *
 * Translates JOURNEY-AUTHORED copy of a completed day into Spanish so a
 * completed English day can be reviewed in Spanish WITHOUT regenerating it. The
 * English original is never rewritten; this produces a separate display copy.
 *
 * WHAT THIS IS NOT
 *   - Not Gentle Guidance. Separate feature key, separate counters, separate
 *     limits. A translation never consumes a Free guidance response.
 *   - Not an entitlement. There is no upgrade gate and no customer-visible
 *     allowance. Spanish access is language support, not a premium benefit.
 *     The limits below are invisible abuse protection and live here in the
 *     service layer, never in entitlementCatalog, so raising a product limit
 *     can never raise an abuse ceiling.
 *   - Not the Scripture path. Verse text is retrieved from the verified Bible
 *     source by the client utility. No Bible text is ever sent to or returned
 *     from this route.
 *
 * THE CLIENT GUARD IS NOT THE SECURITY BOUNDARY. The browser module has its own
 * privacy guard, which is useful for catching mistakes early, but a browser can
 * be modified. Everything is revalidated here, and again in the Worker.
 *
 * IDENTITY comes only from the authenticated session. There is no userId
 * argument to spoof, and the browser's cache key is never trusted as identity.
 */

import {
  JOURNEY_TRANSLATE_FEATURE,
  LOCALE_SCHEMA_VERSION,
  MAX_CONCURRENT_PER_ACCOUNT,
  MAX_PER_ACCOUNT_DAY,
  MAX_PER_ROLLING_HOUR,
  ROLLING_WINDOW_MS,
  TRANSLATE_RESERVATION_TTL_MS,
  TRANSPORT_VERSION,
  serverSourceHash,
  serverTranslationKey,
  validateFields,
} from "./journeyTranslateCore";

/** How long a joiner waits for the in-flight leader before telling the client
 *  to retry. Kept well under the action time budget. */
const JOIN_POLL_MS = 250;
const JOIN_MAX_POLLS = 20;
/** Cached translations are durable; a pending row this old is abandoned. */
const PENDING_STALE_MS = 3 * 60 * 1000;

/* ── Account day helpers ───────────────────────────────────────────────────── */

async function accountDayFor(ctx: MutationCtx, userId: string, now: number): Promise<string> {
  const s = await ctx.db
    .query("accountSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return clampForward(dayKeyInZone(now, s?.timezone), s?.lastAccountDay);
}

/** Previous YYYY-MM-DD bucket. Only used to widen the rolling-hour scan across
 *  a day boundary; the actual window is filtered on absolute timestamps. */
function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const t = Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000;
  const dt = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/* ── Quota: reserve / finalize / release ───────────────────────────────────
 * Same lifecycle as convex/usage.ts, deliberately in its own module so Gentle
 * Guidance code is untouched. Rows are isolated by `feature`, so the two never
 * see each other's counters. */

async function getOrCreateCounter(ctx: MutationCtx, userId: string, accountDay: string, now: number) {
  const existing = await ctx.db
    .query("usageCounters")
    .withIndex("by_user_feature_day", (q) =>
      q.eq("userId", userId).eq("feature", JOURNEY_TRANSLATE_FEATURE).eq("accountDay", accountDay),
    )
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("usageCounters", {
    userId, feature: JOURNEY_TRANSLATE_FEATURE, accountDay,
    used: 0, reserved: 0, successful: 0, failed: 0, updatedAt: now,
  });
  return (await ctx.db.get(id))!;
}

/** Reclaim holds from crashed processes, so an abandoned reservation cannot
 *  block an account's single concurrent slot indefinitely. */
async function reclaimExpired(ctx: MutationCtx, userId: string, accountDay: string, now: number) {
  const rows = await ctx.db
    .query("usageReservations")
    .withIndex("by_user_feature_day", (q) =>
      q.eq("userId", userId).eq("feature", JOURNEY_TRANSLATE_FEATURE).eq("accountDay", accountDay),
    )
    .collect();
  let reclaimed = 0;
  for (const r of rows) {
    if (r.status === "reserved" && r.expiresAt <= now) {
      await ctx.db.patch(r._id, { status: "released", resolvedAt: now });
      reclaimed++;
    }
  }
  if (reclaimed > 0) {
    const c = await getOrCreateCounter(ctx, userId, accountDay, now);
    await ctx.db.patch(c._id, { reserved: Math.max(0, c.reserved - reclaimed), updatedAt: now });
  }
  return reclaimed;
}

/** Successful translations finalized inside the rolling window. Scans today and
 *  yesterday's buckets, then filters on the absolute timestamp. */
async function successesInRollingWindow(ctx: MutationCtx, userId: string, accountDay: string, now: number) {
  const buckets = [accountDay, previousDayKey(accountDay)];
  const since = now - ROLLING_WINDOW_MS;
  let count = 0;
  for (const bucket of buckets) {
    const rows = await ctx.db
      .query("usageReservations")
      .withIndex("by_user_feature_day", (q) =>
        q.eq("userId", userId).eq("feature", JOURNEY_TRANSLATE_FEATURE).eq("accountDay", bucket),
      )
      .collect();
    for (const r of rows) {
      if (r.status === "finalized" && (r.resolvedAt ?? 0) >= since) count++;
    }
  }
  return count;
}

export const reserveInternal = internalMutation({
  args: { userId: v.string(), requestId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (!args.requestId || args.requestId.length > 256) {
      return { ok: false as const, reason: "invalid-request-id" };
    }
    const accountDay = await accountDayFor(ctx, args.userId, now);

    const prior = await ctx.db
      .query("usageReservations")
      .withIndex("by_user_request", (q) => q.eq("userId", args.userId).eq("requestId", args.requestId))
      .first();
    if (prior) {
      if (prior.status === "reserved" && prior.expiresAt > now) {
        return { ok: true as const, accountDay: prior.accountDay, rejoined: true };
      }
      return { ok: false as const, reason: "request-already-resolved" };
    }

    await getOrCreateCounter(ctx, args.userId, accountDay, now);
    await reclaimExpired(ctx, args.userId, accountDay, now);
    const counter = await getOrCreateCounter(ctx, args.userId, accountDay, now);

    if (counter.reserved >= MAX_CONCURRENT_PER_ACCOUNT) {
      return { ok: false as const, reason: "translation-in-progress" };
    }
    if (counter.used >= MAX_PER_ACCOUNT_DAY) {
      return { ok: false as const, reason: "daily-limit-reached" };
    }
    const hourly = await successesInRollingWindow(ctx, args.userId, accountDay, now);
    if (hourly >= MAX_PER_ROLLING_HOUR) {
      return { ok: false as const, reason: "hourly-limit-reached" };
    }

    await ctx.db.patch(counter._id, { reserved: counter.reserved + 1, updatedAt: now });
    await ctx.db.insert("usageReservations", {
      userId: args.userId,
      feature: JOURNEY_TRANSLATE_FEATURE,
      accountDay,
      requestId: args.requestId,
      status: "reserved",
      createdAt: now,
      expiresAt: now + TRANSLATE_RESERVATION_TTL_MS,
    });
    return { ok: true as const, accountDay, rejoined: false };
  },
});

export const finalizeInternal = internalMutation({
  args: { userId: v.string(), requestId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const res = await ctx.db
      .query("usageReservations")
      .withIndex("by_user_request", (q) => q.eq("userId", args.userId).eq("requestId", args.requestId))
      .first();
    if (!res) return { ok: false as const, reason: "no-such-reservation" };
    if (res.status === "finalized") return { ok: true as const };
    if (res.status === "released") return { ok: false as const, reason: "already-released" };
    const counter = await getOrCreateCounter(ctx, args.userId, res.accountDay, now);
    await ctx.db.patch(counter._id, {
      reserved: Math.max(0, counter.reserved - 1),
      used: counter.used + 1,
      successful: counter.successful + 1,
      updatedAt: now,
    });
    await ctx.db.patch(res._id, { status: "finalized", resolvedAt: now });
    return { ok: true as const };
  },
});

export const releaseInternal = internalMutation({
  args: { userId: v.string(), requestId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const res = await ctx.db
      .query("usageReservations")
      .withIndex("by_user_request", (q) => q.eq("userId", args.userId).eq("requestId", args.requestId))
      .first();
    if (!res) return { ok: false as const, reason: "no-such-reservation" };
    if (res.status === "released") return { ok: true as const };
    if (res.status === "finalized") return { ok: false as const, reason: "already-finalized" };
    const counter = await getOrCreateCounter(ctx, args.userId, res.accountDay, now);
    await ctx.db.patch(counter._id, {
      reserved: Math.max(0, counter.reserved - 1),
      failed: counter.failed + 1,
      updatedAt: now,
    });
    await ctx.db.patch(res._id, { status: "released", resolvedAt: now });
    return { ok: true as const };
  },
});

/* ── Server-side result cache and single-flight ────────────────────────────
 * The cache row IS the single-flight lock. The first caller inserts `pending`
 * and becomes the leader; concurrent callers find that row and wait rather than
 * making a second model call. Three simultaneous identical requests therefore
 * produce exactly one model call and one consumed slot. */

export const claimInternal = internalMutation({
  args: { userId: v.string(), serverKey: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("journeyTranslations")
      .withIndex("by_user_key", (q) => q.eq("userId", args.userId).eq("serverKey", args.serverKey))
      .first();
    if (existing) {
      if (existing.status === "done") {
        return { role: "cache-hit" as const, fields: existing.fields, translatedAt: existing.translatedAt, model: existing.model };
      }
      // A pending row older than the stale window is an abandoned leader; take
      // over rather than leaving the account unable to retry.
      if (existing.status === "pending" && now - existing.createdAt < PENDING_STALE_MS) {
        return { role: "joiner" as const };
      }
      await ctx.db.patch(existing._id, { status: "pending", createdAt: now });
      return { role: "leader" as const };
    }
    await ctx.db.insert("journeyTranslations", {
      userId: args.userId,
      serverKey: args.serverKey,
      status: "pending",
      createdAt: now,
    });
    return { role: "leader" as const };
  },
});

export const completeInternal = internalMutation({
  args: {
    userId: v.string(), serverKey: v.string(),
    fields: v.string(), model: v.string(), translatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("journeyTranslations")
      .withIndex("by_user_key", (q) => q.eq("userId", args.userId).eq("serverKey", args.serverKey))
      .first();
    if (!row) return { ok: false as const };
    await ctx.db.patch(row._id, {
      status: "done", fields: args.fields, model: args.model, translatedAt: args.translatedAt,
    });
    return { ok: true as const };
  },
});

/** Clears a failed leader's pending row so the next attempt is not treated as a
 *  joiner waiting on a request that will never finish. */
export const abandonInternal = internalMutation({
  args: { userId: v.string(), serverKey: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("journeyTranslations")
      .withIndex("by_user_key", (q) => q.eq("userId", args.userId).eq("serverKey", args.serverKey))
      .first();
    if (row && row.status === "pending") await ctx.db.delete(row._id);
    return { ok: true as const };
  },
});

/* Cleanup for superseded rows. Ops-invoked, not scheduled: there is no cron in
 * this project and a translation cache is small enough that lazy plus manual
 * cleanup is honest and sufficient.
 *
 * SCOPE IS DELIBERATELY NARROW. It reads and deletes ONLY journeyTranslations
 * rows for one account. It cannot touch Journey progress, reflections, Vault
 * data, original completed content, active-Journey slots, usage counters or
 * reservations — those tables are never queried here.
 *
 *   - stale schema version : key does not end in the current version -> delete
 *   - superseded source hash: key not in `keepKeys` -> delete (caller supplies
 *     the keys still reachable from current content)
 *   - abandoned pending    : older than the stale window -> delete, so a retry
 *                            becomes a fresh leader rather than a stuck joiner
 *   - done rows in use     : never deleted unless explicitly superseded
 */
export const cleanupInternal = internalMutation({
  args: {
    userId: v.string(),
    // Keys still reachable from current content. Omit to prune only by version
    // and abandonment, which is the safe default.
    keepKeys: v.optional(v.array(v.string())),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const suffix = "|v" + LOCALE_SCHEMA_VERSION;
    const keep = args.keepKeys ? new Set(args.keepKeys) : null;
    const rows = await ctx.db
      .query("journeyTranslations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const removed: string[] = [];
    for (const row of rows) {
      const staleVersion = !row.serverKey.endsWith(suffix);
      const superseded = keep !== null && !keep.has(row.serverKey);
      const abandoned = row.status === "pending" && now - row.createdAt >= PENDING_STALE_MS;
      if (staleVersion || superseded || abandoned) {
        removed.push(staleVersion ? "stale-version" : abandoned ? "abandoned-pending" : "superseded-hash");
        if (!args.dryRun) await ctx.db.delete(row._id);
      }
    }
    return { scanned: rows.length, removed: removed.length, reasons: removed, dryRun: !!args.dryRun };
  },
});

export const readInternal = internalQuery({
  args: { userId: v.string(), serverKey: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("journeyTranslations")
      .withIndex("by_user_key", (q) => q.eq("userId", args.userId).eq("serverKey", args.serverKey))
      .first(),
});

/* ── The action ────────────────────────────────────────────────────────────── */

type TranslateResult =
  | {
      ok: true;
      sourceLocale: "en";
      displayLocale: "es";
      sourceHash: string;
      schemaVersion: number;
      fields: Record<string, string>;
      provenance: { translatedAt: number; model: string; transportVersion: string };
      cached: boolean;
    }
  | { ok: false; reason: string; detail?: string; retryable: boolean };

export const translateJourneyDay = action({
  args: {
    // Journey-authored copy only. Note what is ABSENT: no userId, no cache key,
    // no quota state, no entitlement state, no prompt, no verse text.
    fields: v.any(),
    sourceLocale: v.string(),
    displayLocale: v.string(),
  },
  handler: async (ctx, args): Promise<TranslateResult> => {
    // 1. Trusted identity first. Nothing about our configuration is revealed
    //    before we know who is asking.
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { ok: false, reason: "not-authenticated", retryable: false };
    const userId = (user as { _id: string })._id;

    // 2. Locale pair. Only en -> es exists today; anything else is refused
    //    rather than quietly treated as the default.
    if (args.sourceLocale !== "en" || args.displayLocale !== "es") {
      return { ok: false, reason: "unsupported-locale-pair", retryable: false };
    }

    // 3. Independent server-side validation. The browser guard is a convenience;
    //    this is the boundary.
    const validated = validateFields(args.fields);
    if (!validated.ok) {
      return { ok: false, reason: validated.reason, detail: validated.detail, retryable: false };
    }

    // 4. Recompute the hash and the dedup identity server-side. A client-supplied
    //    hash or cache key is never trusted, and the key is bound to the account.
    const sourceHash = serverSourceHash(validated.fields);
    const serverKey = serverTranslationKey({
      userId, sourceLocale: "en", displayLocale: "es", sourceHash, schemaVersion: LOCALE_SCHEMA_VERSION,
    });

    // 5. Single-flight. A cache hit costs no quota; a joiner waits for the leader
    //    rather than making a second model call.
    const claim = await ctx.runMutation(internal.journeyTranslate.claimInternal, { userId, serverKey });
    if (claim.role === "cache-hit") {
      return {
        ok: true, sourceLocale: "en", displayLocale: "es", sourceHash,
        schemaVersion: LOCALE_SCHEMA_VERSION,
        fields: JSON.parse(claim.fields as string),
        provenance: { translatedAt: claim.translatedAt as number, model: claim.model as string, transportVersion: TRANSPORT_VERSION },
        cached: true,
      };
    }
    if (claim.role === "joiner") {
      for (let i = 0; i < JOIN_MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, JOIN_POLL_MS));
        const row = await ctx.runQuery(internal.journeyTranslate.readInternal, { userId, serverKey });
        if (row && row.status === "done") {
          return {
            ok: true, sourceLocale: "en", displayLocale: "es", sourceHash,
            schemaVersion: LOCALE_SCHEMA_VERSION,
            fields: JSON.parse(row.fields as string),
            provenance: { translatedAt: row.translatedAt as number, model: row.model as string, transportVersion: TRANSPORT_VERSION },
            cached: true,
          };
        }
        if (!row) break; // leader failed and abandoned; fall through to retry
      }
      // Joined, did not consume a slot, and has nothing to show yet.
      return { ok: false, reason: "translation-in-progress", retryable: true };
    }

    // 6. Leader: reserve BEFORE the model call. requestId is the server key, so
    //    the reservation is idempotent for this exact translation.
    const reservation = await ctx.runMutation(internal.journeyTranslate.reserveInternal, {
      userId, requestId: serverKey,
    });
    if (!reservation.ok) {
      await ctx.runMutation(internal.journeyTranslate.abandonInternal, { userId, serverKey });
      const retryable =
        reservation.reason === "translation-in-progress" ||
        reservation.reason === "hourly-limit-reached";
      return { ok: false, reason: reservation.reason!, retryable };
    }

    const release = async (reason: string) => {
      await ctx.runMutation(internal.journeyTranslate.releaseInternal, { userId, requestId: serverKey, reason });
      await ctx.runMutation(internal.journeyTranslate.abandonInternal, { userId, serverKey });
    };

    const endpoint = process.env.JOURNEY_TRANSLATE_URL;
    const secret = process.env.JOURNEY_TRANSLATE_SECRET;
    if (!endpoint || !secret) {
      await release("not-configured");
      return { ok: false, reason: "translation-not-configured", retryable: false };
    }

    // 7. Worker call. Only allowlisted, already-validated fields cross the wire.
    let payload: unknown;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Declare-Internal": secret },
        body: JSON.stringify({
          fields: validated.fields,
          sourceLocale: "en",
          displayLocale: "es",
          schemaVersion: LOCALE_SCHEMA_VERSION,
        }),
      });
      if (!res.ok) {
        await release(res.status === 429 ? "provider-rate-limited" : "provider-failure");
        return { ok: false, reason: "translation-unavailable", retryable: true };
      }
      payload = await res.json();
    } catch {
      await release("network");
      return { ok: false, reason: "translation-unavailable", retryable: true };
    }

    // 8. Validate what came back. A malformed response must not consume a slot
    //    and must never reach the reader.
    const body = payload as { ok?: unknown; fields?: unknown; model?: unknown };
    if (!body || body.ok !== true) {
      await release("provider-failure");
      return { ok: false, reason: "translation-unavailable", retryable: true };
    }
    const returned = validateFields(body.fields);
    if (!returned.ok) {
      await release("malformed");
      return { ok: false, reason: "translation-malformed", detail: returned.reason, retryable: true };
    }
    // Every returned field must correspond to one we sent: the model may not
    // invent a section, and it may not return Scripture.
    for (const key of Object.keys(returned.fields)) {
      if (!(key in validated.fields)) {
        await release("malformed");
        return { ok: false, reason: "translation-malformed", detail: "unexpected-field", retryable: true };
      }
    }

    // 9. Only now does the usage count.
    const translatedAt = Date.now();
    const model = typeof body.model === "string" ? body.model : "unknown";
    await ctx.runMutation(internal.journeyTranslate.completeInternal, {
      userId, serverKey, fields: JSON.stringify(returned.fields), model, translatedAt,
    });
    await ctx.runMutation(internal.journeyTranslate.finalizeInternal, { userId, requestId: serverKey });

    return {
      ok: true, sourceLocale: "en", displayLocale: "es", sourceHash,
      schemaVersion: LOCALE_SCHEMA_VERSION,
      fields: returned.fields,
      provenance: { translatedAt, model, transportVersion: TRANSPORT_VERSION },
      cached: false,
    };
  },
});
