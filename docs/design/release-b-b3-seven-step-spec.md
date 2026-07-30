# Release B: B3.1 Seven-Step Journey Design Specification

*Companion to `docs/design/release-b-b3-seven-step-audit.md` (current-system findings) and the prototype
at `docs/design/prototypes/release-b-b3-seven-step/`. This document specifies the proposed design. It
does not describe production `journey.astro` today.*

---

## Shared shell anatomy

Every step uses one shell (`.ritual`, containing `.ritual-back` plus `.shell`):

1. **Top bar** (`.rtop`): left side shows `Day N of 5` context text (**corrected, see "Top bar and content
   head correction" below**, previously `Day N of 5 · Step N of 7`). Right side shows Help (heart icon,
   opens the support drawer) and Close (X). No back arrow here; back lives in the footer (see below).
2. **7-dot progress rail** (`.rprog`): quiet, small (12×4px dots, current dot widens to 18px), gold for
   done/current, low-opacity neutral for upcoming. Never a percentage, never a number count beyond the
   text context line above it.
3. **Content head** (`.rhead`): step title (Cormorant Garamond), one supporting instruction line. **No
   longer includes a leaf glyph** (**corrected, see below**; previously the exact SVG path used in
   `journey.astro`'s `.jo-leaf` and Day-Opening).
4. **Main content**, which varies per step (Scripture card, prayer card, lie/truth contrast, breath ring,
   declaration card, reflection field, action card). Always one visual "block," never a dense stack of
   equally-weighted cards.
5. **Footer actions** (`.ractions`): one primary action (gold pill, full width), one quiet text-link
   "Back" beneath it (steps 2 through 7 only; step 1 has nothing to go back to within the ritual).

Background: the real generated forest photograph (see "Personalized per-day backgrounds" below) with a
scrim gradient baked in, not the flat `--bgfield` gradient. **Corrected in the B3.1A pass:** the scrim is
now theme-dependent (`--day-scrim`, swapped per `html[data-theme]`) rather than a single fixed dark
gradient. See "Light and Dark Theme System" below. The photo itself is identical in both themes; only the
CSS overlay changes, so no second image set was generated.

## Responsive rules

- **Mobile (<768px):** `.shell` *is* the full-bleed surface. No card chrome, no backdrop dimming (there
  is nothing behind it to dim). Safe-area padding on top/bottom.
- **Tablet/Desktop (≥768px):** `.ritual-back` becomes a dimmed, blurred scrim (`--modal-scrim`,
  `backdrop-filter: blur(10px)`); `.shell` becomes a centered card, `max-width: 620px` (tablet) /
  `660px` (≥1024px), rounded 24px, bordered, `box-shadow: var(--card-shadow)`. Same responsive shape as
  the account modal (`auth-modal.js`) and B2.2's Day-Opening screen, a consistent, established pattern,
  not invented fresh for B3.
- **Short-height mobile (390×667-class):** content scrolls inside `.rscroll` (`overflow-y:auto`); the
  footer stays pinned via normal flex flow (`flex:0 0 auto`), never covered.
- No stretched-phone tablet layout: `.lt-grid` (lie/truth) goes side-by-side at ≥480px, not just at
  desktop widths, so tablet reads as intentionally designed, not a scaled-up phone screen.

## Typography hierarchy

- Step title: Cormorant Garamond, 28px on mobile, 32px at ≥768px, 34px at ≥1024px, weight 600.
- Scripture/prayer/declaration body text: Cormorant Garamond italic, 16 to 24px depending on block, never
  smaller than the surrounding DM Sans body copy.
- UI chrome (day/step context, eyebrow labels, button labels): DM Sans, 10 to 15px.
- No more than 2 type families anywhere on screen (matches the rest of the app).

## Button hierarchy

Exactly one primary action per step (gold pill, `.rbtn-primary`), exactly one secondary (quiet text
link, `.rbtn-back`, muted color, no border/fill). In-step confirmation controls (Cast Off / Declare / Act
checkboxes) are a third, visually distinct tier, bordered rows, not pill buttons, so they never compete
with the step's actual primary action for attention. Never more than one gold-filled control visible at
once.

**Two real defects found and fixed live during this pass, referenced against premium single-quote-plus-
CTA screens (`pillowtalk`, `Ahead`, `stoic.` via Mobbin) rather than guessed at:**

1. **Dead space between content and CTA.** The primary button was a separate `flex:0 0 auto` footer
   pinned to the bottom of the shell, while the content above it was a separately-centered block. On
   short-content steps (Receive, Pray) this left a large, unintentional-looking void between the
   instruction line and the button. Fixed by moving `.ractions` to flow *inside* `.rscroll`, as the last
   item in the same content group, so short content and its CTA center together as one unit (matching how
   `pillowtalk`/`Ahead`/`stoic.` all center short quote content in the full available height rather than
   clustering it at the top). A second, related bug: `.rscroll` never actually had `justify-content:
   center` set at all in this prototype (a value I'd incorrectly assumed carried over from B2.2's
   `.jo-scroll` but never actually added here), so content was plain top-aligned block flow the whole
   time. Both fixed together; verified content still scrolls correctly (not clipped) on long-content steps
   (Reflect with long text) via `safe center`, the same overflow-safe technique already proven for B2.2's
   200%-zoom fix.
2. **Flat, unconvincing button fill.** `.rbtn-primary` was a single flat `var(--cta)` color with a plain
   drop shadow. Replaced with a real linear gradient between the existing `--goldd`/`--gold` tokens plus
   an inset highlight/shadow pair (pressed-metal depth, not a new visual language), and added deliberate
   hover/active states, still only the existing gold palette, no new colors.

## Progress treatment

**Corrected during live design review.** The visible top-bar text now reads only `Day N of 5`; it no
longer spells out `Step N of 7`. The full `Day N of 5, Step N of 7` string still exists, but as a visually
hidden (`.sr-only`) span read by screen readers only, so the dot rail's still-`aria-hidden` visual position
information keeps a real textual equivalent for assistive tech, exactly as the original "text is the
accessible source of truth" rule required; only what sighted users see changed, not what is actually
communicated. No percentage anywhere. No "X of Y completed" badge styling that could read as gamified
progress.

**Why:** live review of the rendered mockups found `Day N of 5 · Step N of 7` read like a checkout-wizard
or form-progress indicator, at odds with the unhurried, contemplative tone the rest of this design
(and B2.2 before it) establishes. Contemplative reference apps were checked directly: Headspace and Calm
show session progress ambiently (a thin bar or remaining time, no literal "step X of Y" text); Duolingo-
style explicit step-counters belong to gamified learning flows, not reflection. The dot rail already
carried step position quietly for sighted users; the redundant text label was the part actually causing
the checklist feeling, so it was removed rather than the dots themselves.

## Top bar and content head correction

Two related corrections made in the same live review pass, both about removing UI elements that were
communicating information in a colder register than the rest of the ritual, without losing any of that
information for anyone:

- **Step-count text removed from the visible top bar** (see "Progress treatment" above for the full
  rationale and the accessibility-preserving `.sr-only` mechanism).
- **The leaf glyph above every step's title was removed entirely**, from all seven steps. In live review
  it read as an unexplained decorative mark rather than a meaningful indicator; unlike the leaf glyph's
  other real uses in the app (`journey.astro`'s `.jo-leaf`, the Day-Opening screen, and the Vine imagery
  it echoes, all of which carry actual growth/progress meaning tied to visible plant artwork elsewhere on
  those screens), a small isolated leaf floating above a step title here had no connection to anything else
  on screen and added visual noise without adding meaning. The step title (Cormorant Garamond) and
  supporting instruction line now form the entire content head on their own.

Both corrections are implemented in the prototype (`index.html`'s `.rhead` no longer contains a `.rleaf`
span on any of the 7 steps; `prototype.js`'s `renderTop()` writes the short label to the visible
`#rTopCtx` and the full label to the new `#rTopCtxSR` `.sr-only` span) and reflected in every mockup
re-rendered after this correction.

## Support placement

A single heart-icon control, top-right, 44×44px, `aria-label="Need help? Talk to someone now"`. States:
resting (default), focused (visible gold outline on keyboard focus), open (bottom sheet on mobile,
centered dialog ≥600px, same responsive shape as every other overlay in this file family). Content is
the **real** `/crisis` page's resource list verbatim (988 call/text, 911, Crisis Text Line, care team
email). No invented categories, no new hotlines. Closing returns focus to the control that opened it and
the user remains on the exact same step underneath (the drawer is an overlay, not a navigation).

## Reflection states (Step 6): CORRECTED in B3.1A

> **This section originally recommended device-local-only storage, "Saved locally on this device" as the
> final state, and content never sent for AI processing. That recommendation has been superseded. It did
> not match the approved product direction. The corrected model is documented in the new "Step 6 Approved
> Product Model" section and its sub-sections immediately below.** The original recommendation is struck
> through in spirit, not preserved verbatim, because carrying the wrong copy forward risked it being
> implemented by mistake; the audit document (which describes *today's* production behavior, a plain,
> unpersisted textarea) is unaffected and remains accurate.

Empty, then Typing (draft protection), then Draft saved, then Save Reflection, then Saved to Vault, then
optional gentle guidance, then Consent, then Loading, then Response or Error, then Continue.
Full detail, exact copy, button states, and the underlying Vault/AI architecture reality are specified in
the sections below.

## Step 6 Approved Product Model

Three distinct concepts, never conflated in copy, state, or UI:

1. **Temporary draft persistence.** Protects text while typing, from loss only (tab close, accidental
   navigation, app kill). Communicated as "Draft saved." Never implies permanence or Vault storage.
2. **Intentional Vault save.** A deliberate, user-triggered action ("Save Reflection") that writes the
   completed reflection to Vault, associated with the signed-in user, the Journey, the struggle, the day,
   the date, and the reflection prompt. Communicated as "Saved to Vault." This is the durable destination,
   the only one the product promises long-term.
3. **Optional guidance.** After a reflection is saved to Vault, the user may explicitly choose to receive
   a short, personal response prepared with the help of AI. It never triggers automatically: not while
   typing, not on save, only on an explicit "Receive Guidance" tap followed by explicit consent.

**Approved flow:** Open Reflect, begin typing, local draft autosaves ("Draft saved"), Save Reflection,
reflection saved to Vault, optional "Receive Guidance," consent, loading, response, Continue. A
user may also move directly from the saved-to-Vault state to Step 7 without ever touching guidance. This is
a first-class path, not a "decline," and there is deliberately no "Continue Without AI" button anywhere
(that wording was explicitly rejected; the interface never frames guidance as a required choice the user
must actively decline).

**Approved button model** (see "Button hierarchy" above for the shell-wide rules this extends):

| Reflect state | Primary (`.rbtn-primary`) | Secondary (`.rbtn-secondary`) |
|---|---|---|
| Empty / Typing / Draft restored | Save Reflection | none |
| Saving to Vault | Saving... (disabled) | none |
| Saved to Vault | **Continue** | Receive Guidance |
| Consent sheet open | Yes, Receive Guidance | Cancel (returns to Saved to Vault) |
| Preparing guidance | Preparing guidance... (disabled) | Cancel (small text link inside the loading card, not the footer) |
| Guidance response | **Continue** | Reflect More (returns to Saved to Vault, reflection untouched) |
| Guidance unavailable / connection failed | **Continue** | Try Again |
| Crisis-language route (underlying Step 6 footer, dimmed beneath the support sheet) | Continue | none |

Continue is always the visually stronger, filled pill in every state above it. Guidance-related
actions are always the outlined, quieter secondary, so guidance feels available, never required.

**Correction (final B3.1A review):** the crisis-route row above was originally presented as if simply
tapping "Continue" were the primary control a user sees and acts on in that state, the same as every other
row in this table. That was misleading. The crisis route is a **two-layer** state, not a single screen:

1. **Background layer.** The Step 6 shell underneath still technically shows "Continue" as its
   footer button, dimmed by the support sheet's scrim, exactly as it would be for any other open overlay
   in this design (matching the existing `.support-scrim`/`.support-sheet` pattern used everywhere else).
2. **Foreground layer, and the one that actually matters in this state.** The real support sheet opens
   automatically on top and becomes the active, focus-trapped surface: Call 988, Text 988, Call 911, and
   Email our care team, each a genuinely distinct tappable control, plus the sheet's own Close button.
   These, not "Continue," are the controls a user in this state actually sees and can reach
   first. "Continue" is not reachable at all until the user closes the support sheet.

The corrected framing: **in the crisis-language route, ordinary continuation never visually competes with,
or is presented as equivalent to, urgent support.** The support sheet's real resources are the dominant,
immediate controls; "Continue" only becomes active again after the user closes support and
returns to the same Step 6 state, reflection intact. See "Crisis-Language Behavior" above for the full
five-step sequencing this table row summarizes.

## Vault Storage Reality

Real repository audit (`convex/schema.ts`, `convex/vault.ts`, `src/app/declare/vault-store.js`,
`src/pages/vault.astro`, `convex/auth.ts`), read directly, not assumed from the name "Vault":

- **Storage mechanism:** hybrid, local-first with a best-effort cloud mirror. Not purely local, not
  purely cloud. `vault-store.js` always reads/writes `localStorage` (`declare-vault-v1`) first, as the
  instant cache and the entire store for guests. If the user is signed in and Convex is configured, every
  write also mirrors to Convex (fire-and-forget, one retry, fails soft). On sign-in, `syncDown()` uploads
  any local guest items once, then pulls the server's items and makes them authoritative locally.
- **Authentication:** Better Auth (`convex/auth.ts`), email+password or Google OAuth. `convex/vault.ts`'s
  `requireUserId()` hard-gates every Convex query/mutation server-side. On the client, saving does **not**
  require sign-in to work at all. It always succeeds to `localStorage` regardless of auth state. Journey's
  existing two Vault-save buttons use `ensureSignedIn()` to prompt for an account first (toast: "Create a
  free account to save these verses to your Vault"); other Vault writers (`word.astro`, `today.astro`) save
  directly without that gate.
- **Current item types:** `type: 'word' | 'verse' | 'declaration' | 'prayer'`, an unvalidated `v.string()`
  discriminator, not a strict schema union. Journey's only existing Vault write today (`vaultSaveAll()`) is
  a `type: 'word'` bundle of verses/declarations/final prayer. **Never** free-text reflection.
- **Does a Journey reflection item type already exist? No.** The real Step 6 textarea in `journey.astro`
  has no `id`, no event listener, and is never read, stored, or sent anywhere, confirmed by a full-file
  grep. Whatever a user types today is discarded on the next render or reload.
- **Would a schema change be needed? Yes, but a modest, additive one.** A new `type: 'journeyReflection'`
  string value (no migration required, since `type` is unvalidated) plus new optional fields
  (`journeyId`/struggle key, `day`, prompt, and the reflection text itself, likely a new field rather than
  reusing `text`, which already means "verse passage text" elsewhere in the schema) added to `vaultItems`,
  mirrored in `itemArgs`/`toPayload()`. Not a new storage architecture, new auth system, or new sync
  mechanism.
- **Cross-device availability:** yes, for a signed-in user, through the same Convex mirror/sync every other
  Vault item already uses. Eventually consistent (a device syncs on sign-in/load, not live/real-time,
  since `convex-data.js` uses a one-shot `ConvexHttpClient`, not reactive subscriptions). Important nuance:
  Journey's own per-day progress (`db_journey_inst:<id>`) is deliberately **not** account-synced today
  ("kept local to avoid bloat"). A reflection only follows the user's account because it is written
  straight into `vaultItems` via `saveItem`, not because it rides along on Journey's own sync keys.
- **Deletion and privacy:** delete is already wired (`/vault`'s delete button calls `removeItem()`, which
  deletes locally plus a Convex `remove` mutation by `(userId, clientId)`). There is **no** sharing/public-
  visibility concept anywhere in `vaultItems` or `vaultCollections`. Every row is strictly scoped to its
  owner via a `by_user` index. Reflections would be private-by-default automatically, with zero new privacy
  plumbing needed, consistent with everything else already in Vault.
- **Readiness assessment:** the Vault backend is well-positioned for a straightforward, additive extension.
  The real gap is not Vault's architecture. It's that the reflection text does not exist as data anywhere
  yet. Wiring the textarea to state and a `saveItem({...type:'journeyReflection'})` call is net-new
  application logic, not a hookup to something already working.

**Product language vs. technical reality, stated plainly:** "Saved to Vault" is accurate to say today for
a signed-in user (their reflection would genuinely reach Convex, like every other Vault item) and is
*locally* true even for a guest (their reflection is genuinely retained in `localStorage` until they sign
in or clear site data), but a guest's reflection does **not** cross devices or survive a cleared browser
until an account exists. The design does not promise cross-device availability before sign-in. It inherits
Vault's existing, already-shipped `ensureSignedIn()` gate pattern from Journey's other two save actions
(see "Step 6 Production Dependencies" below), so the same honest framing already used elsewhere in Journey
carries over here.

## Temporary Draft Model

- Triggered by typing (debounced, about 700ms of inactivity, matching the existing prototype's debounce
  feel).
- UI copy: **"Draft saved"** while active; supporting copy where space allows: "We're keeping your
  reflection safe while you write." Before the debounce lands (mid-keystroke), the status area shows the
  same protective copy without yet claiming "saved." Never a bare "Saving..." spinner in the persistent
  status row (that reads as a network operation, which this design-only draft mechanism is not intended to
  be).
- Never says "Saved to Vault." Never says "Saved locally on this device" as if that were the final state.
  That exact phrase is retired from all user-facing copy (see "Storage wording rules" precedent in the
  original task and the corrected copy throughout this document); it may still appear in *technical*
  documentation (like this section) describing the underlying mechanism.
- **Mechanism (proposed for B3 production):** device/browser-level storage (e.g. `localStorage`, scoped
  per Journey instance/day), mirroring the same honest, unsynced framing Journey already uses for its own
  per-day `dayState`. Not Vault. Not Convex. Not cross-device.
- **Draft Restored:** on return to a step with an existing unsaved draft, a dismissible banner reads
  **"Draft restored"** with supporting copy **"We restored what you were writing."** and a "View" action
  that scrolls/focuses the field. This is a continuation of the same draft, never a second, competing copy
  of it.

## Final Vault Save Model

- Triggered only by the explicit **"Save Reflection"** primary action. Never automatically, never on
  blur, never on navigation away.
- Saving is a brief, visible async state (a simple centered card: spinner plus "Saving your reflection to
  Vault...") rather than an instant, unexplained jump, consistent with this being a real write, not a local
  debounce.
- On success: **"Saved to Vault"** with supporting copy **"You can revisit this reflection anytime in
  Vault."** and a "View in Vault" link demonstrating the real entry point into the existing Vault surface.
  The reflection is shown read-back (quoted) so the user can confirm what was captured.
- Association captured at save time (per the Vault Storage Reality section): authenticated user (via the
  existing `ensureSignedIn()` gate), Journey/struggle, day, date, and the exact reflection prompt shown.
  Every field the approved product model requires already has a natural home in Vault's existing
  `vaultItems` shape plus the modest additive fields described above.
- The draft and the saved Vault reflection are never visually or semantically the same element. The
  writing view and the saved view are two distinct panels (`#reflectViewWriting` vs. `#reflectViewSaved` in
  the prototype), so a user can never mistake "Draft saved" for "Saved to Vault."

## Optional AI Guidance Model

*(Referred to in-product as "Gentle Guidance." See the note on terminology at the end of this section.)*

- Only reachable from the Saved-to-Vault state, via the secondary **"Receive Guidance"** action. Never
  presented before a reflection is saved, never automatic.
- Selecting it opens a consent step (mobile: bottom sheet; desktop: centered dialog; the same
  `.support-sheet` component pattern already used for the crisis/help drawer, not a new overlay language).
- Consent copy states plainly, briefly, and without legal/technical jargon: the saved reflection will be
  used to prepare a response; the request is optional; this is not God speaking directly; the user stays
  in control. See exact copy in "AI Consent and Privacy" below.
- Only on explicit **"Yes, Receive Guidance"** does any reflection content leave the device for processing.
  **"Cancel"** returns to the Saved-to-Vault state with zero side effects.
- Loading is a distinct, visible state ("Preparing your guidance...") with its own small "Cancel" action.
  Cancelling returns to Saved-to-Vault, reflection untouched, no partial/broken state left behind.
- The response is clearly labeled, hierarchically structured (see "AI Guidance Content Rules"), and always
  offers **"Continue"** as the visually primary action, with **"Reflect More"** as a secondary
  that returns to the existing saved reflection. It never deletes or overwrites it.
- **On terminology:** the original working label for this feature was "AI Guidance," used as a literal
  UI badge on the response card. That label was corrected mid-review to **"Gentle Guidance,"** warmer,
  more welcoming, and more consistent with the app's pastoral voice than a clinical "AI" badge. The
  underlying disclosure that the response is AI-assisted (not God speaking, not a human pastor) is
  preserved. It now lives in the response's closing reassurance line, reworded during the same review to
  read as pastoral counsel rather than a tech disclaimer: "This was gently prepared to point you back to
  Scripture. It isn't God speaking directly, so hold it loosely, test it against His Word, and let the
  Spirit lead you from here." Internal state names in the prototype (`ai-response`, `ai-loading`, etc.) are
  implementation identifiers only and were not changed; no user-visible copy anywhere in the prototype uses
  the literal string "AI Guidance" after this correction.

## AI Consent and Privacy

Exact consent copy used in the prototype (`#aiConsentSheet`):

> **Receive Guidance?**
> Your saved reflection will be gently prepared into a short, personal response. This is entirely
> optional. It's shaped with the help of AI, not God speaking directly, and you decide if you want to
> receive it.
>
> **[ Yes, Receive Guidance ]** **[ Cancel ]**

This satisfies all four required elements in one short paragraph: the saved reflection will be used to
prepare guidance; the request is optional; it is not God speaking directly; the user remains in control.
No fear-based, legalistic, or technical language (no "data processing," no "third-party servers," no
liability framing), consistent with the app's pastoral voice throughout the rest of Journey.

## AI Guidance Content Rules

Required visible structure, top to bottom (implemented in `.ai-response-card`):

1. **Label.** A small, quiet eyebrow ("Gentle Guidance," gold dot plus text) identifying the block as a
   distinct, generated response, not Scripture, not the user's own words.
2. **Pastoral acknowledgement.** One or two sentences receiving what the user wrote, without judgment.
3. **Scripture.** Visually distinct: indented, left gold-rule border, tinted background block, italic
   Cormorant Garamond, with a real reference. In this prototype: Psalm 34:18, ESV ("The LORD is near to
   the brokenhearted and saves the crushed in spirit."), the exact same translation and typographic
   treatment already used for Step 1's Receive verse, so Scripture always reads as Scripture regardless of
   which part of the ritual it appears in. **Never** a paraphrase presented as a direct quotation, and
   never a fabricated reference. Production must source this from the app's real Bible data layer
   (`word.astro`'s reader / api.bible proxy), not from the language model's own recall, exactly as the
   audit found the rest of the app already treats Scripture as authored/sourced content, not generated
   content.
4. **Short explanation.** Plain-language bridge between the Scripture and the user's reflection.
5. **One practical next step.** Small, concrete, non-prescriptive.
6. **One gentle reflection question**, where appropriate. Italic, inviting further reflection rather than
   closing the topic.
7. **Continue action.** Always present, always the visually primary control.

**Explicit content rules** (must be enforced in the real system prompt authored for this feature, not
assumed from the existing Haiku/Sonnet prompts; see "AI Guidance Integration Reality"): must not claim to
be God speaking, must not claim revelation/prophecy/certainty, must not diagnose mental-health conditions,
must not promise outcomes, must not shame the user, must not override Scripture, must not fabricate
Scripture, must not pressure continued AI use, and must never be the sole crisis response (see next
section). The reassurance line, **"This was gently prepared to point you back to Scripture. It isn't God
speaking directly, so hold it loosely, test it against His Word, and let the Spirit lead you from here,"**
is present on every response, deliberately small and quiet (11px, muted color, separated by a thin rule)
rather than a bold warning box, per the instruction to avoid making it visually alarming or dominant, and
worded as pastoral counsel (echoing 1 Thessalonians 5:21, "test everything") rather than a clinical AI
disclaimer.

## AI Guidance Integration Reality

Real repository audit (`worker/src/index.js`, `src/app/declare/declare-api.js`,
`public/declare/journey-engine.js`, `declare-and-believe-system-prompt.md`), read directly:

- **One Worker, path-routed.** `hope-finder-worker.thinktoro.workers.dev`'s root path is a content-blind
  Anthropic Messages API passthrough (`request.text()`, forwarded as-is to `api.anthropic.com/v1/messages`,
  streaming the response body back). It does zero shape/schema validation.
- **What can be reused as-is:** the root-path proxy already accepts arbitrary `model`/`system`/`messages`/
  `stream`/`temperature`/`max_tokens` combinations with **zero Worker code changes.** Journey's existing
  day-generation call (Sonnet, non-streamed, no `system` field) already coexists on this same endpoint
  alongside the instant response (Haiku, streamed, cached system prompt). A "reflection guidance" call
  could be built as a third variant of the same pattern: new prompt, same URL, same anonymous IP rate
  limited pipeline (10 req/IP/min, shared across all traffic on that path, with no per-feature isolation
  today). The defensive `{`…`}` JSON-extraction pattern and Journey's "fall back to safe authored
  content on failure, don't retry in a loop" UX precedent are both directly reusable.
- **Sensitivity precedent, not a new category.** The instant-response flow already sends user-typed,
  potentially crisis-adjacent struggle descriptions through this exact anonymous pipeline today (the Haiku
  system prompt has an explicit instruction to lead with compassion and mention 988 for suicidal
  ideation/self-harm disclosures). Reflection text is a continuation of that same sensitivity tier, not a
  new one, but see the gap below.
- **What requires new work** (buildable in a future design/implementation phase, not this design-only
  pass): a dedicated system/user prompt for "gentle response to a saved reflection" (neither existing
  prompt is fit for purpose, both are struggle-*intake*-shaped, not reflection-*response*-shaped), and,
  critically, **a crisis-detection instruction for that new prompt.** The Sonnet/Journey prompt family has
  **no** crisis instruction at all today (confirmed by grep); even the Haiku instruction that does exist is
  soft, unenforced guidance to the model, not a server-side check. This cannot be copied from an existing
  prompt. It must be authored fresh for this feature.
- **What requires an actual, later-approved change to the protected `worker/` code** (out of scope for
  B3.1A): any server-side crisis keyword detection or content moderation before forwarding to Anthropic
  (none exists for any path today); a dedicated route (e.g. `/reflect`) if isolated rate limiting, logging,
  or validation separate from the shared root-path budget is wanted; any authentication/identity
  requirement on the AI call itself (today it is fully anonymous, IP-only; tying a guidance request to a
  signed-in user's identity, for abuse prevention or audit, is not wired into the AI-proxy path anywhere
  today); any server-side payload size/length validation (the Worker forwards the raw body with no size
  check today, unlike e.g. `/bible/search`'s explicit length guard).
- **Failure precedent already established:** Journey's day-generation has a 20s client timeout and falls
  back silently to safe, pre-authored content on any failure, a real, working pattern this feature should
  follow in spirit, except **visibly** rather than silently. The user should see "Guidance isn't available
  right now" rather than nothing changing, since, unlike a devotional day falling back to authored
  content, a reflection-guidance request is something the user explicitly asked for and is waiting on.

## Crisis-Language Behavior

The audit found **no** in-ritual crisis control in the real seven-step flow today, and **no** server-side
crisis detection anywhere in the Worker for any path. Crisis handling today is entirely a soft, model-side
instruction (Haiku prompt only) plus the always-available static `/crisis` page. Proposed behavior for
reflection text that reads as crisis/self-harm language, in strict order:

1. **Preserve the reflection.** The Save Reflection to Saved-to-Vault flow completes exactly as normal.
   Nothing about detecting crisis language should block or alter the save itself.
2. **Surface the existing support experience**, not a new one. The prototype's crisis-route state shows a
   brief, calm note ("Your reflection is safely saved. Before anything else, let's get you connected with
   support.") and then opens the **real** support drawer, the exact same component and exact same content
   (988 call/text, 911, Crisis Text Line, care team email) as every other support entry point in this
   design, sourced verbatim from `src/pages/crisis.astro`. No new hotline, resource name, or category is
   invented anywhere in this pass.
3. **Keep Journey state intact.** The user is never removed from Day N, never loses progress, and can
   still reach Step 7 normally once ready.
4. **Never show a normal pastoral response before the safety path is addressed.** In this design, the
   crisis route replaces the guidance flow entirely for that reflection. It does not run guidance and
   *then* show support; support comes first and, in this pass, exclusively.
5. **Detection mechanism itself is out of scope for B3.1A.** This section documents the required
   *behavior*, not an implementation. Whether detection happens client-side (keyword heuristic, low
   confidence) or is added as an explicit instruction to the new reflection-guidance system prompt (see
   "AI Guidance Integration Reality") is a B3 production decision requiring its own safety/privacy review,
   not a design-prototype decision.
6. **Closing support returns to the exact same Step 6 state, not a different screen.** This matches how
   the support drawer already behaves from every other entry point in this design (the heart-icon help
   control), so crisis routing does not introduce a second, different "return" behavior to maintain.
   This is also a distinct mechanism from the existing pre-Journey sensitive-struggle care gate
   (`#careSheet`, shown once before a Journey begins, per the audit's §8) and does not duplicate or
   replace it; the care gate and this in-ritual crisis route serve different moments and both remain.

## AI Failure and Recovery

| Condition | Heading | Body | Actions |
|---|---|---|---|
| Guidance service unavailable | "Guidance isn't available right now." | "Your reflection is safely saved in Vault." | Try Again, Continue |
| Connection failure | "We couldn't connect." | "Your reflection is still saved in Vault." | Try Again, Continue |
| Request cancelled (mid-loading) | *(no error screen, silently returns)* | none | Returns directly to Saved-to-Vault; reflection untouched |

Every failure path reiterates that the reflection itself is safe. It never implies data loss, never asks
the user to retype anything. "Try Again" re-enters the loading state (a fresh request); it never resubmits
a stale/cached failed response. A completed guidance response is **not** implied to be saved anywhere
beyond the current session/state unless a future, explicitly approved data-model change adds that. This
prototype does not claim guidance text is stored in Vault alongside the reflection, because the
architecture audit above did not confirm that it will be.

## Duplicate and Conflict Prevention

- **Update, not duplicate, on re-save.** Vault's existing `clientId`-based upsert
  (`by_user_and_client` index in `convex/vault.ts`) already gives idempotent save/update semantics for
  free. A reflection keyed by a deterministic `clientId` (e.g. derived from journey instance plus day) can
  be saved again without ever creating a second row. This is an existing, proven mechanism, not new
  infrastructure.
- **Saved-reflection restore.** Returning to a step whose reflection is already saved shows the saved
  view directly (quoted text plus "Saved to Vault"), not the empty/writing view. Editing, if the product
  wants to allow it later, would re-use the same upsert path rather than creating a new item.
  Editability itself is **not decided in this pass**, flagged as a production decision, not assumed.
- **Draft vs. Vault conflict** (a saved Vault reflection exists *and* a newer unsaved local draft also
  exists, e.g. the user saved, then reopened the step and started typing again without saving): the
  prototype includes a calm recovery card (`window.__proto.showDraftConflict()`) offering **"Review My
  Draft"** or **"Keep My Saved Reflection."** Neither choice silently overwrites the other. Under the
  proposed data model this should be a rare edge case (draft and Vault-saved reflection normally represent
  the same field, not two independent ones), but the design does not assume it cannot happen, so a
  non-destructive resolution path exists rather than leaving it undefined.

## Mobile, Tablet, and Desktop Step 6 Behavior

- **Mobile:** the reflect field receives the most available vertical space; the draft-status row stays
  visible but subtle (small text plus icon, never a banner); the primary action remains reachable without
  obscuring the field when the keyboard is open (verified in the mobile keyboard-open mockup); AI consent
  uses the same bottom-sheet pattern as the support drawer.
  Continue is always reachable by scrolling. `justify-content: safe center` never traps content
  off-screen.
- **Tablet:** the ritual uses the same centered card as every other step (not a stretched phone layout);
  the reflect field and the guidance response both get a comfortable, contained reading width; portrait and
  landscape are both represented in the mockup set.
- **Desktop:** a focused, centered ritual surface over the dimmed real app (same pattern as every other
  step); reflection and guidance are **not** placed in two competing side-by-side panels. Guidance
  replaces the writing view in the same single column once requested, exactly as on mobile/tablet, so
  there is never a moment where an unsaved draft and generated guidance compete for attention in separate
  panes. Keyboard navigation and comfortable reading width (measured line length on the Scripture block and
  prose) are preserved at both required desktop widths.

## Step 6 Production Dependencies

What a real B3 implementation of this design would require, not built or started in this design-only pass:

- **Vault schema work:** new `type: 'journeyReflection'` value (no migration needed) plus new optional
  fields on `vaultItems` (journey/struggle key, day, prompt, reflection text) and matching updates to
  `itemArgs`/`toPayload()` in `convex/vault.ts` / `vault-store.js`; optionally a new `vaultCollections.kind`
  value if reflections should auto-group.
- **Wiring the real Step 6 textarea to state.** Today it is fully inert. This is net-new application
  logic (draft debounce, save handler, `ensureSignedIn()` gate reuse), not a hookup to existing code.
- **A new, dedicated system/user prompt** for reflection guidance, including an explicit crisis-language
  instruction authored fresh (cannot be copied from either existing prompt).
- **A privacy/safety review** of sending user reflection text to the AI Worker, even though it reuses an
  existing anonymous pipeline that already carries comparably sensitive content. The review should
  specifically cover the crisis-detection approach and whether identity-tied logging/rate-limiting is
  warranted.
- **A decision on Worker-side scope:** reuse the shared root-path endpoint as-is (zero Worker changes) or
  add a dedicated route for isolation. Both are viable; this document does not decide it.
- **Localization:** every new string in this design (draft/save/guidance copy, consent, errors) needs
  Spanish equivalents added to `i18n-strings.js`, matching the existing `journey.dayOpen*` key pattern.
  Not started here.
- **Migration considerations:** none required for existing Vault data (purely additive fields/type). The
  real Step 6 textarea has never persisted anything, so there is no legacy reflection data to migrate.
- **Scripture follow-through:** the deep-link and dashboard resume-card feature for the guidance response's
  "next step" (see "Scripture Follow-Through" below) needs its own small piece of state (which reference is
  outstanding, whether it has been read) and a lightweight return affordance in the Bible reader.

## Breath states (Step 4)

Real contract only (see audit doc §4): Ready (`journey.astro`'s own idle UI, not a `BreathRing` phase),
then Inhale (4s, "Breathe in mercy"), then Hold (2s), then Exhale (6s, "Release the old"), then Complete
(two real distinct completion texts: breathed-through vs. skipped), then Reduced motion (same real timing,
transitions instant, no alternate "gentle pulse" mode invented). **Round count is 1, not the real
production 3,** an explicit decision made live during this review (see audit doc §4 addendum); carry this
into the B3 production implementation prompt as an approved change to `BREATH_ROUNDS`.

**Elevated treatment (added during this pass, referenced against the "Open" app's session-start
breathing screen, Mobbin/local reference, not copied wholesale):** the glow is now a full-bleed,
atmospheric radial field (not a small bounded ring widget), and the shell's own chrome (top bar, progress
dots) recedes to 35% opacity while a breath phase is actively running, restoring at Ready/Complete. The
moment reads as a spacious pause rather than a UI component. Explicitly **not** adopted from that
reference: its audio scrubber/media controls (we have no audio), its circular dot loading constellation
(unclear purpose, not needed here), and, most importantly, its streak/"Congratulations, Sam"/Share
completion screen, which directly conflicts with this project's explicit no-gamification, no-achievement-
language brand rule and was not used anywhere in this design.

## Resume behavior

A card (not a full takeover) stating the current day, the step being resumed by name (not a numeric
fraction, e.g. "Cast Off the Lie · where you left off," not "Step 3 of 7 · where you left off"), and a
visual progress bar (a plain fill, no percentage text), with "Resume Day N" as the one primary action and
a plain "Close" secondary. **Corrected in the same live review as the top-bar/leaf/button pass:** this card
originally showed the literal `Step N of 7` fraction, missed in the first correction pass because it lives
in a separate overlay component, not the shared `.rtop` header; the same rationale applies here, so it was
brought into line rather than left as an inconsistent exception. Reflection content, if any was saved on
the target step, restores automatically (no separate resume-specific reflection UI). No "start over" action
exists anywhere in this design. The real product has no such feature to represent, and none should be
invented.

## Review-only behavior

A visible, unmissable badge, "Reviewing a completed day, read only," at the top of the content area.
Every interactive control in the step body is visually inert (`pointer-events:none`, reduced opacity).
The footer's primary action is fully replaced by a single "Back to Today." There is no completion
button, no way to re-trigger any gate, and (per the audit) opening a review never shows the Day-Opening
screen and never mutates `db_active_journey`.

## Personalized per-day backgrounds

**Classification: separate asset-production workstream, not a requirement for initial B3 production.** The
seven-step paginated shell, corrected Step 6 model, and theme parity must all work correctly using only the
existing, already-committed `dayopen-bg.jpg` as the universal fallback (already implemented and proven in
the prototype). The `shame` 5-day set is a proof of concept demonstrating the idea works and looks right,
not a claim that the full set is required before B3 can ship. Full struggle-and-day coverage (~150 images)
should be scheduled and resourced as its own effort, sequenced as already described below, and is not an
implicit requirement of implementing the seven-step interaction model itself.

**Answering the required scoping questions directly:**

- *Expected asset count at full coverage:* about 150 (30 struggles times 5 days); 5 exist today (`shame`).
- *Dimensions and compression:* 1100×1970px JPEG, 154 to 271KB each (measured directly from the 5 existing
  files), matching the same weight budget B2.2's `dayopen-bg.jpg` (213,787 bytes) already established.
- *Download/repository weight at full coverage:* roughly 150 times ~210KB average, about 30MB total added
  to the repository and to what a user could download across a full 30-struggle library; any single
  session only ever loads the images for the one struggle/day the user is actually on (5 images at most
  per active Journey), not the full library at once.
- *Lazy-loading and caching:* not implemented or specified in this design-only pass; a real implementation
  should lazy-load only the current and next day's image (matching how `ensureDay()` already only
  generates one day ahead) and rely on normal HTTP/browser caching, the same as `dayopen-bg.jpg` today.
  This needs to be an explicit decision in the B3 production implementation prompt, not assumed.
- *Can a smaller curated set cover multiple struggles?* Not evaluated as a concrete alternative in this
  pass; the priority-ordered rollout below is the recommended path rather than a shared-image compromise,
  since the entire premise of this feature (approved at Jeff's explicit direction) is that each day's image
  should be distinct, not shared.
- *Can CSS treatments reduce asset count?* The per-theme scrim (`--day-scrim`) already avoids doubling the
  image count for light/dark (see "Light and Dark Theme System"); beyond that, no CSS substitute was
  explored for reducing the number of distinct photographs, since the feature's value is specifically in
  each day having its own real, matched image.
- *Fallback behavior:* already implemented and proven, any day without a dedicated image falls back to
  the existing `dayopen-bg.jpg`, so the feature degrades safely and incrementally, one struggle at a time,
  rather than requiring all-or-nothing completion.
- *Light and dark theme treatment:* the same photo serves both themes; only the scrim differs (see "Light
  and Dark Theme System" above). No second image set is needed for theme support.
- *Avoiding generic wellness imagery:* each image is generated against a real reference
  (`dayopen-bg.jpg`) and matched to that day's actual authored theme/arc (e.g., Day 1's "single heavy
  shaft of light in a dark, oppressive canopy" for "No Condemnation," not a generic sunrise/meditation
  stock-photo mood), and every image is individually reviewed before use specifically to catch
  hallucinated text or generic-looking output, per the anti-hallucination process already described below.

**Decision (made live during this review, at Jeff's explicit direction):** every Journey day gets its own
generated background image, not one shared image per struggle, and not one shared image site-wide.
Approach validated end-to-end for one complete struggle in this pass:

- **Proven:** `shame`, all 5 days, real titles/arc (No Condemnation, White as Snow, He Lifts My Head,
  Come Out of Hiding, A New Creation), each image's mood matched to that day's real theme (e.g., Day 1 is
  a single heavy shaft of light breaking a dark, oppressive canopy; Day 5 is lush, radiant new green
  growth). Same generation recipe as B2.2's `dayopen-bg.jpg`: nano-banana model, `dayopen-bg.jpg` itself
  as the style/color reference for consistency, explicit anti-text prompting (the very first B2.2
  generation attempt hallucinated garbled text and had to be discarded; the same risk applies to every
  one of these and must be checked individually), resized/recompressed to the same 150 to 270KB weight
  budget. Assets currently live in the prototype's own `assets/backgrounds/` folder, not
  `public/declare/`. Moving them into the real asset directory and wiring `ensureDay()`/`renderHome()`/
  the Day-Opening screen to select per-day is a **B3 production implementation task**, not done here.
- **Not yet done:** the remaining 29 struggles times 5 days (about 145 more images). At the proven rate
  (5 images reviewed individually, 10 to 15 minutes including QA), the full set is a substantial,
  multi-hour asset production effort deserving its own dedicated pass. Attempting it inside this
  already-long B3.1 audit/prototype/report turn would have crowded out the actual commissioned
  deliverables. Recommended sequence for that follow-up effort: first, the 5 curated zero-state struggles
  (`anxiety`, `shame`, done, `doubt`, `burnout`, `loneliness`), since those are what most users see first;
  second, the 6 care-gated sensitive struggles (`abuse`, `sexual`, `addiction`, `depression`, `grief`,
  `divorce`), since those moments carry the highest emotional stakes and deserve the most deliberate
  visual care; third, the remaining 19 struggles from `mapStruggle()`'s full list, lowest-urgency first.
- **Fallback rule (already implemented in the prototype, carry forward to production):** any day without
  a dedicated generated image falls back to the existing, already-committed `dayopen-bg.jpg`. Never a
  missing image, never a broken background.

## Accessibility requirements

- Real `role="dialog"` `aria-modal="true"` `aria-labelledby` on the shell at every breakpoint (full
  screen counts as a dialog too; this is a well-established accessible pattern, not unique to desktop).
- Focus enters the shell's heading on open; Tab/Shift+Tab cycles only the real controls present; Escape
  closes the support drawer where open; focus restores to the triggering control on any close.
- Every touch target is a real, measured ≥44×44px (the close/help controls were explicitly sized to
  this, a lesson carried directly from a real B2.2 defect found and fixed during that milestone's
  final review).
- 200% zoom and larger-text (root `font-size` scaling) both verified in the prototype's own screenshot
  set. Content reflows and scrolls, nothing is silently clipped.
- Reduced motion: `prefers-reduced-motion` respected for both the shell's own entrance animation and the
  breath ring specifically (see Breath states above). Pacing (text plus countdown) is never lost, only the
  animated growth.
- No information anywhere is conveyed by color alone. Progress, gating, and state all carry real text.

## Motion behavior

Gentle fade plus a small upward transition on shell entrance (matches B2.2's Day-Opening `joIn` keyframe
exactly, same duration, same easing), respecting reduced motion. Breath ring transitions are the only
other animation, and even those preserve real-time countdown/label updates under reduced motion instead
of disappearing. No scripture-line-by-line reveal, no cinematic transition, no animation that blocks or
delays the primary action's availability.

## Use of existing repository assets

- **Icons:** every icon in this design is an exact, inline SVG copy of an icon already used in this
  codebase: the crisis heart icon and its resource-row icons (`src/pages/crisis.astro`), the checkmark,
  the close (X), the arrow. Nothing was drawn from scratch. (The leaf glyph, `journey.astro`'s `.jo-leaf`,
  was used in the original B3.1 pass but removed in this correction, see "Top bar and content head
  correction" above; it remains a real, reusable repository asset for other contexts, it was simply judged
  not to earn its place floating above every Step 6 title with no connection to anything else on screen.)
- **Typography:** Cormorant Garamond plus DM Sans, the exact Google Fonts CDN link already used in
  `DeclareLayout.astro`.
- **Color tokens:** the exact hex values from `declare.css`'s `:root` (light) and `html[data-theme="dark"]`
  blocks, hardcoded in this prototype (see the prototype README for why it isn't `var()`-linked to the
  live stylesheet). **Corrected in B3.1A:** the prototype originally ported only the dark block and
  described itself as dark-theme-only. It now ports both real token sets and supports live switching. See
  "Light and Dark Theme System" below.
- **Photography:** the real, already-committed `dayopen-bg.jpg` plus 5 newly-generated per-day images for
  `shame`, all made with the identical generation recipe and reference image B2.2 established, not a new
  visual language.
- **Journey content:** every piece of Scripture, prayer, declaration, and reflection prompt shown is
  pulled verbatim from `public/declare/journey-data.js`'s real `shame` entries. Nothing paraphrased or
  invented.

## Light and Dark Theme System

**Corrected in B3.1A.** The B3.1 prototype originally described itself as dark-theme-only. That was wrong.
The real app is light-first (`declare.css`'s `:root` block is the light theme; `html[data-theme="dark"]`
is the override), switchable at runtime via `window.DeclareTheme` (`public/declare/theme.js`), persisted in
`localStorage['declare-theme']`, with `light`/`dark`/`auto`/`system` modes. This design now supports both,
using the real tokens, not a second invented palette.

**Token sources.** Every color used in the prototype's `:root` (light) and `html[data-theme="dark"]`
blocks is ported verbatim from the corresponding block in `declare.css`: `--text`, `--text2`, `--muted`,
`--soft`, `--gold`, `--goldd`, `--clay`, `--bgfield`, `--bg`, `--screen`, `--surface`, `--line`, `--line2`,
`--field`, `--prayer`, `--cta`, `--ctatext`, `--card-shadow`, `--chip-shadow`. Four additional tokens exist
only in the prototype, not in `declare.css`, and are called out explicitly so B3 production knows to either
add them to `declare.css` or inline their equivalent: `--btn-shadow`/`--btn-shadow-hover` (the primary
button's per-theme shadow pair), `--day-scrim` (the per-theme background-photo overlay gradient), and
`--ok`/`--err` plus their `-bg` pairs (status colors for the Vault-saved and error states, since
`declare.css` has no existing semantic success/error tokens to reuse).

**Shared structural rules.** Layout, spacing, component structure, and interaction states are identical
between themes. Theme selection changes color and shadow values only. It never changes what is on screen,
what order it appears in, or what any control does.

**Theme-specific surface rules.** Light uses warm ivory/cream surfaces (`--surface:#FFFFFF`,
`--bg:#FAF7F2`) with deep forest text (`--text:#22382E`) and restrained gold accents (`--gold:#C9A84C`,
notably more muted than dark theme's `--gold:#D8B85F`). Dark uses deep forest surfaces
(`--surface:#1b2c23`, never pure black) with warm ivory text (`--text:#F3EFE6`) and a brighter gold accent.
Both themes share the same restraint principle: gold marks accents, labels, and the primary action, never
every element.

**Typography and contrast rules.** Font families, sizes, and weights are identical between themes (theme
never changes typography, only color). Every text/surface pairing uses the real token pairs already
designed for contrast in `declare.css` (`--text`/`--surface`, `--text2`/`--surface`, `--muted`/`--surface`)
rather than a manually chosen color, so contrast is inherited from tokens already vetted for the rest of
the app.

**Background-image behavior.** The photographic per-day background is the same JPEG in both themes. Only
the scrim overlay (`--day-scrim`) changes: dark uses the original near-black gradient (unchanged from
B3.1); light uses a warm ivory gradient (`rgba(250,247,242,...)`) that lets more of the photo's upper
atmosphere show through while keeping the lower two-thirds, where text and controls sit, resolving to a
near-opaque cream wash for reliable contrast. A frosted, theme-tinted backing band was added behind the top
bar and progress dots in this same pass, in both themes, after review found the day label unreadable
against a bright patch of the photo in light mode; the fix (`color-mix(in srgb, var(--bg) 58%,
transparent)` plus `backdrop-filter: blur(10px)`) benefits both themes equally and was not a light-only
patch. No second image set was generated for light mode, consistent with the instruction not to duplicate
image weight solely because a theme changes.

**Input styling.** The reflect textarea, its border, its placeholder color (`--soft`), and its focus ring
all use theme tokens; verified independently in both themes rather than assumed to look acceptable in one
because it looked acceptable in the other.

**Button styling.** The primary pill now derives its fill and text color from the real `--cta`/`--ctatext`
pair rather than being hardcoded to a gold gradient for both themes. In light theme this renders as the
same solid forest-green fill with cream text the rest of the app already uses for its primary CTA; in dark
theme it renders as the gold gradient already established in B3.1. This was a deliberate correction during
this pass: the original B3.1 button treatment was gold in every case, which read as reasonable on a dark
background but would have been the wrong, ungrounded choice if reused unchanged on light. The secondary
("Receive Guidance"/"Reflect More"/"Try Again") button stays an outlined gold-accent pill in both themes,
intentionally quieter than the primary in both.

**Success and error styling.** "Saved to Vault" and its icon use the new `--ok` token (never color alone;
also carries the word "Saved" and a lock icon); AI failure states use `--err` plus explicit heading and
body text. Both tokens were chosen to sit comfortably in the existing forest/gold family rather than
introducing an unrelated red or green.

**AI-state styling.** The Gentle Guidance card, its Scripture block, and its disclaimer line use the same
token set as the rest of the ritual; the Scripture block's tinted background is `color-mix(in srgb,
var(--gold) 9%, var(--surface))`, so it stays a restrained accent in both themes rather than a fixed color
that could clash with one of them.

**Vault styling.** The Vault destination demo (list, detail, private state) reuses the same surface/line/
tag tokens as the rest of the prototype; the "Journey Reflection" and private-lock treatments were verified
in both themes during the smoke test pass described in "Theme-Switching Prototype Behavior" below.

**Responsive differences.** None. The responsive rules in this document apply identically regardless of
theme; only the earlier top-bar frosting fix (see "Background-image behavior") was theme-motivated, and it
was applied to both.

**Accessibility verification for both themes.** Contrast, focus-ring visibility, 200% zoom, larger text,
and reduced motion were each spot-checked in both themes via the smoke-test pass in this session (see the
Theme Accessibility Results section of the completion report) and are represented in the mockup set as
matched light/dark pairs, not dark-only evidence with light assumed equivalent.

## Scripture Follow-Through

**Classification: optional B3 polish, requiring separate product approval before implementation. Not a
core B3 requirement and not a blocker for B3 acceptance.** The paginated seven-step shell, the corrected
Step 6 model, and theme parity are the core of this design package; this feature is a genuinely useful
idea raised and prototyped during the same review, but it must not silently expand B3's committed scope.
If B3 production work is scheduled without a separate go-ahead on this specific feature, the Gentle
Guidance "next step" line should ship as plain text (its original, simpler form), not as a dead or
half-built link.

**Added during this review**, prompted by a direct question about the Gentle Guidance response's "next
step" line ("Read Psalm 34 tonight, slowly."): today that line is plain text with no way to act on it. The
proposed direction, if separately approved, is to make it a real, tappable link into the existing Bible
reader, plus a lightweight way to pick the reading back up from the Journey Dashboard if the user does not
finish it in the moment.

**Answering the required scoping questions directly:**

- *Which step exposes it?* Only Step 6, and only inside the Gentle Guidance response (never the plain
  Vault-saved state, never any other step).
- *How does the user return to the exact Journey step?* Via the proposed "Back to your Journey" breadcrumb
  pinned above the chapter text in the reader (see below). This does not exist in `word.astro` today.
- *Does Journey state persist while reading?* Yes, unaffected either way. Leaving Step 6 to read Scripture
  does not touch `db_active_journey`, `dayState`, or any gate; the user's place in the ritual is exactly as
  they left it on return, the same as any other navigation away from Journey today.
- *Does browser Back work?* Not evaluated in this pass. `word.astro` is presumably a normal page navigation
  (not a client-side overlay), so browser Back would follow ordinary history behavior; the proposed
  breadcrumb is a deliberate, explicit affordance precisely because relying on Back alone was judged
  insufficient for a user who arrived via a Journey-specific deep link.
- *Does opening the reader create a new route, or use existing behavior?* Existing behavior only. It reuses
  `word.astro` as-is, deep-linked to a reference via its existing chapter-reading capability. No new route.
- *Does the Dashboard resume card already exist, or is it proposed?* **Fully proposed, net-new.** No
  Journey Dashboard resume-card-for-a-reading concept exists in production today; this reuses the visual
  language of Journey's own existing Resume card (`.oc-card`) but the underlying behavior (an outstanding-
  reading pointer, surfaced on next dashboard visit) does not exist anywhere in the app currently.
- *Does the reader return breadcrumb require production changes?* **Yes.** This is the one genuinely new
  piece of production surface this feature would require: a small, conditional banner added to `word.astro`
  itself, shown only when the reader was opened from a Journey guidance link. Everything else (the link
  target, the dashboard card's visual language) reuses existing patterns, but this breadcrumb does not
  exist today and is a real, if small, scoped change to a file outside `journey.astro`.

- **The link.** "Read Psalm 34 →" becomes a real anchor pointing at the app's existing chapter reader
  (`word.astro`), deep-linked to the exact reference the guidance response cited. No new reader is built;
  this reuses the same reading surface every other Scripture reference in the app already uses.
- **Return breadcrumb (new, small, scoped).** The reader does not have a "return to your Journey" path
  today. This design proposes a minimal one: when the reader is opened from a Journey guidance link, it
  carries a small, dismissible banner ("Back to your Journey") pinned above the chapter text, so the user
  is never stranded in the reader with no way back to Day N. The prototype demonstrates this as a
  representative overlay (`window.__proto.showScriptureReader()`), not a rebuild of `word.astro` itself.
- **Dashboard resume card.** If the user leaves the reader before finishing, or simply taps the link and
  moves on, the Journey Dashboard surfaces a small "Continue reading Psalm 34" card the next time the user
  returns there, reusing the exact visual language of the existing Resume card (`.oc-card`, eyebrow plus
  title plus one primary action) rather than inventing a new card type. It clears itself once the reading is
  opened again or explicitly dismissed. The prototype demonstrates this as
  `window.__proto.showDashboardResume()`.
- **State required (see "Step 6 Production Dependencies" above):** a single outstanding-reading pointer per
  Journey instance (which reference, whether it has been opened), not a new content type and not something
  that needs to live in Vault. A natural home is alongside the existing `dayState`/`db_journey_inst`
  per-day local state Journey already keeps, not a new persistence layer.
- **Scope note:** this is a real, useful follow-through and is documented and prototyped here as approved
  direction, but it is still design-only. Nothing about `word.astro`'s actual return-navigation was
  changed, and no dashboard file was touched.

## Mockup Placeholders That Must Not Become Production Assets

The attached B3 concept boards were composition/layout references only. The following elements shown in
those boards were **not used** anywhere in this prototype and must not be carried into a production
implementation:

- **The generated "D" leaf-in-badge logo mark** shown in the corner of every concept board. Production
  must use the real repository logo (`public/declare/brand/mark.png` / `logo-dark.png`) if a logo is
  needed in this context at all. This prototype uses no logo mark inside the ritual shell, matching how
  B2.2's Day-Opening screen also has none.
- **Generated tree/vine illustrations** distinct from the repository's actual Vine artwork
  (`tree-dead.jpg` / `tree-budding.jpg` / `tree-alive.jpg`). The concept boards' decorative corner vines
  and leaf borders are not the repository's real botanical assets and were not reproduced.
- **Generated icon family** shown throughout the boards (the specific line-icon style used for progress,
  help, lock, etc. in the mockup images). Every icon actually used in this prototype is instead a direct
  copy of an existing repository icon, not a redraw of the mockup's icon set.
- **Device frames** (the phone/tablet/monitor chrome drawn around each mockup screen), decorative
  presentation only, never implemented.
- **Generated page backgrounds shown in the boards themselves** (the cream/off-white board background,
  unrelated to the actual app), not used. The actual screens use only the real dark forest photography
  described above.
- **The concept boards' own literal mockup copy where it conflicts with real content**, e.g. "Unclenched
  Trust" (a fictional day title used repeatedly across the B2.2 concept boards) never appears anywhere in
  this prototype. Every title, verse, and declaration shown is the real, authored `shame` content instead.
- **The "Open" app reference's streak/"Congratulations, Sam"/1-Class/Share completion screen** (used only
  as a motion/atmosphere reference for the breath step, per Jeff's request). Its gamified completion
  pattern directly conflicts with this project's explicit no-achievement-language rule and was
  deliberately excluded.

---

**Specification complete. Describes the proposed B3 design only. No production file was changed to
produce this document.**
