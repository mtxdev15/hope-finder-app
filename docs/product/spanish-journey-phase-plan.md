# Spanish Journey Phase — Technical Plan

**Status:** plan only. No Journey renderer, cache, prompt, schema or saved
content has been changed. Prototypes are the next step and must be reviewed
before any implementation begins.

Root cause and evidence: `docs/investigation/spanish-journey-content-fallback.md`.

---

## 1. What this phase must be true at the end

1. Locale-aware content-cache keys.
2. Separate locale copies for completed days.
3. Original completed content stays immutable.
4. Spanish Day-Opening, Journey Preview, Today card, ritual, Fruit Log and
   completed-day review never default to English.
5. Verified Spanish Scripture comes from the Bible source.
6. No model-recalled English verse may be labelled RVR1909.
7. Generation failure produces a Spanish retry state, never English content.
8. Language switching loads the correct locale-specific content.
9. Existing reflections and completion state are never overwritten.

---

## 2. Locale-aware cache identity

Today: `instKey()` is `'db_journey_inst:' + active.id` (`journey.astro:538`).
One record per journey, no language, with a soft `lang` field that is skipped
entirely when absent.

**Proposed:**

```
db_journey_inst:<journeyId>:<lang>      // en | es
```

One record per journey **per language**. A Spanish reader and an English reader
of the same journey never share a record, so there is no path by which one
language's content can be served to the other. This replaces the soft guard
rather than patching it: the guard failed open, a key cannot.

**Progress stays language-neutral.** `db_active_journey`, `db_journey_lock`,
`db_journeys_done` and `journeySlots` are untouched. Day number, returned count,
completion and slots are facts about the person, not about the language they
read in. Only *content* is per-locale.

### Migration of existing records

Read-time, lazy, non-destructive. No bulk rewrite, no delete.

| Legacy record | Action |
|---|---|
| has `lang: 'es'` | adopt as the `:es` record |
| has `lang: 'en'` | adopt as the `:en` record |
| **no `lang` field** | adopt as the **`:en`** record |

The no-`lang` case is the one that matters: those records predate the field, and
the authored bank they were seeded from is English-only, so `en` is the honest
label. Adopting rather than discarding is what satisfies requirement 3 and 9 —
the user's completed days survive exactly as they were.

The legacy key is **copied, not moved**, and left in place for one release as a
rollback path. A follow-up cleanup can remove it once the phase is proven.

---

## 3. Completed days: locale copies, original immutable

This is the case in the reported screenshot: `REPASANDO` (reviewing) shows
Spanish chrome around English content, and it never self-corrects because
`ensureDay()` is only ever called for the current day.

**Rule: a completed day is a record of something the user actually walked. It is
never regenerated.**

So a Spanish view of a completed English day must be a **Spanish rendering of
that same day**, not a different day:

```
db_journey_day:<journeyId>:<dayIndex>:<lang>    // display copy
```

- The `en` copy is whatever they originally walked. Immutable. Never written
  again once it exists.
- The `es` copy is produced **by translating the stored English day's prose**,
  not by generating a new day. Generating fresh Spanish content would silently
  show them a day they never walked, under a "Reviewing a completed day" badge.
  That would be a lie about their own history.
- Switching back to English reads the `en` copy and restores the original
  exactly, because it was never mutated.

**Only prose is translated.** `title`, `fruitTruth`, prayer, commentary,
encouragement. The verse is **never** translated (see §4).

**Future days** (not yet walked) are generated in the active language as they
already are, not translated.

**Reflections are not touched by any of this.** They live in the Vault as
`journeyReflection` items and are the user's own words. They are displayed
as-written in whatever language they were written. Never translated, never
regenerated, never overwritten.

---

## 4. Verified Scripture, and the RVR1909 labelling defect

This is the most serious item in the audit and should land first.

**Today:** `journey-engine.js:575` hands the model the **English ESV** verse text
and asks it to produce RVR1909 from memory; `journey-engine.js:548` then stamps
`obj.ver = 'RVR1909'` unconditionally, with no validation. English text can
therefore be presented to a Spanish reader labelled as a Spanish translation.

**Proposed:**

1. **Delete the unconditional stamp.** `ver` is set only from the response of an
   actual Scripture fetch.
2. **Fetch the verse.** The Worker already proxies API.Bible and already knows
   RVR1909:
   - `worker/src/index.js:29` `RVR1909_BIBLE_ID = '592420522e16049f-01'`
   - `GET /bible?translation=rvr1909&book=<USFM>&chapter=<n>` returns the chapter
     as `{ verses: [{ n, t }] }` (the shape `/word` renders at `word.astro:748`)
   - Reference → USFM via `src/data/usfm.js` plus the `BOOK_ALIASES` map already
     used by `passageLink()` in `today.astro`, `journey.astro`, `vault.astro`
3. **Add one small helper**, `fetchVerse(ref, translation)`, that resolves a
   reference to `{ text, ver }` or `null`. Reused by Journey; `/word` keeps its
   existing chapter path.
4. **No fetch, no quotation.** If the verse cannot be retrieved, the day does not
   render an unverified quotation. It renders the Spanish retry state (§6).

**Blocker to clear first.** `worker/src/index.js:28` carries an explicit warning:

> CONFIRM this id against `GET /v1/bibles?language=spa` with your key before
> deploying.

The RVR1909 Bible id has not been confirmed against the live API. That must be
verified before this phase depends on it, and it needs a Worker deploy, which is
its own approval.

**Also fix the bilingual prompt.** `journey-engine.js:572-573` injects English
`BRIEF` and `ARC` text into the Spanish prompt. Spanish `BRIEF_ES` / `ARC_ES`
need authoring (~250 lines of pastoral Spanish). This is the largest content
task in the phase and is the reason it cannot be a quick fix.

---

## 5. Surfaces that must never default to English

| Surface | Today | After |
|---|---|---|
| Ritual `#dayflow` | Spanish skeleton, then content | unchanged, already correct |
| **Day-Opening** `#dayOpen` | English bank immediately | awaits content, shows skeleton |
| **Journey Preview** | English bank, never generates | locale copy or Spanish placeholder |
| **Today's Journey card** | English under a Spanish shimmer | skeleton until locale content ready |
| **Fruit Log** | frozen original language | reads the `:<lang>` day copies |
| **Completed-day review** | frozen original language | reads the `:<lang>` day copies |

The pattern to copy already exists and is already Spanish:
`renderDayLoading()` at `journey.astro:1304-1306`. This phase extends that one
pattern outward; it does not invent a new loading idiom.

**The English authored bank stops being display content when `lang === 'es'`.**
It remains the English seed and the English fallback. That single rule is what
requirement 4 reduces to.

**Ordering fix:** Day-Opening currently opens 380ms after committing a journey
(`journey.astro:1848`), far faster than a Sonnet call. It must open on the
skeleton and fill in, rather than open on stale content.

---

## 6. Loading, error and retry states

Three distinct states, all authored in Spanish, none falling back to English:

1. **Loading** — the existing skeleton copy, "Jesús está preparando el camino
   para hoy."
2. **Failed** — a real Spanish error with a retry affordance. Something plain and
   pastoral, not a stack trace, and not an apology that implies God is absent.
   Copy to be approved with the prototypes.
3. **Retry** — re-runs generation (or the verse fetch) for that day only.

Failure must be **visible**. Today a failed Spanish generation silently degrades
to English, which is precisely why this shipped unnoticed. Silent degradation is
what we are removing.

Known contributing failure modes to handle, from the audit:
- 20s timeout in `generateDay()`
- Worker rate limit, 10 requests per IP per minute, shared with `/today`
- `max_tokens: 1500` truncating Spanish, which runs ~20-25% longer than English;
  raise it for `es` and check `stop_reason` rather than treating a truncated
  parse as a null result

---

## 7. Language-switch behaviour

`public/declare/i18n.js:68-72` already dispatches a `declare-lang` event.
`journey.astro` subscribes in only two places (`:1474`, `:1897`), and both
re-render the same unchanged `PLAN`.

**Proposed:** one listener that treats a language change as a content
invalidation:

1. Drop in-memory `PLAN` and `active._ai`.
2. Load `db_journey_inst:<id>:<newLang>` if present.
3. Otherwise show the skeleton and produce the locale copy.
4. Re-render whatever surface is currently open, including an open `#dayflow`.

Switching is then symmetric: `es → en` restores the untouched original English,
`en → es` shows the Spanish copy. No reload required, and no partially-swapped
screen.

---

## 8. Verification

`package.json` has exactly four scripts: `dev`, `build`, `preview`, `astro`.
**There is no lint, test, typecheck or E2E runner.** This phase should not claim
tests that do not exist, so verification is a scripted browser pass driven
through the Playwright MCP tools, plus the two adversarial checks below. If we
want these to be repeatable in CI, adding a runner is its own decision.

### Test A — English content cannot appear under Spanish UI

Mechanical, not a spot check. Build a set of every string in the English
authored bank (`public/declare/journey-data.js`, ~1550 lines), then with
`lang = es` walk: Day-Opening, Journey Preview, Today card, all seven ritual
steps, Fruit Log, and completed-day review, asserting **no rendered text is a
member of that set**.

Also run it in the failure case, with generation forced to fail, where the old
code fell back to English.

### Test B — English text cannot be labelled RVR1909

1. Every rendered verse carries provenance (e.g. `verseSource: 'api.bible'`).
   Assert nothing labelled `RVR1909` lacks it.
2. Assert no rendered verse text labelled `RVR1909` appears in the English ESV
   `VERSES` table in `journey-engine.js:18-330`.
3. Force the verse fetch to fail and assert the day renders the retry state and
   **no quotation at all**.

### Regression checks

Reflections save and reload; Vault records intact; completion state and returned
count unchanged; active-Journey slots unchanged; pacing lock untouched;
`/word` unaffected.

---

## 9. Prototypes required before implementation

Per the agreed working method, these are built and reviewed **before** the
2,700-line renderer is touched:

1. Spanish Day-Opening while content is loading
2. Spanish Journey Preview
3. Spanish Fruit Log
4. Language switching during an active Journey
5. Generation failure and the Spanish retry state

Plus the copy for the failure and retry states, which needs approval on tone.

---

## 10. Sequencing

| Step | Work | Risk |
|---|---|---|
| 0 | Confirm the RVR1909 Bible id against the live API | blocker, needs Worker deploy approval |
| 1 | Prototypes and failure/retry copy | none, no shipped code |
| 2 | Remove the unconditional `ver = 'RVR1909'`; add `fetchVerse()`; no-fetch means no quotation | medium, highest value |
| 3 | Locale cache keys plus lazy migration | medium |
| 4 | Skeleton-gate Day-Opening, Today card, Preview | medium, renderer edits |
| 5 | `declare-lang` invalidation listener | low |
| 6 | Completed-day locale copies by translation of record | medium |
| 7 | `BRIEF_ES` / `ARC_ES` authoring; `max_tokens` for `es` | large, content |
| 8 | Full Test A and Test B pass | none |

Steps 2 and 7 are the ones that change what a Spanish reader is actually told.
The rest is plumbing that stops English leaking through.

---

## 11. Explicitly out of scope

Pricing, subscriptions, entitlements, pacing enforcement, the Release B Journey
redesign, and the route-loader work. Server-authoritative pacing remains a
separate future Convex phase. No schema change is required by this plan: Convex
stores no Journey content, so there is nothing to migrate server-side.
