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

### What we would give up

Stripe's emails are free, already localised, and maintained by somebody else.
Ours are English-only (see below) and are our problem when they break. That is
the trade, made deliberately.

### When to reconsider

If our sequence ever stops delivering — a Resend outage, a domain
reputation problem — Stripe's toggle is the fallback and can be switched on in
one click. It is worse, and it is much better than silence.

---

## The sequence

Three emails, then silence. There is no fourth.

| Stage | When | What it says |
|---|---|---|
| `failed` | immediately | the card, the amount, the date Plus pauses, one button, **and the hardship offer** |
| `ending` | 24h before access stops | the same facts, calmer, the deadline closer |
| `paused` | when access stops | Plus is off, everything else is still here, no penalty |

**The cadence is derived from `PAST_DUE_GRACE_DAYS`, never typed twice.** If that
number changes, every send time moves with it. This mattered immediately: grace
is 3 days while Stripe retries for 14, so a schedule written against Stripe's
retry window would have promised a week the entitlement layer does not honour.

At a grace shorter than 3 days the `ending` email is dropped rather than
squeezed — "it pauses tomorrow" and "it has paused" landing hours apart reads as
nagging, not warning. `verify-dunning-emails.ts` proves the schedule stays
correct at 2, 3, 7, 14 and 28 days, so the grace setting can change without
anyone re-deriving this by hand.

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

### English only

Nothing in the codebase records a user's language. `accountSettings` holds a
timezone and no locale, and the webhook that triggers this has no request to
read one from. Guessing from a Stripe billing address would be worse than the
honest default.

**The fix, when wanted:** `createCheckoutSession` already accepts `lang`. Stamp
it into `subscription_data[metadata][lang]`, persist it on the subscriptions row
in `applyWebhook`, and read it here. Extra metadata keys do not affect
classification — only the five provenance keys are checked — so this is additive
and safe. It is a real gap for a bilingual app and should not ship unnoticed
much past launch.

### No delivery tracking

The Resend component is instantiated without `onEmailEvent` and no Resend webhook
route is registered, so nothing observes a bounce, a complaint or a hard failure.
A dunning email that silently fails to deliver is indistinguishable from one that
worked. **This should be closed before volume grows** — it is the difference
between "we told them" and "we tried to tell them".

### Grace expiry is unobserved

`entitlements.ts` computes grace expiry as a read-time comparison against
`Date.now()` — no webhook, no write, no log, no `billingEvents` row. The `paused`
email is scheduled ahead of time, so it still arrives; but nothing in the system
records the moment somebody actually lost access. Any monitoring built purely on
Stripe events will miss it entirely. This is the substance of **TODO B4**.

---

## Two decisions still open, both yours

### 1. The grace window is 3 days, and was never approved

`entitlementCatalog.ts` says so in its own comment: *"a product setting awaiting
approval, not a silently chosen default."*

The mismatch it creates is real: **Stripe retries for 14 days, we cut access at
3.** So a subscriber can lose Plus on day 4 and have it silently restored on day
10 when a retry succeeds — access flapping, while we are still attempting to
charge them.

The platform norms all point the other way. Apple's billing grace period is
selectable at 3, 16 or 28 days and keeps full access throughout. Google Play
grants grace before any hold. Stripe's own guidance is to leave a subscription
`past_due` for 7–14 days rather than cancelling.

**Recommendation: align grace to the retry window — 14 days.** Access then
continues exactly while Stripe is genuinely still trying, and ends once when
Stripe gives up, rather than twice with a gap in the middle. The schedule and
the suite already handle it; it is a one-number change.

The cost is 14 days of Plus for a card that may never recover. Against $8.99 and
an involuntary-churn rate near 40%, that is a good trade.

### 2. Smart Retry's final action (TODO B3)

Still the untouched sandbox default of **cancel**.

- **Cancel** — the subscription ends. Clean, but recovery means buying again
  from scratch.
- **Leave `past_due`** — the subscription survives, so the Customer Portal can
  still repair it. Pairs with the `lapsed` state, which keeps that door open.

**Recommendation: leave `past_due`,** so a returning subscriber fixes a card
rather than re-purchasing.

Both settings are Dashboard-only — a restricted key is refused for them — so
both require the owner in the live Stripe Dashboard.
