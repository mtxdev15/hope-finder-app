# Step 5 — Wiring the Spanish Journey surfaces

**Status: plan only. No surface has been edited.** `src/pages/journey.astro` is untouched.

Prerequisites, all met: the pure locale module (74 checks), the verified Scripture utility, and the
authenticated translation transport, **deployed and inert** (see
`docs/implementation/journey-translate-transport.md`).

---

## 1. The flag, and what "rollback" means

```js
// src/pages/journey.astro frontmatter
const JOURNEY_ES_CONTENT = import.meta.env.DEV || import.meta.env.PUBLIC_JOURNEY_ES === '1';
```

Same shape as the preview-tools guard, for the same reason: with the flag unset, Vite folds the
condition to `false` and esbuild drops the branch, so the production bundle contains no new render
path at all. **Rollback is removing the flag from the build environment — not a code revert.**

Unlike the preview gate, `import.meta.env.DEV` is included here so the whole thing is live in local
development without configuration. The production build stays inert until `PUBLIC_JOURNEY_ES=1` is set
deliberately.

**Every surface below reads the flag through one helper**, not by repeating the condition. Two guards
that must agree is how the preview gate nearly drifted; one helper cannot.

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
| 1 | No English authored-bank content under Spanish chrome | assert no rendered string is a member of the `JOURNEY_CONTENT` string set |
| 2 | No mixed-language frame | snapshot during the transition, not only after |
| 3 | No unverified verse labelled RVR1909 | every rendered verse carries `verseSource: 'bible-api'`; force the fetch to fail and assert no quotation renders |
| 4 | No reflection or user prayer sent | intercept the transport; assert the payload keys are a subset of the six allowlisted fields |
| 5 | Exact English original on switch-back | byte-compare the rendered English before and after a round trip |
| 6 | Guest review stays accessible in English | signed out, Spanish chrome: original readable, notice shown, no silent translation |
| 7 | Failure never falls back to English | force transport failure; assert the Spanish retry state |

Checks 1 and 4 are the two that would embarrass us most, so both are mechanical rather than visual.

---

## 5. Rollback boundary per surface

| Surface | Blast radius if wrong | Rollback |
|---|---|---|
| Completed-day review | read-only screen; original untouched | unset flag |
| Fruit Log | read-only list | unset flag |
| Day-Opening | first screen of a day; no writes | unset flag |
| Today card | home card only | unset flag |
| Preview | pre-commit screen; no journey exists yet | unset flag |
| Active ritual | **highest** — the writing path (reflection save, completion) | unset flag; writes stay on the untouched English path |
| Language switching | cross-cutting render | unset flag |

**No surface changes what is written.** The Spanish work is display-only: same records, same progress,
same completion. That is what keeps every rollback a flag flip.

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
