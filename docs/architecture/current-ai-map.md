# Current AI Map

*The live AI systems exactly as they run today. No prompt, model, or parameter was changed while
producing this document — `declare-api.js` and `journey-engine.js` are both protected files for
this task.*

## Two deliberately separate systems

### 1. Instant Declare response

- **Source:** `src/app/declare/declare-api.js`, `generateContent()` — the single shared brain for
  both `/` (`src/app/app.jsx`) and `/today` (`src/pages/today.astro`). No second copy exists.
- **Model:** `claude-haiku-4-5-20251001`, chosen for low latency and low cost on high-volume,
  structured-JSON generation.
- **Call shape:** `stream: true`, `max_tokens: 2048`, `temperature` passed explicitly by every
  caller (`1.0` on `/`, `0.9` on `/today` — no hidden default either page could silently drift on).
  System prompt wrapped in `cache_control: { type: 'ephemeral' }` for cheap repeat calls.
- **Response contract:** `verses` (exactly 3, `{ref, text}`), `explanation` (one paragraph),
  `declarations` (3-5), `prayer`, and `breakdowns` (newer, optional — one `{context, application}`
  object per verse, same order). `isCompleteResult()` does not require `breakdowns`, so older
  cached/fallback content without it still renders.
- **Parsing:** accumulates SSE `content_block_delta` text, strips markdown fences, then defensively
  slices between the first `{` and last `}` (some responses append safety/crisis text after the
  JSON closes).
- **Crisis:** one instruction in the system prompt (compassion, then 988, then Scripture) — no
  separate client-side keyword detector.
- **Translation:** the caller passes an English translation string (NIV/NLT/KJV) or, for Spanish,
  the function itself substitutes RVR1909 and appends a full Spanish voice/tone block to the system
  prompt (matching pastora Yesenia Then's teaching style, per the in-code Spanish instructions).

### 2. Five-day Journey

- **Source:** `public/declare/journey-engine.js`, a self-contained IIFE exposing `window.JourneyEngine`.
- **Model:** `claude-sonnet-4-6`, chosen for deeper, more personal transformation over the more
  frequent/cheaper instant response.
- **Call shape:** non-streaming (one `fetch`, parse `data.content[0].text`), `max_tokens: 1500`,
  `temperature: 0.9`, no system-prompt caching (infrequent calls don't benefit). A client-side
  timeout (default 20s) resolves `null` on timeout/failure rather than hanging.
- **Fallback:** a large hand-authored bank — `VERSES` (ESV, quoted exactly, keyed by ~30 struggle
  categories), `BRIEF` (a one-paragraph "what's the lie, what's the truth" per struggle), and `ARC`
  (day-1 and day-5 themes fixed, three middle days shuffled from a pool) — used whenever the live
  call is unavailable, slow, rate-limited, or returns anything unparseable.
- **Structure preserved:** `arc(struggleId)` returns the 5 day-themes; `generateDay(opts)` generates
  one day at a time, never the whole arc up front.

## New this session: `translateVerses()` (still inside `declare-api.js`, additive, not a third
independent system)

- **Purpose:** when a reader switches the Translation pill (NIV/NLT/KJV) on a word already on
  screen, re-fetch just the verse text for the *same* references in the new translation, in place —
  no restart, no full regeneration.
- **Model:** `claude-haiku-4-5-20251001`, non-streaming, `temperature: 0`, `max_tokens: 800` (a
  small, factual lookup, not a creative generation call — deliberately cheaper/faster than the main
  response).
- **Matching, not trusting position:** the model occasionally reformats a range reference (e.g.
  splitting "Philippians 4:6-7" into two separate verses under a looser prompt). The prompt was
  tightened to forbid that, and the code matches the response back to each original reference by
  normalized string equality rather than trusting array position/count — if any reference fails to
  match, the whole call throws and the caller keeps the prior translation on screen rather than ever
  showing a guessed or mismatched pairing.
- **Not yet mirrored** in `declare-and-believe-system-prompt.md` — it's a small utility function, not
  part of the main pastoral system prompt that document mirrors, but worth knowing it exists so it
  isn't mistaken for an undocumented surprise later.

## API.Bible (`/word` only, not part of either AI system above)

`worker/src/index.js` proxies `api.scripture.api.bible` at two routes: `/bible` (chapter reads) and
`/bible/search` (full-text search). Public-domain translations (KJV, WEB, ASV, Spanish RVR1909) are
cached; copyrighted ones (NKJV, NIV, NLT) are fetched live with the required FUMS view-tracking
script and publisher copyright line. This is architecturally unrelated to the instant Declare flow —
Declare's verse text is written inline by Claude; `/word`'s verse text is looked up from a real
Bible database. Neither flow has silently absorbed the other.

## Not part of `/today`/`/`/`/word`: Root-Pattern Insight (unmerged branch)

A third, much smaller AI call exists on `feature/root-pattern-insight` (`convex/insight.ts`) —
non-streaming, Sonnet-tier reasoning pattern matching Journey's approach, threshold-gated, cached in
`userData`. Full detail in `current-data-map.md`; not merged or modified here.
