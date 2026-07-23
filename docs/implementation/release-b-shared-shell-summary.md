# Release B — Shared Left Navigation Shell (B1.5A) Implementation Summary

*Companion to `docs/verification/release-b-shared-shell-verification.md`. Governed by the
responsive-shell audit and correction turns preceding this pass. This is shell work only — no
identity card (B1.5B) or richer crisis card (B1.5C) content was added.*

---

## B1.5A — Responsive Left Navigation Shell (2026-07-23)

### Goal

Migrate the shared nav chrome from "desktop-only left sidebar (≥1024px) / tablet top bar
(481–1023px) / mobile bottom bar (≤480px)" to the approved canonical map:

| Range | Nav treatment |
|---|---|
| 0–767px | Fixed bottom tab bar (unchanged from today's ≤480 experience, now extended) |
| 768–899px | Compact left rail, icon-only, no expand capability |
| 900–1023px | Expanded left rail (~220px), user-collapsible to 72px |
| ≥1024px | Desktop sidebar, unchanged (248px expanded / 72px collapsed) |

### Files changed

**Exactly 3 of the 5 approved files** — `src/components/TabBar.astro` and `public/declare/sidebar.js`
needed no changes (see "Files not touched, and why" below).

```
public/declare/declare.css      | 53 +++++++++++++++------------------
public/declare/sidebar.css      | 66 +++++++++++++++++++++++++++++++++--------
src/layouts/DeclareLayout.astro | 43 +++++++++++++++------------
3 files changed, 101 insertions(+), 61 deletions(-)
```
(`TODO.md`, `public/declare/i18n-strings.js`, and `src/pages/journey.astro` also show as modified
in `git status` — all three are pre-existing, unrelated edits from earlier work in this session,
not touched by this pass.)

### Selector map — exactly what moved, what was removed, what stayed

**Moved (breakpoint extended, same declarations):**
- `DeclareLayout.astro`: `.tabbar{position:fixed;...}` — `max-width:480px` → `max-width:767px`
  (the fixed-bottom-bar rule itself).
- `DeclareLayout.astro`: `.mast{position:fixed;...}`, `.mast .avatar{display:none}` —
  `min-width:481px` → `min-width:768px` (so 481–767px now gets the in-flow, avatar-visible mast,
  exactly matching today's ≤480 mobile experience, instead of the old fixed-top/avatar-hidden
  treatment that belonged to the retired tablet top bar).
- `declare.css`: `.tabbar{padding-bottom:...}` (safe-area clearance) — extracted out of the legacy
  `@media(max-width:480px){.stage/.phone/.screen/.bar/.tabbar}` block into its own new
  `@media(max-width:767px)` rule.
- `sidebar.css`: the entire rail block — `min-width:1024px` → `min-width:768px`.

**Removed outright (obsolete, no replacement needed — a left rail consumes no vertical space, so
nothing needs clearing anymore):**
- `declare.css`: `.app-shell .tabbar` (fixed-top positioning), `.app-shell .tabbar .arc`,
  `.app-shell .tab` (+ `:hover`, `svg`, `.tlbl`, `.on`, `.on .tlbl`, `.center`, `.center .tdisc`,
  `.center svg`, `.center.on .tdisc`), `.app-shell .scroll{padding-top:84px}` — the entire tablet
  top-bar reflow, superseded by the widened rail.
- `DeclareLayout.astro`: `.app-shell .tab.center.on::after` (top-bar-only gold underline, already
  countered by `sidebar.css`'s own `.tab.on::after{display:none}`), `.word .w-col{padding-top:64px}`,
  `.you .you-col{padding-top:64px}`, `.vault .vhero{padding-top:96px}` (top-bar clearance).

**Left untouched (legacy device-mockup system — no `DeclareLayout` page carries these classes, so
they were verified inert; not part of this milestone's scope):**
- `declare.css`: `.stage`, `.phone`, `.screen`, `.bar` at both `max-width:480px` and
  `min-width:481px`, and `.app-shell.stage`/`.app-shell .phone`/`.app-shell .screen`/
  `.app-shell .bar{display:none}` inside the widened-elsewhere block.

**New additions:**
- `sidebar.css`: `@media(min-width:768px) and (max-width:1023px){:root{--sbw:220px}}` — the tablet
  expanded-rail default width, distinct from desktop's 248px.
- `sidebar.css`: `@media(min-width:768px) and (max-width:899px){.app-shell .sb-brand
  .sb-collapse{display:none}}` — hides the collapse toggle at compact width; per your explicit
  instruction, no expand capability exists there in this milestone.

### Files not touched, and why

- **`src/components/TabBar.astro`** — the markup needed zero changes. The DOM order was never
  touched (`.tab-you`/`.sb-crisis` positioning is entirely CSS `order`-driven, already true before
  this pass); the shared `<TabBar>` reflows into all four ranges via CSS alone, exactly as it
  already reflowed into two ranges (mobile/desktop) before.
- **`public/declare/sidebar.js`** — the collapse toggle's click handler (`wire()`/`apply()`/
  `isCollapsed()`) needed no changes; the width-aware default resolution lives entirely in
  `DeclareLayout.astro`'s pre-paint script (see Persistence below), and the toggle button is simply
  hidden via CSS at 768–899px rather than disabled in JS.

### Persistence — `declare-sidebar-collapsed`

Inspected before touching anything: the key has always stored exactly `"1"` or `"0"` (strings,
written by `sidebar.js`'s `apply()`), read via `getItem(...)==="1"`. **No format change** — this
pass adds a third meaningful state (`null`/absent) that the old code couldn't distinguish from
`"0"` because it only ever checked equality against `"1"`.

New pre-paint resolver (`DeclareLayout.astro`):
```js
var raw = localStorage.getItem("declare-sidebar-collapsed");
var w = window.innerWidth;
var collapsed;
if (raw === "1") { collapsed = true; }
else if (w < 900) { collapsed = true; }
else { collapsed = false; }
```
This reproduces the exact current desktop behavior as a special case (any width ≥900, including
every desktop width, resolves `collapsed` purely from `raw==="1"` — identical to the old
`c = raw==="1"` logic) while adding the required tablet behavior:
- No stored value: compact (768–899) / expanded (900+).
- Explicit `"1"`: collapsed at every rail width, 768px and up.
- Explicit `"0"`: honored (expanded) at 900px+; **overridden back to compact at 768–899px**,
  verified live (see verification report) — a device that was previously used only at desktop and
  has `"0"` stored still resolves safely to compact rail if later opened at 834px, exactly as
  specified.

### Rail behavior

- **768–899px**: `--sbw` resolves to 72px (the same collapsed value desktop already uses — no new
  number introduced), collapse toggle hidden via CSS, no way to expand in this milestone.
- **900–1023px**: `--sbw` resolves to 220px by default, user-collapsible to 72px via the same
  existing toggle; verified the explicit choice persists correctly per the rules above.
- **≥1024px**: unchanged — 248px expanded / 72px collapsed, same toggle, same production logo,
  same navigation behavior, verified byte-for-byte against the old resolver logic (see above).

### Content offset

`body.app-shell{padding-left:var(--sbw)}` (already existing, `sidebar.css`) needed no changes
itself — it automatically reflects the new width cascade. The three obsolete top-bar
`padding-top` rules were removed (see selector map); verified live on `/word`, `/you`, `/vault` that
removing them left appropriate breathing room (no dead empty gap, no content crowded against the
top edge) — screenshots in the verification report.

### A real, necessary fix applied within scope: `.sb-crisis` touch target

**Finding:** `.sb-crisis` measured 41px tall in the collapsed/compact state (17px icon + 12px×2
padding) — 3px under the 44px floor. `.tab` elements get a 44px floor from a base rule in
`declare.css` (`min-height:44px`), but `.sb-crisis` doesn't carry the `.tab` class and never
inherited it.

**Why fixed now, not just documented:** this exact CSS pre-existed the collapsed state at desktop
(an opt-in edge case), but 768–899px now makes that state the *default* experience for every tablet
user — squarely inside your explicit "all controls at least 44px" requirement for the compact rail.
Fixed with one line in `sidebar.css`: `min-height: 44px` added to `.app-shell .sb-crisis`, matching
the exact pattern `.tab` already uses. Verified live: 47×44px after the fix.

### A real, necessary fix applied within scope: icon-only accessible names

**Finding:** the collapsed/compact state hid `.tlbl`/`.sb-crisis-label` via `display:none`, which
removes text from the accessibility tree entirely — every nav link (Word, Journey, Declare, Vault,
You, including the You tab's own dynamically-swapped first-name label) had **no accessible name at
all** whenever collapsed. This was already true at desktop's opt-in collapsed state; 768–899px now
makes it the default, so it's no longer a rare edge case.

**Fix:** replaced `display:none` with the standard visually-hidden pattern (`position:absolute;
width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)`) in `sidebar.css`. This keeps the exact
same text — including the You tab's live-swapped name — available to assistive tech while staying
visually absent, with no new `aria-label` duplication needed and no risk of the personalized "You"
tab announcement being lost. Verified live: every rail link's accessible name (`Word`, `Journey`,
`Declare`, `Vault`, `In crisis? Find help now`, `You`) survives collapse.

### Findings surfaced, NOT fixed (per your explicit "do not silently modify route-specific z-index"
instruction — documented for your decision, not applied)

1. **`/today`'s `.sheet-scrim` (declare.css, z-index:40) ties with the rail (`sidebar.css`, z-index:40).**
   Since `<TabBar>` renders after `<slot/>` in `DeclareLayout.astro`, the tie resolves in the rail's
   favor by DOM order — the rail stays fully undimmed/crisp above an open sheet's scrim. **Pre-existing**
   (both z-index values already existed before this pass at ≥1024px); this pass only widened the
   *range* where the rail appears, not the numbers. Verified live with a screenshot — cosmetic, not
   blocking (the sheet itself still renders correctly above everything). Smallest proposed fix:
   bump `.sheet-scrim`'s z-index in `declare.css` from 40 to 41. Not applied — `today.astro` isn't
   in scope and the fix as proposed would need to live in `declare.css` (in scope) but I want your
   sign-off before touching a value with app-wide reach, per your explicit caution.
2. **`/word`'s `.w-reader` (word.astro's own `@media(min-width:481px)` block sets z-index:20) now
   renders visibly *behind* the rail (z-index:40) at every width ≥768px** — this is more serious
   than #1: the reader's own header/chapter-nav content is physically covered by the rail's opaque
   background for the width of the rail, not just a dimming-order cosmetic issue. **Pre-existing in
   kind** (the reader's z-index:20 was already lower than the old top bar's z-index:30 before this
   pass), but the severity increased sharply: the old top bar only covered a 60px-tall horizontal
   strip at the very top; the new rail covers the full height of a 72–248px-wide vertical column,
   which is a materially larger and more disruptive overlap. Verified live with a screenshot showing
   the reader's "The Word" heading visibly cut off by the rail edge. `word.astro` is not in my
   approved file list, so I did not touch it. Two possible fixes, for your decision: (a) bump
   `.w-reader`'s z-index above 40 directly in `word.astro` (smallest, most direct fix, but out of
   this milestone's file scope), or (b) a scoped `body:has(.w-reader.open) .app-shell .tabbar{z-index:...}`
   rule confined to `sidebar.css` that only takes effect while the reader is open, touching no other
   route. I did not apply either without your go-ahead, given how explicit your instruction was
   about not modifying z-index values during this pass.
3. **`#sbCollapse` (the collapse toggle) measures 26×26px, under 44px.** This is the desktop
   control your instructions explicitly asked me to preserve unchanged ("existing collapse control").
   Since it already measured 26px before this pass at production desktop, I left it exactly as-is —
   flagging as a known, pre-existing, deliberately-not-touched gap rather than silently resizing a
   control you asked me to preserve.

### Confirmed unrelated: `/404`'s `.topglow` overflow

`document.documentElement.scrollWidth > clientWidth` is `true` on `/404` at every width tested,
including 600px (well below any rail). Traced to `.topglow{width:120%; left:50%;
transform:translateX(-50%)}` — a deliberate decorative bleed that already extends past the viewport
edge on both sides regardless of the shared shell. Confirmed pre-existing and unrelated to this
pass; `404.astro` is not in my file scope regardless.

### Behavior preserved

- Every route (`/today`, `/word`, `/journey`, `/vault`, `/you`, `/signin`, `/create-account`,
  `/reset-password`, `/crisis`, `/404`) still returns its correct HTTP status and renders.
- `/journey`'s day-flow ritual overlay (z-index 55), day/journey-complete overlays, sheets, and
  toast — all comfortably above the rail's z-index 40, verified unaffected live.
- Mobile (<768px): pixel-for-pixel unchanged bottom tab bar, mast (brand dot + avatar icon), and
  page-level crisis links (`today.astro`'s `entry-crisis`, `journey.astro`'s `#careTalk`, etc.) —
  no crisis item was added to the 5-tab bottom bar, per your explicit instruction.
- Existing `/you` and `/signin` destinations, the desktop crisis link's `/crisis` destination, and
  all five nav destinations — untouched.
- Both themes (dark/light) render correctly via existing semantic tokens (`--surface`, `--text`,
  `--goldd`, etc.) — no hardcoded colors introduced.
- Both languages — zero new i18n keys needed; the shell itself carries no new copy in this pass.

### Known limitations

- Live browser-window resize *without* a page reload does not re-resolve the collapse state across
  the 768/900/1024 boundaries (no resize listener exists — consistent with the pre-existing
  collapse mechanism, which never had one either). A user resizing a desktop window down to tablet
  width without reloading could see a stale expanded/collapsed state until next load. Not fixed, to
  avoid adding new runtime behavior beyond migrating breakpoints.
- The three findings above (`.sheet-scrim` tie, `.w-reader` z-index, `#sbCollapse` size) are
  documented, not fixed, per your explicit scope boundaries — awaiting your decision.
- `/today`'s own `@media(min-width:1024px){.today .in{padding-top:64px}; .today .head{padding-top:56px}}`
  override (in `today.astro`, out of scope) still only fires at 1024px, so `/today` specifically
  carries about 20px more top padding than strictly necessary in the 768–1023px range (its 481px-block
  padding of 84px/80px stays active until its own 1024px override). Cosmetic only — verified no
  overlap or hidden content, just slightly more breathing room than ideal.

### Rollback

```
git checkout -- public/declare/declare.css public/declare/sidebar.css src/layouts/DeclareLayout.astro
```
`TabBar.astro` and `sidebar.js` were never touched, so they're not part of this rollback. No data
migration needed — the `declare-sidebar-collapsed` key's stored values remain valid under the old
code path if reverted (the old resolver only ever checked `==="1"`, which any value written by the
new code — still just `"1"` or `"0"` — satisfies identically).

---

## B1.5A Closeout — compatibility and accessibility fixes (2026-07-23)

### Goal

Fix exactly the three issues the main B1.5A pass found and deliberately left undone: `/word`'s
reader overlay rendering behind the rail, `/today`'s sheet scrim tying the rail's z-index, and the
collapse toggle's sub-44px hit area. No other change.

### Files changed

```
public/declare/declare.css | 63 ++++++++++++++++++++-------------------
public/declare/sidebar.css | 73 +++++++++++++++++++++++++++++++++++++---------
src/pages/word.astro       | 17 +++++++++++
3 files changed, 110 insertions(+), 43 deletions(-)
```
`word.astro` is newly touched in this closeout only — it was out of scope for the main B1.5A pass,
but fixing this specific, explicitly-approved issue required it.

### Fix 1 — `/word` reader overlay behind the rail

**File:** `src/pages/word.astro`. **Selector:** `.w-reader`, current `z-index:20` (inside the
existing `@media(min-width:481px)` block, left **completely untouched** — this value still governs
481–767px, i.e. today's mobile experience, exactly as before). **New rule added**, not a
modification of the existing one:
```css
@media (min-width: 768px) {
  .w-reader { z-index: 41; }
}
```
Just enough to beat the rail's `z-index:40` (`sidebar.css`, unchanged), scoped only to the range
where the rail actually exists. `top:60px` (the same block) was left untouched — verified this is
the same pre-existing "persistent brand row peeks through a ~60px gap above an otherwise full-
screen overlay" composition the reader has always had, not something this fix needs to alter.

**Verified live at 768, 900, 1024, and 1440px:**
- Reader renders fully above the rail; its own header ("John", "21 chapters", chapter nav) is
  completely unobscured and spans the full width — screenshots `closeout-word-reader-768.png` and
  `closeout-word-reader-1024.png`.
- `readerLeft: 0` at every width — confirmed no horizontal offset from the rail remains inside the
  reader.
- The back/close control (`.w-reader .rhead .iconbtn`) is the actual topmost element at its own
  center point (`elementFromPoint` check), confirming it's genuinely clickable, not obstructed.
  Clicking it correctly clears the `open` class (returns to the library view).
- Real `<button>`, no `outline:none` override anywhere in scope — confirmed `outline-style:auto` on
  focus, consistent with every other tested control in this codebase.
- At true mobile width (390px), `.w-reader` still resolves to its original base rule
  (`z-index:40`, unconditional, never touched) — confirmed unchanged.

### Fix 2 — `/today` sheet scrim tying the rail

**File:** `public/declare/declare.css`. **Selector:** `.sheet-scrim`, `z-index:40` → `z-index:41`.
Confirmed via grep before changing a shared-file value: `today.astro` is the only current consumer
of this class, so this is a single-file-impact change despite living in a shared stylesheet.

**Verified live at 768, 900, 1024, and 1440px:** opening the struggle-picker sheet now visibly dims
the rail exactly like the rest of the page (screenshot `closeout-today-scrim-1440.png`, compare
against the main pass's `overlay-check-today-sheet-1440.png` showing the "before" state). Also
confirmed the fix closes the associated interaction gap: `elementFromPoint` at a coordinate inside
the rail's column now resolves to the scrim itself (not a nav link) while the sheet is open — the
rail is no longer clickable through the dimmed backdrop, not just visually inert. The sheet's own
close button was confirmed to still dismiss the sheet and scrim correctly, unchanged.

### Fix 3 — Collapse toggle below 44px

**File:** `public/declare/sidebar.css`. **Selector:** `.app-shell .sb-brand .sb-collapse`.
**Current dimensions:** 26×26px visible = 26×26px hit area (no separate zone).
**Proposed/applied:** 26×26px visible **unchanged** (verified via screenshot — same rotated-chevron
icon, same size); added `position: relative` plus a new `::before` pseudo-element:
```css
.app-shell .sb-brand .sb-collapse::before {
  content: ''; position: absolute; top: 50%; left: 50%;
  width: 44px; height: 44px; transform: translate(-50%, -50%);
}
```
Same invisible-centered-pseudo-element technique already used for the Journey day-dots 44px fix
earlier this session — no new pattern introduced.

**Verified:**
- Hit area measures 44×44px (`getComputedStyle(btn, '::before')`), visible icon still 26×26px.
- No overlap with the brand row or navigation: pseudo-element's bottom edge computed at 57px vs.
  the brand row's own bottom border at 67px and the first nav tab's top at 73px — comfortably clear
  of both.
- Mouse click and real keyboard `Enter` (while focused) both correctly toggle `data-sidebar`
  between `expanded`/`collapsed`.
- Visible focus ring confirmed (`outline-style:auto`) — screenshot
  `closeout-collapse-toggle-focus-1024.png`.
- Confirmed hidden (`display:none`, unaffected by this fix) at 768–899px — the compact rail still
  has no expand capability, per the main pass's explicit scope.
- Verified in both themes and both languages at 900–1023px and desktop — screenshot
  `closeout-collapse-light-es-950.png` (light theme, Spanish, 950px).

### Behavior preserved

- Breakpoints unchanged (768/900/1024 boundaries untouched by this closeout).
- Production logo unchanged.
- No auth, Convex, Journey logic, prompts, routes, or deployment settings touched.
- Mobile (390×844) pixel-for-pixel unchanged — screenshot
  `closeout-mobile-nonregression-390.png`.
- No console errors beyond the pre-existing dev-server "Outdated Optimize Dep" 504 noise.

### Known limitations

None new. The three items this closeout targeted are resolved; everything else documented in the
main B1.5A pass's "Known limitations" (no-resize-listener behavior, `/today`'s ~20px extra top
padding in the 768–1023 range, the `#sbCollapse` visual size itself which was explicitly preserved
per instruction) remains unchanged and still applies.

### Rollback

```
git checkout -- public/declare/declare.css public/declare/sidebar.css src/pages/word.astro
```
No data migration needed — all three changes are presentation/z-index/hit-area only.

---

**B1.5A (including this closeout) complete. Stopping here per instruction — not beginning B1.5B,
B1.5C, or B2. Not committed.**
