# Release B — Shared Left Navigation Shell (B1.5A) Verification Report

*Companion to `docs/implementation/release-b-shared-shell-summary.md`. Local dev only — production
Convex was never touched. Nothing committed, pushed, merged, or deployed.*

---

## B1.5A — Responsive Left Navigation Shell (2026-07-23)

### Commands run

```
$ npm run build
✓ Completed in ~7s, 11 pages built, no errors (run three times across this pass — once before any
  edits, once after the initial breakpoint migration, once after the .sb-crisis 44px fix — all clean)

$ git status --short
 M public/declare/declare.css
 M public/declare/sidebar.css
 M src/layouts/DeclareLayout.astro
 (TODO.md, public/declare/i18n-strings.js, src/pages/journey.astro also modified — all three
  pre-existing, unrelated edits from earlier in this session, not touched here)

$ git diff --stat -- src/components/TabBar.astro public/declare/sidebar.css public/declare/declare.css src/layouts/DeclareLayout.astro public/declare/sidebar.js
 public/declare/declare.css      | 53 +++++++++++++++------------------
 public/declare/sidebar.css      | 66 +++++++++++++++++++++++++++++++++--------
 src/layouts/DeclareLayout.astro | 43 +++++++++++++++------------
 3 files changed, 101 insertions(+), 61 deletions(-)
```

### Route checks (all via curl, local dev server)

| Route | Status |
|---|---|
| `/today` | 200 |
| `/word` | 200 |
| `/journey` | 200 |
| `/vault` | 200 |
| `/you` | 200 |
| `/signin` | 200 |
| `/create-account` | 200 |
| `/reset-password` | 200 |
| `/crisis` | 200 |
| `/404` (and a real nonexistent path) | 404, correct fallback content renders |

"/declare" was **not** tested as a route — confirmed it doesn't exist; the "Declare" nav item
correctly points to `/today`.

### Breakpoint verification (primary test page: `/today`, cross-checked on others)

| Width × height | Expected | Result |
|---|---|---|
| 390×844 | Bottom nav | Pass — `.tabbar` fixed, bottom:0, full width |
| 600×960 | Bottom nav | Pass — `.tabbar` fixed, bottom:0; `.mast` confirmed `position:relative` (in-flow, matching mobile, not the old fixed-top treatment) |
| 767×1024 | Bottom nav (upper boundary) | Pass — `.tabbar` fixed bottom, `body` padding-left:0px (no rail) |
| 768×1024 | Compact rail | Pass — `--sbw:72px`, `data-sidebar="collapsed"`, `#sbCollapse` hidden (`display:none`); screenshot `shell-compact-768x1024-today.png` |
| 810×1080 | Compact rail | Pass — `--sbw:72px`, collapsed, no overflow |
| 834×1194 | Compact rail | Pass — `--sbw:72px`, collapsed, no overflow |
| 899×1194 | Compact rail (upper boundary) | Pass — `--sbw:72px`, collapsed, no overflow |
| 900×1200 | Expanded rail | Pass — `--sbw:220px`, `data-sidebar="expanded"`, `#sbCollapse` visible (`display:flex`); screenshot `shell-expanded-900x1200-today.png` |
| 1023×768 | Expanded rail (upper boundary) | Pass — `--sbw:220px`, expanded, no overflow; also used for the Spanish check (below) |
| 1024×768 | Desktop (boundary) | Pass — `--sbw:248px`, expanded, no overflow, content fits in a 768px-tall window without pushing nav off-screen; screenshot `shell-desktop-1024x768-today.png` |
| 1180×820 | Desktop | Pass — `--sbw:248px`, no overflow |
| 1280×800 | Desktop | Pass — `--sbw:248px`, no overflow |
| 1440×1000 | Desktop | Pass — `--sbw:248px`, no overflow |

### Persistence verification

| Scenario | Result |
|---|---|
| No stored value, 768–899px | Resolves compact (`data-sidebar="collapsed"`) |
| No stored value, ≥900px | Resolves expanded |
| Click toggle at 900px (no prior value) | Writes `"1"`; `data-sidebar` updates to `collapsed` live |
| Explicit `"0"` (expanded) stored, tested at 834px | **Correctly overridden to `collapsed`** — compact-safety default wins regardless of the stored preference, confirmed live |
| Explicit `"0"` (expanded) stored, tested at 1024×768 | **Correctly honored** — resolves `expanded`, `--sbw:248px`, confirming desktop behavior is unaffected by the tablet-safety override |
| Explicit `"1"` (collapsed) stored | Collapsed at every rail width, 768px and up (verified by construction — same branch fires regardless of width once `raw==="1"`) |

### Overlay compatibility

| Overlay | Finding |
|---|---|
| `/journey` day-flow ritual (`.dayflow`, z-index 55) | Pass — fully covers the rail, no bleed-through, verified live with a real in-progress Day 1 ritual screenshot (`overlay-check-journey-dayflow-1440.png`) |
| `/today` sheet scrim (`#scrim`/`.sheet-scrim`, z-index 40) | **Real finding, not fixed.** Ties with the rail's z-index 40; DOM order (rail renders after `<slot/>`) resolves the tie in the rail's favor — the rail stays fully undimmed above an open sheet. Screenshot `overlay-check-today-sheet-1440.png`. Confirmed pre-existing (both z-index values existed before this pass); cosmetic only, the sheet itself still renders correctly above everything else. Documented in the implementation summary with a proposed smallest fix, not applied. |
| `/word` reader overlay (`.w-reader`, z-index 20 at ≥481px per `word.astro`'s own CSS) | **Real finding, not fixed, higher severity.** Now renders visibly *behind* the rail (z-index 40) at every width ≥768px — the reader's own header content is physically covered by the rail's opaque background for the rail's width, not just a dimming-order issue. Screenshot `overlay-check-word-reader-1440.png` shows "The Word" heading cut off at the rail edge. Confirmed pre-existing in kind (reader's z-index:20 was already below the old top bar's z-index:30) but meaningfully worse in practice (a 60px horizontal strip before vs. a full-height 72–248px vertical column now). `word.astro` is out of this milestone's file scope — documented with two proposed fixes for your decision, neither applied. |

### Accessibility

| Check | Result |
|---|---|
| Real anchor elements | Pass — every nav/crisis item is a real `<a>`, no click-handler-on-div pattern introduced |
| Accessible names survive collapse (compact rail) | Pass, after a fix — see "real fix" below. Verified: Word, Journey, Declare, Vault, "In crisis? Find help now", You all report correct `aria-label`/text-derived accessible names at 800×1000 (compact) |
| Keyboard reachability | Pass — real `Tab` keypresses (not programmatic `.focus()`) reach rail links in sequence |
| Visible focus | Pass — `outline-style: auto`, `outline-color: rgb(0, 95, 204)` confirmed via real keyboard Tab on `.tab-vault` |
| 44px targets | Pass after a fix (`.sb-crisis` was 41px tall, now 47×44px) — every other rail control (`.tab-*`) already measured 44×47px via `declare.css`'s existing `.tab{min-height:44px}` base rule, confirmed unaffected |
| 200% zoom | Verified by equivalence: 200% zoom halves the effective CSS viewport (e.g. 1024px desktop → ~512px effective). Since the shell's breakpoints are pure `min-width`/`max-width` media queries with no special-casing, a directly-tested narrow width (390px, 600px — both confirmed bottom-nav, fully usable) exercises the identical code path a zoomed-out desktop window would resolve to. No zoom-specific breakage possible by construction. |
| Collapsed/compact behavior | Pass — icon-only, all controls reachable, no truncated half-rendered card ever shown (binary between full rail and icon rail, no in-between state) |
| No reliance on color alone | Pass — active tab state carries both a background tint and a distinct icon/label color, not color alone |
| Crisis access remains immediate | Pass — `/crisis` link present, real anchor, no modal, no confirmation step, at every width tested |

**A real fix applied:** the collapsed/compact state previously hid `.tlbl`/`.sb-crisis-label` via
`display:none`, which strips text from the accessibility tree entirely. Since 768–899px now makes
this the *default* state (not an opt-in desktop toggle), this was no longer an edge case. Fixed in
`sidebar.css` with the standard visually-hidden pattern instead of `display:none` — verified live
that every rail link keeps a real accessible name when collapsed, including the You tab's
dynamically-swapped first-name label.

### Theme and language verification

- Dark theme, compact rail (768–899): pass, matches existing dark forest-green/gold token system.
- Light theme, compact rail (820×1180): pass — warm ivory surface, gold accents, no pure-white
  dashboard look; screenshot `shell-light-compact-820x1180.png`.
- Spanish, expanded rail (1023×768): pass — Palabra/Camino/Declara/Bóveda, "¿En crisis? Encuentra…"
  (correctly truncated with ellipsis at the narrower width), "Tú" — all existing keys, zero new
  translations needed; screenshot `shell-spanish-expanded-1023x768.png`.

### Mobile non-regression

390×844, `/today`: brand dot + mast avatar icon (top), 5-tab bottom bar with the raised gold Declare
disc (bottom), page-level "In crisis? Find help now" link intact — pixel-for-pixel match to the
pre-existing mobile design, no crisis item added to the 5-tab bar. Screenshot
`mobile-nonregression-390x844-today.png`.

### Route sweep — overflow and console errors

| Route | Width tested | Overflow | Console errors (new) |
|---|---|---|---|
| `/today` | 390, 600, 767, 768, 810, 834, 899, 900, 1023, 1024, 1180, 1280, 1440 | None | None (only the pre-existing dev-server "Outdated Optimize Dep" 504 noise) |
| `/word` | 1440 (reader overlay forced open for the finding above) | N/A (overlay finding documented separately) | None |
| `/journey` | 1440 (ritual overlay open) | None | None |
| `/vault` | 1000 | None | None |
| `/you` | 1000 (screenshot `route-you-expanded-1000.png` — confirms no dead top gap after removing the obsolete `padding-top:64px`) | None | None |
| `/signin` | 1000 | None | None |
| `/create-account` | 1000 | None | None |
| `/reset-password` | 1000 | None | None |
| `/crisis` | 1000 | None | None |
| `/404` | 1000, 600 | **True at both widths** — traced to `.topglow{width:120%;...}`, a deliberate decorative bleed confirmed present even at 600px (well below any rail). Pre-existing, unrelated to this pass. |

### Known limitations

See the implementation summary's "Known limitations," "Findings surfaced, NOT fixed," and
"Confirmed unrelated" sections — the `.sheet-scrim`/`.w-reader` z-index findings, the `#sbCollapse`
26px control (explicitly preserved per your instruction), the no-resize-listener constraint, and
`/today`'s ~20px extra top padding in the 768–1023 range are all documented there rather than
repeated here.

### Rollback

```
git checkout -- public/declare/declare.css public/declare/sidebar.css src/layouts/DeclareLayout.astro
```

---

## B1.5A Closeout — compatibility and accessibility fixes (2026-07-23)

### Commands run

```
$ npm run build
✓ Completed, 11 pages built, no errors

$ git status --short
 M public/declare/declare.css
 M public/declare/sidebar.css
 M src/pages/word.astro
 (TODO.md, public/declare/i18n-strings.js, src/layouts/DeclareLayout.astro,
  src/pages/journey.astro also modified — all pre-existing, unrelated to this closeout)

$ git diff --stat -- public/declare/declare.css public/declare/sidebar.css src/pages/word.astro
 public/declare/declare.css | 63 ++++++++++++++++++++-------------------
 public/declare/sidebar.css | 73 +++++++++++++++++++++++++++++++++++++---------
 src/pages/word.astro       | 17 +++++++++++
 3 files changed, 110 insertions(+), 43 deletions(-)
```

### `/word` reader overlay — verified at all four required widths

| Width | z-index | Left offset | Header visible | Back control clickable |
|---|---|---|---|---|
| 768 | 41 | 0 | Pass — screenshot `closeout-word-reader-768.png` | Pass |
| 900 | 41 | 0 | Pass | Pass |
| 1024 | 41 | 0 | Pass — screenshot `closeout-word-reader-1024.png` | Pass |
| 1440 | 41 | 0 | Pass | Pass |

Additional checks: closing the reader (clicking the back control) correctly clears the `open`
class and returns to the library view; keyboard focus on the back control shows
`outline-style: auto`; mobile (390px) `.w-reader` still resolves `z-index: 40` from its original,
untouched base rule — confirmed unchanged.

### `/today` sheet scrim — verified at all four required widths

| Width | Scrim above rail? | Rail clickable through scrim? |
|---|---|---|
| 768 | Pass | No — `elementFromPoint` inside the rail's column resolves to the scrim |
| 900 | Pass | No |
| 1024 | Pass | No |
| 1440 | Pass — screenshot `closeout-today-scrim-1440.png` | No |

Sheet's own close button confirmed to still dismiss the sheet and scrim correctly (unchanged
behavior).

### Collapse toggle — 44px verification

| Check | Result |
|---|---|
| Compact rail (768–899px) | Pass — `display:none`, unaffected, no expand capability (unchanged from main pass) |
| Expanded rail (900–1023px) | Pass — hit area 44×44px, visible icon unchanged at 26×26px |
| Desktop (≥1024px) | Pass — same, verified at 1024px |
| No overlap with brand row | Pass — pseudo-element bottom (57px) clears the brand row's bottom border (67px) |
| No overlap with navigation | Pass — pseudo-element bottom (57px) clears the first nav tab's top (73px) |
| Visible focus-visible state | Pass — `outline-style: auto`, screenshot `closeout-collapse-toggle-focus-1024.png` |
| Mouse activation | Pass — click toggles `data-sidebar` expanded ↔ collapsed |
| Keyboard activation | Pass — real `Enter` keypress while focused toggles `data-sidebar` (native `<button>` behavior) |
| Dark theme | Pass |
| Light theme | Pass — screenshot `closeout-collapse-light-es-950.png` |
| English | Pass |
| Spanish | Pass — same screenshot, confirms geometry is language-independent |

### Non-regression

| Check | Result |
|---|---|
| Mobile (390×844) | Pass — pixel-for-pixel unchanged, screenshot `closeout-mobile-nonregression-390.png` |
| Breakpoints (768/900/1024) | Pass — unchanged, confirmed by construction (no breakpoint values edited) |
| Production logo | Pass — unchanged |
| Console errors | Pass — only the pre-existing dev-server "Outdated Optimize Dep" 504 noise |
| Horizontal overflow | Pass — no overflow introduced at any tested width |

### Known limitations

None new from this closeout. All limitations documented in the main B1.5A pass remain unchanged and
still apply.

### Rollback

```
git checkout -- public/declare/declare.css public/declare/sidebar.css src/pages/word.astro
```

---

**B1.5A (including this closeout) verification complete. Stopping here per instruction — not
beginning B1.5B, B1.5C, or B2. Nothing committed.**
