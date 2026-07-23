# Current Product Audit

*A snapshot of Declare & Believe exactly as it runs today, independent of what any older document
claims. Compiled read-only against branch `redesign/desktop-web-shell` (commit `c62f863`), which is
ahead of `main` but not yet merged. Companion to `document-conflicts.md`, which lists every place
this snapshot disagrees with `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, the two briefs, or the master
build prompt.*

## What the product actually is right now

A single-domain Astro app at `declareandbelieve.com`. A visitor names a struggle (chip or free
text) and receives, in one response: three Scripture verses in a chosen translation, a pastoral
explanation, 3-5 declarations, a prayer, and (new) a per-verse "Breakdown." From there they can
save to a Vault, start a 5-day Journey, read the whole Bible in `/word`, or manage their account in
`/you`. Crisis help (988) is always one tap away, never gated behind the AI response.

## Route map (actual)

| Route | Purpose today |
|---|---|
| `/` | The original V1 React single-page app (`src/app/app.jsx`), calling the same `declare-api.js` brain. Still present in the codebase; live status unconfirmed with Jeff (see `document-conflicts.md` open question). |
| `/today` | The current, actively developed app experience: struggle entry → results (Scripture, Mindset, declarations, prayer, Breakdown, Journey cross-sell). No separate `/results` route exists — Results is a client-side view swap inside this one page. |
| `/word` | Full Bible reader, backed by API.Bible via the Worker's `/bible` and `/bible/search` routes. |
| `/journey` | The 5-day guided arc, generated day-by-day. |
| `/vault` | Saved verses/declarations/prayers/words. |
| `/you` | Profile, account, settings. |
| `/signin`, `/create-account`, `/reset-password` | Auth flows (Better Auth via Convex). |
| `/crisis` | Dedicated crisis-help page, static, real `tel:`/`sms:` links. |
| `/404` | Not-found page. |

Full detail and the recommended subdomain-migration outline: `../architecture/current-route-map.md`.

## Navigation model (actual)

One adaptive system, not three separate ones: bottom tab bar (≤480px) → fixed top bar (481-1023px)
→ persistent left sidebar (≥1024px, shipped this session). Same five destinations at every tier
(Word, Journey, Declare, Vault, You), plus a pinned crisis link. Driven by `TabBar.astro` +
`public/declare/sidebar.css`/`sidebar.js`, resolved in `DeclareLayout.astro`.

## Design tokens (actual)

`public/declare/declare.css` defines a **dark-by-default, semantic custom-property system**
(`--text`, `--bg`, `--surface`, `--gold`, `--field`, `--line`, `--spine`, `--receive`, `--prayer`,
etc.) — `:root` holds a light/dawn variant, `html[data-theme="dark"]` redefines the same properties
as the actual default. This is materially different from `DESIGN.md`'s documented cream/light V1
system, though the brand DNA (forest authority, gold sacred emphasis, Cormorant/DM Sans two-family
rule, generous line-height, reduced-motion support, no wellness pastels) carries through unchanged.
Full comparison: `document-conflicts.md`.

## AI systems (actual, two, deliberately separate)

1. **Instant Declare** — `src/app/declare/declare-api.js`, model `claude-haiku-4-5-20251001`,
   streaming, prompt-cached system prompt, `max_tokens: 2048`. Shared by `/` and `/today`.
2. **5-day Journey** — `public/declare/journey-engine.js`, model `claude-sonnet-4-6`, non-streaming,
   no caching, `max_tokens: 1500`, with a large hand-authored ESV fallback bank per struggle.

A third, small helper — `translateVerses()`, added this session inside `declare-api.js` — re-fetches
verse text only, in a different translation, for a word already on screen (temperature 0, matched
back by reference). Full detail: `../architecture/current-ai-map.md`.

## Bible reader (actual)

`/word` only. The Worker's `/bible` and `/bible/search` routes proxy `api.scripture.api.bible`.
Public-domain translations (KJV, WEB, ASV, and Spanish RVR1909) are cached; copyrighted ones
(NKJV, NIV, NLT) are fetched live with the required FUMS tracking script and copyright line. This
is completely separate from the instant Declare flow, which still gets verse text written inline by
the model, not looked up.

## Data and auth (actual)

Convex is the live backend (`^1.41.0`). On this branch: `vaultItems`, `userData`, `vaultCollections`,
`reviews`, `giftStats`, `giftHistory`, `giftEvents`. Auth is `@convex-dev/better-auth`
(email+password, no verification step, plus Google OAuth). Every mutation derives the user
server-side via `authComponent.safeGetAuthUser(ctx)`, never a client-supplied id. Full detail:
`../architecture/current-data-map.md`.

## Crisis handling (actual)

Two layers: the AI's own CRISIS instruction (compassion, then 988, then Scripture) and always-on
static UI (`CrisisBanner.astro` in the intake, a dedicated `/crisis` page, and a pinned sidebar/tab
link at every breakpoint). No client-side keyword detector exists; the model and the always-visible
UI are the only two safety layers.

## Deployment (actual)

GitHub push → Cloudflare Pages auto-build (Astro static output). The Worker is deployed separately
via `wrangler`, not on every Pages build. Convex is deployed separately again, manually, via
`npx convex dev`/`deploy`. No CI gate exists between push and build (no `.github/workflows/`) and no
automated test suite runs at any point (see "Tests" below).

## Tests (actual)

None. No test framework in `package.json`, no `*.test.*`/`*.spec.*` files in app source. Verification
this session was manual: local `npm run dev`, route-level `curl` 200 checks, and Playwright-driven
browser checks across breakpoints before anything was called done.

## What's unmerged right now (see `production-risk-map.md` for the full picture)

- `redesign/desktop-web-shell` (this branch): the sidebar shell + the Results-page redesign, both
  Jeff-reviewed, neither merged to `main`.
- `feature/root-pattern-insight`: a separate Convex backend (struggle-history logging + an
  insight-generation action), not merged, not yet run against a live Convex deployment.
