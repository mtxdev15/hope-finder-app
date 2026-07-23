# Phase 1 (existing work) — Shared App Shell and Declare Intake

*Written retroactively, documenting work already built and Jeff-reviewed on
`redesign/desktop-web-shell` (commit `9276710`) before this master-build-prompt process began. No
runtime code was changed while writing this summary. Format follows the master prompt's §21 report
structure.*

## 1. Goal

Give the app a real desktop (≥1024px) navigation shell without touching anything on mobile — the
existing bottom-tab-bar experience at ≤480px was to remain pixel-identical.

## 2. What existed before

Two responsive tiers only: a bottom tab bar at ≤480px, and a fixed top bar at 481-1023px (both
already part of `declare.css`'s `.app-shell` system, driven by `TabBar.astro`). Nothing above
1023px got a dedicated treatment — the top bar simply stretched, with no sidebar, no collapse
affordance, and no desktop-specific layout adjustments to the Declare intake screen.

## 3. What changed

- Added a persistent left sidebar for ≥1024px viewports: brand row with a collapse toggle, the same
  nav destinations reordered vertically, a pinned "In crisis? Find help now" link, and a bottom
  account block.
- Collapse state persists to `localStorage` (`declare-sidebar-collapsed`).
- An anti-flash inline resolver script sets `data-sidebar` on `<html>` before paint, mirroring the
  existing theme-resolver pattern, so there's no visible flash/reflow on load or navigation.
- Minor whitespace and crisis-link polish on the Declare intake screen itself (not a redesign of the
  intake, just spacing/placement refinement alongside the shell work).

## 4. What was preserved

- All existing AI behavior (`declare-api.js`, `journey-engine.js`) — untouched.
- The ≤480px bottom tab bar and 481-1023px top bar — both existing CSS rules left alone; the new
  sidebar rules are entirely inside a `≥1024px` media query.
- Existing route names, Convex tables, and stored struggle IDs — no renames.

## 5. Files changed

- `public/declare/sidebar.css` (new) — the ≥1024px sidebar system (`--sbw` custom property for
  expanded/collapsed width, nav item ordering, crisis link, account block).
- `public/declare/sidebar.js` (new) — collapse toggle + `localStorage` persistence.
- `src/components/TabBar.astro` — added the brand row, collapse button, crisis link, and
  per-destination classes (`tab-word`, `tab-journey`, `tab-declare`, `tab-vault`, `tab-you`) so
  `sidebar.css` can target and reorder them.
- `src/layouts/DeclareLayout.astro` — linked `sidebar.css`, added the anti-flash `data-sidebar`
  resolver script, added `sidebar.js` to the script bundle.

## 6. Data changes

None. No schema, table, or Convex function changes in this phase.

## 7. Environment variable changes

None.

## 8. Tests run

No automated suite exists (see `../architecture/production-risk-map.md`). Manual verification:
local dev server, route-level checks across all pages, and a visual pass confirming the sidebar
renders correctly at ≥1024px and that mobile/tablet tiers are unaffected.

## 9. Build result

Clean `npm run build` at the time this work was committed (re-confirmed clean again in this
session's later work, which built on top of it).

## 10. Manual QA steps performed

- Loaded every route with the sidebar present, confirmed the correct destination highlighted as
  active.
- Toggled the collapse button, confirmed the collapsed state persisted across a reload.
- Confirmed the crisis link remained visible and one click away from every page.
- Confirmed ≤480px and 481-1023px tiers were visually unchanged from the pre-existing shipped design.

## 11. Accessibility notes

The collapse toggle and crisis link are real, focusable, keyboard-reachable elements (not
`div`-as-button patterns). No new motion was introduced that would need a `prefers-reduced-motion`
guard — the sidebar's presence is a layout fact at a given viewport width, not an animated
transition.

## 12. Security and privacy notes

None applicable — this phase touched only navigation chrome, no data flow.

## 13. Known limitations

- The sidebar's collapse preference is stored in `localStorage`, not per-account — it won't follow
  a signed-in user across devices. Not flagged as a defect, just a scope boundary worth knowing.

## 14. Rollback instructions

Revert commit `9276710` on `redesign/desktop-web-shell`, or simply do not merge this branch — `main`
already has none of this work, so no rollback is needed there.

## 15. Screenshots / preview routes

Reviewed live on a Cloudflare Pages preview build of `redesign/desktop-web-shell` by Jeff directly;
no static screenshots were retained as part of this phase's own record (later phases in this same
session did retain and reference specific screenshots — see Phase 2's summary).

## 16. Questions for the next phase

None outstanding from this phase specifically — Phase 2 (Results page) proceeded directly on top of
this shell without needing further shell changes.
