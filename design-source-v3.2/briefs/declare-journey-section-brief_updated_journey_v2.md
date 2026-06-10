# Declare — Journey Section Design Brief (v2)

**Scope:** The Journey section only. This replaces the old "Anchor" tab. Anchor is fully absorbed into Journey. This version evolves the v1 brief by folding in the daily ritual and the cinematic, breath-led atmosphere we liked from the AI Studio prototype, rebuilt entirely in our brand. We are improving and extending what we already have, not starting over. The Declare composer, the results view, and the navigation are not being changed.

**Deliverable for the designer:** Build every Journey screen and state below, in the brand system specified, mobile-first, then tablet and desktop. Anything depending on account, auth, or saved data is built as UI with all states now; live wiring is a later backend pass, marked **[V2 wiring]**.

**Audience:** Both men and women. Identity language is inclusive (child of God, son or daughter, beloved). Never assume the user's gender.

---

## 1. What Journey is

Journey is where a person abides in Christ until a false identity is replaced by the true one God gives them. The picture is the Vine. Jesus said, "I am the vine, you are the branches. If you remain in me and I in you, you will bear much fruit" (John 15:5). A person does not improve a struggle by willpower. They stay connected to the Vine, the old self-reliant branch is pruned, and a branch of truth grows and bears fruit.

Every Journey is a named identity shift, for example **Shame → Beloved Child**, **Fear → Courageous**, **Rejection → Belonging**, **Isolation → Connected**. The struggle a person names in Declare becomes the old branch. The truth God speaks becomes the branch that grows and fruits.

Each day is a short, guided, almost meditative ritual that moves a person from the lie to the truth, with breath used to arrive, to release, and to receive. Completing a day produces one named fruit on the growing branch. Over the Journey, the tree fills with the fruit of a renewed mind.

The voice everywhere is warm, direct, pastoral, grounded, and easy to read. Second person. Short sentences. No clinical language. No dashes joining sentences. Never use "To God be the glory" or any variant in this section.

---

## 2. The mechanism (exact flow)

1. A person taps **Declare** (center tab), names or describes a struggle, and receives results (Scripture, reflection, declarations, prayer). This already exists and is not changed.
2. **At the bottom of the results**, add one button: **Begin this Journey**. Tapping it routes to Journey **and carries the struggle with it**.
3. In Journey, the struggle is **auto-filled** and framed as an identity shift (for example Shame → Beloved Child). The person is invited to begin.
4. Beginning a Journey requires an **account**, because the Journey runs across days and progress must be saved. The account gate appears here, at "Begin," never at results.
5. The person walks the Journey one day at a time. There is **only one active Journey at a time.**
6. Leaving mid-day or mid-Journey and returning to the Journey tab **resumes exactly where they left off** (saved to the account).
7. After completing a Journey, they can run a **new struggle**: tap Declare again, get results, begin the new Journey.
8. Starting a **new** struggle while one is still incomplete is allowed, and it **resets the old incomplete one** behind a gentle confirmation, since it was not completed.

**Rule the UI enforces:** one active Journey. Resume anytime. Choosing a new struggle replaces the active one and resets the old, with a clear confirm. A struggle is always named in Declare; Journey always receives it. In Journey, "change struggle" routes back to Declare and triggers the reset confirm. Journey never seeds itself.

---

## 3. Brand tokens (use these exact values)

**Fonts**
- Display, Scripture, declarations, identity labels: **Cormorant Garamond** (300–700, italics available)
- UI, body, labels, buttons: **DM Sans** (300–600)

**Core palette**
- `--cream: #FAF7F2` · `--cream-dark: #F0EBE1` · `--parchment: #E8E0D0`
- `--gold: #C9A84C` · `--gold-light: #E8C97A` · `--gold-dark: #9B7A2E` · `--gold-pale: #F5EDD8`
- `--forest: #2D4A3E` · `--forest-light: #3D6356` · `--forest-pale: #E8F0ED`
- `--text: #1A1A18` · `--text-muted: #6B6355` · `--text-light: #9B9080`
- `--white: #FFFFFF` · `--error: #C0392B` · `--success: #27AE60`

**Dark cinematic theme (default).** The brand file is the light palette. Journey ships dark by default. If the live dark theme defines tokens, match those exactly; otherwise use:
- `--bg: #101A16` · `--surface: #1B2C25` · `--surface-2: #22382F`
- Hairlines: `rgba(233,201,122,0.14)` (gold) or `rgba(250,247,242,0.08)` (neutral)
- Text on dark: primary `#FAF7F2`, muted `rgba(250,247,242,0.62)`, faint `rgba(250,247,242,0.40)`
- Accents and glow: `--gold` and `--gold-light`
- Include a balanced light toggle, but ship dark by default.

**Shape and spacing:** card radius 12px, sub-card 10px, pills 100px, generous vertical rhythm, desktop reading column ~640px. Preserve the existing card design language: section cards, verse sub-cards with a **gold left-border stripe**, **circular declaration badges**, and a **gradient prayer box**.

---

## 4. Atmosphere and motion (the cinematic, Open-style direction)

This is the feel we are adding. Study Open and Superpower for reference. The Journey should feel calm, spacious, and reverent, not busy or gamified.

- **Dark, atmospheric field.** Deep forest-to-near-black gradients, soft vignettes, a faint warm gold light source. The Vine glows gently against the dark.
- **One idea per screen.** Each movement of the day is its own quiet, mostly full-screen moment with lots of breathing room. Minimal chrome.
- **Slow, breathing motion.** Gentle drifts and fades, nothing snappy. Entrances use `cubic-bezier(0.22, 1, 0.36, 1)`. The single celebratory moment, a fruit forming at day's end, uses `cubic-bezier(0.34, 1.56, 0.64, 1)`, kept subtle.
- **Breath is the signature interaction** (Section 8). Expanding and contracting rings, soft glow that swells on the inhale and settles on the exhale, like Open.
- **GPU only.** Animate `transform` and `opacity` only. Every animation has a reduced-motion fallback that shows the end state without the transition.
- **Smooth scroll** via Lenis where scrolling is used.

---

## 5. The Vine visualization (the centerpiece)

One atmospheric SVG illustration that grows across the Journey. It lives on the Journey home and re-appears at day complete and Journey complete.

**Structure**
- **The Vine (root and spine).** A strong central vine rising from the base, labeled quietly at the root: *Jesus, the Vine* (John 15:5). Rendered in `--forest` and `--forest-light` with a faint gold inner light, as if drawing from living water. This is constant. It does not grow or shrink. Everything else hangs off it.
- **The old branch (the lie).** One thinner branch in muted, desaturated tones carrying the false-identity label. It **dims and recedes** as days are completed, the picture of the Vinedresser pruning the branch that bears no fruit (John 15:2). Never violent, just fading into the dark.
- **The branch of truth.** One branch that **grows and thickens** with each completed day, reaching toward the gold light, carrying the true-identity label, which **brightens** as the Journey progresses.
- **Fruit.** Each completed day forms **one glowing gold fruit** on the branch of truth. Render fruit as a soft gold light-bud with a gentle bloom, never a literal apple or emoji. Each fruit is named (see the worked example). Tapping or hovering a fruit reveals its name and the truth of that day in a small calm caption. At Journey complete, the branch is full of fruit and lit in gold.

**Progress, kept quiet.** No percentage meter. The growing fruited branch is the main progress story. Beneath or beside it, two understated readouts only: a day marker (*Day 3 of 7*) and a gentle **streak / faithfulness** line (*You've returned 4 days. Faithfulness is the win.*). The streak is the old Anchor job, kept calm, never a scoreboard.

**Fruit log.** A quiet, optional list under the tree, *Fruit so far*, showing each day's named fruit. It reads as a record of grace, not a trophy case.

Each stage transition animates `transform` and `opacity` only, with a reduced-motion fade to the next state. The visualization carries a text alternative describing the current state, for example "Day 3 of 7, the branch of truth has grown and bears three fruit."

---

## 6. The daily ritual (the movements)

A day is a guided sequence of movements, one per screen, advanced by a soft forward control (swipe also advances on mobile). A slim progress indicator shows the current movement and position. Some movements are long, breath-led moments; some are short hinges of a single tap. Keep the whole day unhurried but not heavy.

Order, matching the source teaching (Confess, Repent, Cast Off, Bless) with breath woven in:

1. **Arrive (breath).** Before anything, one breath cycle to quiet the mind (Section 8). Copy in the spirit of *Be still, and know.* Encouraged, with a small **Skip** for those who want to move on.
2. **Receive (Scripture).** Three verses for this struggle, one well-known anchor verse plus two deeper ones, always exactly three. Verse sub-cards with the **gold left-border stripe**, Cormorant for the verse, DM Sans small for reference and translation (NKJV, NLT, NIV). A short pastoral line sets up why these meet this struggle.
3. **Confess (name the lie).** State the specific lie under this struggle in first person, for example *I am what I did.* The person reads a confession line and taps to acknowledge they have believed it. Optional small field to name it in their own words. Honest and unashamed, never accusatory.
4. **Repent (turn).** One decisive hinge. A single line read or spoken, *I turn from this. I come out of agreement with it,* and one confirming tap. Short on purpose.
5. **Cast Off (renounce, exhale the lie).** A first-person renunciation in the authority of Jesus, tied to a guided **exhale**: as the person breathes out, they release the lie. For example *In the name of Jesus, I cast off the lie that I am what I did. By His blood it has no hold on me.* The exhale animation accompanies it.
6. **Declare (bless, inhale the truth).** A guided **inhale** to receive, then two or three first-person "I am" declarations of the true identity in **circular declaration badges**, Cormorant. For example *I am God's beloved child. I am not what I did. I am of great worth to my Father.* An **optional speak-aloud** with a soft ambient waveform, plus a clear skip line: *Skip speaking, I'll read them.* This is the movement where the day's fruit forms.
7. **Reflect (journal).** A short prompt and a free-text response saved to the Journey, a quiet altar to write what God is showing them. One question, never a form.
8. **Pray (seal).** A short closing prayer in the **gradient prayer box**, Cormorant, addressed to the Father, sealing the day. Below it the **self-check**: *Does this feel true yet?* with three taps, **Not yet · Getting there · Yes** (Section 9).
9. **Action (optional close).** One simple real-world step to carry the truth into the day, with a clear **Skip** since it is optional. For example *When the old accusation comes today, answer it out loud with one line: I am God's child.*

After the final movement, advance to **Day complete** (Section 10.6), where the fruit forms on the tree.

Layout per movement: a single centered focus, one idea, generous space, forward control fixed at the bottom, a small back affordance to the previous movement. Desktop renders the same sequence in a centered ~640px column, never multi-column. The ritual feels identical and unhurried on every device.

---

## 7. (reserved)

---

## 8. Breathwork (follow Open)

Breath is the signature calm interaction. Use it in three places: to arrive (Movement 1), to exhale the lie (Movement 5, Cast Off), and to inhale the truth (Movement 6, Declare).

**The ring.** A soft circle with a gold glow centered on a dark field. On **inhale** it expands and the glow swells. On **hold** it rests at full size, glow steady. On **exhale** it contracts and the glow settles. A small countdown sits in the center.

**Timing.** Default 4 seconds inhale, 4 hold, 4 exhale. One full cycle to arrive; the exhale and inhale at Cast Off and Declare are single guided breaths tied to those actions.

**Copy, sparse and calm.** Arrive: *Breathe in… hold… breathe out.* Cast Off exhale: *Breathe out the lie.* Declare inhale: *Breathe in the truth.* Keep words minimal, let the motion lead.

**Reduced motion and accessibility.** Offer a static, non-animated version that still guides the breath with text and the countdown. Breath is never required to advance; every breath moment has a skip. Animate `transform` and `opacity` only.

---

## 9. Adaptive length and the self-check

The visible spine is **7 days**. Completion is defined by the truth landing, not by the calendar ending. After Pray each day, the self-check asks *Does this feel true yet?* with one tap, **Not yet · Getting there · Yes.** The backend reads the trend. If "Not yet" still dominates near Day 7, Day complete offers one or two extra days as invitation, never penalty, for example *Truth like this takes time to settle. Want one more day with it?* The tree reflects the state, reading "almost full" until the self-check turns, then "full" at completion. Logic lives in the backend. **[V2 wiring]**

---

## 10. Screens and states

### 10.1 Results → Journey handoff (the seam)
At the bottom of the existing results view, after the prayer, add one quiet full-width block.
- Eyebrow (DM Sans, uppercase, small, `--gold-light`): THIS HAS A ROOT
- Line (Cormorant, large, cream): *Walk it all the way to freedom.*
- Sub (DM Sans, muted): one sentence naming the shift, for example *From shame to beloved child.*
- Button (gold fill, forest text): **Begin this Journey** → routes to Journey with the struggle and shift attached. No account gate here.

### 10.2 Journey tab — empty / first-time (no struggle ever named)
- Centered Vine mark, calm, a young vine with no fruit yet
- Cormorant headline: *Your journey begins with a struggle.*
- DM Sans body: *Name what you're carrying, and we'll walk its root all the way to freedom.*
- Button: **Name a struggle** → routes to Declare. No gate, nothing to save yet.

### 10.3 Journey tab — active Journey home (resume)
The most-seen screen.
- **Identity shift header,** Cormorant: the false identity faded, a transition, the true identity in cream with a gold underline. Example *Shame → **Beloved Child**.*
- **The Vine visualization** at its current stage (Section 5), the emotional centerpiece.
- **Day marker** (*Day 3 of 7*) and the quiet **streak line.**
- **Primary button:** **Continue Day 3** (gold), or **Resume Day 3** if a day was left mid-ritual.
- **Fruit log** beneath, quiet and optional.
- **Reminder control:** a subtle toggle and time (Section 11).
- Overflow: view this Journey's verses, declarations, and reflections so far, adjust reminder, or change struggle (triggers reset confirm in 10.8, routes to Declare).
Desktop and tablet: centered ~640px, larger Vine above the fold, same hierarchy.

### 10.4 Account gate (at "Begin this Journey")
Triggered the first time a person taps Begin without an account. Calm bottom sheet on mobile, centered modal on desktop. **[V2 wiring]**
- Cormorant headline: *Let's hold your place.*
- Body: *A journey takes more than one day. Create a free account so your progress is here when you come back, even if today is all you have.*
- Buttons, stacked: **Continue with Apple**, **Continue with Google**, **Continue with email**
- Footer, faint: *Free. No noise. Your declarations stay yours.*
- States: default, per-provider loading, gentle error with retry, success (sheet dismisses and the day begins). Dismiss returns to Journey entry with no penalty. Composer and results are never gated. Only beginning a Journey is.

### 10.5 The day ritual screens
Build the nine movements from Section 6, each its own screen, with the slim movement indicator, fixed forward control, and back affordance. Include the breath moments (Section 8), the optional speak-aloud with its skip line, the journal field, and the self-check.

### 10.6 Day complete
- **A fruit forms** on the branch of truth with the one celebratory motion in the section, a soft gold bloom using `cubic-bezier(0.34, 1.56, 0.64, 1)`, subtle. The branch thickens a little, the old branch dims a little. Reduced motion fades to the new state.
- The day's **named fruit** appears with a short line, for example *Day 1 fruit: Standing Spotless. You spoke the truth today. It's taking root.*
- Buttons: **Done for today** (returns to Journey home), and a soft prompt to set a reminder if unset.
- If the self-check trend warrants it near the end of the spine, the extra-day invitation appears here (Section 9). Never punish, only invite.

### 10.7 Journey complete
The payoff.
- The **Vine full of fruit and lit in gold,** the old branch gone. Hold a beat before any text.
- **Before and after identity reveal,** Cormorant, large: the false identity transforming into the true one in the person's own declaration words.
- A short benediction in the pastoral voice.
- **Share card:** a beautiful declaration card, the true-identity declaration on the dark cinematic field with the Vine mark and wordmark, one **Share** action. This is the primary organic growth lever, make it worth sending.
- **Begin a new Journey** → routes to Declare. The completed Journey is saved to history.
- Secondary: **Save these declarations** to Vault.

### 10.8 Switch struggle / reset confirm
Reached when a new Journey is started while one is active and incomplete.
- Calm sheet or modal.
- Cormorant headline: *Start a new journey?*
- Body: *You're partway through "Shame → Beloved Child." Starting a new one will clear that progress and begin a fresh vine. You can always come back to it later by naming it again.*
- Buttons: **Start the new journey** (gold), **Keep my current one** (ghost).
- Confirming clears the old progress and begins the new. Dismissing leaves the active Journey untouched.

### 10.9 Resume after leaving
Returning after closing the app mid-day drops the person at the **exact movement** they left, prior movements marked done. Between days, they land on the active Journey home with **Continue Day X**. Saved to the account. **[V2 wiring]**

### 10.10 History (the fruit grove)
Past completed identity shifts live as a calm record reachable from the Journey home (*Past journeys*). Each is a small fruited Vine mark with its shift label and date. Understated. It honors faithfulness without becoming a trophy wall.

---

## 11. Reminders
One reminder a day, worded as the person's **own declaration**, at a time they choose. A reminder that says "time for your devotional" is noise. *Speak this over yourself before you walk in: I am God's beloved child. I am not what I did.* is the product working between sessions. Build a simple control on the Journey home, a toggle and a time picker, default off until set. Notification copy pulls the day's lead declaration. **[V2 wiring]**

---

## 12. Components to build
- Vine visualization with growth stages, dimming old branch, growing fruited branch, named tappable fruit, and a text alternative
- Identity-shift label (false faded → true illuminated, gold underline)
- Breath ring (inhale, hold, exhale) with static reduced-motion version
- Day-ritual movement shell with slim progress indicator and fixed forward control
- Verse sub-card with gold left-border stripe
- Circular declaration badge with Cormorant declaration
- Speak-aloud control with ambient waveform and skip line
- Journal reflection field
- Self-check three-state chip row
- Gradient prayer box
- Day-complete fruit-bloom moment
- Account gate sheet/modal with provider buttons and states
- Reset-confirm sheet/modal
- Reminder setting row (toggle + time)
- Share declaration card generator
- Journey home resume card with quiet streak and fruit log
- History entry (small fruited Vine mark + shift label + date)

---

## 13. Responsive behavior
Mobile-first, then tablet, then desktop. The day ritual is full-screen stepped on mobile and a centered ~640px focus column on desktop, never multi-column. Bottom bar is mobile only; reach Journey from the top nav on desktop. The work feels the same and unhurried on every device.

---

## 14. Accessibility
- Gold text on dark fails AA at small sizes. Reserve gold for large display, icons, glow, and accents. Body and UI text on dark is cream.
- Tap targets ≥44px. Visible focus states everywhere.
- Breath and speak-aloud are always optional, never required to advance, each with a skip.
- The Vine carries a text alternative for its current state and named fruit.
- Provide the static reduced-motion path for every animation, including the breath ring and the fruit bloom.

---

## 15. Worked example — "Shame → Beloved Child"

**False-identity root:** "I am what I did."
**True identity:** "I am God's beloved child."

**The 7-day arc** (each day deepens the same shift and yields one fruit). Provide full content per day in the nine-movement pattern; focus, lead declaration, and fruit for each:

1. **No condemnation.** *I am God's beloved child. I am not what I did.* Fruit: **Standing Spotless.**
2. **Adopted, not hired.** *I belong. I serve from love, not to earn.* Fruit: **Adopted Heart.**
3. **Made new.** *The old me is gone. I am a new creation.* Fruit: **A New Creation.**
4. **Seen and known.** *I have nothing to hide before my Father.* Fruit: **Nothing to Hide.**
5. **Worth set by Him.** *My worth is settled. It was never mine to earn.* Fruit: **Settled Worth.**
6. **Free to fail forward.** *When I stumble, He holds me. I rise again.* Fruit: **Held and Lifted.**
7. **Sealed for good.** *Nothing can separate me from His love. I am His.* Fruit: **Sealed in Love.**

**Day 1, verbatim, all movements:**

- **Arrive (breath).** *Before anything, breathe. Be still and know.* One 4-4-4 cycle. (Skip available.)
- **Receive.** Setup: *Shame tells you you're defined by your worst moments. Here's what God says instead.*
  - *"There is now no condemnation for those who are in Christ Jesus."* — Romans 8:1, NIV
  - *"You are God's masterpiece, created anew in Christ Jesus."* — Ephesians 2:10, NLT
  - *"See what great love the Father has lavished on us, that we should be called children of God. And that is what we are."* — 1 John 3:1, NIV
- **Confess.** *I confess I've believed the lie that I am what I did. I've let my failures tell me who I am.* (Tap: I've believed this.)
- **Repent.** *I turn from this lie. I come out of agreement with shame.* (Tap to turn.)
- **Cast Off (exhale).** *In the name of Jesus, I cast off the lie that I am what I did. By His blood it has no hold on me.* (Guided exhale: breathe out the lie.)
- **Declare (inhale, speak).** Guided inhale, then three badges:
  - *I am God's beloved child.*
  - *I am not what I did. I am who He made me.*
  - *I am of great worth to my Father.*
  (Optional speak-aloud with waveform. Skip line: *Skip speaking, I'll read them.*)
- **Reflect.** *Where has shame been telling you who you are? Name it, and name what's true instead.* (Free text.)
- **Pray (seal).** *Father, thank You that You see me as Your beloved child, not as my failures. Let this sink past my thinking and into my bones. In Jesus' name.* Then the self-check: Does this feel true yet?
- **Action (optional).** *When the old accusation comes today, answer it out loud with one line: I am God's child.* (Skip available.)

Use Day 1 as the real content and the pattern for the rest.

---

## 16. Build order for the designer
1. Brand tokens and the dark cinematic shell for the Journey surface, plus the atmosphere pass (Section 4)
2. Journey home (active resume) as the pattern screen, with the Vine at a mid-stage
3. The breath ring component (Section 8), since it recurs through the ritual
4. The day ritual, all nine movements (Section 6)
5. Day complete, including the fruit-bloom moment
6. Journey complete, with the before-and-after reveal and the share card
7. Account gate, reset confirm, empty state, history
8. Reminder control, self-check states, and all reduced-motion and accessibility passes

Keep the live `main` site untouched. Build on a branch with a preview URL.
