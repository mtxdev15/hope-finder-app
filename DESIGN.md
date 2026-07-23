---
name: Declare & Believe
description: Faith-based mind renewal app — Scripture, declarations, and prayer for the struggling Christian
colors:
  forest: "#2D4A3E"
  forest-light: "#3D6356"
  gold: "#C9A84C"
  gold-light: "#E8C97A"
  gold-dark: "#9B7A2E"
  gold-text: "#8A6B1F"
  gold-button: "#7A6429"
  cream: "#FAF7F2"
  cream-dark: "#F0EBE1"
  parchment: "#E8E0D0"
  text-ink: "#1A1A18"
  text-muted: "#6B6355"
  text-light: "#9B9080"
  text-footer: "#5C5448"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(2.6rem, 6vw, 4rem)"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "normal"
  verse:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  declaration:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "1.1rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  pill: "20px"
  card: "16px"
  button: "8px"
  input: "8px"
  sm: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  card: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "{colors.forest-light}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "14px 24px"
  button-gold:
    backgroundColor: "{colors.gold-button}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "8px 16px"
  chip:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
  chip-selected:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
  input:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.input}"
    padding: "12px 16px"
  input-focus:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.input}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
---

## Overview

Declare & Believe is a single-screen faith tool. One interaction: the user names their struggle,
God's Word answers back. The visual system exists entirely to serve that encounter — it should
recede into the background and let Scripture breathe.

**The Sacred/Interface Rule.** Cormorant Garamond is the language of the sacred (Scripture,
declarations, prayer, the wordmark). DM Sans is the language of the interface (buttons, labels,
chips, body copy). Never swap them. The contrast between these two families creates the app's
core visual metaphor: the divine and the human in conversation.

**The Forest + Gold System.** Forest (#2D4A3E) carries authority — primary buttons, active states,
declaration text, the wordmark anchor. Gold (#C9A84C) marks the sacred — verse references,
declaration bullets, the cross loader, active translation toggles. Cream (#FAF7F2) is the page
itself: warm, open, unhurried. Parchment (#E8E0D0) defines edges without shouting.

Background: a dual radial gradient — muted gold at top-left (15% 10%), muted forest at
bottom-right (85% 90%), each at ~6–7% opacity. Adds depth without distraction.

The mobile breakpoint is 600px. Every padding, font-size, and layout decision assumes a phone
first. The 3am user is never on a laptop.

## Colors

**Primary — Forest**
- `forest` #2D4A3E: primary buttons, active chips, declaration text, wordmark
- `forest-light` #3D6356: button hover, interactive feedback

**Accent — Gold**
- `gold` #C9A84C: accent highlights, verse reference underlines, declaration bullets
- `gold-light` #E8C97A: hover states, quote mark overlay in prayer box
- `gold-dark` #9B7A2E: verse reference labels (AA-rated on cream)
- `gold-text` #8A6B1F: header eyebrow (4.67:1 on cream)
- `gold-button` #7A6429: active translation toggle (5.70:1 white on gold-button — AA)

**Neutral**
- `cream` #FAF7F2: page background, chip resting state
- `cream-dark` #F0EBE1: subtle dividers, result section backgrounds
- `parchment` #E8E0D0: all borders (card, input, verse block)
- `text-ink` #1A1A18: primary body text — never use a lighter gray for prose
- `text-muted` #6B6355: secondary labels, placeholders (verified AA on cream)
- `text-light` #9B9080: tertiary — placeholder text only
- `text-footer` #5C5448: footer body (6.98:1 AAA on cream)
- `white` #FFFFFF: cards, overlays, input focus background

**The Contrast Rule.** Every text color in this palette has been validated AA or AAA
on its background. Do not introduce a new gray. Reach for `text-muted` or `text-ink`
before inventing a lighter shade — lighter gray on cream is how designs fail WCAG silently.

**Anti-pattern test.** If the page looks like a wellness or mindfulness app — soft gradients,
desaturated sage greens, pale pinks — the palette has drifted. Forest is deep and authoritative,
not earthy-casual. Gold is rich and specific, not warm-neutral.

## Typography

**The Two-Family Rule.** Cormorant Garamond (serif) for everything sacred. DM Sans (sans) for
everything that serves the product. Any feature that presents God's Word uses Cormorant.
Any UI element uses DM Sans. No exceptions.

**Scale**

| Role | Family | Size | Weight | Line Height | Use |
|---|---|---|---|---|---|
| Display | Cormorant | clamp(2.6rem, 6vw, 4rem) | 300 | 1.1 | Wordmark "Declare & Believe" |
| Verse | Cormorant | 1.05rem | 400 italic | 1.65 | Scripture text |
| Declaration | Cormorant | 1.1rem | 500 | 1.5 | "I am..." declarations |
| Prayer | Cormorant | 1.08rem | 400 italic | 1.8 | Prayer text |
| Body | DM Sans | 14.5px | 400 | 1.75 | Pastoral explanation |
| Label | DM Sans | 13px | 500 | 1.4 | Chips, input labels, translation buttons |
| Caption | DM Sans | 11px | 500 | 1.4 | Verse references, footer, header eyebrow |

**Line height rule for sacred content.** Generous leading (1.65–1.8) is not decorative —
it's a readability requirement for the 3am user reading at low light on a small screen.
Declarations and verses must never feel dense or rushed.

**The Weight Contract.** Display at weight 300 creates the header's elegant lightness.
Declarations at weight 500 give them declarative gravity. Mixing Cormorant weights within
the sacred content hierarchy is intentional and should not be "normalized" to a single weight.

## Elevation

This design is deliberately flat. Cards use a single mild shadow (`0 2px 4px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)`) — visible enough to float off the cream background, invisible enough to disappear during reading.

**The No-Deep-Shadow Rule.** No drop shadows above 16px blur. No `box-shadow` with spread
greater than 4px except on the primary submit button (which uses a wider shadow for tactile
emphasis). Sacred content sections (verse blocks, prayer box, declaration list) have no shadow —
only background color and border distinguish them.

The submit button (`btn-declare`) uses a deliberate heavier shadow (0 2px 4px + 0 4px 16px)
to give it tactile depth, signaling it is the primary action. All other elements remain flat.

Hover state for the submit button: -2px translateY lift + shadow expansion. Active state: +1px
press-down. These micro-interactions are the only "physical" feedback in the UI.

The cross loader sits in open space with no card behind it — the ambient radial gradient
is its only container.

## Components

### Input Card
White background, `parchment` border (1px), `rounded.card` (16px), `spacing.card` (2rem) padding.
Mild shadow (see Elevation). Contains: struggle chips grid, optional crisis banner, translation
toggle, textarea, submit button.

### Struggle Chips
Pill shape (`rounded.pill` = 20px). Resting: `cream` bg, `parchment` border, `text-muted` label text.
Selected: `forest` bg, white text, no border. Transition: 0.2s ease on all properties.
Grid: `flex-wrap`, gap `spacing.sm`. Minimum touch target: 36px height (visual footprint — the
product-wide 44px interactive-hit-area floor from PRODUCT.md's Accessibility & Inclusion section
still applies underneath; reach it with padding/min-height on the tappable element, not by growing
the visible pill past this 36px guidance).

### Translation Toggle
Three-button group (NKJV / NLT / NIV). Resting: transparent bg, `parchment` border, `text-muted`
text. Active: `gold-button` bg, white text. Transition: 0.15s ease.

### Textarea
Min-height 100px. Resting: `cream` bg, `parchment` border, `rounded.input`. Focus: `white` bg,
`gold` border (2px). `DM Sans` 14px, `text-ink`, line-height 1.6. Resize: vertical only.

### Submit Button (`btn-declare`)
Full width. `forest` bg, white text, `rounded.button`. Heavy shadow (see Elevation). On hover:
`forest-light` bg, -2px translateY, shadow expands. On active: +1px translateY. On disabled:
60% opacity. Label: "Speak Truth Over This" with a symbolic cross/spark icon. DM Sans 15px
weight 500.

### Crisis Banner
Conditional — appears only when "suicidal thoughts" chip is selected. Warm background (#FFF8F0),
amber border (#F5A623). Contains 988 Lifeline and Crisis Text Line. Should be the most
prominent element on screen when visible — do not let it get buried below other components.

### Cross Loader
Two gold bars forming a + shape. Pulse animation: 1.4s ease-in-out infinite, opacity 0.4–1.0.
`prefers-reduced-motion`: static cross at full opacity, no pulse.

### Verse Block
Each verse: `cream-dark` background, left border `gold` (3px solid), `rounded.sm` on right side.
Verse reference: DM Sans 11px weight 500, `gold-dark`, uppercase. Verse text: Cormorant italic
1.05rem, `text-ink`, line-height 1.65. Three verse blocks stack with `spacing.md` gap.

### Declaration List
Each declaration: gold number/bullet, Cormorant 500 1.1rem, `forest` color. 3–5 items.
Line-height 1.5. Gap between items: `spacing.md`.

### Prayer Box
Distinct container: subtle gradient background (cream to cream-dark), `parchment` border.
Large opening quote character (`"`) as a decorative overlay in `gold-light` at ~10% opacity.
Text: Cormorant italic 1.08rem, `text-ink`, line-height 1.8.

### Action Row
Three buttons: Copy All (primary gold style), Share (ghost), Save (ghost). `DM Sans` label +
icon. On mobile (≤600px): stack vertically, full width. Toast notification on copy/share/save:
bottom-right, 3s auto-dismiss, `forest` bg + white text.

## Do's and Don'ts

**Do** use Cormorant Garamond for every Scripture passage, declaration, prayer, and the wordmark.
The moment sans-serif appears in sacred content, the distinction collapses.

**Do** keep the cream background as a resting state. Don't fill sections with white or dark
backgrounds — the cream is the sacred space. White is reserved for interactive cards that need
to float above it.

**Do** use `prefers-reduced-motion` on every animation: the cross loader pulse, the results
fade-up, button hover transforms. The 3am user may have this set.

**Do** ensure crisis content — the 988 banner, the crisis-aware AI response — is immediately
legible. Never make crisis resources feel like fine print.

**Don't** introduce pastel colors, soft sage greens, dusty roses, or warm taupes. These pull
the palette toward wellness-app territory. Forest + gold + cream is the full palette; stay there.

**Don't** use cursive or script fonts. The brand is pastoral and grounded, not decorative.
Cormorant Garamond already has the warmth and authority needed.

**Don't** add cards inside cards. The input card is the only elevated container. Result sections
(verses, declarations, prayer) use background color and borders only — not additional card shadows.

**Don't** let the UI chrome compete with Scripture. If a heading, button, or label is drawing
your eye away from a verse or declaration, it's too loud.

**Don't** center long body copy. The pastoral explanation is prose — it needs left alignment
and a 65ch max-width for readability. Centered prose reads as inspirational poster, not pastor.
