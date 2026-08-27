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

### 3. A reachable way to choose, on every viewport

Fix D1. Put a visible control on the active-Journey card itself rather than repairing
the hidden mast, so it does not depend on a breakpoint. Restore the switch-confirm the
brief already specifies (§10.8: *Start a new journey?* / **Start the new journey** /
**Keep my current one**), and make its copy true once resume exists.

### 4. Let people see all 34

The chooser exists (`#chooseSheet`) and is zero-state only. Make it reachable always.
34 authored Journeys with no browsable front door is the single biggest piece of
unused value in the product, and it is now advertised on `/pricing`.

### 5. Gentle Guidance

Owner included this in scope. **Check before building:** the daily limit is already
enforced end to end (`src/app/declare/declare-api.js:20`, reserve before the model
call, release on failure) and `guidance-quota.js` fails open on anything but a stated
refusal. The open task may simply be stale. What is worth verifying is whether a
person can see what they have left **before** they hit the wall.

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

---

## Verification

```bash
npm run check:types
npm run build && ls dist/dev          # must NOT exist
for f in scripts/verify-*.ts; do node --experimental-strip-types "$f"; done
```

Baseline at the time of writing: 20 suites, 3,684 checks, all green.

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
