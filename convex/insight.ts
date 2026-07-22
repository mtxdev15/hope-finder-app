import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// Root-Pattern Insight — see declare-root-insight-system-prompt.md for the
// full rationale and the exact prompt text (mirrored here, this file is the
// source of truth per the same convention declare-api.js/its mirror doc use).

const MIN_ENTRIES = 5; // no insight attempted below this — 1-2 data points would feel presumptuous
const RECOMPUTE_EVERY = 5; // only regenerate once this many NEW entries have accumulated
const CACHE_KEY = "db_root_insight";

const SYSTEM_PROMPT = `You are the pastoral voice inside Declare and Believe, the same trusted friend who writes its instant Scripture responses, now looking at someone's history of struggles they have brought to this app over time and gently naming what those struggles might have in common underneath.

You are not a therapist, a diagnostician, or a personality-test generator. You are a friend who has been paying quiet attention and noticed something worth naming, humbly and pastorally, always leaving room for you to be wrong.

INPUT: a list of struggles this person has brought to the app, each with when they brought it. The list may repeat the same struggle more than once, or include several different ones.

YOUR JOB: look across the whole list and gently name the one thing these struggles most likely have in common underneath, not a diagnosis, not a personality label, but a real, specific, spiritual root: something about what this person believes about who God is, or who they believe they are. Ground it in Scripture and in identity in Christ, never in secular psychology language.

RULES, absolute:
- Never assert a fact about this person as settled truth. Invite, do not declare. Use language like "these seem to circle" or "there may be a question underneath these about," never "you are" or "you have."
- Never use clinical or diagnostic language of any kind (no "anxiety disorder," no "trauma response," no therapy-speak).
- Never quote a specific past struggle back to them verbatim in a way that could feel surveilled. Synthesize a pattern; do not produce a transcript.
- No em dashes anywhere. Use a period, comma, or colon instead.
- 3 to 5 sentences. Warm, specific, never generic, never presumptuous.
- If the list genuinely does not show a clear pattern, say so honestly and gently instead of forcing one.

Respond ONLY with valid JSON: { "insight": "3 to 5 sentences." }`;

type CachedInsight = { text: string; computedAt: number; basedOnCount: number };

export const generate = action({
  args: {},
  handler: async (ctx): Promise<
    | { status: "not_enough"; have: number; need: number }
    | { status: "ok"; text: string; basedOnCount: number; cached: boolean }
  > => {
    const history: { struggle: string; askedAt: number }[] = await ctx.runQuery(api.struggleHistory.recent, {});
    if (history.length < MIN_ENTRIES) {
      return { status: "not_enough", have: history.length, need: MIN_ENTRIES };
    }

    const blobs: Record<string, string> = await ctx.runQuery(api.userdata.getAll, {});
    const cachedRaw = blobs[CACHE_KEY];
    let cached: CachedInsight | null = null;
    if (cachedRaw) {
      try { cached = JSON.parse(cachedRaw); } catch { cached = null; }
    }
    if (cached && history.length - cached.basedOnCount < RECOMPUTE_EVERY) {
      return { status: "ok", text: cached.text, basedOnCount: cached.basedOnCount, cached: true };
    }

    const userPrompt = `Struggles brought to this app, most recent first:\n${history
      .map((h) => `- ${h.struggle}`)
      .join("\n")}\n\nReturn ONLY valid JSON: { "insight": "..." }`;

    const response = await fetch("https://hope-finder-worker.thinktoro.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        temperature: 0.9,
        messages: [{ role: "user", content: SYSTEM_PROMPT + "\n\n" + userPrompt }],
      }),
    });
    if (!response.ok) throw new Error("Insight API error: " + response.status);
    const data: any = await response.json();
    const raw: string = data?.content?.[0]?.text || "";
    const stripped = raw.replace(/```json|```/g, "").trim();
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    const cleaned = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
      ? stripped.slice(firstBrace, lastBrace + 1)
      : stripped;
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed.insight !== "string" || !parsed.insight.trim()) {
      throw new Error("Insight response missing text");
    }

    const toCache: CachedInsight = { text: parsed.insight, computedAt: Date.now(), basedOnCount: history.length };
    await ctx.runMutation(api.userdata.set, { key: CACHE_KEY, value: JSON.stringify(toCache) });

    return { status: "ok", text: parsed.insight, basedOnCount: history.length, cached: false };
  },
});
