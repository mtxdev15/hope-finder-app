# Accessibility & Polish Remediation Summary

*A small, scoped remediation pass fixing exactly the five findings from
`docs/verification/current-branch-verification-report.md`. Not a redesign, not a refactor. Branch
`redesign/desktop-web-shell`. Nothing was committed, pushed, merged, or deployed. No packages
installed. No prompts, Convex schema, Workers, environment files, authentication, deployment
config, `TODO.md`, or worktrees touched.*

## Findings addressed

1. Interactive touch targets below 44px (struggle chips, "More +", mobile tab bar).
2. Hidden Rate & Review modal controls remaining keyboard-focusable when closed.
3. Newly saved Vault item incorrectly showing "1h ago" instead of "Just now."
4. Intake textarea's focus-visible styling strengthened with a keyboard-specific ring.
5. `PRODUCT.md` / `DESIGN.md` touch-target documentation conflict (44px vs. 36px).

## Files changed

`git diff --stat` (full output in §"Commands run and results" below):

- `public/declare/declare.css` — shared `.chip` and mobile `.tab` rules (Finding 1)
- `src/components/RateReview.astro` — added `inert` to the closed-by-default sheet (Finding 2)
- `src/app/declare/rate-review.js` — focus trap, focus-on-open, focus-restore-on-close (Finding 2)
- `src/pages/vault.astro` — `relTime()` formatting fix (Finding 3)
- `src/pages/today.astro` — keyboard-specific focus ring on the intake textarea (Finding 4)
- `PRODUCT.md`, `DESIGN.md` — one clarifying sentence each (Finding 5)

`TODO.md` shows in `git status`/`git diff --stat` only because of its pre-existing, unrelated
modification from before this task began — not touched in this pass.

## Exact implementation decisions

### Finding 1 — touch targets

Added to the base `.chip` rule (`declare.css`): `min-height: 44px; display: inline-flex;
align-items: center; justify-content: center;`. This is the single shared rule every chip variant
inherits (`.chip.on`, `.chip.more`) — no per-context override needed, and `.chip.more` (measured at
just 29px before, for reasons that couldn't be fully traced back to a specific conflicting rule) is
fixed by the same change since it carries no separate padding/font-size override. `display:
inline-flex` + centering was necessary, not optional — without it, a button whose natural
(padding-driven) height is shorter than the new `min-height` floor would top-align its label instead
of centering it.

Added `min-height: 44px; justify-content: center;` to the base mobile `.tab` rule (≤480px only —
the 481–1023px `.app-shell .tab` variant and the desktop sidebar weren't measured as failing in the
report, so weren't touched).

Growth was 3–6px for regular chips/tabs (was 38–43px, now 44px) and larger for "More +" (29px→44px).
Existing chip gaps (8–9px) comfortably absorb this with no overlap. Chips that already wrap to two
lines (longer taxonomy labels in the "More" sheet) naturally exceed 44px from their own content —
`min-height` is a floor, not a ceiling, so this is unaffected and correct.

### Finding 2 — Rate & Review modal focusability

- **Closed state:** added the `inert` HTML attribute directly to `<section id="rrSheet">` in the
  markup (not just toggled via JS), so it's non-tabbable and non-hit-testable from first paint,
  before any script runs.
- **Open:** `open()` now captures `document.activeElement` as `opener` before doing anything else,
  sets `sheet.inert = false`, and moves focus to the first star of the now-visible step 1 (not the
  close button, and not the non-focusable `<section>` itself, which is what the previous code tried
  and which silently did nothing) — the star rating is the dialog's actual content, so that's what a
  keyboard/screen-reader user should land on.
- **While open:** a new `trapFocus()` keydown handler constrains Tab/Shift+Tab to the sheet's
  currently-visible focusable elements (hidden `<section data-step>` steps are already excluded from
  the tab order by the browser, so no extra bookkeeping was needed there). Escape-to-close was
  already implemented and is untouched.
- **Close:** `sheet.inert = true` is restored, and focus returns to `opener` (whatever had focus
  before the dialog opened), then `opener` is cleared.
- **Dialog semantics:** `role="dialog"`/`aria-modal="true"`/`aria-label="Rate Declare"` already
  existed in the markup and needed no change — they were just undermined by the missing focus
  management, which is now fixed. Background pointer interaction was already blocked correctly by
  the existing scrim (`pointer-events: auto` + full-viewport `position: fixed` when open); no change
  needed there.

### Finding 3 — Vault relative timestamp

Root cause confirmed by direct investigation: `vault.astro`'s `relTime()` computed a day-fraction
(`d = (Date.now()-ts)/86400000`) and, for anything under a day old, ran
`Math.max(1, Math.round(d*24))` — the `Math.max(1, …)` floor meant ANY elapsed time under a day,
even a few seconds, always rendered as at least "1h ago." This was a pure formatting/rounding bug in
a client-side function, not a stored-data problem — the saved `ts` values are correct epoch
milliseconds (confirmed by inspecting a real saved item). `today.astro` already has its own,
already-correct version of this same function for its "Recent Words" rail, which is why this bug was
isolated to `vault.astro` alone.

Fix: replaced only the `d < 1` branch with a proper millisecond-based tier (Just now / Xm ago / Xh
ago), diff clamped to `Math.max(0, …)` so a future-dated/clock-skewed `ts` can never produce a
negative relative time. The existing "Yesterday" / days / weeks branches are untouched.

### Finding 4 — textarea focus-visible

Implemented exactly the pattern Jeff specified: `.entry-input:focus-within { border-color: var(--gold); }`
(already existed, unchanged) plus a new `.entry-input:has(textarea:focus-visible) { box-shadow: 0 0 0
3px color-mix(in srgb, var(--gold) 35%, transparent); }`. `color-mix()` keeps the ring theme-aware
(works in both the light "dawn" and dark default themes without hardcoding a specific rgba). The
native `outline: none` on the textarea (pre-existing, `today.astro:959`) is left in place, since this
ring plus the existing border-color change together is now a clearly visible, non-color-only (shape,
not just hue) replacement.

**Honest browser-behavior note, as requested:** `:focus-visible` on an `<input>`/`<textarea>` is
specified (and implemented consistently across Chromium, Safari, and Firefox) to match on **both**
keyboard and pointer-triggered focus, not keyboard-only — this is a deliberate, standard browser
heuristic specifically for text-entry controls (unlike buttons/links, where `:focus-visible`
suppresses the ring for a plain mouse click). I verified this directly: focusing the field via a real
keyboard Tab and via a real mouse click both produced the identical final border + ring state. This
means the ring will appear on mouse click too, which isn't strictly "keyboard-specific" as originally
asked, but it isn't a bug in the implementation — it's the correct, spec'd behavior for a text field,
and arguably the better outcome for this control (a text input's caret position benefits from a clear
indicator regardless of how it was reached). I implemented the exact snippet provided; the deviation
from "keyboard-only" is a property of `:focus-visible`'s text-input heuristic, not a mistake in the
selector. `:has()` support: full in current Chromium and Safari, and Firefox 121+ (this repo already
uses other modern CSS like `color-mix()`, consistent with its existing browser-support baseline); on
an older Firefox the `:has()` rule simply won't match, leaving the existing border-color-only
treatment as the safe fallback — not broken, just less reinforced.

### Finding 5 — documentation conflict

`PRODUCT.md`'s Accessibility & Inclusion section (already correct at 44px) gained one clarifying
parenthetical: the 44px is the interactive hit area, not necessarily the visible control size, and
points to `DESIGN.md`'s Struggle Chips section for the worked example. `DESIGN.md`'s Struggle Chips
section (36px, chip-specific) gained one clarifying sentence: 36px is the visual footprint guidance;
the product-wide 44px hit-area floor from `PRODUCT.md` still applies underneath, reached via
padding/min-height rather than growing the visible pill. Neither document was rewritten or
restructured; both keep their original guidance intact.

## Commands run and results

```
$ git status --short
 M DESIGN.md
 M PRODUCT.md
 M TODO.md                          # pre-existing, unrelated — not touched this pass
 M public/declare/declare.css
 M src/app/declare/rate-review.js
 M src/components/RateReview.astro
 M src/pages/today.astro
 M src/pages/vault.astro
?? docs/

$ git diff --stat
 DESIGN.md                       |  5 ++++-
 PRODUCT.md                      |  4 +++-
 TODO.md                         | 41 +++++++++++++++++++++++++++++++++++++++++
 public/declare/declare.css      | 10 +++++++---
 src/app/declare/rate-review.js  | 36 ++++++++++++++++++++++++++++++++++--
 src/components/RateReview.astro |  2 +-
 src/pages/today.astro           | 13 +++++++++++--
 src/pages/vault.astro           | 11 +++++++++--
 8 files changed, 110 insertions(+), 12 deletions(-)
```

- **Formatting / lint / type-check:** still unavailable (no scripts, no configs — unchanged from the
  original verification report), not run, per scope (no packages installed).
- **`npm run build`:** clean, exit 0, all 11 pages built, no errors.
- **Route checks:** all 11 routes re-confirmed 200 (404 confirmed for an unmatched route).

## Browser verification results

**Desktop (1440×1000):**
- Chip/tab measurements: every chip and mobile tab-bar item is now exactly 44px tall (was 38–43px);
  "More +" is 44px (was 29px). No visual size change perceptible in a side-by-side screenshot
  comparison; no wrapping/overlap change.
- Modal focus trap: from a fresh load, Tab correctly skips the closed Rate & Review sheet entirely
  (11 tabs reach the sidebar collapse button directly, versus reaching into 6 hidden modal controls
  before this fix). Opening the modal (`window.__declareRate.open(...)`) moves focus to the first
  star; Tab from the last star wraps to the close button (not out to the sidebar); Shift+Tab from the
  close button wraps to the last star (not out to background content); Escape closes it and restores
  focus to whichever control had focus before opening — verified with `#receiveBtn` as the opener.
- Textarea focus ring: confirmed via real keyboard Tab and via a real mouse click — both produce a
  clear gold border plus a `color-mix()`-based glow ring, visible in the app's default dark theme.
  Screenshot: `screenshots/remediate-focus-ring.png`.
- Reduced motion: re-confirmed unchanged — the route loader's animations and the Breakdown
  accordion's `transition-duration: 0s` both still apply exactly as before this pass (neither file
  touched).
- A pre-existing, known, intermittent AI JSON-formatting flake (the model omitting an `"application":`
  key in one `breakdowns` entry) occurred once during testing and was retried successfully — this is
  unrelated to any change in this pass (`declare-api.js` was not touched) and was already documented
  as a known gap in the original Phase 2 implementation summary.

**Tablet (768×1024):** intake and chip layout confirmed visually unchanged
(`screenshots/remediate-tablet-intake.png`); no overflow, no clipped controls, crisis link visible.

**Mobile (390×844):** chip/tab hit areas confirmed 44px with no visual regression
(`screenshots/remediate-mobile-chips.png`); the "More +" full taxonomy sheet re-opened cleanly with
no wrapping/overlap issues at the larger hit-area size (`screenshots/remediate-mobile-sheet.png`).

**Vault "Just now" fix:** saved a fresh word, navigated to `/vault` immediately, and confirmed the
item reads "16 truths · Just now" (previously would have read "1h ago"). Tested against the local
**dev** Convex deployment only (`good-dotterel-906.convex.cloud`, confirmed via `.env.local` before
testing, not production).

**Console / network:** no new errors or failed requests introduced by this pass. The only recurring
console message across the whole verification was the same pre-existing, dev-server-only "Outdated
Optimize Dep" 504 noise documented in the original report (not present in production builds).

**Crisis-help visibility:** confirmed present and unchanged at every viewport and every screenshot
taken in this pass.

## An honest note on the original report's "screenshot artifact" finding

While re-testing "More +" at mobile width in this pass, I saw the exact "What's on your heart?" /
category-header content again — and this time confirmed it is 100% real, existing app content (the
full struggle-taxonomy sheet, opened deliberately via `#moreBtn`), not fabricated. My original
verification report's specific claim — that at the moment of that particular tablet screenshot, both
the entry sheet and the Rate & Review sheet were genuinely, simultaneously open in the live DOM — is
unaffected by this: I directly measured both elements' computed style (`opacity: 0`, `visibility:
hidden`, no `.open` class) immediately after that screenshot and found both closed, and my repository
search for the literal category-label strings still finds no static text (they're likely built from a
data structure rather than literal markup, which is why the search came up empty even though the
content is real). The most defensible read remains: the sheet's content is real, but the specific
screenshot in question most likely captured a `fullPage` stitching artifact of a `position: fixed`
element rather than two real, simultaneously-open modals. Flagging this nuance for completeness
rather than letting the earlier note stand unqualified.

## Unresolved issues

None from the five in-scope findings. Two things worth knowing, out of scope for this pass:
- The pre-existing intermittent AI `breakdowns` JSON-formatting flake (unrelated to any file touched
  here) remains unfixed — it was already flagged in the Phase 2 implementation summary as a
  `declare-api.js` robustness gap worth hardening separately.
- `DESIGN.md`'s 36px chip guidance and `PRODUCT.md`'s 44px hit-area rule are now cross-referenced
  and reconciled in prose, but neither document was otherwise audited for other, unrelated
  inconsistencies — this pass touched only the specific conflict identified in the verification
  report.

## Rollback instructions

All eight changed files are plain, uncommitted working-tree edits on `redesign/desktop-web-shell` —
nothing has been committed, so a simple revert of the working tree removes every change from this
pass:

```
git checkout -- DESIGN.md PRODUCT.md public/declare/declare.css \
  src/app/declare/rate-review.js src/components/RateReview.astro \
  src/pages/today.astro src/pages/vault.astro
```

(`TODO.md`'s pre-existing, unrelated modification is intentionally excluded from that list — it
predates this pass and should not be reverted by it.) No Convex, Worker, environment, or deployment
state was touched, so there is nothing to roll back outside the working tree. The one test account
created during the original verification pass (`verify-test-20260722@example.com`, dev Convex
deployment only) now also has a second saved Vault item from this pass's Save test — harmless
dev-only data, not production.
