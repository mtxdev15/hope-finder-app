# Claude Design Prompt — Build the Journey Section for Declare (v2)

You are my senior product designer and frontend builder. Build the **Journey section** of Declare, a faith-based app that helps Christians renew their minds through Scripture, prayer, and spoken declarations. The attached file, **declare-journey-section-brief.md**, is the source of truth. Follow it exactly. This prompt orients you and enforces the non-negotiables. When this prompt and the brief agree, follow the brief's detail. If anything here conflicts with the brief, ask before deviating.

We are **improving and extending** what already exists, not starting over. Keep our brand, our navigation, and the Declare flow as they are. Add a cinematic, breath-led daily ritual and a living Vine visualization to the Journey section.

## What you're building

Journey is where a person abides in Christ until a false identity is replaced by the true one God gives them, built on the Vine (John 15:5). The struggle a person names becomes the old branch that is pruned; the truth becomes a branch that grows and bears fruit. Each day is a short, guided, meditative ritual that moves them from the lie to the truth, using breath to arrive, to release, and to receive. Each completed day forms one named fruit on the tree. Every screen, state, the Vine, the day ritual, the breathwork, the copy, and the worked Day 1 example are in the brief. Build all of it. Audience is both men and women, so keep identity language inclusive (child of God, son or daughter, beloved).

## Scope

Build the **Journey section only**. Do not change the Declare composer, the results view, the Bible reader, Listen, You, or the navigation. The only touch outside Journey is adding a **Begin this Journey** button at the bottom of the existing results view, which routes into Journey with the struggle attached.

## Non-negotiables

- **Stay on brand.** Use the exact tokens in Section 3 of the brief: forest, gold, cream, with Cormorant Garamond for Scripture, declarations, and identity labels, and DM Sans for UI. Dark cinematic theme is the default, with a balanced light toggle. Do not import the prototype's olive, sandy gold, paper, or Inter. If I provide live dark tokens, match those.
- **Cinematic, atmospheric, calm.** Study Open and Superpower. Deep dark gradients, soft gold glow, one idea per screen, slow breathing motion, minimal chrome. Not busy, not gamified (Section 4).
- **The Vine, not a generic tree.** Jesus as the vine and root, the old branch dims and is pruned, the branch of truth grows and bears one named, tappable gold fruit per completed day. No literal apples or emoji, no percentage meter. Keep a day marker and a quiet streak line only (Section 5).
- **The daily ritual in this order:** Arrive (breath), Receive, Confess, Repent, Cast Off (exhale the lie), Declare (inhale the truth, optional speak-aloud with a skip line), Reflect, Pray with self-check, Action optional with a skip. One movement per screen (Section 6).
- **Breathwork like Open** (Section 8): an expanding and contracting ring with gold glow, default 4 in, 4 hold, 4 out, used to arrive and at the Cast Off and Declare hinge. Always optional with a skip, and a static reduced-motion version.
- **Preserve the existing card design language:** section cards, verse sub-cards with a gold left-border stripe, circular declaration badges, and a gradient prayer box.
- **Nav icon:** the thin-line Tree of Life mark from Section 4 of v1 already chosen, labeled Journey. Keep the bottom bar as built, Declare raised and gold in the center, bottom bar mobile only, Journey reached from the top nav on desktop.
- **One active Journey at a time.** Resume anytime. Choosing a new struggle resets the old incomplete one behind a gentle confirm and routes back to Declare (Section 10.8). The empty Journey tab routes to Declare. Journey never seeds itself.
- **Account gate sits at "Begin this Journey," never at results.** Build all auth states as UI; live wiring is a later backend pass, marked **[V2 wiring]** in the brief.
- **Length:** 7 days, adaptive. Completion is when the truth lands, read from the daily self-check, not when the calendar ends (Section 9).
- **Accessibility:** gold text on dark fails AA at small sizes, so reserve gold for large display, glow, and accents, and use cream for body and UI text. Tap targets ≥44px. Breath and speak-aloud always optional with skips. The Vine carries a text alternative. Reduced-motion path for every animation including the breath ring and the fruit bloom.
- **Voice:** warm, direct, pastoral, grounded, easy to read. Second person. Short sentences. No dashes joining sentences. Never use "To God be the glory" or any variant anywhere in this section.

## Build order

1. Brand tokens and the dark cinematic shell, plus the atmosphere pass
2. Journey home (active resume) as the pattern screen, with the Vine at a mid-stage
3. The breath ring component, since it recurs through the ritual
4. The day ritual, all nine movements
5. Day complete, including the fruit-bloom moment
6. Journey complete, with the before-and-after reveal and the share card
7. Account gate, reset confirm, empty state, history
8. Reminder control, self-check states, and all reduced-motion and accessibility passes

## Responsive

Mobile-first, then tablet, then desktop. The day ritual is full-screen stepped on mobile and a centered ~640px focus column on desktop, never multi-column. The work must feel the same and unhurried on every device.

## Safety

Build on a branch with a preview URL. Do not touch the live `main` site. Use the worked Day 1 of "Shame → Beloved Child" in Section 15 as real content and as the pattern for the rest.

Start by confirming your understanding and your plan for the Journey home (Section 10.3) as the pattern screen, then build that one screen first for my review before going further.
