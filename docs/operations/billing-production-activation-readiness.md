# Production billing activation — readiness and runbook

**This document does not authorize production activation.** It is the read-only
audit of what exists today, the list of what does not, and the ordered plan for
a future task that will require its own explicit authorization for every live
write.

**No production write occurred while producing it.** No live Stripe object was
created or modified, no production Convex variable was set, no Worker was
deployed, and no real-money transaction was performed.

**Current authoritative commit:** `7df8a3d4b92c3100a3da8c619562a3ad001ff904`
(main, after PR #47).

No live resource identifier, endpoint URL, account email or secret value appears
in this document. Variables are named, never read.

---

## 1. What the sandbox has proven

| Capability | Status |
|---|---|
| Checkout → Customer → Subscription → entitlement | proven |
| Webhook signature verification and forwarding | proven |
| Provider-neutral entitlement classification | proven |
| Failed renewal payment and payment-attention UX | proven (2026-08-23) |
| Recovery from failure | proven, **through the hosted Portal** |
| Cancellation scheduled at period end, via the Portal | proven |
| Cancellation reversal, via the Portal | proven |
| `cancel_at` → `cancelAtPeriodEnd` normalization | proven against a real Portal action |
| Terminal cancellation and entitlement loss | proven |
| Harness fail-closed when disabled, authenticated | proven |

Full evidence: [billing-portal-release-gate-2026-08-23.md](billing-portal-release-gate-2026-08-23.md)
and [billing-test-harness-execution-record-2026-08-23.md](billing-test-harness-execution-record-2026-08-23.md).

**Not proven anywhere:** Stripe's automatic Smart Retry cadence actually firing,
failed-payment notification delivery, and every live-mode behaviour.

---

## 2. Production subscription billing is inert today

Not merely "the button is disabled" — inert at three independent layers, each
verified read-only.

**Production Convex `keen-hamster-650` holds no billing variables.** Present:
`BETTER_AUTH_SECRET`, `GIFT_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `JOURNEY_TRANSLATE_SECRET`, `JOURNEY_TRANSLATE_URL`,
`RESEND_API_KEY`, `SITE_URL`. **Absent:** `STRIPE_SECRET_KEY`,
`STRIPE_PLUS_MONTHLY_PRICE_ID`, `STRIPE_PLUS_ANNUAL_PRICE_ID`,
`BILLING_WEBHOOK_SECRET`. `GIFT_WEBHOOK_SECRET` belongs to the retired donation
product and is unrelated. `createCheckoutSession` therefore returns
`billing-not-configured` before it can reach Stripe.

**The production Worker's `/billing/webhook` fails closed.** The route exists in
the deployed code, and its first act is to refuse unless
`STRIPE_BILLING_WEBHOOK_SECRET`, `CONVEX_SITE_URL` and `BILLING_WEBHOOK_SECRET`
are all present. Two of those three are absent from the production Worker, so
the route returns "not configured" for every request.

**The public pricing CTA is a disabled "Opening soon" button**, and
`pricing.astro` contains no Checkout call and no Stripe reference at all.

Production also holds **51 function-spec entries and zero `testHarness`
entries**, with neither harness variable ever set.

---

## 3. Live Stripe — what the audit could and could not see

**Account:** the live JC Kingdom Ventures account, distinct from the sandbox.

### Verified

**Exactly one live webhook endpoint exists, and it is not for billing.** It is
the giving/donation endpoint: enabled, targeting the production Worker's
`/give/webhook` path, subscribed to **`checkout.session.completed` only**, and
pinned to API version **`2022-11-15`**.

Three consequences, all of which must be handled before activation:

1. **It must not be repurposed.** It points at a different Worker route, carries
   a different shared secret, and is scoped to a single event.
2. Its API version is **not** the `2026-06-24.dahlia` the billing code pins and
   sends on every request. A billing endpoint on the wrong version returns
   payload shapes the parser was never verified against.
3. The Worker's own comments record `/give/webhook` as **retired with the
   donation product**. A live endpoint is still pointed at a retired route.
   Decide deliberately whether it is disabled or left alone; do not discover
   this during activation.

### Could not be verified

The restricted key available for the live audit can read account information and
webhook endpoints, and is refused for **Products, Prices, Subscriptions,
Customers and Billing Portal configuration**.

So the live inventory below is **unverified** — neither present nor absent:

| Resource | Status |
|---|---|
| Live Plus Product | requires manual Dashboard confirmation |
| Live monthly Price | requires manual Dashboard confirmation |
| Live annual Price | requires manual Dashboard confirmation |
| Live Customer Portal configuration | requires manual Dashboard confirmation |
| Live Smart Retry / failed-payment email settings | requires manual Dashboard confirmation |
| Existing live Subscriptions | requires manual Dashboard confirmation |

**Resolve this before the activation task begins**, by either:

1. the owner confirming each item in the Stripe Dashboard and recording the
   result here, or
2. issuing a **read-only** restricted key scoped to exactly Products, Prices,
   Subscriptions, Customers and Billing Portal configuration, so the inventory
   can be captured mechanically.

Do not widen the existing key inside a documentation task.

### Live Portal configuration to require

The sandbox Portal configuration is the reference, and it is the shape to
reproduce in live mode:

| Feature | Required setting | Why |
|---|---|---|
| Payment method update | **enabled** | the proven recovery path |
| Invoice history | **enabled** | surfaces the failed invoice and its pay flow |
| Subscription cancel | **enabled, mode `at_period_end`**, proration none | matches the app's `cancelAtPeriodEnd` model and the copy on `/you` |
| Cancellation reason | enabled | retention signal, no behavioural effect |
| Subscription update (plan switching) | **disabled** | plan changes are unproven end to end; a Portal-side switch would move a subscriber to a price the app has never classified |
| Quantity update | **disabled** | the entitlement model is per-account, not per-seat |
| Subscription pause | **disabled** | no paused-state handling exists in the app |
| Customer update | name / email / address / phone | matches sandbox |

### Live webhook endpoint to create

New, separate, and never the giving endpoint:

- targets the production Worker's **`/billing/webhook`** route
- API version pinned to **`2026-06-24.dahlia`**
- event set: `checkout.session.completed`, `checkout.session.expired`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
  Confirm against `convex/http.ts` and `worker/src/index.js` at activation time
  rather than trusting this list.

### Live restricted key for the application

The application's live Stripe key must permit exactly what the code calls and
nothing more: Customers (read/write), Checkout Sessions (write), Subscriptions
(read), Invoices (read), Billing Portal Sessions (write), Prices and Products
(read). **No Test Clock permission** — Test Clocks do not exist in live mode and
the harness must never be reachable there.

---

## 4. Production Worker

**Service:** `hope-finder-worker`. Its `CONVEX_SITE_URL` variable already points
at production Convex, so no change is needed there. The `/billing/webhook` route
verifies the Stripe signature over the **verbatim** request bytes and forwards
to `/billing/subscription-event` with a shared server-to-server header. Logging
records the event type, the forwarded status and a refusal reason — never a
payload and never a secret. The Worker holds **no** Stripe API credential by
design (rule C5): it verifies and forwards, and all Stripe API access lives in
Convex.

**Secrets present today:** `ANTHROPIC_API_KEY`, `BIBLE_API_KEY`,
`JOURNEY_TRANSLATE_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`UNSPLASH_ACCESS_KEY`.

**Must be added:** `STRIPE_BILLING_WEBHOOK_SECRET` (the signing secret of the
new live billing endpoint) and `BILLING_WEBHOOK_SECRET` (a freshly generated
shared secret, set identically on production Convex and nowhere else).

> **Hygiene finding — resolve before activation.** `STRIPE_SECRET_KEY` and
> `STRIPE_WEBHOOK_SECRET` are still set on the production Worker and are
> **referenced nowhere in its source**. They are leftovers from the retired
> giving product, and they contradict the C5 rule that the Worker holds no
> Stripe credential. Two live-mode Stripe secrets sitting unused on an
> internet-facing service is avoidable exposure. Rotate or remove them as a
> separate, deliberate step — not folded into activation.

**Rollback:** capture the current deployment version id before deploying, so
`wrangler rollback` has an explicit target rather than a guess.

---

## 5. Public web application

Verified in the sandbox and expected to hold in production:

- `/pricing` renders monthly and annual, currently with a disabled CTA
- Checkout return routes and the Portal return route exist and were verified by
  `verify-checkout-return-pages` (122/122)
- signed-out, signed-in-Free and signed-in-Plus states each render correctly
- `/you` renders four distinct plan states — free, active, attention, ending —
  each with its own badge treatment and copy
- canonical domain `declareandbelieve.com`, HTTPS enforced by Cloudflare
- no Stripe identifier appears in any rendered page in any state
- English and Spanish parity is promised for the plan and pricing strings

**To confirm at activation:** analytics events on the Checkout and Portal paths,
and that privacy and terms links are reachable from the pricing and Checkout
surfaces.

---

## 6. Dunning: the one non-negotiable

**Production must not ship with silent dunning.** Before the pricing CTA is
enabled, one of these must be true and recorded:

- **A.** Stripe failed-payment customer emails are **enabled** in live mode, or
- **B.** A separately verified application-owned failed-payment notification
  exists, with delivery proven end to end — not merely coded.

For the record: sandbox failure emails were **disabled**, so no notification
path has been exercised at all. Hosted Portal recovery **is** now verified, so
once a subscriber is told, the path they follow works. Nothing tells them yet.

Also required:

- **Smart Retry configuration must be confirmed manually in live mode.** The
  sandbox is set to up to 8 retries over two weeks with a **final action of
  cancel**. Confirm the live final action deliberately: cancel and leave-unpaid
  produce very different outcomes for a real subscriber.
- **The automatic retry cadence has never been observed firing**, in any
  environment. Do not describe it as tested.
- Monitoring must alert on `invoice.payment_failed`.
- Monitoring must confirm every failure reaches a terminal outcome —
  `invoice.paid`, `unpaid`, or cancellation. An alert with no resolution check
  is how a silently cancelled subscriber goes unnoticed.

---

## 7. Activation sequence

Each stage is separately authorized. Do not merge stages.

### Stage 0 — read-only (no authorization beyond this document)
Complete the live inventory of §3 by Dashboard confirmation or a scoped
read-only key. Capture a production non-impact baseline: Convex row counts,
function-spec totals, Worker version id, and the existing live subscriber set.

### Stage 1 — manual Dashboard configuration (live writes, owner-performed)
Create or confirm the live Plus Product, monthly Price and annual Price.
Configure the live Customer Portal to the table in §3. Set failed-payment emails
per §6. Confirm Smart Retry and its final action.

### Stage 2 — secret creation
Create the live restricted API key scoped per §3. Create the live billing
webhook endpoint per §3 and capture its signing secret. Generate a fresh shared
`BILLING_WEBHOOK_SECRET`. Handle the stale Worker Stripe secrets from §4.

### Stage 3 — platform environment
Set on production Convex: `STRIPE_SECRET_KEY`,
`STRIPE_PLUS_MONTHLY_PRICE_ID`, `STRIPE_PLUS_ANNUAL_PRICE_ID`,
`BILLING_WEBHOOK_SECRET`. Set on the production Worker:
`STRIPE_BILLING_WEBHOOK_SECRET`, `BILLING_WEBHOOK_SECRET`. Confirm `SITE_URL`
is the canonical production domain — every Checkout and Portal return URL is
built from it.

### Stage 4 — deployment
Deploy Convex to production, then the Worker. Verify the webhook endpoint
reports deliveries succeeding **before** anything user-facing changes.

### Stage 5 — controlled real-money smoke transaction
A single real purchase on an owner-controlled account and a real card, performed
while the public CTA is still disabled.

- monthly Checkout end to end, entitlement granted
- annual Checkout end to end, entitlement granted
- Portal opens, invoice history correct, payment method update works
- cancel at period end, confirm `cancelAtPeriodEnd` and the `/you` ending state
- reverse the cancellation, confirm the active state returns
- **Decide in advance:** refund the smoke charge, or retain the subscription as
  a live monitoring canary. Record the decision before charging, not after.

### Stage 6 — public pricing activation
Enable the pricing CTA only after every stage above has passed.

### Stage 7 — observability and rollback
Alerts per §6. Roll back if any of these fire:

- webhook delivery failure rate above a small threshold over 15 minutes
- any entitlement granted without a matching canonical subscription row
- any duplicate subscription created for one account
- any Checkout success that does not produce Plus within one minute

Rollback: disable the pricing CTA first (a frontend change, fastest and
reversible), then `wrangler rollback` to the captured Worker version, then roll
back the Convex deployment. Owner performs each step; none is automated.

---

## 8. Authorization boundary

Every live-mode write in Stages 1 through 6 requires explicit, specific
authorization at the time it is performed. Blanket approval of this runbook is
**not** approval to execute it.

Standing prohibitions until then: no live Stripe object may be created or
modified, no production Convex variable set, no Worker deployed, no real-money
transaction performed, and production activation must not be marked complete.
