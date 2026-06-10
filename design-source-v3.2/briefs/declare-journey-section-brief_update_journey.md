# Declare — Journey Section Design Brief

**Scope:** This brief covers the **Journey section only**. It is the surface that replaces the old "Anchor" tab. Anchor is fully absorbed into Journey: the transformation arc and the faithfulness-and-return behavior now live in one place, under one metaphor (the Tree of Life). The Declare composer and results flow already exist and are not being redesigned here. They appear only at the seam where results hand a man into Journey.

**Deliverable for the designer:** Build every Journey screen and state described below, in the brand system specified, mobile-first, then tablet and desktop. Where a screen depends on account/auth or saved data, build the UI and its states as specified and treat the live wiring as a later backend pass (noted inline as **[V2 wiring]**).

---

## 1. What Journey is

Journey is where a man moves his roots out of a false identity and into the true one God gives him. He does not improve a struggle. He gets transplanted. The picture is a tree being moved from shadow and planted by a stream, "like a tree planted by streams of water." The thing that grows is not foliage on a problem. It is the depth of his rooting in who God says he is.

Every Journey is a named identity shift, for example **Shame → Son**, **Fear → Courageous Leader**, **Isolation → Connected Brother**. The struggle a man names in Declare becomes the false-identity root. The truth God speaks becomes the true-identity canopy.

The voice everywhere is warm, direct, pastoral, grounded. Second person. No clinical language. No dashes joining sentences. Never use "To God be the glory" or any variant in this section.

---

## 2. The mechanism (exact flow)

This is the loop the section must support end to end.

1. A man taps **Declare** (center tab), selects or describes a struggle, and receives his results (Scripture, reflection, declarations, prayer). This already exists.
2. **At the end of the results**, a single CTA points him into Journey: *"This struggle has a root. Walk it all the way to freedom."* Tapping it routes to Journey **and carries the struggle with it**.
3. In Journey, the struggle is **auto-filled**. The man sees it framed as an identity shift (Shame → Son) and is invited to begin.
4. Beginning a Journey requires an **account**, because the Journey runs across multiple days and his place must be saved. The account gate appears here, at "Begin," not at results.
5. He walks the Journey one day at a time. There is **only one active Journey at a time.**
6. If he leaves the app mid-day or mid-Journey, returning to the Journey tab **resumes exactly where he left off** (saved to his account).
7. When he completes a Journey, he can run a **new struggle**: tap Declare again, get results, and begin a Journey on the new struggle.
8. If he **changes his mind mid-Journey** and starts a different struggle before finishing the current one, that is allowed. Starting the new Journey **resets the old, incomplete one** (its progress is cleared, since he did not complete it). This requires a gentle confirmation because progress is lost.

**Rule the UI enforces:** one active Journey. Resume the active one any time. Choosing a new struggle replaces it and resets the old, with a clear confirm step. A struggle is always named in Declare; Journey always receives it. Journey never seeds itself from scratch.

---

## 3. Brand tokens (use these exact values)

**Fonts**
- Display, Scripture, declarations, identity labels: **Cormorant Garamond** (300–700, italics available)
- UI, body, labels, buttons: **DM Sans** (300–600)

**Core palette (from the brand system)**
- `--cream: #FAF7F2` · `--cream-dark: #F0EBE1` · `--parchment: #E8E0D0`
- `--gold: #C9A84C` · `--gold-light: #E8C97A` · `--gold-dark: #9B7A2E` · `--gold-pale: #F5EDD8`
- `--forest: #2D4A3E` · `--forest-light: #3D6356` · `--forest-pale: #E8F0ED`
- `--text: #1A1A18` · `--text-muted: #6B6355` · `--text-light: #9B9080`
- `--white: #FFFFFF` · `--error: #C0392B` · `--success: #27AE60`

**Dark cinematic theme (default).** The brand file above is the light palette. Journey ships dark by default, so extend the palette into these dark surfaces. If the live dark theme already defines tokens, match those exactly to avoid drift; otherwise use:
- `--bg: #101A16` (deep forest near-black base)
- `--surface: #1B2C25` (elevated card)
- `--surface-2: #22382F` (raised card / sheets)
- Hairline borders: `rgba(233,201,122,0.14)` (gold hairline) or `rgba(250,247,242,0.08)` (neutral)
- Text on dark: primary `#FAF7F2`, muted `rgba(250,247,242,0.62)`, faint `rgba(250,247,242,0.40)`
- Accents and highlights: `--gold` and `--gold-light`
- A light theme toggle must exist and stay balanced, but dark is the default.

**Shape and spacing**
- Card radius 12px, sub-card radius 10px, pills 100px
- Consistent spacing scale, generous vertical rhythm, reading column ~640px on desktop
- Preserve the existing card design language: section cards, verse sub-cards with a **gold left-border stripe**, **circular declaration badges**, and a **gradient prayer box**

**Motion**
- Smooth scroll via Lenis where scrolling is used
- Easings: `cubic-bezier(0.22, 1, 0.36, 1)` for entrances and reveals, `cubic-bezier(0.34, 1.56, 0.64, 1)` for the small celebratory pop on day completion
- Animate **only `transform` and `opacity`** for GPU performance
- Every animation has a reduced-motion fallback that shows the end state without the transition

**Accessibility**
- Gold text on dark fails AA at small sizes. Reserve gold for large display type, icons, and accents. Body and UI text on dark is cream.
- Tap targets ≥44px
- Visible focus states on every interactive element
- Speaking declarations aloud is always optional, never required to advance
- The tree visualization carries a text alternative describing the current stage (for example, "Day 3 of 7, roots reaching toward the water")

---

## 4. The nav icon (replace the anchor)

Replace the anchor with a **Tree of Life** line icon. Thin single-weight line, roughly 24px, calm and rooted rather than nautical. A slender trunk, a small balanced canopy, three short roots, and a faint horizontal water line beneath the roots. Active state in `--gold`; inactive in cream at reduced opacity, matching the other thin line icons in the Open-style bottom bar. Label "Journey" shows only when the tab is active.

Starting sketch for the designer to refine:

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 21v-7"/>                         <!-- trunk -->
  <path d="M12 14c-2.2 0-3.6-1.6-3.6-3.4 0-2 1.6-3.6 3.6-3.6s3.6 1.6 3.6 3.6c0 1.8-1.4 3.4-3.6 3.4z"/> <!-- canopy -->
  <path d="M12 17.5c-1.2 0-2-.6-2.6-1.4M12 17.5c1.2 0 2-.6 2.6-1.4"/> <!-- roots -->
  <path d="M5 21h14"/>                            <!-- water line -->
</svg>
```

The label is "Journey." Keep the bottom bar exactly as built elsewhere: floating blurred bar, concave curve, thin line icons, **Declare** raised and gold-tinted in the center. On desktop the bottom bar is not used; Journey is reached from the top nav.

---

## 5. Screens and states

Build these in order. Mobile layouts described first; responsive notes follow each.

### 5.1 Results → Journey handoff (the seam)

At the very end of the existing results view, after the prayer, add one quiet, full-width CTA block.

- Eyebrow (DM Sans, uppercase, small, `--gold-light`): THIS HAS A ROOT
- Line (Cormorant, large, cream): *Walk it all the way to freedom.*
- Sub (DM Sans, muted): one sentence naming the shift this struggle points to, for example "From shame to son."
- Primary button (gold fill, forest text): **Begin this Journey**

Tapping it routes to Journey with the struggle and its identity shift attached. Do not interrupt results with the account gate. The gate comes one screen later.

### 5.2 Journey tab — empty / first-time (no struggle ever named)

A man may open the Journey tab directly before he has ever run Declare. Journey cannot seed itself, so this state points him to Declare.

- Centered Tree of Life mark, drawn as a bare sapling, calm not sad
- Cormorant headline: *Your journey begins with a struggle.*
- DM Sans body: *Name what you're carrying, and we'll walk its root all the way to freedom.*
- Primary button: **Name a struggle** → routes to Declare

No account gate here. Nothing to save yet.

### 5.3 Journey tab — active Journey home (resume)

This is the most-seen screen. When a Journey is active, the tab opens here.

- **Identity shift header.** Cormorant. The false identity in muted/faded treatment, an arrow or transition, the true identity in cream with a gold underline. Example: *Shame → **Son**.*
- **The tree visualization** as the emotional centerpiece (see Section 6), showing the current rooting stage.
- **Day progress.** "Day 3 of 7" in DM Sans, plus six small beat dots if mid-day, or a simple day track. Keep it a single clear indicator. The tree is the primary progress story; this is the literal readout.
- **Primary button:** **Continue Day 3** (gold). If the day was started and left mid-flow, label it **Resume Day 3**.
- **Return element (the old Anchor job, kept quiet).** A single understated line, not a second progress bar, for example *"You've returned 4 days. Faithfulness is the win."* Never let this compete visually with the tree.
- **Reminder control.** A subtle row: a daily reminder toggle and a time. Default off until the man sets it. See Section 7.
- Overflow menu: view this Journey's verses and declarations so far, adjust reminder, or start a different struggle (which triggers the reset confirm in 5.8).

Desktop and tablet: center the column ~640px, render the tree larger above the fold, keep the same hierarchy.

### 5.4 Account gate (at "Begin this Journey")

Triggered the first time a man taps **Begin this Journey** without an account. Presented as a calm bottom sheet on mobile, a centered modal on desktop. **[V2 wiring]** for the actual auth.

- Cormorant headline: *Let's hold your place.*
- DM Sans body: *A journey takes more than one day. Create a free account so your progress is here when you come back, even if today is all you have.*
- Buttons, stacked: **Continue with Apple**, **Continue with Google**, **Continue with email**
- Footer line, faint: *Free. No noise. Your declarations stay yours.*
- Dismiss returns him to the Journey entry without starting, no penalty.

States to build: default, loading per provider, error (gentle, retry), success (sheet dismisses and Day 1 begins). The composer and results are never gated. Only beginning a Journey is.

### 5.5 The day flow — six beats

A day is sacred, focused work, so it is a **stepped, mostly full-screen sequence**, one beat at a time, advance by tapping a forward button (swipe also advances on mobile). A slim row of **six progress dots** sits at the top, the current beat gold. A small back affordance returns one beat. The four brand verbs carry the six beats:

**Beat 1 — Receive (Scripture).** Three verses for this struggle: one well-known anchor verse plus two deeper, less-cited verses, always exactly three. Render as verse sub-cards with the **gold left-border stripe**, Cormorant for the verse, DM Sans small for the reference and translation (NKJV, NLT, or NIV). A short pastoral line sets up why these verses meet this struggle.

**Beat 2 — Confess (name the lie).** State the specific lie under this struggle in first person, drawn from the false-identity root, for example *"I am what I did."* The man reads a confession line and taps to acknowledge it as a lie he has believed. Optional small text field if he wants to name it in his own words. Tone is honest and unashamed, never accusatory.

**Beat 3 — Repent (turn).** One decisive action: a line he reads or speaks coming out of agreement with the lie, for example *"I turn from this. I come out of agreement with it."* A single confirming tap advances. This beat is short on purpose. It is a hinge.

**Beat 4 — Cast Off (renounce in Jesus' name).** The most active beat. A first-person renunciation in the authority of Jesus, for example *"In the name of Jesus, I cast off the lie that I am what I did. It has no place in me."* Encourage speaking it aloud with an optional mic-style prompt that is decorative only, not a recorder. Advancing requires only a tap.

**Beat 5 — Declare (Bless, speak life).** Two or three first-person "I am" declarations of the true identity, each in a **circular declaration badge** with the declaration in Cormorant beside it. Example: *"I am God's son. I am not what I did. I am of great worth to Him."* A gentle "speak it aloud" affordance, optional. This is the beat that fills the canopy.

**Beat 6 — Pray (close).** A short closing prayer in the **gradient prayer box**, Cormorant, addressed to the Father, sealing the day. Below it, the **self-check** (see Section 8): *Does this feel true yet?* with three taps: **Not yet · Getting there · Yes.**

After Beat 6, advance to **Day complete** (5.6).

Layout per beat: a single centered focus, one idea per screen, lots of breathing room, the forward control fixed at the bottom. Desktop renders the same sequence in a centered ~640px column, not a multi-column spread. The work should feel identical and unhurried on every device.

### 5.6 Day complete

- The **tree deepens one stage** with the only celebratory motion in the section: roots reach a little further toward the water, the canopy fills slightly, the light shifts a touch from shadow toward gold. Use the `cubic-bezier(0.34, 1.56, 0.64, 1)` pop, subtle. Reduced-motion shows the new stage with a soft fade.
- Cormorant affirmation tied to the day, for example *"You spoke the truth today. It's taking root."*
- Buttons: **Done for today** (returns to Journey home) and, if a reminder is unset, a soft prompt to set one.
- If the self-check trend suggests more depth is needed near the end of the spine, this is where an extra day is offered (Section 8). Never punish, only invite.

### 5.7 Journey complete

The payoff screen. This is what makes a man say "I am becoming a different man," not "I finished a plan."

- The **tree fully rooted by the water**, canopy full and lit in gold, shadow gone. Hold a beat before any text.
- **Before and after identity reveal.** Show the false identity he began in (faded, at the roots) transforming into the true identity (illuminated, in the canopy), in his own declaration words. Cormorant, large.
- A short benediction line in your pastoral voice.
- **Share card.** Generate a beautiful declaration card (the true-identity declaration on the brand dark-cinematic field with the tree mark and wordmark) with a single **Share** action. This is the section's primary organic growth lever, so make it genuinely worth sending.
- **Begin a new Journey** → routes to Declare to name the next struggle. The completed Journey is saved to his history.
- Secondary: **Save these declarations** to Vault.

### 5.8 Switch struggle / reset confirm

Reached when a man starts a **new** Journey while one is still active and incomplete (for example, he ran Declare again and tapped Begin on a different struggle, or chose "start a different struggle" from the Journey overflow).

- Bottom sheet / modal, calm not alarming.
- Cormorant headline: *Start a new journey?*
- DM Sans body: *You're partway through "Shame → Son." Starting a new one will clear that progress and plant a fresh tree. You can always come back to it later by naming it again.*
- Buttons: **Start the new journey** (gold) and **Keep my current one** (ghost).
- Confirming clears the old Journey's progress and begins the new one. Dismissing keeps the active Journey untouched.

### 5.9 Resume after leaving

Returning to the Journey tab after closing the app mid-day drops the man back at the **exact beat** he left, with the day's prior beats already marked done in the dot row. Mid-Journey but between days, he lands on the active Journey home (5.3) with **Continue Day X**. All of this is saved to his account. **[V2 wiring]**

### 5.10 History (quiet record)

Past completed identity shifts live as a small, calm record reachable from the Journey home (a "Your roots" or "Past journeys" link). Render each as a small rooted-tree mark with its shift label and date. Keep it understated. It honors faithfulness without turning into a trophy wall.

---

## 6. The tree visualization (the centerpiece)

One SVG illustration with **N defined growth stages**, where N equals the Journey length (default 7, adaptive). Each completed day advances exactly one stage. Growth is tied to completing the day's renewal work, never to merely opening the app.

Stage 0 (start): a slender sapling set slightly toward a shadowed side of the frame, roots short and shallow, a faint stream of water on the lit side it has not yet reached. The false-identity word sits faint near the roots.

Each stage advance: roots extend measurably toward and then into the stream, the canopy gains a little fullness, and the overall light shifts gradually from the shadow side (Tree of Knowledge) toward the gold-lit side (Tree of Life).

Final stage: the tree is rooted in the stream, canopy full and lit in gold, the shadow resolved into light. The true-identity word now sits illuminated in the canopy.

Palette: foliage in `--forest` and `--forest-light`, light and highlights in `--gold` and `--gold-light`, the stream in `--forest-light` with `--gold-pale` glints, the field in the dark cinematic background gradient. Keep it illustrative and serene, not literal photography.

Transitions animate `transform` and `opacity` only. Reduced-motion swaps directly to the next stage with a fade. Provide the text alternative for each stage as noted in accessibility.

Do not add a second growing element. The tree is the only growth meter. The return/faithfulness idea stays as the quiet text line in 5.3.

---

## 7. Reminders

One reminder a day, worded as the man's **own declaration**, sent at a time he chooses. A reminder that says "time for your devotional" is noise. A reminder that says *"Speak this over yourself before you walk in: I am not what I did. I am God's son."* is the product working between sessions.

Build a simple control on the Journey home: a toggle and a time picker. Default off until set. Copy pattern for the notification pulls the day's lead declaration. **[V2 wiring]** for delivery.

---

## 8. Adaptive length and the self-check

The visible spine is **7 days**. Completion is defined by the truth landing, not by the calendar ending.

After Pray each day, the self-check asks *Does this feel true yet?* with **Not yet · Getting there · Yes.** This is one tap, never a form. The backend reads the trend. If "Not yet" still dominates as the man nears Day 7, Day complete offers one or two extra days framed as invitation, for example *"Truth like this takes time to settle. Want one more day with it?"* The tree reflects this honestly: near the end it can read "almost rooted" until the self-check turns, then "rooted" at completion. Keep the UI reflecting the state; the logic lives in the backend. **[V2 wiring]**

---

## 9. Components to build

- Tree of Life visualization with N stages and stage text alternatives
- Identity-shift label (false faded → true illuminated, gold underline)
- Day-beat screen shell with six-dot progress and fixed forward control
- Verse sub-card with gold left-border stripe
- Circular declaration badge with Cormorant declaration
- Gradient prayer box
- Self-check three-state chip row
- Account gate sheet/modal with provider buttons and states
- Reset-confirm sheet/modal
- Reminder setting row (toggle + time)
- Share declaration card generator
- Journey home resume card
- History entry (small rooted-tree mark + shift label + date)

---

## 10. Responsive behavior

- **Mobile-first.** The six-beat day flow is full-screen stepped. The Journey home stacks: header, tree, progress, primary button, return line, reminder row.
- **Tablet.** Same structure, wider margins, larger tree.
- **Desktop.** Bottom bar not used; reach Journey from the top nav. Day flow runs in a centered ~640px focus column, not multi-column. Home centers with a larger tree above the fold. The work must feel the same and unhurried on every device.

---

## 11. Worked example — "Shame → Son," Day 1 (verbatim content)

Use this as the real Day 1 content and as the pattern for the rest.

**Identity shift:** Shame → Son
**False-identity root:** "I am what I did."
**True identity:** "I am God's son."

**Beat 1 — Receive.** Setup line: *Shame tells you you're defined by your worst moments. Here's what God says instead.*
- *"There is now no condemnation for those who are in Christ Jesus."* — Romans 8:1, NIV
- *"You are God's masterpiece, created anew in Christ Jesus."* — Ephesians 2:10, NLT
- *"See what great love the Father has lavished on us, that we should be called children of God. And that is what we are."* — 1 John 3:1, NIV

**Beat 2 — Confess.** *I confess I've believed the lie that I am what I did. I've let my failures tell me who I am.* (Tap: I've believed this.)

**Beat 3 — Repent.** *I turn from this lie. I come out of agreement with shame. I will not let my past name me.* (Tap to turn.)

**Beat 4 — Cast Off.** *In the name of Jesus, I cast off the lie that I am what I did. By His blood I break its hold on me. Shame has no place in my life.* (Speak it aloud, optional.)

**Beat 5 — Declare.** Three badges:
- *I am God's son.*
- *I am not what I did. I am who He made me.*
- *I am of great worth to my Father.*

**Beat 6 — Pray.** *Father, thank You that You see me as Your son and not as my failures. Today I receive that. Let it sink past my thinking and into my bones. In Jesus' name.* Then the self-check: Does this feel true yet?

**The 7-day spine (each day deepens the same shift, one root at a time).** Provide full content per day in the same six-beat pattern; the focus line and lead declaration for each:

1. **No condemnation.** *I am God's son. I am not what I did.*
2. **Adopted, not hired.** *I serve from love, not to earn. I belong.*
3. **Made new.** *The old me is gone. I am a new creation.*
4. **Seen and known.** *I have nothing to hide before my Father.*
5. **Worth set by Him, not by performance.** *My worth is settled. It was never up to me.*
6. **Free to fail forward.** *When I stumble, He holds me. I get back up.*
7. **Named son for good.** *Nothing can separate me from His love. I am His.*

---

## 12. Build order for the designer

1. Brand tokens and dark cinematic shell for the Journey surface
2. Journey home (active resume) as the pattern screen, including the tree at one mid-stage
3. The six-beat day flow with all beat layouts
4. Day complete and the tree stage-advance motion
5. Journey complete with the before-and-after reveal and share card
6. Account gate, reset confirm, empty state, history
7. Reminder control, self-check states, and all reduced-motion and accessibility passes

Keep the live `main` site untouched. Build on a branch with a preview URL.
