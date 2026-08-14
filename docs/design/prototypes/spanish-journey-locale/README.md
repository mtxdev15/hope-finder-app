# Spanish Journey locale prototypes

**Design-only. Not wired into production. Not a public route.** Touches no real Journey storage, no
Vault, no Worker, no Convex. Nothing here reads or writes a real record.

Open `index.html` directly, or serve the folder:

```bash
cd docs/design/prototypes/spanish-journey-locale && python3 -m http.server 4599
```

Built from the real `declare.css` design tokens for both themes and the real fonts (Cormorant Garamond
plus DM Sans via the same Google Fonts link `DeclareLayout.astro` uses). The theme toggle and the
reduced-motion simulation in the toolbar are real, not mocked; the page also honours the OS-level
`prefers-reduced-motion` setting on its own.

---

## What it shows

| # | Prototype | Point |
|---|---|---|
| 1 | Day-Opening while loading | Spanish-only loading language, no flash of English authored content |
| 2 | Day-Opening ready | Spanish title, encouragement, action; Scripture version stated explicitly |
| 3 | Journey Preview and Today card | locale-correct content before display, loading where generation is incomplete |
| 4 | Completed-day review and Fruit Log | an English completed day shown in Spanish, original preserved |
| 5 | Language switching | EN→ES, ES→EN, the transition, and cache behaviour |
| 6 | Failure, retry and waiting copy | final Spanish copy, never falling back to English |
| 7 | Annotation legend | every term in one place |

Each prototype carries an annotation panel covering cache key structure, source locale, display locale,
translation provenance, Scripture provenance, immutable original content, locale display copy, loading
state, retry state, the language-switch event, and legacy-record adoption.

---

## Scripture: source verified, integration not built

The RVR1909 source identifier **is now verified**. It was confirmed against the live API through the
**already-deployed** Worker, read-only, with **no deploy performed**. Across Psalms, John and Isaiah it
returns `translation: "RVR1909"`, localized book names (`Salmos`, `San Juan`, `Isaías`), no
copyright/FUMS field, and `400 {"error":"Invalid chapter."}` on a bad chapter. The Spanish verses shown
here are the real fetched text.

**The integration itself is still not built.** No shared verse-extraction utility exists and nothing in
the Journey fetches Scripture yet. A verified *source* is not a finished *feature*, and nothing here
should be read as evidence that it is.

---

## Approved architecture these prototypes assume

1. **Completed days are translated, never regenerated.** A completed day is a record of something the
   person actually walked. The English original is immutable; the Spanish view is a separate locale
   display copy.
2. **The Bible quotation is never model-translated.** The reference is preserved, and the Spanish verse
   is retrieved from the verified Bible source. Only Journey-authored prose, commentary, prayer,
   declaration and reflection prompts are translated. Provenance is stored for both.
   Translation is a **faithful transformation, not a generation**: it preserves meaning, paragraph and
   section boundaries and Scripture references, adds no pastoral advice or theology, removes no warning
   or support language, and never rewrites the English record.
3. **Progress is language-neutral.** Journey identity, day number, current step, completion, returned
   count, active-Journey slot, reflection state and pacing state are shared facts across languages.
   Only displayed content varies by locale.
4. **Legacy records without a locale are adopted as English**, explicitly marked
   `sourceLocale: en` and `localeStatus: legacy-adopted`. Never rewritten, never silently claimed as
   originally Spanish.
5. **Reflections are the user's own words.** Displayed as written, never translated, regenerated or
   overwritten, and **never sent to the translation service**. Prototype 4 deliberately shows an English
   reflection on a Spanish screen.
6. **The locale cache identity is versioned**, carrying the locale pair, a source-content hash and a
   schema version, so a stale translation cannot survive a content or rules change:
   `db_journey_locale:<instance>:day<day>:<src>:<dst>:<sourceHash>:v1`
7. **Translation gets a dedicated quota**, never the `/today` allowance: one request at a time,
   single-flight deduplicated, on demand for one day only, cached on success, backoff on failure.
8. **The system never speaks as Jesus.** The content is AI-assisted, so the waiting copy says who is
   actually doing the work: "Estamos preparando el camino de hoy con cuidado."

## Persistence limitation

Journey content is not stored in Convex, so the first implementation creates locale copies in **browser
storage only**. Spanish display copies are **device-local**; another browser may need to prepare the
translation again. Progress and completion remain account-level where currently supported. **Cross-device
synchronisation of locale copies is deferred**, and nothing in the product may imply otherwise.

---

## Privacy

No account identifiers, document identifiers or production record values appear in this prototype or
its annotations. Cache keys are shown as shapes
(`db_journey_locale:<instance>:day<day>:<src>:<dst>:<sourceHash>:v1`), never as real values. The example
journey is drawn from the repository's authored content, and the Spanish verse from the public-domain
RVR1909 via the existing Bible proxy — not from any user's data.

---

## Status

Prototypes and copy are for review. **No production Journey code has been changed.** `journey.astro`,
`journey-engine.js`, cache behaviour, prompts and schema are all untouched, and no Convex or Worker
deploy was performed. Implementation begins only after this review.
