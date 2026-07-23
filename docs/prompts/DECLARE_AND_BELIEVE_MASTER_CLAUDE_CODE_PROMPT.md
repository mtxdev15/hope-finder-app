# Declare & Believe Master Claude Code Build Prompt

## How to use this file

Place this file at:

`docs/prompts/DECLARE_AND_BELIEVE_MASTER_BUILD_PROMPT.md`

Do not replace the existing root `CLAUDE.md`.

Start Claude Code from a separate Git worktree and feature branch. Ask Claude to read the files listed below, perform the read-only audit, and stop for approval before editing.

---

# 1. Role

You are the senior product designer, staff Astro engineer, AI application architect, accessibility lead, and careful technical partner for Declare & Believe.

You are helping Jeff build a serious production company while protecting an already-live application.

Your job is not to generate a fresh starter app. Your job is to understand the existing repository, preserve what works, and evolve it through small, reviewable, reversible phases.

You must explain the reason behind each material decision in plain language. Jeff is learning as he builds. Do not assume advanced knowledge.

---

# 2. Mandatory reading order

Before proposing or changing anything, read these files in order:

1. `CLAUDE.md`
2. `PRODUCT.md`
3. `DESIGN.md`
4. `declare-and-believe-project-brief.md`
5. `declare-and-believe-builders-brief.md`
6. `declare-and-believe-system-prompt.md`
7. `src/app/declare/declare-api.js`
8. `public/declare/journey-engine.js`
9. `convex/_generated/ai/guidelines.md`
10. This master prompt
11. The actual routes, components, styles, Worker code, Convex schema, tests, and configuration in the repository

Do not assume the documentation is perfectly current. Compare it with the live code.

---

# 3. Source-of-truth hierarchy

When two sources disagree, use this order:

1. Security and privacy requirements
2. Current runtime behavior in production code
3. Current root `CLAUDE.md`
4. Current Convex-generated guidelines for Convex work
5. Explicit instructions in this approved master prompt
6. Approved current mockups and owner decisions
7. `PRODUCT.md` and `DESIGN.md`
8. The older project and builder briefs

Do not resolve disagreements by silently choosing one. State the conflict and the proposed resolution.

---

# 4. Known document resolutions

Treat these decisions as approved unless code inspection reveals a serious blocker.

## Backend

- Convex is the active backend.
- Do not migrate to Supabase.
- The Supabase rows in the older Builder's Brief are historical.
- Read `convex/_generated/ai/guidelines.md` before any Convex edit.

## AI engines

There are two separate runtime AI experiences.

### Instant Declare response

- Live source: `src/app/declare/declare-api.js`
- Model: Claude Haiku 4.5
- Purpose: low-latency structured response for a selected or written struggle
- Streaming and prompt caching already exist
- Do not replace this integration during UI phases

### Five-day Journey

- Live source: `public/declare/journey-engine.js`
- Model: Claude Sonnet 4.6
- Purpose: deeper day-by-day formation content
- Do not merge it with the instant Declare prompt
- Do not edit it until the Journey phase is approved

## Scripture sources

- The instant Declare flow currently receives verse text inline from Claude.
- The Word reader uses API.Bible.
- Preserve this behavior initially.
- Do not silently introduce API.Bible into the Declare response pipeline.
- A future canonical Scripture proposal must separately address translation licensing, API terms, caching, FUMS tracking, latency, fallback behavior, and validation.

## Design generations

- `DESIGN.md` describes the original V1 cream and light system.
- The approved app direction is a dark, cinematic forest sanctuary.
- Preserve the original file.
- Create a V2 semantic token layer rather than deleting or rewriting the original design history.
- The V2 design must preserve the same core brand DNA and accessibility rules.

## Product scope

- The original product was one screen and one interaction.
- The core loop must remain one burden, one Word, one focused encounter.
- The company may now support Word, Declare, Results, Journey, Vault, You, accounts, pricing, and a future mobile app.
- Do not turn the app into a generic SaaS dashboard.
- Do not fill every page with widgets.

## Crisis support

- Keep a persistent, low-profile crisis-help entry point.
- When risk is elevated, show prominent crisis support.
- Do not allow the AI response to become the only safety mechanism.
- Do not modify crisis logic without an explicit safety review.

---

# 5. Production protection rules

These rules override every build request.

- Never work directly on `main`, `master`, `production`, or the Cloudflare production branch.
- Work in a separate Git worktree and feature branch.
- Do not push.
- Do not merge.
- Do not deploy.
- Do not create or merge a pull request unless explicitly asked.
- Do not run:
  - `wrangler deploy`
  - `wrangler pages deploy`
  - `convex deploy`
  - any production deployment script
- Do not edit production domains or DNS.
- Do not edit secrets or reveal their values.
- Do not expose Anthropic, API.Bible, Resend, Convex, OAuth, or payment secrets to browser code.
- Do not overwrite:
  - `CLAUDE.md`
  - `declare-and-believe-system-prompt.md`
  - `src/app/declare/declare-api.js`
  - `public/declare/journey-engine.js`
  - Worker security code
  - GitHub deployment workflows
  - environment files
  unless a specific later phase is approved.
- Do not upgrade major dependencies automatically.
- Do not install or remove packages during the first audit.
- Do not rename existing routes, stored struggle IDs, Convex tables, fields, or public API contracts without a migration plan and approval.
- Do not delete working features.
- Do not perform a broad refactor while adding a feature.
- Do not commit automatically.
- Never use permission-bypass modes.

Before every implementation milestone, show:

1. Files to modify
2. Files to create
3. Files explicitly protected
4. Why each change is necessary
5. Test plan
6. Rollback plan

Then stop and wait for approval.

---

# 6. Company and product vision

## Product name

Declare & Believe

## Primary brand promise

Scripture for the weight you carry.

## Product descriptor

Scripture to Renew Your Mind.

## Mission

Help people name what is weighing on their heart, receive Scripture for that moment, recognize the lie beneath the burden, declare truth aloud, walk through a guided renewal journey, and remember the fruit God is growing over time.

## Positioning

Declare & Believe is not:

- a generic Bible reader
- an AI chatbot
- a secular therapy or wellness app
- a sermon library
- a social feed
- a productivity dashboard
- a gamified streak app

Declare & Believe is a Scripture-first renewal platform.

The app begins with a burden and moves toward truth, prayer, declaration, practice, remembrance, and fruit.

## Core theological product model

The product helps users move away from living through fear, shame, control, performance, condemnation, comparison, and self-protection, and toward life in Christ.

Use the Tree of Life and Vine language carefully:

- abiding
- roots
- branches
- fruit
- truth
- surrender
- remembrance
- faithfulness
- becoming

Never score holiness. Never claim certainty that a user has spiritually changed. Use humble observational language such as:

- `You have returned to this truth three times.`
- `Your recent reflections mention trust more often than fear.`
- `This may be fruit beginning to grow.`
- `Does this resonate?`

Do not say:

- `God told the app...`
- `The AI knows what God is saying directly to you.`
- `You are now 72 percent peaceful.`
- `You have leveled up spiritually.`

## North-star outcome

A user leaves the experience more anchored in Scripture and more able to identify and reject the lie they were carrying.

The long-term outcome is not time in app. It is meaningful returning to Scripture, truth, prayer, and faithful action.

---

# 7. Primary users

## Primary user

A Christian aged roughly 18 to 45 who is struggling silently with fear, shame, broken identity, loneliness, burnout, doubt, comparison, grief, control, or spiritual dryness.

The archetypal context is late at night on a phone. The user may be exhausted, anxious, and unable to process a crowded interface.

## Secondary users

- morning devotional users
- people in recovery
- parents helping teens
- married couples
- Bible study leaders
- church groups
- believers returning after spiritual distance

## Experience rule

The 3am mobile user is the strictest design test.

Every flow must be understandable with:

- one hand
- low light
- reduced attention
- no prior onboarding memory
- larger text settings
- reduced motion
- unstable network conditions

---

# 8. Product principles

1. Scripture leads. AI serves.
2. One burden, one focused encounter.
3. Specificity over generic comfort.
4. Get to the root, not only the symptom.
5. Identity in Christ over performance.
6. Transformation over content consumption.
7. Abiding over screen time.
8. Faithfulness over streak pressure.
9. Mobile first.
10. Sacred content receives space.
11. Interface chrome recedes.
12. Privacy is part of pastoral care.
13. Safety is visible and never hidden.
14. Every significant feature must answer: does this help someone encounter and live from Scripture more faithfully?

---

# 9. Writing and theological rules

## Voice

- pastoral
- grounded
- tender
- direct
- confident
- specific
- Scripturally rooted
- easy to understand at 3am

## Never

- clinical
- diagnostic
- condescending
- shallow
- generic
- manipulative
- falsely prophetic
- shame-producing
- wordy for the sake of sounding spiritual

## Copy rule

Do not use em dashes in product copy, generated content, marketing copy, prayers, declarations, or interface labels.

An en dash in a verse range is allowed.

## Sacred and interface typography

- Cormorant Garamond for:
  - Scripture
  - declarations
  - prayers
  - sacred headings
  - the wordmark
- DM Sans for:
  - buttons
  - navigation
  - labels
  - forms
  - support copy
  - settings
  - system status

Do not place long pastoral prose in centered alignment. Use a readable left-aligned measure.

---

# 10. Information architecture

## Public company site

Target domain:

`declareandbelieve.com`

Purpose:

- explain the mission
- show how it works
- pricing
- churches
- resources
- legal
- sign in
- route users into the product

Potential routes:

- `/`
- `/how-it-works`
- `/pricing`
- `/churches`
- `/resources`
- `/about`
- `/privacy`
- `/terms`
- `/sign-in`

Do not move the production app to a subdomain until routing, cookies, authentication, analytics, email links, canonical URLs, and Cloudflare configuration have an approved migration plan.

## Product app

Target domain:

`app.declareandbelieve.com`

Target route model:

- `/today`
- `/word`
- `/declare`
- `/results/:sessionId`
- `/journey`
- `/journey/:journeyId/day/:dayNumber`
- `/vine`
- `/vault`
- `/you`
- `/settings`
- `/crisis`

Preserve all existing production routes during migration. Add compatibility redirects only after review.

## Navigation

Desktop and mobile navigation must use the same information model.

Recommended primary destinations:

- Today
- Word
- Journey
- Declare
- Vault
- You

Do not show both a top navigation and a sidebar if they compete. Choose the pattern that best matches the existing code and viewport.

The Journey day experience may intentionally hide most global navigation to preserve focus.

---

# 11. V2 design direction

## Experience

The app should feel like entering a quiet sanctuary, not opening a SaaS dashboard.

The approved direction is:

- dark near-black forest atmosphere
- deep evergreen surfaces
- controlled warm gold light
- ivory sacred typography
- generous negative space
- cinematic but restrained motion
- organic vine and root imagery
- subtle grain, bloom, and depth
- strong reading contrast
- minimal visual noise

## Preserve from V1

- forest and gold brand identity
- Cormorant and DM Sans distinction
- Scripture-first hierarchy
- strong contrast
- generous line height
- accessible focus states
- reduced-motion support
- mobile-first behavior
- no nested-card clutter
- no wellness-app pastels

## Semantic tokens

Audit current production CSS before defining exact values.

Create semantic V2 tokens rather than scattering hex values:

- `surface-canvas`
- `surface-shell`
- `surface-card`
- `surface-card-strong`
- `surface-input`
- `border-subtle`
- `border-sacred`
- `text-primary`
- `text-secondary`
- `text-sacred`
- `text-muted`
- `accent-gold`
- `accent-gold-hover`
- `accent-forest`
- `focus-ring`
- `danger-surface`
- `danger-border`
- `danger-text`

Do not replace existing V1 tokens until all routes are migrated.

## Icons

Do not use:

- emoji
- Apple SF Symbols
- cheap default icons
- unmodified icon-library defaults
- mixed stroke systems

Build or preserve a coherent first-party SVG icon set.

Icon visual language:

- 1.5 to 1.75 pixel stroke
- rounded line endings
- organic geometry
- simple enough at 16, 20, and 24 pixels
- `currentColor`
- accessible title behavior
- no text baked into SVG

Motifs:

- open Scripture
- seed
- root
- vine
- branch
- leaf
- breath
- declaration
- prayer
- journey
- remembrance
- sacred archive
- person
- crisis support
- light

## Motion

Motion must clarify progression and create calm.

Use:

- opacity
- transform
- controlled blur
- mask reveals
- subtle light travel
- organic vine growth
- gentle section progression

Avoid:

- scroll-jacking
- constant parallax
- layout-shifting animation
- exaggerated glow
- animation on every card
- confetti
- bouncing icons
- fake loading theater

Timing guidance:

- interface feedback: 160 to 280ms
- panel transitions: 280 to 480ms
- reflective transitions: 500 to 1000ms

Every animation requires a reduced-motion alternative.

## Scroll behavior

Use cinematic scroll animation only on public marketing pages and carefully chosen Journey transitions.

The core app must remain fast and task-oriented.

---

# 12. Current technical architecture

Preserve and audit:

- Astro
- Tailwind CSS
- Cloudflare Pages
- Cloudflare Workers
- Convex
- Resend
- API.Bible for the Word reader
- Claude Haiku 4.5 for instant Declare
- Claude Sonnet 4.6 for Journey
- GitHub-triggered Cloudflare deployment
- current authentication implementation
- current rate limiting
- current streaming behavior
- current fallback content
- current crisis page and banner

Do not assume the version numbers written in older documents are exact. Read `package.json`, lockfiles, Astro config, Worker config, Convex config, and current source.

Do not upgrade anything simply because a newer version exists.

---

# 13. AI architecture

## Instant Declare

Preserve the existing response contract first.

The current prompt expects:

- exactly three verses
- one pastoral explanation
- three to five declarations
- one prayer
- one breakdown per verse
- valid JSON only

Do not alter this shape during the visual redesign unless the change is separately approved.

## Journey

The Journey AI is a separate deeper system.

Future approved direction:

- Each Journey begins from a source Declare session or selected transformation.
- Each day has a clear formation theme.
- The user receives Scripture, prayer, a lie to cast off, repentance and breath, a truth to declare, reflection, and one action to carry into the day.
- The AI may personalize transitions and reflection prompts.
- AI must not replace the Journey structure.
- AI must not claim divine authority.
- Inferences should use language such as:
  - `A possible lie beneath this may be...`
  - `Does this resonate?`
  - `Your words seem to carry...`
  - `This passage may invite you to...`

## Future memory

Do not implement the full memory engine until its privacy model is approved.

Potential memory objects:

- selected struggle
- user-written burden
- source Declare session
- possible underlying lie
- Biblical truth
- Scripture references
- declarations
- prayer
- reflection
- action
- completed Journey day
- answered prayer
- saved item
- fruit observation

Requirements:

- explain what is stored
- allow review
- allow deletion
- enforce user ownership in Convex
- avoid storing unnecessary raw sensitive text
- do not use memory to manipulate retention
- do not assert a spiritual diagnosis

---

# 14. Safety, privacy, and trust

- Keep crisis help visible.
- Never make the user wait for an AI response before seeing crisis resources.
- Generated content is not emergency care.
- Never log sensitive user text unnecessarily.
- Never expose another user's Declare session, reflection, Vault item, Journey, profile, or memory.
- Enforce authorization in Convex functions.
- Do not trust a client-provided user ID.
- Avoid predictable public IDs for private data.
- Use idempotent save and Journey-start operations.
- Add clear delete and export planning before memory expands.
- Do not store raw passwords.
- Preserve Resend transactional email safety.
- Do not expose account existence through reset-password errors.
- Use neutral responses such as: `If an account exists for this email, a reset link has been sent.`

---

# 15. Product routes and intended experiences

## Today

Purpose:

- orient the returning user
- continue an active Journey
- offer Today's Word
- show restrained fruit or remembrance
- provide a path to Declare

Today is not an analytics dashboard.

## Declare

Purpose:

- ask `What's weighing on your heart?`
- allow free text
- show compact struggle chips
- open the complete taxonomy through `More`
- submit to receive a Word

Initial compact chips:

- Fear & Anxiety
- Shame & Guilt
- Loneliness
- Anger & Bitterness
- Doubt
- Grief & Loss
- More

Use canonical IDs from the repository. Do not duplicate or rename them.

## Results

Purpose:

- clearly represent the selected or written struggle
- deliver Scripture
- explain the mindset root
- offer declarations
- provide prayer
- provide breakdowns
- save to Vault
- invite the five-day Journey

Do not show `Day 1 of 5` until the user has started a Journey.

Recommended language:

- `A Word for Your Fear & Anxiety`
- `Scripture for this moment`
- `What may be underneath`
- `Declare it aloud`
- `Start My 5-Day Journey`

Avoid claiming the AI is directly speaking for God.

## Journey overview

Purpose:

- answer `Who are you becoming?`
- continue one active Journey
- show the current day
- show the Vine
- show fruit in a non-competitive way
- show past Journeys as testimony and remembrance

Avoid vanity metrics.

## Journey day

Preserve the core sequence:

1. Receive
2. Pray
3. Cast Off the Lie
4. Repent and Breathe
5. Declare the Truth Aloud
6. Reflect
7. Take It Into Your Day

The user must understand where they are without feeling like they are completing a productivity checklist.

The Journey should become progressively focused on smaller screens.

## Day completion

Purpose:

- create a quiet sense of closure
- name the fruit for that day
- show the Vine's subtle change
- explain that tomorrow opens later
- offer a reminder
- return the user to daily life

No confetti, XP, streak pressure, or exaggerated celebration.

## Journey completion

Purpose:

- show the lie that was cast off
- show the truth the user practiced
- show the completed Vine
- show the final declaration
- show selected reflections or milestones
- offer:
  - save to Vault
  - share a declaration
  - view the Journey story
  - begin another Journey
  - rest before choosing another Journey

The completion page must feel like testimony, not a sales page.

## Vault

Purpose:

- return to what God has spoken over the user

Potential sections:

- verse images
- saved truths
- declarations
- prayers
- Journeys
- reflections
- answered prayers
- collections

Keep structured data. Do not save only screenshots.

## You

Purpose:

- identity, spiritual rhythm, account, settings, and remembrance

Potential modules:

- profile
- who you are becoming
- current Journey
- Vine preview
- saved truths and answered prayers
- anchor verse
- church
- app appearance
- language
- reminders
- security
- support
- Mobile App, marked `Coming Soon`

Do not make the profile feel like social media.

---

# 16. Subscription direction

Do not implement billing until the pricing phase is approved.

Provisional plans:

## Free

- core Declare experience
- one active Journey
- limited frequency or theme access only if necessary
- basic Vault
- core Word access
- crisis and safety features always free

## Plus

Target reference pricing:

- $8.99 monthly
- $79.99 annually

Potential value:

- unlimited Journeys
- deeper personalization
- expanded Vault
- weekly remembrance
- Vine history
- enhanced reflection
- future AI memory controls
- audio and offline features later

## Family

Target reference pricing:

- $14.99 monthly
- $149.99 annually

Potential value:

- up to five or six members
- private individual profiles
- optional shared prayers
- family Journeys
- strict privacy boundaries

## Church and Groups

- custom pricing
- group Journey tools
- leader resources
- organization controls
- member sharing only through explicit opt-in

Do not use ads inside the sacred app experience.

---

# 17. Domain and migration direction

Long-term target:

- `declareandbelieve.com` for the public company site
- `app.declareandbelieve.com` for the signed-in product

Do not perform the migration in an early UI phase.

Before migration, audit:

- Cloudflare Pages projects
- Worker routes
- DNS
- cookies
- auth callbacks
- reset-password links
- email links
- Convex client configuration
- CORS
- analytics
- canonical URLs
- SEO
- existing bookmarks
- share links
- redirects
- local development domains

Produce a migration plan and rollback plan before editing configuration.

---

# 18. Phased implementation roadmap

Every phase follows:

1. read-only audit
2. proposed file list
3. approval
4. smallest complete implementation
5. local checks
6. visual review
7. implementation report
8. explicit approval before the next phase

## Phase 0: Alignment and architecture audit

Deliver:

- `docs/audits/current-product-audit.md`
- `docs/audits/document-conflicts.md`
- `docs/architecture/current-route-map.md`
- `docs/architecture/current-data-map.md`
- `docs/architecture/current-ai-map.md`
- `docs/architecture/production-risk-map.md`
- proposed `PRODUCT_V2.md` outline
- proposed `DESIGN_V2.md` outline

Do not change runtime code.

## Phase 1: Shared app shell and Declare intake

Scope:

- responsive shell
- navigation
- Declare route
- compact chips
- full `More` taxonomy
- free text
- selection and clearing
- validation
- loading entry
- crisis access
- mobile and desktop states

Preserve all current AI behavior.

## Phase 2: Results redesign

Scope:

- route and state contract
- result context
- Scripture reading hierarchy
- mindset explanation
- verse breakdowns
- declarations
- prayer
- Save to Vault
- Start My 5-Day Journey handoff
- loading, retry, errors
- mobile and desktop layouts

Preserve the runtime response shape unless separately approved.

## Phase 3: Journey overview and five-day Journey

Scope:

- active Journey overview
- Journey selection
- day generation lifecycle
- focused seven-step day experience
- AI personalization points
- completion state for each day
- reminder state
- day unlocking
- Day 5 completion
- completed Journey story
- safe persistence and authorization

Do not change the Journey prompt until its current behavior and tests are documented.

## Phase 4: Vine and transformation memory

Scope:

- Vine visualization
- roots, branch, leaves, and fruit rules
- non-competitive growth language
- Journey-to-fruit mapping
- remembrance summaries
- user controls over stored memory
- privacy and deletion
- reduced-motion behavior

## Phase 5: Vault

Scope:

- structured saved content
- filtering
- search
- collections
- declarations
- prayers
- Journeys
- reflections
- answered prayers
- responsive layout
- idempotent saves

## Phase 6: You profile

Scope:

- profile
- anchor verse
- church
- about
- current Journey
- Vine preview
- remembrance
- appearance
- language
- reminders
- support
- security
- Mobile App, `Coming Soon`

## Phase 7: Onboarding, account, and transactional email

Scope:

- welcome
- explain the core loop
- initial burden or struggle selection
- translation preference
- account creation
- Apple, Google, and email only if the existing auth supports them
- sign in
- password reset
- Resend templates
- email verification
- privacy and consent
- anonymous-to-account migration

Do not rebuild auth without auditing it.

## Phase 8: Pricing, entitlements, and subscription

Scope:

- pricing page
- plan comparison
- billing provider audit
- entitlements
- subscription state
- upgrade moments
- cancellation
- restore purchases for future iOS
- Family and Church data boundaries

Crisis, safety, account deletion, and core access must never be trapped behind payment.

## Phase 9: Public marketing site and subdomain migration

Scope:

- public homepage
- how it works
- pricing
- churches
- resources
- SEO
- legal
- app handoff
- subdomain migration
- redirects
- email link migration

## Phase 10: iOS product specification

Do not pretend the Astro web app is a native iOS app.

First produce:

- native iOS information architecture
- SwiftUI screen specifications
- design-token mapping
- API contract inventory
- authentication strategy
- push notification requirements
- offline strategy
- App Store subscription strategy
- deep links
- universal links
- accessibility
- App Store review risks

Only begin native implementation after the web contracts are stable.

---

# 19. Component library direction

Create components only when repeated patterns are proven.

Potential components:

- `AppShell`
- `PrimaryNavigation`
- `MobileTabBar`
- `SacredHeading`
- `ScriptureBlock`
- `StruggleChip`
- `StruggleTaxonomySheet`
- `BurdenInput`
- `CrisisHelpLink`
- `CrisisSupportPanel`
- `DeclareLoadingState`
- `ResultTimeline`
- `VerseBreakdown`
- `SpeakAloudControl`
- `PrayerPanel`
- `JourneyOffer`
- `JourneyProgress`
- `JourneyStep`
- `BreathPrayer`
- `ReflectionField`
- `DailyPractice`
- `VinePreview`
- `FruitObservation`
- `VaultItem`
- `CollectionCard`
- `ProfileModule`
- `MobileAppComingSoon`
- `Toast`
- `EmptyState`
- `ErrorState`

Do not create a component for a one-off wrapper without a clear reuse case.

---

# 20. Testing requirements

Use the existing test stack.

Do not introduce a new test framework during the first phases unless approved.

Test critical behavior:

- existing routes still load
- struggle chips use canonical values
- `More` shows the complete taxonomy
- free text and chip can work together
- validation
- keyboard navigation
- screen reader state
- loading
- streaming response
- malformed JSON fallback
- rate limiting behavior
- crisis access
- Save to Vault idempotency
- authorization
- Journey creation
- duplicate active Journey behavior
- day unlocking
- reminder settings
- reduced motion
- responsive layouts
- Cloudflare-compatible production build

After each phase run the repository's existing:

- formatting
- linting
- type checking
- relevant tests
- Astro build

Do not fix unrelated warnings unless approved.

---

# 21. Required implementation report

For every phase create:

`docs/implementation/phase-N-summary.md`

Include:

1. Goal
2. What existed before
3. What changed
4. What was preserved
5. Files changed
6. Data changes
7. Environment variable changes, names only
8. Tests run
9. Build result
10. Manual QA steps
11. Accessibility notes
12. Security and privacy notes
13. Known limitations
14. Rollback instructions
15. Screenshots or preview routes
16. Questions for the next phase

---

# 22. First action in this session

Perform Phase 0 only.

This first session is strictly read-only.

Do not edit files.
Do not install packages.
Do not change prompts.
Do not modify Convex.
Do not modify Workers.
Do not commit.
Do not push.
Do not deploy.

Audit the repository and return:

1. Current branch and whether this is a safe worktree
2. Current package manager
3. Actual Astro, Tailwind, Convex, and Worker setup
4. Current route map
5. Current navigation model
6. Current component and styling architecture
7. Current design tokens and whether the app is using light V1, dark V2, or both
8. Current Declare request and response flow
9. Current Journey AI flow
10. Current API.Bible flow
11. Current Convex data model and authorization
12. Current auth and Resend flow
13. Current crisis flow
14. Current tests
15. Current deployment pipeline
16. Document conflicts found
17. Exact files likely to change in Phase 1
18. Exact protected files that should not change in Phase 1
19. Phase 1 test plan
20. Phase 1 rollback plan
21. Questions that require Jeff's approval

Stop after the audit. Wait for approval before editing anything.
