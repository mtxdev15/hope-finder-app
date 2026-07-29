# Release B — B2.2 Day-Opening Screen: Implementation Summary

*Local dev only (Astro dev server). Not staged, not committed, not pushed, not merged, not deployed.*

---

## Goal

Insert a quiet "Day-Opening" screen between committing to a journey (or tapping Continue) and the
seven-step daily flow — Day N of 5, theme title, key Scripture, a short encouragement, one primary CTA
("Begin Today's Journey"), one secondary action ("View Journey Overview"), and a close control —
responsive across mobile (full-screen), tablet (centered dialog card), and desktop (centered modal over
a dimmed/blurred backdrop).

## Files changed

```
src/pages/journey.astro         | 262 ++++++++++++++++++++++++++++++++++++---
src/components/TabBar.astro     |   4 +-
public/declare/declare.css      |  16 ++-
public/declare/sidebar.css      |   1 -
public/declare/i18n-strings.js  |   4 +
public/declare/dayopen-bg.jpg   | new file (generated asset)
TODO.md                         | new entries only (pre-existing unrelated diff untouched)
```

## B2.2 core feature — journey.astro

- New `#dayOpen` overlay markup, inserted between `#journeyPreview` and `#dayflow`.
- `openDayOpening(sourceEl)` / `renderDayOpening()` / `closeDayOpening()` / `dayOpenKeydown()` — reads
  straight from `PLAN[state.day-1]` (same data `renderHome()`'s "Today's Journey" card and B2.1's
  Preview already use), writes nothing to storage.
- Rewired the 3 live call sites that previously called `openDayFlow()` directly to call
  `openDayOpening()` instead: `continueBtn` click, the B2.1 `jpBegin` "Begin Day 1" commit handler, and
  the Today-bridge same-struggle continue in `init()`. `openDayFlow()` itself is unmodified.
  `openReview()` (completed-day review) was never touched and still bypasses this screen entirely.
- Preserves the existing lock check (`isLocked()`) and Day 2+ sign-in gate exactly — both live inside
  the untouched `openDayFlow()`, called after "Begin Today's Journey".
- Focus management: focus moves to the heading on open (deferred via `setTimeout(60)`, matching
  `auth-modal.js`'s own timing for this same opacity/visibility transition shape — see Known issues
  found and fixed below), a lightweight Tab/Shift+Tab trap cycles the 3 real controls, Escape closes,
  focus restores to the triggering element (or a computed fallback) on close.
- i18n: two new keys (`journey.dayOpenBegin`, `journey.dayOpenOverview`) added to
  `public/declare/i18n-strings.js`'s Spanish map, plus a `declare-lang` listener that re-renders the
  screen's dynamic content on a live language switch.

## Visual direction — a real deviation from the attached mockups, now resolved

Initial implementation used a solid dark-forest-gradient background (the mockup's "Alternate –
Minimal" variant) instead of the photographic forest backgrounds shown in most of the mockups. This was
a deliberate choice at the time to satisfy the redesign brief's explicit instruction — *"Do not use
mountain-wellness photography... if imagery is used, it should match the existing Vine and forest
visual language"* — since the mockup's Day 4 background is literal mountain photography. This
divergence was **not surfaced to Jeff before building**, which was a real miss; Jeff caught it by
comparing screenshots to the original mockup sheet.

Resolved: Jeff chose "match the mockups with photography." Generated a new background image
(`public/declare/dayopen-bg.jpg`, via the `nano-banana:generate` skill, Nano Banana 2 model,
`public/declare/tree-alive.jpg` used as the style/color reference) — dark forest interior, soft gold
god-ray sunbeams, warm bokeh, painterly quality matching the existing Vine imagery's own art style
rather than stock photography. First generation attempt hallucinated garbled fake text baked into the
image and was discarded; regenerated with explicit anti-text constraints.

`.jo-card`'s background is now `linear-gradient(dark scrim) , url(dayopen-bg.jpg) center top / cover`,
with the scrim guaranteeing text contrast regardless of the photo underneath (per the task's own
accessibility requirement: *"Do not rely on decorative background imagery for text readability"*). This
screen intentionally keeps the same dark-forest mood in **both** site themes rather than following the
light/dark toggle (matches the mockups, which only show one mood) — all `.jo-*` text/icon colors were
correspondingly changed from `var(--text)`/`var(--goldd)` (theme-relative, would have gone dark-on-dark
in light theme) to fixed dark-theme hex values.

## Issues found live during QA and fixed (all pre-existing, none introduced by this milestone's core
feature, all confirmed via direct diagnosis before touching anything)

1. **Dark shadow bleeding through the Day-Opening overlay** (worst in light theme). Root cause:
   pre-existing bottom sheets (`.sheet`/`.care-sheet` — menu, reset, choose-struggle, share, care-gate)
   sit just off-screen at the bottom even when closed, with an upward-cast
   `box-shadow: 0 -24px 60px rgba(0,0,0,.7)` at `z-index: 70` — higher than the new overlay's original
   `z-index: 57`. Fixed by raising `.dayopen` to `z-index: 75` (above every existing overlay in this
   file except nothing — it's now the topmost, matching how the account modal is `z-index: 95` above
   everything sitewide).
2. **Same shadow, on the plain (non-Day-Opening) `/journey` page**, bleeding above the mobile tab bar on
   every page load, every user, already live in production. Same root cause, different symptom: the
   `box-shadow` was on the base `.sheet` rule (always active, even closed) instead of `.sheet.open`.
   Fixed by moving the box-shadow to only apply when a sheet is actually open.
3. **Tab bar "notch" line reads as a stray, disconnected line.** The bottom nav's `<svg class="arc">`
   (a decorative stroked curve meant to suggest a notch cradling the raised gold "Declare" disc) sits on
   top of an otherwise flat-rectangle panel — the panel doesn't actually change shape, so the curve and
   the panel's own straight top edge both show, reading as a stray line. Removed the arc entirely
   (`TabBar.astro` + its CSS in `declare.css` + the now-dead `.arc` hide rule in `sidebar.css`), added a
   soft upward `box-shadow` on `.tabbar` (mobile only) instead — flat top, soft lift, no notch.
4. **Tab bar polish** (explicitly requested): more opaque bar background (26% → 48% solid before the
   fade), a quiet 4px active-tab dot indicator (excluded from the center "Declare" disc, which already
   has its own on/off treatment; automatically hidden at the ≥768px rail by an existing generic reset),
   and consistent icon stroke-width (Journey's icon was 1.5 vs. everyone else's 1.7).
5. **Active Journey card text crushed to ~74px width at 1024×768** (a required B2.2 test viewport). The
   3-column grid (`minmax(0,1fr) auto 320px`) gives the primary text column no floor — the two fixed
   side columns (220px fruit-preview + 320px Vine) ate nearly all the width once the sidebar takes its
   full 248px at exactly 1024px. Fixed by raising the 3-column grid's breakpoint from 1024px to 1280px;
   below that it now falls back to the same plain stacked layout it already safely used below 1024px.
6. **Vine image rendered comically oversized in that same stacked-fallback range** (481–1279px) once
   the grid no longer applied — `.vinewrap` never had an independent width cap outside the ≥1280px grid
   column. Capped it at `max-width: 420px`, centered.
7. **Day-Opening content could overlap its own close button and CTA** when content grows (200% zoom, or
   simply a longer verse) — `justify-content: center` on the scrollable content column let overflow
   spill both up (into the absolutely-positioned close button) and down (into the actions bar below)
   instead of scrolling. Changed to `justify-content: safe center` — centers when it fits, behaves like
   `flex-start` (scrolls cleanly from the top) when it doesn't.
8. **Focus never actually entered the dialog on open** (a real bug, not a test artifact): calling
   `.focus()` on the heading in the same synchronous tick as `classList.add('open')` silently failed in
   Chromium for this opacity/visibility-transition overlay shape. Deferred via `setTimeout(60)`,
   matching `auth-modal.js`'s own already-proven timing for the identical overlay pattern.

## Defect count clarification (from the final review pass)

The list above bundles several distinct fixes under one numbered item. Counted precisely, this work
included **9 real defects fixed** (7 from the original QA pass + 2 found during independent final
review) and **3 explicitly-requested polish changes** (not defects) bundled into item 4:

Defects: (1) Day-Opening shadow bleed, (2) plain-page shadow bleed, (3) tab bar notch line, (5) Active
Journey card text crush at 1024×768, (6) Vine oversized 481–1279px, (7) 200% zoom overlap, (8) focus
not entering dialog, plus two more found during the independent final review below (touch target,
image weight). Polish (item 4, not defects): tab bar opacity, active-tab dot, icon stroke-width.

## Final review pass — two additional real issues found and fixed

Performed independently, re-inspecting the actual git diff and re-testing live rather than trusting
this document's own claims (per instruction). Two additional, real defects were found and fixed, on
top of confirming the original 8 items above:

9. **Close button touch target was 40×40px**, below the required 44×44px minimum (`.jo-close` in
   `journey.astro`). Fixed to 44×44px. Verified via `getBoundingClientRect()` before and after; no
   visual crowding at any tested viewport.
10. **`dayopen-bg.jpg` was 2.3 MB (1536×2752)** — roughly 6× the size of the comparable existing Vine
    assets (`tree-alive.jpg`: 396 KB, 1120×1500) — and confirmed via
    `performance.getEntriesByType('resource')` to load **unconditionally on every `/journey` page visit**
    (including the zero-state, where Day-Opening never shows), since a CSS `background-image` on a
    `visibility:hidden`-but-rendered element is fetched eagerly by the browser regardless of whether the
    overlay ever opens. Resolved by resizing to 1100×1970 (no CSS layout ever renders this card wider
    than ~576px, so this comfortably covers retina) and re-encoding at JPEG quality 78 — **213 KB**, a
    ~91% reduction, with no visible quality loss at any tested viewport (screenshots compared side by
    side at 1440px). Same image content, not regenerated.

Also independently re-verified (no new issues): all 5 days render distinct real content with matching
progress dots (one earlier `TypeError` in `renderDayOpening()` was investigated and traced to a test-
harness race condition — clicking `#continueBtn` before Astro's `whenSynced().then(init)` chain
resolved on a fresh navigation in a tight loop — not reachable via real interaction, since the button
does not exist in the DOM until `init()` has already set `PLAN`); browser Back (no history entries are
pushed by this feature, matches every other overlay in the file); refresh (no state corruption, no
auto-reopen); the sensitive-struggle sequence with a second struggle (`grief`, distinct from the
original QA pass's `addiction`); completed-day review bypass with progress unchanged; the tab bar
changes on two other pages (`/word`, `/you`) in both themes, confirming no regression outside Journey.

**"Larger text" note:** tested via `document.documentElement.style.fontSize` override, which had no
effect — expected, since this screen's typography (like the rest of this file, and the rest of the
app) uses fixed `px` values throughout, not `rem`/`em`. This is a sitewide, pre-existing typographic
pattern, not a B2.2-specific gap, and converting it is out of this milestone's scope. The functional
equivalent users actually rely on — browser/OS page zoom — was tested properly (200% zoom) and confirmed
working after the `safe center` fix.

## Deferred, not fixed here (logged to `TODO.md` instead)

- `#lnPreview` "Preview tomorrow" button lets any user skip the pacing lock in production — flagged as
  intentionally dev-only in the original brief, never actually gated. Pre-existing.
- Step 6 "Reflect" textarea is never persisted or restored — an explicit original B3 requirement that
  appears to have never been built. Pre-existing.
- Mast avatar icon (top-right, sitewide, `DeclareLayout.astro`) possibly duplicates the bottom "You" tab
  — Jeff's design question, needs its own investigation (what it currently links to on each page) before
  a removal decision. Sitewide, not Journey-specific.
- Journey day content (title/verse/encouragement) can stay in English when Spanish is active, if the
  Journey Worker's AI call hasn't completed — confirmed identical, pre-existing behavior on the
  untouched "Today's Journey" home card, not something this milestone introduced. Root cause is in
  `journey-engine.js`/the Worker, both explicitly protected from changes without separate approval in
  the original Release B brief.

## Rollback

```
git checkout -- src/pages/journey.astro src/components/TabBar.astro public/declare/declare.css public/declare/sidebar.css public/declare/i18n-strings.js
rm public/declare/dayopen-bg.jpg
```
`TODO.md` changes (new entries only) can be kept or reverted independently — they're notes, not code.
No data/schema change, no new storage key.

---

**B2.2 implementation and QA complete. Nothing staged, committed, pushed, merged, or deployed —
awaiting explicit review and approval per instruction.**
