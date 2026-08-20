# Incident — completed Journey day content replaced during locale restore

**Status: resolved. Data loss confirmed and not recoverable.**

| | |
|---|---|
| Introduced by | PR #8, merge `55e8102` — "enforce canonical locale integrity for Journey days" |
| Corrected by | PR #9, merge `63a3580` — "preserve completed content during locale restore" |
| Rollback boundary | `63a3580` |
| Scope | Frontend only. No Convex or Worker deployment was involved at any point. |
| Root-cause analysis | `docs/investigation/journey-plan-locale-integrity.md` |

No reflection, prayer or Vault content is reproduced in this note. Reflections
are stored separately from day content and were never touched.

---

## What happened

PR #8 fixed a real defect: `PLAN[]` was serving as both the canonical Journey
record and the current display copy, so a plan could hold days in different
languages while claiming a single one. The fix gave every day its own locale
stamp and, on restore, reset days whose language no longer matched the reader to
the English authored baseline so they could be regenerated coherently.

That repair was correct for a day the reader had not yet walked. It was applied
to every day, including days already completed.

## Root cause

The completion check was reading a value that had not been assigned yet.

`completed()` derives from `state.day`. `state.day` is assigned **after**
`restoreInstance()` runs — both call sites do `startPlan(); restoreInstance();`
and only then `state.day = saved.day`. During restore, `state.day` therefore
still held its initial value of `1`, so `completed()` returned `0` and **every
day looked unwalked**. The guard that should have protected completed content
never fired for anything.

This is why the bug was invisible in review: the code read as though it checked
completion, and the check was real — it was simply asking a variable that had not
been populated yet.

## Impact

Completed Journey day content could be replaced with authored-bank content during
locale restore. The blast radius was readers whose active language differed from
the language a completed day had been generated in, which in practice meant
Spanish readers with pre-existing journeys.

### Known affected record

The owner's personal `anxiety` Journey. Day 1 read `"Lay It Down"` during the
Release B production smoke test and afterwards read `"The Hand-Off"`. It is not
the authored baseline either — `fallbackPlan` day 1 is always
`"Bring It to Jesus"` — so the content that was replaced was generated content,
not template content.

## Recovery investigation

Every available source was checked. None holds the original English day content.

| Source | Result |
|---|---|
| Browser locale cache (`db_journey_locale:*`) | Holds only the **Spanish translation** of the day, plus a source-content hash. The hash is one-way; it cannot reconstruct the English it was derived from. |
| Convex `journeyTranslations` | Emptied during Release B cleanup, and held translations rather than originals in any case. |
| Vault | Holds reflections, not day content. |
| Prior browser-storage snapshot | None taken before the affected release. |
| Another device or browser profile | None available with a pre-incident copy. |
| Server-side day records | None exist. Journey day content is device-local by design. |

**The exact original content is not recoverable. Nothing was regenerated,
reconstructed or guessed to stand in for it.** The current record is preserved
as-is and is now protected from further change.

## The fix

**Completed Journey content is immutable.** A language mismatch is never
sufficient reason to rewrite a day someone has already walked.

Restore now treats completed days as metadata-only: they may receive a locale
classification so they can be displayed and handled honestly, and nothing else.
No authored field is reset, no generated flag cleared, no content regenerated, no
progress touched. Only days the reader has **not** walked may be repaired.

Completion is now read from **persisted** state rather than from in-memory
`state`: `db_journey_lock` (written by `setLock`) and `db_active_journey`
(written by `saveActive`), taking the **higher** of the two. Erring toward
"completed" preserves content; erring the other way destroys it.

Days that arrive without a usable stamp are classified rather than changed. A day
whose own fields are in different languages is marked `mixed-legacy`, kept
exactly as it is, given no blanket language, and refused by the translation
transport with `source-unresolved` before any reservation — so it costs nothing.

## Regression coverage

`scripts/verify-journey-locale.ts`, section 15 "Completed-day immutability".
Twelve fixtures plus an explicit cannot-recur assertion covering: the completion
predicate reading persisted state rather than `state.day`; taking the higher of
the two records; completed days receiving metadata only; and idempotence, so a
second restore performs no additional write.

## Follow-up guardrail

Recorded in `TODO.md`:

> Any restore or migration capable of changing canonical completed content must
> use persisted completion state and must pass a byte-for-byte completed-content
> preservation fixture before production.

## What this incident is worth remembering for

Three defects in this work were caught by behavioural fixtures and missed
entirely by the string-matching harness: a classification pass ordered after the
stamping pass, which made a whole branch unreachable dead code; a language sniff
that treated "not Spanish" as English; and a locale mapper that collapsed an
unresolved value to English. A test that greps source text cannot see any of
those. A test that runs the code can.
