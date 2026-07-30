# B3.1 / B3.1A: Seven-Step Journey Design Prototype

**Design-only. Not wired into production. Not a public route. Does not touch real Journey storage, real
Vault, or the real AI Worker.**

This is a standalone, self-contained HTML/CSS/JS prototype recreating the B3 mockup direction for the
seven-step Journey ritual, using real repository assets, real Journey content (the seven-step step
content shown is Day 1 of the authored `shame` journey, "No Condemnation," pulled verbatim from
`public/declare/journey-data.js`; the Day-N background and progress context are driven by
`window.__proto.setDay(n)` across the full real 5-day `shame` arc), real `declare.css` design tokens for
both light and dark themes, and the real fonts (Cormorant Garamond plus DM Sans via Google Fonts, same CDN
link `DeclareLayout.astro` uses).

It proposes a **paginated, one-step-at-a-time** ritual shell (`Day N of 5`, per-step Back/Continue, a
7-dot progress rail; see "Top bar, content head, and button correction" below for why the header no
longer also spells out `Step N of 7` in visible text). Per `docs/design/release-b-b3-seven-step-audit.md`
§0, this is a
genuine product-direction proposal, not a recreation of how the real Journey works today. The real
`renderDayFlow()` shows all seven steps as one continuously-scrolling page with a single "Complete Day
N" action, not seven separate screens. That gap is intentional and documented, not an oversight.

## B3.1A: Step 6 correction and light/dark theme support

This prototype was revised in a second pass (B3.1A) to correct two things the original B3.1 pass got
wrong:

1. **Step 6 ("Reflect") originally recommended device-local-only storage** ("Saved locally on this
   device" as the final state, reflection content never sent for AI processing). That did not match the
   approved product direction and has been replaced with the Approved Step 6 Product Model: a temporary
   draft, an intentional Vault save, and optional AI-assisted guidance the user must explicitly request.
   Full detail in `docs/design/release-b-b3-seven-step-spec.md`.
2. **The prototype originally described itself as dark-theme-only.** It now supports both the real light
   and real dark themes from `declare.css`, switchable live, with all state preserved across the switch.

### Top bar, content head, and button correction

A third, later live-review pass corrected three more elements that read as colder or busier than the rest
of the ritual's contemplative tone, without losing any information:

- **The top bar no longer spells out `Step N of 7` visibly.** It now shows only `Day N of 5`. The 7-dot
  progress rail (already `aria-hidden`) still carries step position visually for sighted users; a new
  visually-hidden `#rTopCtxSR` span carries the full `Day N of 5, Step N of 7` string for screen readers,
  so the accessible information is unchanged, only what's printed on screen changed.
- **The leaf glyph above every step's title was removed.** All seven steps' `.rhead` blocks now contain
  only the step title and its supporting line.
- **Step 6's primary action reads "Continue" instead of "Continue to Step 7"** once a reflection is saved
  (and in every other state that offers it: guidance response, guidance error, crisis route), matching how
  "Continue" is phrased everywhere else in the ritual rather than singling out Step 6 with an explicit
  step-number callout.

Full rationale (including the contemplative-app comparisons that motivated it) is in
`docs/design/release-b-b3-seven-step-spec.md`'s "Progress treatment" and "Top bar and content head
correction" sections.

### Draft vs. Vault, in the prototype

Three distinct, simulated states, never conflated:

- **Draft.** Typing debounces to a "Draft saved" status (about 700ms). This represents temporary,
  loss-prevention-only storage. It is never described as permanent and never called "Saved to Vault."
- **Saved to Vault.** Only reached by tapping "Save Reflection." Shows the reflection read back (quoted)
  plus a "Saved to Vault" status row and a "View in Vault" link into the Vault destination demo.
- **Draft restored / Draft and Vault conflict.** `setReflectState('restored')` shows the "Draft restored"
  banner; `window.__proto.showDraftConflict()` shows the calm recovery card for the rare case where a
  saved Vault reflection and a newer unsaved draft could both exist.

None of this touches real `localStorage`, Convex, or `vault-store.js`. All of it is in-memory prototype
state, discarded on reload. See `docs/design/release-b-b3-seven-step-spec.md`'s "Vault Storage Reality"
section for what the real Vault backend actually supports today and what a production implementation
would need to add.

### AI consent, loading, response, and failure

Reachable only from the Saved-to-Vault state via the secondary "Receive Guidance" button:

- `window.__proto.openAIConsent()` opens the consent sheet (mobile bottom sheet / desktop dialog, same
  component as the support drawer). "Cancel" returns to Saved-to-Vault with no side effects.
- Clicking "Yes, Receive Guidance" (or calling `startAIGuidance()`) moves to a loading state, then, after
  a short simulated delay, to a response. `window.__proto.setReflectState('ai-loading')` and
  `setReflectState('ai-response')` jump directly to either state for screenshotting.
- The response card is labeled "Gentle Guidance" (not "AI Guidance"; see the terminology note in
  spec.md's "Optional AI Guidance Model" section) and is structured: label, pastoral acknowledgement,
  a visually distinct Scripture block (Psalm 34:18, ESV, the real translation and typographic treatment
  already used for Step 1), a short explanation, one next step (with a real tappable Scripture
  follow-through link, see below), one reflection question, and a small, deliberately unalarming closing
  line disclosing that the response was AI-assisted and is not God speaking directly.
- `setReflectState('ai-error-unavailable')` and `setReflectState('ai-error-connection')` show the two
  required failure states. Both reassure the user their reflection is still safely saved in Vault and
  offer "Try Again" and "Continue."
- **No real network call is ever made.** Nothing here reaches `hope-finder-worker.thinktoro.workers.dev`
  or any AI endpoint. See spec.md's "AI Guidance Integration Reality" for what the real Worker can and
  cannot support today.

### Crisis-language simulation

`window.__proto.setReflectState('crisis')` shows a compact safety-first card ("Your reflection is safely
saved. Before anything else, let's get you connected with support.") and then automatically opens the
real support sheet, the same one reachable from the heart-icon help control on every step, sourced
verbatim from `src/pages/crisis.astro`. There is no keyword-detection logic in this prototype; the state
is triggered explicitly to demonstrate the required *behavior*, not an implementation of detection. See
spec.md's "Crisis-Language Behavior" section.

### Scripture follow-through

The Gentle Guidance response's "next step" line includes a real, tappable "Read Psalm 34" control
(`window.__proto.showScriptureReader()`), demonstrating a deep link into the app's existing chapter
reader with a proposed "Back to your Journey" breadcrumb. `window.__proto.showDashboardResume()`
demonstrates the companion Journey Dashboard card that would let a user pick the reading back up later,
reusing the same visual pattern as the existing Resume card. Both are representative recreations, not
rebuilds of `word.astro` or the real Journey Dashboard; neither file was touched.

### Theme switching

A small, explicitly labeled "Preview" control in the top-right corner (`.theme-preview-ctl`) switches
between light and dark. This is a **design-only reviewer tool**, not the real `window.DeclareTheme`
control from `public/declare/theme.js`, and is not wired to `localStorage['declare-theme']`. It exists so
both themes can be inspected side by side during review.

Switching theme changes only the `data-theme` attribute on `<html>` and the resulting token values. It
never resets the current step, gate state, breath phase, reflect state, open overlay, or typed text.
`window.__proto.setTheme('light' | 'dark')` drives it for scripted screenshotting; `window.__proto.state`
exposes the current values for verification.

Both `:root` (light) and `html[data-theme="dark"]` blocks in `styles.css` are ported verbatim from the
corresponding blocks in `public/declare/declare.css`, hardcoded rather than `var()`-linked to the live
stylesheet (this file is intentionally not wired into the app). Four small tokens exist only in this
prototype, not in `declare.css` (`--btn-shadow`/`--btn-shadow-hover`, `--day-scrim`, `--ok`/`--err`); see
spec.md's "Light and Dark Theme System" section for why, and what a production implementation should do
with them.

## Personalized per-day backgrounds

The ritual shell's photographic background changes per Journey day, not just once per struggle: real
Scripture-arc-matched imagery generated for all 5 days of the `shame` journey (No Condemnation, White as
Snow, He Lifts My Head, Come Out of Hiding, A New Creation), progressing from a single heavy shaft of
light in shadow (Day 1) to lush, radiant new growth (Day 5). Same generation approach as B2.2's
`dayopen-bg.jpg` (nano-banana, `dayopen-bg.jpg` itself as the style reference, anti-hallucination-text
prompting, reviewed individually before use), resized/recompressed to the same 150 to 270KB weight budget.
Assets live in `assets/backgrounds/` (prototype-scoped, not `public/declare/`; moving these into the real
asset directory is a B3 production implementation step). Driven by `window.__proto.setDay(n)`; any day
without a dedicated generated image falls back to the real, already-committed `dayopen-bg.jpg`. Only
`shame`'s full 5-day set exists in this pass; see the spec doc for the complete 150-image (30 struggles
times 5 days) production plan.

**The same photo is used in both themes.** Only the CSS scrim overlay changes (`--day-scrim`, swapped per
theme), so no second image set was generated solely because a theme was added.

## Files

- `index.html`: shell markup plus all 7 steps' content, pre-rendered in the DOM, visibility controlled by
  JS state (no client-side routing, no framework). Includes the Step 6 reflect-state views, the AI
  consent sheet, the Vault destination demo, and the Scripture follow-through demo overlays.
- `styles.css`: light and dark theme tokens ported verbatim from `declare.css`'s `:root` and
  `html[data-theme="dark"]` blocks (hardcoded, not `var()`-linked to the real stylesheet, since this file
  is intentionally not wired to the app).
- `prototype.js`: a state machine exposing `window.__proto` for scripted, reproducible screenshotting and
  interactive click-through review (see below). All state is in-memory only; nothing is written to
  `localStorage` or any other persistence layer.
- `assets/backgrounds/`: the 5 generated `shame` day backgrounds. Real assets elsewhere (`dayopen-bg.jpg`
  and the support/crisis icons, etc.) are referenced by relative path directly into the real
  `public/declare/` directory, so the prototype always reflects the actual current repository assets rather than stale
  copies.

## Simulated state, labeled explicitly

Draft persistence, Vault saving, AI guidance, and the resume/completed-review cards all use **in-memory
prototype state**, not real `localStorage`, Convex, or the AI Worker. Every screen that represents
persisted, saved, or generated data carries a small `[SIMULATED]` badge in the corner (hidden from
screenshots via `data-hide-badge`, visible during interactive review) so it is never mistaken for a real,
working feature.

## Driving it for screenshots

Open `index.html` directly (`file://.../index.html` works fine; everything is self-contained except the
Google Fonts CDN call and the relative real-asset paths). Then drive it via `window.__proto`, e.g. from
Playwright:

```js
window.__proto.setTheme('light');              // light | dark
window.__proto.goToStep(6);                     // 1-7
window.__proto.setDay(2);                       // 1-5, for the "Day N of 5" label
window.__proto.setReflectState('saved');        // empty | typing | restored | longcontent |
                                                 // saving | saved | ai-loading | ai-response |
                                                 // ai-error-unavailable | ai-error-connection | crisis
window.__proto.openAIConsent();
window.__proto.closeAIConsent();
window.__proto.showDraftConflict();
window.__proto.showScriptureReader();
window.__proto.showDashboardResume();
window.__proto.showVault('List');               // List | Detail | Private
window.__proto.setBreathPhase('inhale');         // ready | inhale | hold | exhale | complete | reducedmotion
window.__proto.openSupport('open');              // resting | focused | open
window.__proto.closeSupport();
window.__proto.showResume();
window.__proto.showDayOpeningTransition();
window.__proto.openReview(3);                    // read-only completed-review mode, viewing step 3
window.__proto.closeReview();
window.__proto.setReducedMotion(true);
window.__proto.setLargerText(true);              // simulates OS/browser text-size boosting via rem scaling
window.__proto.setZoom(200);
```

## What this prototype is not

- Not a new route in the Astro app (`src/pages/` was not touched).
- Not connected to `db_active_journey`, `db_journey_lock`, `db_journey_inst:*`, `vault-store.js`, Convex,
  or the AI Worker.
- Not a replacement for, or modification of, `journey.astro`'s real `renderDayFlow()`, `vault.astro`, or
  `word.astro`.
- Not using any mockup-generated logo, tree, vine, leaf mark, or icon. See
  `docs/design/release-b-b3-seven-step-spec.md`'s "Mockup Placeholders That Must Not Become Production
  Assets" section for the full list of what was deliberately excluded.
