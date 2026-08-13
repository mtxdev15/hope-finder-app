# Spanish Journey Content Fallback: Root-Cause Investigation

**Status: AUDITED AND UNRESOLVED.** No code was changed. No Journey rendering,
cache behavior, schema, prompt or saved content was modified in this round. This
document exists so the fix can be scoped as its own reviewed phase.

**Symptom:** with Spanish active, Journey day content (title, verse,
encouragement) can render in English while the surrounding UI is correctly
Spanish.

---

## 1. The locale IS being sent. That is not the cause.

This is the first thing to correct, because the original TODO entry guessed
otherwise.

`src/pages/journey.astro:510-512`:

```js
const p = window.JourneyEngine.generateDay({
  struggleId: active.id, dayIndex: idx, theme: theme,
  seed: (active._seed + idx * 101) >>> 0, fromLabel: cFrom(), toLabel: cTo(),
  language: (window.I18N && window.I18N.lang && window.I18N.lang()) || 'en' })
```

`public/declare/journey-engine.js:565` branches on it and emits a fully Spanish
prompt, instructing the model to answer entirely in Spanish. `parseJSON(text,
o.language)` forces `obj.ver = 'RVR1909'` for Spanish.

So the generation layer is locale-aware. **A missing `lang` parameter is not the
defect.**

One detail worth noting for the fix phase: the language exists only inside the
prompt string. The request payload (`journey-engine.js:634-639`) carries only
`model`, `max_tokens`, `temperature` and `messages`, so the Worker cannot log,
route or cache by language.

---

## 2. Actual root cause

`PLAN[]` is initialized from `JOURNEY_CONTENT` in
`public/declare/journey-data.js:60`, an authored bank of roughly 1550 lines that
is **100% English**. There is no Spanish bank.

Three surfaces read `PLAN[idx]` **synchronously, without ever awaiting
generation**. Only `#dayflow` and the home card call `ensureDay()`.

| Surface | What renders before the AI resolves | Calls `ensureDay()`? |
|---|---|---|
| `#dayflow` ritual | Spanish skeleton, `renderDayLoading()` `journey.astro:1304-1306` | Yes, `:1324` |
| **Day-Opening** `#dayOpen` | **English bank** | **No** |
| **Journey Preview** `#journeyPreview` | **English bank** | **Never** |
| "Today's Journey" card | English bank under a Spanish shimmer | Yes, opportunistic `:620` |

### The dominant reproduction

`renderDayOpening()` at `journey.astro:1428-1436` has no generation call at all:

```js
function renderDayOpening() {
  const d = PLAN[state.day - 1];
  $('doTitle').textContent = d.title;
  $('doVerseText').textContent = '"' + d.verse + '"';
  $('doRef').textContent = d.ref + (d.ver ? ' · ' + d.ver : '');
  $('doEncourage').textContent = d.fruitTruth || '';
}
```

It is opened **380ms** after committing a journey (`journey.astro:1848`). A
Sonnet 4.6 call at 1500 max tokens takes seconds. So a Spanish user sees an
English title, English verse and English encouragement on the **very first screen
of Day 1**, under correctly Spanish buttons.

The home card is the second most common: it paints English text with a Spanish
"Personalizando tu camino" shimmer over it, then swaps. If generation fails, the
shimmer clears and the English text is left as the final state.

The Journey Preview is the worst case: `showJourneyPreview()`
(`journey.astro:1774-1826`) renders all five days from the English bank and never
generates anything, ever.

---

## 3. Loading-skeleton behavior

A correct pattern already exists and is used by exactly one surface.
`renderDayLoading()` (`journey.astro:1298-1313`) shows a Spanish skeleton
("Jesús está preparando el camino para hoy.") while `ensureDay()` is in flight.
The fix phase should extend this pattern to Day-Opening rather than invent a new
one.

---

## 4. Instance cache: key and language guard

Cache key, `journey.astro:538`:

```js
function instKey() { return 'db_journey_inst:' + (active && active.id); }
```

**No language in the key.**

There is a soft guard. Write (`:546`) stores `lang: curLang()`. Read (`:554`):

```js
active._ai = (o.lang && o.lang !== curLang()) ? {} : (o.ai || {});
```

Three holes:

1. **`PLAN` is restored unconditionally** at `:553`. Only the `_ai`
   "already generated" flags are cleared. On a language switch plus reload, the
   previous language's generated plan is loaded into `PLAN` and painted
   immediately. If the fresh round trip then fails, stale English persists.
2. **Instances written before the `lang` field existed have
   `o.lang === undefined`**, so `(o.lang && ...)` short-circuits, the guard is
   skipped, and `o.ai` is kept. For those users `ensureDay()` short-circuits at
   `:507` and English content is **pinned permanently**.
3. **`pastFruitSummary()`** (`journey.astro:664-675`) reads the instance cache
   with no language check at all.

---

## 5. `declare-lang` event flow, and stale content on switch

`public/declare/i18n.js:68-72` dispatches a `declare-lang` CustomEvent on
`setLang`. Language itself lives in the `declare-lang` cookie plus `localStorage`
(`i18n.js:20-21`), read through `window.I18N.lang()`.

`journey.astro` subscribes in only two places, `:1474` (repaints `#dayOpen`) and
`:1897` (repaints Preview). **Both re-render the same unchanged `PLAN`.** There
is no listener that invalidates `PLAN`/`active._ai` or re-runs `renderHome()`.

Consequences:

- **Switching language mid-session, no reload:** chrome flips to Spanish, day
  content stays English. `ensureDay()` returns the cached object at `:507`.
- **After a reload:** `restoreInstance()` clears `_ai`, first paint is still the
  stale-language `PLAN`, then the home card's opportunistic `ensureDay()`
  regenerates. `src/app/declare/account-sync.js:123-127` forces one guarded
  reload when a pulled account language differs, so that path recovers; the
  in-page toggle path does not.
- **Completed days never regenerate.** `ensureDay()` is only ever called for
  `state.day`, so days 1..n-1 keep their original language forever. A user who
  switches to Spanish on Day 3 gets a **permanently bilingual** Fruit Log and
  Vine.

---

## 6. Migration considerations

**Nothing server-side needs migrating.** Convex stores no Journey day content at
all: `convex/schema.ts:237-249` `journeySlots` holds only `userId`, `journeyId`,
`status`, `startedAt`, `endedAt`, `grandfathered`. No content, no locale field.
`db_journey_inst:*` is deliberately not registered with `registerSyncKey`
(`journey.astro:534-537`, "kept local to avoid bloat"), so generated content never
leaves the device.

The only stale data is device-local `localStorage`, which can be invalidated by
tightening the existing guard. **Saved user reflections must not be touched**, and
completed Journey content must not be silently regenerated.

---

## 7. Two quality defects found alongside, and one is serious

**a. The Spanish prompt is bilingual.** `journey-engine.js:572-573` injects
`BRIEF[struggleId]` and `o.theme` from `ARC[...]`, both English prose, into the
Spanish prompt. Spanish generation therefore runs on mixed-language input.

**b. English text can be labelled RVR1909.** `journey-engine.js:575` hands the
model the **English ESV** verse text and asks it to produce RVR1909 from memory.
Then `journey-engine.js:548` stamps the label unconditionally:

```js
if (es) obj.ver = 'RVR1909';
```

There is no validation that `obj.verse` is actually Spanish, or actually
RVR1909. If the model echoes the English text it was shown, the app presents
**English ESV text labelled as RVR1909**.

This matters more than the rendering bug. Everywhere else in the app, Spanish
Scripture is a real fetched translation: `worker/src/index.js:29` pins
`RVR1909_BIBLE_ID`, and `/word` serves it through the `/bible/*` proxy. Journey
is the one surface that asks a model to recall Scripture from memory and then
labels the result with a translation name it never verified. For a product whose
whole premise is speaking God's Word accurately, a mislabelled verse is the most
serious finding in this audit and should lead the follow-up phase.

---

## 8. Fixability assessment

| # | Fix | Files | Size | Client-side only? |
|---|---|---|---|---|
| 1 | Gate `renderDayOpening()` behind `ensureDay()` using the existing Spanish skeleton | `journey.astro:1410-1436`, `:1848` | S | yes |
| 2 | Harden the cache guard: treat missing `o.lang` as a mismatch, and drop `PLAN` back to `resolveJourneyPlan()` instead of restoring a foreign-language plan | `journey.astro:551-556` | S | yes |
| 3 | Add a `declare-lang` listener that invalidates `PLAN`/`_ai` and re-runs `renderHome()` | `journey.astro` | S | yes |
| 4 | Put the language in the cache key | `journey.astro:538`, `:565`, `:666` | S | yes |
| 5 | Raise `max_tokens` for Spanish and check `stop_reason` (Spanish runs longer; truncation returns null and falls back silently) | `journey-engine.js:636`, `:644` | S | model params |
| 6 | Translate `BRIEF` and `ARC`, or add Spanish variants | `journey-engine.js:332-493` | **M-L**, ~250 lines of pastoral Spanish | prompt content |
| 7 | Stop force-stamping `ver`, and quote real RVR1909 instead of recalling it (ideally reuse the existing `/bible/*` proxy) | `journey-engine.js:18-330`, `:548`, `:575` | **L** | worker + content |
| 8 | Spanish authored fallback bank | `journey-data.js` | **XL**, ~1550 lines | content |
| 9 | Generate Journey Preview cards, or show Spanish placeholders | `journey.astro:1774-1826` | M | yes |

Items 1 through 4 and 9 are pure client-side render and cache logic with no
schema, backend or migration implications. Items 5 through 8 involve model
parameters, prompt content or authored content, which is why the whole thing was
deferred rather than partially fixed.

---

## 9. Recommended follow-up phase

A dedicated Spanish Journey phase, sequenced so the honesty defect (item 7) is
addressed alongside the rendering defect, with **visible prototypes or
screenshots** for review before anything is finalized:

1. Spanish Day-Opening while content is loading
2. Spanish Journey Preview
3. Spanish Fruit Log
4. Language switching during an active Journey
5. Generation failure and fallback behavior

Constraints for that phase: do not overwrite saved user reflections, do not
silently regenerate completed Journey content, never mix English and Spanish
inside one Journey day, and keep Spanish Scripture on the approved
verified-Scripture rule rather than model recall.
