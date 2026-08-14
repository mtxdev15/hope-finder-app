# Spanish Journey Phase — Technical Plan

**Status:** prototypes reviewed and **approved with required revisions, now
incorporated.** Production implementation is the next phase and has not begun.
**No production Journey code has been changed.** `journey.astro`, `journey-engine.js`, cache
behaviour, prompts and schema are untouched; no Convex or Worker deploy was
performed.

- Root cause and evidence: `docs/investigation/spanish-journey-content-fallback.md`
- Visible prototypes and final Spanish copy:
  `docs/design/prototypes/spanish-journey-locale/`

The three architecture decisions below are **approved**, with one refinement
folded in throughout: for a Spanish view of a completed day, the Bible quotation
is **never** model-translated. The reference is preserved and the Spanish verse
is retrieved from the verified Bible source; only Journey-authored prose,
commentary, prayer, declaration and reflection prompts are translated, and
provenance is stored for both.

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

**Proposed — versioned locale identity:**

```
db_journey_locale:<instance>:day<day>:<sourceLocale>:<displayLocale>:<sourceHash>:v1
```

Keying only by journey, day and language is not enough: an old Spanish
translation would survive after the original content changed, or after the
translation rules changed. The **source-content hash** invalidates a copy when
the English it was derived from changes, and the **schema version** invalidates
every copy at once when the translation contract changes.

One record per journey **per day per locale pair**. A Spanish reader and an English reader
of the same journey never share a record, so there is no path by which one
language's content can be served to the other. This replaces the soft guard
rather than patching it: the guard failed open, a key cannot.

**Progress stays language-neutral.** `db_active_journey`, `db_journey_lock`,
`db_journeys_done` and `journeySlots` are untouched. Day number, returned count,
completion and slots are facts about the person, not about the language they
read in. Only *content* is per-locale.

### Migration of existing records

Read-time, lazy, non-destructive. No bulk rewrite, no delete.

| Legacy record | Action | Marked as |
|---|---|---|
| has `lang: 'es'` | adopt as the `:es` record | `sourceLocale: es` |
| has `lang: 'en'` | adopt as the `:en` record | `sourceLocale: en` |
| **no `lang` field** | adopt as the **`:en`** record | `sourceLocale: en` + `localeStatus: legacy-adopted` |

`localeStatus: legacy-adopted` is explicit on purpose. It records that the
locale was *inferred at migration*, not observed at generation, so a later pass
can tell the difference. A legacy record is never rewritten, and never silently
marked as though it had originally been generated in Spanish.

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
db_journey_locale:<instance>:day<day>:<sourceLocale>:<displayLocale>:<sourceHash>:v1
```

- The `en` copy is whatever they originally walked. Immutable. Never written
  again once it exists.
- The `es` copy is produced **by translating the stored English day's prose**,
  not by generating a new day. Generating fresh Spanish content would silently
  show them a day they never walked, under a "Reviewing a completed day" badge.
  That would be a lie about their own history.
- Switching back to English reads the `en` copy and restores the original
  exactly, because it was never mutated.

### Translation is a faithful transformation, not a generation

The operation must preserve the original meaning, paragraph and section
boundaries, and Scripture references. It must add no new pastoral advice and no
theology, remove no warning or support language, return structured fields, run
at low-variance settings, and never rewrite the original English record.

### Dedicated transport, not the `/today` allowance

Completed-day translation must **not** share the 10 requests/IP/minute limit
used by `/today`. On a shared network that would let unrelated features block
each other. Required:

- a dedicated translation operation or quota
- authenticated user-level limiting where possible
- one translation request at a time
- single-flight deduplication, so repeated taps cannot create duplicates
- on demand, one completed day at a time, **no eager five-day backfill**
- successful translations cached
- retry backoff after failure

**Only Journey-authored content may be sent.** The person's reflection, prayer
entry and any other user-written text are never sent to the translation service.

**Only prose is translated.** `title`, `fruitTruth`, prayer, declaration,
commentary, encouragement, reflection prompts.

**The Bible quotation is never translated, by the model or otherwise.** For a
Spanish view of a completed day:

- the Scripture **reference is preserved exactly** (same book, chapter, verse)
- the Spanish verse **text is retrieved from the verified Bible source**
- if it cannot be retrieved, no quotation renders and the Spanish retry state
  shows instead (§6)

Provenance is stored for **both** halves, and they are independent:

```
prose:     { translatedFrom: 'en', translatedAt, model }
scripture: { verseSource: 'bible-api', translationId, fetchedAt }
```

A day may therefore have verified Scripture and translated prose, and the UI
labels each accordingly. What must never happen is a model-produced or
model-translated verse carrying a translation name.

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

1. **Loading** — "Estamos preparando el camino de hoy con cuidado."
   (The existing skeleton copy said "Jesús está preparando el camino para hoy";
   that is retired, because the content is AI-assisted and the system must not
   speak as Jesus.)
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

**State that must survive the switch:** the same Journey, the same day, the same
ritual step, completion and pacing. The content surface is replaced **atomically**
so no mixed-language intermediate frame can appear. Focus returns to the
corresponding section after loading, scroll context is preserved where practical,
and switching back renders the original English record exactly.

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

## 9. Prototypes — built, awaiting review

`docs/design/prototypes/spanish-journey-locale/` — self-contained, real design
tokens, both themes, responsive, reduced-motion aware, no production identifiers
or record values.

1. Spanish Day-Opening while loading
2. Spanish Day-Opening ready
3. Spanish Journey Preview and Today card
4. Spanish completed-day review and Fruit Log
5. Language switching during an active Journey

Plus the final Spanish failure, retry and waiting copy, and an annotation legend.

### Approved Spanish copy

| State | Copy |
|---|---|
| Preparing | Estamos preparando el camino de hoy con cuidado. |
| Preparing (card) | Preparando tu camino de hoy… |
| Generation failed | **No pudimos preparar este día.** Tu camino sigue guardado y nada se perdió. Intentémoslo de nuevo. |
| Scripture unavailable | **No pudimos verificar el versículo en este momento.** Preferimos esperar antes que mostrar un texto no confirmado. La Palabra merece esa precisión. |
| Retry | Intentar de nuevo |
| Continue later | Volver más tarde |
| Back to current Journey | Volver al camino de hoy |

**Tone rules.** Name the technical failure plainly; never imply God is absent or
that the person did something wrong.

**The system never speaks as Jesus.** The earlier draft read "Jesús está
preparando el camino para hoy." The content is AI-assisted, so that wording
would attribute authorship to Jesus. "Estamos preparando el camino de hoy con
cuidado" keeps the pastoral register while saying who is actually doing the
work. This is a standing constraint on all Spanish and English Journey copy, not
a one-off edit.

"Tu camino sigue guardado" answers the real fear at a failure screen, which is
losing progress. The Scripture state says *why* we wait, which turns a
limitation into the product's integrity rather than an apology.

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

## 10b. Persistence limitation, stated plainly

**Corrected after the transport was built.** The earlier statement here said
locale copies are device-local, full stop. The `journeyTranslations` table makes
that only half true, so it is restated rather than left to drift:

- **Guest locale copies remain device-local.** Guest translation is deferred, so
  a signed-out reader has no server-side copy at all.
- **For authenticated users, completed Journey-prose translations may be cached
  server-side and restored across signed-in browsers.** When the
  server-computed identity matches, a second device reuses the cached result
  with no further model call.
- **The original English completed content remains immutable**, is stored
  separately, and is never placed in the translation cache.
- **Reflections and prayer entries remain separate and untranslated**, and never
  reach the server cache or the model.
- **Progress and completion remain language-neutral.**

This is a real improvement — someone who reads on a phone and a laptop prepares
a translation once — but the product copy must describe it accurately and must
not imply that anything beyond the translated display copy syncs.

## 10c. Guest audit — is completed-day review supported without an account?

Audited before designing any anonymous path, because inventing guest behaviour
would have been guesswork. Findings, all read-only:

| Question | Answer | Evidence |
|---|---|---|
| Is completed-day review gated on sign-in? | **No.** `openReview()` has no auth check. | `journey.astro:1425` |
| Are day dots tappable for guests? | **Yes**, for any completed day. | `journey.astro:1531-1532` |
| Is Journey content written for guests? | **Yes.** `saveInstance()` has no auth check. | `journey.astro:564` |
| Is Journey content synced to the account? | **No, for anyone.** Only `db_active_journey`, `db_journeys_done` and `db_journey_lock` are registered sync keys. Content is device-local even when signed in. | `journey.astro:454-456` |
| Can a guest accumulate completed days? | **Exactly one.** Day 1 completes freely; Day 2 requires sign-in. | `journey.astro:1367` |

**Conclusion: guest completed-day translation is reachable, but the surface is
one day per journey.** A signed-out person can complete Day 1, switch to
Spanish, and review it.

That is small enough to make deferral a legitimate option. Two ways forward, to
be decided at the transport milestone rather than assumed here:

- **Defer guest translation.** Signed-out review keeps showing the original
  English with an honest note. Smallest attack surface, no anonymous quota to
  design, and it affects at most one day per guest.
- **Tightly limited anonymous path.** Keyed on IP plus request hash, with its own
  much smaller quota, entirely separate from the authenticated path. The browser
  must never claim an account identity.

Either way the browser never submits a user id, and identity for signed-in users
is derived server-side from the trusted authentication integration.

## 11. Unresolved technical dependencies

Each of these must be closed before or during implementation. None blocks the
prototypes, which are complete.

| # | Dependency | Blocks | Needs |
|---|---|---|---|
| 1 | ~~RVR1909 source identifier unverified~~ **RESOLVED.** Verified against the live API through the already-deployed Worker, read-only, **no deploy performed**. Returns `translation: "RVR1909"`, localized book names (`Salmos`, `San Juan`, `Isaías`), no copyright/FUMS field, and `400 {"error":"Invalid chapter."}` on a bad chapter. Confirmed across Psalms, John and Isaiah. | nothing | Remaining: attach the returned `translation` value as provenance rather than hardcoding a label. Update the stale "CONFIRM this id" comment at `worker/src/index.js:28` when the Worker is next touched. |
| 2 | **No single-verse endpoint.** The Worker returns whole chapters as `{reference, translation, book, chapter, verses:[{n,t}]}`. Verified shape. | shared extractor | **Decided: extract client-side**, no Worker change and no deploy. Put it in one shared, tested utility — validating book, chapter, verse and optional ranges — rather than duplicating logic inside `journey.astro`. |
| 3 | **Reference → USFM mapping for Spanish input.** `src/data/usfm.js` is keyed by English book names; the Journey's references are English, so this works, but it needs the same `BOOK_ALIASES` normalisation already used by `passageLink()`. | `fetchVerse()` | Reuse existing maps; no new data. |
| 4 | **Translation needs a dedicated transport.** It must not share the 10 req/IP/min `/today` allowance, or unrelated features block each other on a shared network. | Completed-day locale copies | Design a dedicated operation/quota with user-level limiting, one-at-a-time, single-flight dedup, caching and backoff. Likely a Worker change, so its own approval. |
| 5 | **`BRIEF_ES` / `ARC_ES` do not exist.** ~250 lines of pastoral Spanish; the current Spanish prompt is bilingual because it injects English `BRIEF`/`ARC`. | Quality of Spanish generation | Content authoring, plus native es-LA review. |
| 6 | **`max_tokens: 1500` truncates Spanish**, which runs ~20-25% longer. Truncation currently returns null and silently fell back to English. | Generation reliability | Raise for `es`, check `stop_reason`. |
| 7 | **No test runner.** `package.json` has four scripts; there is no lint, test, typecheck or E2E. | Repeatable Test A / Test B | Either accept scripted browser passes, or add a runner as its own decision. |
| 8 | **Native es-LA editorial review** of all new Spanish copy, including the failure states above. | Ship quality | A human reviewer, not a model. |
| 9 | **Storage growth.** A second locale copy per journey and per day roughly doubles the local content cache. `db_journey_inst:*` is deliberately not synced to Convex, so this is device-local only. | Nothing yet | Confirm the localStorage budget is comfortable before backfilling completed days. |

## 12. Explicitly out of scope

Pricing, subscriptions, entitlements, pacing enforcement, the Release B Journey
redesign, and the route-loader work. Server-authoritative pacing remains a
separate future Convex phase. No schema change is required by this plan: Convex
stores no Journey content, so there is nothing to migrate server-side.
