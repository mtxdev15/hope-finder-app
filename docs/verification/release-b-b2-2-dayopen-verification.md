# Release B — B2.2 Day-Opening Screen: Verification Report

*Companion to `docs/implementation/release-b-b2-2-dayopen-summary.md`. Local dev only. Not staged, not
committed, not pushed, not merged, not deployed.*

---

## Commands run

```
$ npm run build
✓ 11 pages built, no errors (run 3 times across the session, after each round of fixes)
```

No lint or typecheck script exists in this project (`package.json` only defines `dev`/`build`/
`preview`/`astro`) — consistent with the B2.1 report's earlier finding. No automated test suite exists
either; verification is build + live Playwright-driven functional/visual checks.

## Functional

| Check | Result |
|---|---|
| Day 1–5 render correct progress dots + "Day N of 5" | ✓ verified Day 1, 2, 5 |
| Dynamic title/verse/ref/encouragement render from real `PLAN` data (never hardcoded) | ✓ |
| Primary CTA ("Begin Today's Journey") enters the correct 7-step flow, exactly once | ✓ |
| "View Journey Overview" and Close (X) both return to the correct prior Journey state | ✓ |
| Completed-day review (fruit log / day-dot) bypasses this screen entirely | ✓ — `openReview()` untouched, opens `#dayflow` directly in reviewing mode |
| Locked day never shows this screen | ✓ — falls through to the existing lock toast, matching pre-existing `openDayFlow()` behavior exactly |
| Care-gated (sensitive) new-journey entry: care gate → Preview → commit → Day-Opening, no second care gate | ✓ — full sequence tested live (`addiction`) |
| Non-sensitive new-journey entry: Preview → commit → Day-Opening | ✓ (`anxiety`, `doubt`) |
| Continuing an existing journey (Day 2+): `continueBtn` → Day-Opening → 7-step flow | ✓ |
| No duplicate overlays, no nested interactive elements | ✓ |
| Day 2+ sign-in gate still fires (inside the untouched `openDayFlow()`) | ✓ — confirmed the gate toast fires when `doBegin` is clicked signed-out on Day 5 |

## Responsive viewports (final, with the completed photographic background)

| Viewport | Result | Screenshot |
|---|---|---|
| 390×844 | Clean, full-screen, no overflow | `final-mobile-390x844.png` |
| 390×667 (short) | Fits without scrolling; would scroll cleanly if it didn't | `final-mobile-small-390x667.png` |
| 768×1024 | Centered dialog card, dimmed/blurred backdrop | `final-tablet-portrait-768x1024.png` |
| 1024×768 | Centered dialog card; this viewport also exposed the Active Journey card grid bug (fixed, see below) | `journey-card-1024-fixed-top-v2.png`, `journey-card-1024-fixed-v2.png` |
| 1440×900 | Centered modal, comfortable reading width, Vine visible at right | `final-laptop-1440x900.png` |
| 1728×1117 | Same, wider backdrop | `final-desktop-1728x1117.png` |
| 800×1000 (compact rail) | Active Journey card's Vine image, uncapped before this pass, now correctly sized | `vine-cap-800.png` |
| 200% zoom | Found genuine overlap bug (content bleeding into the close button and CTA under `justify-content:center`); fixed via `justify-content:safe center` | see summary doc, issue 7 |

## Accessibility

- Keyboard: Tab/Shift+Tab cycles exactly the 3 real controls (close, begin, secondary) and wraps
  correctly in both directions; Escape closes; Enter activates. Verified via real `page.keyboard`
  events, not synthetic `.click()`.
- Focus enters the dialog on open (after fixing the timing bug — see summary doc, issue 8) and restores
  to the triggering element (or a computed fallback: `continueBtn` if enabled, else `activeCard`) on
  close.
- Reduced motion: `joIn` keyframe animation correctly does not apply (`animationName: none`); the base
  opacity fade (not "essential motion") still completes normally.
- 200% zoom: no longer clips or overlaps after the `safe center` fix.
- Screen-reader progress text: "Day N of 5" is real text (the eyebrow), not conveyed by the dot row
  alone (which is `aria-hidden`).
- `role="dialog"` `aria-modal="true"` `aria-labelledby` on `.jo-card`; locked days are plain
  non-interactive elements elsewhere in the file, unaffected by this change.

## Language

- English (default) and Spanish UI chrome (eyebrow, CTA, secondary label) verified — new
  `journey.dayOpenBegin`/`journey.dayOpenOverview` keys render correctly, plus a live-switch repaint via
  the existing `declare-lang` event pattern.
- **Known, pre-existing gap** (not introduced here, logged to `TODO.md`): the day's title/verse/
  encouragement itself can remain in English under Spanish if the Journey Worker's AI-translation call
  hasn't completed — confirmed identical on the untouched "Today's Journey" home card using the same
  `PLAN` data. Root cause traced to `ensureDay()`'s silent fallback in `journey-engine.js`, which the
  original Release B brief protects from changes without separate approval.

## Protected surfaces confirmed unchanged

- Seven-step daily flow (`renderDayFlow()` and everything it calls): zero diff.
- `journey-engine.js`, `journey-data.js`: zero diff.
- Care-gate copy/logic (`CARE`, `CARE_ES`, `openCareGate`, `isSensitive`): zero diff.
- Convex, auth, Worker: zero diff.
- `openDayFlow()` itself: zero diff — only its 3 call sites were rewired to go through the new gate
  first.

## Console

No new JavaScript errors from real user interaction at any point across this work, across all
viewports/themes/languages tested. Only the pre-existing, dev-server-only "Outdated Optimize Dep" 504
noise (confirmed present before any of this session's changes too). One `TypeError` in
`renderDayOpening()` did surface once, during the independent final review's rapid-loop Day 1–5 test —
investigated and traced to the test harness clicking `#continueBtn` before Astro's async `init()` chain
had resolved on a fresh navigation, not reachable through real interaction (the button doesn't exist in
the DOM until `init()` has already run). Re-ran the same 5-day sweep with realistic waits: zero errors.

## Confirmed untouched

- `.playwright-mcp/` and `.tmp-sprout-preview/` — never written to directly; only the Playwright tool's
  own automatic screenshot/log output landed there, as instructed.
- `TODO.md`'s pre-existing `app-subdomain-split` entry (from an earlier, unrelated session) — confirmed
  via `git diff TODO.md`: every line in that block is a `+` addition with zero `-` deletions anywhere in
  the file, meaning nothing was removed or altered — it reads as "added" only because it was already an
  uncommitted edit from before this work began (diffed against the last commit, not against session
  start). 4 new entries were appended by this work: 2 requested mid-session (mast avatar icon, Journey
  day content language mismatch), 2 more from the original QA pass ("Preview tomorrow" pacing bypass,
  unsaved Step 6 reflections).

## Independent final-review addendum

A separate, independent review pass re-inspected the actual git diff and re-tested live rather than
trusting this document's own claims, per instruction. What follows is explicitly marked by method:

**Automated / measured** (via `getBoundingClientRect()`, `getComputedStyle()`,
`performance.getEntriesByType()`, or `git diff`):
- Close button touch target measured 40×40px (below the 44×44 minimum) — fixed to 44×44, re-measured.
- `dayopen-bg.jpg` measured 2.3 MB (1536×2752) via `ls`/`PIL`, confirmed eagerly loaded on every
  `/journey` page load via the Performance API (`initiatorType: "css"`, fired even in the zero-state
  where Day-Opening never opens) — recompressed to 213 KB (1100×1970), re-measured post-fix.
- `git diff TODO.md` confirmed zero deletions (see above).
- `git status`/`git diff --stat` confirmed the reported file list is complete and exact — no
  unexpected/generated/unrelated files.

**Manually inspected live** (real Playwright interaction, not inferred): full Day 1–5 content sweep (5/5
distinct, correct); browser Back (leaves `/journey` cleanly, no history entries pushed by this feature);
refresh mid-overlay (no corruption, no auto-reopen); sensitive flow with a second struggle (`grief`);
completed-day review bypass with progress verified unchanged; tab bar on `/word` and `/you` in both
themes (no regression); keyboard Tab/Shift+Tab cycle and Escape re-verified after the touch-target fix;
reduced motion re-verified; 200% zoom re-verified post-`safe center`-fix, including confirming the
overflow content is genuinely reachable by scrolling (not just clipped).

**Inferred / explicitly not fully testable:**
- "Larger text" (OS/browser text-size boosting, distinct from page zoom): the CSS in this file uses
  fixed `px` throughout (not `rem`/`em`), sitewide, not specific to B2.2 — a root-level `font-size`
  override has no effect on descendant `px` values, so this couldn't be meaningfully tested in isolation
  from general page zoom (which was tested and passes). Not a B2.2 regression; flagged as inferred/
  out-of-scope rather than claimed as a tested pass.
- Production Worker/AI Spanish-translation behavior: only tested against local dev, where the Worker
  call could not be confirmed to reach the network at all — can't confirm whether this differs in
  production. Logged to `TODO.md` accordingly, not claimed as verified either way.

---

**B2.2 verification complete, including an independent final review pass. Stopping here — awaiting
explicit review and commit approval.**
