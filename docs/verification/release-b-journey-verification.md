# Release B — Journey Redesign Verification Report

*Companion to `docs/implementation/release-b-journey-redesign-summary.md`. Each milestone's
verification is appended as it completes. Local dev only — production Convex was never touched.*

---

## B1 — Journey Overview Redesign (2026-07-23)

### Commands run

```
$ git status --short
 M TODO.md
 M src/pages/journey.astro
?? docs/prompts/RELEASE_B_JOURNEY_REDESIGN_CLAUDE_PROMPT.md
?? docs/verification/screenshots/release-b-b1/

$ git diff --stat
 TODO.md                 | 41 +++++++++++++++++++++++++++++++++++++++++
 src/pages/journey.astro | 49 +++++++++++++++++++++++++++++++++++++++++++++----
 2 files changed, 86 insertions(+), 4 deletions(-)
```
(`TODO.md`'s 41-line diff is the pre-existing, unrelated edit noted throughout this project's
history — not touched by B1. Only `journey.astro` was modified for this milestone.)

- Formatting / lint / type-check: still unavailable (no scripts/config in this repo, unchanged from
  earlier audits) — not run, no packages installed.
- `npm run build`: **clean, exit 0**, all 11 pages built, no errors.
- Route check: `GET /journey` → **200**.

### Browser verification

Desktop (1440×1000), tablet (768×1024), and mobile (390×844), against the local dev Convex
deployment only (confirmed via `.env.local` → `good-dotterel-906`, not production) where sign-in
state was involved.

| State | Result |
|---|---|
| Fresh zero-state | Pass — new header hierarchy renders correctly above the untouched struggle-chooser list; screenshot `b1-desktop-06-zerostate.png` |
| Active Day 1 | Pass — desktop two-column (Vine beside copy) confirmed via `display: grid` on `#activeCard`; screenshot `b1-desktop-01-active-day1.png` |
| Active, unlocked Day 2+ | Pass — verified with a real completed Day 1 followed by a seeded no-lock state; `#continueBtn` correctly enabled, reads "Continue Day 2"; screenshot `b1-tablet-01-active-unlocked-day2.png` |
| Locked next-day state | Pass — completed Day 1 for real through the actual 7-step ritual (cast off → skip breathing → mark declared → complete), confirming the lock note, "Opens in Xh Xm," reminder controls, and "Preview tomorrow" all still render and function; screenshot `b1-desktop-03-locked-fruitlog.png` |
| At least one completed fruit entry | Pass — real Day 1 completion produced a real fruit ("Honest Courage"/"Sound Mind" across two test runs), rendered in the new Name/Day-tag/Truth structure; same screenshot |
| Past Journeys visible, empty | Pass — "0 rooted" / "No rooted journeys yet" unchanged; screenshot `b1-desktop-02-past-journeys.png` |
| Past Journeys visible, with entries | Pass — seeded a real `db_journeys_done` + `db_journey_inst:<id>` pair (data shaped exactly as `saveInstance()`/`markDone()` already write it, not invented) and confirmed the new `.cell-fruit` summary line rendered correctly; screenshot `b1-desktop-05-past-with-fruit-viewport.png` |
| Past Journeys, entry with no cached instance | Pass — separately seeded a "done" struggle with its instance cache removed and confirmed **no** summary line is invented or shown — clean graceful degradation, verified via direct DOM inspection of the rendered `#jgrid` innerHTML |
| Signed out | Pass — zero-state and active-state both confirmed after `localStorage.clear()` |
| Signed in | Pass — active-state and Save-to-Vault-adjacent flows confirmed while signed in as the existing dev test account |
| Reduced motion | Pass — `prefers-reduced-motion: reduce` emulated; confirmed `#activeCard`'s `.rise` animation is `none` and opacity is `1` immediately, matching pre-existing (untouched) behavior |
| Keyboard-only | Pass for the overview itself — Tab order through the redesigned section is logical (day-dots → Continue Day N → View Vine → fruit-log item → Past Journeys toggle); see "Known limitations" in the implementation summary for an out-of-scope observation about other page sheets |
| No horizontal overflow | Pass at all three widths — `document.documentElement.scrollWidth === clientWidth` confirmed at 1440/768/390 |
| Touch targets ≥ 44px | Pass for every interactive element in B1's scope — measured `#continueBtn` (195×52 at mobile), `#viewTreeBtn` (107×52), `#seeAll` (346×44), `.fl-item` (312×68); the pre-existing day-dots are the one documented exception, deliberately not force-expanded (see known limitations — risk of overlapping hit areas) |
| Crisis link reachable | Pass — sidebar (desktop) and top-bar/bottom-tab (tablet/mobile) crisis link present and unaffected in every screenshot |
| No console errors | Pass — only the pre-existing, dev-server-only "Outdated Optimize Dep" 504 noise (not present in production builds, not related to this change) |
| No failed network requests | Pass |
| All existing IDs found by `renderHome()`/`buildVine()`/`renderFruitLog()`/`renderGrid()`/`renderLockNote()` | Pass — all five functions ran without error against the restyled markup across every state tested above; confirmed no `getElementById` call returned `null` unexpectedly during any of the above test passes |

### Known limitations

See the implementation summary's "Known limitations" section (day-dots' touch target size, Spanish
copy for two changed/new strings, and an out-of-scope observation about other Journey sheets'
keyboard-focus behavior). None of these are regressions introduced by B1; all are either pre-existing
or explicitly, safely deferred.

### Rollback

`git checkout -- src/pages/journey.astro` — single file, no data migration needed.

---

---

## B1 Closeout — day-dot touch target + Spanish parity (2026-07-23)

### Commands run

```
$ git status --short
 M TODO.md
 M public/declare/i18n-strings.js
 M src/pages/journey.astro
?? docs/... (report/screenshot files)

$ git diff --stat
 public/declare/i18n-strings.js |  3 ++-
 src/pages/journey.astro        | 67 ++++++++++++++++++++++++++++++++++++++----
 2 files changed, 66 insertions(+), 5 deletions(-)   (plus TODO.md's pre-existing, unrelated 41-line diff)
```

- `npm run build`: **clean, exit 0** (run twice — once before, once after the footer-crowding fix
  found during verification — both clean).
- Route check: `GET /journey` → **200**.

### Measurements (real, post-fix)

| Metric | Result |
|---|---|
| Visible completed-dot size | **16×5px** — unchanged from before the fix, at all three viewports |
| Actual completed-dot hit-area size | **44×44px** (`getComputedStyle(dot, '::before')`), confirmed identical at 1440×1000, 768×1024, and 390×844 |
| Center-to-center spacing (adjacent completed dots) | 44px exactly (two 16px dots + 28px gap) |
| Center-to-center spacing (completed dot beside current dot) | 47px (16px dot + 28px gap + half of the 22px current dot) |
| Hit-area overlap | **None detected** — computed both dots' 44px bounding boxes and checked intersection programmatically; adjacent boxes touch at the boundary with zero overlap |
| Total dot-row width | 198px (up from 121px before the fix) |

### Verification checklist

| Check | Result |
|---|---|
| Completed dots remain clickable | Pass — real `.click()` on a `.tap` dot opens review mode (`#dayflow` gains `.open`/`.reviewing`) |
| Keyboard Enter/Space review behavior | Pass — real keyboard Tab reached the dot, `Enter` opened review mode; the existing keydown handler checks both `Enter` and `Space` identically (same code path, not separately re-tested) |
| Focus indicator remains visible | Pass, with one nuance worth recording honestly: a *programmatic* `.focus()` call showed `outline-style: none` (matching the same `:focus-visible` browser heuristic difference found earlier in this project for the intake textarea); a **real keyboard Tab** to the same dot showed `outline-style: auto` with a visible ring (Chromium default blue) — confirmed with an actual `Tab` keypress, not simulated focus, which is the behavior that matters for real users |
| Current and future dots remain non-interactive | Pass — `getComputedStyle(dot, '::before')` returns `width:auto; height:auto` (no pseudo-element) for `.cur` and plain dots; only `.tap` dots got the 44px treatment |
| Footer content does not overlap | Pass, after a fix — see below |
| No horizontal overflow | Pass at all three widths (`scrollWidth === clientWidth` confirmed at 1440/768/390) |
| English renders correctly | Pass |
| Spanish renders correctly | Pass — `journey.hTitle`→"Tu Camino", `journey.becoming`→"¿En quién te estás convirtiendo?", `journey.overviewSub`→"Dios te encuentra en lo cotidiano y hace crecer algo eterno.", `journey.fruitSoFar`→"El fruto que Dios está haciendo crecer" all confirmed rendering live after switching `I18N` to `es` |
| No untranslated key appears | Pass — no literal key string (e.g. "journey.overviewSub") visible anywhere; AI-authored day content (verse/prayer/etc.) stays in whatever language it was generated in, which is expected, pre-existing behavior unrelated to this pass |
| No console errors | Pass — only the pre-existing, dev-server-only "Outdated Optimize Dep" 504 noise |
| Reduced motion remains unchanged | Pass — `#activeCard`'s `.rise` animation still reports `none`/opacity `1` under `prefers-reduced-motion: reduce`, identical to before this pass |

### A real issue found and fixed during verification (not assumed away)

The widened 198px dot row caused **"N fruit so far" to wrap mid-word** ("2 fruit so" / "far") —
but only inside the ≥1024px desktop two-column layout, where the copy column is narrower than
either tablet or mobile (the 300px Vine column takes real width back from it). Tablet (768px) and
mobile (390px) were confirmed clean both before and after — this was desktop-only.

Fixed per your explicit instruction ("adjust the footer layout responsively rather than shrinking
the hit areas"): `.jc-foot` switches to a column layout at ≥1024px only (dots on their own line,
remain-text below, no wrap). Re-verified after the fix: `remainLines: 1` at all three viewports,
hit-areas unaffected (confirmed still 44×44, since the pseudo-elements are `position:absolute` and
don't participate in their container's flex layout).

### Screenshots

`docs/verification/screenshots/release-b-b1-closeout/`:
- `closeout-desktop-01-dots.png` — the footer-wrap issue, as first found
- `closeout-desktop-02-footer-fixed.png` — same state, after the footer fix
- `closeout-desktop-03-spanish.png` — full Spanish rendering, desktop
- `closeout-mobile-01-dots.png`, `closeout-mobile-02-dots-row.png` — mobile, confirming no crowding

### Rollback

```
git checkout -- src/pages/journey.astro public/declare/i18n-strings.js
```

---

**B1 (including closeout) complete. Stopping here per instruction — not beginning B2.**

---

## B1 Visual Alignment — mockup-driven patch (2026-07-23)

### Commands run

```
$ git status --short
 M TODO.md
 M public/declare/i18n-strings.js
 M src/pages/journey.astro
?? docs/... (report/screenshot files)

$ git diff --stat
 public/declare/i18n-strings.js |   4 +-
 src/pages/journey.astro        | 250 +++++++++++++++++++++++++++++++----------
 2 files changed, 193 insertions(+), 61 deletions(-)
```

- `npm run build`: **clean, exit 0** (run four times across this pass — once before any edits, once
  after the initial CSS/markup pass, once after fixing the `.jhead`/`.scroll` cascade bug, once after
  fixing the grid auto-placement bug — all clean).
- Route check: `GET /journey` → **200**.

### Browser verification

Desktop (1440×1000), tablet (768×1024), and mobile (390×844), local dev server only.

| State | Result |
|---|---|
| Fresh zero-state | Pass — new H1 scale (54px desktop / 44px tablet / 34px mobile, unchanged breakpoints) renders correctly above the untouched struggle chooser; `b1va-desktop-01-zerostate.png` |
| Active Day 1, no completed fruit | Pass — in-card fruit preview correctly absent (`display:none`, `completed() === 0`); desktop 3-zone grid (copy / vine, fruit-preview column collapsed) confirmed via live `getComputedStyle`; `b1va-desktop-02-active-day1.png` |
| Active Day 2+, locked, with 1 completed fruit | Pass — completed Day 1 through the real 7-step ritual (cast off → skip breathing → mark declared → complete), confirming the day-complete overlay shows the real fruit ("Quiet Courage"), then the overview correctly shows "Day 2 of 5," the in-card fruit preview, the lock note, and the Fruit section below; `b1va-desktop-04-locked-with-fruit.png` |
| Past Journeys, empty | Pass — "0 rooted" / "No rooted journeys yet" unchanged |
| Past Journeys, 1 rooted | Pass — seeded a real `db_journeys_done` + `db_journey_inst:<id>` pair (shaped exactly as `saveInstance()`/`markDone()` write it); confirmed the new horizontal cell layout (icon left / body center / "ROOTED" badge right); `b1va-desktop-06-pastjourneys-populated.png` |
| Past Journeys, 2 rooted | Pass — confirmed the outer `.jgrid` 2-column grid is completely preserved with the new cell layout inside each column; `b1va-desktop-07-pastjourneys-2col.png` |
| Signed out / signed in | Pass — both confirmed via `localStorage.clear()` and the existing dev test account; no change to either flow |
| English | Pass |
| Spanish | Pass — `journey.todayJourney` → "EL CAMINO DE HOY" (displayed via CSS `text-transform:uppercase` over stored "El camino de hoy"), `journey.overviewSub` → "Dios te encuentra en lo cotidiano y está haciendo crecer algo eterno.", all pre-existing keys (`journey.hTitle`, `journey.becoming`, `journey.fruitSoFar`, `journey.viewVine`) still correct; `b1va-desktop-08-spanish.png` |
| Keyboard-only | Pass for every element this pass touched — real `Tab` keypresses (not programmatic `.focus()`) reached, in order: day-dots → `#viewTreeBtn` (Continue was correctly skipped, disabled/locked) → reminder controls → `.fl-item` → "Past journeys" toggle; see Known limitations for `.cell`'s pre-existing gap |
| Focus visibility | Pass — `outline-style: auto` (visible ring) confirmed via real Tab on `#viewTreeBtn` and `.fl-item` |
| Touch targets ≥ 44px | Pass — measured at 390px width: `#continueBtn` 157×69, `#viewTreeBtn` 130×69, `.fl-item` 331×68, `.cell` 205×169 |
| No overlapping day-dot hit areas | Pass — unaffected by this pass (not touched); the B1 Closeout 44px pseudo-element fix remains in place |
| No horizontal overflow | Pass — `document.documentElement.scrollWidth === clientWidth` (390×390) confirmed at mobile; the one wider reading found (`document.body.scrollWidth` 435px) traced to the pre-existing, off-canvas `#dayflow` sheet, clipped by `overflow-x:hidden` on `body` — never visible or reachable, not a regression |
| Reduced motion | Pass — `.rise`'s `animation-name` computed to `none`, `opacity: 1`, matching pre-existing behavior |
| Crisis link reachable | Pass — `a[href="/crisis"]` present and visible in every state tested |
| Full View Vine viewer still shows all info | Pass — opened the full-screen viewer live and confirmed both from/to captions ("Shame & Guilt" / "Beloved of God") and the "Jesus, the Vine — John 15:5" caption are all present and unaffected by the compact-card-only crop/caption-hiding CSS; `b1va-desktop-09-full-vine-viewer.png` |
| No console errors | Pass — only the pre-existing, dev-server-only "Outdated Optimize Dep" 504 noise; one unrelated `/today` JSON-parse error observed came from a different, previously-open browser tab testing the live AI response, not from `/journey` |
| No failed assets on `/journey` | Pass |
| Tablet (768px): single-column card, Vine below copy, fruit/Past-Journeys grids | Pass — `b1va-tablet-01/02/03` |
| Mobile (390px): full stacked order, no truncation, bottom nav unobstructed | Pass — `b1va-mobile-01` through `04` |

### Real issues found and fixed during verification (not assumed away)

Both fixed within this same pass, same two approved files — see the implementation summary's "A
real bug found and fixed during implementation" section for full detail:

1. A pre-existing `@media (min-width: 481px)` block later in the stylesheet was silently overriding
   this pass's new `.jhead`/`.scroll` desktop max-width (cascade order, not specificity) — the entire
   desktop composition was collapsing into a phone-width column before the fix. Fixed by moving the
   new desktop `@media (min-width: 1024px)` block to the end of the stylesheet.
2. A CSS Grid auto-placement bug: with `.jc-fruit-preview` at `display:none` (no fruit yet), the
   Vine slid into the wrong grid track and ballooned to the image's full intrinsic width, overlapping
   the copy column. Fixed with explicit `grid-column` placement on all three zones.

Both were caught by live `getComputedStyle()` inspection against the actual rendered page, not by
visual inspection of the CSS source alone — confirming the verification process (not just the build)
is what caught these.

### Known limitations

See the implementation summary's "Known limitations" section for this pass (the `.cell` keyboard-
accessibility gap, carried forward unchanged) plus everything already documented in the original B1
and B1 Closeout sections above.

### Rollback

```
git checkout -- src/pages/journey.astro public/declare/i18n-strings.js
```

---

**B1 Visual Alignment complete. Stopping here per instruction — not beginning B1.5 or B2.**
