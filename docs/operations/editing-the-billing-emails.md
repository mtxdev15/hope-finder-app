# Changing the failed-payment emails

**Written 2026-08-26.** For the next person who needs to reword, retime, or add
to the failed-payment sequence — very possibly Jeff, months from now, having
forgotten all of this.

If you want to know *why* these emails exist and why they are ours rather than
Stripe's, read `dunning-plan.md` first. This file is only about changing them.

---

## The one-minute version

| I want to… | Edit this | Then |
|---|---|---|
| Change a word | `convex/dunningSchedule.ts` → `copyFor()` | run the suite, `npx convex deploy` |
| Change how they look | same file → `render()` | same |
| Change *when* they send | `convex/entitlementCatalog.ts` → `PAST_DUE_GRACE_DAYS` | same — everything moves with it |
| Add a language | `copyFor()` + `plusPlans.normalizeLang` | see below, it is bigger than it looks |
| Add a fifth email | `dunningDelayMs()` + `dunningSchedule()` + `copyFor()` | see below |

**Always, before deploying:**

```bash
node --experimental-strip-types scripts/verify-dunning-emails.ts
npm run check:types
```

The suite runs the real functions rather than reading the file, so if it passes,
the words it checked are the words that will be sent.

---

## Where everything lives

There are only two files, and the split is deliberate.

**`convex/dunningSchedule.ts`** — the words, the look, and the timing. Imports
nothing from Convex, which is what lets the suite execute it under plain `node`
with no deployment and no credentials. **All copy edits happen here.**

**`convex/dunning.ts`** — the plumbing. Reads the subscription, decides whether
sending is still true, resolves the address, asks Stripe for the card, sends.
You rarely need to touch it to change what an email *says*.

Scheduling lives in a third place: `convex/subscriptions.ts`, in `applyWebhook`,
which queues all four sends the moment a subscription first turns `past_due`.

---

## Changing the words

Open `copyFor()`. Each stage returns a `subject`, a `heading`, a `body` array of
paragraphs, a `cta`, and a `footer`. Paragraphs may contain `<strong>`; nothing
else. Spanish lives in `copyEs()` directly above.

**Change both languages or neither.** The suite will not catch a Spanish
paragraph that still says the old thing — it checks *properties*, not sameness.
A half-updated email is worse than an outdated one.

### What the suite will reject

- **Banned words.** English: `suspended`, `terminated`, `revoked`, `delinquent`,
  `overdue`, `immediately`, `final notice`, `failure to`, `will be lost`.
  Spanish: `suspendido/a`, `moroso/a`, `en mora`, `inmediatamente`,
  `aviso final`, `dado de baja`, `se perderá`, `incumplimiento`, `deuda`.
  The two lists are **not translations of each other** — each bans what billing
  letters actually say in that language. Note `vencida` is deliberately *allowed*:
  applied to a card it is the ordinary blameless word for expired.
- **Capitals and exclamation marks.** Any run of four or more capitals fails.
- **A missing date.** Every email before the pause must name the date Plus pauses.
  The pause email must *not* — by then it has happened.
- **A missing card.** Every email names the card brand and last four. It is an
  anti-phishing signal: a phisher does not know them.
- **Anything to load.** No `<img>`, no `<svg>`, no `src=`, no `background-image`,
  no `url(`. See below.
- **A link off our domain.**

### The tone rule

**"Your card, not you."** Up to 40% of subscription churn is involuntary and
expired cards alone are an estimated 25–30% of failures. Nobody receiving these
did anything wrong.

The specific risk generic dunning advice will never flag: in a faith app, *"your
access has been withdrawn"* can land as a verdict on the person rather than a
billing status. Read any new sentence back with that ear.

---

## Changing when they send

**Change one number.** `PAST_DUE_GRACE_DAYS` in `convex/entitlementCatalog.ts`.
Every send time is derived from it, and so is the date printed inside the emails
and the moment the entitlement layer actually ends access. Nothing is typed twice.

That is not theoretical — the window moved from 3 days to 16 in a single session
and the whole cadence followed without a line being retyped.

The shape adapts on its own:

| Grace | Emails sent |
|---|---|
| under 3 days | `failed`, `paused` |
| 3–6 days | `failed`, `ending`, `paused` |
| 7 days and over | `failed`, `reminder`, `ending`, `paused` |

The suite proves the schedule stays sane at 2, 3, 7, 14, 16 and 28 days, so you
can change the number without re-deriving anything by hand.

**Before lowering it below 14, read this.** Stripe's Smart Retries run for two
weeks. A grace window shorter than that means somebody loses Plus on day 4 and
could have it handed back on day 10 when a retry succeeds — access flapping off
and on while you are still trying to charge them, with no explanation for either
transition. Sixteen is two days clear of that, and is Apple's own default.

---

## Adding a fifth email

Three edits, in this order:

1. Add the stage name to the `DunningStage` union.
2. Give it a delay in `dunningDelayMs()`, and return `null` at grace windows
   where it would not make sense.
3. Add it to the array in `dunningSchedule()`, **in time order**, and write its
   copy in both `copyFor()` and `copyEs()`.

Then widen the `stage` validator in `dunning.ts`'s `sendDunningEmail` args, or
the scheduled send will be rejected at runtime.

**Think hard before you do.** Four is already at the top of the range: Paddle
sends four, Recurly's own guidance is three to four, Stripe's toggle sends eight
and that is precisely why we do not use it. A longer grace window should buy the
reader more *time*, not more email.

---

## Adding a third language

Bigger than it looks, because the language has to survive the whole journey from
Checkout to a send three weeks later:

1. `plusPlans.ts` → add it to `EMAIL_LANGS` so `normalizeLang` accepts it.
2. `billing.ts` → `createCheckoutSession` currently stamps only `es`; widen it.
3. `dunningSchedule.ts` → add it to `EmailLang`, `INTL_LOCALE`, `FOOTER`,
   `emailLang()`, and write a `copyXx()` alongside `copyEs()`.
4. Add its banned-word list to the suite, written *for* that language.
5. Make sure the site itself serves that language, or the link lands somewhere
   that ignores it.

**Do not skip step 4.** An unchecked translation is the one most likely to say
something the English never would.

---

## Why there is no logo image

Every other company puts a logo file at the top of a billing email. We render a
**text wordmark** in Cormorant Garamond with Georgia as the real fallback, and
the constraint is not aesthetic:

A remote image is exactly the mechanism an open-tracking pixel uses, and these
emails are asserted to contain no image at all. Gmail strips inline SVG, so that
is not a way round it either. The text wordmark carries the brand with no
external request, nothing for a client to block, and nothing to load.

**If someone later asks for "just a small logo at the top", this is the answer.**
The suite will reject it, and that rejection is on purpose.

## Why there are exactly two links

**Every anchor points at our own domain, and exactly one of them is an action.**

The wordmark links home — added 2026-08-26, because somebody anxious about a
payment should not have to follow a link about money just to reach the site. The
button links to `/billing`.

An earlier version allowed only one anchor. That was stricter than the real
property: what resists phishing is the card's last four, a link on our own
domain, and the stated alternative to clicking at all — *"or just open Declare
and go to Billing"*. A second link to our own front door weakens none of them.

**The count was never the point. The destination is.** If you add a third link,
keep it on our domain and keep it out of the action's way.

---

## Testing a change without charging a card

You cannot easily make a real card fail on demand, so the suite is the safety
net and it is built to be one — it renders the actual emails and reads the actual
words. `verify-dunning-emails.ts` is the file; add to it when you add behaviour.

To see the emails rendered, run `copyFor()` and `render()` in a scratch script
and write the HTML to a file. That is all the preview anyone has ever needed.

Note that **`dunning.ts` sends for real** — `testMode: false`. There is no dry
run. Do not call `sendDunningEmail` by hand against production to "see what
happens".

---

## After any change

```bash
node --experimental-strip-types scripts/verify-dunning-emails.ts
npm run check:types
npx convex deploy
```

The deploy is what makes it live. The emails are generated at send time from the
code in your deployment — there is no template stored in Resend, no hosted file,
nothing cached. Deploy and the next email uses the new words.
