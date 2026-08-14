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

## Scripture in these prototypes is a marked sample

The RVR1909 source identifier in `worker/src/index.js` has **never been confirmed against the live
API**, and confirming it requires a Worker deploy. That is a **production implementation blocker, not a
prototype blocker.**

So every verse in this document is tagged `Muestra · sin verificar`, the version label reads
`pendiente`, and **no sample text is labelled RVR1909**. Nothing here should be read as evidence that
the live Bible integration works.

---

## Approved architecture these prototypes assume

1. **Completed days are translated, never regenerated.** A completed day is a record of something the
   person actually walked. The English original is immutable; the Spanish view is a separate locale
   display copy.
2. **The Bible quotation is never model-translated.** The reference is preserved, and the Spanish verse
   is retrieved from the verified Bible source. Only Journey-authored prose, commentary, prayer,
   declaration and reflection prompts are translated. Provenance is stored for both.
3. **Progress is language-neutral.** Journey identity, day number, current step, completion, returned
   count, active-Journey slot, reflection state and pacing state are shared facts across languages.
   Only displayed content varies by locale.
4. **Legacy records without a locale are adopted as English**, explicitly marked
   `sourceLocale: en` and `localeStatus: legacy-adopted`. Never rewritten, never silently claimed as
   originally Spanish.
5. **Reflections are the user's own words.** Displayed as written, never translated, regenerated or
   overwritten. Prototype 4 deliberately shows an English reflection on a Spanish screen.

---

## Privacy

No account identifiers, document identifiers or production record values appear in this prototype or
its annotations. Cache keys are shown as shapes (`db_journey_day:<journeyId>:<dayIndex>:<lang>`), never
as real values. The example journey and verse are drawn from the repository's authored content, not
from any user's data.

---

## Status

Prototypes and copy are for review. **No production Journey code has been changed.** `journey.astro`,
`journey-engine.js`, cache behaviour, prompts and schema are all untouched, and no Convex or Worker
deploy was performed. Implementation begins only after this review.
