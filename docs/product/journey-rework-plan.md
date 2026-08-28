# Journey rework — the plan, written to be picked up cold

*Written 2026-08-27, approved by the owner the same day. Committed into the repo so a
fresh terminal session (`git pull && claude`) picks it up with no prior context.*

## Context

The owner used `/journey` on the live site and reported: *"there is no button or
anywhere how to choose a new struggle within journey or choose a journey. Nowhere
shows which journeys I'm doing, in the middle of, and what I dropped off. We
cannot ship this like this."*

An audit confirmed it, and found worse. **Billing launch is now explicitly parked
behind this work, by the owner's decision on 2026-08-27.** `PRICING_ENABLED` stays
`false` until the Journey experience is right. The billing code itself is finished;
its remaining steps are preserved at the bottom of this file and in `TODO.md` →
*Next up*.

Two decisions the owner already made, so do not re-litigate them:

1. **Scope: the full rework first**, including the missing screens and the Gentle
   Guidance work, before any billing launch.
2. **Resume behaviour: a Journey resumes where it was left.** Somebody who drops on
   Day 3 and comes back lands on Day 3, not Day 1.

---

## What is actually broken

Three defects, then the gap underneath them.

### D1. On desktop there is no way to switch Journeys at all

The `⋯` overflow control is injected into `.mast` (`src/pages/journey.astro:508`).
`public/declare/sidebar.css:32` sets `.app-shell .mast { display:none }` at
`min-width:768px`. The listener attaches, the sheets exist, nothing paints. On
mobile the same control is five taps deep behind an unlabeled three-dot glyph:
`⋯` → `#menuSheet` → *Choose a different struggle* → `#resetSheet` → *Choose a new
struggle* → `#chooseSheet` → Preview → *Begin Day 1*.

Also dead: `plantAndBegin()` (`journey.astro:2470`, its own comment says so) and the
`@media (min-width:481px){ .mast .mright { pointer-events:auto } }` rule at `:3075`,
left over from the retired top bar.

### D2. "Continue this one" restarts the Journey at Day 1

In the cap-refusal sheet, the Continue button (`journey.astro:2711`) routes through
`beginNewJourneyFlow` → `beginJourney`, which runs `clearLock()` and
`clearInstance()` on that id and sets `state.day = 1`. **The button labelled
Continue destroys the progress it offers to continue.** This is in the screen the
launch gate was about to put in front of people.

### D3. The reset sheet promises something the code then destroys

`#resetSheet` (`journey.astro:348`) says *"your progress is kept, and you can return
to it whenever you're ready."* There is no return path anywhere in the app. If the
user takes it at its word and picks that struggle again, `beginJourney` deletes the
preserved state and restarts at Day 1.

### The gap underneath: the app knows and never says

- **`journeySlots`** (Convex) holds a row per user per Journey with
  `status` (`active`/`completed`/`archived`), `startedAt`, `endedAt`.
  `myOpenJourneys` (`convex/journeySlots.ts:279`) returns them sorted oldest-first.
  It has **one caller in the whole codebase**: the refusal sheet. The only honest
  inventory the system owns is shown once, as a wall, never as a map.
- **`db_journey_lock`** is structurally a per-struggle progress ledger,
  `{id → {day, returned, date, time}}`, retaining a row for every struggle ever
  started on that device. Only `[active.id]` is ever read. The device knows the user
  reached Day 3 of Shame before switching. Nothing tells them.
- **`db_journey_inst:<id>`** keeps each abandoned Journey's whole plan, reflections
  and per-step state. Read cross-journey exactly once, for one decorative line.
- **There is no "set aside" state in the client at all.** `beginJourney` demotes the
  old Journey to `'open'`, the same value a never-started Journey has, and `init()`
  recomputes statuses from `db_journeys_done` on every load, so the distinction is
  not even durable in memory.
- **"Past Journeys"** (`renderGrid`, `journey.astro:1091`) lists completions only,
  is not clickable beyond a toast, and is `display:none` in the zero state, which is
  exactly when somebody is deciding what to do next.

**34 authored Journeys exist** in `public/declare/journey-data.js`. The only path
into any of them is: `/today` → name a struggle → receive a Word → scroll past
Share → *Start a 5-Day Journey*. The struggle picks the Journey; the user never
chooses. The full chooser (`#zsSeeAll` → `#chooseSheet`) is zero-state only.

---

## Design direction

The owner asked for an "ahh ha moment, a spiritual moment, an uplifting moment."

**The centrepiece already exists and is already specified.**
`design-source-v3.2/briefs/declare-journey-section-brief_updated_journey_v2.md` §5
describes the Vine: a constant central vine (*Jesus, the Vine*, John 15:5); one muted
branch carrying the lie that **dims and recedes** as days complete, the Vinedresser
pruning what bears no fruit; one branch of truth that **thickens and brightens**; and
one named gold fruit per completed day. No percentage meters. Progress is the growing
branch, plus two quiet readouts: *Day 3 of 5* and *You've returned 4 days.
Faithfulness is the win.*

It is partly built and it works. **The problem is that it is trapped on one screen,
for one Journey.** The rework should carry that visual language outward rather than
invent a new one.

**Card language: organic, not rectangular.** Each Journey on the new screen should
read as its own small living thing carrying its own state — a soft organic shape
holding its own day count, warm and overlapping — not a row in a table. That is much
closer to a vine bearing fruit than a card grid is.

Follow the brief's existing atmosphere rules (§4) and the brand tokens (§3).
Animate `transform` and `opacity` only, with a reduced-motion fade.

---

## Modernizing the experience — what the research found

*Added 2026-08-27, after the owner asked to "research the best way we can modernize
this experience, better than what's out there... an ahh ha moment, a spiritual
moment, an uplifting moment."*

### The finding, stated plainly

**The aha moment was already designed, already paid for, and was built at about
sixty percent.** The gap between `/journey` today and something nobody else in the
category has is not imagination. It is finish.

The competitive scan is short because it points the same way. Glorify is the
best-designed app in the Christian devotional category, and its own stated
differentiator is *no streak shame, no badge counter* — which is already this
brief's §5 position (*"No percentage meter... You've returned 4 days. Faithfulness
is the win"*). Open, the reference the brief names for atmosphere, sells on
design-forward calm and one signature interaction, the breath ring. **Neither has
anything like the Vine.** A growing, pruning, fruiting picture of John 15 that is
*yours* and changes as you abide is not something a competitor can copy, because it
is theology rather than a widget.

So the work is not to out-design Open. It is to ship the thing already specified
that Open cannot have.

### Four gaps between the brief and the build

**1. The Vine is a photo crossfade, not a vine.** `public/declare/the-vine.js` is 167
lines that cross-fade three JPGs (`tree-dead.jpg` → `tree-budding.jpg` →
`tree-alive.jpg`) and position glowing gold dots over the result. Brief §5 specified
something structurally different: **one constant central vine** (Jesus, John 15:5),
**one muted branch carrying the lie that dims and recedes** as days complete, and
**one branch of truth that thickens and brightens**. The current build cannot dim a
lie-branch because there is no lie-branch; the entire picture swaps. The named,
tappable fruit *is* built and works.

This is the largest gap between "a nice wellness app" and the thing only this app
has, and the most expensive item here: it needs an illustrator or a generative SVG,
not a code change.

**2. The ritual ends on a chore instead of a blessing.** Brief §6 specifies nine
movements ending **Reflect → Pray (seal) → Action (optional)**. The build has seven,
and **Pray was moved to position two**: Receive → Pray → Cast off → Repent → Declare
→ Reflect → *Take it into your day*. The day now finishes on homework. The last beat
is the one a person carries. Missing entirely: **Arrive** (one breath before
anything, §6.1) and **Confess** (name the lie in your own words, §6.3).

Cheapest fix on this list, largest felt effect: reorder, and add one breath screen at
the top.

**3. `/journey` is the least atmospheric page in the app.** `public/declare/
atmosphere.js` and `public/declare/smoothscroll.js` (vendored Lenis) both exist,
respect reduced motion, and ship on the marketing pages. **Neither loads on
`/journey`** — confirmed by reading the script tags. The cinematic field brief §4
asked for is on the pages that *sell* the ritual and not on the ritual itself. Two
script tags.

**4. The self-check does not exist.** Brief §9: after Pray, *Does this feel true
yet?* with **Not yet · Getting there · Yes**, and completion defined by the truth
landing rather than the calendar ending. Nothing in the codebase implements it
(`public/declare/rate.js` is the unrelated app-rating prompt). This is what turns a
five-day content drip into a Journey that answers you, and it is the honest basis
for offering an extra day as invitation rather than as an upsell.

### Beyond the brief: three ideas worth having

- **Make the Vine the object that travels.** It appears on exactly one screen. The
  same vine, at each Journey's own stage, belongs on the My Journeys cards, in the
  chooser preview, and cut into the share card at Journey complete. That is what
  turns it from a progress graphic into the app's continuity object, the thing a
  person recognises as theirs.
- **The Fruit Log is the collectible that is not a collectible.** It exists and holds
  real authored fruit names and truths. Make it revisitable, and cut the share card
  from it. A record of grace, never a trophy case.
- **The 34 as a garden.** The chooser now lists all 34 with their state; the natural
  next step is arrangement rather than a list. What has rooted, what is growing, what
  is still seed.

### If only three things get done

1. **Reorder the ritual so the day ends on the prayer**, and add the Arrive breath.
2. **Load `atmosphere.js` and `smoothscroll.js` on `/journey`.**
3. **Build the real Vine.** Expensive, needs a designer, and it is the actual answer
   to the question that was asked.

The self-check and the three "beyond" ideas wait behind those. **None of this blocks
billing**, and none of it should start before the courtroom pass and the manual walk,
or this becomes another drift.

---

## The work

### 1. Make a Journey resumable by id  ← everything else depends on this

`beginJourney(id, …)` (`journey.astro:2454`) currently always clears and restarts.
Split it: **starting** a Journey clears; **resuming** one restores. The state is
already on the device in `db_journey_lock[id]` and `db_journey_inst:<id>`, and
`restoreInstance()` / `restoreProgress()` already know how to read it. They are just
only ever called for `loadActiveSaved().id`.

Doing this first makes D2 and D3 disappear rather than needing separate fixes, and it
is what makes the new screen worth building.

**DONE 2026-08-27.** The rules live in `src/app/declare/journey-resume.js` —
dependency-free and pure, so `scripts/verify-journey-resume.ts` runs them rather
than reads them (72 checks; each was broken once before being trusted).
`journey.astro` gained `resumeJourney()` / `enterResumed()` / `parkActive()`, and
both lying surfaces now tell the truth: the limit sheet's *Continue this one*
resumes, and picking a set-aside struggle again returns to it instead of wiping
it. Starting still clears, which the suite pins separately.

Walking it in a browser found **a third defect nobody had reported**:
`jpBegin`'s handler disables the Preview's commit button and only the
cap-refusal branch ever re-enabled it, so the *second* Preview of a page session
opened with **Begin Day 1 already dead**. Start one Journey, switch to another
without reloading, and there was no way to commit the second. Fixed in
`showJourneyPreview`, which now releases both halves of that guard.

### 2. The "My Journeys" screen

The missing front door. One surface listing three things the system already knows:

| Group | Source | Shows |
|---|---|---|
| In progress | `myOpenJourneys` + `db_journey_lock[id].day` | name as `From → To`, day reached, resume |
| Set aside | `journeySlots.status === 'archived'` | name, when, resume or let go |
| Rooted | `db_journeys_done` | name, its fruit, read-only |

Reachable from the Journey home in every state and from the nav. Not hidden in the
zero state, which is the one moment it matters most.

**DONE 2026-08-27.** "Past journeys" is now My Journeys, with the grouping in
`src/app/declare/journey-inventory.js` (pure, executed by
`scripts/verify-journey-inventory.ts`). It works signed out, because the 3am user
usually is: the device records are primary and the server's open slots only ADD to
them, so a Journey begun on a phone is reachable on a laptop that has never held its
records, and a null from the server means "no answer" rather than "none". Each row is
an organic card carrying its own day ring, five fifths with the completed ones in
gold, the unit the Vine already uses for its fruit.

### 3. A reachable way to choose, on every viewport

Fix D1. Put a visible control on the active-Journey card itself rather than repairing
the hidden mast, so it does not depend on a breakpoint. Restore the switch-confirm the
brief already specifies (§10.8: *Start a new journey?* / **Start the new journey** /
**Keep my current one**), and make its copy true once resume exists.

**DONE 2026-08-27.** A labelled control on the card, plus the same door at the foot of
My Journeys, both through one funnel that only confirms when there is something to set
aside. One tap to the confirm, two to the chooser, down from five. The confirm's copy
now names where the Journey waits, which finishes D3. The mast control stays for
phones and is simply no longer the only route. `scripts/browser/journey-switch-reach.mjs`
asserts all of it at 390px **and** 1280px, and asserts the mast control is still hidden
on desktop so the reason it may never be the only one stays written down. Dead code
removed with it: `plantAndBegin()`, its `.plant-seed`/`.plant-bloom` styles, and the
`.mast .mright` pointer-events rule left over from the retired top bar.

### 4. Let people see all 34

The chooser exists (`#chooseSheet`) and is zero-state only. Make it reachable always.
34 authored Journeys with no browsable front door is the single biggest piece of
unused value in the product, and it is now advertised on `/pricing`.

**DONE 2026-08-27.** It filtered to `status === 'open'`, which quietly means "the ones
you have never touched": the Journey being walked was missing, every finished one was
missing, and the more of the app somebody used the less of it they saw. All 34 are
listed now, with a count drawn from the catalog, and each row says what tapping it will
do (**Walking now** goes to it, **Day 4** resumes there, **Rooted** begins fresh) from
the same inventory My Journeys is built from.

### 5. Gentle Guidance

Owner included this in scope. **Check before building:** the daily limit is already
enforced end to end (`src/app/declare/declare-api.js:20`, reserve before the model
call, release on failure) and `guidance-quota.js` fails open on anything but a stated
refusal. The open task may simply be stale. What is worth verifying is whether a
person can see what they have left **before** they hit the wall.

**CHECKED, AND THE TASK WAS STALE. DONE 2026-08-27.** The limit is wired and has been
since 2026-08-26. What was missing is the half nobody wrote down: `convex/usage.ts` has
always returned `remaining` on a granted reservation and `interpretReserve` threw it
away one line later, so the **only** moment the app ever mentioned the limit was the
moment it refused somebody. The count now reaches the card that spends the next one
("2 left today"), shows **nothing** when there is no number (Plus, a guest, an
unreachable backend), and is reported at the finalize rather than the reservation,
because a failed request gives its hold back.

### 6. Courtroom language sweep

A locked brand rule, violated in authored content that is read aloud during the
ritual. **16 hits in `public/declare/journey-data.js`**, including two day titles
(*"Not Your Verdict"*, *"You Are the Judge"*) and *"Hand Him the gavel"*. One in
`public/declare/journey-engine.js:381`. Nine on marketing pages, worst at
`public/shame.html:677` (*"guilty sentence"*, *"guilty verdict"*, *"the Judge"*).

Rewrites need the owner's voice; do not paraphrase them alone. *Guilt as a feeling is
fine. The ban is on courtroom framing.*

Identifiers named `verdict` in `convex/` and `src/app/declare/` are internal and not
user-visible. Leave them.

**DONE 2026-08-27.** Read through with the owner in five batches and finished the
same day. The full record is at
[`docs/product/courtroom-language-sweep.md`](courtroom-language-sweep.md): 29 hits,
four approved exceptions, and a guard (`scripts/verify-courtroom-language.ts`,
24 checks, 22 mutations caught) that keeps it swept.

**Reading the drafts rather than approving a list changed six of them and turned up
five hits the inventory had missed** — including one the guard found on its first
run that six passes by eye had not. That is the finding worth carrying into the next
copy pass: an inventory built by grep undercounts, and a rewrite judged out of
context reads worse than the line it replaces. The grace day is a ledger and
"sentence" was breaking its own metaphor; the unforgiveness day is a prison and the
first draft deleted its lock and key.

---

## Verification

```bash
npm run check:types
npm run build && ls dist/dev          # must NOT exist
for f in scripts/verify-*.ts; do node --experimental-strip-types "$f"; done
```

Baseline when this plan was written: 20 suites, 3,684 checks.
**After the rework: 23 suites, 3,882 checks, all green**, plus two browser walks
(`scripts/browser/journey-resume-walk.mjs`, 18 checks; `journey-switch-reach.mjs`,
21 checks at two viewports). 71 deliberate breaks across the new assertions, all
71 caught; five were too loose on the first pass and were tightened until the
mutation failed them.

**Add executable assertions for the new behaviour, and break each one before trusting
it.** That is the house standard and it has caught two real bugs. Specifically worth
pinning:

- resuming a Journey by id restores its day rather than resetting to 1
- the switch-confirm copy matches what the code actually does
- the My Journeys screen renders in-progress, set-aside and rooted from real rows
- no user-facing string in `journey-data.js` or `public/*.html` contains courtroom
  framing

### The browser walk

Check 1 below turned out not to need a person after all, so it no longer gets one:

```bash
npm run dev                                   # leave running in another terminal
node scripts/browser/journey-resume-walk.mjs
```

It drives a real Chromium at 390px through a real day of the ritual, all seven
steps, sets the Journey aside for another, comes back, and asserts the day it
lands on. It is deliberately **not** a `verify-*.ts` suite: those run with no
server and no network, and the whole set runs in one loop. This one needs a
browser, because the two defects it caught can only be seen in one. Run it after
any change to the Journey entry paths.

**What still only a person can confirm**, signed in, on a phone and on a desktop,
because this whole plan exists because it was never done:

1. ~~Start a Journey, reach Day 2, switch to another, come back. Are you on Day 2?~~
   **Automated, and passing.** `scripts/browser/journey-resume-walk.mjs`, 18 checks.
2. With one active, can you find the way to choose another? On desktop *and* mobile.
3. Can you see all 34?
4. Does My Journeys show what you started, what you dropped and what you finished?
5. Only then: the Journey cap walk in `TODO.md`, which is what billing waits on.

---

## Parked: the billing launch

Finished, tested, unlaunched, and deliberately behind this work.

Remaining steps: walk the Journey cap (blocked on this plan), confirm
`EXTRA_TRUSTED_ORIGIN` is absent from production, merge the pricing-CTA branch
rewriting its nine assertions, flip `PRICING_ENABLED`, then buy it with a real card.
Full detail in `TODO.md` → *Next up*.

Known and accepted: the webhook API version is pinned two versions ahead of the code
and Stripe will not let it change; lifetime revocation has never run in production;
`RESEND_API_KEY` needs rotating; GTM → GA4 mapping is deferred.

## Parked: email marketing

The capture form on the marketing pages throws the address away
(`public/welcome.html:904` reads it, redirects to `/signin?email=`, and `signin.astro`
never reads the param). That is why Resend holds three segments and zero contacts.
One to two days to fix, and it is the first thing to do after launch. Decisions
already taken: Heart Check is the lead magnet, the $17 bootcamp is email-delivered and
stays a separate product, the nurture runs five emails over fourteen days.
