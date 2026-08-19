# Step 5 — Wiring the Spanish Journey surfaces

**Status: plan only. No surface has been edited.** `src/pages/journey.astro` is untouched.

Prerequisites, all met: the pure locale module (74 checks), the verified Scripture utility, and the
authenticated translation transport, **deployed and inert** (see
`docs/implementation/journey-translate-transport.md`).

---

## 1. The flag, and what "rollback" actually costs

```js
// src/pages/journey.astro frontmatter
const JOURNEY_ES_CONTENT =
  import.meta.env.DEV &&
  import.meta.env.PUBLIC_JOURNEY_ES_CONTENT === '1';
```

Enable locally with `PUBLIC_JOURNEY_ES_CONTENT=1 npm run dev`.

`DEV &&` is deliberate for this checkpoint. A production build must contain **no** active Spanish
locale-render path even if the public variable is set by accident — same reasoning as the preview-tools
guard, and verified by building with the flag deliberately set. Vite folds both literals at build time,
so esbuild drops the branch entirely.

**Rollback means disabling the build-time flag and redeploying** the previous user-facing behaviour,
without reverting the locale modules or the backend transport. It is **not** an instant runtime toggle:
a new build and deploy is required. That is a deliberate trade — turning it off costs a deploy, and in
exchange the shipped bundle contains no new render path at all while the flag is unset.

**Every surface reads the flag through one helper**, never by repeating the condition. Two guards that
must agree is how the preview gate nearly drifted; one helper cannot.

---

## 2. Integration order, and why this order

Approved sequence, each surface landing as its own reviewable commit:

| # | Surface | Why here |
|---|---|---|
| 1 | **Completed-day review** | Directly fixes the reported defect, and exercises the whole stack at once: server translation, locale cache, verified Scripture, immutable English original, switch-back. If this is right, the rest is repetition. |
| 2 | Fruit Log | Same records, simpler rendering. Cheap once 1 works. |
| 3 | Day-Opening | First surface needing the loading state rather than a cache read. |
| 4 | Today's Journey card | Same pattern as 3, smaller surface. |
| 5 | Journey Preview | Multi-day; needs partial-ready rendering. |
| 6 | Active ritual | Largest surface, most steps, most risk. Deliberately last. |
| 7 | Atomic language switching | Cross-cutting; only meaningful once every surface can render both locales. |

Starting with completed-day review is the deliberate choice: it is the **only** surface where the
content already exists, so it needs no generation path. It isolates translation, caching and Scripture
from the loading-state problem, which is the other half of the work.

---

## 3. Per-surface integration contract

Every surface follows the same five steps, so review is comparison rather than re-reading:

1. **Resolve locale** from `window.I18N.lang()`.
2. **If `en`** — render the existing English path unchanged. No new code runs.
3. **If `es`** — look up `db_journey_locale:<instance>:day<day>:en:es:<sourceHash>:v1`.
   - hit → render
   - miss → render the Spanish loading state, request the translation, then render
   - failure → render the Spanish retry state. **Never** fall back to English content.
4. **Scripture** is resolved separately through `fetchVerse()`. No provenance means no quotation and
   no version label.
5. **Never touch** the English original, the reflection, progress, completion or pacing.

---

## 4. Per-surface verification

Each surface must pass all seven before the next one starts:

| # | Check | How |
|---|---|---|
| 1 | No **unlabelled** English authored content under Spanish chrome | assert no rendered string is a member of the `JOURNEY_CONTENT` string set, **unless** the review is in the `original-english` provenance state (see the exception below) |
| 2 | No mixed-language frame | snapshot during the transition, not only after |
| 3 | No unverified verse labelled RVR1909 | every rendered verse carries `verseSource: 'bible-api'`; force the fetch to fail and assert no quotation renders |
| 4 | No reflection or user prayer sent | intercept the transport; assert the payload keys are a subset of the twelve allowlisted fields, and that the server itself rejects a forbidden key |
| 5 | Exact English original on switch-back | byte-compare the rendered English before and after a round trip |
| 6 | Guest review stays accessible in English | signed out, Spanish chrome: original readable, notice shown, no silent translation |
| 7 | Failure never falls back to English | force transport failure; assert the Spanish retry state |

Checks 1 and 4 are the two that would embarrass us most, so both are mechanical rather than visual.

### The check-1 exception: deliberate original-English review

The original rule was absolute, and that was wrong. It said no English authored
content may appear under Spanish chrome, but a Spanish reader is allowed to read
the immutable English original, and two supported paths lead there on purpose:
the signed-out reader who taps "Continuar en inglés", and the signed-in reader
who taps "Ver el original en inglés". Read absolutely, the rule forbids a
feature we intend to have.

What actually matters is not whether English appears, but whether it appears
**unexplained**. The rule is therefore:

> No unlabelled English authored content may appear under Spanish chrome.
> English original content is allowed only after an explicit user choice, and
> only while the persistent original-English provenance state is visible.

Mechanically, whenever `resolveReviewViewState()` returns
`provenanceKind: 'original-english'`, all of the following must hold for the
whole time the English content is on screen:

- the provenance banner reads `journey.review.originalEnglishBanner`;
- the supporting sentence `journey.review.originalEnglishSupport` is visible;
- both appear before the English title in DOM order;
- the English authored content carries `lang="en"` and the Spanish chrome does not;
- the reader reached the state through an explicit choice, never as a fallback.

The state is derived from the content relationship in
`src/app/declare/journey-locale/review-view-state.ts`, never from authentication,
so the guest path and the signed-in path cannot diverge.

---

## 5. Rollback boundary per surface

Rollback for every row below means: unset the build flag, rebuild, redeploy. Not a runtime toggle.

| Surface | Blast radius if wrong | Rollback |
|---|---|---|
| Completed-day review | read-only screen; original untouched | flag off + redeploy |
| Fruit Log | read-only list | flag off + redeploy |
| Day-Opening | first screen of a day; no writes | flag off + redeploy |
| Today card | home card only | flag off + redeploy |
| Preview | pre-commit screen; no journey exists yet | flag off + redeploy |
| Active ritual | **highest** — the writing path (reflection save, completion) | flag off + redeploy; writes stay on the untouched English path |
| Language switching | cross-cutting render | flag off + redeploy |

**Non-destructive is not the same as writes nothing.** No surface modifies the original Journey: the
English content, progress, returned count, completion, pacing, reflections and Vault records are all
left exactly as they are. But authenticated Spanish rendering *does* create new records:

- a `journeyTranslations` server-cache row
- Journey-translation usage and reservation records
- a browser locale-cache copy

So the accurate statement is: **Spanish rendering is non-destructive to the original Journey records.
It creates separate locale-display cache and operational usage records.** Those are additive, scoped to
the translation feature, and removable without touching anything the person actually walked.

---

## 6. What this step must not do

- Not edit `journey-engine.js` or `journey-data.js` — generation of *new* days is unchanged.
- Not change prompts, schema, or Convex functions.
- Not translate reflections or user prayers, ever.
- Not regenerate a completed day.
- Not write locale content for signed-out users.
- Not enable the flag in production until all seven surfaces pass all seven checks.

---

## 7. Open items carried in

1. **`BRIEF_ES` / `ARC_ES` do not exist**, so newly *generated* Spanish days still run on a bilingual
   prompt. That affects surfaces 3 to 6, not 1 and 2. It is content authoring plus native es-LA review,
   and it can land in parallel.
2. **Native es-LA editorial review** of the failure and retry copy.
3. **`max_tokens` for `es`** in the generation path, which truncates ~20-25% more often than English.
4. **Guest translation stays deferred.** Revisit only if usage shows a real need.

---

## 7. Completed-day review — status and release gates

**Technically verified, NOT production-enabled.** The eighteen-check browser
matrix passes in development, four defects found by it are fixed, and the feature
remains behind the `PUBLIC_JOURNEY_ES_CONTENT` development build guard with every
production-bundle probe at zero.

Technical verification is not readiness. The remaining gate is **native es-LA
review of the Spanish a real reader would see**:

| Surface | Copy |
|---|---|
| Original-English provenance | `Contenido original en inglés · Solo lectura` / `Este día se completó originalmente en inglés.` |
| Translated-content provenance | `Traducción al español del contenido original en inglés · Solo lectura` |
| Preparation | `Estamos preparando el camino de hoy con cuidado.` |
| Translation failure | `No pudimos preparar este día.` / `Tu camino sigue guardado y nada se perdió. Intentémoslo de nuevo.` |
| Scripture verification failure | `No pudimos verificar el versículo.` / `No pudimos verificar el versículo en este momento. Preferimos esperar antes que mostrar un texto no confirmado. La Palabra merece esa precisión.` |
| Guest notice | `Este día se completó originalmente en inglés.` / `Puedes seguir revisando el contenido original. Inicia sesión para preparar una copia en español sin cambiar lo que completaste.` |
| Sign-in action | `Iniciar sesión para verlo en español` |
| Return action | `Volver al camino de hoy` |
| Untranslated user text | `Tus palabras · Sin traducir` |

**No native reviewer has read any of this.** The copy was written and approved
in-project. Until an actual native es-LA speaker approves it, this feature must
not be enabled for real readers, and no report should describe the copy as
reviewed.

The AI-generated Spanish day content is a separate matter from this interface
copy and is not covered by that review.
