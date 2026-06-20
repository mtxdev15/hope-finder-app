import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";

const MAX_TESTIMONIAL = 2000;

// Derive the signed-in user server-side (never trust client-supplied identity).
// Returns both the scope key (_id) and a firstName from the auth profile name,
// using the same split as currentUser() in auth-store.js.
async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<{ userId: string; firstName: string }> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  const firstName = ((user.name || "").trim().split(/\s+/)[0]) || "";
  return { userId: user._id as string, firstName };
}

function checkScore(n: number, label: string) {
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error(`${label} must be an integer from 1 to 5`);
  }
}

// Submit a review. Always writes status "pending" — public visibility requires a
// later manual approval, so nothing user-written goes live automatically. The
// three scores, optional testimonial, and isPublic come from the client; userId
// and firstName are derived server-side.
export const submit = mutation({
  args: {
    scoreMetYou: v.number(),
    scoreTheWord: v.number(),
    scoreComingBack: v.number(),
    testimonial: v.optional(v.string()),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, firstName } = await requireUser(ctx);
    checkScore(args.scoreMetYou, "scoreMetYou");
    checkScore(args.scoreTheWord, "scoreTheWord");
    checkScore(args.scoreComingBack, "scoreComingBack");
    const testimonial = (args.testimonial || "").trim().slice(0, MAX_TESTIMONIAL);

    await ctx.db.insert("reviews", {
      userId,
      firstName,
      score_met_you: args.scoreMetYou,
      score_the_word: args.scoreTheWord,
      score_coming_back: args.scoreComingBack,
      ...(testimonial ? { testimonial } : {}),
      isPublic: args.isPublic,
      status: "pending",
      createdAt: Date.now(),
    });
    return null;
  },
});

// Approved + public reviews for the future testimonial wall, newest first.
// Never exposes userId. Returns a bounded set.
export const listApprovedPublic = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_status_public", (q) =>
        q.eq("status", "approved").eq("isPublic", true),
      )
      .order("desc")
      .take(100);
    return rows.map((r) => ({
      firstName: r.firstName,
      score_met_you: r.score_met_you,
      score_the_word: r.score_the_word,
      score_coming_back: r.score_coming_back,
      testimonial: r.testimonial,
      createdAt: r.createdAt,
    }));
  },
});

// The signed-in user's own most recent review (any status), so the profile can
// show what they rated instead of asking again. Returns null if they haven't
// rated yet. Scoped to the caller; never takes a userId arg.
export const myReview = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx);
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);
    const r = rows[0];
    if (!r) return null;
    return {
      score_met_you: r.score_met_you,
      score_the_word: r.score_the_word,
      score_coming_back: r.score_coming_back,
      testimonial: r.testimonial,
      isPublic: r.isPublic,
      status: r.status,
      createdAt: r.createdAt,
    };
  },
});
