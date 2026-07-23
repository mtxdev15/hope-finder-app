# Release B — Journey Redesign Implementation Summary

*Branch: `redesign/journey-experience` intent (work performed on the current checkout; not
committed, per B1's scope). Governed by
`docs/prompts/RELEASE_B_JOURNEY_REDESIGN_CLAUDE_PROMPT.md`. Each milestone gets its own section,
appended as approved and completed. Nothing in this document implies a milestone beyond what's
listed below has been started.*

---

## B1 — Journey Overview Redesign (2026-07-23)

### Goal

Make `/journey` immediately answer "Who are you becoming?" — reordering and restyling the existing
overview (zero-state, Active Journey card, Fruit log, Past Journeys) to the Release A dark forest
sanctuary visual language, without becoming a dashboard, and without any data-flow, storage, engine,
or prompt changes.

### Files changed

**`src/pages/journey.astro` only** — no other file touched. `git diff --stat`:
```
src/pages/journey.astro | 49 +++++++++++++++++++++++++++++++++++++++++++------
1 file changed, 43 insertions(+), 6 deletions(-)
```
(`TODO.md` also shows modified in `git status` — that is the pre-existing, unrelated edit from
before this session; not touched here.)

### Exact markup/wrappers/classes added

- **Header hierarchy swap** (lines 18-22): the eyebrow/H1 relationship was inverted to match the
  approved reading order. What was `<h1>Your Journey</h1>` is now a small uppercase eyebrow
  (`.jhead-ey`, reusing the same visual pattern as the card's own `.ey` eyebrow elsewhere on the
  page); what was the `.sub` line ("Who are you becoming?") is now the real `<h1>`; a new third line
  (`.sub`, new `data-i18n="journey.overviewSub"` key) adds the short supporting sentence "God meets
  you in the everyday and grows something eternal." No element gained or lost an `id`; nothing here
  is referenced by `getElementById` anywhere in the script, confirmed by search before editing.
- **Fruit section heading text** (line 91): the existing `.fl-h` element's English fallback changed
  from "Fruit so far" to "Fruit God Is Growing," per the approved reading order. Same `data-i18n` key
  (`journey.fruitSoFar`) — only the English fallback string changed.
- **Fruit-log item restructure** (`renderFruitLog()`, ~line 474): the existing `.fl-item` button
  keeps its class, `data-day` attribute, and `aria-label` exactly as before (the delegated click
  handler on `#fruitList` targets `.fl-item[data-day]` and needed no change). Internally, the old
  single `.dy` line ("Day N · fruitTruth") was split into two new classes: `.fl-top` (fruit name +
  a small `.fl-day` "Day N" tag) and `.fl-truth` (the full authored `fruitTruth` sentence on its own
  line) — matching the approved "Peace / His peace guards your heart" qualitative pairing. The old
  `.fl-meta .dy` CSS rule was left in place (now unused, harmless) rather than deleted, since nothing
  in scope asked for a cleanup pass.
- **Past Journeys — new `pastFruitSummary(id)` helper function** (added just above `renderGrid()`):
  a pure, read-only function that reads the existing, already-present (not newly written)
  `db_journey_inst:<id>` cache left behind after a Journey completes (confirmed in the audit that
  `showJourneyComplete()` does not clear this cache — only starting a *new* Journey for that same
  struggle does). If present, it returns the final day's real authored `{fruit, fruitTruth}`; if
  absent (already cleared by a later restart), it returns `null` — never invented. `renderGrid()`
  now calls this once per completed-Journey cell and, only when non-null, appends a new
  `.cell-fruit` line showing that real summary. No date is shown or computed anywhere, per your
  explicit instruction.
- **Desktop two-column layout** (new `@media (min-width: 1024px)` block, ~15 lines of CSS): the
  existing `.jcard` children (`.jc-top`, `.today`, `.jc-foot`, `.vinewrap`, `.jc-actions`,
  `.lock-note`) are placed via CSS Grid `grid-column`/`grid-row` so the Vine sits beside the copy at
  desktop widths — **zero markup changes**, purely a CSS placement rule on elements that already
  exist with their ids/classes untouched. At tablet (768px) and mobile (390px), no new rule applies,
  so the existing single-column stacked order is completely unchanged.
- **Touch targets**: measured, not modified — every existing/restyled interactive element in this
  milestone (`#continueBtn`, `#viewTreeBtn`, `#seeAll`, `.fl-item`, `.cell`) already measures ≥44px
  at mobile width; no CSS change was needed for those. See "Known limitations" for the one thing
  intentionally *not* changed.

### Behavior preserved

- Every ID listed in your approved boundaries (`#zeroState`, `#activeCard`, `#fromW`, `#toW`,
  `#habitW`, `#dayPill`, `#vineMount`, `#dayDots`, `#remainTxt`, `#todayTitle`, `#todayRef`,
  `#focusLine`, `#continueBtn`, `#viewTreeBtn`, `#lockNote` and children, `#fruitLog`, `#fruitList`,
  `#returnDays`, `#seeAll`, `#alljSection`, `#doneCount`, `#jgrid`, `#viewer` and children) — confirmed
  present, unrenamed, in the final file.
- `renderHome()`, `buildVine()`, `renderFruitLog()`, `renderGrid()`, `renderLockNote()` — all still
  run against the restyled markup with no errors (verified live, not just by inspection).
- `db_active_journey`, `db_journeys_done`, and the `TheVine.build(...) -> {setProgress}` contract —
  untouched.
- Zero data-flow, `localStorage` shape, Convex, Journey-engine, or prompt change of any kind.

### Behavior added

- The Past Journeys "remembrance card" now shows a real fruit/truth line when that Journey's cached
  content is still available (see above) — a genuinely new, but purely additive and read-only,
  presentational behavior.

### Screenshots

All in `docs/verification/screenshots/release-b-b1/`:
- `b1-desktop-01-active-day1.png` — active Day 1, desktop two-column layout
- `b1-desktop-02-past-journeys.png` — empty Past Journeys state (0 rooted)
- `b1-desktop-03-locked-fruitlog.png` — locked Day 2 + new "Fruit God Is Growing" section
- `b1-desktop-05-past-with-fruit-viewport.png` — Past Journeys with the new real fruit-summary line
- `b1-desktop-06-zerostate.png` — fresh zero-state with the new header hierarchy
- `b1-tablet-01-active-unlocked-day2.png`, `b1-tablet-02-actions-fruitlog.png` — 768px, single column
- `b1-mobile-01-active.png`, `b1-mobile-02-actions.png` — 390px, single column, text-then-Vine order

### Accessibility

- No heading-order regression: `.jhead`'s new `<h1>` is still the page's only top-level heading in
  this section; the eyebrow and supporting line are non-heading `<div>`s, matching the pattern
  already used elsewhere on this page (e.g. the Active Journey card's own `.ey` eyebrow).
- All touch targets measured in this milestone's scope are ≥44px (see above).
- Keyboard tab order through the redesigned overview is logical: day-dots → Continue Day N → View
  Vine → fruit-log items → Past Journeys toggle — unchanged from before, since no tabindex/focus
  logic was touched.
- Reduced motion: confirmed unaffected — the existing global `.rise` animation suppression under
  `prefers-reduced-motion: reduce` still applies to the redesigned card with no new animation
  introduced by this milestone.

### Storage changes

None. `pastFruitSummary()` only *reads* an existing, already-written key; nothing is written, no key
is renamed, no shape changes.

### Known limitations

- **Day-dots (`.dots i.tap`) remain under the 44px touch-target floor** (visually ~16×5px by
  design, a progress-indicator metaphor, not a primary button). I evaluated adding an invisible
  pseudo-element hit-area expansion (the pattern used for Release A's chips/tabs) and rejected it:
  with only 5px gaps between five tightly-packed dots, a 44×44px invisible zone per dot would
  overlap both its neighbors and the `.vinewrap`/`.today` content above and below — exactly the
  "overlapping hit areas" your instructions warned against. The Fruit Log's `.fl-item` buttons
  already provide a fully-compliant (≥44px), unambiguous way to revisit a completed day, so this
  isn't the only path to that action. Flagging as a real, pre-existing (not introduced by B1) gap
  worth a dedicated look later, not something I attempted a risky fix for here.
- **Spanish copy not updated for the two new/changed English fallback strings** (`journey.fruitSoFar`
  → "Fruit God Is Growing," and the new `journey.overviewSub` key) — the Spanish string mapping
  lives in `public/declare/i18n-journey-es.js`, outside this milestone's approved single-file scope
  (`src/pages/journey.astro` only). Spanish-language users will see the old/English fallback text
  for these two specific lines until that file is updated in a follow-up.
- **Other Journey sheets (menu, "begin a different journey," share) may share the same
  hidden-but-keyboard-tabbable pattern found and fixed in Release A's Rate & Review modal** —
  observed during the keyboard tab-order check for this milestone (Tab continued from the Past
  Journeys toggle into `#mSaved`/`#mSwitch`/`#resetGo` etc., which are presumably closed sheets).
  This is a page-wide, pre-existing concern unrelated to the overview redesign itself and outside
  B1's approved scope — not fixed here, flagged for a dedicated pass.
- Per your explicit instruction, no completion date is shown or computed for Past Journeys, and none
  was added to any data structure.

### Rollback

Single file, uncommitted: `git checkout -- src/pages/journey.astro` fully reverts B1 with no data
migration (nothing was written to any storage shape).

---

## B1 Closeout — day-dot touch target + Spanish parity (2026-07-23)

### Goal

Resolve the two limitations the original B1 pass explicitly documented and deferred: the
completed-day dots sitting under the 44px touch-target floor, and two B1-introduced/changed English
strings having no Spanish translation.

### Files changed

**`src/pages/journey.astro`** and **`public/declare/i18n-strings.js`** only — exactly the two files
approved. `TODO.md` remains its pre-existing, unrelated edit.

```
public/declare/i18n-strings.js |  3 ++-
src/pages/journey.astro        | 67 ++++++++++++++++++++++++++++++++++++++----
```

### Exact changes

**Day-dot touch target** (`journey.astro`, `.journey .dots` rules):
- Widened `.dots{gap:5px}` → `gap:28px`. This guarantees ≥44px center-to-center pitch between any
  two adjacent dots (measured worst case: two adjacent 16px `.tap` dots land exactly on a 44px
  pitch; a `.tap` dot beside the wider 22px `.cur` dot lands at 47px — both non-overlapping).
- Added `position: relative` to `.dots i.tap` only (the positioning context for the new
  pseudo-element), and a new `.dots i.tap::before` rule: `content:''; position:absolute; top:50%;
  left:50%; width:44px; height:44px; transform:translate(-50%,-50%);` — an invisible, centered
  44×44px hit zone added *only* to completed/interactive dots. Current (`.cur`) and future
  (plain) dots received no pseudo-element and remain exactly as non-interactive as before.
- No JS changes were needed or made — the existing `renderHome()`-generated markup (`class`,
  `data-day`, `role="button"`, `tabindex="0"`, `aria-label`) and the existing delegated click/keydown
  handlers on `#dayDots` were untouched and did not need to be.
- **A real, honest side-effect found during verification, fixed within scope:** the widened dots
  row (121px → 198px) caused the "N fruit so far" / "Just planted" text to wrap mid-word
  specifically inside the ≥1024px two-column desktop layout, where the copy column (narrowed by the
  300px Vine column) is actually the *tightest* of all three viewports — tighter than mobile.
  Fixed by adding two lines to the existing `@media (min-width: 1024px)` block: `.jc-foot` switches
  to `flex-direction: column` there (dots on their own line, the remain-text below), and `.remain`
  drops to 11.5px. This is the "adjust the footer layout responsively" fix, not a hit-area reduction
  — confirmed the dots' pseudo-elements are completely unaffected by this change (they're
  `position:absolute`, out of flow, so a flex-direction change on their container doesn't resize
  them). Tablet and mobile were unaffected before *and* after this fix (single line, no wrap, no
  overflow, confirmed both ways).

**Spanish parity** (`i18n-strings.js`):
- `journey.fruitSoFar` (line 318) updated from `'Fruto hasta ahora'` to `'El fruto que Dios está
  haciendo crecer'` — matching B1's English change to "Fruit God Is Growing."
- `journey.overviewSub` added (new key) — `'Dios te encuentra en lo cotidiano y hace crecer algo
  eterno.'` — matching the new English supporting line B1 introduced.
- Confirmed both `journey.hTitle` ("YOUR JOURNEY" eyebrow) and `journey.becoming` ("Who are you
  becoming?" H1) already had correct, working Spanish keys before this pass — verified directly, no
  change needed, nothing was hardcoded.
- No Spanish text was ever hardcoded into `journey.astro` — both keys go through the existing
  `data-i18n` / `window.__I18N_STRINGS.es` mechanism already used by every other string on this page.

### Behavior preserved

Confirmed via live, real (not just programmatic) interaction: click-to-revisit, keyboard Tab
reachability, Enter-to-activate, all five `data-day`/`role`/`tabindex`/`aria-label` attributes,
the `.viewing`/`.cur`/`.done` visual states, and the existing single delegated click/keydown
listener on `#dayDots` (no new listeners added).

### Known limitations

None remaining for these two specific items. (The separate, pre-existing observation from the
original B1 pass — that other Journey sheets may share Release A's earlier hidden-modal-focusability
pattern — remains open and out of scope, unrelated to day-dots or these two translation keys.)

### Rollback

```
git checkout -- src/pages/journey.astro public/declare/i18n-strings.js
```
No data migration needed — both changes are presentation/copy only.

---

## B1 Visual Alignment — mockup-driven patch (2026-07-23)

### Goal

Bring the already-shipped B1 Journey Overview into visual alignment with a new reference mockup you
shared, per your fully-specified 20-item approved list: larger H1, wider desktop composition, a
unified horizontal Active Journey card (copy / in-card fruit preview / cropped Vine), relocated Day
pill, a "TODAY'S JOURNEY" eyebrow, decorative icons on both card buttons, a real section heading +
responsive card grid for "Fruit God Is Growing," and horizontal Past Journeys cells — all without
touching the sidebar/account card (deferred to B1.5), the engine, storage, or any protected file.

### Files changed

**`src/pages/journey.astro`** and **`public/declare/i18n-strings.js`** only.
```
public/declare/i18n-strings.js |   4 +-
src/pages/journey.astro        | 250 +++++++++++++++++++++++++++++++----------
2 files changed, 193 insertions(+), 61 deletions(-)
```
(`TODO.md` remains its pre-existing, unrelated edit.)

### Exact changes

- **Header**: `.sub` copy updated to "God is meeting you in the everyday and growing something
  eternal." (same `journey.overviewSub` key); desktop `.jhead h1` raised to 54px inside a widened
  1180px column (was 680px/44px, shared with the header-only tablet block).
- **`#activeCard` restructure**: new `.jc-grid` wrapper around three zones — `.jc-copy` (all existing
  copy/actions/footer, unchanged IDs), a new `.jc-fruit-preview` (real data only, see Fruit rules
  below), and the existing `.vinewrap`. On desktop this becomes a 3-column CSS Grid
  (`minmax(0,1fr) auto 320px`); at tablet/mobile widths `.jc-grid` has no grid rule at all, so the
  three zones simply stack in DOM order (copy → fruit preview → Vine) exactly as the responsive spec
  required.
- **Unified From → To heading**: `.jc-shift` dropped the old asymmetric muted/underlined treatment —
  both segments now render the same weight and color, joined by a gold arrow.
- **Day pill**: moved to sit directly beneath the transformation copy (was in the footer row);
  text now reads "Day N of 5" (`' of '`/`' de '` per language) instead of "N / 5"; kept the same gold
  chip styling.
- **"TODAY'S JOURNEY" eyebrow**: new `.today-ey` element, new i18n key `journey.todayJourney`
  ("El camino de hoy" in Spanish — checked first, confirmed no existing key covered this).
- **Decorative icons**: `#continueBtn` gets a CSS `::after { content: '\2192' }` arrow (not a real
  `<svg>`, since `renderHome()` reassigns this button's `textContent` and would silently wipe a real
  child element — confirmed by grep before choosing this approach); `#viewTreeBtn` gets a real inline
  leaf `<svg>` (confirmed safe — this button's label is never `textContent`-reassigned anywhere).
- **Vine compact-card crop**: `#activeCard`'s Vine instance only gets `aspect-ratio: 4/5` and an
  adjusted `object-position` at desktop widths, and its `.vine-lab`/`.vine-root` captions are hidden
  — scoped entirely to `#activeCard .vinewrap`/`.tree-mount`, so every other `TheVine.build()` call
  site (day-complete overlay, journey-complete overlay, the full-screen viewer) is completely
  unaffected. `the-vine.js` itself was never opened for editing. Verified live: the full viewer still
  shows both the "Shame & Guilt" / "Beloved of God" captions and the "Jesus, the Vine — John 15:5"
  caption exactly as before.
- **New in-card fruit preview** (`renderFruitPreview()`): reads `PLAN[completed()-1]` — the most
  recently completed real day's authored `{fruit, fruitTruth}` — never the in-progress day, never
  fabricated. Hidden via inline `display:none` until `completed() > 0`.
- **"Fruit God Is Growing" section**: `.fl-h` restyled into a real section heading (19px Cormorant,
  not a 10px eyebrow) with a leaf-icon prefix (`data-i18n` moved from the wrapping `<div>` onto an
  inner `<span>` so the icon survives i18n's `textContent` swap — the same risk/fix pattern as the
  Continue button, caught by re-checking `i18n.js`'s `swapText()` before editing); `.fl-list` is now
  a responsive CSS Grid (1 column mobile, 2 columns ≥640px, 3 columns ≥1024px); each `.fl-item`
  became its own bordered/background card with a `.fl-ic` icon-circle (matching `.fp-ic`'s existing
  treatment) replacing the old borderless-row + chevron design.
- **Past Journeys `.cell` restructure**: internal layout changed from a vertical stack with an
  absolutely-positioned badge to a horizontal flex row — icon circle (`.cell-ic`) left, name/fruit
  summary (`.cell-body`) center, "Rooted" badge (`.st`) right. The outer `.jgrid{grid-template-
  columns:1fr 1fr}` 2-column grid is completely untouched, confirmed still exactly 2 columns at
  desktop, tablet, and mobile widths (matches your explicit "preserve exactly" instruction).
- **i18n**: added `journey.todayJourney` and updated `journey.overviewSub`'s Spanish value to "Dios
  te encuentra en lo cotidiano y está haciendo crecer algo eterno." — both went through the existing
  `data-i18n` / `window.__I18N_STRINGS.es` mechanism; no Spanish text was hardcoded into the page.

### A real bug found and fixed during implementation (not assumed away)

Two independent CSS cascade issues surfaced only once real browser verification began — both fixed
within this same pass, same two approved files:

1. **`.jhead`/`.scroll` max-width was being silently overridden.** A pre-existing, unrelated
   `@media (min-width: 481px)` block near the end of the stylesheet also sets `.jhead`/`.scroll`
   max-width (680px, for the tablet-and-up single-column shell). Since both that block and my new
   `@media (min-width: 1024px)` block match at desktop widths and carry equal selector specificity,
   the one later in source order wins — and my new block was positioned *earlier* in the file, so
   the old 680px cap was winning at 1440px, collapsing the whole desktop composition into a
   phone-width column. Fixed by moving the entire desktop block to the very end of the stylesheet
   (documented in a comment at its new location) so it reliably wins the cascade.
2. **CSS Grid auto-placement bug**: `.jc-fruit-preview` is `display:none` until real fruit exists,
   which removes it from the grid's item list entirely (a `display:none` element generates no box).
   With only two real grid items (`.jc-copy`, `.vinewrap`) against three defined columns, browser
   auto-placement filled columns left-to-right — meaning `.vinewrap` slid into the middle ("auto")
   track instead of the intended 320px track, and ballooned to the tree image's full intrinsic width,
   overlapping the copy column (which was squeezed to 0 by the `minmax(0,1fr)` track). Fixed with
   explicit `grid-column` placement on all three zones (`.jc-copy` → 1, `.jc-fruit-preview` → 2,
   `.vinewrap` → 3) so the layout is correct regardless of which zones are present. Caught by
   comparing a live `getComputedStyle().gridTemplateColumns` reading against what was expected, not
   by assuming the CSS was correct because it looked right on paper.

Both are documented here rather than silently folded in, per your standing instruction to surface
real problems found during verification.

### Fruit rules (confirmed)

- Preview and section both read only real, completed-day data (`PLAN[n-1]` / `pastFruitSummary()`);
  neither shows the in-progress day nor invents a fallback when cached content is missing.
- Verified live: a completed Day 1 with no Day 2 progress shows exactly one fruit in both the preview
  and the section; a locked Day 2 state does not show Day 2's fruit (it doesn't exist yet).

### Vine rules (confirmed)

CSS crop/framing and caption-hiding only, scoped to `#activeCard`; `the-vine.js` untouched; no new
image assets; `TheVine.build()`/`setProgress()` contract untouched; full-viewer captions confirmed
still present.

### Screenshots

All in `docs/verification/screenshots/release-b-b1-visual-alignment/`:
- `b1va-desktop-01-zerostate.png` — fresh zero-state, new H1 scale
- `b1va-desktop-02-active-day1.png` — active Day 1, no fruit yet, correct desktop 3-zone grid
- `b1va-desktop-03-day1-complete-overlay.png` — real day-complete overlay (unmodified, for context)
- `b1va-desktop-04-locked-with-fruit.png` — locked Day 2 + in-card fruit preview
- `b1va-desktop-05-fruitlog-pastjourneys.png` — restyled Fruit section + collapsed Past Journeys
- `b1va-desktop-06-pastjourneys-populated.png`, `b1va-desktop-07-pastjourneys-2col.png` — 1 and 2
  rooted journeys, confirming the preserved 2-column grid with the new horizontal cell layout
- `b1va-desktop-08-spanish.png` — full Spanish rendering including both new/changed keys
- `b1va-desktop-09-full-vine-viewer.png` — full-screen Vine viewer, captions confirmed intact
- `b1va-tablet-01-active-with-fruit.png`, `b1va-tablet-02-fruit-past.png`,
  `b1va-tablet-03-past-populated.png` — 768px, single-column card, 2-column fruit/Past Journeys grids
- `b1va-mobile-01-active.png` through `b1va-mobile-04-past-populated.png` — 390px, full stacked
  order, no horizontal overflow, bottom nav unobstructed

### Known limitations (carried forward, not introduced by this pass)

- **`.cell` (Past Journeys entries) are still plain, non-interactive `<div>`s** — clickable by mouse
  only, no `tabindex`, confirmed via a real keyboard Tab sweep (Tab skips from the "Past journeys"
  toggle straight to the next section, never landing on a `.cell`). This predates this pass — I only
  restructured the internal markup (icon/body/badge), not the element's interactivity model, since
  changing that was outside the approved 20-item list. Worth a dedicated accessibility pass later.
- Everything else from the original B1 and B1 Closeout "Known limitations" sections still applies
  unchanged (day-dots' deliberately-not-44px visual size with an invisible hit-area expansion; other
  Journey sheets' shared hidden-modal-focusability pattern).

### Rollback

```
git checkout -- src/pages/journey.astro public/declare/i18n-strings.js
```
No data migration needed — presentation/copy only.

**Stopping here per instruction — not beginning B1.5 (sidebar/account card) or B2.**
