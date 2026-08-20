# B3.2 — Paginated Seven-Step Ritual Shell (Verification Report)

This report is organized by **how** each item was checked, not just what passed, so it's clear
what's a hard guarantee versus an inference.

## 1. Automated checks (tooling that exists in this repo)

`package.json` has exactly four scripts: `dev`, `build`, `preview`, `astro`. **There is no lint,
typecheck, unit test, or E2E test script in this project.** Nothing here claims a test suite ran,
because none exists.

- `npm run build` — clean Astro static build, no errors, `/journey/index.html` generated
  (re-run after every code change made during this milestone, most recently after the two
  accessibility/casing fixes below).

## 2. Live browser checks (real functional verification)

The shared Playwright MCP browser was contended by other concurrent sessions on this machine for
the entire duration of this task (`Error: Browser is already in use for .../Chrome Canary`,
confirmed via `ps aux` to be other sessions' processes, not something safe to kill). All live
verification below used an independent local Playwright/Chromium install instead, driven against
the real `npm run dev` server at `localhost:4321`, exercising the actual DOM, real click/keyboard
events, and real timers — not a simulation.

**A note on flakiness encountered and worked around:** the local Astro/Vite dev server
occasionally raced its own module graph on a `reload()` fired immediately after a fresh
navigation (same family as a pre-existing, environment-wide `504 Outdated Optimize Dep` console
warning tied to Astro's dev-toolbar, already confirmed unrelated to this feature by loading the
untouched `/today` page and seeing the identical warning). The test harness retries the
bridge-flag + reload up to 5 times; once the Journey Preview opens, behavior was stable and
deterministic on every run. This is dev-server-only noise, not app behavior — it does not occur
from a normal user click path from `/today`.

### 2.1 Entry and full step flow — verified
Fresh entry via the `/today` → Journey Preview → Day-Opening → paginated day-flow bridge, then a
complete forward walk through all 7 steps with real gate interactions:

- Step 1 opens with the visible eyebrow **"Day 1 of 5"** only, the screen-reader text
  **"Day 1 of 5, Step 1 of 7"**, a 7-dot step rail, primary label **"Continue"**, Back hidden.
- Step 2 → step 3 (Cast Off): `#dfComplete` is disabled until `#castBtn` is clicked; then enabled.
- Step 3 → step 4 (Repent & Breathe): disabled until the breath completes or is skipped.
- Step 4 → step 5 (Declare): disabled until `#declCheck` is checked.
- Step 5 → step 6 → **Back** → returns to step 5 with the gate state (`spoke`) still true
  (Continue still enabled) — confirms per-step gate state survives backward navigation.
- Step 6 → step 7: primary label correctly reads **"Complete Day 1"**.
- Closing via the X does **not** advance `db_active_journey.day` (stayed `1`), does not show the
  Day-Opening screen, and returns focus to the trigger.
- Refreshing the page and reopening via "Continue" restores **the exact step** the user left on
  (step 7 in this run).
- Console had no errors beyond the pre-existing, unrelated dev-toolbar 504 warning.

### 2.2 Breath (step 4) — real timing measured, not estimated
Sampled the live phase label every ~300ms through a full, un-skipped breath cycle:

| Phase | Measured duration | Contract |
|---|---|---|
| "Breathe in mercy" | ≈4.0s | 4s |
| "Hold" | ≈1.9s | 2s |
| "Release the old" | ≈6.1s | 6s |

Completed automatically after one pass (confirms `BREATH_ROUNDS = 1`, not the old 3), un-gated
step 5 without a click. Skipping (`#breathSkip`) also un-gates immediately.
Screenshots: `breath/01-ready.png` through `breath/05-completed.png`.

**Reduced motion:** with `prefers-reduced-motion: reduce` emulated, the breath still ran and
completed on its own (the 4s/2s/6s contract is content, not decoration, so it correctly isn't
skipped) — `breath/06-reduced-motion-desktop-dialog.png`, `breath/07-reduced-motion-breath-active.png`.

**Close mid-breath:** closed the ritual ~1.5s into an active breath; waited past the point the
breath would have naturally completed. No further console activity or errors fired late, and the
day-flow stayed closed — confirms `breathInst.stop()` in `closeDayFlow()` actually tears the timer
down rather than leaving it running in the background.

### 2.3 Review mode (completed day, read-only) — verified
Completed Day 1 for real (all 7 steps, then the post-ritual "Done for today" celebration screen,
which is what actually advances `state.day` — confirmed `db_active_journey.day` became `2`).
Day 1's dot became `done tap` (clickable). Opening it:

- Shows the visible badge **"Reviewing a completed day · Read only"**.
- Opens at review-step 1; `#castBtn` is hidden (inert), matching `.dayflow.reviewing` CSS.
- A **"Next"** text link pages forward through the reviewed steps (confirmed step 1 → 2).
- The persistent exit button reads **"Back to Today"** (fixed during this pass — see §5).
- Exiting review does not change `db_active_journey.day` (stayed `2`).

Screenshots: `review/00-…` through `review/03-…`.

### 2.4 Support / crisis sheet — verified
From step 3, opened `#dfHelp`: sheet opens, focus moves to its heading (`#supportTitle`, ~60ms
after open, matching the deliberate deferred-focus pattern already used elsewhere in this file).
`Escape` closes it, focus returns to `#dfHelp`, and the ritual is still on the same step it was on
before the sheet opened (step 3). Verified the Escape key does **not** also close the whole ritual
underneath it (see §5 for the guard this required). Screenshots: `support/01-…` through `04-…`.

### 2.5 Resume — verified
Advanced to step 4 (post-Cast-Off), closed via X, refreshed the page: the home screen's resume
card is present; clicking "Continue" reopens the ritual at **the exact step left off (step 4)**.
Screenshots: `resume/01-home-continue-card.png`, `resume/02-restored-exact-step.png`.

### 2.6 Keyboard operability and focus — verified, with one real bug found and fixed
Tabbed through the ritual with no mouse: reached and activated `#dfComplete` with `Enter`
(advanced step 1 → 2 correctly). Screenshots `accessibility/02-04` show visible browser-default
focus rings on the help button and the verse-reference link.

**Real bug found and fixed:** before this pass, `#dayflow` had no focus-trap and no Escape
handling at all, and opening it never moved focus into the dialog — Tab leaked straight through to
the page underneath. Confirmed via `git show 54d5542:src/pages/journey.astro` that this gap
predates B3.2 (it's not something this milestone introduced), but it's squarely inside this
milestone's "accessibility and focus behavior" requirement, since `#dayflow` is now the one
dialog the user spends the whole ritual inside. Fixed by mirroring the exact pattern already used
for the Day-Opening screen and the new support sheet: focus now moves to the step's sr-only
heading on open, Tab is trapped to the dialog's visible controls, and Escape closes it (verified
this doesn't fight the support sheet's own Escape handling when the two are nested — see §5).
Re-ran the full step-flow and support-sheet tests after the fix; both still pass with no
regressions.

### 2.7 Responsive — verified across all 7 required targets, both themes
Screenshots captured for step 1 and the gated step 3 at every target, in both light and dark:

- 390×844, 390×667 (`mobile/`)
- 768×1024 portrait, 1024×768 landscape (`tablet/`)
- 1440×900, 1728×1117 (`desktop/`)
- 200% zoom (simulated via a 640×450 viewport, `accessibility/01-200pct-zoom-step1.png`)

Desktop/tablet (≥768px) show the app visibly dimmed and blurred behind a centered, bounded ritual
card — reusing the exact B2.2 `.jo-card`/`.jo-back` pattern, confirmed visually in every desktop
and tablet screenshot. Mobile shows the full-bleed surface. Step 4 (breath), step 6 (reflect
textarea, focused), and step 7 were additionally captured at `mobile-390x667` and
`desktop-1440x900` in both themes (`light/`, `dark/`).

## 3. Manual visual inspection

All screenshots listed above were opened and visually reviewed (not just captured) for: correct
theme tokens (forest/cream in light, gold/dark in dark), correct label text per step, gate-hint
text present whenever the primary button is disabled, step-dot rail rendering, and the
desktop/tablet dimmed-backdrop treatment. No visual regressions or token mismatches found.

## 4. Inferred behavior (reasoned from code, not independently live-tested this pass)

- **Spanish (`esL()`) strings** — read in source for every new/changed string (step chrome,
  review badge, support sheet via existing `crisis.*` keys, "Back to Today" → "Volver a Hoy") and
  confirmed to follow the file's existing ternary convention, but the UI itself was not
  live-toggled to Spanish and screenshotted this pass.
- **Day 2+ sign-in gate** — unchanged, pre-existing `ensureSignedIn()` gate in `openDayFlow()`;
  not exercised live since it required completing Day 1 and choosing to walk into Day 2, which is
  out of this milestone's scope to test end-to-end.
- **Browser back/forward button** while the ritual is open — not exercised; the ritual is a
  same-document overlay with no history entry (consistent with every other sheet/overlay in this
  file), so the existing behavior should be unaffected by this change.

## 5. Real issues found during this verification pass, and what was done

Two genuine defects surfaced through live testing (not from re-reading the spec) and were fixed
in `src/pages/journey.astro`, then re-verified:

1. **`#dayflow` had no focus trap, no Escape handling, and never moved focus in on open.**
   Pre-existing (confirmed against the `54d5542` baseline, not introduced by B3.2), but in scope
   for this milestone. Fixed with a new `openDayFlowA11y()` / `dayflowKeydown()` pair mirroring
   the file's own established `dayOpenKeydown`/`supportKeydown` pattern, including a guard so it
   stands down whenever the support sheet is open on top of it (otherwise both listeners would
   fire on the same `Escape`/`Tab` press and fight each other).
2. **Review mode's exit button read "Back to today" (lowercase) instead of the approved spec's
   "Back to Today."** Fixed in both languages; the Spanish string already matched the correct
   convention (`journey.previewBackToday`: "Volver a Hoy"), so the fix aligned the new string to
   the existing one rather than inventing new casing.

## 6. Additional work requested during review — shared bottom nav bar redesign (not journey.astro)

This work happened in two steps, both on the shared bottom nav bar used by every Declare page
(Word/Journey/Declare/Vault/You) — none of it is specific to `/journey` or to B3.2's file scope,
and none of it touches `src/pages/journey.astro`.

### 6.1 First pass: the Declare disc's clipped top

Jeff flagged a visual bug from a `/journey` screenshot: the raised gold circle behind the
"Declare" tab's icon looked sliced across the top. Root cause: the circle
(`.tab.center .tdisc`) was deliberately lifted `margin-top:-14px` above the tab row, needing more
top clearance than that once its glow was included; `declare.css`'s own base `.tabbar` rule gave
it enough (`padding-top:18px`), but `src/layouts/DeclareLayout.astro`'s separate mobile-only
override of the same `.tabbar` selector independently set `padding-top:10px` — 8px short — so the
disc's top rendered past the bar's own edge, right where that override's `border-top` line cut
across it. Confirmed pre-existing (via `git show 54d5542:...`), not introduced by B3.2.

### 6.2 Second pass: full redesign, matching a reference screenshot of the Open app

Jeff then shared a screenshot of Open's bottom nav side-by-side with ours and asked directly
whether ours read as premium or cheap by comparison — it read as busier: a large 54px gold circle
with a blurred glow on Declare, versus Open's quiet, uniform small icons and a label shown only on
the active tab. Presented three options (match Open closely / keep the disc but tone it down /
just resize); **"Match Open closely" was chosen.**

Changes made, in `public/declare/declare.css`, `public/declare/motion.css`,
`src/components/TabBar.astro`, and `src/layouts/DeclareLayout.astro`:

- **Removed the raised Declare disc entirely** — `.tab.center .tdisc` no longer has its own
  width/height/circle/background/glow; the Declare icon is now the exact same size (22px) and
  stroke-width (1.7, was 1.9) as the other four tabs, and its wrapper `<span class="tdisc">` stays
  in the markup but carries no styling of its own anymore.
- **Labels now show only on the active tab** — `.tab .tlbl` defaults to `opacity:0` (still present
  in the DOM and the accessible name, just visually hidden) and only the `.on` tab reveals it.
  The label's layout box stays reserved either way, so the icon's vertical position never shifts
  between active and inactive tabs.
- **The quiet gold dot under the active tab, previously excluded from Declare** (`.tab.on:not(.center)::after`),
  **now applies uniformly to all five tabs** (`.tab.on::after`), since Declare no longer has its
  own separate on/off treatment to conflict with.
- **A dead animation was found and removed**: `public/declare/motion.css` had a `m-orb-breath`
  keyframe animation (a 5-second pulsing glow) built specifically for the raised disc, gated to
  `prefers-reduced-motion:no-preference` and `max-width:480px`. It kept re-adding the glow via
  animation even after the static CSS was changed to `box-shadow:none` — animations override
  static property values for whatever they animate, so this had to be found (via enumerating
  matched CSS rules live in the browser, not just reading the two files already edited) and
  deleted along with its now-meaningless reduced-motion override line.
- **The bar's background was softened** from a solid, 90%-opaque frosted panel with a hard
  `border-top` line (`DeclareLayout.astro`'s mobile override) to a soft gradient fade with no hard
  edge, closer to Open's nearly-invisible bar and to `declare.css`'s own original, softer base
  treatment (the fixed positioning needed for real scrolling pages was kept — only the visual
  weight changed).

**Verified live**, both themes, across `/journey`, `/today`, `/word`, `/vault`, `/you` at
390×844 — screenshots in `docs/verification/screenshots/release-b-tabbar-redesign/`
(`redesign-{light,dark}-{journey,today,vault,you,word}-{full,crop}.png`). Confirmed: no console
errors on any of the five pages; the desktop/tablet left-rail sidebar (`sidebar.css`, ≥768px) is
completely unaffected — it already had its own separate flat-icon treatment for Declare and its
own always-visible labels, neither of which this change touches.

## 7. Additional work: distinct per-day Day-Opening backgrounds (not journey.astro's B3.2 scope, but same file)

Jeff checked whether the approved B2.2 Day-Opening mockup (5 distinct per-day photos, a
heavy-to-golden mood arc) had actually been implemented. It had only been partially built: the
mockup's layout/copy/progress-rail/CTA/close were all faithfully shipped, and a real photographic
background was used (not flat color) — but it was **one single shared image** reused for all 5
days and both themes, with the per-day photo variety explicitly deferred to "a future B3
production task" per the B3 spec doc. Per Jeff's explicit direction, that deferred piece was
built now:

- Generated 5 new, distinct images (`public/declare/journey-bg-day1.jpg` through `day5.jpg`) via
  nano-banana, using `tree-alive.jpg` as the style reference so they stay in the app's own
  established painterly forest/Tree-of-Life visual world rather than importing the mockup's
  literal scenes (misty mountains, lake reflection) or generic stock photography. The 5 form one
  cohesive mood arc: day 1 dense/dark/enclosed → day 2 breakthrough beams → day 3 opening
  clearing with new-growth buds → day 4 wide open grove with soft mist and strong side-light →
  day 5 golden-hour clearing with a thriving, fruit-bearing tree. Each generated at 2K then resized
  to 1100px wide / recompressed (quality 78) to land at 88–194KB each, in line with the original
  213KB shared image — the raw 2K generations were 1.6–2.4MB each, which would have hurt load time
  on the exact "3am user on their phone" this app is built for.
- **Deliberately keyed by day position (1–5), not by struggle** — a user's day-3 background looks
  the same regardless of which of the ~29 struggle journeys they're on. This is what makes "a
  small, shared, reusable pool instead of hundreds of struggle-specific images" possible; the
  distinction (and the option to later build real per-struggle/dynamic generation via Convex) was
  discussed with Jeff and he chose to ship this static, day-keyed version now.
- `renderDayOpening()` (`journey.astro`) now sets a `--jo-bg-img` CSS custom property per day,
  clamped defensively to `[1, TOTAL]`; `.jo-card`'s background reads that variable with
  `journey-bg-day1.jpg` as its own CSS-level fallback for the instant before first render.

**Verified live**: all 5 days' Day-Opening screens captured by directly advancing
`db_active_journey.day` in localStorage (bypassing the real multi-day completion flow purely for
test-speed) and reopening via "Continue" — confirmed each shows its own distinct image
(`docs/verification/screenshots/release-b-dayopen-check/dayopen-NEW-day{1-5}.png`), confirmed in
light theme (screen intentionally stays dark-forest-themed regardless of the site's light/dark
toggle, matching the original design decision) and at tablet width (1024×768, confirming the
existing dual-role mobile-surface/desktop-dialog pattern still works with the new backgrounds).
No console errors across any of these checks.

**Left as-is, flagging for Jeff's call:** `public/declare/dayopen-bg.jpg` (the original single
shared image) is now unreferenced by any code. Not deleted — it's a real asset that might be
linked elsewhere (social preview, an email, a doc) — but worth a deliberate decision rather than
silent removal.

## 8. Broad audit: does the code match everything discussed/approved in `docs/design`?

Per Jeff's request to "go back in history," a full pass compared every claim in `docs/design/`,
`docs/implementation/`, and `docs/verification/` against the real code (not just each doc's own
"done" checkboxes). Full results given directly to Jeff in conversation; summary for the record:

- **One substantial, real gap**: the B3 seven-step spec has a fully-approved product model for
  Step 6 (Reflect) — Vault persistence plus an optional AI "Gentle Guidance" response with its own
  consent flow and crisis-detection requirement — that was never built. Not a surprise: this is
  exactly the already-planned "B3.3 Reflection Draft and Vault Persistence" milestone. `TODO.md`'s
  existing note on this describes an older, superseded version of the plan and should be refreshed
  when B3.3 starts.
- Two more items in the same spec, both explicitly labeled non-core by the doc itself: personalized
  per-struggle-per-day backgrounds (~150 images, deferred as a separate asset-production
  workstream — the same category as §7 above, just scoped even larger) and a "Scripture
  Follow-Through" breadcrumb (deferred pending separate approval).
- Everything else audited — B1, B1.5A, B1.5B/B1.5B.1, B1.5C, B2.1, the desktop shell, the Results
  redesign, and the accessibility-polish remediation pass — was confirmed actually shipped and
  matching its documentation.

## 9. Not available in this environment

- No real screen-reader (VoiceOver/NVDA/TalkBack) pass — only DOM semantics (`aria-hidden`,
  `inert`, `role="dialog"`, `aria-modal`, `aria-labelledby`, the sr-only step text) were inspected
  and exercised via the accessibility tree implied by focus/keyboard testing above. This is not
  the same as confirming actual screen-reader announcement behavior.
- No OS-level "larger text" / Dynamic Type test — only browser 200% zoom was checked.
- No automated regression suite exists in this repo to re-run on future changes (see §1).
