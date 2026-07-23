# Production Risk Map

*Branch/worktree state, what's protected, what's unmerged and where, the deployment pipeline, and
what could go wrong if any of this were merged or deployed carelessly. Nothing here changes any of
it — this is a map, not an action.*

## Branch state

- **`main`**: production. Does not contain the sidebar shell, the Results-page redesign, the
  Translation switcher, or Root-Pattern Insight's backend. Anyone reading `main` alone sees an older
  version of the app than what's been built and reviewed this session.
- **`redesign/desktop-web-shell`** (this branch, checked out at the primary working directory,
  currently at `c62f863`): 6 commits ahead of `main` — the ≥1024px sidebar shell, Declare-page
  whitespace/crisis-link polish, the Results-page redesign (spine/icon timeline, right-rail verse
  index, two-part Breakdown, Recent Words, live Translation switcher), and the gap/layout fixes that
  followed. **Jeff has reviewed and approved every piece of this on a live Cloudflare preview.**
  Not merged, not pushed to `main`, no PR opened.
- **`feature/root-pattern-insight`** (1 commit ahead of `main`, `219991e`): a separate Convex backend
  slice (struggle-history logging + insight generation). Built, never run against a live Convex
  deployment, never reviewed by Jeff, not merged. Cut from `main`, not from `redesign/desktop-web-shell`
  — its own copy of `today.astro` predates the desktop redesign, so merging it will need care (see
  "Merge risk" below).
- **Worktree** at `.claude/worktrees/agent-a52d9218af95dab7e` (branch
  `worktree-agent-a52d9218af95dab7e`): leftover from an earlier background-agent task this session.
  Its one commit is already incorporated into `redesign/desktop-web-shell` (fast-forwarded). Safe to
  leave as-is or prune later; not touched as part of this task per Jeff's instruction.

## Uncommitted / untracked items at the primary checkout (not touched by this task)

- `TODO.md`, modified — a pre-existing, unrelated roadmap note about the `app.declareandbelieve.com`
  split (approved 2026-07-16). Left exactly as-is.
- `docs/` (this new tree, including the master build prompt and its own alignment-review doc) —
  untracked, not yet committed by anyone.
- Five stray `psalmlog-*.png` files at repo root — untracked, not created by this session's work,
  not moved or added to Git per Jeff's instruction.

## Protected files (per the master build prompt §5, confirmed unmodified by this task)

`CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, `declare-and-believe-project-brief.md`,
`declare-and-believe-builders-brief.md`, `declare-and-believe-system-prompt.md`,
`src/app/declare/declare-api.js`, `public/declare/journey-engine.js`, `worker/**`, `convex/**`,
`.github/**`, any environment file, any Cloudflare/Wrangler configuration.

## Deployment pipeline (unchanged, no CI gate)

GitHub push → Cloudflare Pages auto-build (Astro static output) → `declareandbelieve.com`. The
Worker deploys separately via `wrangler`, on its own schedule, not on every Pages build. Convex
deploys separately again, manually, via `npx convex dev`/`deploy` — deliberately something only Jeff
runs, since it pushes schema/function changes straight to a live deployment. **No automated test or
build gate sits between a push and a live deploy** — a bad push to `main` would go live with no
safety net beyond manual review.

## What could go wrong if any of this were merged/deployed carelessly

- **Merging `redesign/desktop-web-shell` to `main` today**: low risk on its own — it's been
  Jeff-reviewed on a real Cloudflare preview, mobile is confirmed untouched, and `npm run build`
  is clean. The main residual risk is the *absence* of an automated regression check (no tests) —
  a human visual pass remains the only guard against a regression Jeff hasn't personally clicked
  through.
- **Merging `feature/root-pattern-insight` naively**: real risk. It was cut from `main`, so its copy
  of `today.astro` is the *pre-desktop-redesign* version. A naive merge into `redesign/desktop-web-shell`
  (or into `main` after this branch merges) will conflict on `today.astro` and needs the
  `logStruggle(...)` call re-applied by hand against the current file, not auto-merged. The Convex
  side (`schema.ts`, `struggleHistory.ts`, `insight.ts`) is additive and lower-risk, but has never
  been run against a live Convex deployment (`npx convex dev` has not been executed), so its first
  real run is still an unknown.
- **Two independent subdomain-migration plans** (`TODO.md` vs. the master prompt §17) — proceeding
  on either one without reconciling the other first risks building against a naming/route model
  that gets contradicted later. See `current-route-map.md`'s recommended merged outline.
- **No test framework** — every verification this session has been manual (build, curl, Playwright).
  This works, but it means every future change carries the same manual-verification cost with no way
  to catch a regression automatically between sessions.
- **The legacy `/` route's live status is unconfirmed** — if it's still linked-to/indexed and a
  future change to `declare-api.js` assumes only `/today`'s calling convention, `/` could break
  silently since nothing exercises it in this session's verification passes.

## Recommended interim testing standard (per Jeff's instruction — recommendation only, nothing installed)

Given no test framework exists today, the standard that has actually worked this session, and that
is recommended to continue until a framework is explicitly approved:

1. `npm run build` clean, zero errors, before anything is called done.
2. Local dev server + `curl -o /dev/null -w "%{http_code}"` across every real route, confirming 200s.
3. Playwright-driven manual browser verification: real interactions (not just static screenshots),
   at **desktop (≥1440px)**, **tablet (~768px)**, and **mobile (≤390px)** widths.
4. Keyboard-navigation pass on any new interactive control (tab order, visible focus states).
5. `prefers-reduced-motion` check on any new animation/transition.
6. Crisis-link visibility check on any page whose layout changed — it should never become harder to
   find, never require a scroll to discover, and never depend on JavaScript that could fail silently.
7. Clean up test artifacts (screenshots, temp files) before considering a change complete.

A future automated stack, when approved, would reasonably be `vitest` + `@edge-runtime/vm` for
Convex functions (per `convex/_generated/ai/guidelines.md`'s own testing section, which already
documents the exact pattern) plus Playwright for browser-level regression coverage of the two
breakpoint-sensitive flows (Declare/Results, the sidebar shell) — not proposed for installation now,
only named as the natural next step whenever Jeff wants to make that call.
