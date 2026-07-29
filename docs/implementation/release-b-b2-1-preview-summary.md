# Release B — B2.1 Journey Preview: Implementation Summary

*Local dev only (Convex deployment `good-dotterel-906`). Not staged, not committed, not pushed, not
merged, not deployed.*

---

## Goal

Insert a real "Journey Preview" moment between a struggle being picked and a journey actually
starting — a side-effect-free, read-only look at the real 5-day plan (Day 1 emphasized, Days 2-5
shown but locked) with a "Begin Day 1" commit action and a contextual secondary action — while
reusing the existing struggle-specific care gate unmodified, and without touching the seven-step
daily flow, the Journey engine, or any AI/Convex/routing surface.

## Files changed

```
public/declare/i18n-strings.js |  13 ++
src/pages/journey.astro        | 305 ++++++++++++++++++++++++++++++++++++++---
2 files changed, 318 insertions(+), 17 deletions(-)
```
No other file touched — confirmed by `git diff --name-only` (only these two, plus the pre-existing,
unrelated `TODO.md` modification).

## Pre-implementation inspection (done before any edit)

Read the exact current bodies of `beginJourney()`, `startPlan()`, `plantAndBegin()`,
`openAfterBegin()`, `openDayFlow()`, `openCareGate()`/`isSensitive()`, the Today-bridge branch of
`init()`, the zero-state chooser (`renderZero()`/`plantAndBegin`), the choose-list
(`openChooseList()`), the conflict-confirmation sheet (`resetSheet`/`resetGo`/`resetKeep`),
`continueBtn`'s binding, and `openReview()`/day-dot review — all in `src/pages/journey.astro`. One
real, previously-undocumented finding surfaced during this inspection: `plantAndBegin()`'s
non-reduced-motion branch calls `beginJourney(id, false, true)` (committing immediately) and only
reaches `openAfterBegin()` (the care-gate check) ~1.4s later, in the seed-flight animation's
`onfinish` callback — meaning the *fundamental* problem with every "new struggle picked" entry path
wasn't a missing care-gate check per se, but that all of them **committed before any gate or
preview**, which is what B2.1 corrects everywhere.

## Entry-path changes

| Path | Before | After |
|---|---|---|
| Zero-state card tap (`.zs-card` click) | `plantAndBegin(b)` → immediate commit + flight animation → `openAfterBegin()` ~1.4s later | `beginNewJourneyFlow(id, 'chooser')` → care-gate-if-sensitive → Preview. No commit until "Begin Day 1". |
| Choose-list button (`openChooseList()`, used by both "See all" and the switch-confirmed flow) | `beginJourney(id, !!openDay)` — immediate commit | `beginNewJourneyFlow(id, 'chooser')` — same funnel, no commit yet |
| Today bridge, brand-new (no conflict) | `startPlan(); saveActive(); showActiveUI();` then care-gate-or-`openDayFlow` | `beginNewJourneyFlow(id, 'today')` — no commit yet |
| Today bridge, existing active journey (same or different struggle) | Unchanged — resume or conflict-confirmation exactly as before | **Unchanged** |
| `continueBtn` (Continue/Resume Day N) | Unchanged — `openDayFlow()` directly | **Unchanged** |
| Completed-day review (`openReview()`) | Unchanged | **Unchanged** |
| Day-dot review | Unchanged | **Unchanged** |
| Locked-day state | Unchanged | **Unchanged** |

`plantAndBegin()` and `openAfterBegin()` are left fully defined and untouched in the file — they
simply have no remaining caller after this change. Not deleted, per instruction.

## Pure resolver strategy

Extracted the three lines already inside `startPlan()` (`journey.astro`, was lines 360-369) that
never touched `active`/`PLAN`/storage:
```js
function resolveJourneyPlan(struggleId, fromLabel, toLabel, seed) {
  const bespoke = JOURNEY_CONTENT[struggleId];
  const composed = (!bespoke && window.JourneyEngine && window.JourneyEngine.fallbackPlan)
    ? window.JourneyEngine.fallbackPlan({ struggleId, fromLabel, toLabel, seed }) : null;
  return clone(bespoke || composed || JOURNEY_CONTENT.shame);
}
```
Verified `window.JourneyEngine.fallbackPlan()`/`arc()` (in `journey-engine.js`, untouched) are
genuinely pure — deterministic functions of `(struggleId, seed, fromLabel, toLabel)` using a seeded
xorshift PRNG (`rng(seed)`), never `Math.random()`/`Date.now()` internally, no I/O, no global
mutation. `startPlan()` was given one additive optional parameter (`existingSeed`) so a journey
committed after Preview reuses the exact seed Preview already resolved from — the committed plan is
guaranteed identical to what was previewed (verified live: for every bespoke struggle tested, the
seed is actually irrelevant since `JOURNEY_CONTENT[id]` short-circuits the resolver regardless of
seed — the seed only matters for the rare struggle with no authored content).

## Proof Preview is side-effect-free

Verified live via `localStorage` inspection before/after opening Preview for six different struggles
(three non-sensitive, three via the sensitive care-gate): zero `db_journey*`/`db_active_journey` keys
written while Preview is open, in every case. `showJourneyPreview()` calls only
`resolveJourneyPlan()` (pure, above) and DOM rendering — no `saveActive()`, no `startPlan()`, no
`clearInstance()`, no lock mutation, no `JourneyEngine.generateDay()` (the Sonnet call — that's
`ensureDay()`, never invoked here), no `plantAndBegin()`. Canceling Preview (any of the three
secondary-action labels) leaves storage completely unchanged — verified for all three.

## Care-gate ordering

For the 6 sensitive struggles, `beginNewJourneyFlow()` calls the **existing, unmodified**
`openCareGate(id, onBegin)` with `onBegin = () => showJourneyPreview(...)` — the care gate is now the
first thing shown (before Preview, before any commit), for every entry path. "Talk to someone now"
remains a plain `<a href="/crisis">` (verified: navigates directly, no journey created as a side
effect). "I'm ready — begin gently" opens Preview — verified the care sheet never reappears
afterward (no second showing) all the way through commit.

## Conflict ordering

Unchanged — the existing `resetSheet` conflict-confirmation flow (Today-bridge mismatch, or the
manual "Switch" menu action) still fires exactly as before. What changed: the struggle picked *after*
conflict resolution now goes through `beginNewJourneyFlow()` (care-gate-or-Preview) instead of
committing immediately. Verified live: with `burnout` active, bridging in with `anxiety` showed the
conflict sheet; choosing "Switch" → picking `anxiety` opened Preview showing "Anxiety → Peace" while
`db_active_journey` still read `burnout` (unchanged) until Begin Day 1 was actually pressed.

## Contextual secondary actions

Tracked via a single in-memory `entrySource` on `previewState` (`'today' | 'chooser' | unresolved`),
never persisted:
- `'today'` → **Back to Today**, `window.location.href = '/today/'`.
- `'chooser'` → **Choose a Different Struggle**, closes Preview and returns to whichever Journey home
  state is actually true right now (a still-active journey if this was a switch-flow Preview, or the
  honest zero state otherwise) — verified both sub-cases live.
- unresolved/direct → **Return to Journey**, same routing as `'chooser'`.

Focus on cancel: a guaranteed-present landmark is focused (`#continueBtn` if enabled, else `#activeCard`
itself via a new `tabindex="-1"`, or `#zsSeeAll` for the zero-state) rather than the originally-tapped
element — the zero-state's card list is fully rebuilt by `renderZero()` on every return, so the
pre-Preview element reference would otherwise be silently unfocusable (a real issue caught and fixed
during verification).

## Begin Day 1 commitment behavior

Guarded against double activation: the button is `disabled` synchronously on click, plus a
`previewCommitting` boolean checked first — verified live with 3 rapid clicks producing exactly one
`db_active_journey` write. Commits via the **existing** `beginJourney(id, false, true, seed)` (one
additive 4th parameter), reusing 100% of its existing state-reset logic unchanged. No second care
gate is ever shown (verified). Hands off to the existing `openDayFlow()` after the transition below.
If the struggle id is somehow not found (defensive — shouldn't occur in practice since Preview only
opens for real catalog ids), the button is re-enabled and a toast shown rather than silently hanging.

## Seed / plant transition decision

The old flying-seed animation (`plantAndBegin()`) was **not** retargeted to fire from Preview — its
geometry depends on the tapped chooser card's on-screen position, which no longer exists once the
user is on the Preview screen. Per instruction, `plantAndBegin()`'s code is left completely
untouched (unused, not deleted). A new, restrained `playPlantedTransition()` reuses the exact small
local scale-pulse already used at the end of `plantAndBegin()`'s own animation chain (`vm.animate([...
scale(.94)/opacity .7 → scale(1.03) → scale(1)], 520ms)`) — no cross-viewport motion, no new
illustration, `prefers-reduced-motion` returns immediately with zero animation (verified live: the
commit → Day 1 hand-off completes identically whether or not the animation runs).

## Responsive behavior

Verified at all 12 required viewports (390×844, 430×932, 767×1024, 768×1024, 899×1194, 900×1200,
1023×768, 1024×650, 1024×768, 1280×720, 1280×800, 1440×1000) — no horizontal overflow at any width,
every control reachable at every short-height width tested. Preview reuses the page's own existing
`.scroll` class (same element `#homeScroll` already uses) for padding/max-width at every breakpoint,
rather than duplicating those values — this was a real bug found and fixed during verification (see
Known limitations). At ≥1024px the 5 day cards lay out in one row; at 768-1023px they stack (no
forced narrow columns); below 768px, one vertical column with a featured Day 1 card. The persistent
left rail (≥768px) and the 5-tab mobile bottom nav are untouched code and remain visible throughout —
Preview is in-flow page content (toggles with `#homeScroll`), not a full-viewport overlay like
`#dayflow`, specifically so it never has to cover either.

## Accessibility

Real `<h2>` (not a styled `<div>`) for the "Preview Your 5-Day Journey" heading, giving a correct
H1→H2 hierarchy under the page's existing `<h1>`. Locked day cards are plain non-interactive `<div>`s
— no `tabindex`, no `role`, no click handler (verified for all 4 locked cards on every test).
Focus moves to the heading on open (`tabindex="-1"`), lands on "Begin Day 1" with one `Tab` press,
and the next `Tab` reaches the secondary action — exactly two real, focusable controls in the whole
screen, both real `<button>`s ≥44×44px. Verified with an actual keyboard `Tab`/`Shift+Tab`/`Enter`
sequence (not `.focus()`) that Enter-activation commits correctly. No Escape-to-close was added —
confirmed no existing sheet/overlay in this file uses Escape either, so this doesn't introduce a new,
inconsistent convention. No focus trap — matches the file's existing lack of one for `#dayflow`.
Verified usable at 200% zoom (no horizontal overflow, controls scale proportionally) and with
`prefers-reduced-motion` simulated (commit still completes correctly, transition animation skipped).

## i18n

New keys added under the existing `journey.*` namespace (matching this file's established
convention — English inline via `data-i18n` for static markup, `tj()` for JS-templated strings):
`journey.previewEyebrow`, `journey.previewDays`, `journey.previewPace`, `journey.previewBeginDay1`,
`journey.previewBeginsNow`, `journey.previewLocked`, `journey.previewDayWord`,
`journey.previewBackToday`, `journey.previewChooseDifferent`, `journey.previewReturn`,
`journey.previewPrivacy`. Real per-struggle day content (title/ref/focus) is never translated through
a new generic key — it comes straight from `journey-data.js`'s existing authored bank, exactly as
`renderHome()` already displays it elsewhere. A new `declare-lang` listener scoped only to Preview
re-paints its dynamically-templated day cards + secondary label on a live language switch (this
page has no equivalent listener elsewhere — verified live in Spanish, including the day-card
"Bloqueado" label, which is JS-templated and would not otherwise repaint from the global
attribute-based swap).

## Tests

Full live Playwright verification across: all 12 viewports; all 8 named entry-path/sensitivity
combinations (Today bridge × chooser/choose-list × sensitive/non-sensitive, plus switch-confirmed);
Continue/Resume (unchanged); completed-day review via day-dot (unchanged, correctly bypasses
Preview); locked-day state (unchanged); double-activation guard; dark/light themes; English/Spanish
including live switching; real keyboard Tab/Shift+Tab/Enter; 200% zoom; simulated reduced motion;
console errors (none introduced). See the companion verification report for the full breakdown.

## Protected surfaces — confirmed untouched

The seven-step daily flow (`renderDayFlow()`), `journey-engine.js` (prompt-building, `generateDay()`,
`fallbackPlan()`/`arc()` themselves — only *called*, never edited), `journey-data.js`, Convex, the
B1.5B identity card, the B1.5C shared crisis card, `/word`, `/crisis`, and mobile bottom navigation
are not modified — confirmed by `git diff --name-only` showing only `journey.astro` and
`i18n-strings.js` changed.

## Known limitations

- **A real bug was found and fixed during this pass, not left as a known issue**: the first Preview
  implementation gave `.jp-scroll` its own padding/max-width values, which didn't match the existing
  `.scroll` class's responsive padding — causing Preview's content to render flush against the left
  edge at the 768-899px compact-rail width (visually running under the rail). Fixed by reusing the
  existing `.scroll` class directly (same element `#homeScroll` already uses) rather than duplicating
  values — verified clean afterward at that exact width.
- A `fullPage: true` Playwright screenshot of a page containing a closed (`aria-hidden`,
  non-`.open`) `position:fixed` sheet can visually misplace that sheet in the stitched capture (a
  known Playwright/full-page-screenshot behavior with fixed-position elements, not a real rendering
  bug) — encountered once during screenshot capture, confirmed via `getBoundingClientRect()`/
  `aria-hidden` inspection that the sheet was never actually shown, and switched to viewport-only
  screenshots for the rest of this pass.
- `openChooseList(openDay)` keeps its `openDay` parameter in its signature for minimal footprint,
  though it's no longer consulted in the function body (commented inline) — cleaning it up is
  cosmetic and out of scope for this pass.
- No automated test suite exists in this project (confirmed in an earlier session's audit) —
  verification here is build + live Playwright-driven manual/DOM verification, matching the pattern
  established across every prior B1.5 milestone.

## Rollback

```
git checkout -- src/pages/journey.astro public/declare/i18n-strings.js
```
No data/schema change, no new storage key, no Journey-engine/Convex change — pure markup/CSS/script
addition plus two small, additive parameter changes to already-existing functions.

---

**B2.1 implementation complete. Not staged, not committed, not pushed. Stopping here per
instruction — not beginning B2.2.**
