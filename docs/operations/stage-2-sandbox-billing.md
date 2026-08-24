# Stage 2 — sandbox billing, verified

**Status: resume steps 1, 2 and 3 are complete.** A monthly Plus subscription
has been purchased end to end through the real app in the sandbox: Checkout,
payment, all three webhooks, and the Convex entitlement. The provisional field
readers have been confirmed against real pinned-version payloads and
narrowed to the one location each field occupies (§6.8, §6.9).
**No Portal configuration exists, no annual plan has been exercised, and
nothing in live mode has been touched.**

> **Open item:** two earlier Checkout Sessions are still `open` and still
> payable. See the finding at the end of §6.8.

Recorded 2026-08-21.

---

## 1. Sandbox objects

Account **`acct_1TmENuLShxhb4mBz`** — *Declare checkout dev*. Everything below
is `livemode: false`. The live account is `acct_1Mf55qLL3Uli7L4x`, a separate
object space that Stage 2 never addresses.

| Object | Id | Detail |
|---|---|---|
| Product | `prod_V6voPpxBKesWPc` | Declare Plus, `tax_code: null` |
| Price — monthly | `price_1U6hytLShxhb4mBzduppVOya` | 899 usd/month, `plus_monthly_usd_v1`, exclusive |
| Price — annual | `price_1U6i0TLShxhb4mBzAldYiOcA` | 7999 usd/year, `plus_annual_usd_v1`, exclusive |
| Webhook endpoint | `we_1U6iKwLShxhb4mBzE0uOMDR2` | pinned `2026-06-24.dahlia`, 8 events |

Neither Price has a trial. The webhook endpoint targets the **dev** Worker, never
production.

## 2. Verified path

```
Stripe (sandbox)
  └─ POST https://hope-finder-worker-dev.thinktoro.workers.dev/billing/webhook
       Worker: verify HMAC-SHA256 signature, bound body, forward VERBATIM
  └─ POST https://good-dotterel-906.convex.site/billing/subscription-event
       Convex: shared-secret check, event filter, fetch subscription,
               classify (C2), apply
```

**First green delivery: `checkout.session.expired` → `HTTP 200 ok`.**

`checkout.session.expired` is a good first probe precisely because it carries no
subscription: it exercises signature verification, the shared-secret handshake,
the event filter and the acknowledge path without creating or mutating any
account state.

### Deployed dev Worker version

| | |
|---|---|
| Service | `hope-finder-worker-dev` |
| Version | **`95ca744d-71c4-4fe7-b505-e5ddcefe0d96`** |
| Carries | the signature-diagnostics patch (structured rejection reasons, secret trim, header-part trim) |

**Re-verified after that deploy: `checkout.session.expired` → `HTTP 200 ok`.**

This is the regression that matters. Changing `verifyStripeSignature` from a
boolean to `{ ok, reason }` touched the single function standing between the
public internet and every billing state change, so the path was re-exercised
against a real Stripe-signed event rather than trusted to the offline suite
alone. A green delivery on this version proves the refactor preserved
verification behaviour end to end, not just in `scripts/verify-webhook-signature.ts`.

Recording the version id matters because `wrangler secret put` also creates a
new Worker version. Without an id written down, "the dev Worker" is ambiguous
between a code deploy and a secret change, and the two have very different
implications when something breaks.

## 3. Configuration — names only, no values

### Convex dev `good-dotterel-906`

| Name | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | the **only** Stripe runtime credential, `rk_test_…` |
| `BILLING_WEBHOOK_SECRET` | shared secret, Worker → Convex |
| `STRIPE_PLUS_MONTHLY_PRICE_ID` | `price_1U6hytLShxhb4mBzduppVOya` |
| `STRIPE_PLUS_ANNUAL_PRICE_ID` | `price_1U6i0TLShxhb4mBzAldYiOcA` |
| `SITE_URL` | **temporarily `http://localhost:4321`** for local auth, see §6.5. Revert value: `https://feat-declare-checkout-dev.hope-finder-app.pages.dev` |

### Worker dev `hope-finder-worker-dev`

| Name | Purpose |
|---|---|
| `STRIPE_BILLING_WEBHOOK_SECRET` | Stripe endpoint signing secret |
| `BILLING_WEBHOOK_SECRET` | shared secret, must match Convex byte for byte |
| `CONVEX_SITE_URL` | set in `wrangler.toml`, points at dev Convex |

**`STRIPE_SECRET_KEY` is deliberately absent from the Worker** and its absence is
asserted by `scripts/verify-plus-classification.ts`. One Stripe credential, one
runtime, one pinned API version.

Production Convex `keen-hamster-650` and production Worker `hope-finder-worker`
hold none of these. The production Worker's `/billing/webhook` still answers
`500 Webhook not configured`, which is the gate working as designed.

## 4. Two incidents, and what they cost

Both were configuration. Neither was a defect in the billing logic. Recorded
because the diagnosis in each case was slower than it should have been, and the
fixes for *that* are what this checkpoint changes.

### 4.1 `400 Invalid signature`

The endpoint's signing secret was rotated after accidental exposure. An event
was signed on one side of that rotation while the Worker held the other secret.

Diagnosis was slow because **four different failures returned one opaque
`400 Invalid signature` with no log line**: no header, malformed header, stale
timestamp, and no matching `v1` were indistinguishable. Confirming the crypto
was correct required extracting the functions and testing them offline, then
probing the live endpoint.

Fixed by returning a structured reason, logging it, and keeping the HTTP
response opaque — telling an unauthenticated caller *which* check failed would
hand them an oracle. The signing secret is now also trimmed at the call site: a
trailing newline from a piped `wrangler secret put` is invisible in every
dashboard and fails identically to a wrong secret.

**Shipped** in dev Worker version `95ca744d-71c4-4fe7-b505-e5ddcefe0d96` and
re-verified with a live Stripe-signed event. Note that neither hardening change
would have prevented this particular incident, which was a secret rotated
between two deliveries. What they change is that the next failure is readable
from `wrangler tail` rather than requiring offline crypto extraction and a live
probe.

### 4.2 `503` → Worker `500 Downstream error`

`STRIPE_SECRET_KEY` on Convex dev held the literal text `pbpaste …` — a shell
command captured as a string rather than executed. `environmentForSecret()`
correctly refused to guess an environment from an unrecognised credential and
returned `503`.

**The guard behaved correctly.** Had it defaulted to `production`, a sandbox
event would have been evaluated against production rules. The 503 returns before
any logging, so Convex logs were silent and the Worker's `convex=503` line was
the only signal — which is exactly why that line exists.

Fixed by setting the real restricted runtime key. Diagnosed safely by reading
only the first 8 characters of the value, which is a key *prefix*, not key
material.

## 5. Diagnosing without exposing a secret

Both incidents were resolved without any secret value being read or printed.
These are the safe checks:

```bash
# Convex: variable NAMES only, values stripped before they are ever printed
npx convex env list | cut -d= -f1 | sort

# Convex: key PREFIX only — proves environment and key type, reveals nothing
npx convex env get STRIPE_SECRET_KEY | cut -c1-8      # expect rk_test_

# Worker: secret NAMES only. wrangler cannot print values at all
cd worker && npx wrangler secret list --env dev

# Which code is actually deployed, without reading it: the 1 MiB bound
# exists only in the current handler
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://hope-finder-worker-dev.thinktoro.workers.dev/billing/webhook \
  -H 'Content-Type: application/json' --data-binary @big.json   # 413 => current
```

A `400` from the dev endpoint means the environment gate passed and all three
Worker secrets are present. A `500 Webhook not configured` means one is missing.
That distinction identifies a whole class of problem in one request.

## 6. The development-only checkout control

**Resume step 1, done.** `billing.createCheckoutSession` now has exactly one
caller: `src/pages/dev/[control].astro`, reachable in development only at
`http://localhost:4321/dev/billing-sandbox`.

Until this page existed, production was protected *structurally* — the action had
zero callers, so there was nothing to click. It is now protected *conditionally*,
by two gates. That change in kind is why the page ships with its own suite,
`scripts/verify-billing-dev-control.ts` (98 checks).

### The two gates

| | Gate | Mechanism |
|---|---|---|
| A | route existence | dynamic route; `getStaticPaths` returns `[]` unless `import.meta.env.DEV && import.meta.env.PUBLIC_BILLING_DEV_CONTROL === '1'`, so `dist/dev/` is never generated |
| B | code existence | the same check, written with **inline literals** inside the client script, so Vite folds it to `if (false)` and esbuild drops the body including all three dynamic imports |

`import.meta.env.DEV` is the load-bearing half of both. This tree contains
`.env.local`, and **Vite loads `.env.local` in every mode, production builds
included** — so the public flag alone is not a gate. A stray
`PUBLIC_BILLING_DEV_CONTROL=1` in a Cloudflare Pages build setting, in CI, or in
`.env.local` would otherwise ship a working Checkout button. `DEV` is false in
every `astro build`. Same convention as the Journey pacing-lock bypass in
`src/pages/journey.astro`.

Verified three ways, all automated:

| Condition | Result |
|---|---|
| `PUBLIC_BILLING_DEV_CONTROL=1 npm run dev` | `/dev/billing-sandbox` → **200**, button renders |
| `npm run dev` with the flag absent | `/dev/billing-sandbox` → **404** |
| `PUBLIC_BILLING_DEV_CONTROL=1 npx astro build` | 12 pages, **no `dist/dev/`**; none of 140 text files in `dist/` contains `createCheckoutSession`, `plus-monthly`, `billing-sandbox`, the button label, or the flag name |

The third row is the one that matters: the build is deliberately **hostile**, run
with the flag on, because that is the shape a real accident takes.

### Manual verification, passed

Verified by Jeff on 2026-08-21 at `http://localhost:4321/dev/billing-sandbox`.

| Check | Result |
|---|---|
| signed-out state | checkout control **hidden** |
| signed-in state | button renders, reading `Stripe sandbox — no real charge` |
| Safari Network cleared, page reloaded, filtered for `createCheckoutSession` | **no requests** |
| the button | **not clicked** |
| Stripe | no Customer, Checkout Session, Subscription, invoice or payment created |

The Network row is the one the offline suite cannot produce. Section 6 of
`scripts/verify-billing-dev-control.ts` proves *structurally* that the action
call sits inside the click handler and that nothing binds to `DOMContentLoaded`,
a timer, or a form submit. Only a real page load in a real browser proves it
*behaviourally*. Both now exist, and they agree.

### 6.5 Local authentication, and the temporary env change it needed

Signing in at `http://localhost:4321` failed at first:

```
Origin http://localhost:4321 is not allowed by Access-Control-Allow-Origin
Fetch API cannot load https://good-dotterel-906.convex.site/api/auth/get-session
```

**Cause.** The auth CORS allow-list is derived entirely from `trustedOrigins` in
`convex/auth.ts:19`, which is `[process.env.SITE_URL]`. One entry, and there is
no second list to edit: with `registerRoutes(http, createAuth, { cors: true })`
the component computes its allowed origins as `trustedOrigins.concat([])`
(`@convex-dev/better-auth/dist/client/create-client.js:283-303`). The
`crossDomain({ siteUrl })` plugin reads the same variable.

Proven with a live preflight. Same server, same second, only the origin differs:

| Preflight `Origin:` | Response | `access-control-allow-origin` |
|---|---|---|
| `http://localhost:4321` | 204 | **absent** |
| `https://feat-declare-checkout-dev.hope-finder-app.pages.dev` | 204 | present |

That is why the browser reports a blocked fetch on a 204: the preflight succeeds
as an HTTP request while carrying no origin grant.

**Fix applied: an environment variable on Convex dev only.** No code change, no
`convex dev` push, no deploy.

> **Convex dev `good-dotterel-906` currently has
> `SITE_URL = http://localhost:4321`.** This is a temporary development value.

Revert when local work ends:

```bash
cd /Users/jeff/dev/projects/hope-finder-app
npx convex env set SITE_URL https://feat-declare-checkout-dev.hope-finder-app.pages.dev
```

**Development only, by construction.** `npx convex env set` targets whatever
`CONVEX_DEPLOYMENT` in `.env.local` selects, which is `dev:good-dotterel-906`.
Production `keen-hamster-650` holds its own `SITE_URL` and was not touched.
Localhost is not present in any production configuration and must never be added
to one.

Two consequences hold while the value stays local:

1. `trustedOrigins` has exactly one entry, so this **swaps** the allowed origin
   rather than adding to it. The Cloudflare Pages preview
   `feat-declare-checkout-dev.hope-finder-app.pages.dev` will fail CORS the same
   way until the revert above is run.
2. `convex/billing.ts:51` builds the Checkout `success_url` and `cancel_url` from
   the same variable, so a session created from the dev control returns to
   localhost. For resume step 2 that is what we want. Note separately that
   `/checkout/success` and `/checkout/cancelled` do not exist as pages yet, so
   that return lands on a 404 regardless of origin. It surfaces at resume step 3,
   not before.

### The entire client-to-Convex payload

```js
await client.action(api.billing.createCheckoutSession, { plan: 'plus-monthly' });
```

A hardcoded literal, and nothing else. No Price id, no user id, no email, no
customer id, no subscription id, not even `lang`. The only other thing crossing
the wire is the Better Auth JWT set via `client.setAuth(token)`. This is
enforced by the action's own args validator — `{ plan, lang }` — so there is no
field to spoof, and the suite asserts that validator has not grown one.

`src/pages/pricing.astro` is unchanged and stays non-transactional: the public
Plus CTA is still a `disabled` "Opening soon" button, the page loads no script,
and the suite asserts both.

### What the click creates

Predicted before resume step 2, and confirmed by it. Only in sandbox
`acct_1TmENuLShxhb4mBz`, and only on a click:

1. **Stripe Customer** — only if `billingCustomers` holds no mapping. Email from
   the authenticated profile, `metadata[userId]`, `metadata[environment]=sandbox`,
   idempotency key `cust:<userId>`.
2. **Convex `billingCustomers` row** — the userId to customer mapping.
3. **Stripe Checkout Session** — `mode=subscription`, one line item
   `price_1U6hytLShxhb4mBzduppVOya`, `client_reference_id=<userId>`,
   `automatic_tax[enabled]=false`, five provenance fields on both `metadata` and
   `subscription_data[metadata]`, idempotency key
   `co:<userId>:plus_monthly:<5-minute bucket>`.

No Subscription, Invoice, PaymentIntent or PaymentMethod exists until the hosted
Checkout form is completed with a test card. The page displays the returned URL
and **does not navigate to it** — creating a session and opening Checkout are two
separate, deliberate clicks, so the second one is never an accident of the first.

### 6.6 Finding an app-created Checkout Session in the Stripe Dashboard

**Current verified sandbox Checkout Session:**

```
cs_test_a1Ge895PE7oCtkOrGBEmAOopfj9IVSAEMSlrbKyTCFrNcWsSE197IYMjmN
```

Related Customer: `cus_V7BLkBE2Tz1hPY`.

#### The navigation that works

```
Stripe Dashboard
  → select sandbox "Declare checkout dev"
  → Workbench
  → Inspector
  → paste the Checkout Session ID into the "Inspecting" field
  → select "Checkout Session" in the Data map
  → Overview
  → Object data
```

Then find the provenance keys by searching **within Object data** for
`metadata`.

#### What does not work, and why it is written down

Three dead ends cost time on the first attempt. They are recorded so the second
attempt does not repeat them.

| Path | Outcome |
|---|---|
| Global Dashboard search | **Did not return this Checkout Session.** Do not conclude the session does not exist. |
| Workbench → Webhooks | Shows **webhook deliveries**, not Checkout Session records. A session created by the app emits no webhook event at all, so this view is empty by design and is not evidence of anything. |
| Workbench → **Inspector** | **The reliable location.** Use this one. |

The related Stripe **Customer appears in the Inspector's left-side Data map**
alongside the Checkout Session, so both objects are inspectable from one paste
without a second lookup.

**Do not use "Edit in API Explorer" for read-only verification.** It stages a
mutation against a live object, and the whole point of this pass is that nothing
is modified. Inspector → Overview → Object data is read-only.

#### Why the Dashboard is currently the only way to read the metadata

The Stripe MCP server blanket-redacts the `metadata` field on Checkout Sessions
and Customers, returning the literal string `"[REDACTED]"` whether the object is
populated or empty. It does **not** redact `metadata` on Price objects, which is
how we know the redaction is per-object-type rather than value-dependent — so
`"[REDACTED]"` proves nothing either way about presence.

Customer metadata can still be proven without reading it, by searching instead:

```
GetCustomersSearch  metadata['userId']:'<id>' AND metadata['environment']:'sandbox'
```

A match proves both values; run a deliberately corrupted id as a control to show
the query is not simply permissive. There is no equivalent search endpoint for
Checkout Sessions, which is why the Inspector fills that gap.

Note also that `subscription_data` is **never** echoed back on a Checkout
Session object in any tool, Dashboard included. It exists only as a create-time
parameter and first becomes readable on the Subscription itself, at resume
step 3.

#### What must never be recorded

The Session **id** is safe to write down and is recorded above. The **hosted
Checkout URL is not**, and is deliberately absent from this repository: it opens
a live payment flow for anyone holding it. The same applies to the customer
email, the Convex user id, customer names, phone numbers and addresses, and any
token, key or secret.

### 6.7 Resume step 2, verified

The authenticated user clicked the dev control **once** on 2026-08-21. Read-only
verification followed; nothing was modified, opened, expired or completed.

| Object | Id |
|---|---|
| Checkout Session | `cs_test_a1Ge895PE7oCtkOrGBEmAOopfj9IVSAEMSlrbKyTCFrNcWsSE197IYMjmN` |
| Customer | `cus_V7BLkBE2Tz1hPY` — **created**, not reused |

The user id, email, name, phone and hosted Checkout URL are deliberately not
recorded here. See the closing note in §6.6.

#### Configuration, as read back from Stripe

| Check | Value |
|---|---|
| Account | `acct_1TmENuLShxhb4mBz` *Declare checkout dev* |
| `livemode` | `false` |
| `mode` | `subscription` |
| `status` | `open` |
| `payment_status` | `unpaid` |
| Price | `price_1U6hytLShxhb4mBzduppVOya`, lookup key `plus_monthly_usd_v1` |
| Amount | `amount_total: 899` `usd` = **$8.99** |
| Product | `prod_V6voPpxBKesWPc`, "Declare Plus" |
| Line items | exactly one, quantity 1 |
| `automatic_tax.enabled` | `false` |
| Trial | none — Price `recurring.trial_period_days: null`, `interval: month` |
| `success_url` | `http://localhost:4321/checkout/success?session_id={CHECKOUT_SESSION_ID}` |
| `cancel_url` | `http://localhost:4321/checkout/cancelled?plan=plus-monthly` |

The localhost return URLs are correct for this phase and follow directly from the
temporary `SITE_URL` in §6.5.

#### Ownership was derived from the authenticated user

Three independent records carry the same Convex user id. That agreement is the
proof, since no browser input could have set all three:

1. Checkout Session `client_reference_id`
2. Stripe Customer `metadata['userId']`
3. Convex `billingCustomers.userId` on `good-dotterel-906`

Point 2 was established **without reading the value**, using the search technique
in §6.6: `metadata['userId']:'<id>' AND metadata['environment']:'sandbox'` matched
exactly this Customer and nothing else, while a control query with a deliberately
corrupted id returned an empty set. A search that matches everything would prove
nothing, so the control is what makes the positive result meaningful.

Timestamps corroborate a single click: Customer `18:15:20 UTC`, Session
`18:15:21`, Convex mapping `18:15:21.174`.

#### Convex dev state

| Table | Result |
|---|---|
| `billingCustomers` | exactly **one** row, mapping the user to `cus_V7BLkBE2Tz1hPY` |
| `subscriptions` | **empty** |
| `billingEvents` | **empty** |

`billingEvents` being empty is correct, not a gap: creating a Checkout Session
emits no webhook event, so there was nothing for the Worker to forward. Reading
it as a failure would send someone debugging a working system.

#### No Subscription and no payment

| Probe | Result |
|---|---|
| Subscriptions, `status: all`, whole sandbox | **0** |
| Invoices for this Customer | **0** |
| PaymentIntents for this Customer | **0** |
| Session `subscription` / `invoice` / `payment_intent` | all `null` |
| Customer `balance` / `delinquent` / `next_invoice_sequence` | `0` / `false` / `1` |
| Convex `subscriptions` | empty |

`next_invoice_sequence: 1` is independent evidence that no invoice has ever been
issued to this Customer, separate from the invoice list being empty.

#### Two things this pass did not prove

> Both were resolved at resume step 3. See §6.8.

Recorded because the tables above would otherwise imply more than was verified.

1. **The Session's provenance metadata was not read.** The Stripe MCP server
   redacts it, as explained in §6.6, and there is no search endpoint for Checkout
   Sessions. `client_reference_id` being set is strong circumstantial evidence,
   since `convex/billing.ts` writes it into the same request the provenance loop
   populates, but circumstantial is not verified. Read it in the Dashboard via
   §6.6 if certainty is wanted now.
2. **`subscription_data.metadata` is not verifiable by anyone yet.** Stripe never
   echoes `subscription_data` back on a Checkout Session; it becomes readable on
   the Subscription, at resume step 3. The same limit applies to any
   `subscription_data` trial setting, so "no trial" above rests on the Price
   carrying none and on `convex/billing.ts` sending no trial parameter.

Neither gap is dangerous in the direction that matters. If the provenance were
missing, `classifyPlusSubscription` rejects at webhook time with
`provenance-source` or `plan-metadata-missing` and grants nothing. The failure
mode is refusing a legitimate purchase, never granting an illegitimate one.

### 6.8 Resume step 3, verified — the purchase works end to end

The hosted sandbox Checkout was completed with a test card on 2026-08-21.
Stripe redirected to `http://localhost:4321/checkout/success`, which **404s
because that route does not exist yet**. That is expected at this stage and is
listed in §7. The redirect is cosmetic; every record below was created by the
webhook path, not by the return URL.

| Object | Id |
|---|---|
| Checkout Session (completed) | `cs_test_a1Xb8jTcxo2YB7OMyYZqBfUTomLEAdFwLvA3mSSLLaY0T9c3xhiRHi2sLk` |
| Customer | `cus_V7BLkBE2Tz1hPY` — **reused**, not recreated |
| Subscription | `sub_1U6yXVLShxhb4mBzedFqJMQ0` |
| Invoice | `in_1U6yXULShxhb4mBzLJTRiksn`, number `NZWTK7MY-0001` |
| PaymentIntent | `pi_3U6yXULShxhb4mBz0Gk4PDBe` |
| Subscription item | `si_V7CxTE1NcDXn0s` |

Session `complete` / `paid`, subscription `active`, invoice `paid`
(`amount_paid: 899`, `billing_reason: subscription_create`, `attempt_count: 0`),
PaymentIntent `succeeded`. No trial, `automatic_tax.enabled: false`,
`cancel_at_period_end: false`. Period `2026-08-21 19:55:44Z` →
`2026-09-21 19:55:44Z`. Exactly one Customer and one Subscription exist in the
whole sandbox.

**`subscription_data.metadata` is confirmed**, closing the gap §6.7 left open.
All five provenance fields were proven in one search, with a corrupted-user-id
control returning empty:

```
metadata['plan']:'plus_monthly'
  AND metadata['source']:'convex.billing.createCheckoutSession'
  AND metadata['billing_schema_version']:'1'
  AND metadata['environment']:'sandbox'
  AND metadata['userId']:'<authenticated user id>'
```

#### Webhook delivery

| Event | Event id | Convex |
|---|---|---|
| `invoice.paid` | `evt_1U6yXXLShxhb4mBzUZb7PHPc` | 200, applied `19:55:47.627Z` |
| `customer.subscription.created` | `evt_1U6yXXLShxhb4mBz9PRMd8FS` | 200, applied `19:55:48.010Z` |
| `checkout.session.completed` | `evt_1U6yXXLShxhb4mBzin7ueTRg` | 200, applied `19:55:48.189Z` |
| `customer.subscription.updated` | — | **none generated** |

`customer.subscription.updated` **is** among the endpoint's 8 enabled events, so
its absence means Stripe did not generate one during completion. Not a missed
delivery.

**The events arrived out of order.** `invoice.paid` landed *before*
`customer.subscription.created`. The ordering guard in `applyWebhook` compares
`eventCreated` against `lastProviderEventAt` and the final state is correct.
Anyone who assumes Stripe delivers lifecycle events in causal order will write a
bug; this run is the evidence that it does not.

Delivery codes are read from the **Convex** side: a `billingEvents` row exists
only after `applyWebhook` completes, and the handler then returns 200. The
Stripe Events API is **not exposed by the Stripe MCP server** (`GetEvents`
returns "Operation is not available", which is the server not offering it, not a
permission gap), so Stripe's own delivery log must be read in the Dashboard via
Workbench → Webhooks — the one thing §6.6 notes that view is genuinely for.

#### Convex dev `good-dotterel-906`

One `subscriptions` row: `provider: stripe`, `planKey: plus_monthly`,
`environment: sandbox`, `tier: plus`, `status: active`, `cancelAtPeriodEnd:
false`, `billingInterval: month`. `stripeCustomerId`, `stripeSubscriptionId`,
`stripePriceId`, `latestInvoiceId`, `currentPeriodStart` and `currentPeriodEnd`
all match Stripe exactly. `billingCustomers` was **reused** — still the row
created at step 2, untouched. `billingEvents` holds three rows, one per event,
deduplicated structurally by the `by_provider_event` check that returns
`{ ok: true, deduped: true }` before any work.

The client contract exposes no provider identifier. An unauthenticated
`getMyEntitlements` returns exactly twelve keys — `tier`, `subscriptionStatus`,
`paymentNeedsAttention`, `graceEndsAt`, `provider`, `planKey`,
`duplicateProviders`, `accountDay`, `timezone`, `limits`, `usage`, `remaining` —
and no `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`,
`latestInvoiceId`, `metadataUserId` or `userId`. `provider` is the enum
`"stripe"`, not an id.

For the signed-in account the resolver yields **Plus** deterministically:
`interpret` matches `status === "active"` with `cancelAtPeriodEnd: false`, and
`resolveAcrossProviders` over one row gives `provider: "stripe"`, `planKey:
"plus_monthly"`, `duplicateProviders: false`. This one line is **derived from
the code and the row, not executed** — the Convex CLI cannot supply a user
identity — so it is the only claim here that a signed-in page load would
strengthen.

#### Field shapes under `2026-06-24.dahlia`

| What | Location |
|---|---|
| Subscription period start/end | **`subscription.items.data[0].current_period_start` / `.current_period_end`** — absent from the subscription root |
| Invoice → subscription | **`invoice.parent.subscription_details.subscription`** — no top-level `invoice.subscription` |
| Checkout Session → subscription | `session.subscription`, top level, plain string. Unmoved. |
| Cancellation state | `subscription.cancel_at_period_end`, with `cancel_at`, `canceled_at`, `cancellation_details`. Top level, unmoved. |

**Both provisional readers took their fallback branch, and both were right.**
`readPeriod` fell through `sub.current_period_start` (absent) to the item;
`readInvoiceSubscriptionId` fell through `obj.subscription` (absent) to
`obj.parent.subscription_details.subscription`. Those payloads are what
justified narrowing them; see §6.9.

Had either assumed the older location, this purchase would have written a row
with **no period bounds** — and both the `past_due` grace window and the
cancel-at-period-end rule read `currentPeriodEnd`. Accepting both locations
rather than guessing one is what made this run succeed on the first attempt.

One limit worth stating: the MCP read tool cannot set `Stripe-Version`, so the
shapes above are what the MCP client's version returned. What proves the
*pinned* behaviour is the Convex row, populated from
`stripeApi.fetchSubscription`, which sends `Stripe-Version: 2026-06-24.dahlia`
on every request.

#### Finding: two Checkout Sessions are still open and still payable

| Session | Created | Status | Expires |
|---|---|---|---|
| `cs_test_a1Ge895P…` | 18:15:21Z | **open** | 2026-08-22 18:15:21Z |
| `cs_test_a1oSCrSX…` | 19:32:08Z | **open** | 2026-08-22 19:49:21Z |
| `cs_test_a1Xb8jTc…` | 19:49:21Z | complete, paid | — |

Three sessions from three clicks is expected: the idempotency key buckets on a
five-minute window and the clicks were 77 and 17 minutes apart, and at each
click no subscription row existed yet, so the duplicate guard correctly allowed
a retry. No duplicate Customer or Subscription was created.

The risk is what happens next. Both open sessions still have live hosted URLs
for roughly 22 hours, both carry genuine provenance metadata, and nothing
expires them now that a subscription is active. **If either is completed, Stripe
creates a second active subscription on the same Customer and bills $8.99
twice.** The webhook would accept it, because the provenance is real. Worse,
`applyWebhook` falls back to a `by_user_provider` lookup, so it would
**overwrite the same row**, repointing `stripeSubscriptionId` at the new
subscription: Convex would show one tidy row reading Plus while Stripe billed
twice and the first subscription became invisible to us.

The double-purchase guard lives only in `createCheckoutSession`, never at
webhook time. A fourth click is now correctly refused with `already-subscribed`,
but a session minted *before* the subscription existed bypasses that guard
entirely.

Not yet acted on. Two options: let both expire naturally and simply do not open
them, or expire them deliberately, which is a Stripe write. The durable fix is a
webhook-time guard that refuses a second Stripe subscription for a user who
already holds an active one rather than silently overwriting. No code has been
changed.

### 6.9 The field readers, narrowed

Resume step 6. The readers in `convex/http.ts` accepted two locations each
while the real shape was unknown. §6.8 captured it, so they now accept one.

| Reader | Was | Now |
|---|---|---|
| `readPeriod` | `sub.current_period_start ?? item.current_period_start` | **`sub.items.data[0].current_period_start`** only |
| `readInvoiceSubscriptionId` | `obj.subscription`, else `obj.parent.subscription_details.subscription` | **`obj.parent.subscription_details.subscription`** only |

Unchanged on purpose, because §6.8 showed neither moved: the Checkout Session
link stays `session.subscription` at the root, and cancellation stays
`cancel_at_period_end`, `cancel_at`, `canceled_at` and `cancellation_details` at
the subscription root.

The expanded-object form is still accepted at the one surviving location for the
invoice link, since `expand` changes the shape of the value, not where it lives.

#### Why removing the fallbacks is a safety improvement, not just tidying

Tolerating both locations was correct while the shape was unknown: it was the
absence of a guess, not a guess. Keeping them now would be worse than useless. A
payload carrying **only** the old root-level fields is not a valid
`2026-06-24.dahlia` payload. It could only come from version drift — an unpinned
client, a replayed archive, a hand-built object — and silently accepting it
would let that drift flow into the entitlement tables looking perfectly healthy.
Failing closed surfaces it instead.

Failing closed is safe here because `applyWebhook` spreads period fields in only
when present, so a bad payload leaves prior good state untouched rather than
overwriting it with `undefined`, and a missing subscription id acknowledges
without applying. Both are asserted.

These readers are tied to `stripeApi.STRIPE_API_VERSION`. **If that pin ever
moves, re-capture real payloads and re-narrow. Do not widen speculatively.**

#### Regression coverage

`scripts/verify-plus-classification.ts` grew from 44 to **96 checks**, in three
new sections built on the real 2026-08-21 shapes — genuine ids and timestamps,
nothing invented:

- **§8 readers** — dahlia shapes accepted; obsolete root-level period and
  top-level `invoice.subscription` produce no values; when *both* shapes are
  present the pinned one wins; 15 malformed inputs all fail closed
- **§9 classification and entitlement** — the real subscription still
  classifies as `plus_monthly`, and the row Convex actually wrote still resolves
  to Plus. A `past_due` row with no period still gets a *bounded* grace deadline,
  which is precisely the corruption a widened reader could have caused
- **§10 out-of-order delivery** — the real run delivered `invoice.paid` before
  `customer.subscription.created`, so the ordering and dedup guards are asserted
  against that sequence

The two readers are **extracted from `convex/http.ts` verbatim** and executed,
not reimplemented. Note that the brace-walking used on the plain-JS Worker does
not work on TypeScript here: a return type like `: { start?: number }` contains
braces and the walk terminates on the annotation instead of the body. The
extractor slices to the first `}` at column zero and swaps the signature by
exact string, so a signature change throws loudly rather than silently testing
something else.

**Verified by mutation.** Re-introducing both fallbacks makes exactly 7 of the
new assertions fail. A test that passes against both the fixed and the broken
code proves nothing, so this was checked rather than assumed.

### 6.10 The duplicate-subscription guard

The finding at the end of §6.8 is now closed in code.

#### The failure mode

`createCheckoutSession` already refuses a second purchase while a live
subscription exists. **That guard runs at checkout time, and checkout time is
too early.** A Checkout Session minted *before* the first subscription existed
stays payable for 24 hours. Completing it later creates a genuine second Stripe
subscription that the checkout guard never saw, because when that Session was
created there was nothing to refuse.

What happened next was the real damage. `applyWebhook` resolved which row to
write by falling back to `by_user_provider`, so a webhook carrying subscription
**B** would `patch` the row holding subscription **A**, repointing
`stripeSubscriptionId` in place. The result would have looked healthy: one tidy
Convex row reading Plus, while Stripe billed twice and subscription A became
invisible to us — absent from every read, unreachable through the Portal
mapping, and impossible to reconcile from our own data.

That is why checkout-creation protection alone is insufficient, and why the
guard had to move to webhook time.

#### Where it lives

`convex/subscriptions.ts` → `applyWebhook`, which is the **single mutation that
writes the `subscriptions` table** and the single call site `convex/http.ts`
uses for all seven billing events. Putting the check anywhere else — in
`createCheckoutSession`, in the Worker, or in one event branch — would leave
the other paths open.

The decision itself lives in `convex/subscriptionGuard.ts`, deliberately
dependency-free so the regression suite imports and executes the real function
rather than grepping for it. The Worker is unchanged and remains a
signature-verification and relay boundary; Convex stays authoritative.

#### The invariant

For one authenticated user and `provider: "stripe"`, a webhook resolving to a
**different** Stripe subscription id than the one already stored is refused
unless the stored subscription is genuinely finished.

**Statuses that permit replacement**, transcribed from what `billing.ts`
already treats as "finished, a new Checkout is the right answer" rather than
invented here:

| Status | Why replaceable |
|---|---|
| `canceled` | in `ALLOWS_NEW_CHECKOUT` |
| `incomplete_expired` | in `ALLOWS_NEW_CHECKOUT` |
| `ended` | in `ALLOWS_NEW_CHECKOUT` |
| `incomplete` | `billing.ts` lets it fall through — "their last attempt never completed, so a fresh Checkout Session is the correct recovery" |

`incomplete` being replaceable is load-bearing, not an oversight: it is the
documented retry path. If it were treated as nonterminal, this guard would
break the one recovery flow `billing.ts` explicitly supports.

**Everything else is nonterminal**, including `active`, `trialing`, `past_due`,
`unpaid`, and any status we do not recognise. `past_due` and `unpaid` are
deliberately *not* terminal because `entitlements.interpret` still grants Plus
through the 3-day grace window — they are recoverable, not finished. An
unrecognised status is nonterminal because `billing.ts` refuses to guess at one
and so does this.

A row with `cancelAtPeriodEnd` set is also nonterminal unless its status is
already `canceled`: they hold Plus through `currentPeriodEnd`, which is the
same check `billing.ts` makes independently of the status set.

#### What a conflict does, and does not do

On conflict the canonical row is **left entirely untouched** — customer id,
subscription id, price id, period, status, invoice id, tier, plan and
cancellation state all unchanged. No second canonical Stripe row is created,
and no entitlement is granted from the incoming subscription.

The event is **acknowledged with a 200** so Stripe stops retrying an event we
will never apply, and recorded exactly once in `billingEvents` with
`outcome: "duplicate-subscription-conflict"` plus the canonical and incoming
subscription ids and the user association. A structured line is logged for
alerting, carrying the event id but **not** the subscription ids — `http.ts`
already established that provider ids do not belong in logs, and the event id
is the key that finds the row holding them.

Deduplication is unchanged: the `(provider, eventId)` replay check still runs
first and remains authoritative, so re-delivering a conflict event returns the
deduped result without recording a second conflict or touching state.

#### What it deliberately does NOT do

**It protects our state. It does not touch Stripe.** No cancellation, no
refund, no credit note, no invoice change, no Stripe write API call of any
kind. A duplicate charge is a money decision that belongs to a human
remediation policy, not to a webhook handler running unattended.

So if Stripe ever does create a duplicate subscription, this guard prevents
silent Convex corruption but **the customer is still being billed twice** until
someone acts. The remediation is manual and still required:

1. Find the conflict row in `billingEvents`
   (`outcome = "duplicate-subscription-conflict"`) — it names both subscription
   ids and the user.
2. Confirm in Stripe which subscription is genuinely duplicative.
3. Cancel the duplicate in the Stripe Dashboard and refund or credit the
   charge, according to whatever policy is in force.
4. Only then decide whether the canonical row should change; it will not have
   moved on its own.

#### Regression coverage

`scripts/verify-duplicate-subscription-guard.ts`, 71 checks. The decision is
imported from `subscriptionGuard.ts` and executed — a copy would prove nothing
about the deployed path and a source grep would pass against a guard that never
runs. Covers the allow cases, every nonterminal status, cancel-at-period-end,
unrecognised and empty statuses, a missing incoming id, all four replaceable
statuses, out-of-order arrival in all three orders, and the source-level
guarantees that the guard precedes both writes and that dedup and the
entitlement contract are unchanged.

**Mutation-tested both ways.** Neutering the decision fails 22 behavioural
assertions; deleting the call site from `applyWebhook` fails 6 source-level
ones. Both were restored and the suite returns to 71/71.

#### Schema

`billingEvents` gains `outcome`, `conflictReason`, `canonicalSubscriptionId`,
`incomingSubscriptionId` and `userId`. **All optional**, so the three existing
sandbox rows stay valid; nothing was migrated or rewritten, and an absent
`outcome` reads as the ordinary applied path. None of it is reachable from
`getMyEntitlements`, which never queries this table.

### 6.11 The checkout return pages

`/checkout/success` and `/checkout/cancelled` now exist. Until this, a
completed sandbox payment redirected to a 404 — §6.8 recorded that, and it is
now closed.

| Route | File |
|---|---|
| `/checkout/success` | `src/pages/checkout/success.astro` |
| `/checkout/cancelled` | `src/pages/checkout/cancelled.astro` |

Both are the exact URLs `convex/billing.ts` already sends people to, and the
suite asserts that pairing so a rename on either side fails loudly rather than
producing another 404.

#### The success page confirms only from Convex

Stripe appends `?session_id={CHECKOUT_SESSION_ID}`. **That value is treated as
untrusted** — anyone can type a session id into the URL bar, so it proves
nothing about payment. The page:

- observes only that the parameter EXISTS, never reads its value;
- removes it from the visible URL with `history.replaceState`, so Back and a
  shared link do not carry it;
- never renders, stores, logs or transmits it.

Entitlement is confirmed **only** by `getMyEntitlements`, which becomes Plus
only after the signed webhook path has run. A subscription is confirmed by
Stripe talking to our Worker, not by a browser arriving at a URL.

The page performs no Stripe call, opens no Checkout Session, and writes
nothing.

#### States

| State | When | Behaviour |
|---|---|---|
| Signed out | no session | Links to `/signin?return=/checkout/success` using the existing `?return=` contract |
| Confirming | authenticated, not yet Plus | Polls `getMyEntitlements` |
| Confirmed | `tier === "plus"` | Continue to `/today`, or view `/you` |
| Needs attention | `paymentNeedsAttention` | Points at the account page and **never claims the subscription is active** |
| Timed out | bound reached | Says confirmation may still be processing and explicitly that **there is no need to pay again** |

`paymentNeedsAttention` wins over `tier === "plus"`, so a failing card can
never render as success.

**Polling is bounded**: roughly every 2 seconds, for roughly 30 seconds, with a
single-flight guard so a slow response cannot stack requests, stopping on
confirmation, on the attention state, when the tab is hidden, and on
`pagehide`. It never creates a Checkout Session.

#### The cancelled page is inert

It states Checkout was cancelled and that **this page** did not start a
subscription. It deliberately does **not** claim whether a charge occurred —
landing here is not evidence either way, and the account page is the honest
answer. It runs no Convex query or mutation, makes no Stripe call, and **never
auto-retries or resumes Checkout**.

The `?plan=` parameter is **allowlisted** before use (`plus-monthly`,
`plus-annual`). An unrecognised value renders nothing rather than echoing
attacker-chosen text back onto the page.

#### Neither page activates public billing

The public pricing CTA is still a disabled "Opening soon" button, and the
production build still contains no Checkout trigger. One nuance worth
recording: the string `plus-monthly` now DOES ship to production, as an
allowlist key in `src/app/declare/checkout-return.js` so the cancelled page can
name a plan. It is a lookup table with no action attached, so the build
assertions in both `verify-billing-dev-control.ts` and
`verify-checkout-return-pages.ts` were narrowed from the bare alias to the
alias in **payload position** (`plan:"plus-monthly"`), which is what a real
Convex action call compiles to and what an allowlist can never produce.

#### Regression coverage

`scripts/verify-checkout-return-pages.ts`, 118 checks, importing and executing
the real decisions from `checkout-return.js` rather than restating them.

**Mutation-tested both security-critical properties.** Making the success page
trust `session_id` fails 3 assertions; removing the polling bound fails 1. Both
restored, suite back to 118/118.

### 6.12 Annual, Portal and lifecycle controls — prepared, not exercised

**Status: the code exists and is tested. None of it has been run against
Stripe.** No annual Checkout Session, no Portal session, no cancellation and no
payment failure has been created. This section records what was built and what
is deliberately still outstanding, so the difference between "implemented" and
"verified" stays visible.

Three things arrive together because they are one testing surface: you cannot
verify a cancellation without the Portal to cancel from, and you cannot see the
result of either without something that reads lifecycle state back.

#### What was added

| Control | Where | What it does |
|---|---|---|
| Annual Checkout | `#dbGoAnnual` on `/dev/billing-sandbox` | Sends `{ plan: 'plus-annual' }` and nothing else |
| Billing Portal | `#dbPortal` on the same page | Sends an **empty** payload |
| Lifecycle inspector | `#dbInspect` on the same page | Read-only projection of the entitlement response |

Both gates from §6.5 still apply unchanged — a dynamic route that generates zero
pages, and an inline-literal `import.meta.env.DEV` check that Vite folds away.
All three controls are absent from a production build made with
`PUBLIC_BILLING_DEV_CONTROL=1` deliberately set.

#### No Convex change was needed for the Portal

`billing.createPortalSession` already existed and already satisfied every
requirement: identity through `requireUser` before the Stripe secret is even
read, the Customer resolved **only** from the `billingCustomers` mapping for the
authenticated user, no customer argument on the action at all, `no-subscription`
when there is no mapping, and a `return_url` built from `SITE_URL` + `/you`.
The only thing missing was a caller. This change adds the caller and adds the
tests that pin those properties, so a future edit cannot quietly weaken them.

The legacy checkout portal resolved its customer with
`GET /v1/customers?email=<browser-supplied>`, which meant submitting someone
else's address opened **their** billing portal. That lookup is absent here and
the suite asserts its absence against comment-stripped code.

#### One Checkout implementation, two plans

Annual did not fork the Checkout path. `startCheckout(button, plan)` is shared,
`plan` is typed as the closed union `'plus-monthly' | 'plus-annual'`, and the
alias is a hardcoded literal at each of the two call sites. It is never read
from the DOM, a dataset or the URL. The Price is resolved server-side from
`PLAN_CATALOG[planKey].envVar`, so naming a plan can never name an arbitrary
Price or an arbitrary environment variable.

#### The duplicate guard covers annual by construction

Worth stating precisely, because it is stronger than it looks: the checkout-time
guard queries by `(userId, provider)` and **never reads `planKey`**. It cannot
distinguish monthly from annual. Annual is protected because the guard is blind
to the plan, not because someone remembered to add annual to a list.

#### The warning on the annual button

The page carries a red warning against buying annual on the account that already
holds the active monthly subscription, because **the guards protect Convex
state, not the card**:

- `createCheckoutSession` answers `already-subscribed` and refuses.
- If a Session minted earlier is completed anyway, the §6.10 webhook guard
  refuses to repoint the canonical row.
- **Neither one cancels or refunds anything.** Stripe would still bill twice,
  and remediation is manual.

So annual must be exercised on a **separate sandbox QA account**, or after the
existing monthly subscription is genuinely terminal.

#### The inspector is an allowlist, not careful rendering

`src/app/declare/billing-inspector.js` projects the entitlement response down to
ten provider-neutral fields (`tier`, `subscriptionStatus`, `planKey`,
`provider`, `paymentNeedsAttention`, `graceEndsAt`, `duplicateProviders`,
`limits`, `usage`, `remaining`). The page renders what the projection returns,
so a field the allowlist does not name cannot reach the screen — including a
field added to the entitlement contract later. The suite runs the projection
against a hostile object carrying `cus_`, `sub_`, `price_`, `in_`, `evt_` and
`cs_` identifiers and asserts none survives.

Auto-refresh is bounded at 40 ticks × 3s (~2 minutes) and stops when the tab is
hidden. An unbounded poll left open in a tab is a slow request leak.

**Known limitation, deliberately documented on the page:** `getMyEntitlements`
does not surface `cancelAtPeriodEnd` — it is read only internally by
`interpret`. A subscription scheduled to cancel therefore still reads as
`active` in the inspector. Cancellation verification must be confirmed in the
Stripe Dashboard, not from this panel alone. Surfacing that field is an
entitlement-contract change and was out of scope here.

#### Regression coverage

`scripts/verify-billing-lifecycle-controls.ts` — 149 checks, and
`scripts/verify-billing-dev-control.ts` grew to 136. Both need a build first:

```bash
PUBLIC_BILLING_DEV_CONTROL=1 npx astro build
node scripts/verify-billing-lifecycle-controls.ts
node scripts/verify-billing-dev-control.ts
```

The plan catalog and the inspector projection are **imported and executed**, not
grepped. Source assertions cover only what is genuinely structural: call
ordering, absent arguments, and build output.

Four mutations were applied and each was caught before the code was restored:

| Mutation | Caught by |
|---|---|
| `planKeyForAlias` accepts any string | 13 checks in the lifecycle suite, 6 in the dev-control suite |
| Portal accepts a browser-supplied `customerId` | 4 checks |
| A Checkout call escapes the click handler | 4 checks |
| Both production gates removed, then rebuilt | 8 checks in the dev-control suite, 12 in the lifecycle suite |

`verify-billing-dev-control.ts` §6 was **rewritten** as part of this change. It
previously asserted "there is exactly one click listener" and "no `setTimeout`
appears anywhere". Those were never the property — they were proxies that held
only while the page had one button and no timer. The property is that every path
which can create a Stripe object is reachable **only** from a click, and page
load may perform an entitlement read and nothing more. It is now asserted that
way: click-reachable spans are computed by brace-walking, and every invocation of
`createCheckoutSession`, `createPortalSession`, `startCheckout`, `connect`, the
Convex client import and the generated api import must fall inside one. The
refresh timer is proven unable to reach any of them.

#### 6.12.1 The Portal configuration, verified 2026-08-22

**The sandbox Portal configuration is complete.** Read back through the
read-only Stripe API on 2026-08-22.

**Historical before-state, preserved:** on 2026-08-21,
`GET /v1/billing_portal/configurations` returned `{"data": []}` — zero
configurations, the portal untouched in this sandbox. That was the
before-state, **not** the current state. It is kept here because it is what the
after-state diffs against, and because the empty response was itself verified
three ways (unfiltered, `active=true`, `is_default=true`) plus a control read
that proved the credential was not merely blind.

**After-state.** One configuration returned, `has_more: false`. It is the
**active default**:

| Property | Value |
|---|---|
| `active` | `true` |
| `is_default` | `true` |
| `livemode` | `false` |

The configuration was also retrieved directly by id, and the retrieved object
was compared field-by-field against the listed object — they match exactly.

`is_default` is the load-bearing one. `createPortalSession` sends **no**
`configuration` parameter, so Stripe uses the account default. An active but
non-default configuration would not have been authoritative.

**The eight settings, verified programmatically rather than by eye:**

| # | Setting | Intended | API field | Result |
|---|---|---|---|---|
| 1 | Plan switching | Off | `subscription_update.enabled = false`, `default_allowed_updates` has no `price` | **PASS** |
| 2 | Quantity updates | Off | `default_allowed_updates` has no `quantity`; updates disabled | **PASS** |
| 3 | Subscription cancellation | On | `subscription_cancel.enabled = true` | **PASS** |
| 4 | Cancellation timing | End of period | `subscription_cancel.mode = "at_period_end"` | **PASS** |
| 5 | Cancellation reasons | On | `cancellation_reason.enabled = true` | **PASS** |
| 6 | Retention coupons | Off | none | **NOT EXPOSED BY READ API** |
| 7 | Payment-method updates | On | `payment_method_update.enabled = true` | **PASS** |
| 8 | Invoice history | On | `invoice_history.enabled = true` | **PASS** |

**Reported, not gated:**

- `subscription_cancel.proration_behavior` — `none`. Correct for end-of-period
  cancellation: the reader keeps what they paid for through the period, and no
  proration credit or invoice is generated.
- `cancellation_reason.options` — `too_expensive`, `switched_service`, `unused`,
  `other`, `missing_features`. The standard list, not narrowed.
- `cancellation_reason.feedback_options` — empty.
- `subscription_update.default_allowed_updates` — empty, which is what makes
  settings 1 and 2 pass together.

**Retention coupons: `NOT EXPOSED BY READ API`, deliberately not PASS.** The
complete object was searched recursively across every key name and every string
value for `retention`, `coupon`, `deflection`, `offer` and `discount`. There
were no matches. Retention coupons are a Dashboard cancellation-deflection
feature and do not appear on the configuration object at all, so absence proves
nothing — inferring PASS from a missing field would be reading a guarantee that
was never returned.

**Present in the response but not among the eight:**

- `customer_update.enabled = true`, allowing `name`, `email`, `address`,
  `phone`. Stripe's default. Worth stating why it is safe: our Customer
  resolution goes through the stored `userId` -> `stripeCustomerId` mapping, so
  a reader changing their email in the Portal cannot repoint anything. The
  retired `customers?email=` lookup stays closed (§6.12).
- `subscription_pause.enabled = false`
- `login_page.enabled = false`
- `default_return_url = null` — harmless, because `createPortalSession` always
  sends `return_url` explicitly (`SITE_URL` + `/you`).

The configuration id is deliberately **not** recorded here.

#### 6.12.2 Portal smoke test, 2026-08-22

**One Billing Portal session was created through the authenticated application
path.** That is the only Stripe write this test performed.

```
authenticated browser (local dev, signed-in QA account)
  -> Convex billing.createPortalSession   (payload: {} )
  -> server-side billingCustomers lookup by userId
  -> Stripe Billing Portal session
```

**The browser supplied no Customer identifier.** The deployed action's signature
was read back from `npx convex function-spec` before the click: it accepts
`lang` only. There is no `customer`, `customerId`, `userId`, `subscription` or
`return_url` argument to send. The dev control sent an empty payload.

The Portal then opened showing **this account's own** existing subscription,
which is the end-to-end proof that Convex resolved the right Customer from the
stored `userId` -> `stripeCustomerId` mapping. Nothing the browser sent could
have selected it.

**Duplicate activation is prevented.** The control disabled itself on click and
stayed disabled after success, so a second session cannot be created by clicking
again. Exactly one session exists.

**Observed on the hosted Portal** (Stripe-hosted, "Powered by Stripe",
business shown as *Declare checkout dev* with a **Sandbox** badge):

| Control | Expected | Observed |
|---|---|---|
| Current subscription | visible | Declare Plus, $8.99/month, with next billing date |
| Invoice history | visible | one paid $8.99 entry |
| Payment-method management | visible, unused | masked card shown, "Add payment method" present |
| Cancellation | visible, unused | "Cancel subscription" present |
| Plan switching | **absent** | not offered |
| Quantity adjustment | **absent** | not offered |

Plan switching and quantity controls being absent is §6.12.1's
`subscription_update.enabled = false` and empty `default_allowed_updates`
showing up in the rendered product, not just in the API response.

Nothing was clicked beyond the return action: no cancellation, no
payment-method change, no invoice opened, no customer information edited.

**Return path.** Using the Portal's own return action, not browser Back, the
Portal returned to exactly `/you`. No query string, no Stripe object id appended
to the application URL, no hosted Portal URL left visible. The session survived
the round trip and the account page rendered normally.

**Entitlement unchanged across the round trip.** The lifecycle inspector read
identically before and after: `tier: plus`, `subscriptionStatus: active`,
`planKey: plus_monthly`, `provider: stripe`, `paymentNeedsAttention: false`,
`duplicateProviders: false`. No Stripe identifier appeared in it at any point,
which is the allowlist projection working against live data.

**Convex billing tables unchanged.** Captured before and after with the same
read-only procedure and compared by hash:

| Table | Before | After | Byte-identical |
|---|---|---|---|
| `subscriptions` | 1 | 1 | yes |
| `billingCustomers` | 1 | 1 | yes |
| `billingEvents` | 3 | 3 | yes |

Byte-identical is a stronger claim than equal counts: no row was added, removed
**or modified**. No webhook event was produced, because creating a Portal session
is not a subscription mutation. No conflict event exists.

A Portal session object now exists transiently in Stripe. That is expected and is
not a change to any subscription, customer, payment method or invoice.

The Portal session URL, the Portal configuration id, and all Customer,
Subscription and invoice identifiers are deliberately **not** recorded here.

##### Finding: `/you` does not surface entitlement state

The Portal returns subscribers to `/you`, and `/you` currently tells them
nothing about their subscription. `src/pages/you.astro` never calls
`getMyEntitlements`; the only occurrence of the word "Plus" on the page is the
static *Plans* link to `/pricing`. So a returning subscriber sees no plan, no
status, and no route back into billing management.

This did not affect the smoke test — the entitlement is intact and was verified
through the inspector — but it is a real gap to close before billing is public,
and it is the natural place for a "Manage billing" entry point that calls
`createPortalSession`. Recorded here rather than fixed, because this branch is
documentation-only.

#### Still not done

Configuration is not validation. Every one of these remains unexercised:

- ~~No Billing Portal session has been created or opened~~ — **done** (§6.12.2)
- ~~Portal return to `/you`~~ — **verified** (§6.12.2)
- ~~Server-side Customer resolution against a real session~~ — **verified**
  (§6.12.2)
- **Cancellation has not been exercised** — `cancel_at_period_end` has still
  never been set
- No `customer.subscription.updated` has been observed **from a Portal action**
- Terminal cancellation (`customer.subscription.deleted`) has not been exercised
- **Payment-method updating** has not been exercised
- **Invoice-history behaviour** has not been exercised
- **Payment-failure / payment-attention** behaviour has not been simulated
- No annual Checkout Session has been created
- **Production Portal configuration remains untouched.** Live mode was not
  accessed at any point in this verification
- Nothing has been deployed; Convex dev and both Workers are untouched

**Portal lifecycle validation remains incomplete until a real sandbox Portal
session is tested.**

## 6.13 Subscription visibility, 2026-08-22

**No Stripe lifecycle test was performed during this implementation.** No
Portal session, no Checkout, no cancellation, no payment-method change, no
deployment. This section records code, not a transaction.

### What the Portal smoke test actually exposed

§6.12.2 recorded it as a footnote and it deserves better: the Portal returns
subscribers to `/you`, and `/you` told them nothing. `you.astro` never called
`getMyEntitlements`. A paying subscriber landed on their own account page and
could not see that they had a plan, what it cost, when it renewed, or how to
get back into billing.

That was not a page bug. `getMyEntitlements` already resolved the facts and
then dropped three of them before returning.

### The contract, extended

| Field | Type | Why |
|---|---|---|
| `periodEndAt` | ms or null | the renewal / end date, in ms so the browser formats it with the existing locale |
| `cancelAtPeriodEnd` | boolean | the difference between "Renews" and "Cancels" on screen |
| `billingInterval` | `month` \| `year` \| null | monthly or annual, from the value the webhook already stores |

All three are provider-neutral: a timestamp, a boolean, an interval enum. **No
Stripe Customer, Subscription, Price, invoice, event or Session id enters the
response**, and none of these can address another account. They are read from
the same row that won the tier — never merged across providers — and reported
only while that row grants Plus, so a lapsed row cannot leave a stale renewal
date on screen.

### One interpretation, three surfaces

`src/app/declare/plan-display.js` is the single mapping from entitlement
response to display state, dependency-free so the suite executes it. Three
surfaces interpreting the same response independently drift, and the drift is
always the same shape: one page saying billing is fine while another says it
needs attention. `checkout-return.js` now delegates to it rather than deciding
for itself.

Every ambiguous input **fails closed**:

- a null or unrecognised response is `unavailable`, **never `free`** — telling a
  paying subscriber they have nothing is the failure this exists to prevent
- payment attention **outranks** active, so a failing card in the grace window
  can never render as "Active"
- an unrecognised status on a Plus tier resolves to attention, not health
- two providers billing one account resolves to ambiguous rather than silently
  picking one
- `mayStartCheckout()` is false for `loading` and `unavailable`, so a failed
  entitlement read can never unlock a purchase control

### The three surfaces

**`/checkout/success`** — the confirmed state says *Welcome to Declare Plus*,
names what Plus opens up, and shows cadence and renewal date when present.
Primary action continues to Declare; secondary goes to `/you#plan-billing`. No
price is repeated: pricing owns the amount.

Every prior security property is intact. `session_id` is still never read for a
decision, rendered, stored, logged or sent; its presence is noticed only so it
can be stripped from the visible URL. Confirmation still comes only from
`getMyEntitlements`, polled bounded and single-flight. The welcome cannot appear
while payment needs attention or while confirmation is unresolved.

**`/you`** — a persistent Plan & Billing card at the stable `#plan-billing`
anchor, which is exactly where the Portal returns people. States: active,
cancellation-scheduled, payment-attention, free, loading, unavailable, and
multi-provider ambiguity. Loading never renders Free. Cancellation-scheduled
says **Cancels**, never Renews.

Manage billing is click-only and single-flight — disabled the moment it is
pressed and left disabled while in flight, so a double tap cannot mint two
Portal sessions. It goes through `openBillingPortal()`, which sends `{}`; the
deployed action has no customer, subscription, user or return-url argument to
carry.

**`/pricing`** — marks Free as *Current plan* for a signed-in free reader and
Plus as *Your current plan* for a subscriber, replacing the CTA with a link to
`/you#plan-billing`. The page stays **non-transactional**: it imports no billing
action, so no Checkout or Portal session can be created from it, and the CTA
remains the disabled "Opening soon" button for everyone — hidden, never
enabled, for a subscriber. The entitlement read fails closed.

There is **no `/es/precios` route in this tree**. Only `/pricing` exists,
reached as `/pricing?lang=es` through the runtime `data-i18n` +
`i18n-strings.js` convention. That existing surface is what was updated; the
localized route belongs to the release branch.

### The badge is identity, not proof of healthy billing

A restrained `PLUS` text badge sits beside the name on `/you`. No crown, no gold
treatment, no confetti. Hidden until entitlement loading completes so it never
flashes for a free account.

**A subscriber whose payment needs attention keeps the badge** — they are still
a subscriber — and the badge never says "Active". The Plan & Billing card below
carries the lifecycle truth. The badge is never the only indication of state.

### What stays with Stripe

The Portal remains the billing-management system: payment-method details,
invoices, cancellation actions and billing-address changes all live there. The
app shows plan identity, lifecycle status, benefits, dates and the safe entry
point. It deliberately does **not** duplicate sensitive Stripe billing data —
no card, no address, no invoice line, no identifier.

### Regression coverage

`scripts/verify-subscription-visibility.ts` — 374 checks. The shared module is
imported and executed, not restated. Four mutations applied and each caught
before restoring:

| Mutation | Caught by |
|---|---|
| payment attention renders as Active | 1 check |
| cancel-at-period-end renders as "Renews" | 1 check |
| the Plus pricing CTA may start Checkout | 2 checks |
| the `/you` Plan & Billing section removed | 3 checks |

Two **existing** assertions were updated deliberately, because they encoded the
old world rather than a property worth keeping:

- *"pricing.astro loads no script at all"* was a proxy for "pricing cannot
  transact", true only while the page was static. Pricing now performs one
  authenticated read. The real property is asserted directly: no billing action
  is imported and the purchase control is never enabled.
- *"no production file contains `createPortalSession`"* held only while the dev
  control was its only caller. `/you` now has a real Manage-billing button, so
  it legitimately ships. The narrower property replaces it: wherever it reaches
  production it must go through the empty-payload wrapper and carry no customer
  identifier.

A third assertion banned the bare word `checkout` in pricing, which now matches
`mayStartCheckout()` — the guard that exists to stop a subscriber starting one.
Banning the word would have meant renaming a safety function to satisfy a grep,
so the assertion now proves no session can be created and that every occurrence
of the word belongs to the guard.

## 6.14 Account redesign and visual verification, 2026-08-22

**No Stripe request, Portal session, Checkout session, billing mutation or
deployment occurred during this work.** It is a UI change plus a visual pass.

### Why the first visual pass stopped

The subscription-visibility pass (§6.13) verified everything except one item:
the Plus identity badge **computed as gold** — text `#9A7A24` (`--goldd`) on a
`#C9A84C` (`--gold`) border and fill.

The root cause was a **class collision**, not the colour that was written. The
badge reused `.ybadge`, which already belongs to the church-finder "Home"
marker later in the same stylesheet, and that rule sets `--goldd`. Rewriting the
colours in place did nothing: the source read forest while the browser still
painted `#9A7A24`, with only height and background coming from the new rule.

This is why the instruction to verify **computed** values rather than CSS source
mattered. A source-only check passed against a rule the browser never applied.

### The fix, and why it is semantic

The Plus badge now has its own class, `.yplus`. The church-finder badge is
untouched. Computed values, read from the live page in both themes:

| | light | dark |
|---|---|---|
| text | `rgb(34,56,46)` | `rgb(243,239,230)` |
| border | `rgba(34,56,46,.16)` | `rgba(244,239,230,.2)` |
| height / size / weight | 22px / 10px / 600 | same |
| gradient, shadow, filter, icon | none | none |

Gold remains a Declare brand colour. It must not be what says "this account
pays" — that reads as a reward trinket, and it conflates two different things:

- **PLUS** says who you are — membership
- **ACTIVE / Cancels / Payment needs attention** say how billing is — lifecycle

The badge still appears for a subscriber whose payment needs attention, because
they are still a member, and it never says "Active".

### The account hierarchy

`/you` had grown into a two-column rail plus eleven equally-weighted cards. A
subscriber returning from the Portal had to hunt for their own plan. It is now
one calm centred column, capped at 1040px, in a deliberate order:

`identity → Plan & billing → Your Formation → Account → Experience →
Privacy & support → Mobile app → Sign out`

A single column rather than a rail keeps reading order and visual order
identical at every width, which makes the mobile stack correct without a second
set of rules. The card grid became grouped rows — one action each, title,
description, chevron.

Every existing capability was preserved. Three real additions: Privacy and Terms
rows (routes that existed but were unreachable from this page), a Sign out row
wired to the existing `signOut()` (previously buried two taps inside the auth
modal), and a Mobile app row that is visibly disabled and labelled **Coming
soon** — no store link, no QR, no waitlist, because none of those exist.

### Your Formation

The Declare-specific section, built only from data the app already holds and
linking only to routes that exist:

| Card | Source | Destination |
|---|---|---|
| What you are walking through | `db_active_journey` | `/journey` |
| Truths you are carrying | vault `listItems()` | `/vault` |
| Fruit from your Journeys | `db_journeys_done` | `/journey` |

**No gamification of any kind**: no streaks, XP, scores, trophies, achievements,
percentages of spiritual growth, or "you missed a day". Where a real number
exists it is shown; where one does not, the card carries an invitation rather
than an invented statistic. No new backend aggregation was added.

The four per-device counts the old rail showed — words kept, verses saved,
highlights, collections — are restored here rather than dropped. Losing them
also broke the page with `missing #yStats` on load; caught in the browser.

### Visual verification results

Commit tested `7e6bec5` + this branch, against Convex dev `good-dotterel-906`,
on the real active monthly Plus account.

| Check | Result |
|---|---|
| Badge computed colours (light) | **PASS** — forest, no gold |
| Badge computed colours (dark) | **PASS** — cream, no gold |
| Badge hidden until load, accessible name, never "Active" | **PASS** |
| Section order identity → plan → formation → settings | **PASS** |
| Plan & Billing above the fold | **PASS** (mobile top 249px) |
| Formation shows real data, no gamification | **PASS** |
| All 14 setting rows real or labelled Coming soon | **PASS** |
| Desktop 1440 light / dark | **PASS** |
| Desktop 1024 | **PASS** |
| Mobile 390 light / dark | **PASS** |
| No horizontal overflow, no clipped dates | **PASS** |
| 44×44 targets, visible focus, one h1 | **PASS** |
| Keyboard order monotonic | **PASS** (after fixing the `.appearance` regression) |
| Checkout success + `session_id` stripping | **PASS** |
| Pricing current-plan, no second Checkout | **PASS** |
| Spanish pricing re-test | **NOT RE-TESTED** — see below |
| Signed-out success and pricing | **NOT TESTED** — see below |
| No Stripe request / no billing mutation | **PASS** |

**Spanish was deliberately not re-tested in-browser.** Switching locale calls
`setLang`, which triggers the app's `userdata:set` preference sync — a Convex
write. The previous pass caused exactly that write, and this pass was instructed
not to repeat it. The Spanish strings are asserted by the suites, and the
Spanish surfaces passed in the browser during §6.13.

**Signed-out remains untested.** Playwright attaches to the authenticated Canary
profile and storage is shared across its tabs; an independent signed-out context
needs a separate isolated browser instance. The QA profile was not signed out to
manufacture one.

### Regression coverage

`scripts/verify-account-profile-hybrid.ts` — 163 checks. Five mutations applied,
each caught, all restored byte-identical:

| Mutation | Caught by |
|---|---|
| gold badge styling restored | 4 checks |
| Plan & Billing moved below settings | 3 checks |
| Plus badge shown during loading | 2 checks |
| fake formation streak added | 1 check |
| dead-end settings row added | 1 check |

Convex billing tables byte-identical before and after: `subscriptions` 1,
`billingCustomers` 1, `billingEvents` 3, matching sha256 on all three.

## 6.15 Final visual verification from merged main, 2026-08-22

**No Convex redeployment was performed or required.** PR #26 contained no Convex
code — `convex/` was untouched and `convex/_generated` unchanged — so the
deployment from §6.13 still matches the entitlement contract under test.

**No Stripe request, Portal session, Checkout session, billing mutation or
deployment occurred.**

Tested commit **`2408b5d`** (the PR #26 merge) against Convex dev
`good-dotterel-906`, on the real active monthly Plus account.

### A stale Vite cache had to be cleared, and that is worth recording

A dev server started fresh from `2408b5d` still returned
`504 (Outdated Optimize Dep)` on `node_modules/.vite/deps/convex_browser.js`.
A fresh process was not enough because Vite reuses `node_modules/.vite` across
restarts. Removing `node_modules/.vite` and `.astro` and restarting resolved it.

This is the third time this cache has produced a false failure in this project.
**When verifying billing UI locally, clear `node_modules/.vite` if the console
shows a 504 on `convex_browser.js`** — otherwise the entitlement read silently
fails and every plan surface reads "unavailable".

The remaining 504 on `astro/runtime/client/dev-toolbar/entrypoint.js` is Astro's
dev toolbar. It is cosmetic and unrelated to the app.

### The Plus badge, computed from the live page

The check that stopped the first pass. Read from the browser, not from CSS:

| | light | dark |
|---|---|---|
| color | `rgb(34, 56, 46)` | `rgb(243, 239, 230)` |
| border | `rgba(34, 56, 46, .16)` | `rgba(244, 239, 230, .2)` |
| background | 5% forest | 5% cream |
| height / font-size / weight | 22px / 10px / 600 | same |
| letter-spacing / radius | 1px / 6px | same |
| background-image / box-shadow / filter | none | none |
| child icons | 0 | 0 |

No `#C9A84C`, no `#9A7A24`, and a warm-hue test (red > green > blue with a clear
spread) returns **false** for text, border and background in both themes. Label
is `PLUS`, accessible name is *Declare Plus subscriber*, and it never says
"Active".

**The `.ybadge` collision is resolved through `.yplus`.** The Plus badge no
longer shares a class with the church-finder "Home" marker, whose rule sets
`--goldd` and sits later in the stylesheet. That rule and its three markers are
untouched. This was invisible to source review — the CSS read forest while the
browser painted `#9A7A24` — which is why computed verification was required.

### Account hierarchy

Verified by measured document position, not by reading the file:

`identity 96 → Plan & Billing 285 → Your Formation 610 → Account 973 →
Experience 1526 → Privacy & Support 1943 → Mobile App 2405 → Sign out 2565`

One `h1`, content column 940px at 1440 (capped at 1040), two `nav` elements
inside the flow — both the Theme and Language segmented controls, no duplicate
landmark.

### Plan & Billing

`Declare Plus` · `ACTIVE` · `Monthly plan · Renews September 21, 2026` · all
three benefits · `Manage billing` visible and **not clicked**. Resolved state
`plus-active`, `aria-busy="false"`. No raw enum, no Stripe identifier, no
payment method or billing address. Status chip is separate from the PLUS badge.

### Your Formation

Heading *Your Formation*, directly after Plan & Billing, with real live values:

| Card | Value | Destination |
|---|---|---|
| What you are walking through | Day 4 | `/journey` |
| Truths you are carrying | 3 | `/vault` |
| Fruit from your Journeys | 1 | `/journey` |

Word-boundary scan of the rendered page for `streak`, `xp`, `score`, `trophy`,
`achievement`, `leaderboard`, `points`: **none**. The restored per-device counts
render without console errors.

### Grouped settings

All 14 rows present, **zero dead ends**, zero undersized targets. Mobile App
labelled *Coming soon* with no App Store, Play Store or QR. Privacy → `/privacy`,
Terms → `/terms`, Sign out present and wired but **not activated**.

### Responsive and theme

| Width | Light | Dark | Notes |
|---|---|---|---|
| 1440×900 | PASS | PASS | content 940px, formation 3-up |
| 1024×768 | PASS | PASS | content 721px |
| 390×844 | PASS | PASS | formation 1-up, Plan & Billing at 249px |

No horizontal overflow, no clipped renewal date or email, keyboard order
monotonic, all targets ≥44px, bottom navigation intact, badge non-gold at every
size. Themes were switched with the app's own control and **restored to the
account's original `light`**; the persisted value is unchanged.

### Regressions

Checkout success: URL cleaned to `/checkout/success`; the placeholder is not in
the DOM, localStorage, sessionStorage or cookies, and was never transmitted
onward; *Welcome to Declare Plus* with `Monthly plan · Renews September 21,
2026`; *View my plan* navigates to `/you#plan-billing`. No payment-attention copy.

Pricing: Plus marked *Your current plan*, Free not marked, CTA hidden **and**
disabled, manage link to `/you#plan-billing`, zero enabled purchase controls, no
raw enum or identifier.

### Not tested

- **Spanish authenticated visual state — NOT TESTED.** Switching locale calls
  `setLang`, which triggers the `userdata:set` Convex write. The automated
  localization assertions cover the strings instead.
- **Signed-out checkout success and pricing — NOT TESTED.** Playwright attaches
  to the authenticated Canary profile and storage is shared across its tabs. The
  QA account was not signed out to manufacture the state.

### State unchanged

No `createPortalSession`, no `createCheckoutSession`, no Stripe host, no
`/api/action`, no `/api/mutation`, no `userdata:set`. Billing tables
byte-identical to the pre-verification baseline — `subscriptions` 1,
`billingCustomers` 1, `billingEvents` 3, matching sha256 on all three — and the
`declare-lang` distribution is unchanged.

## 6.16 Scheduled cancellation, reconciled and verified, 2026-08-22

The C6 fix (PR #28, merged as `2df0ba7`) deployed to Convex development
`good-dotterel-906` and verified end to end against the real sandbox
subscription.

### Why the two existing events were NOT replayed

`applyWebhook` deduplicates on the provider event id:

```
.withIndex("by_provider_event", q => q.eq("provider", …).eq("eventId", …))
if (seen) return { ok: true, deduped: true };
```

That returns **before any write**. Stripe's manual resend reuses the same event
id, so resending either stored cancellation event would have been recognised as
already processed and would have left the canonical row untouched. Stripe itself
recommends deduplicating repeated deliveries by event id, so the dedup is
correct and replaying it proves nothing.

The smallest valid test was therefore to generate a **genuinely new** event.

### The one Stripe write

Exactly one sandbox subscription update, sending only:

```
cancel_at            = <the value Stripe already held>
proration_behavior   = none
```

Nothing else was sent — no `cancel_at_period_end`, metadata, price, quantity,
payment method, cancellation details, customer field, invoice setting, trial
setting, collection method or billing-cycle anchor. **Cancellation was not
toggled off and back on.**

Stripe immediately afterwards: `status active`, `ended_at null`, `cancel_at`
unchanged, `cancel_at_period_end false`, period end unchanged, `livemode false`,
same plan and quantity, same latest invoice, `pending_update: null`. No invoice,
proration, refund, credit or access change.

**One field did move:** `canceled_at` was re-stamped, because re-asserting the
schedule records when it was asserted. The substantive state is identical.

### The new event

Exactly **one** new `customer.subscription.updated`, with an event id distinct
from all five previously stored ids, `outcome: "applied"`. It arrived within
about four seconds. `billingEvents` went 5 → 6; all six ids remain distinct; no
duplicate-subscription conflict was created; one canonical row throughout.

### The canonical row, before and after

| Field | Before | After |
|---|---|---|
| `cancelAtPeriodEnd` | `false` | **`true`** |
| `canceledAt` | earlier request time | re-stamped |
| `lastProviderEventAt`, `updatedAt` | — | advanced normally |
| `provider`, `planKey`, `tier`, `status`, `currentPeriodEnd` | unchanged | unchanged |

The deployed normalizer resolved `cancel_at === currentPeriodEnd` to
`cancelAtPeriodEnd: true`, which is exactly what the old reader could not do.

### The user-visible result

`/you` Plan & Billing now renders:

> **Declare Plus** · ENDING
> Monthly plan · **Cancels September 21, 2026**
> Your Plus access remains available until then.

"Renews" is **absent**. The status chip reads ENDING rather than a healthy
ACTIVE. All three benefits remain, Manage billing remains available (not
clicked), the PLUS identity badge remains visible and does not say "Active", and
no payment-attention message, raw enum or Stripe identifier appears.

`/pricing` still marks Plus as **Your current plan**, the purchase control stays
hidden and disabled with zero enabled purchase controls, the manage path points
at `/you#plan-billing`, and the lifecycle line replaces renewal language with
"Your Plus access remains available until the end of the period."

### Deployment changed no data

The Convex deployment itself left `subscriptions`, `billingCustomers` and
`billingEvents` byte-identical. Across the whole pass, `billingCustomers`,
`usageCounters`, `journeySlots`, `userData` and `accountSettings` are all
byte-identical to the pre-deployment snapshots — no `userdata:set`, no Journey or
Vault mutation, no customer or payment-method update, no invoice interaction, no
Portal or Checkout session, no refund or credit.

### Two operational notes

`convex dev --once` regenerates `convex/_generated/api.d.ts` to register the new
`stripeCancellation` module in the type map. The change is deterministic, adds
**zero** callable functions to the deployment, and type checks pass with or
without it. PR #28 shipped without it because codegen never ran on that branch,
so it still needs a one-line follow-up commit.

Clearing `node_modules/.vite` requires the dev server to be restarted **twice**:
the first browser load after a cache clear triggers re-optimization, during which
`convex_browser.js` 504s and the entitlement read fails. The Plan & Billing card
fails closed correctly during that window — it shows "We could not load your plan
right now" with a retry rather than a false Free state — but it is not a state
worth verifying against. Restart once more before reading results.

## 6.17 Annual Checkout, verified end to end, 2026-08-22

**The first complete annual Plus purchase.** Commit tested `203a800`, against
Convex development `good-dotterel-906`. **No Convex redeployment was needed** —
the only Convex change since the deployed `2df0ba7` is the generated type map,
which adds no callable function.

### A separate authorized QA account was used

The existing monthly subscriber was **not used, signed out, or modified**. A
second authorized QA account, on an address the owner controls, was signed in
through a separate Chrome Canary profile.

Before Checkout it was verified privately that this account:

- is a **different application user** from the monthly subscriber
- resolved as **signed-in Free** — `tier: free`, `subscriptionStatus: none`,
  `planKey: null`, `provider: null`, not guest, not unavailable, not ambiguous
- had **no** `billingCustomers` mapping and **no** canonical subscription
- showed no monthly-subscriber data anywhere on the page

Identities were compared by exact string equality against the known monthly
address, never printed. An earlier "unrecognised account" reading was a false
alarm from a regex that swallowed a trailing sentence period; the corrected
check matched the annual QA account exactly.

### Public billing remains intentionally inactive

`/pricing` has **no annual purchase control at all** — zero occurrences of the
annual alias — and its only Plus CTA is the disabled "Opening soon" button.
Public billing was never activated, and this test did not activate it.

The annual purchase was therefore initiated through the existing
**development-only** control at `/dev/billing-sandbox`, which requires
`PUBLIC_BILLING_DEV_CONTROL=1`. That is a deliberate fallback, recorded here
because it is the honest description of how annual was exercised. `/pricing` was
verified only for its Free state before purchase and its current-Plus state
after.

### The annual Price, validated before purchase

`active`, `livemode: false`, USD, `interval: year`, `interval_count: 1`,
`usage_type: licensed`, **$79.99** matching the application's published annual
copy, attached to the same active **Declare Plus** product as monthly, no trial,
tax behaviour consistent with Stage 2.

### Exactly one Checkout Session

The browser payload was exactly:

```json
{ "plan": "plus-annual" }
```

No Price id, Customer id, Subscription id, user id or return URL — there is no
such argument on the deployed action. One `/api/action` call, and the control
disabled itself on click so a second session could not be started.

Hosted Checkout showed **Declare checkout dev**, a Sandbox badge, "Subscribe to
Declare Plus", **$79.99 per year**, one line item, no trial, no extra line item,
no monthly Price, and the separate QA account's email.

*(Stripe also renders "$6.67 / month billed annually" as an annualised helper
line. It is presentational, not a monthly Price.)*

### One sandbox payment

Paid once with Stripe's standard sandbox test card. **No real card was used and
no card details are recorded anywhere in this repository.**

Worth recording: the first submit did **not** charge anything. Checkout returned
a `Required` validation error because this configuration requires a phone
number, and the form never submitted. Filling that field and submitting was
therefore not a retry of an uncertain payment — no PaymentIntent existed yet.

### Checkout success

Redirect landed on `/checkout/success` with the query string already stripped.
The real `session_id` appears in **no** DOM, localStorage, sessionStorage or
cookie, and was never transmitted onward. The page showed:

> **Welcome to Declare Plus**
> Annual plan · Renews August 22, 2027

with *Continue to Declare* and *View my plan* → `/you#plan-billing`.

### Webhook ingestion

All three expected events arrived and converged in about four seconds, each with
a distinct new provider event id and `outcome: "applied"`:

| Event | Outcome |
|---|---|
| `checkout.session.completed` | applied |
| `customer.subscription.created` | applied |
| `invoice.paid` | applied |

Zero duplicate-subscription conflicts. `billingEvents` 6 → 9, all ids distinct.

### Convex provisioning

`subscriptions` 1 → 2, `billingCustomers` 1 → 2, across **two distinct users**.
The new canonical row:

| Field | Value |
|---|---|
| `planKey` | `plus_annual` |
| `tier` | `plus` |
| `status` | `active` |
| `billingInterval` | `year` |
| `cancelAtPeriodEnd` | `false` |
| `periodEndAt` | present — August 22, 2027 |

### Stripe objects

New Customer, new annual Subscription, one paid Invoice. Subscription:
`livemode false`, `active`, `interval year × 1`, `$79.99 USD`, quantity 1, one
item, `cancel_at null`, `cancel_at_period_end false`, `canceled_at null`,
`ended_at null`, no trial, no discount, `pending_update null`. Invoice: **paid**,
$79.99 fully paid, `billing_reason: subscription_create`, one line
"1 × Declare Plus (at $79.99 / year)", no proration, **zero credit notes**, no
refund. Exactly two active subscriptions in the sandbox — no second annual.

### Application surfaces

`/you` — **Declare Plus · ACTIVE · Annual plan · Renews August 22, 2027**, all
three benefits, Manage billing present, PLUS badge visible and **not gold** and
never saying "Active". No monthly cadence, no cancellation wording, no
payment-attention message, no raw enum, no Stripe identifier.

`/pricing` — Plus marked **Your current plan**, Free not marked, CTA hidden and
disabled, zero enabled purchase controls, manage path to `/you#plan-billing`.

### Billing Portal

Exactly one Portal session, created by a deliberate single click. The browser
sent an empty payload; Convex resolved the correct annual Customer server-side.
The Portal showed **Declare Plus · $79.99 per year · next billing August 22,
2027** — matching `/you` exactly — with the paid invoice listed, payment-method
management and cancellation available per configuration, and **no** plan
switching or quantity controls. Nothing in the Portal was changed, and the
return action landed back on `/you`.

### The monthly subscriber is untouched

Its canonical row is **byte-identical** before and after — still
`plus_monthly / active / cancelAtPeriodEnd: true`, period end September 21,
2026 — and its customer mapping is unchanged. No cross-account mapping occurred.

`usageCounters`, `journeySlots` and `accountSettings` are byte-identical.
`userData` grew by two rows, both belonging solely to the **new** QA user
(`declare-lang`, `declare-profile-v1`); all twenty pre-existing rows are
unmodified.

No refund, credit, plan switch, payment-method change after purchase, invoice
interaction, customer-data edit, cancellation, second Checkout, second Portal
session, Worker or Convex deployment, or environment change occurred.

## 6.18 Payment-method update, verified 2026-08-22

Commit tested `7ab6321`, against Convex development `good-dotterel-906`. **No
deployment was required** — the only Convex change since the deployed `2df0ba7`
is the generated type map.

Performed on the **annual QA account**. The monthly subscriber was not used,
signed into, or modified.

### The precedence problem this test had to prove

Stripe resolves the payment method for a subscription's next invoice in order:

```
subscription.default_payment_method        <- wins if set
  else customer.invoice_settings.default_payment_method
    else older fallback sources
```

Attaching a new card proves nothing on its own. If the Portal had only updated
the **customer** default while the **subscription override** still pointed at
the old card, the old card would still be charged — silently.

That risk was real here. Before the test:

| | Before |
|---|---|
| `subscription.default_payment_method` | **set** — the sandbox Visa from Checkout |
| `customer.invoice_settings.default_payment_method` | `null` |

So the subscription override was the effective method, and it was the thing that
had to change.

### The result: Acceptable result B

One Portal session, one replacement, sandbox **Visa → sandbox Mastercard**. No
real card was used and no card details are recorded anywhere in this repository.

| | After |
|---|---|
| `subscription.default_payment_method` | **`null`** — override cleared |
| `customer.invoice_settings.default_payment_method` | **the new method** (different id) |

The Portal cleared the subscription-level override *and* set the customer
default to the new method. By the precedence chain above, the next annual
invoice resolves to the new Mastercard. The failure case — a stale subscription
override outranking a correct customer default — did not occur.

The old sandbox Visa **remains attached but non-default**. The Portal listed the
new Mastercard explicitly as **Default**.

### One Portal session, nothing else touched

The browser sent an empty payload; Convex resolved the annual Customer
server-side from the authenticated user. No Customer, Subscription or
PaymentMethod identifier crossed the wire, and no return URL.

Subscription after the change: `livemode false`, `active`, `year × 1`,
`cancel_at null`, `cancel_at_period_end false`, `ended_at null`, period end
**unchanged** (August 22, 2027), same `latest_invoice`, `pending_update null`.

The customer has **exactly one** invoice — the original paid one from Checkout.
No new invoice, no charge, no proration, no refund, and zero credit notes. The
existing invoice was **not opened or downloaded**; that remains its own separate
TODO.

**No plan switch occurred.** The subscription still carries the same annual plan
at `year × 1` with `planKey` unchanged, and the Portal configuration has plan
switching and quantity updates turned off, so the control was not available to
click in the first place.

**No second Checkout Session was created.** The only Checkout on this account is
still the original annual purchase; this test opened one Portal session and
nothing else.

### A subscribed event DID fire, and that is correct

The expectation going in was that `billingEvents` would stay at 9, because the
endpoint does not subscribe to `payment_method.attached`,
`payment_method.detached`, `payment_method.updated`, `customer.updated` or
`setup_intent.succeeded`.

It went **9 → 10**, and the reason is sound: clearing the subscription-level
`default_payment_method` is a modification of the subscription object, so Stripe
emitted **`customer.subscription.updated`** — a type this endpoint has always
subscribed to, because cancellation handling needs it.

Convex handled it correctly. The canonical annual row changed **only** in
`lastProviderEventAt` and `updatedAt`; `provider`, `planKey`, `tier`, `status`,
`billingInterval`, `cancelAtPeriodEnd` and `currentPeriodEnd` are all unchanged.
`outcome: "applied"`, no conflict, no duplicate row.

Row counts before and after, stated plainly so the one legitimate increment is
never mistaken for a claim that nothing in Convex moved:

| Table | Before | After |
|---|---|---|
| `subscriptions` | 2 | 2 |
| `billingCustomers` | 2 | 2 |
| `billingEvents` | 9 | **10** |

`subscriptions` and `billingCustomers` still hold the same two rows each — the
monthly subscriber and the annual QA account — so no subscription and no customer
mapping was created, replaced, or crossed between accounts. Only `billingEvents`
grew, by the single `customer.subscription.updated` described above.

**Worth remembering:** a Portal payment-method change can produce a
`customer.subscription.updated` webhook whenever it clears a subscription-level
override. Entitlement is correctly unaffected, but the event is not noise to be
ignored — it is the same event type cancellation uses.

### Application surfaces unchanged

`/you` still reads **Declare Plus · ACTIVE · Annual plan · Renews August 22,
2027**, with all three benefits, the non-gold PLUS badge, and no
payment-attention state. **No card brand, no last four digits and no
PaymentMethod identifier appear anywhere in the application** — the entitlement
contract carries none of them, and nothing on the page renders them.

`/pricing` still marks Plus as **Your current plan** with zero enabled purchase
controls and no payment-method leakage.

### Cross-account safety

The monthly canonical row and its customer mapping are **byte-identical**, still
`plus_monthly / active / cancelAtPeriodEnd: true`, ending September 21, 2026. Its
payment method was not touched. The two Customer mappings remain distinct and no
PaymentMethod was attached across accounts.

`billingCustomers`, `usageCounters`, `journeySlots`, `accountSettings` and
`userData` are all byte-identical.

### Tooling limits, recorded honestly

Two checks could **not** be observed with the available read-only tooling, and
are reported as such rather than assumed:

- **The upcoming-invoice preview.** This MCP server exposes no upcoming-invoice
  or invoice-preview operation, so the effective method was proven from the
  precedence chain (`subscription.default_payment_method` is null, therefore the
  customer default applies) rather than from a preview object.
- **The Stripe event-type list.** No events operation is exposed, so the
  `setup_intent.*` / `payment_method.attached` / `customer.updated` activity
  could not be enumerated directly. Their *absence from Convex* is consistent
  with the endpoint not subscribing to them.

PaymentMethod objects also cannot be listed through this server, so "a new
Mastercard is attached" rests on the Portal display and on the customer default
pointing at a different PaymentMethod id than before.

## 6.19 Invoice open and download, verified 2026-08-23 UTC

Commit tested `1f72be9`, against Convex development `good-dotterel-906`. **No
deployment was required** — the only Convex change since the deployed `2df0ba7`
is the generated type map (`convex/_generated/api.d.ts`, +2 typing lines, zero
runtime functions), and `worker/` is untouched.

Performed on the **annual QA account**. The monthly subscriber was not signed
into, opened, or modified, and its invoice history was never viewed.

### What this test had to prove

That a customer can read and keep a copy of what they were charged, and that
doing so changes nothing. Reading is the easy half; the half worth testing is
that a read stays a read — no invoice created or revised, no payment retried, no
webhook, no entitlement drift.

### One Portal session, and the browser proved it sent nothing

The `/you` control produced exactly one Convex action call. Its full request
body was:

```
{"path":"billing:createPortalSession","format":"convex_encoded_json","args":[{}]}
```

`args` is an empty object. No Customer, Subscription, invoice or Price
identifier, no return URL, not even a language. Convex resolved the annual
Customer server-side from the authenticated session, and built the return URL
itself from `SITE_URL`. The Portal opened in **Sandbox** for the annual account.

Identity was gated before the click: the session's account was confirmed to be
the annual QA user and confirmed **not** to be the monthly subscriber, by
comparing SHA-256 hashes rather than by reading either address aloud.

### Portal state before touching anything

Invoice history is enabled in the active Portal configuration
(`invoice_history.enabled: true`, `livemode: false`). Payment-method updates and
cancellation are enabled but were **not used**. `subscription_update.enabled` is
`false` with an empty `default_allowed_updates`, so plan switching and quantity
changes were not merely avoided — they were not offered.

The Portal listed the annual subscription at **$79.99 per year**, next billing
date **August 22, 2027**, and **exactly one** invoice: Aug 22, 2026 · $79.99 ·
Paid.

### The invoice, opened once

Opened from the Portal to Stripe's hosted invoice page — one invoice, one time.
What it showed:

| Field | Value |
|---|---|
| State | Invoice **paid** |
| Amount | **$79.99** |
| Line items | **one** — Declare Plus, Qty 1, $79.99 |
| Billing period | **August 22, 2026 – August 22, 2027** |
| Total due / Amount paid | $79.99 / $79.99 |
| Amount remaining | **$0.00** |

No Pay control, **zero** editable inputs, and no refund, credit-note, proration
or balance-adjustment language anywhere on the page. It belonged to the annual QA
account, not the monthly subscriber. The cadence reads as the twelve-month period
on the hosted page; the "per year" wording appears on the Portal page.

### One PDF, downloaded and then destroyed

The **Download invoice** action was used exactly once. **Download receipt** sits
directly beside it and was deliberately not touched.

The browser tooling offers no download-directory setting, so the file landed in
the ignored `.playwright-mcp/` working directory. It was moved out to a
mode-`700` temporary directory outside the repository **immediately**, with
`mv -n` so nothing could be overwritten, and the count was checked before and
after: exactly one file existed, and none was created anywhere else.

Validated there: correct `application/pdf` MIME, `%PDF-1.4` header, `%%EOF`
terminator, one page, not encrypted, non-empty, outside the repository, and
neither tracked nor staged.

Then deleted — the PDF, its temporary directory, and every extracted byte. No
invoice or receipt file was retained anywhere, no screenshot of the invoice was
taken, and no invoice text was copied into this repository.

### NOT OBSERVABLE, and why that is the honest answer

**Command-line validation of the PDF's text is NOT OBSERVABLE on this machine.**
`pdftotext`, `pdfinfo`, `mutool`, `qpdf`, `pypdf` and PyObjC/Quartz are all
absent. A standard-library parse read the structure correctly but could not
reliably decode the text: the document uses subset fonts, its strings are
hex-encoded, and only 49 `ToUnicode` entries could be reconstructed. The
fallback of viewing the saved file in the browser is also unavailable — the
`file:` protocol is blocked there.

So the amount, paid state, cadence and period are recorded from **the hosted
invoice page**, verified in the browser, and from the **Stripe API objects**. The
PDF is recorded as structurally valid, and its *contents* are recorded as not
independently verified. Nothing here claims otherwise.

Also NOT OBSERVABLE through the available read-only tooling, unchanged from
§6.18: **Portal Session counts** (Stripe publishes no list endpoint for them at
all), **refund and credit-note listings** (no MCP operation), and **direct Charge
reads** (restricted-key scope). Where a count could not be listed, a field on an
object that *is* readable was used instead, and is named below.

### Stripe after: field-identical

Every recorded field was compared before and after by an automated walk over the
captured state. **Zero differences.**

| | Before | After |
|---|---|---|
| Customers | 2 | 2 |
| Subscriptions | 2 | 2 |
| Invoices (annual) | 1 | 1 |
| PaymentIntents (annual) | 1 | 1 |
| Checkout Sessions (annual) | 1 | 1 |

The invoice is unchanged in every field: `status: paid`, `amount_due`,
`amount_paid`, `amount_remaining: 0`, `amount_overpaid: 0`, currency, subtotal,
total, its single line item and that line's period and `proration: false`,
`created`, `effective_at`, `finalized_at`, `paid_at`, `voided_at: null`,
`marked_uncollectible_at: null`, `latest_revision: null`, `from_invoice: null`,
`attempt_count: 0`, `next_payment_attempt: null`, `starting_balance` and
`ending_balance` at 0, and both credit-note amounts at **0**.

The only thing that differed between the two reads was the **signature token
inside the hosted-invoice and PDF links**, which Stripe regenerates on every
read. That is a URL signature, not invoice state.

Where a count was not listable, the substitute is named:

- **No invoice was created** — the Customer's `next_invoice_sequence` is still 2.
- **No new Charge** — the single PaymentIntent still points at the same
  `latest_charge`.
- **No credit note** — `pre_payment_credit_notes_amount` and
  `post_payment_credit_notes_amount` are both 0.
- **No payment attempt and no refund** — the PaymentIntent is identical, still
  `succeeded` with `amount_received` 7999 and `canceled_at: null`.
- **Exactly one Portal Session** — one `createPortalSession` action in the
  browser network log, and no second click.
- **No second Checkout Session** — the annual Customer still has exactly one,
  `complete`, from the original purchase.

The annual subscription is unchanged: `active`, `year × 1`, quantity 1,
`cancel_at: null`, `cancel_at_period_end: false`, `ended_at: null`,
`pending_update: null`, `schedule: null`, period end August 22, 2027, same
`latest_invoice`, and its `default_payment_method` still `null` (the state §6.18
left it in). No payment method was changed.

### Convex after: byte-identical

Two read-only snapshot exports, hashed table by table:

| Table | Rows | SHA-256 (first 16) | |
|---|---|---|---|
| `subscriptions` | 2 → 2 | `e6214154a9038da9` | byte-identical |
| `billingCustomers` | 2 → 2 | `dc09904f982d035a` | byte-identical |
| `billingEvents` | 10 → 10 | `56597c6e1743be62` | byte-identical |
| `usageCounters` | 3 → 3 | `a763bc85e0ed7771` | byte-identical |
| `journeySlots` | 8 → 8 | `6f18f1d2e4d1146d` | byte-identical |
| `accountSettings` | 0 → 0 | `e3b0c44298fc1c14` | byte-identical |
| `userData` | 22 → 22 | `5bb0b2fb4c525d2b` | byte-identical |

**`billingEvents` did not move.** Unlike the payment-method change in §6.18,
opening and downloading an invoice produces no subscribed webhook at all, so
there was nothing for Convex to apply. Reading a document is not a billing event.

### Application surfaces

`/you` still reads **Declare Plus · ACTIVE · Annual plan · Renews August 22,
2027**, all three benefits present, the PLUS badge computed at forest
`rgb(34, 56, 46)` rather than gold, and no payment-attention state.

**Nothing about the invoice reaches the application.** No invoice number, no
amount, no card brand, no last four digits, no provider identifier and no
`stripe.com` reference appears anywhere in `/you`'s text or markup. That is
structural rather than lucky: the entitlement contract carries `tier`,
`subscriptionStatus`, `planKey`, `provider`, `paymentNeedsAttention`,
`graceEndsAt`, `duplicateProviders`, `periodEndAt`, `cancelAtPeriodEnd`,
`billingInterval`, `limits`, `usage` and `remaining` — and no invoice field of
any kind. `latestInvoiceId` is stored on the canonical row and is on the
inspector's forbidden list; it is never returned to a browser.

*One note for anyone re-running the leakage scan:* a naive card-brand regex
matches the word **Discover** in the church-finder copy, "Discover a fellowship
near you". That is prose, not a card brand. Match with context, not a bare word
list.

`/pricing` still marks Plus as **Your current plan**, hides the Free marker,
links to `/you#plan-billing`, offers **zero** enabled purchase controls, and
leaks no invoice information.

### Cross-account safety

The monthly subscription and its customer mapping are byte-identical in Convex
and field-identical in Stripe: still `plus_monthly`, `active`, scheduled to end
September 21, 2026, with its own payment method untouched. The two Customer
mappings remain distinct, and the monthly account's invoice history was never
opened. No cross-account invoice access occurred.

## 6.20 Payment-failure test: BLOCKED before any Stripe write, 2026-08-23 UTC

Audited at commit `d2cc1bd` against Convex development `good-dotterel-906`. **No
Stripe write was made. No Stripe object was created, attached, or modified.**
This section records why a planned test was stopped, and what would have to
change before it can run.

The plan was a small controlled one-off invoice: attach Stripe's
decline-after-attaching sandbox PaymentMethod, make it the Customer default,
raise a $1.00 invoice carrying the annual subscription as context, let it fail,
observe `paymentNeedsAttention` turn true, then restore the working method and
pay the same invoice to recover.

The mandatory pre-write audit says that test cannot work against this code. Two
independent reasons, both in the shipped webhook path.

### Blocker 1 — the event would be silently ignored

`convex/http.ts:182` resolves an invoice event through exactly one function:

```ts
function readInvoiceSubscriptionId(obj: any): string | null {
  const nested = obj?.parent?.subscription_details?.subscription;
  ...
}
```

It reads **one** location on the invoice root: `parent.subscription_details.subscription`.
It never inspects invoice **lines**. That narrowing was deliberate and is
documented in the file itself — the readers were tightened once real Dahlia
payloads were captured (§6.8), specifically so a payload that does not match the
real shape fails closed instead of flowing into the entitlement tables looking
healthy.

A one-off invoice carries its subscription association on the **invoice item /
line**, not on the invoice root's `parent`. The captured real annual invoice
shows both shapes side by side:

| Location | Real cycle invoice | Read by the app? |
|---|---|---|
| `invoice.parent.subscription_details.subscription` | present | **yes — the only field read** |
| `line.parent.subscription_item_details.subscription` | present | **no — never inspected** |

So for the proposed invoice the resolver returns `null`, and
`convex/http.ts:187` runs:

```ts
if (!subscriptionId) return ACK();
```

That returns **before** `applyWebhook`. Since `billingEvents` is only written
inside that mutation (`convex/subscriptions.ts:227`), the event would produce
**no `billingEvents` row, no outcome, and no state change** — acknowledged to
Stripe and dropped. `billingEvents` would stay at 10, and the test would look
like a silent failure rather than a signal.

### Blocker 2 — even if it were mapped, it could not raise attention

This one is independent of invoice shape, and it is the deeper problem.

`paymentNeedsAttention` is not set by invoice events at all. It is a pure
function of the **stored subscription status** (`convex/entitlements.ts:103`):

```ts
if (status === "past_due" || status === "unpaid") { ... needsAttention: true ... }
```

And the webhook never stores anything from the invoice. On every event it
re-fetches the live subscription and writes that object's status
(`convex/http.ts:237`):

```ts
status: String(sub.status || ""),
```

`applyWebhook` accepts no attention flag and has no invoice-specific branch —
its arguments are subscription fields only. So the **only** lever on attention is
the annual subscription's own status.

A failed one-off invoice does not move a subscription to `past_due`. Stripe's
documentation is explicit that `active` "doesn't indicate that all outstanding
invoices associated with the subscription have been paid — you can leave other
outstanding invoices open for payment". `past_due` tracks the subscription's own
latest finalized cycle invoice.

The annual subscription would therefore stay `active`, and
`paymentNeedsAttention` would stay `false`, even in the best case where Blocker 1
did not apply.

### Neither acceptable mapping holds

- **Mapping A** (reader understands the invoice or line association) — **fails.**
  The reader looks at one invoice-root field and never at lines.
- **Mapping B** (reader maps by Customer, and the annual Customer has exactly one
  canonical subscription) — **fails.** There is a `by_customer` fallback, but it
  lives *inside* `applyWebhook`, which is unreachable here; and the customer id
  it uses is taken from the **fetched subscription**, not from the invoice. It
  cannot be reached without a subscription id in the first place.

Two of the stop conditions therefore fired: *the event would be ignored*, and
*`invoice.payment_failed` cannot set attention*.

### This is a correct design, not a defect

Worth being clear: nothing here is broken. The narrow reader and the
status-derived attention flag are both doing their jobs. A one-off invoice is
simply not a subscription health signal, and the code declines to pretend it is.

The consequence is only that a one-off invoice is the **wrong instrument** for
this test. Attention state is reachable only by genuinely moving the annual
subscription into `past_due` or `unpaid`.

### What would actually exercise this path

Recorded for whoever picks this up, in rough order of preference:

1. **A test clock.** Create a QA subscription against a Stripe test clock with a
   failing payment method, advance the clock past a renewal, and let a real
   `subscription_cycle` invoice fail. That drives `subscription.status` to
   `past_due` for real, fires `customer.subscription.updated` and
   `invoice.payment_failed` against a subscription the reader already
   understands, and is fully reversible by paying the invoice. It does **not**
   touch the existing annual subscription — it needs its own throwaway
   subscription, since a test clock cannot be attached to an existing one.
2. **A third disposable QA subscription** on a short interval with a failing
   method, allowed to fail its first cycle invoice. Cheaper to set up, slower to
   reach, and it adds a third canonical row that must then be cleaned up.
3. **Widening the reader** to fall back to `line.parent.subscription_item_details.subscription`.
   This is a code change, not a test, and it should be resisted unless a real
   Stripe payload requires it — the current narrowness is a deliberate
   fail-closed **correctness and data-integrity boundary**, and widening it to
   make a test convenient would trade that boundary for test ergonomics.

   The distinction matters. What the narrow reader demonstrably protects is
   *correctness*: only a trusted subscription association may write to the
   canonical entitlement row, so an invoice shape the code does not actually
   understand cannot drift into it looking healthy. That is a data-integrity
   claim, evidenced directly by this audit. Calling it a security property would
   be a stronger claim than the evidence here supports — this repository carries
   no documented threat model for invoice-shaped input — so it is deliberately
   not labelled that way.

Option 1 is the honest one. It exercises the real path with a real event, and it
leaves both existing subscribers untouched.

### State at the end of this audit

Unchanged, because nothing was written. Stripe: 2 Customers, 2 Subscriptions,
the annual subscription `active` at `year × 1` renewing August 22, 2027 with its
Customer default still the working sandbox Mastercard and its subscription-level
default still `null`; the monthly subscriber untouched. Convex: `subscriptions`
2, `billingCustomers` 2, `billingEvents` 10.

No Portal Session, Checkout Session, PaymentMethod attachment, invoice, payment
attempt, webhook, deployment, or environment change occurred.

## 7. Not yet created

One Customer, one Subscription, one paid invoice and one successful
PaymentIntent now exist in the sandbox (§6.8). The duplicate-subscription
webhook guard is now in place (§6.10). Still absent:

- ~~Billing Portal **configuration**~~ — **now complete and verified** in the
  sandbox (§6.12.1). What is still absent is Portal **validation**: no session
  has been created or opened, and no cancellation, payment-method update or
  invoice-history interaction has been exercised
- any live-mode object
- annual checkout **verification** — the control exists (§6.12) but no annual
  Checkout Session has been created, and the annual Price has never been
  exercised
- cancellation — `cancel_at_period_end` has never been set, so
  `customer.subscription.updated` and `customer.subscription.deleted` remain
  unexercised
- payment-failure handling — never simulated
- any production billing CTA — the pricing page CTA is still a disabled
  "Opening soon" button
- ~~`/checkout/success` and `/checkout/cancelled`~~ — **both now exist** (§6.11)

The webhook parser's field readers are **narrowed and pinned** (§6.9). Resume
step 6 is done.

## 8. Related

- `docs/architecture/cross-platform-subscriptions.md` — provider neutrality, the runtime split
- `docs/implementation/release-c1-phase4-entitlements.md` — grace window, tax deferral, commercial decisions
- `scripts/verify-webhook-signature.ts` — 34 signature checks
- `scripts/verify-plus-classification.ts` — 44 classification checks
- `scripts/verify-billing-dev-control.ts` — 136 checks on the dev checkout controls
  (build `dist/` first, with the flag ON)
- `scripts/verify-billing-lifecycle-controls.ts` — 149 checks on annual, the
  Portal and the lifecycle inspector (build `dist/` first, with the flag ON)
- `scripts/verify-checkout-return-pages.ts` — 118 checks on the return pages
- `scripts/verify-duplicate-subscription-guard.ts` — 71 checks on the webhook guard
- `docs/operations/retired-webhook-secret-hygiene.md` — the legacy checkout flow
