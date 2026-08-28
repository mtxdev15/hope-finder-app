# The courtroom-language sweep — what was found, what changed, what stays

*Work item 6 of the Journey rework (`docs/product/journey-rework-plan.md`). Read
through with the owner in five batches on 2026-08-27 and finished the same day.
**Everything here is applied.** The guard that keeps it applied is
`scripts/verify-courtroom-language.ts`.*

## The rule

No courtroom framing: no *verdict*, *courtroom*, *gavel*, *defendant*, *judge* as
a noun, or *sentence* in the punishment sense. Guilt as a **feeling** is fine. The
ban is on the frame, because somebody who arrives at 3am carrying shame should not
be handed a metaphor in which they are the accused, even one that ends in
acquittal.

It was written, and then violated 29 times, most of it in content read aloud
during the ritual, including three day and prayer titles.

---

## What the read-through was worth

The owner chose to read the drafts rather than approve a list. That decision
changed **six of them** and turned up **five hits this document had missed**.

**Drafts that changed once read in their whole page:**

- **Grace, "New Every Morning."** The entire day is a ledger: a balance always in
  the red, mercy you cannot overdraw, dragging yesterday's ledger into today,
  failure carrying over *with interest*. So *"sentence"* was the one word breaking
  the day's own metaphor, and the first draft (*"what today has to be"*) was bland
  **and** off-metaphor. → *"yesterday's failure is today's bill."*
- **Unforgiveness, "The Prison Door."** The whole day *is* the prison: the title,
  the fruit truth *"Forgiveness unlocks your own cell"*, *"I repent of being the
  jailer"*, the closing action opening the cell door, all of it Matthew 18. The
  first draft, *"something you are holding over the other person"*, deleted the
  lock and key the day runs on. → *"a lock you're turning on the other person."*
- **Shame, "A New Creation."** *"Pride signs the paper"* is the vivid beat and the
  first draft flattened it to *"Pride agrees."* Stone tablets keep the permanence
  and the signing-off, and set up the burial and raising two lines later. →
  *"The enemy loves to carve it in stone... Pride agrees with the carving."*
- **Overthinking, both lines.** The day names its own lie as *"a permanent setting
  you have to manage forever"*, so the teaching now answers it in the day's own
  words, and the declaration spoken aloud got warmth rather than accuracy alone. →
  *"not a permanent setting"* / *"not who I will always be."*
- **`overthinking.html`.** *"You get to question it"* was weak, because the
  sentence before already says *"hold it up against what God says."* →
  *"You test the thought"* — one word, and *test* is the biblical verb anyway
  (1 Thessalonians 5:21).

**Hits this document had missed, every one found by applying it rather than by
reading it:**

- The marketing pages carry each FAQ answer **twice**: once in JSON-LD for Google,
  once in visible markup. Every edit there is two replacements, and the structured
  data is user-facing too — it is what a rich result can show.
- `rejection.html` and `parental-abandonment.html` were not in the inventory at
  all, both carrying *"was never a verdict on..."* in prominent body copy.
- `overthinking.html` had a **third** instance, in visible copy rather than the FAQ.
- `unforgiveness.html` says *"the just judge"* **twice**.
- The guard suite, on its **first run**, found a 29th hit in `rejection.html`
  (*"two verdicts about the same person"*) that six passes by eye had not.

---

## `shame.html`, and a correction

The first version of this document called the Romans 8:1 devotional "built on the
metaphor" and said it needed a full rewrite with the owner. Reading it, that was
only half true. It does **two different things**, and only one breaks the rule.

**Exegesis — kept.** *"Condemnation is a courtroom word, a guilty sentence."* That
teaches what Paul's Greek meant in order to dismantle it. It does not cast the
reader as the accused.

**Application — rewritten.** The four lines after it did exactly that, even while
acquitting them:

| Was | Now |
|---|---|
| card title *"The verdict is already in"* | *"It is already settled"* |
| *"chapter 8 opens with a verdict"* | *"chapter 8 opens with an answer"* |
| *"Shame keeps reading you a guilty verdict. This verse says God has already ruled the other way."* | *"Shame keeps calling you guilty. This verse says God has already said otherwise."* |
| *"appealing a case that is already closed. In Christ, the verdict is in... You believe the Judge over the accuser."* | *"arguing something already settled. In Christ there is no condemnation... You believe God over the accuser."* |

---

## The four approved exceptions

For adding to the `declare-and-believe-marketing` skill. All four are encoded in
the guard, by exact phrase **and exact count**, so none can drift and none can
quietly grow to five.

1. **God as judge of the one who wronged you.** *"You are the just Judge"*
   (Bitterness Journey) and *"the just judge"* twice on `unforgiveness.html`.
   2 Timothy 4:8. The reader is not the accused here; the person who hurt them is,
   and that is the whole comfort of the prayer.
2. **"Sentence" meaning a length of time.** *"Drought is a season, not a
   sentence"*, both places. Paired against a time word, and no replacement matched
   the rhythm.
3. **Naming a legal term in order to dismantle it.** `shame.html`, above.
4. **Titles are held to a stricter standard than bodies.** The Bitterness prayer
   keeps *"just Judge"*, but its screen title changed anyway. A title is read at a
   glance, with no surrounding words to carry the distinction.

### Not exceptions — simply not violations

The guard knows each of these by name, so a future pass cannot "fix" them:

- ***sentence* as a unit of grammar.** *"Write one sentence"*, *"1 to 2
  sentences"*, and `failure.html`'s *"the fall is not the end of the sentence.
  Failure got a comma, not a period."*
- ***conviction* as firm belief.** Hebrews 11:1, quoted verbatim in three places.
  **Scripture is never rewritten.**
- ***judge* as a verb.** *"not waiting at the bottom to judge it."*
- **Internal `verdict` identifiers** in `convex/` and `src/app/declare/`. Never
  rendered, and the guard asserts they never reach any render sink.

---

## The guard

`scripts/verify-courtroom-language.ts` — 24 checks, 22 mutations, all caught.

It is not a grep and cannot be, because every banned word has an innocent sense
living in this content. It works from an allow list of exact approved phrases and
fails on anything outside it, which cuts both ways on purpose: a new violation
fails, and so does deleting an approved exception or rewriting half of one.

Its own first draft had three loose assertions, all found by mutation rather than
by review: `>= 1` passed while half a rewrite landed (several approved phrases
appear twice), and the render check looked only at `textContent` and `innerHTML`,
so writing the identifier into `document.title` walked straight past it. All three
are pinned by exact count, or by the full list of render sinks, now.

## Left alone on purpose

Em dashes. They are a separate locked violation at a much larger scale in the same
files, and folding them in would have turned a targeted change into a rewrite of
every paragraph in the content bank. Worth its own pass.
