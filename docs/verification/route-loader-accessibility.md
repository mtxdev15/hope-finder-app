# Route Loader Accessibility: Heading Semantics

**Status:** implemented on `release-c1-monetization`, commit `95db185`. Local
only, not pushed, not deployed.

---

## 1. Root cause

`public/declare/route-loader.js:48` built the overlay's copy block with a
heading:

```js
'<div class="rl-copy"><h1>' + (rlES() ? 'Buscando en la Palabra' : 'Searching the Word') + '<i>.</i><i>.</i><i>.</i></h1>' +
```

Two details the earlier verification note got slightly wrong, both relevant to
the fix:

- The text is **not** `Searching the Word…`. It is three separate `<i>` elements,
  each holding a literal period, each independently animated by `rl-blink` with
  staggered delays. They are functional, not typographic, so the repo's usual `…`
  convention does not apply to them and all three were kept.
- The overlay is appended to `<body>` **at script load**, unconditionally
  (`route-loader.js:52-56`), and is only ever hidden with `visibility`, never
  removed (`route-loader.css:6-16`). So the heading was present in every page's
  document outline permanently, visible or not.

`DeclareLayout.astro:133` loads the script, so this affected 16 of the 17 built
pages plus one static page, `public/es/heridas-de-la-iglesia.html`. Pages with
their own `<h1>` rendered two. Pages without one, `/today` and `/word`, had the
loader's hidden heading as their **only** `h1`, which is arguably worse.

---

## 2. The correction, and one deliberate departure from the brief

The tag was demoted to `<div class="rl-title">`.

**The inner element was deliberately NOT given `role="status"`, `aria-live` or
`aria-atomic`.** The brief proposed adding them. The overlay already carries them
at `route-loader.js:37-39`:

```js
overlay.setAttribute('role', 'status');
overlay.setAttribute('aria-live', 'polite');
overlay.setAttribute('aria-label', rlES() ? 'Buscando en la Palabra' : 'Searching the Word');
```

Nesting a second live region inside an existing one produces duplicate
announcements, which is precisely the repeat-announcement failure the brief asked
to avoid. Demoting the heading and leaving the overlay's status semantics alone
achieves the stated goal without that side effect. `role="alert"` is not used
anywhere here, as required, since this is a non-urgent transition.

### Behavior preserved

| Property | State |
|---|---|
| English and Spanish copy | unchanged, still via `rlES()` |
| Show/hide lifecycle | unchanged, `visibility`-based |
| `pageshow` / `load` auto-hide, 12s safety timer | unchanged |
| Keyboard focus | never moved. No `focus`, `tabindex` or `inert` anywhere in the file, before or after |
| Reduced motion | preserved, see below |
| Visual design | unchanged, confirmed by screenshot and computed styles |

### CSS

Five selectors referenced the tag name and moved together:

| Line | From | To |
|---|---|---|
| 120 | `.rl-copy h1` | `.rl-copy .rl-title` |
| 121 | `.rl-copy h1 i` | `.rl-copy .rl-title i` |
| 122 | `.rl-copy h1 i:nth-of-type(2)` | `.rl-copy .rl-title i:nth-of-type(2)` |
| 123 | `.rl-copy h1 i:nth-of-type(3)` | `.rl-copy .rl-title i:nth-of-type(3)` |
| 139 | `.rl-copy h1 i` inside `@media (prefers-reduced-motion: reduce)` | `.rl-copy .rl-title i` |

Line 139 is the one that is easy to miss. Missing it would have silently broken
reduced-motion suppression of the blinking dots while everything still looked
fine at a glance. `grep` confirms no `.rl-copy h1` selector remains anywhere, and
`route-loader.css` is the only file that styles `.rl-copy`.

---

## 3. The second defect this exposed

Demoting the loader heading would have taken `/today` and `/word` from one `h1`
to **zero**, because neither page had a heading of its own. Verified against the
build before the change: `dist/today/index.html` and `dist/word/index.html`
contained no `<h1>`.

Added one real page-level heading to each:

- `src/pages/today.astro` → `<h1 class="sr-only" data-i18n="today.pageTitle">Today</h1>`
- `src/pages/word.astro` → `<h1 class="sr-only" data-i18n="word.title">The Word</h1>`

Both are visually hidden, because each page leads with styled type rather than a
heading and a second visible title would crowd a screen built for someone reading
at 3am. `/word` additionally cannot use its visible "The Word" title as the page
heading, because that title belongs to the library view and disappears in the
reader overlay.

**Hidden the accessible way.** The `sr-only` declaration is copied verbatim from
the existing `.journey .sr-only` at `journey.astro:2350`: absolute position, 1px
box, `clip: rect(0,0,0,0)`, no `display:none`, no `visibility:hidden`, no
`aria-hidden`. Both headings exist in the server-rendered HTML and remain in the
accessibility tree. Confirmed by computed style in a browser: `position:
absolute`, `clip: rect(0px, 0px, 0px, 0px)`, `display: block`, `visibility:
visible`, `aria-hidden` null.

The utility is scoped per page (`.today .sr-only`, `.word .sr-only`) because both
style blocks are `is:global` and an unscoped `.sr-only` would have become a
sitewide utility by accident.

**Strings.** `/word` reuses the existing `word.title` (`i18n-strings.js:137`,
already `La Palabra`) rather than adding a second key that would have to be kept
in sync. `/today` needed one new key, `today.pageTitle` → `Hoy`.

**Hierarchy.** Neither page had an existing `h1`, and both lead with `h2` in
their SEO blocks, so the new headings sit above them correctly. Nothing was
demoted or redesigned.

---

## 4. Results

### Build-time `h1` count

| Route | Before | After |
|---|---|---|
| `/` | 1 | 1 |
| `/today` | **0** | **1** |
| `/word` | **0** | **1** |
| `/journey` | 1 | 1 |
| `/vault` | 1 | 1 |
| `/you` | 1 | 1 |
| `/pricing` | 1 | 1 |
| `/plus` | 1 | 1 |
| `/es/precios` | 1 | 1 |
| `/es/plus` | 1 | 1 |

### Runtime `h1` count, real browser, production build

Build-time counts are not sufficient here, because the defect was runtime
injection. Each route was loaded in a browser and
`document.querySelectorAll('h1').length` evaluated after the loader mounted, in
both languages.

| Route | h1 count | Text | Loader contributes |
|---|---|---|---|
| `/today` | **1** | "Today" / "Hoy" | 0 |
| `/word` | **1** | "The Word" / "La Palabra" | 0 |
| `/journey` | **1** | "Who are you becoming?" | 0 |
| `/vault` | **1** | "Vault" / "Bóveda" | 0 |
| `/you` | **1** | "About you" / "Sobre ti" | 0 |
| `/pricing` | **1** | "Start free. Go deeper when you're ready." | 0 |
| `/plus` | **1** | "Declare Plus" | 0 |
| `/es/precios` | **1** | "Empieza gratis..." | 0 |
| `/es/plus` | **1** | "Declare Plus" | 0 |
| `/` | **0** | see below | loader not present |

`.rl-title` resolves to `DIV` on every route, and the overlay contains zero `h1`.

### The one route that does not meet the target

**`/` has zero `h1` at runtime, and this fix neither caused nor addressed it.**

`index.astro` does not use `DeclareLayout` and never loaded `route-loader.js`, so
the loader never contributed a heading there. Its only `<h1>`
(`index.astro:429`) sits inside a `<noscript>` block, whose contents are not
parsed into the DOM when JavaScript is enabled. A build-time `grep` counts it; a
browser does not.

This is pre-existing, unrelated to the loader, and outside the scope of this
change. **Recorded rather than silently absorbed, and not counted as a pass.**

---

## 5. Loader still renders correctly

The CSS rename was the step most likely to silently no-op. The pricing
verification already recorded a case in this repo where content assertions passed
against a page that rendered completely unstyled, so **computed styles were
asserted, not markup presence**, with the overlay actually visible:

| Property | Value |
|---|---|
| `tagName` | `DIV` |
| `font-family` | `"Cormorant Garamond", serif` |
| `font-weight` | `600` |
| `font-size` | `26px` |
| `letter-spacing` | `0.26px` (`.01em`) |
| `white-space` | `nowrap` |
| `margin` | `0px` |
| dot count | `3` |
| dot `animation-name` | `rl-blink` on all three |
| dot `animation-delay` | `0s`, `0.22s`, `0.44s` |
| overlay `visibility` when shown | `visible` |

Visually confirmed by screenshot: logo, opening-book animation, serif title with
blinking dots, cycling verse reference, gold seek bar. Design unchanged.

---

## 6. Accessibility check re-run

The pricing accessibility suite previously recorded **8 of 9**, with the single
failure being "exactly one `<h1>`", caused by this loader.

That failure is now resolved on `/pricing` and `/es/precios`: both show exactly
one `h1` at runtime, and the loader contributes none. The other eight checks
(labelled radiogroup, `aria-checked`, roving tabindex, arrow-key selection, 44px
touch targets, disabled CTA with explanatory text, disabled CTA not focusable,
savings stated in words) were unaffected by this change and were not re-executed
here; no regression is claimed for them beyond that they share no code with it.

**Result on the heading check specifically: PASS.** The honest overall statement
is that the one known failure is fixed and nothing else was touched, not that a
fresh 9 of 9 sweep was run.
