# Failed payments: what we send, and why we built it ourselves

**Decided 2026-08-26.** Implemented in `convex/dunning.ts`,
`convex/dunningSchedule.ts` and the scheduling hook in
`convex/subscriptions.ts:applyWebhook`. Asserted by
`scripts/verify-dunning-emails.ts`.

---

## A note on the research behind this

The comparison below came from a survey of Stripe, Paddle, Recurly, Chargebee,
Baremetrics, Apple, Google Play, Netflix, Spotify, GitHub, Notion, Slack,
Dropbox, Adobe, 1Password and Substack, plus the faith and mental-wellness
category (Abide, Hallow, Waking Up, Calm, Insight Timer).

**Every direct page fetch was blocked by the session's egress proxy.** All of it
arrived through search-result summaries, cross-checked across multiple queries.
Treat it as strong signal, not as verified fact. The two places where being
wrong would cost most — Stripe's per-retry email behaviour and its final-action
setting — should be confirmed in the Dashboard before launch.

---

## The decision: our own emails. Stripe's toggle stays off.

Not for branding. For this:

> **Stripe's "send emails when card payments fail" sends one email per retry
> attempt.** At the default eight retries, that is eight emails. The copy cannot
> be changed — Branding settings expose colour, icon and logo, nothing more.

Eight escalating payment demands is a collections experience, delivered to
people who reach this app at 3am in fear and shame. Every serious vendor sends
far fewer: **Recurly's own guidance is three to four messages**; Paddle sends
four, numbering them in the subject line.

Turning Stripe's on *as well* would mean eleven.

### Confirmed in the Dashboard, 2026-08-26

The research note above flagged two Stripe behaviours as "confirm before launch".
Screenshots of the live account settled them, and one of them was **not** what
this document assumed.

| Setting | Found | Wanted |
|---|---|---|
| Send emails when card payments fail | **ON** | **off** |
| Send emails when bank debit payments fail | **ON** | off |
| Smart Retry final action (*if all retries fail*) | **cancel the subscription** | leave `past_due` |
| Send finalized invoices and credit notes | ON | **ON — leave it** |
| Send reminders if a recurring invoice hasn't been paid | off | off |
| Reminder 7 days before a trial ends / upcoming renewals / expiring cards | off | off |

**This document said "Stripe's toggle stays off". It was on.** Nothing had gone
wrong — no card has ever failed on this account, so it had never fired — but the
sentence was an assumption written as a fact, which is exactly the failure mode
`billing-production-activation-readiness.md` is distrusted for. Recorded here
rather than quietly corrected.

Turn it off **when the Convex deploy carrying our sequence lands**, not before.
Off with nothing deployed is worse than eight emails: it is none.

The bank-debit toggle is moot — Checkout is card-only — but off is the honest
setting for something we do not accept.

One setting nearby is deliberately **left alone**: *Manage payments that require
confirmation → if a recurring payment is incomplete for 15 days, cancel*. That
governs `incomplete` — a first payment where 3D Secure was never confirmed, so
the subscription never started. Cancelling that is right, and it is a different
state from `past_due`, which is what the grace window and this sequence cover.

### What we would give up

Stripe's emails are free, already localised, and maintained by somebody else.
Ours are our problem when they break — and localising them was work Stripe would
have done for us. They now ship in English and Spanish (below), which closes most
of that gap; a third language is our cost to bear, not Stripe's.

### When to reconsider

If our sequence ever stops delivering — a Resend outage, a domain
reputation problem — Stripe's toggle is the fallback and can be switched on in
one click. It is worse, and it is much better than silence.

---

## The sequence

At the approved 16-day window: **four emails, then silence.** Never more than
four at any window — Paddle sends four, Recurly's guidance is three to four,
Stripe's own toggle sends eight. A longer grace buys the reader more *time*, not
more email.

| Stage | When (16-day grace) | What it says |
|---|---|---|
| `failed` | immediately | the card, the amount, the date Plus pauses, one button, **and the hardship offer** |
| `reminder` | day 8 | still trying, Plus is still on, here's the date |
| `ending` | day 15 | 24h warning — the one you must not skip |
| `paused` | day 16 | Plus is off, everything else is still here, no penalty |

The `reminder` stage exists **because** the window got longer. The first version
had three stages and read correctly at a 3-day grace (0, 2, 3). At 16 days it
became 0, 15, 16 — one email, then over two weeks of silence, then two inside a
day. Somebody would reasonably conclude it had been sorted out and then lose
Plus with a day's notice. Below a week the three-stage shape is still right and
the reminder is dropped.

**The cadence is derived from `PAST_DUE_GRACE_DAYS`, never typed twice.** If that
number changes, every send time moves with it. That is not theoretical: the
window moved from 3 days to 16 in the same session this was written, and the
schedule followed without a line being retyped.

At a grace shorter than 3 days the `ending` email is dropped rather than
squeezed — "it pauses tomorrow" and "it has paused" landing hours apart reads as
nagging, not warning. Below a week the `reminder` is dropped for the same
reason. `verify-dunning-emails.ts` proves the schedule stays correct at 2, 3, 7,
14, 16 and 28 days, so the grace setting can change without anyone re-deriving
this by hand.

### Why it fires on the transition, not the event

Stripe emits several events per failure, and Smart Retries produce more with
every attempt. Scheduling on *"the status became failing, having not been
before"* fires the sequence exactly once per episode. Scheduling on the event
would send a fresh set of three after every retry — which is precisely the
failure mode we rejected Stripe's own emails for.

A brand-new row is deliberately not a transition: a subscription whose first
event already reads `past_due` never started, and "your Plus pauses on…" would
be wrong for it.

### Why every stage re-checks

Most failed cards are fixed within the window. "Your Plus pauses tomorrow"
arriving after somebody has already paid is the kind of message that makes a
person cancel on purpose. Each stage re-reads the subscription and sends nothing
if it has recovered, ended, or is a lifetime row.

---

## What the good ones contain, and what we took

Real emails from OpenAI, Cursor, Midjourney and Notion carry the same four
fields behind exactly one button: **the amount, the card brand and last four,
the product name, and a hard date access ends.** We carry all four.

Two findings worth acting on:

- Baremetrics' data across 1M+ dunning emails: the **day-0 email recovers
  roughly 3× anything sent after day 14**. Ours is immediate.
- The most-cited design mistake is **skipping the last email before lockout**.
  The suite asserts something always arrives before access stops, at any grace
  setting.

### Anti-phishing is a design constraint here, not a nicety

*"Your payment failed — update your payment information"* is among the most
common phishing templates in existence, and consumer-protection advice tells
people not to click those links. For a brand nobody recognises yet, that is a
real trust problem, not a theoretical one.

Three answers, all asserted:

1. **The card's brand and last four.** A phisher does not know them.
2. **The link points at our own domain**, never a Stripe-hosted URL.
3. **An explicit alternative to the link** — *"or just open Declare and go to
   Billing"*. Nothing in the survey did this, and it costs nothing.

---

## Tone

The rule is **"your card, not you."** A failed payment is overwhelmingly a dead
card: up to 40% of subscription churn is involuntary, and expired cards alone
account for an estimated 25–30% of failures.

Banned outright, and asserted against the *rendered* copy rather than the
source: `suspended`, `terminated`, `revoked`, `delinquent`, `overdue`,
`immediately`, `final notice`, `failure to`, `will be lost`. No capitals, no
exclamation marks, no countdown.

The specific risk generic dunning advice will never flag: **in a faith app,
"your access has been withdrawn" can land as a verdict on the person rather than
a billing status.** It does not appear.

### The hardship offer, in the first email

Abide gives a free year to anyone who cannot afford one. Hallow gives one
subscription away for every one sold. Waking Up grants 100% of no-questions-asked
requests. This is the category norm, not a concession.

Ours is a reply-to line, in the **first** email rather than the last — somebody
who cannot pay should hear it before spending the window worrying — and it
promises they *"will not be asked to explain yourself twice."* Being made to
re-explain hardship is named in the Money and Mental Health Policy Institute's
research as an active harm, not merely friction.

---

## Known gaps, recorded rather than hidden

### ~~English only~~ — CLOSED

**Shipped 2026-08-26.** English and Spanish, chosen per subscriber rather than
guessed.

`createCheckoutSession` already accepted `lang`, so the fix was to make it
survive the Checkout Session: it is stamped into `subscription_data[metadata]`
for a subscription and `payment_intent_data[metadata]` for a lifetime purchase —
the same asymmetry the provenance keys use, and for the same reason. The webhook
reads it back through `plusPlans.stampedLang` and persists it on the
subscriptions row as `locale`; `dunning.ts` reads it there weeks later.

**It is carried metadata, not provenance, and must never become provenance.**
`classifyPlusSubscription` does not read `lang` and adding it as a sixth checked
key would reject every subscription sold before the stamp existed.
`verify-plus-classification.ts` asserts both directions: an extra `lang` key
does not disturb classification, and a missing one does not either.

**Absence means English**, which is why nothing needed backfilling — a row sold
before the column existed reads identically to one stamped by an English
checkout. `plusPlans.normalizeLang` is the only writer, it accepts regional tags
(`es-MX`, `es_419`, `ES`) and returns `null` for anything else, so the column
cannot hold a value the send does not understand. It returns `null` rather than
throwing on purpose: this runs inside a webhook mutation, and Stripe answers a
throw by retrying the same event forever.

Three things the suite proves beyond "Spanish exists":

- **The register matches the app.** `tú`, never `usted` — `auth-modal.js` and the
  rest of the product use `tú`, and a billing email that switched to `usted`
  reads as a letter from a collections department.
- **The ban list is not translated.** The Spanish list bans what Spanish billing
  letters actually say (`moroso`, `en mora`, `dado de baja`, `aviso final`).
  Word-for-word translation would have banned `vencida`, which is the ordinary
  blameless word for an expired *card* and the single most common real cause.
- **The formatting is the reader's.** `es-US`, not `es-ES`: our Spanish readers
  are in the United States and are billed in dollars, so `$8.99`, not `8,99 US$`.
  The date reads *26 de septiembre de 2026*.

The link carries `?lang=es` so the billing page opens in the language the email
was written in even on a device that has never chosen Spanish. `i18n.js` honours
the parameter and then strips it from the URL, so it cannot pin anyone to
Spanish afterwards — the suite asserts both halves of that, because the link
would fail silently if either stopped being true.

### ~~No delivery tracking~~ — CLOSED

**Shipped 2026-08-26.** `onEmailEvent` is registered on the Resend client and
`/resend/email-event` is routed in `http.ts`, so every event on a message we
sent comes back to us.

**Why this route does not go through the Worker, and why that is not a breach of
rule C5.** C5 is about the *Stripe* credential — one key, one runtime, verified
at the public edge in front of a money path. Resend signs with svix and the
component verifies that signature itself using `RESEND_WEBHOOK_SECRET`. Routing
it through the Worker would add a hop and a second copy of a secret to buy
nothing.

Each send writes a `dunningSends` row joining the message id to the user and the
stage; each event patches it. **It is delivery tracking, not analytics** — opens
and clicks are deliberately not recorded, and could not be: open tracking needs a
pixel and these emails render no `<img` at all, which a suite asserts. No email
address is duplicated into the table; the Resend component already holds the
message, keyed by the same id.

**The property that makes it more than a log line:** a bounce, a hard failure or
a spam complaint suppresses the remaining stages. Somebody who marked the first
email as spam has told us to stop, and three more would be both rude and a
deliverability problem for every other email this domain sends. The check runs at
send time, before the address is even resolved, alongside every other pre-send
check — the suite asserts that ordering, because a suppression that ran after the
send would be a suppression that did nothing.

**This needs one thing done in a dashboard:** the Resend webhook pointing at
`/resend/email-event`, and its signing secret set as `RESEND_WEBHOOK_SECRET` in
Convex production. Until then deliveries fail closed — events are simply not
recorded, which is the state this replaced and is strictly better than accepting
forged ones.

### Grace expiry is unobserved

`entitlements.ts` computes grace expiry as a read-time comparison against
`Date.now()` — no webhook, no write, no log, no `billingEvents` row. The `paused`
email is scheduled ahead of time, so it still arrives; but nothing in the system
records the moment somebody actually lost access. Any monitoring built purely on
Stripe events will miss it entirely. This is the substance of **TODO B4**.

---

## Two decisions still open, both yours

### 1. ~~The grace window~~ — DECIDED: 16 days, Apple's model

**Approved 2026-08-26.** `PAST_DUE_GRACE_DAYS` moved from 3 to **16**, and the
"awaiting approval" note in `entitlementCatalog.ts` was replaced with the
decision and its reasoning.

Three days was shorter than the retries it was meant to cover. Stripe's Smart
Retries run for **two weeks**, so a subscriber lost Plus on day 4 and could have
it handed back on day 10 when an attempt succeeded — access flapping off and on
while we were still trying to charge them, with no explanation for either
transition.

**16 is Apple's own default** for monthly-and-longer subscriptions (their
billing grace period offers 3, 16 or 28 days and keeps full access throughout;
Google Play works the same way). And it **exceeds Stripe's 14-day retry window
by two days** — which is the property that matters. Access now ends exactly
once, after the retries have genuinely finished, with margin rather than a race.

Full access is retained for the whole window; that part was already true
(`entitlements.ts` returns `tier: "plus"` until `graceEndsAt`).

Cost: up to 16 days of Plus for a card that may never recover. Against $8.99 and
involuntary churn near 40%, a good trade.

`verify-dunning-emails.ts` asserts the window is 16, that it stays **ahead of
Stripe's retry window**, and that the schedule holds at 2, 3, 7, 14, 16 and 28
days — so changing it later stays one number.

### 2. ~~Smart Retry's final action~~ — DECIDED AND APPLIED: leave `past_due`

**Changed in the live Dashboard on 2026-08-26**, from the default of `cancel` to
**leave the subscription past-due**, and verified after saving. The reasoning
below is kept as the record of why.

- **Cancel** — the subscription ends. Clean, but recovery means buying again
  from scratch.
- **Leave `past_due`** — the subscription survives, so the Customer Portal can
  still repair it. Pairs with the `lapsed` state, which keeps that door open.

**Chosen: leave `past_due`,** so a returning subscriber fixes a card rather than
re-purchasing.

Both settings were Dashboard-only — a restricted key is refused for them — so both
required the owner in the live Stripe Dashboard. Both are now done.

### A trap directly beside it

*Manage payments that require confirmation* carries a **Subscription status**
dropdown whose wording is nearly identical to the one above, and it was changed
in the same sitting before being caught and reverted.

It governs `incomplete` — a first payment where 3D Secure was never confirmed, so
**nothing was ever paid**. Setting it to `leave past_due` would have handed that
person `tier: "plus"` for the full 16-day grace window (`entitlements.ts:119`,
with the clock running from `updatedAt` since there is no period end), *and*
tripped the four-email sequence telling them their Plus stays on until a date.

It must read **`cancel the subscription`**. An initial payment that was never
confirmed should expire, not become a debt.
