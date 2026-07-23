# Phase 2 (existing work) — Results Page Redesign

*Written retroactively, documenting work already built and Jeff-reviewed on
`redesign/desktop-web-shell` (commits `1c46e6f`, `a2f8fa6`, `731add8`, `ea33c3e`, `c62f863`) before
this master-build-prompt process began. No runtime code was changed while writing this summary.
Format follows the master prompt's §21 report structure, with an added gap-analysis section per
Jeff's specific request for this task.*

## 1. Goal

Redesign the ≥1024px experience of the Results view inside `/today` (Scripture, Mindset,
declarations, prayer, Journey cross-sell) to feel like a professional web app, without touching
mobile at all. Chosen direction, after three rounds of Mobbin-referenced prototyping: "Guided Reveal
+ Deepen Pane" — a real spine/icon timeline in the center, a left "wayfinding" rail (Read the full
passage, Return to it later, Receive another word, crisis link), and a right "deepen" rail (a
per-verse index with an expandable Breakdown, a Translation switcher, and Your Recent Words).

## 2. What existed before

A single-column results view, identical at every viewport width — no left/right rail, no per-verse
Breakdown, no Translation switcher, no Recent Words. The "Start a 5-Day Journey" card and "Receive
another word" both lived in one plain vertical list at the bottom.

## 3. What changed

- Added `.results-rail-left`/`.results-rail-right` `<aside>` elements at ≥1024px, flexbox-laid-out
  alongside the untouched center content (`.results-main`).
- Left rail: Read the full passage, Return to it later (Save), Receive another word, crisis link.
- Right rail: a verse index with an expandable **Breakdown** per verse (AI-generated, two-part —
  a context paragraph plus a bold "For your [struggle] today/tonight:" application line), a live
  **Translation** switcher (NIV/NLT/KJV, hidden in Spanish since Spanish always reads RVR1909), and
  **Your Recent Words** (other struggles from Vault history, with relative time and "tap to revisit").
- Verse references became clickable links into `/word` (a separate affordance from Breakdown — one
  jumps away to read more, the other goes deeper in place).
- The AI response contract gained an optional `breakdowns` field (`{context, application}` per
  verse) and a new small helper, `translateVerses()`, that re-translates a word already on screen in
  place when the Translation pill is switched, rather than requiring the reader to abandon it and
  generate a new one.
- Two real bugs were found and fixed only after live browser verification (not caught by code
  review alone): a Grid-vs-Flexbox row-sizing bug that opened a large visual gap between the header
  and Scripture content, and a CSS collision (`.today .in`'s centering rule) that made an expanded
  Breakdown render with a large empty-looking gap.
- Copy throughout follows two durable rules added to `PRODUCT.md`'s Writing Rules section this
  session: no em dashes anywhere, and copy should name the spiritual root of a struggle, not just
  the symptom.

## 4. What was preserved

- Mobile (≤480px) is confirmed pixel-identical at every step — all new CSS lives inside
  `@media (min-width: 1024px)` blocks; no base/shared rule was touched.
- The AI response's required fields (`verses`, `explanation`, `declarations`, `prayer`) are
  unchanged; `breakdowns` is additive and optional, so older cached/fallback content without it
  still renders via a graceful fallback message.
- The existing Save/Vault, Share, and Journey-handoff flows are unchanged in behavior, only updated
  to read the correct in-place-translated text/labels.

## 5. Files changed

`src/pages/today.astro` (the largest change — new rail markup, `render()` and a new
`renderVerseText()` for in-place translation swaps, the Translation-pill click handler, CSS for the
rails, the verse-index cards, and the Breakdown accordion), `src/app/declare/declare-api.js` (the
`breakdowns` field, the `translateVerses()` helper), `declare-and-believe-system-prompt.md` (kept in
sync with the `breakdowns` field), `PRODUCT.md` (the two new Writing Rules).

## 6. Data changes

None to Convex. The AI response shape gained one optional field (`breakdowns`); no schema, table,
or persisted-data change.

## 7. Environment variable changes

None.

## 8. Tests run

No automated suite exists. Manual verification (see below) was run multiple times across this
phase's several iterations, specifically *because* an earlier round was reported as "fixed" without
having been checked live, and turned out not to be — later rounds corrected this by verifying every
claim in a real browser before reporting it done.

## 9. Build result

Clean `npm run build` confirmed at each commit in this phase, most recently after the Translation
in-place-swap work (`c62f863`).

## 10. Manual QA steps performed

- Local dev server, real "Receive the Word" submissions (real network calls to the live Worker/AI,
  not mocked), at desktop width (1440px).
- Playwright-driven verification: full-page and viewport screenshots actually read, `browser_evaluate`
  used to inspect computed styles/DOM state directly (not just visual guessing) when a layout bug
  was suspected, and real interaction (clicking pills, expanding Breakdown rows) rather than static
  snapshots only.
- A range-reference edge case (`Philippians 4:6-7`) was specifically tested for the Translation
  switcher, since it was the case that exposed the one real bug found in that feature (see §13).
- Mobile re-verified at 390px after every round of desktop-only changes, and Spanish re-verified
  (`window.I18N.setLang('es')` + a `declare-lang` event) to confirm the Translation section correctly
  hides itself and un-hides when switching back to English.

## 11. Accessibility notes

Reduced-motion: the Breakdown accordion has an explicit `@media (min-width:1024px) and
(prefers-reduced-motion: reduce)` override that disables its transition. Focus states were not
independently re-audited as part of this specific phase beyond confirming existing button/link
semantics were preserved (real `<button>`/`<a>` elements throughout, no `div`-as-control patterns
introduced).

## 12. Security and privacy notes

None applicable — this phase touched presentation and AI-response shape only, no new data
collection, no new auth surface.

## 13. Known limitations

- `translateVerses()`'s prompt was tightened after live testing revealed the model would
  occasionally split a verse range (e.g. "Philippians 4:6-7") into two separate entries. The fix
  (an explicit instruction plus reference-based matching that fails safe rather than trusting
  position) has been verified against that specific case, but has not been stress-tested against
  every possible reference format the main Declare response could ever produce.
- The Breakdown's `application` sentence and its "For your [struggle] today/tonight:" lead-in are
  composed client-side (the model is instructed not to write that lead-in itself) — if the model
  ever ignores that instruction, the lead-in could theoretically read awkwardly doubled. Not
  observed in testing, but not structurally impossible.

## 14. Rollback instructions

Revert commits `1c46e6f` through `c62f863` on `redesign/desktop-web-shell`, or simply do not merge
this branch — `main` has none of this work today.

## 15. Screenshots / preview routes

Reviewed live by Jeff on the Cloudflare Pages preview build of `redesign/desktop-web-shell` across
multiple rounds; this session also used Playwright to capture and directly read screenshots at each
verification pass (not retained as permanent artifacts — cleaned up after each round per the
project's own convention of not leaving test debris in the repo).

## 16. Gap analysis against the approved product direction (per Jeff's request for this task)

Checked the shipped Phase 2 work directly against `PRODUCT.md`'s Design Principles, `DESIGN.md`'s
brand rules, and the master build prompt's §8 Product Principles:

- **"Scripture is sacred, UI is invisible" / Sacred-Interface Rule** — holds. Verse text and
  Breakdown context still render in Cormorant Garamond; rail chrome (labels, pills, buttons) is DM
  Sans. No sans-serif crept into sacred content.
- **"Specificity over comfort"** — holds, and is arguably strengthened by this phase: the Breakdown's
  application line exists specifically to tie each verse back to the reader's exact struggle rather
  than stopping at generic commentary.
- **No em dashes** — enforced both in new UI copy and in the AI-facing prompt instructions for the
  new `breakdowns` field; spot-checked against real generated output during verification.
- **Reduced motion respected** — the one new animated element (the Breakdown accordion) has an
  explicit reduced-motion override; confirmed present in the stylesheet.
- **Crisis link never buried** — the left rail's crisis link is present at every state of the
  Results view; not conditionally hidden by any of this phase's changes.
- **Open gap, not a defect, needing Jeff's decision (resolved this session):** the chosen verse
  pacing (verses 2-3 gated behind "Continue reading," revealed one at a time) differs from the
  shipped mobile app's "tap to receive" collapse pattern. Jeff has since confirmed (2026-07-22) this
  divergence is intentional — desktop keeps its own pacing, mobile is not being changed to match.
  No further action needed; recorded here since it was a real, live product question during this
  phase, now closed.
- **Minor documentation gap, not a product gap:** `translateVerses()` is not yet mirrored in
  `declare-and-believe-system-prompt.md` the way the main pastoral prompt is. Low priority (it's a
  small utility function, not a change to the main pastoral voice), but worth a note next time that
  file is touched.
- **No gap found** against the master prompt's §8 principle "Get to the root, not only the symptom"
  — the Breakdown feature is a direct, purpose-built answer to that principle, not an incidental one.

Overall: this phase's shipped work does not appear to conflict with any documented product principle
or brand rule found in this audit. The one open product question it surfaced has already been
resolved directly by Jeff.
