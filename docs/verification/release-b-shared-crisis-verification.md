# Release B — Shared Crisis Card (B1.5C) Verification Report

*Companion to `docs/implementation/release-b-shared-crisis-summary.md`. Local dev only (Convex
deployment `good-dotterel-906`). Not committed, not pushed, not merged, not deployed.*

---

## B1.5C — Shared Crisis Card (2026-07-24)

### Commands run

```
$ git branch --show-current
redesign/release-b-journey

$ git status --short
 M TODO.md
 M public/declare/i18n-strings.js
 M public/declare/sidebar.css
 M src/components/TabBar.astro
 (.playwright-mcp/, docs/prompts/RELEASE_B_JOURNEY_REDESIGN_CLAUDE_PROMPT.md — pre-existing/unrelated)

$ git diff --name-only
TODO.md
public/declare/i18n-strings.js
public/declare/sidebar.css
src/components/TabBar.astro

$ git diff --stat -- public/declare/sidebar.css src/components/TabBar.astro public/declare/i18n-strings.js
 public/declare/i18n-strings.js |  7 ++++
 public/declare/sidebar.css     | 87 ++++++++++++++++++++++++++++++++----------
 src/components/TabBar.astro    | 27 ++++++++++---
 3 files changed, 96 insertions(+), 25 deletions(-)

$ git diff --check -- public/declare/sidebar.css src/components/TabBar.astro public/declare/i18n-strings.js
(clean, no output)

$ npm run build
✓ Completed, 11 pages built, no errors
```

### Route checks

`/today`, `/word`, `/journey`, `/vault`, `/you`, `/signin`, `/crisis` — all HTTP 200.

### Semantic structure

Confirmed live via DOM inspection: exactly one `<a href="/crisis">`, `innerAnchors: 0`,
`innerButtons: 0` inside it — no nested anchor or button, the entire card is the click target.
`aria-label` and `data-i18n-aria` both present and correct on first paint.

### Responsive verification — all 11 required viewports

| Width × height | Result |
|---|---|
| 390×844 | Mobile unchanged — 5 bottom tabs, `.sb-crisis` `display:none` |
| 767×1024 | Just under the rail breakpoint — mobile treatment confirmed |
| 768×1024 | Compact: real `<a>` measures 44×44px, `.sbc-body` `display:none` |
| 899×1194 | Compact upper boundary — same 44×44px |
| 900×1200 | Expanded: 195px-wide card (tablet `--sbw:220px`), full copy, no overflow |
| 1023×768 | Expanded, short-height — no clipping, no scroll needed, all controls reachable |
| 1024×650 | Short-height — crisis, identity, and collapse control all reachable (`getBoundingClientRect` non-zero), no horizontal overflow |
| 1024×768 | Desktop boundary — expanded card, 223px wide |
| 1280×720 | Short-height — crisis and identity both reachable, no horizontal overflow |
| 1280×800 | No overflow |
| 1440×1000 | Full verification width — see states below |

### Compact-control verification (768-899px, and manually-collapsed ≥900px)

- Real `<a class="sb-crisis">` boundingClientRect: **44×44px exactly** — not an invisible `::before`
  expansion; the actual element is the tap target.
- Icon centered precisely: icon at `(13, 13)` inside the 44×44 box with an 18×18 icon — exactly
  centered ((44-18)/2 = 13).
- `border-radius: 50%` — a circle, visually distinct in **shape** from the identity card's rounded
  rectangle and from the plain nav-tab icon rows above it (confirmed visually, see
  `desktop-collapsed-1440.png`).
- `.sbc-body` computed `display: none`; full translated `aria-label` still present and correct.
- No overlap with the identity card directly below it: measured gap = 10px at every collapsed/compact
  width tested.

### Signed-in / signed-out

Confirmed the card is present, identical, and fully functional on `/signin/` itself (while
signed out, auth modal open) — same `href="/crisis"`, same title text, no auth or profile-loading
dependency of any kind. The card's markup never varies by session state (no client script reads
`isSignedIn()` for this element at all).

### Themes

Dark (`desktop-expanded-dark-1440.png`) and light (`desktop-expanded-light-1440.png`) both confirmed
— forest surface / ivory title in dark, warm ivory surface / dark readable title in light, restrained
gold icon/border/CTA in both, via `color-mix()` against existing tokens only. No new hardcoded color
was added; none was needed.

### Languages

English confirmed as shipped default. Spanish confirmed live via `window.I18N.setLang('es')`
(`spanish-expanded-1440.png`) — all four content spans and the `aria-label` swap correctly, and the
two reassurance/support sentences wrap naturally across their own lines with no forced `<br>` break.
Switched back to English afterward and reconfirmed correct English text with no leftover Spanish.

### Keyboard and focus

- Real keyboard `Tab` from the Vault nav tab landed directly on `.sb-crisis` with `outline-style:
  auto` (visible focus) — confirmed with an actual keypress, not `.focus()`.
- A further `Tab` from the crisis card landed directly on the identity card — confirms exactly **one**
  crisis tab stop, no duplicate/stray focusable descendant inside the card (the four content spans
  are plain, non-interactive `<span>`s).
- Direct click navigated straight to `/crisis` — no modal, no confirmation, no delay, no
  intermediate screen. Browser Back returned cleanly to `/today`.

### 200% zoom

`document.documentElement.style.zoom = '2'` at 1440×1000: card scaled proportionally (223×124 →
446×247, exactly 2×), title font-size remained 14px (CSS px, scaling with zoom like everything else
— not manually shrunk), no internal clipping (`scrollHeight` did not exceed `clientHeight`).

### Duplicate-anchor check

`document.querySelectorAll('a[href="/crisis"]')` finds 5 anchors in the DOM on `/today` at 1440px
(pre-existing `entry-crisis`, `results-crisis`'s sibling `rail-crisis`, `sheet-crisis`, plus the new
`sb-crisis`) — none of these were added by this pass except `sb-crisis` itself. Checked *actual*
visibility (`getBoundingClientRect`, not just computed `display`) on the entry view: only
`entry-crisis` and the new `sb-crisis` are genuinely on-screen simultaneously — `rail-crisis` lives
inside a `.results` container that is `display:none` on the entry view (confirmed 0×0 rect), and
`sheet-crisis` is `visibility:hidden` inside a closed bottom sheet (confirmed off-screen, `top:
1108px` against a 1000px-tall viewport). Neither is a new duplicate this pass introduced, and neither
is reachable or visible at the same time as the sidebar card in the states tested. See "Known
limitations" in the implementation summary for the one pre-existing exception (today's own
`aria-hidden` results-view wayfinding rail, visible only in the results state at >=1024px).

### Mobile non-regression

390×844: exactly 5 bottom tabs (unchanged), `.sb-crisis` `display:none`, `today.astro`'s own
`.entry-crisis` link rendered and pointing at `/crisis` exactly as before. Confirmed
`CrisisBanner.astro` is not imported anywhere in `src/` (repo-wide grep, zero matches) — it was not,
and is not, a live mobile crisis surface; not claimed as one in the documentation.
`journey.astro`'s `.care-talk` link is untouched (zero diff to that file).

### Console

Only the pre-existing, dev-server-only "Outdated Optimize Dep" 504 noise — no new JavaScript errors
introduced by any of the three changed files, across all widths, themes, and languages tested.

### Confirmed

- One real anchor, direct `/crisis` destination, no modal/confirmation/sign-in/loading/redirecting
  state of any kind ✓
- Accessible while signed out, no auth dependency ✓
- Complete, correct `aria-label` in English and Spanish ✓
- Visible focus, one tab stop, no duplicate crisis focus target ✓
- Real 44×44px compact anchor (not a hit-area trick); full card naturally exceeds 44×44px ✓
- Decorative SVGs `aria-hidden="true"` ✓
- Usable at 200% zoom, no clipping ✓
- No horizontal overflow, no vertical rail overlap, reachable at every short-height viewport tested ✓
- Dark and light theme both correct via existing tokens only ✓
- Mobile completely unchanged — verified actual rendered state, not assumed from file existence ✓
- No new client script added — confirmed by diff, this card is static markup + CSS + i18n only ✓
- Order preserved: `.sb-crisis` still `order: 90`, `.sb-identity` still `order: 95`, unchanged ✓
- Production logo/wordmark (`.sb-brand`) untouched — zero diff to that block ✓

### Rollback

```
git checkout -- src/components/TabBar.astro public/declare/sidebar.css public/declare/i18n-strings.js
```

---

**B1.5C verification complete. Stopping here per instruction — not committing, not beginning B2.**
