# Release B — B3.1 Seven-Step Journey: Existing-System Audit

*Phase 1 of B3.1. Read-only inspection — no production code was modified to produce this document.
Line numbers reference `src/pages/journey.astro` at commit `32aabcf`.*

---

## 0. The single most important finding

**The current production "seven-step Journey" is not seven screens. It is one continuously-scrolling
page.** `renderDayFlow()` (line 657) builds all seven blocks — Receive, Pray, Cast Off, Repent &
Breathe, Declare, Reflect, Act — as one HTML string and injects it into `#dfScroll` in a single
`innerHTML` assignment (lines 677–713). There is no per-step routing, no "Step N of 7" pagination, no
step-to-step "Continue" action, and no per-step "Back." The user opens `#dayflow` once and scrolls
through all seven blocks in one continuous, top-to-bottom document.

Everything else in this audit should be read in that light: the B3 mockups propose a **paginated,
one-step-at-a-time ritual shell** (`Day N of 5 · Step N of 7`, per-step Back/Continue, a 7-dot progress
rail). That is a genuine, not-yet-built product direction, not a re-skin of something that already
works this way. The design-only prototype in Phase 2 recreates the *proposed* paginated experience
using real content and mechanics; this audit documents the *current* single-scroll reality so the gap
is explicit before any production implementation is planned.

---

## 1. Real step names, headings, and content fields

Verified against `renderDayFlow()` (lines 677–713) and the `JOURNEY_CONTENT` shape in
`public/declare/journey-data.js` (e.g. lines 61–70).

| # | Real internal label (`.lab`) | PLAN field(s) used | Notes |
|---|---|---|---|
| 1 | "Receive" (`journey.*` not localized via key — inline `esL()` ternary) | `d.ref`, `d.ver`, `d.verse`, `d.insight` | Reference is a tappable link (`vref-link`) to `/word?book=...` |
| 2 | "Pray" | `d.prayerTitle`, `d.pray` | Pure reading block, no interaction |
| 3 | "Cast off the lie" | `d.castOff` | Interactive: `castBtn` toggles `dstate().cast` |
| 4 | "Repent & breathe" | `d.repent` | Interactive: breath-ring, see §4 |
| 5 | "Declare the truth aloud" | `d.declare` | Interactive: `declCheck` toggles `dstate().spoke` |
| 6 | "Reflect" | `d.reflect` (prompt only) | **Textarea has no `id`, no persistence — see §6** |
| 7 | "Take it into your day" | `d.actionTitle`, `d.action` | Interactive: `actCheck` toggles `dstate().acted`, but does **not** gate completion |

The page-level heading (`.df-h`, `$('dfNm')`) is `d.title` — the day's theme title (e.g. "No
Condemnation"), not a step name. The step names above only ever appear as small uppercase labels
(`.lab`) inside each block, never as a screen title.

**Day 1 only:** an extra `.day1note` welcome banner is injected above the blocks (line 668), explaining
the four-part rhythm in prose. No mockup shows an equivalent — flagged as a real feature the prototype
should preserve, not drop.

## 2. Current layout, primary/secondary actions, completion condition

- **Layout:** one scrollable column (`#dfScroll`), all seven blocks stacked, `max-width:660px` centered
  at ≥481px (line 1768). No card-per-step, no swipe, no forward/back between individual steps.
- **Primary action:** a single page-level "Complete Day N" button (`#dfComplete`) pinned in `#dfFoot` at
  the bottom of the viewport (not the bottom of the scroll content) — always visible while a day is
  open.
- **Secondary/back action:** `#dfBack` (top-left, `aria-label="Back to journey"`) closes the *entire*
  day flow and returns to the Journey home. It is not a per-step back — there is no per-step navigation
  to go back *from*.
- **Completion condition** (`refreshGate()`, line 793): `ready = ds.cast && ds.repented && ds.spoke`.
  Only **3 of the 7 blocks gate completion**: Cast Off, Repent & Breathe, Declare. Receive, Pray,
  Reflect, and Act require no interaction and do not block "Complete Day N." The Act block's own
  checkbox (`ds.acted`) is tracked and persisted but never referenced in the gate condition — it is
  functionally optional today, even though visually presented as a checkbox like the others.
- **Progress indicator today:** `#dfDots`, five dots (one per **Journey day**, not per step) in the
  sticky header — there is no 7-step progress indicator anywhere in the current UI.

## 3. Interactive behavior, block by block

- **Cast Off (`bindCast`, line 739):** one tap on `#castBtn` sets `dstate().cast = true` permanently for
  that day/review — no undo, no re-trigger.
- **Repent & Breathe (`bindRepent`/`startBreath`, lines 757–781):** three-state UI the block itself
  manages — `#repentIdle` (Begin/Skip) → `#breathActive` (mounts `BreathRing`) → `#repentDone` (result +
  "Breathe again," which resets back to idle). See §4 for the full breath contract.
- **Declare (`bindSpeak`/`markSpoken`, lines 819–828):** one tap on `#declCheck` sets
  `daySpoken[state.day] = true` and `dstate().spoke = true`. No microphone, no audio, exactly as
  required — a single honest "I said it" tap.
- **Reflect:** no binding function exists at all. See §6.
- **Act (`bindAction`, line 782):** toggles on/off freely (not one-way like Cast Off/Declare), does not
  gate completion.

## 4. Breath-ring contract — audited against `public/declare/breath-ring.js`, not the mockup

The mockup's breath board shows a symmetric 4‑phase cycle (Inhale 4:00 → Hold 4:00 (optional) → Exhale
4:00 → Complete) plus a distinct "Reduced Motion — gentle pulse, no ring animation" mode. **The real
sequence does not match this and must not be copied verbatim:**

- Real sequence, defined inline in `startBreath()` (line 765), **not** the module's own `ARRIVE`
  default: `Breathe in mercy` (4s) → `Hold` (2s) → `Release the old` (6s) — asymmetric timing, repeated
  `BREATH_ROUNDS = 3` times (9 phases total), with a live "Breath 1 of 3" / "Breath 2 of 3" / "Breath 3
  of 3" counter (`onPhase`, line 776).
- **"Ready" is not a `BreathRing` phase.** It's `journey.astro`'s own `#repentIdle` block (a "Begin
  breath prayer" button + a "I can't breathe deeply right now — skip" link), shown *before* `BreathRing`
  ever mounts.
- **"Complete" is not a `BreathRing` phase either.** `journey.astro` hides `#breathActive` and shows its
  own `#repentDone` block, with **two distinct completion texts** the mockup doesn't distinguish:
  breathed-through → *"Amen. You breathed out the old."*; skipped → *"Held for today. The Spirit meets
  you here."* Both offer a "Breathe again" reset.
- **Reduced motion is not a separate visual mode.** `breath-ring.js` (line 18, `RM`) detects
  `prefers-reduced-motion: reduce` and sets the CSS transition duration to `0s` (line 73) — the ring and
  glow jump instantly between scale states instead of animating, while the countdown number and phase
  label continue updating in real time on the same 4/2/6-second clock. There is no "gentle pulse"
  alternate animation; motion is simply removed, pacing is preserved.
- **Hold is not optional** in the real code (the mockup labels it "(optional)") — it always runs as the
  second of three phases.

**Product decision made live during the B3.1 review (not yet applied to production):** Jeff reviewed
the 3-round real sequence in the prototype and requested it be shortened to **1 round** for the
proposed B3 design. The prototype has been updated to reflect this (the round counter is hidden
entirely when only 1 round is configured, since counting a single round adds nothing). Production
`journey.astro`'s `BREATH_ROUNDS = 3` constant was **not** touched — this phase is design-only. Carry
this decision into the B3 production implementation prompt as an explicit, approved change (reduce
`BREATH_ROUNDS` from 3 to 1), not something to rediscover later.

## 5. Reflect (Step 6) — the known gap, audited precisely

`renderDayFlow()` line 709:
```html
<textarea placeholder="Write freely. This is between you and God."></textarea>
```
This element has **no `id`, no `name`, no event listener anywhere in the file** (confirmed by
`grep`/full-file read — no `bindReflect` function exists, unlike every other interactive block). It is
never read on "Complete Day N," never saved to `localStorage`, never restored on return, and is wiped
completely on every `renderDayFlow()` re-render (leaving a step, coming back, or the `ensureDay()`
hybrid-upgrade re-render all recreate the DOM from scratch). This was already logged to `TODO.md` during
B2.2 QA (unrelated milestone) as a confirmed, pre-existing gap against the original B3 product spec,
which explicitly required local persistence, restore-on-return, and "Saved privately on this device"
language. **Not fixed in this phase** — see the Reflection Persistence Recommendation in the completion
report for the proposed B3 implementation behavior.

One additional nuance found in this audit: in `.dayflow.reviewing` mode the textarea is only dimmed via
`opacity: .7` (line 1875, CSS-only) — it is not `disabled` or `readonly`. A user reviewing a completed
day could technically type into it, though it changes nothing (never read, and review mode has no
completion gate).

## 6. Day-Opening → Step 1 transition (the real B2.2/B3 seam)

Confirmed in `src/pages/journey.astro`, B2.2's `openDayOpening()`/`doBegin` handler:
```js
$('doBegin').addEventListener('click', function () { closeDayOpening(); openDayFlow(); });
```
`closeDayOpening()` removes the `.open` class from `#dayOpen` (opacity/visibility transition, ~380ms)
and immediately calls `openDayFlow()` — no artificial delay is inserted between the two. `openDayFlow()`
then re-applies its own gates in this order: (1) Day 2+ sign-in nudge (`ensureSignedIn`), (2) the pacing
lock check, (3) `#dayflow` opens with either the already-cached day content or a "Jesus is preparing the
way for today" loading state while `ensureDay()`'s AI call resolves. The transition is a same-page DOM
swap, not a route change — no history entry, no reload.

## 7. Forward/back, browser Back, close, focus

- **Forward navigation:** none exists between the 7 blocks (see §0) — the whole day is presented at
  once, so "forward" is scrolling, not a button.
- **Close (`#dfBack`):** always closes the *entire* day, returns to Journey home. No confirmation dialog
  (unlike, say, Preview's cancel flow).
- **Browser Back:** `#dayflow` does not use `history.pushState`. Browser Back simply navigates away from
  `/journey` — consistent with every other overlay in this file (B2.2's audit found the same for
  `#dayOpen`).
- **Focus:** no explicit focus management exists when `#dayflow` opens or closes — no `.focus()` call on
  open, no restoration on `#dfBack`. This is a real, pre-existing accessibility gap distinct from (and
  in addition to) the B2.2 Day-Opening focus-timing bug that *was* fixed. Not touched in B3.1; documented
  for the B3 implementation to address.

## 8. Reflection persistence, completed-day review, resume, locks, sign-in — cross-referenced

- **Storage keys in play** (all pre-existing, none touched by B3.1): `db_active_journey` (which
  struggle/day/returned-count), `db_journey_lock` (one-day-per-day + optional reminder time),
  `db_journey_inst:<id>` (per-journey cache: seed, AI-upgrade flags, `PLAN`, `dayState`, `daySpoken`,
  language — this is what "resume" actually restores).
- **Resume:** `restoreInstance()` (line 493) reads `db_journey_inst:<id>` back into `PLAN`/`dayState`/
  `daySpoken` on init; `restoreProgress()` reads `db_journey_lock` back into `state.day`/`state.returned`.
  Together these reconstruct exactly where a user left off — **except the reflection text**, which was
  never part of `dayState` and is not saved (see §5).
- **Completed-day review (`openReview(day)`, line 855):** sets `reviewDay`, opens `#dayflow` directly
  (bypassing Day-Opening entirely — confirmed unchanged since B2.2), and `renderDayFlow()` forces
  `ds.cast = ds.repented = ds.spoke = ds.acted = true` for display so every block reads as completed.
  `refreshGate()` special-cases `reviewDay`: the complete button is always enabled and its label changes
  to "Back to today" / "Volver a hoy" — clicking it just closes, **it never re-completes or mutates
  `db_active_journey`**. Interactive controls are hidden/disabled via `.dayflow.reviewing` CSS (cast
  button, breath-skip link, "breathe again," and `pointer-events:none` on the act-check).
- **Date locks:** `isLocked()` — one calendar day per Journey day, checked in two places:
  `openDayFlow()` itself (toasts and refuses if locked) and now also in B2.2's `openDayOpening()`
  wrapper (added in B2.2, falls through to the same real check rather than duplicating it).
- **Sign-in gate:** Day 1 is anonymous; `state.day >= 2` requires `ensureSignedIn()` — a non-blocking
  toast-with-CTA (`auth-gate.js`), not a hard wall. Confirmed unchanged.
- **Sensitive-struggle behavior:** entirely upstream of the seven-step flow (B2.1's care gate, before
  Preview). Nothing inside `#dayflow` itself re-checks sensitivity — by design, the gate is a one-time
  acknowledgment at journey start, not a per-day/per-step repeat.

## 9. Crisis/help access — confirmed absent inside the ritual

Searched the entire file for "crisis": the **only** crisis link in `journey.astro` is `#careTalk` inside
`#careSheet` (`href="/crisis"`), shown once, only for the 6 sensitive struggles, only before Preview —
never inside `#dayflow`. **There is no reachable crisis/help control anywhere inside the seven-step
ritual today.** This matches a gap already named in the original Release B redesign brief ("the audit
found that the full-screen ritual hides the global crisis link... add a quiet, always-reachable
crisis-help control") — B2.1 and B2.2 did not address it (out of scope for those milestones); it remains
open. The B3 mockup's "Crisis/Help Access" board is therefore proposing a **genuinely new** in-ritual
control, not recreating an existing one. The prototype represents this clearly as new, and reuses only
the real resource list already on `src/pages/crisis.astro` (Call 988, Text 988, Call 911, Crisis Text
Line/741741, 988lifeline.org, care@declareandbelieve.com) — no invented categories, hotlines, or copy.

## 10. Localization

Every string in `renderDayFlow()` is inline `esL() ? 'Spanish' : 'English'` ternaries — there is no
`journey.step*` key family in `i18n-strings.js` for these blocks (unlike the Day-Opening/Preview screens,
which do use the `journey.*` dictionary + `data-i18n`). Day content itself (`d.title`, `d.verse`, etc.)
is either the authored English bank or AI-upgraded in the active language by `ensureDay()` — same
caveat already documented in B2.2's TODO entry: falls back to English if the Worker call doesn't
complete.

## 11. Current accessibility concerns (beyond §7's focus gap)

- No `role`/`aria-live` announcement when a block's state changes (e.g., "Cast off" completing) —
  visual-only feedback (checkmark, color).
- The three gating requirements (cast/breathe/speak) are only described via a single dynamic hint line
  (`#dfLock` / `.lockhint`) at the very bottom of the viewport — a user who hasn't scrolled that far has
  no way to know completion requires anything beyond scrolling.
- `.reviewing` mode dims disabled controls via `opacity`/`pointer-events` (CSS-only) — no `aria-disabled`
  or `disabled` attribute is set on the visually-inert controls.

## 12. Current responsive concerns

- Single breakpoint tier (`@media (min-width:481px)`) caps the scroll column at 660px and adds side
  padding — no distinct tablet vs. desktop treatment, and (per §0) no centered-card-over-dimmed-backdrop
  treatment at any width the way B2.2's Day-Opening now has. `#dayflow` is a full-bleed solid takeover
  at every viewport, sidebar included.
- No dedicated short-height (390×667-class) handling beyond normal scroll — acceptable today only
  because there's no fixed per-step content forcing a single viewport height.

---

**Audit complete. No production files were modified to produce this document.**
