# B3.2 — Paginated Seven-Step Ritual Shell (Implementation Summary)

**Branch:** `redesign/release-b-journey`
**Base commit:** `54d5542` (B3 seven-step design system, approved and committed)
**File changed:** `src/pages/journey.astro` only. No other production file needed edits — the
design's approved crisis copy, `.btn`/`.btn-primary`/`.btn-ghost` classes, and `--cta`/`--ctatext`
theme tokens were all already reusable as-is.

## What changed, architecturally

The Journey's day-flow (`#dayflow`) used to render all seven ritual blocks (Receive, Reflect,
Cast Off, Repent & Breathe, Declare, Reflect/write, Act) into `#dfScroll` as one continuous-scroll
HTML string, revealed with a scroll-linked IntersectionObserver animation. B3.2 replaces that
presentation with a one-step-at-a-time paginated shell while deliberately keeping the exact same
generator function and bindings.

`renderDayFlow()` still builds the same seven blocks into one HTML string with `$('dfScroll').innerHTML
= ...` — `bindCast()`, `bindRepent()`, `bindSpeak()`, `bindAction()` are untouched, same ids, same
classes. The only markup addition is `data-step="N"` on each block (and a new `.df-intro`
wrapper around the day-theme title, so it only shows on step 1). A CSS rule does the pagination:

```css
.df-intro[data-step], .block[data-step] { display: none; }
.step-active { display: block; }
```

A new layer on top decides which step is visible and drives the footer:

- `let activeStep = 1; let reviewStep = 1; const TOTAL_STEPS = 7;`
- `curStep()` returns `reviewDay ? reviewStep : activeStep` — mirrors the existing `curDay()` /
  `dstate()` split between live and review state, just one level down (day → step).
- `stepReady(ds, step)` distributes the original single `ready = ds.cast && ds.repented && ds.spoke`
  gate into per-step checks: step 3 needs `ds.cast`, step 4 needs `ds.repented`, step 5 needs
  `ds.spoke`. Steps 1, 2, 6, 7 are never gated (7 keeps the original ready-check as a defensive
  no-op, since by the time you reach it every gate is already satisfied).
- `applyStepVisibility(moveFocus)` toggles `.step-active` and `inert` + `aria-hidden` on every
  `[data-step]` block, so an inactive step is out of both the tab order and the accessibility tree,
  not just visually hidden.
- `renderStepChrome()` (called by the old `refreshGate()`, now a one-line wrapper) sets the visible
  "Day N of 5" eyebrow, the screen-reader-only "Day N of 5, Step N of 7" text, the 7-dot step rail,
  the review badge, and the footer: label, gating, and Back/Next visibility.
- `goToStep(n)` / `nextStep()` / `prevStep()` clamp to `[1, 7]`, stop the breath timer if you
  navigate away from step 4 mid-breath (`stopBreathIfLeavingStep4`), and re-render.

## Progress treatment

Per the approved design (`docs/design/mockups/.../b3-topbar-before-after.png`), the top bar shows
only **"Day N of 5"** — no step count is visible there. Screen readers get the full context via a
`sr-only` span: **"Day N of 5, Step N of 7"** (with ", read only" appended in review mode). A
7-dot rail below the top bar (`#dfStepDots`) shows step progress; gating is always paired with the
lock-hint text ("Cast off the lie to continue", etc.) — color is never the only signal.

## Step navigation

- Forward: **Continue** (generic label). Step 7 becomes the pre-existing, unrenamed **"Complete
  Day N"**. Review mode replaces it with **"Back to Today"** (title case, matching the existing
  `journey.previewBackToday` string's established casing convention).
- Back: a quiet text link, hidden on step 1, labeled "Back".
- Close (top-left X, 44×44px touch target): calls the existing `closeDayFlow()` — never marks the
  day complete, never replays the Day-Opening screen, and stops the breath timer cleanly
  (`breathInst.stop()`) if closed mid-breath.

## Breath (Repent & Breathe, step 4)

`BREATH_ROUNDS` changed from `3` to `1` per the approved B3.1 design addendum. The real 4s
(inhale) / 2s (hold) / 6s (exhale) contract in `breath-ring.js` is unchanged. Live timing was
measured end-to-end (see verification doc): inhale ≈4.0s, hold ≈1.9s, exhale ≈6.1s, single pass,
auto-completes and un-gates step 5. Skipping (`#breathSkip`) marks `repented: 'skipped'` and
un-gates identically. `prefers-reduced-motion` does not skip or shorten the breath timing itself
(that's content, not decoration) — only entrance/decorative transitions respect it.

## In-ritual help / crisis access (new)

A support sheet (`#supportSheet`), reachable from a heart icon (`#dfHelp`, 44×44px) on every step,
reuses the real `/crisis` copy and links verbatim via the existing `crisis.*` i18n keys plus
`journey.done` — **zero new i18n-strings.js keys were needed.** It has its own focus-trap +
Escape handling (`supportKeydown`, mirroring the existing `dayOpenKeydown` pattern), moves focus
to its heading on open, and returns focus to `#dfHelp` and the same ritual step on close.

## Review mode (completed-day, read-only)

Clicking a completed day's dot (`#dayDots i.tap`) or fruit-log entry calls the existing
`openReview(day)`, which now also opens at review-step 1. `renderDayFlow()` forces every gate
state to `true` when reviewing (`ds.cast = ds.repented = ds.spoke = ds.acted = true`), hides the
cast/breath-skip/breathe-again controls via `.dayflow.reviewing` CSS, and dims the reflect
textarea. A visible badge reads "Reviewing a completed day · Read only". Since review is never
gated, a dedicated **"Next"** text link (`#dfStepNext`) pages forward through all 7 read-only
steps — **"Back to Today"** stays the one persistent, always-reachable exit. Opening a review
never shows the Day-Opening screen and never mutates `db_active_journey`.

## Resume behavior

`saveInstance()` / `restoreInstance()` now persist/restore `activeStep` inside the existing
`db_journey_inst:<id>` object — no new storage key. Pre-B3.2 cached instances (which predate this
field) default safely to step 1. Refreshing mid-ritual and reopening via "Continue" restores the
exact step the user left on, with gate state intact.

## Accessibility fixes found and made during live verification

Live keyboard testing surfaced two real gaps, both fixed:

1. **`#dayflow` had no focus-trap or Escape handling at all** — pre-existing since before B3.2
   (confirmed against the `54d5542` baseline), not something B3.2 introduced, but squarely in
   scope for this milestone's "accessibility and focus behavior" requirement given `#dayflow` is
   now the central, always-open dialog of the whole feature. Added `openDayFlowA11y()` /
   `dayflowKeydown()`, mirroring the exact pattern already used for the Day-Opening screen
   (`dayOpenKeydown`) and the new support sheet (`supportKeydown`): focus moves to the sr-only
   step heading on open, Tab is trapped to the dialog's visible interactive elements, Escape
   closes it. The handler steps aside (no-ops) whenever the support sheet is open on top of it,
   so the two nested dialogs' Escape/Tab handling never fight each other.
2. **"Back to Today" was rendered as "Back to today"** (lowercase) — the approved spec
   (`release-b-b3-seven-step-spec.md` §"Review-only behavior") uses title case, and the existing
   `journey.previewBackToday` string already established "Volver a Hoy" / "Back to Today" as the
   house convention. Fixed in both languages.

## Additional work: shared bottom nav bar redesign

Two rounds, both on the shared bottom nav (Word/Journey/Declare/Vault/You), neither touching
`journey.astro` — full detail in the verification doc §6.

1. **Clipped Declare disc** (first flagged, from a `/journey` screenshot): the raised gold circle
   was lifted `margin-top:-14px` above the tab row but `DeclareLayout.astro`'s mobile `.tabbar`
   override only gave it `padding-top:10px` (8px short of what `declare.css`'s own base rule
   already provided at `18px`) — the disc's top rendered past the bar's edge, sliced by that
   override's `border-top` line. Pre-existing, not introduced by B3.2.
2. **Full redesign** (from a side-by-side comparison with the Open app): removed the raised disc
   entirely — Declare's icon is now the same size/weight as the other four tabs, no circle, no
   glow. Labels now show only on the active tab (present in the DOM/accessible name either way,
   just visually hidden when inactive — so icon position never shifts). The active-tab gold dot,
   previously excluded from Declare, now applies uniformly to all five. Found and removed a dead
   `m-orb-breath` keyframe animation in `motion.css` that was still pulsing a glow onto the disc
   after the static styles were changed. Softened the bar's background from a solid frosted panel
   with a hard top border to a soft gradient fade, closer to Open's restraint.

Verified live across all five Declare pages, both themes, 390×844 — no console errors, no effect
on the desktop/tablet `sidebar.css` left-rail (separate treatment, untouched).

## Additional work: distinct per-day Day-Opening backgrounds

The approved B2.2 mockup called for 5 distinct per-day photos; only one shared image had actually
shipped (explicitly deferred in the B3 spec as a future task). Built now, per Jeff's direction:
5 new images (`public/declare/journey-bg-day1.jpg`–`day5.jpg`, nano-banana, styled off
`tree-alive.jpg`) forming one heavy-to-golden mood arc across the 5 days, keyed by day position
(not by struggle, so the same 5 images serve all ~29 struggle journeys — a deliberate scope choice
over building per-struggle/dynamic Convex-backed generation, discussed and confirmed with Jeff).
Generated at 2K, resized/recompressed to 1100px-wide JPEGs (88–194KB each) to match the original
asset's footprint rather than shipping raw 1.6–2.4MB files to mobile users. `renderDayOpening()`
sets a `--jo-bg-img` CSS variable per day; `.jo-card` reads it with a same-family fallback.
`public/declare/dayopen-bg.jpg` (the old shared image) is now unreferenced but left in place,
flagged for Jeff's call rather than deleted.

## Additional work: design-doc vs. implementation audit

Per Jeff's request, compared every claim in `docs/design/`, `docs/implementation/`, and
`docs/verification/` against the real code. One substantial real gap found: Step 6's approved
Vault-save + "Gentle Guidance" AI model was never built — expected, since it's the already-planned
B3.3 milestone, not a surprise. Two more items were correctly, explicitly deferred by their own
docs (per-struggle background art at full scale; a Scripture Follow-Through breadcrumb). Everything
else audited (B1 through the accessibility-polish pass) was confirmed actually shipped. Full detail
in the verification doc §8.

## Explicitly out of scope (unchanged in this milestone)

Step 6 draft/Vault persistence, Gentle Guidance, AI consent, AI Worker changes, Vault schema,
Convex changes, reflection crisis-text analysis, Scripture-reader follow-through, and personalized
per-day background art. Step 6's textarea keeps its existing inert (no autosave, no save target)
behavior; that work is B3.3.
