# Journey PLAN locale integrity — audit

**Status: AUDIT COMPLETE, NO CODE CHANGED.** Phase 1 deliverable. The fix is
proposed in section 6 and needs approval before implementation.

Branch: `feature/journey-plan-locale-integrity`, from `main` @ `aa38d42`.
Frozen comparison source: `feature/fruit-log-spanish` @ `4ca0437`, unchanged.

---

## 1. The reproduced symptom

A single live instance held, in one `PLAN[]`:

```
["Confianza arraigada", "Descanso real", "Stayed Mind",
 "Tenacidad de pacto",  "Mind of Christ"]
```

Three Spanish days beside two English ones, in an instance whose stored `lang`
said `es`. Not a rendering bug: the stored record itself is mixed.

---

## 2. PLAN lifecycle — every read and write

`PLAN` is declared at `journey.astro:502` and is module-global.

| # | File:line | R/W | Content source | Expected locale | Locale metadata | Mutates canonical day | Consumers |
|---|---|---|---|---|---|---|---|
| 1 | `journey.astro:533` | **W** (whole) | `resolveJourneyPlan()` → authored bank | **always `en`** | none | replaces all | everything |
| 2 | `journey.astro:548` | **W** (one day) | `JourneyEngine.generateDay({language})` | **current UI language at call time** | **none** | **yes, in place** | everything |
| 3 | `journey.astro:588` | **W** (whole) | `localStorage db_journey_inst:*` | whatever was saved | one `lang` for the whole instance | replaces all | everything |
| 4 | `journey.astro:631` | R | `PLAN[state.day-1]` | assumed current | — | no | Today card, `#focusLine` |
| 5 | `journey.astro:667` | R | `PLAN[n-1]` | assumed current | — | no | `#fruitPreview` (`#fpName`, `#fpTruth`) |
| 6 | `journey.astro:678` | R | `PLAN[i-1]` loop | assumed current | — | no | **Fruit Log** `#fruitList` |
| 7 | `journey.astro:837` | R | `PLAN[fd-1]` as `dEn` | **comment claims "the English original"** | — | no | completed-day review |
| 8 | `journey.astro:1337` | R | `PLAN[day-1]` | assumed current | — | no | Day-Opening |
| 9 | `journey.astro:1669` | R | `PLAN[day-1]` as `english:` | **assumed `en`** | — | no | translation transport |
| 10 | `journey.astro:615-617` | R | `PLAN.map()` | assumed current | — | no | Vine (`fruitNames`/`fruitTruths`) |
| 11 | `journey-data.js` | source | authored bank, 165 entries | **`en` only** | **none** | — | seeds row 1 |
| 12 | `journey-engine.js:505` | source | `generateDay()` return | `o.language` | **none — the returned object carries no locale field** | — | feeds row 2 |
| 13 | `journey.astro:581` | W (storage) | `saveInstance()` | — | **one `lang: curLang()` per INSTANCE** | — | feeds row 3 |
| 14 | `journey.astro:588` | R (storage) | `restoreInstance()` | — | compares instance `lang` only | — | — |

Rows 9 and 7 are the load-bearing ones: both **assume `PLAN` is English**, and
row 7 says so in a comment. Neither assumption holds.

---

## 3. How a day ends up mixed — the exact sequence

1. Reader is in **English**. `startPlan()` seeds `PLAN` from the English
   authored bank (row 1).
2. `ensureDay(state.day)` regenerates **only the current day** in English and
   writes it back in place (row 2). `_ai[idx] = true`.
3. `saveInstance()` persists `{plan, ai, lang: 'en'}` — **one language label for
   a five-day array whose days were written at different times** (row 13).
4. Reader switches to **Spanish**. Neither `declare-lang` listener
   (`journey.astro:1823`, `:2246`) touches `PLAN`; one repaints Day-Opening, the
   other repaints the Preview. **`PLAN` is not invalidated, not reset, not
   regenerated.**
5. On next load `restoreInstance()` sees `o.lang ('en') !== curLang() ('es')` and
   clears `_ai = {}` — the right intent. But it **restores `PLAN` wholesale from
   storage anyway** (row 3). The English content survives; only the "already
   generated" flags are dropped.
6. `ensureDay(state.day)` regenerates **the current day only** in Spanish. All
   three call sites (`:657`, `:1489`, `:1753`) pass `state.day`; no other day is
   ever regenerated.
7. `saveInstance()` now writes **`lang: 'es'`** while days other than the current
   one are still English.
8. From here the record is **permanently mixed**: the next restore sees
   `o.lang === curLang()`, so `_ai` is *not* cleared, and the stale-language days
   are never revisited.

Step 7 is where it becomes irreversible. The instance claims one language while
holding several.

---

## 4. Root cause

**`PLAN[]` is asked to be two different things at once.**

It is the *canonical record* of the Journey — persisted, resumed, and treated as
the immutable original by the completed-day review and the translation transport
(rows 7 and 9). It is also the *current display copy* — overwritten in place, one
day at a time, in whatever language the reader happened to be using at that
moment (row 2).

Three specific gaps make that collision unrecoverable:

1. **No per-day locale.** Neither the authored bank nor `generateDay()`'s return
   value stamps a language onto a day object. Nothing downstream can tell what
   language a given day is in, so nothing can detect the mix.
2. **Instance-level `lang` describing per-day content.** `saveInstance()` writes
   one label for an array whose entries were produced at different times under
   different languages. The label is true of the most recent write only.
3. **Regeneration covers one day.** `ensureDay` is only ever called with
   `state.day`, so a language switch can only ever correct the day the reader is
   standing on, while `lang` is updated as though it corrected all of them.

---

## 5. Why fixing the Fruit Log label would be wrong

The Fruit Log marks the untranslated list `lang="en"`. For a mixed instance that
is inaccurate for some rows. Making the marker conditional would make the label
truthful while leaving the record inconsistent — and the same bad assumption
still feeds the completed-day review (row 7) and, more seriously, the
**translation transport** (row 9), which sends `PLAN[day-1]` as `english:` and
would be asking the model to translate Spanish into Spanish.

That last one is worth stating plainly: the mixed record does not merely mislabel
a list, it can send already-Spanish prose through an English-to-Spanish
translation and bill the reader for it.

---

## 6. Proposed boundary — for approval, not yet implemented

**Rule: `PLAN[]` is canonical content. It is never the translated display copy.**

1. **Stamp every day with its own locale.** `generateDay()` returns
   `{ ..., lang }`; the authored bank is `lang: 'en'` by construction. One field,
   set at the only two points content enters a day.
2. **Make the mix detectable, then make it impossible.** With per-day locale, a
   record can be validated on restore: any day whose `lang` differs from the
   instance's active language is stale.
3. **Reset stale days to the authored baseline rather than leaving them.** On a
   language change, days that do not match are replaced with the English authored
   day (a known-good, known-language starting point) and their `_ai` flag
   cleared, so regeneration has something coherent to work from.
4. **Stop `lang` from lying.** Either derive the instance label from the days
   themselves, or drop it in favour of the per-day field.
5. **Leave the transport's assumption true.** Once every day carries a locale,
   row 9 can assert `english.lang === 'en'` instead of assuming it, and refuse
   rather than translate Spanish into Spanish.

Deliberately **not** proposed here: changing when or how often `ensureDay` runs.
Regenerating all five days on a language switch is a product and cost decision,
not an integrity fix, and it belongs in its own checkpoint.

---

## 7. What this does not cover

Day-Opening, Today card, Journey Preview, active ritual localisation and the
navigation migration are all out of scope. The Fruit Log branch stays frozen at
`4ca0437` and will be rebased onto this fix and re-verified once it lands.
