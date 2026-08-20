# Journey locale module

Pure building blocks for Spanish Journey content. **No product code imports this yet.**

Steps 1 to 3 of the approved implementation sequence. No DOM, no storage, no network, no endpoint.
Surfaces are wired later, behind an internal flag, and only after the production translation transport
exists as its own approved deployment checkpoint.

```bash
node scripts/verify-journey-locale.ts     # 74 deterministic checks, no dependencies
```

| File | Contains |
|---|---|
| `types.ts` | Vocabulary and invariants. `TranslatableFields` is the privacy boundary. |
| `locale-cache.ts` | Source hashing, versioned cache identity, legacy adoption, immutability guards. |
| `verified-scripture.ts` | Reference parsing, chapter validation, verse and range extraction, provenance. |
| `translation-transport.ts` | Transport interface, privacy guard, single-flight, deterministic mock. |

---

## The five invariants

1. A completed day is **never regenerated**. A Spanish view is a translation of that record.
2. The English original is **immutable**, which is what makes "switch back to English" exact.
   `assertWritable()` throws rather than trusting call sites.
3. Quoted Scripture is **never produced or translated by a model**. It comes from the verified source
   with the version label that source reported, or it is not rendered.
4. User-authored text is **never translated and never sent**. `assertNoUserAuthoredContent()` enforces
   this at runtime, because payloads get assembled from untyped objects.
5. Progress is **language-neutral**. Only displayed content varies by locale.

---

## Design notes worth knowing

**The cache identity is versioned, not just per-locale.**
`db_journey_locale:<instance>:day<day>:<src>:<dst>:<sourceHash>:v1`. The old design guarded language
with a soft `lang` field, which failed open: records written before the field existed had
`lang === undefined`, the check short-circuited, and English content was pinned permanently. A key
cannot fail open the way a field can.

**Hashing is FNV-1a, not a crypto digest.** The job is "did the source change", where a collision costs
a stale translation, not a security failure. It must be synchronous because it runs on every cache
lookup in the browser; `SubtleCrypto` is async and would push async through every caller for nothing.

**Fetching is injected.** `fetchVerse()` takes a `ChapterFetcher`, so every branch — including
`translation-mismatch` and `network` — is testable offline.

**This module fixes a real duplication.** `BOOK_ALIASES` currently exists in four places
(`today.astro`, `journey.astro`, `vault.astro`, `word.astro`) with inconsistent casing: `word.astro`
lowercases its keys, the others Title Case them. `verified-scripture.ts` normalises case-insensitively
and should become the single source when those call sites are next touched.

---

## Verified source

Confirmed 2026-08-14 against the live API through the **already-deployed** Worker, read-only, **no
deploy performed**:

```
GET /bible?translation=rvr1909&book=PSA&chapter=56
→ { reference: "Salmos 56", translation: "RVR1909", book: "PSA", chapter: 56,
    verses: [{ n, t }, ...] }
```

Confirmed across Psalms, John and Isaiah. No copyright/FUMS field (RVR1909 is public domain). A bad
chapter returns `400 {"error":"Invalid chapter."}`.

`validateChapterResponse()` rejects any response whose reported translation does not match what was
requested, so English text can never be relabelled as a Spanish translation. That check has a
dedicated test.

---

## Not in this module

The production transport: the Convex action, the internal Worker route, the server-to-server secret,
quota and concurrency policy, and privacy-safe logging. Those are a separate approved milestone. Until
they exist, use `createMockTransport()` — never a fake or absent network endpoint.
