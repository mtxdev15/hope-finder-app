# Fruit Log in Spanish — preparation

**Status: PREPARED, NOT STARTED.** No code changed. This is the audit and the
open decisions, written before implementation because the surface has one trap
that would ship four unrelated surfaces if missed.

Branch: `feature/fruit-log-spanish`, from `main` @ `aa38d42`.

---

## 1. What the surface actually is

`#fruitLog`, a standalone `<section>` (`src/pages/journey.astro:135`), rendered
by `renderFruitLog()` (`:672`). It lists one `.fl-item` button per **completed**
day, and each item shows exactly two authored fields:

- `d.fruit` — the fruit name, e.g. "Untensed Trust"
- `d.fruitTruth` — the one-line truth, e.g. "Peace grows where control is released."

Plus interface chrome already localised: the heading (`journey.fruitSoFar`), the
`Día N` label, and the `Revisitar día N` accessible name. Tapping an item calls
`openReview(day)` — the completed-day review that shipped in Release B.

So the Fruit Log is small: **two fields per completed day, up to five days.**

---

## 2. What is already done

`fruit` and `fruitTruth` are **already in the twelve-field translation
allowlist** and are already translated and cached whenever a day is reviewed.
Confirmed against real production rows during Release B closure:

```
"fruit": "Confianza destensada"
"fruitTruth": "La paz crece donde se suelta el control."
```

They were deliberately excluded from Release B's byte-for-byte assertions with
the note "renders on the Fruit Log" — this is that surface.

**No transport work, no new Convex function, no new copy approval is needed for
the content.** The translation already exists. What is missing is *display*:
`renderFruitLog()` reads `PLAN[]`, which is always English.

---

## 3. THE TRAP — five consumers, one in scope

`fruit` and `fruitTruth` are read in **five** places. Only the first is Fruit Log:

| # | Site | Element | Surface | In scope |
|---|---|---|---|---|
| 1 | `:679` | `#fruitList` `.fl-item` | **Fruit Log** | **YES** |
| 2 | `:634` | `#focusLine` | active journey card | no — Today card |
| 3 | `:668-669` | `#fpName` / `#fpTruth` in `#fruitPreview` | active journey card | no — Today card |
| 4 | `:615-620` | `fruitNames()` / `fruitTruths()` → `TheVine.build()` | Vine / Tree of Life | no |
| 5 | `:750` | `.cell-fruit` | past-journeys grid | no |

**Translating `PLAN[]` in place would localise all five and silently ship four
excluded surfaces.** This is the same shape as the Day-Opening flag caught in
Release B, where one build guard was doing two jobs. The implementation must
merge translated fruit **at the Fruit Log render site only**, exactly as
`applyEsReview()` merges for one day without mutating the original record.

---

## 4. The genuinely new problem: a list, not a day

Completed-day review only ever showed **one** day, so it could resolve one
translation and paint once. The Fruit Log shows **N completed days at once**, and
the locale cache is keyed per day (`db_journey_locale:<instance>:day<N>:…`).

That creates a state the review never had: **partial translation.** A reader who
reviewed days 1 and 3 has two cached translations and three uncached. Rendering
naively gives a list that is half Spanish and half English, which is precisely
the "no unlabelled English authored content under Spanish chrome" rule the
review work exists to enforce.

Three ways to resolve it, none obviously correct:

**A. Translate all completed days on first Spanish open.** Up to five model calls
at once for a reader who has never opened the Fruit Log. Honest and complete, but
it is the most expensive thing the app would do, and it spends quota on days the
reader may never look at.

**B. Show only what is already cached; render the rest in English, labelled.**
Free and instant, but produces a deliberately mixed list. Would need a per-item
provenance treatment, and a list of five items each carrying its own banner is
visually heavy.

**C. Translate the fruit fields alone, as a separate cheaper request.** The two
fields are short. A dedicated small payload for N days would cost far less than N
full-day translations, but it needs a new server-side shape and therefore new
transport work, new verification, and it splits the cache key model.

**Recommendation: A, with a caveat.** It preserves the one-language rule without
new transport, and the cost is bounded at five days. The caveat is that it must
be triggered by an explicit reader action rather than by the page loading, so
nobody spends five model calls by scrolling past. In practice that means the
Fruit Log renders English-with-provenance until the reader asks for Spanish, then
resolves all completed days and paints once.

This is the decision that needs Jeff before implementation starts.

---

## 5. Open questions requiring a decision

1. **Which of A / B / C above.**
2. **Provenance treatment for a list.** One banner above the whole section, or
   per item? A section-level banner is calmer and matches the review's quiet
   treatment, but it must be honest if the list is mixed under option B.
3. **Guest behaviour.** Presumed identical to the review — no transport, English
   original, persistently labelled, cached Spanish withheld. Worth confirming
   rather than assuming.
4. **`Tus palabras · Sin traducir`.** Approved in the es-LA review and still
   unbuilt. It marks untranslated *reader* text; the Fruit Log shows no reader
   text, so this is probably **not** its home. Recorded so it is not attached
   here by default.

---

## 6. What is explicitly NOT in this surface

Day-Opening Spanish generation · Today card Spanish generation (including
`#focusLine` and `#fruitPreview`) · Journey Preview · active ritual localisation ·
the Vine / Tree of Life · the past-journeys grid · the navigation IA migration ·
`BRIEF_ES` / `ARC_ES` generated content.

---

## 7. Proposed checkpoint sequence

Same shape that worked for completed-day review, one reviewed checkpoint at a time:

1. **Decision** on section 5, then a prototype of the chosen behaviour at mobile
   width in both themes, for approval before code.
2. **Pure module** for the merge and the partial-state resolution, with harness
   coverage, no rendering.
3. **Render integration** at `#fruitList` only, behind a development guard, with
   a production-bundle exclusion audit proving the other four consumers are
   untouched.
4. **Browser matrix**: first Spanish open, cached reuse, partial state, guest
   path, both themes, reduced motion, three viewports, keyboard, and the
   mechanical assertion that `#focusLine`, `#fpName`, `#fpTruth`, the Vine and
   `.cell-fruit` all still render English.
5. **Promotion** only after that matrix passes.

No new native copy review is expected: the two content fields are already
approved, and the chrome is already localised. Any *new* interface string this
surface needs — a provenance banner variant, for example — would need review
before release.
