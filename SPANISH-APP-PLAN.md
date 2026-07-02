# Full Spanish App — Tracked Plan

**Branch:** `feature/es-full-app` (all work for this feature lives here; production only
deploys from `main`, so nothing ships until we merge).
**Goal:** make the ENTIRE Declare experience available in Spanish, then add a gentle
"¿Ver en español?" banner + a language toggle that auto-detects the visitor's device
language. A Spanish speaker should never hit an English screen.
**Status legend:** [x] done · [~] in progress · [ ] to do

---

## Confirmed decisions (from Jeff)

1. **Scope:** the WHOLE app in Spanish, not just the SEO pages. Auto-switching flips on
   only after every layer below is translated and QA'd.
2. **Switch behavior:** a gentle, dismissible banner on first visit ("¿Ver en español?")
   plus a language toggle in the slide-out menu. Never a forced redirect. We keep the
   `hreflang` tags already in place so Google indexes both languages.
3. **The Word, translation policy:**
   - **Spanish mode: RVR1909 is the ONLY and the DEFAULT translation.** No picker, no
     compare-to-other-versions. The reader is locked to RVR1909.
   - **English mode: unchanged.** All 7 translations (WEB, KJV, ASV, NKJV, NIV, NLT,
     RVR1909) remain selectable, with compare.
4. **Struggle-chip autofill MUST keep working** exactly like English (see the Invariant
   below).
5. **Spanish verse "Profundiza" breakdown voice:** written in the teaching style of
   **Pastora Yesenia Then** (voice guide below). English stays McClure-informed. Original
   writing, never copied. Always Bible-accurate, RVR1909 pulled from the deployed worker,
   never fabricated.

---

## INVARIANT — do not break chip autofill

`src/pages/today.astro` `preselect(s)` (≈L353) matches the incoming `?struggle=` value
against each chip's `data-struggle` attribute; if nothing matches it invents a raw chip
from the literal text. Therefore:

- **`data-struggle` stays the canonical English key** (e.g. `Stress & Burnout`,
  `Fear & Anxiety`). Only the visible chip LABEL gets translated.
- **SEO Spanish pages keep passing the English key** in `?struggle=` (they already do,
  e.g. `/today?struggle=Stress%20%26%20Burnout`). Do NOT translate the param.
- The chip lights up (Spanish label), and the English key flows to the AI together with a
  `language=es` flag so the AI answers in Spanish about the right struggle.
- If we ever localize `data-struggle`, the SEO buttons break (they would spawn a duplicate
  English-text chip). Acceptance test below guards this.

---

## The five layers

### Layer 1 — Bible text  [x] DONE
RVR1909 is live in the Word reader; the worker serves it (id `592420522e16049f-01`,
KV-cached). Nothing to do.

### Layer 2 — Static SEO pages  [x] DONE
All 15 struggle pages + `/es/luchas` hub + giving pages are in `/es`, with RVR1909,
Profundiza, deep-links, hreflang, sitemap. (Profundiza voice revisit is an open question,
see bottom.)

### Layer 3 — App interface strings  [~] IN PROGRESS
DONE + verified (branch `feature/es-full-app`): the runtime engine (`public/declare/i18n.js`
+ `i18n-strings.js`), overflow guards (`i18n-guards.css`), and these surfaces in Spanish —
home `/`, shared chrome (`DeclareLayout`+`TabBar`), `/today` (chip-autofill invariant proven),
`/word` (RVR1909-only lock + Spanish book list via `i18n-bible-es.js`), `/you` (+ the in-app
EN|ES language toggle), `/vault`, `/signin`, `/crisis`, and the `/es/bienvenido` static twin.
REMAINING in Layer 3: `journey.astro` UI (big; overlaps Layer 4), and the shared
`auth-modal.js` sign-in/sign-up form (a component; flagged). Bible book-name data was done
inline. Original notes below.


**Goal:** every visible word in the app has a Spanish version, driven by the active language.

- **Files (Astro app pages):** `src/pages/index.astro` (the instant struggle response),
  `today.astro`, `journey.astro` (or wherever the Journey UI lives), `word.astro`,
  `you.astro`, `welcome.astro`, `signin.astro`/`Signin`, plus the shared chrome
  (`/declare/chrome.*`, menu, footer) and any component partials.
- **Approach:** one small i18n dictionary, e.g. `src/i18n/strings.js` exporting `{ en:{...},
  es:{...} }`, plus a tiny helper `t(key)` that reads the active language (from the
  `declare-lang` cookie set by Layer 5). Pages render from `t()` instead of hardcoded text.
  Because these are Astro/inline-JS pages, a light runtime swap (data-i18n attributes or a
  render-time lookup) is fine; no framework needed.
- **Includes:** headings, sub-copy, all button labels, input placeholders, the 33 struggle
  **chip labels** (translate the label, NOT `data-struggle`), menu + footer, What's New,
  toasts + error messages, empty states, the Vault, the crisis/988 band (keep 988 as-is;
  translate the surrounding copy), and date/format bits.
- **Acceptance:** with `declare-lang=es`, no English text renders on any app page; the chip
  autofill test still passes; reduced-motion + mobile (640/860px) both clean.

### Layer 4 — The AI's own words (instant response + Journey)  [x] DONE (live-verified)
`declare-api.js` (/today, Option A) and `journey-engine.js` (Journey, Option B) each take a
`language` option; in Spanish they append a Spanish system-prompt block (respond in español tú,
quote ONLY RVR1909 exactly / never fabricate, the voice split A vs B). `today.astro` +
`journey.astro` pass the cookie language. Verified live against the worker: both return valid
Spanish JSON with accurate RVR1909 and the correct voice. No Worker change. REMAINING: the
Journey's OFFLINE authored fallback bank (`fallbackPlan`) is still English (rare path).

### (superseded original Layer 4 note)  [x]
**Goal:** when language is Spanish, the pastoral response, declarations, prayer, and verse
"breakdown" come back in Spanish, quoting RVR1909. **Voice split (per decision 2):** the
`/today` instant response uses Option A (warm-friend message + declarations + prayer; Yesenia
Then voice only in the breakdown); the 5-day Journey uses Option B (Yesenia Then voice
throughout). So the two callers get DIFFERENT Spanish system-prompt blocks.

- **Files:** `src/app/declare/declare-api.js` (instant response, Haiku 4.5, builds
  `systemPrompt`), `public/declare/journey-engine.js` (5-day Journey, Sonnet 4.6), and the
  source-of-truth prompt doc `declare-and-believe-system-prompt.md`. Seed/fallback content
  `src/data/content.js` needs a Spanish sibling `src/data/content.es.js` (Spanish verses =
  RVR1909, declarations, prayers) for offline/fallback parity.
- **Mechanism (no worker change):** the frontend already sends the full `system` + `user`
  prompt in the request body; the Cloudflare Worker only proxies it and adds the API key.
  So we add a `language` param in the caller and, when `es`, append a Spanish instruction
  block to the system prompt: "Respond entirely in Spanish (es-LA, informal tú). Quote
  Scripture ONLY from the Reina-Valera 1909 (RVR1909). Write the verse breakdown in the
  teaching voice described below." Keep the JSON response shape identical.
- **RVR1909 fidelity:** the model must not invent Spanish verse text. Where the flow can,
  pull the actual RVR1909 from the worker `/bible?translation=rvr1909&book=<USFM>&chapter=N`
  and pass it in; otherwise instruct RVR1909-only and spot-check.
- **Acceptance:** in Spanish mode, `/today` and the 5-day Journey return valid JSON fully in
  Spanish with RVR1909 citations; declarations/prayer read naturally; breakdown matches the
  voice guide; English mode is byte-for-byte unchanged.

### Layer 5 [x] DONE (lang-banner.js; navigator.languages; verified EN=no / ES-fresh=yes / chosen=no)
(orig) ### Layer 5 — Detect + banner + toggle + persistence  [ ] TO DO (flip on LAST)
**Goal:** detect the device language, offer Spanish gently, remember the choice, and route.

- **Detection (client-side):** read `navigator.language` / `navigator.languages`. If it
  starts with `es` and the user has not already chosen, show the banner.
- **Banner:** small, dismissible, bottom or top: "¿Prefieres Declare en español?" +
  [Sí, ver en español] [No, gracias]. Appears once; dismissal remembered.
- **Toggle:** a language switch (EN | ES) in the slide-out menu on every page.
- **Persistence:** a `declare-lang` cookie (readable by both static `/es/*` pages and the
  app) + localStorage mirror. Values `en` | `es`. Choosing sets it; the app UI (Layer 3)
  and AI (Layer 4) read it; static links route to the `/es/*` twin.
- **Routing:** choosing Spanish sends the user to the `/es/*` version of static pages, and
  flips the app pages/AI to Spanish. Keep `hreflang` so Googlebot (crawls in en from the US)
  still indexes both; the banner never blocks the crawler.
- **The Word in Spanish (RVR1909-only):** when `declare-lang=es`, in `src/pages/word.astro`
  set `readT='rvr1909'`, render only the RVR1909 pill (hide the other 6 at L45-51), disable
  compare (L599/L622) and the translation menu (L724-725) or lock them to RVR1909. English
  mode keeps the full `TRANSLATIONS` list.
- **Acceptance:** Spanish-device first visit shows the banner; accepting routes to Spanish
  everywhere and persists across reloads and navigation; toggling back to English works and
  persists; the Word shows only RVR1909 in Spanish and all 7 in English; no auto-redirect
  loops; Googlebot still reaches both language versions.

---

## Yesenia Then — Spanish "Profundiza" voice guide

Study reference (Jeff): Pastora Yesenia Then podcast
(https://podcasts.apple.com/us/podcast/pastora-yesenia-then/id1476557616) and
yeseniathen.com. Write ORIGINAL commentary in her *style*, never her words.

Her teaching voice, to emulate in the Spanish breakdown:
- **Formation over sentiment.** Not momentary inspiration; she awakens conviction, forms
  character, and orders the person's inner process. The breakdown should leave the reader
  changed and with a clear next step, not just comforted.
- **Biblical foundation + practical application.** Rooted firmly in the text, then applied
  to real life. Explain what the verse says, then what it forms in you and what to do with it.
- **Purpose + process language.** Natural use of "propósito", "proceso", "carácter",
  "fundamento", "avanza con determinación", "lo que Dios depositó en ti". Speaks to identity
  and destiny, not just feelings.
- **Warm but direct.** Tender and pastoral, yet unflinching; names the lie or the struggle
  honestly and calls the reader to a decision.
- **Heart-to-heart, activating.** Speaks to the reader personally ("tú"), and ends by
  activating them to move forward in faith.
- **Always Bible-accurate**, RVR1909, never fabricated; original phrasing (do not lift her
  sermons). English pages keep the existing McClure-informed voice; this voice is Spanish-only.

Applies to: Layer 4 AI Spanish breakdowns and any NEW Spanish page Profundiza. Whether to
REWRITE the 15 already-shipped Spanish pages' Profundiza in this voice is an open question
(bottom).

---

## What Jeff needs to do (Cloudflare + Convex)

**Cloudflare Worker — nothing for this feature.** RVR1909 is already deployed; the AI's
Spanish is controlled entirely by the prompt the frontend sends (the worker just proxies +
adds the key); language detection is client-side. No worker code change, no redeploy needed
for Layers 3 to 5.
  - Separate housekeeping (not this feature): rotate the api.bible key that was pasted in
    chat earlier — regenerate it in api.bible, then `cd worker && npx wrangler secret put
    BIBLE_API_KEY` and `npx wrangler deploy`.

**Cloudflare Pages — nothing now.** This feature is on the `feature/es-full-app` branch.
Production builds only from `main`, so it will not affect the live site until we merge.
Cloudflare may auto-create a branch **preview URL** (harmless) you can use to review. When
we are done and you approve, merging to `main` deploys it.

**Convex — nothing required for the MVP.** The chosen language lives in the `declare-lang`
cookie + localStorage, so no schema change is needed to ship this.
  - **Optional enhancement (your call):** if you want a logged-in user's language to follow
    them across devices, we add a `language` field to the user record in
    `convex/schema.ts` + `convex/userdata.ts`; then you (or the deploy) run
    `npx convex deploy` once. Decide when we reach Layer 5. Not blocking.
  - Spanish AI fallback content is a frontend file (`content.es.js`), not Convex.

---

## Build order (recommended)

1. **Layer 5 plumbing only, default OFF:** `declare-lang` cookie + `t()` helper + the menu
   toggle, defaulting to English so nothing visibly changes yet. (Low risk, unblocks 3 + 4.)
2. **Layer 3:** translate all app UI strings into `strings.js` and wire pages to `t()`.
3. **Layer 4:** `language` param → Spanish system-prompt block + `content.es.js`; verify AI
   returns valid Spanish JSON with RVR1909, in the Yesenia Then breakdown voice.
4. **Word RVR1909-only** in Spanish (word.astro conditional).
5. **Turn on Layer 5:** the banner + `navigator.language` auto-detect, once 1 to 4 pass QA.
6. **Full QA pass** (checklist below), then merge to `main`.

---

## Double-check / QA checklist (leave nothing unturned)

- **Links:** every `/es/*` link resolves; menu + footer "Luchas" → `/es/luchas` on all 15
  pages + hub (done); no link points to a missing `/es` twin; breadcrumbs use `/es/luchas`.
- **hreflang:** every EN page ↔ ES twin pair is reciprocal; sitemap pairs present.
- **Chip autofill:** from each Spanish SEO page, "Recibe la Palabra" / "Declara la verdad
  sobre esto" opens `/today` with the correct chip preselected (English key), in Spanish UI.
- **The Word:** Spanish mode shows ONLY RVR1909 (pill, default, compare, menu all locked);
  English mode shows all 7.
- **AI:** Spanish response + Journey are fully Spanish, RVR1909 quotes are real (spot-check
  against the worker), JSON shape unchanged; English mode unchanged.
- **Bible fidelity:** every Spanish verse pulled from the worker, never fabricated; RVR1909
  archaic/Textus-Receptus differences handled (e.g. "solicitud", "caridad", "no piensa el
  mal") as in the shipped pages.
- **Persistence:** language survives reload + navigation; toggle both ways works.
- **No-JS / crawler:** Googlebot reaches both languages; banner never blocks content; no
  redirect loops.
- **Mobile-first + reduced-motion:** every new surface clean at 640/860px and with reduce-motion.

---

## Decisions log

1. **Yesenia Then voice — RESOLVED: new commentary only.** Apply her voice to Layer-4 AI
   Spanish breakdowns and any NEW Spanish pages. Leave the 15 already-shipped pages' Profundiza
   as-is (accurate, live). Revisit later if we want one uniform voice.
2. **Voice reach across the AI response — RESOLVED: split by surface.**
   - **`/today` instant response** (Haiku, `src/app/declare/declare-api.js`) = **Option A**:
     the pastoral message, declarations, and prayer are the warm-friend voice (translated to
     Spanish); the Yesenia Then voice is used ONLY in the verse breakdown. Rationale: meet the
     raw 2am person gently, then teach.
   - **5-day Journey** (Sonnet, `public/declare/journey-engine.js`) = **Option B**: the Yesenia
     Then formation voice carries the WHOLE Spanish response (message, declarations, prayer,
     breakdown). Rationale: the Journey is a committed formation arc, her voice fits throughout.
   English versions of both flows are unchanged.
3. **Language persistence — RESOLVED (senior-dev recommendation): hybrid.** Cookie
   (`declare-lang`) + localStorage mirror is the primary source of truth for EVERYONE, so it
   works for the anonymous 3am visitor with zero account and is available on the first request
   (usable by edge/SSR routing and shared across the static `/es/*` pages and the app). A
   cookie, not just localStorage, because it survives private-mode quirks and is sent before
   JS runs. FOR LOGGED-IN USERS, also mirror the choice to a `language` field on the Convex
   user record so it follows them to a new device and becomes the default there; on login,
   reconcile (account value wins if set, else save the current device choice up). Convex change
   is small (one field in `schema.ts` + `userdata.ts`) and lands in Layer 5; Jeff runs
   `npx convex deploy` once at that point.
   **Mobile:** banner is a bottom sheet (thumb reach, respects safe-area insets), dismissible,
   no layout shift; toggle is a large tap target in the menu.
