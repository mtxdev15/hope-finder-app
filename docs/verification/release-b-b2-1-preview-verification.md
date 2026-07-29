# Release B — B2.1 Journey Preview: Verification Report

*Companion to `docs/implementation/release-b-b2-1-preview-summary.md`. Local dev only (Convex
deployment `good-dotterel-906`). Not staged, not committed, not pushed, not merged, not deployed.*

---

## Commands run

```
$ git branch --show-current
redesign/release-b-journey

$ git status --short
 M TODO.md
 M public/declare/i18n-strings.js
 M src/pages/journey.astro
 (.playwright-mcp/, docs/prompts/RELEASE_B_JOURNEY_REDESIGN_CLAUDE_PROMPT.md — pre-existing/unrelated)

$ git diff --name-only
TODO.md
public/declare/i18n-strings.js
src/pages/journey.astro

$ git diff --stat -- public/declare/i18n-strings.js src/pages/journey.astro
 public/declare/i18n-strings.js |  13 ++
 src/pages/journey.astro        | 305 ++++++++++++++++++++++++++++++++++++++---
 2 files changed, 318 insertions(+), 17 deletions(-)

$ git diff --check
(clean, no output)

$ npm run build
✓ Completed, 11 pages built, no errors
```

## Route checks

`/today`, `/word`, `/journey`, `/vault`, `/you`, `/signin`, `/crisis` — all HTTP 200.

## Responsive verification — all 12 required viewports

| Width × height | Result |
|---|---|
| 390×844 | Mobile: single column, Day 1 featured, 5-tab bottom nav preserved, no overflow |
| 430×932 | No overflow |
| 767×1024 | No overflow (just under rail breakpoint) |
| 768×1024 | Compact rail — content correctly inset (fixed during this pass, see Known limitations) |
| 899×1194 | Compact rail upper boundary — no overflow, Begin Day 1 632×51.5px |
| 900×1200 | Expanded tablet rail — stacked cards, no forced narrow columns |
| 1023×768 | No overflow, Begin Day 1 reachable |
| 1024×650 | Short-height — all controls (Begin Day 1, crisis card, identity card) reachable |
| 1024×768 | No overflow |
| 1280×720 | Short-height — Begin Day 1 reachable, no overflow |
| 1280×800 | No overflow |
| 1440×1000 | Full verification width — 5-card single row, see screenshots |

## Entry-path verification

| # | Path | Sensitivity | Result |
|---|---|---|---|
| 1 | Today bridge | non-sensitive (`loneliness`) | Preview opens directly, "Back to Today" label, zero storage writes, bridge flag cleared |
| 2 | Today bridge | sensitive (`grief`) | Existing care gate shown first (verified exact real pastoral copy), then Preview; "Talk to someone now" navigated directly to `/crisis`, zero storage writes |
| 3 | Journey zero-state card | non-sensitive (`anxiety`, `shame`, `doubt`, `burnout`, `loneliness` all tested) | Preview opens with real data, "Choose a Different Struggle" label |
| 4 | Journey zero-state card | n/a (sensitive structs not in curated zero-state list — reached via choose-list instead, see #6) | — |
| 5 | Choose-list ("See all") | non-sensitive | Preview opens correctly, no commit until Begin Day 1 |
| 6 | Choose-list ("See all") | sensitive (`addiction`) | Existing care gate shown first (exact real copy verified), "I'm ready — begin gently" → Preview, no second care gate; Begin Day 1 committed exactly once (`db_active_journey`/`db_journey_inst:addiction` both correct) |
| 7 | Confirmed switch (active `burnout`, switch to `anxiety`) | non-sensitive | Conflict sheet shown (unchanged) → Preview opens for the new struggle → old journey (`burnout`) remains uncommitted-over in storage until Begin Day 1 is actually pressed; canceling correctly returns to the still-active `burnout` home, not zero-state |
| 8 | Confirmed switch | (sensitive variant not separately re-tested — same `beginNewJourneyFlow()` funnel as #6, verified via code path, not a separate live click-through) | — |
| 9 | Active Journey "Continue" | n/a | Unchanged — `continueBtn` → `openDayFlow()` directly, no Preview, verified live |
| 10 | Completed-day review (day-dot) | n/a | Unchanged — `openReview()` opens `#dayflow` in `.reviewing` mode directly, Preview never involved |
| 11 | Day-dot review | n/a | Same as #10 |
| 12 | Locked day | n/a | Unchanged — disabled `continueBtn`, "Day N opens tomorrow", no Preview |

For all sensitive-path tests: existing care gate appeared before Preview ✓; crisis action navigated
directly to `/crisis` ✓; begin-gently action opened Preview ✓; Preview never showed a second care
gate ✓; Begin Day 1 committed exactly once ✓.

## Preview side-effect-free verification

Checked `localStorage` (`db_journey*`, `db_active_journey`) immediately before and after opening
Preview, across 6 different struggles (3 non-sensitive, 3 reached via the sensitive care gate):
**zero keys written in every case**. No `JourneyEngine.generateDay()`/Sonnet call triggered (network
tab / `active._ai` inspection not applicable since `active` is never even set until commit). No
plant-transition animation triggered while Preview is open.

## Cancellation verification

- **Back to Today** (`entrySource: 'today'`): navigated to `/today/`; storage confirmed unchanged
  beforehand.
- **Choose a Different Struggle** (`entrySource: 'chooser'`, no prior active journey): returned to
  zero-state, `db_active_journey` remained `null`, focus landed on `#zsSeeAll`.
- **Choose a Different Struggle** (switch-flow variant, prior active journey `burnout`): returned to
  the still-active `burnout` home (`showActiveUI()`), `db_active_journey` still read `burnout`,
  focus landed on `#activeCard` (a real edge case found and fixed live: `#continueBtn` was
  `disabled` at the time due to the pacing lock, so focusing it silently failed — added a
  `tabindex="-1"` fallback on `#activeCard` and a disabled-check, re-verified correct afterward).

## Begin Day 1 verification

- Single click: commits exactly once, `db_active_journey`/`db_journey_inst:<id>` both correct,
  `#dayflow` opens with Day 1's real content, no second care gate.
- **Seed consistency**: committed Day 1 title matched what Preview displayed in every test (for
  bespoke/authored struggles this is guaranteed by construction — the seed is irrelevant once
  `JOURNEY_CONTENT[id]` exists, confirmed by reading `resolveJourneyPlan()`/`journey-engine.js`
  directly).
- **Double-activation guard**: 3 rapid clicks on `#jpBegin` produced exactly one
  `db_active_journey` write and one `db_journey_inst:<id>` key — button `disabled` synchronously on
  first click, `previewCommitting` flag as a second guard.
- **Keyboard activation**: real `Tab` from the heading landed on `#jpBegin` with visible focus
  (`outline-style: auto`); a further `Tab` reached `#jpSecondary` (no locked-day card in between);
  `Shift+Tab` + real `Enter` keypress committed correctly (not a synthetic `.click()`).

## Theme and language verification

Dark and light confirmed at desktop expanded, mobile, and tablet widths — forest/ivory surfaces,
restrained gold, no saturated green or red at any point. English confirmed as shipped default.
Spanish confirmed live via `window.I18N.setLang('es')`: all static chrome (`journey.previewEyebrow`
heading, "5 días · Un paso a la vez.", "Comienza el Día 1", "Elegir otra lucha", privacy line) and
the dynamically-templated day-card "Bloqueado" label all swapped correctly, including via a live
in-place language switch while Preview was already open (the new Preview-scoped `declare-lang`
listener repainted the day cards without needing to reopen Preview).

## Accessibility verification

- Real `<h2 id="jpHeading">` (not a styled div) — correct heading hierarchy under the page's
  existing `<h1>` (found and fixed during verification; originally a plain `<div>`).
- All 4 locked day cards on every struggle tested: plain `<div>`, no `tabindex`, no `role`, no
  `onclick` — confirmed via direct attribute inspection, not visual inference.
- Exactly 2 focusable elements inside the Preview screen (`#jpBegin`, `#jpSecondary`), both real
  `<button>`s, both ≥44×44px (measured 618×53.5 and 331×53.5 at desktop width).
- Focus moves to the Preview heading on open, to `#jpBegin` after one `Tab`, and to a
  guaranteed-present landmark on close (never a possibly-stale/detached reference).
- No Escape-to-close added — confirmed (via grep) no existing sheet/overlay in `journey.astro` uses
  Escape either, so this doesn't introduce an inconsistent new convention.
- No focus trap — consistent with the file's existing lack of one for `#dayflow`.
- 200% zoom: no horizontal overflow, controls scale proportionally, nothing clipped.
- Reduced motion (simulated via `matchMedia` override): commit → Day 1 hand-off completes
  identically; `playPlantedTransition()` returns immediately with no animation.

## Console

Only the pre-existing, dev-server-only "Outdated Optimize Dep" 504 noise across the entire test
session — no new JavaScript errors introduced by either changed file, at any width, theme, or
language.

## Protected surfaces confirmed unchanged

- Shared crisis card and identity card: visible and functioning identically in every screenshot;
  zero diff to `TabBar.astro`/`sidebar.css`.
- Production logo/wordmark ("Declare & Believe" + gold dot): unchanged in every screenshot.
- Mobile bottom navigation: exactly 5 tabs, unchanged, confirmed via direct DOM query at 390×844
  and 430×932.
- Seven-step daily flow: not touched by this diff at all (`renderDayFlow()` and all its supporting
  functions have zero changes) — confirmed via `git diff` showing no hunks in that region of the
  file, and via live testing (Day 1's cast/repent/declare gate and completion flow behaved exactly
  as before).
- Journey engine (`journey-engine.js`) and its prompts: zero diff — confirmed by `git diff --name-only`.
- Convex: untouched — no file in this diff touches any Convex path.

## Screenshots (`docs/verification/screenshots/release-b-b2-1-preview/`)

| File | State |
|---|---|
| `desktop-expanded-dark.png` | 1440px, dark, "Anxiety → Peace", 5-card single row |
| `desktop-expanded-light.png` | 1440px, light, "Anxiety → Peace" |
| `tablet-expanded.png` | 1000px, dark, "Doubt → Faith", stacked cards |
| `tablet-compact-rail.png` | 800px, dark, "Shame & Guilt → Beloved of God", content correctly inset from the compact rail |
| `mobile-dark.png` | 390px, dark, "Loneliness → Held by God" |
| `mobile-light.png` | 390px, light, "Loneliness → Held by God" |
| `spanish-mobile.png` | 390px, Spanish, all static + dynamic copy translated |
| `sensitive-care-gate-before-preview.png` | Real `addiction` pastoral copy, shown before Preview |
| `keyboard-focus-begin-day1.png` | 1440px, visible blue focus ring on "Begin Day 1" |
| `short-height-desktop.png` | 1024×650, "Stress & Burnout → His Rest", no clipping |

All screenshots use generic/fictional struggle selections only — no real user data, no test
credentials, no email addresses, no tokens of any kind appear anywhere.

## Confirmed

- Side-effect-free Preview, proven live across 6 struggles ✓
- Real five-day data only — no mockup example text (verified: "Unclenched Trust" does not appear
  anywhere; real titles like "The Hand-Off"/"No Condemnation"/"Never Forsaken" come straight from
  `journey-data.js`) ✓
- Existing care gate reused unmodified, correctly ordered before Preview for all 6 sensitive
  struggles ✓
- Existing conflict-confirmation behavior preserved ✓
- Contextual secondary actions correct for all three sources ✓
- Begin Day 1 commits exactly once, hands off to the unmodified seven-step flow ✓
- Responsive at all 12 required viewports, no overflow, no clipped CTA ✓
- Dark/light/English/Spanish/live-language-switch all correct ✓
- Accessible: real heading, non-interactive locked cards, 2 real ≥44px buttons, working keyboard
  path, 200% zoom, reduced motion ✓
- No console errors introduced ✓
- Nothing staged, committed, pushed, merged, or deployed ✓

---

**B2.1 verification complete. Stopping here per instruction — not beginning B2.2.**
