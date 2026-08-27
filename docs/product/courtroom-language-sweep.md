# Courtroom language: the full inventory, with drafted rewrites

*Prepared 2026-08-27 as work item 6 of the Journey rework
(`docs/product/journey-rework-plan.md`). **Nothing here has been applied.** The
plan says these rewrites need the owner's voice, so this is the proposal, not
the change.*

## The rule, and what it does and does not cover

Locked brand rule: **no courtroom language.** Never *verdict*, *defendant*,
*judge* as a noun, or *sentence* in the punishment sense. Guilt as a feeling is
fine; the ban is on the framing, because a person who arrives at 3am carrying
shame should not be handed a metaphor in which they are the accused, even one
that ends in acquittal.

**Three things a search finds that are not violations, and must not be touched:**

- **"sentence" as a unit of grammar.** `journey-data.js:446` and `:869` both say
  *write one sentence*, and `journey-engine.js:613/616` tell the model to write
  *1 to 2 sentences*. Ordinary English.
- **"conviction" as firm belief.** Hebrews 11:1 is quoted verbatim at
  `journey-data.js:504/505/509` and `journey-engine.js:85`: *the conviction of
  things not seen*. **Scripture is never rewritten.** `:1120` uses it the same
  way: *spoken from conviction, not fear*.
- **Identifiers named `verdict`** in `convex/` and `src/app/declare/`. Internal
  names for a classification result, never rendered to anybody. They stay.

**A separate rule, not swept here.** `journey-data.js` is full of em dashes,
which is its own locked violation at a much larger scale. Folding that into this
pass would turn a targeted change into a rewrite of every paragraph in the file.
Where a drafted replacement below happens to rewrite a clause that held one, the
em dash goes with it; nothing else is touched.

---

## Journey content, read aloud during the ritual (24 rewrites)

### The two that carry the metaphor in their titles

| # | Where | Now | Drafted |
|---|---|---|---|
| 1 | `journey-data.js:861` day title | **Not Your Verdict** | **Not Your Name** |
| 2 | `journey-data.js:1202` prayer title | **Out of the Courtroom** | **Out of That Room** |
| 3 | `journey-data.js:459` prayer title | **You Are the Judge** | **You Settle It** |

Day 861's own `fruitTruth` already reads *"A failure is an event, not your
name"*, so **Not Your Name** is the line the day was already making.

### Shame (`journey-data.js:64, 67, 100`)

**:64 insight.** *"Together they hand you one verdict, guilty, permanently. But
the Holy Spirit reads you a different verdict."*
→ *"Together they give you one name, and they tell you it is permanent. But the
Holy Spirit speaks a different name over you."*

**:67 repent.** *"I let the Holy Spirit lift the verdict I keep speaking over
myself."*
→ *"I let the Holy Spirit lift the name I keep speaking over myself."*

**:100 insight.** *"The enemy loves to hand out life-sentences: you will always
be this way... Pride signs the paper because changing means admitting you needed
saving."*
→ *"The enemy loves to make it sound permanent: you will always be this way,
this is simply your nature, do not bother hoping. Pride agrees, because changing
means admitting you needed saving."*

### Fear of God (`journey-data.js:188`)

*"Father, forgive me for seeing You as a harsh judge. I repent of fearing
punishment instead of walking in child-like freedom."*
→ *"Father, forgive me for seeing You as harsh and waiting to punish. I repent
of living afraid of You instead of walking in child-like freedom."*

### Grace (`journey-data.js:375`)

*"...yesterday's failure is today's sentence."*
→ *"...yesterday's failure is what today has to be."*

### Bitterness (`journey-data.js:458, 459, 461`)

**:458 insight.** *"You don't have to be the judge. Hand Him the gavel and put
the ledger down."*
→ *"You do not have to be the one who settles it. Hand it back to Him and put
the ledger down."*

**:459 pray.** *"You are the just Judge, I lay the ledger down."*
→ *"You are the one who sets every wrong right. I lay the ledger down."*

*This is the one worth a second look. "God is the just Judge" is straight out of
2 Timothy 4:8, and the rule bans the noun. The draft keeps the theology and
loses the word. If you would rather keep the biblical phrase here, that is a
reasonable exception and I would rather you make it than me.*

**:461 repent.** *"I repent of appointing myself judge."*
→ *"I repent of appointing myself the one who settles it."*

### Marriage (`journey-data.js:534`) and family (`:1239`)

Both open with the same sentence, one about a spouse and one about relatives:

*"...builds a courtroom in your head, a case against them, evidence stacked, a
verdict already reached."*
→ *"...builds a case in your head: everything they did, stacked up, already
decided."*

### Unforgiveness (`journey-data.js:608`)

*"Unforgiveness feels like a sentence you're handing the other person, but
you're the one locked in the cell with them..."*
→ *"Unforgiveness feels like something you are holding over the other person,
but you are the one locked in the cell with them..."*

*The prison imagery that follows is Jesus' own (Matthew 18) and stays.*

### Divorce (`journey-data.js:731, 734`)

**:731 insight.** *"The lie takes one person's leaving and turns it into a
verdict about your whole future."*
→ *"The lie takes one person's leaving and turns it into the whole truth about
your future."*

**:734 repent.** *"I repent of letting their leaving become a verdict over my
future."*
→ *"I repent of letting their leaving speak over my whole future."*

### Failure (`journey-data.js:863, 866`)

**:863 insight.** *"But God reads a different verdict over you."*
→ *"But God speaks a different word over you."*

**:866 repent.** *"I turn from the verdict I keep speaking over myself."*
→ *"I turn from the name I keep speaking over myself."*

### Worth (`journey-data.js:993`)

*"And then His verdict: you are of more value than many sparrows..."*
→ *"And then His word over you: you are of more value than many sparrows..."*

### Self-sabotage (`journey-data.js:1201, 1202`)

**:1201 insight.** *"He isn't standing over you with a verdict; He's inviting you
out of the courtroom entirely."*
→ *"He is not standing over you keeping score. He is calling you out of that
room entirely."*

**:1202 pray.** *"Lead me out of the courtroom into grace."*
→ *"Lead me out of that room into grace."*

### Overthinking (`journey-data.js:1313, 1317`)

**:1313 insight.** *"Your overthinking mind is not a life sentence."*
→ *"Your overthinking mind is not permanent."*

**:1317 declare.** *"My overthinking is not a life sentence, God is rewiring the
old grooves with His truth."*
→ *"My overthinking is not permanent. God is rewiring the old grooves with His
truth."*

### Spiritual dryness (`journey-data.js:1492, 1496`)

**:1492 insight.** *"Drought is a season, not a sentence."*
→ *"Drought is a season. It is not the rest of your life."*

**:1496 declare.** *"My drought is a season, not a sentence."*
→ *"My drought is a season. It is not the rest of my life."*

*This is the one place where the original is genuinely better as a phrase. "A
season, not a sentence" has a rhythm the replacement does not. If the rule can
bend anywhere, it is here, and again that is your call.*

### The generated-day fallback (`journey-engine.js:381`)

*"Adopted, not on trial, you cry 'Abba, Father'"*
→ *"Adopted, not proving yourself. You cry 'Abba, Father'"*

---

## Marketing pages (4 places, one of them a real rewrite)

| Where | Now | Drafted |
|---|---|---|
| `public/failure.html:641` | *"Failure in God's eyes is not a verdict on who you are."* | *"Failure in God's eyes is not the truth about who you are."* |
| `public/failure.html:739` | *"trade that inner verdict for what He says about you"* | *"trade that inner voice for what He says about you"* |
| `public/overthinking.html:696` | *"You get to put the thought on trial."* | *"You get to question it."* |

### `public/shame.html:677` needs you, not a find and replace

The Romans 8:1 devotional there is **built on the metaphor**, not decorated with
it. Five phrases in one passage: *"The verdict is already in"* as its title,
*"chapter 8 opens with a verdict"*, *"Shame keeps reading you a guilty verdict"*,
*"God has already ruled the other way"*, and *"appealing a case that is already
closed. In Christ, the verdict is in."*

Swapping words there would leave a paragraph whose shape still argues in a
courtroom. It wants rewriting around a different image, and Romans 8:1 offers an
obvious one: *no condemnation* as a father's welcome rather than a ruling. That
is a paragraph in your voice, and I would rather draft it with you than post it
under your name.

---

## After it is applied

An executable guard goes in with the change: a suite that reads every
user-facing string in `journey-data.js`, `journey-engine.js` and `public/*.html`
and fails on courtroom framing, with the three false-positive classes above
listed by name so a future pass cannot "fix" Hebrews 11:1. Without it this file
is a one-time cleanup that drifts back the next time somebody writes a day.
