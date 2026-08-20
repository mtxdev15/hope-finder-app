# Release B — Journey Redesign Implementation Prompt

Use this prompt with Claude Code from the root of the `redesign/journey-experience` branch.

## Critical instruction

The Journey audit is approved.

Do not rebuild the Journey engine. Do not replace the existing product with a generic course, wellness app, white dashboard, purple UI, or mobile-only flow.

The redesign must preserve the actual Declare & Believe product:

- dark forest sanctuary atmosphere
- warm gold sacred accents
- ivory Scripture typography
- Cormorant Garamond for sacred content
- DM Sans for interface content
- existing adaptive shell from Release A
- existing seven-step Journey
- existing Vine imagery and fruit language
- existing Day 1 anonymous access
- existing Day 2+ sign-in gate
- existing care gate for sensitive struggles
- existing fallback content
- existing date-based day unlocking
- existing Save to Vault and active-Journey conflict handling
- existing reduced-motion behavior

The design should feel contemplative, editorial, cinematic, and unmistakably Declare & Believe.

## Reference hierarchy

Read these files before editing:

1. `CLAUDE.md`
2. `PRODUCT.md`
3. `DESIGN.md`
4. `declare-and-believe-system-prompt.md`
5. `docs/audits/current-product-audit.md`
6. `docs/architecture/current-route-map.md`
7. `docs/architecture/current-data-map.md`
8. `docs/architecture/current-ai-map.md`
9. `docs/verification/current-branch-verification-report.md`
10. the completed Release B Journey audit supplied in this session
11. `src/pages/journey.astro`
12. `public/declare/journey-engine.js`
13. `public/declare/journey-data.js`
14. `public/declare/the-vine.js`
15. `public/declare/breath-ring.js`
16. `public/declare/journey-merge.js`
17. all Journey-related CSS, scripts, Convex functions, Vault utilities, and auth helpers
18. `convex/_generated/ai/guidelines.md`

The existing production code is authoritative when older documentation conflicts with it.

## Visual-reference rule

Do not use any purple, white, cream-dashboard, wellness-app, or generic mobile-course mockup as the visual source of truth.

If a design-board image is attached, use it only to understand screen sequence and content hierarchy. Do not copy its colors, navigation, typography, statistics, copy, icons, or device framing.

The real visual source of truth is:

1. the production dark app after Release A
2. the user's current Journey screenshots
3. the forest-and-gold brand system
4. the requirements in this prompt

## Production protection

Do not:

- work on `main`
- commit automatically
- push
- merge
- deploy
- create a pull request
- install or upgrade packages
- modify Cloudflare Workers
- modify Convex schema or production functions
- modify auth
- modify Resend
- modify domains, DNS, routes, or deployment configuration
- modify the instant Declare prompt
- modify `src/app/declare/declare-api.js`
- modify the Sonnet Journey prompt in `public/declare/journey-engine.js`
- alter the Sonnet response shape
- alter the PLAN field contract
- alter the existing day-lock calendar logic
- alter sign-in gating
- alter the care-gate trigger list
- alter Vault storage shape
- alter the `TheVine.build(...)->{ setProgress }` public contract
- remove fallback content
- rename or remove DOM IDs without proving every binding is updated

Before each milestone:

1. list every file to change
2. explain why
3. identify protected files
4. explain the test plan
5. explain rollback
6. wait for approval

## Product intent

The Journey is not a course and not a checklist.

It is a five-day personalized liturgy for renewing the mind through Scripture.

The user begins with a burden and walks through:

1. Receive
2. Pray
3. Cast Off the Lie
4. Repent and Breathe
5. Declare the Truth Aloud
6. Reflect
7. Take It Into Your Day

The Journey should answer:

- What am I carrying?
- What lie may be beneath it?
- What does Scripture reveal?
- What truth am I choosing?
- What is God cultivating as I abide in Christ?
- Who am I becoming?

Do not gamify this with XP, streak pressure, levels, badges, confetti, or percentages of spiritual growth.

Use language such as:

- Who are you becoming?
- Fruit God is growing
- Roots grow before fruit appears
- Faithfulness is the win
- A new branch has begun to grow
- Remember what God has done
- This may be fruit beginning to grow

Never claim divine certainty or score spiritual maturity.

## Approved Release B scope

Implement B1 through B6 as small, reviewable milestones.

Do not implement B7 AI personalization or Root-Pattern Insight in this release.

B7 requires a separate prompt, separate review, and explicit approval because it changes data flow and the Journey prompt.

---

# B1 — Journey Overview Redesign

## Goal

Make `/journey` immediately answer:

> Who are you becoming?

The page should show where the user is, what today requires, and what fruit has already appeared, without becoming a dashboard.

## Preserve

- current zero-state
- current active Journey state
- current past-Journey state
- existing active-Journey conflict behavior
- existing `db_active_journey`
- existing `db_journeys_done`
- existing per-day fruit data
- existing full-screen Vine viewer
- existing lock note
- existing return-day language where it still fits
- Release A app shell

## Desktop composition

Use the Release A left sidebar.

Main content should be a focused reading column, not a wide analytics grid.

Recommended hierarchy:

1. eyebrow: `YOUR JOURNEY`
2. H1: `Who are you becoming?`
3. short supporting copy
4. Active Journey card
5. Fruit God Is Growing
6. Past Journeys
7. crisis-help access

## Active Journey card

Show:

- current transformation, e.g. `Fear & Anxiety → Peace`
- sentence: `Where anxiety has gripped you, God is giving His peace.`
- `Day 2 of 5`
- current day title, e.g. `Unclenched Trust`
- key verse and reference
- today's fruit and fruitTruth
- primary CTA: `Continue Day 2`
- secondary CTA: `View Vine`

The Vine or branch illustration may occupy part of the card, but must not make text hard to read.

Do not invent app-wide statistics.

If counts are shown, they must be directly derivable from the current Journey and labeled clearly as current-Journey counts.

## Fruit section

Use qualitative, non-competitive language.

Example:

- Peace
  - His peace guards your heart.
- Trust
  - Learning to lean on His strength.
- Hope
  - Confident expectation in His promises.

Do not show percentages or scores.

## Past Journeys

Show each completed transformation as a remembrance item, not as a course certificate.

Include:

- from → to
- completion date
- rooted/completed status
- `View Story` only when the new story screen exists
- otherwise preserve the current valid action

## Responsive behavior

- Desktop: focused central composition with sidebar
- Tablet: single main column, no cramped multi-column analytics
- Mobile: active Journey first, CTA reachable with one hand, Vine preview below core text
- No horizontal scrolling
- Touch targets at least 44px
- Preserve dark mode and reduced motion

---

# B2 — Journey Start and Day Opening

## Goal

Create a meaningful transition after `Start My 5-Day Journey`.

This should not be a long cinematic intro. It should orient the user and let them begin quickly.

## Sequence

1. Existing care gate, when required
2. Existing seed/plant transition, if applicable
3. New Journey preview
4. Begin Day 1
5. Day-opening screen
6. Seven-step experience

## New Journey preview

Use the actual generated `active._themes`.

Do not hardcode day titles.

Show:

- `From Fear & Anxiety to Peace`
- a concise explanation of what the five days will do
- five real day titles from the active arc
- Day 1 highlighted
- Days 2–5 visible but not interactively open
- primary CTA: `Begin Day 1`
- secondary CTA: `Back to Results`

The preview should be skippable on repeat visits to an already-started Journey.

## Day-opening screen

Each day begins with a quiet full-screen or focused overlay.

Show:

- `DAY 2 OF 5`
- day title
- transformation direction
- today's focus
- key verse reference and excerpt
- primary CTA: `Begin Day 2`
- optional `Not now` or `Return to Journey`

Use the current dark forest and gold system.

Do not use mountain-wellness photography or purple gradients.

If imagery is used, it should match the existing Vine and forest visual language.

## Accessibility

- care-gate crisis link remains first when applicable
- no focus trap before the day begins
- screen-reader heading order is correct
- reduced motion uses an immediate reveal
- day-title nodes are descriptive, not fake buttons
- crisis help remains reachable from the day-opening screen

---

# B3 — Seven-Step Guided Daily Experience

## Goal

Make the existing seven-step day feel like one guided spiritual practice rather than a long stack of cards.

## Preserve exactly

- all seven steps
- step order
- PLAN field names
- existing three required completion gates:
  - Cast Off
  - Repent and Breathe
  - Declare
- breath-ring mount and callback contract
- skip-breathing option
- in-day state restoration
- the fact that spoken declarations are not recorded
- current authored, fallback, and AI content
- no prompt changes

## Desktop

Use a focused ritual layout:

- top progress rail with seven steps
- left or top context:
  - Day N of 5
  - day title
  - from → to
- central step content
- optional right-side quiet context only if it helps, never a dashboard rail
- global app shell may remain visible, but the ritual must keep focus

Do not render all seven steps as equally loud cards at once.

Use progressive focus:

- current step is primary
- completed steps are subdued and reviewable
- upcoming steps are visible in the progress rail
- user may move forward only according to existing product rules
- returning mid-day restores the exact current state

## Mobile

Use one step at a time.

Each step should have:

- step number and name
- sacred heading
- brief supporting instruction
- core content
- one primary action
- back/review behavior where safe
- persistent indication of progress

Avoid a horizontally compressed seven-label rail. Use abbreviated accessible labels or a compact progress indicator with an expanded step name.

## Step requirements

### 1. Receive

Show:

- Scripture
- reference
- insight
- optional `Does this resonate?` interaction only if it does not change storage or prompt behavior
- primary action: `Continue to Pray`

### 2. Pray

Show:

- prayer title
- prayer
- primary action: `I Prayed This` or `Continue`

Do not require a false claim that the user prayed aloud.

### 3. Cast Off the Lie

Show:

- the lie
- the truth replacing it
- required confirmation action
- language must preserve the existing authored content

### 4. Repent and Breathe

Show:

- repentance prayer
- breath-ring experience
- skip option
- required completion behavior remains unchanged

### 5. Declare the Truth Aloud

Show:

- declaration
- clear speak-aloud invitation
- required confirmation action
- no microphone or recording feature

### 6. Reflect

Persist the reflection text additively in the existing per-day instance state.

Requirements:

- reflection remains private
- label the behavior honestly
- save locally as the user types or on blur
- restore after refresh
- do not sync it to Convex in this milestone
- do not include it in AI prompts
- do not expose it in sharing
- provide an explicit note such as `Saved privately on this device`
- older journeys without the field must remain valid

### 7. Take It Into Your Day

Show:

- action title
- action
- optional completion acknowledgment
- this step should feel like leaving the app, not creating another task list

## Crisis access inside ritual

The audit found that the full-screen ritual hides the global crisis link.

Add a quiet, always-reachable crisis-help control inside the ritual overlay.

Requirements:

- visible on every viewport
- does not compete with Scripture
- keyboard accessible
- not hidden behind menus
- links to the existing `/crisis` page
- does not change the care-gate logic

## Accessibility

- one H1 per step screen
- correct stepper semantics
- visible focus states
- 44px touch targets
- no required drag gestures
- no essential motion
- no focus trap except a true modal
- leaving and returning restores progress
- full keyboard completion is possible

---

# B4 — Daily Completion and Return Tomorrow

## Goal

End each day with peace, clarity, and honest expectations.

## Preserve

- current day-completion logic
- Vine progress
- fruit and fruitTruth
- date-based lock
- test escape hatch
- anonymous sign-up invitation
- saved reminder preference
- no real notification delivery

## Completion content

Show:

- subtle Vine change
- `Day 2 held for today`
- fruit name
- fruitTruth
- concise affirmation
- `Day 3 opens tomorrow`
- primary CTA: `Done for Today`
- secondary: `Return to Journey`
- optional reminder-time preference

Do not show a live countdown unless the actual unlock logic and timezone behavior support it accurately.

## Reminder honesty

The current reminder control does not send a push notification or email.

Use honest copy:

- `Choose a reminder time`
- `We will remember this preference`
- `App notifications are coming soon`

Do not say:

- `We will notify you`
- `Reminder scheduled`
- `Push reminder set`

unless the real delivery infrastructure exists.

## Return-tomorrow state

When the next day is locked:

- show the next day title
- explain that it opens tomorrow
- allow review of completed days
- keep `Preview tomorrow` available only as a development/testing affordance, not a normal production CTA
- keep crisis help accessible

---

# B5 — Day 5 Completion and Transformation Story

## Goal

Help the user remember what they confronted, what truth they practiced, and what fruit may be beginning to grow.

## Completion headline

Use:

> A new branch has begun to grow.

Supporting copy should be humble and observational.

Do not say the user is permanently free or fully healed.

## Remembrance list

Build from real PLAN and per-day state.

Include only data that actually exists:

- Lie Confronted
- Truth Embraced
- Key Verse
- Final Declaration
- Reflection Saved, only when a real persisted reflection exists
- Fruit from each completed day

Do not fabricate missing reflections.

## View Your Story

Create a new in-page Journey story view or local route state without changing global routing.

Show:

1. where the Journey began
2. five day titles
3. key lie
4. key truth
5. Scripture references
6. declarations
7. saved reflections, if present
8. fruit labels
9. final Vine
10. actions:
   - Save to Vault
   - Share Declaration
   - Begin Another Journey
   - Return to Journey

Do not use artificial before/after claims generated from assumptions.

Use exact user-authored or existing Journey content.

## Save to Vault

Preserve the current storage function and shape.

Do not change Convex schema.

If the saved Journey contains five verses, verify the current reader and data comments tolerate that shape, and document the result.

## Rating prompt

Keep it quiet and after the spiritual completion content.

Do not interrupt the remembrance experience.

---

# B6 — Vine and Fruit Presentation

## Goal

Make growth visible without turning it into gamification.

## Preserve

- `TheVine.build(mount, cfg)`
- returned `{ setProgress }`
- all current call sites
- 0/5 through 5/5 progress mapping
- reduced-motion behavior
- current fruit labels and fruitTruth data

## First implementation

Do not replace the existing three photographic frames during the first UI milestone unless the current assets cannot support the approved layout.

First improve:

- crop
- framing
- responsive sizing
- legibility
- fruit anchors
- transitions
- light treatment
- empty and completed states

Only propose new generated assets after the existing implementation is reviewed in the redesigned layout.

## Fruit language

Fruit remains per-Journey for Release B.

Do not add app-wide aggregate counts.

Allowed:

- `1 fruit so far`
- named fruit from completed days
- fruitTruth
- per-Journey day count

Not allowed in Release B:

- app-wide declarations count
- app-wide prayer count
- breakthrough count
- promise count
- spiritual score
- growth percentage

## Motion

- organic and restrained
- no confetti
- no bouncing fruit
- no constant glowing animation
- reduced-motion shows the final state immediately

---

# Deferred from Release B

Do not implement:

- B7 AI personalization
- raw free-text handoff into Sonnet
- Root-Pattern Insight
- AI memory
- app-wide fruit counters
- real push reminders
- email reminders
- service worker
- new Convex tables
- new subscription gates
- app subdomain migration
- iOS implementation
- new Journey prompt
- new Sonnet response fields

Document these as future phases.

---

# File strategy

The audit found `src/pages/journey.astro` is large and ID-bound.

Do not perform a full rewrite.

Prefer:

- additive markup
- preserving existing IDs
- adding classes and wrappers
- extracting only clearly reusable, low-risk visual components
- keeping JS behavior stable
- creating a mapping document for IDs before moving markup
- changing one milestone at a time

If an ID must change:

1. list every reference
2. update all references in one approved change
3. test every affected state
4. document rollback

## Likely files

Potentially:

- `src/pages/journey.astro`
- Journey-specific CSS already used by that page
- `public/declare/the-vine.js`, visual-only and contract-preserving
- `public/declare/breath-ring.js`, visual-only and contract-preserving
- new static visual assets under the existing Journey asset convention
- documentation and verification reports

Do not touch engine, prompt, Convex, Worker, auth, or route files without separate approval.

---

# Milestone execution order

Implement in this order:

1. B1 Journey Overview
2. B2 Start and Day Opening
3. B3 Seven-Step Experience plus local reflection persistence and ritual crisis link
4. B4 Daily Completion and Locked Return State
5. B5 Day 5 Completion and View Your Story
6. B6 Vine presentation refinement
7. Final integrated verification

Do not combine all milestones into one edit.

Each milestone receives its own approval, implementation, verification, and report section.

---

# Required verification per milestone

Use existing tools and dependencies only.

Run:

- `git status --short`
- `git diff --stat`
- existing formatter, if available
- existing lint, if available
- existing type check, if available
- `npm run build`
- route checks
- Playwright/browser verification at:
  - 1440 × 1000
  - 768 × 1024
  - 390 × 844

Verify all relevant states:

- zero-state
- new Journey
- active Day 1
- resumed mid-day
- locked next day
- completed previous day review
- signed out
- signed in
- sensitive-struggle care gate
- Save to Vault
- Begin different Journey conflict
- Day 5 completion
- reduced motion
- keyboard-only
- crisis access
- no console errors
- no failed assets
- no horizontal overflow

Use only local development data.

Do not touch production Convex.

---

# Documentation

Create:

- `docs/implementation/release-b-journey-redesign-summary.md`
- `docs/verification/release-b-journey-verification.md`

Append each approved milestone as it completes.

Include:

- goal
- files changed
- behavior preserved
- behavior added
- screenshots
- accessibility
- storage changes
- tests
- known limitations
- rollback

---

# First action now

Do not implement yet.

Prepare the B1 plan only.

Return:

1. exact files proposed for B1
2. exact existing IDs and functions that B1 depends on
3. markup and CSS strategy
4. active, zero, and completed-state behavior
5. desktop, tablet, and mobile layout
6. accessibility plan
7. reduced-motion plan
8. test plan
9. rollback plan
10. confirmation that no protected file will change

Stop and wait for approval.
