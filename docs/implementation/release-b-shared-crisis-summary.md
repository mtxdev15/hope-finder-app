# Release B — Shared Crisis Card (B1.5C) Implementation Summary

*Companion to `docs/verification/release-b-shared-crisis-verification.md`. Local dev only (Convex
deployment `good-dotterel-906`, per `.env.local` — never production). Not committed, not pushed,
not merged, not deployed.*

---

## B1.5C — Shared Crisis Card (2026-07-24)

### Goal

Replace the existing plain rail crisis link with a calm, forest-and-gold shared crisis card — one
real anchor, always a direct one-tap link to `/crisis`, reflowing between a full expanded card
(900px+) and a distinct icon-only compact control (768-899px, or any manually-collapsed rail) —
without ever adopting the saturated-red/emergency-alert look, without duplicating any of `/crisis`'s
own detailed resource content, and without touching mobile at all.

### Files changed

```
public/declare/i18n-strings.js |  7 ++++
public/declare/sidebar.css     | 87 ++++++++++++++++++++++++++++++++----------
src/components/TabBar.astro    | 27 ++++++++++---
3 files changed, 96 insertions(+), 25 deletions(-)
```
No other file touched — confirmed by `git diff --name-only` showing only these three plus the
pre-existing, unrelated `TODO.md` modification. `src/pages/crisis.astro`, `CrisisBanner.astro`,
`public/declare/declare.css`, `public/declare/sidebar.js`, `DeclareLayout.astro`,
`auth-store.js`/`profile-store.js`/`account-sync.js`, Journey files, and Word files are all
untouched.

### No client script needed

Unlike the B1.5B identity card, this card's content never depends on session state — it's the same
markup for every visitor, signed in or out. It is implemented as pure Astro markup + CSS +
the existing declarative i18n attributes (`data-i18n`, `data-i18n-aria`) — no new `<script>` block
was added to `TabBar.astro`, and its existing identity-card script block is untouched.

### Semantic markup

One real anchor, no nested anchor or button, the entire card is the click target:
```html
<a class="crisis sb-crisis" href="/crisis"
   aria-label="Crisis help. You are not alone. Help and hope are available. Get help."
   data-i18n-aria="sidebar.crisisAria">
  <span class="sbc-icon" aria-hidden="true">
    <svg>...(existing circle-target icon, unchanged)...</svg>
  </span>
  <span class="sbc-body">
    <span class="sbc-title" data-i18n="sidebar.crisisTitle">In crisis?</span>
    <span class="sbc-reassurance" data-i18n="sidebar.crisisReassurance">You are not alone.</span>
    <span class="sbc-support" data-i18n="sidebar.crisisSupport">Help and hope are available.</span>
    <span class="sbc-action">
      <span data-i18n="sidebar.crisisCta">Get Help</span>
      <svg aria-hidden="true">...(restrained arrow)...</svg>
    </span>
  </span>
</a>
```
The existing crisis icon (circle + crosshair) was kept exactly as-is, just wrapped in a new
`.sbc-icon` chip for the card layout — no new icon was introduced. The four copy concepts (title,
reassurance, support, CTA) are kept as four distinct block-level spans and four distinct
translation keys, per instruction — no combined sentence, no hardcoded `<br>`, so Spanish wraps
naturally rather than breaking at an English-specific point.

### Expanded design (900px+, or any expanded/non-collapsed rail width)

- Card: `border-radius: 13px` (same rounded geometry family as the identity card), `background:
  var(--surface)`, `border: 1px solid color-mix(in srgb, var(--gold) 34%, var(--line))` — a
  deliberately stronger border than the identity card's 20% mix, so it reads as the more
  safety-relevant of the two stacked cards without becoming alarming.
- Icon: the existing SVG in a small tinted circular chip (`.sbc-icon`), same visual language as the
  identity card's avatar chip.
- Title: bold, `var(--text)`, 14px. Reassurance/support: `var(--text2)`, 12.5px, comfortable
  line-height for natural wrapping. CTA: `var(--goldd)`, 13px semi-bold, with a small trailing arrow
  that nudges 2px on hover only (`prefers-reduced-motion: reduce` disables even that transition —
  no interaction depends on it, it's cosmetic).
- No gradients, no red, no badges, no disabled/loading/redirecting states, no pulsing/flashing/glow
  of any kind — confirmed nothing in the new CSS uses `@keyframes` or an unconditional/looping
  `animation`.

### Compact design (768-899px, and any manually-collapsed rail at 900px+)

- The real `<a class="sb-crisis">` itself is resized to `width: 44px; height: 44px; border-radius:
  50%` — **not** an invisible `::before` hit-area expansion around a smaller visible box (the
  technique used for the identity card). This is the one safety-critical control in the rail, so its
  tap target is the visible element itself.
- `.sbc-body { display: none; }` — the anchor's own translated `aria-label` (via `data-i18n-aria`)
  already carries the complete accessible name regardless of visible content, same reasoning as the
  identity card's `.sbi-meta`/`.sbi-go`.
- Deliberately a **different shape** (circle) from both the identity card's rounded-rectangle avatar
  and the plain nav-tab icon rows above it, so this one safety-critical control can't be mistaken
  for either at a glance.

### Translation keys

Namespaced under the existing `sidebar.*` prefix (matching the B1.5B convention), added to
`public/declare/i18n-strings.js`:

| Key | English (inline, `TabBar.astro`) | Spanish |
|---|---|---|
| `sidebar.crisisTitle` | In crisis? | ¿Estás en crisis? |
| `sidebar.crisisReassurance` | You are not alone. | No estás a solas. |
| `sidebar.crisisSupport` | Help and hope are available. | Hay ayuda y esperanza disponibles. |
| `sidebar.crisisCta` | Get Help | Recibe ayuda |
| `sidebar.crisisAria` | Crisis help. You are not alone. Help and hope are available. Get help. | Ayuda en una crisis. No estás a solas. Hay ayuda y esperanza disponibles. Recibe ayuda. |

`data-i18n-aria` was confirmed to already be supported by the existing i18n runtime before use —
`public/declare/i18n.js` already has a `swapAttr(el, 'data-i18n-aria', 'aria-label', lang)` pass
(line 58), previously just unused by this element. As a side effect, this also fixes a pre-existing
gap: the old static `aria-label="In crisis? Find help now"` never actually translated on a language
switch (only the visible label span did); the new `aria-label` now translates correctly.

### Accessible-name strategy

Real `<a href="/crisis">`, not a div+click-handler. `aria-label` is static (not session-dependent),
composed from the same four visible strings so it can never drift from what's shown at expanded
width, and kept in sync across languages purely declaratively via `data-i18n-aria` — no script
involved. Decorative SVGs (icon, arrow) both carry `aria-hidden="true"`.

### Theme behavior

Both themes use only existing semantic tokens already present in `declare.css` — `--surface`,
`--text`, `--text2`, `--muted`, `--gold`, `--goldd`, `--line`, `--chip-shadow` — confirmed via direct
inspection of `declare.css`'s `:root` and `html[data-theme="dark"]` blocks before use. No new token
was introduced; none was needed.

### Short-height behavior

The rail's existing `overflow-y: auto` (unchanged from B1.5A/B1.5B) already handles every short
viewport tested — at no tested height did the crisis or identity card get clipped or require any new
scroll affordance.

### Mobile non-regression

`.sb-crisis` remains inside the pre-existing top-of-file `.sb-brand, .sb-crisis, .sb-identity {
display: none; }` rule (line 28), completely unmodified — this card cannot render below 768px
regardless of the content/style changes inside the `>=768px` media query. I verified the actual
rendered mobile crisis-access surfaces directly rather than assuming from file names:
- **`CrisisBanner.astro` is not imported or rendered anywhere in `src/`** — confirmed by a
  repo-wide grep with zero matches outside its own file. It does not provide live crisis access
  today; this is a pre-existing, unrelated fact, not something this pass changed or relied on.
- `today.astro`'s own in-page links (`entry-crisis`, `sheet-crisis`, and the desktop-only
  `rail-crisis` inside its `aria-hidden` results wayfinding aside) are all untouched — confirmed by
  `git diff --name-only` showing zero changes to `today.astro`.
- `journey.astro`'s own `.care-talk` "Talk to someone now" link (`id="careTalk"`, `href="/crisis"`)
  is untouched — confirmed the same way.

### Known limitations

- `today.astro` (untouched, out of scope) has its own separate, pre-existing `.rail-crisis` link
  inside an `aria-hidden="true"` decorative results-wayfinding aside, visible only in the *results*
  view at >=1024px, alongside the new sidebar card. It's excluded from the accessibility tree by its
  parent's `aria-hidden`, so it never creates a duplicate *accessible* crisis target — but a sighted
  desktop user viewing results at >=1024px will see two visually distinct crisis links on screen at
  once (the pre-existing in-page one and the persistent sidebar one). This is pre-existing behavior,
  not introduced or altered by this pass, and outside this milestone's approved file list.
- No automated test suite exists in this project (confirmed in an earlier session audit) —
  verification here is build + live Playwright-driven manual/DOM verification, matching the
  established pattern from B1.5A/B1.5B/B1.5B.1.

### Rollback

```
git checkout -- src/components/TabBar.astro public/declare/sidebar.css public/declare/i18n-strings.js
```
No data/schema change, no new event, no new storage key, no new script — pure markup/CSS/i18n
addition.

---

**B1.5C implementation complete. Stopping here per instruction — not committing, not beginning B2.**
