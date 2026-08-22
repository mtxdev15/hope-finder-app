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

The retired donation portal resolved its customer with
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

#### Still not done

- No annual Checkout Session has been created
- No Portal session has been created, and the **Portal has never been configured
  in the Stripe Dashboard** — the first click will fail until it is
- No cancellation has been performed
- No payment failure has been simulated
- Nothing has been deployed; Convex dev and both Workers are untouched

## 7. Not yet created

One Customer, one Subscription, one paid invoice and one successful
PaymentIntent now exist in the sandbox (§6.8). The duplicate-subscription
webhook guard is now in place (§6.10). Still absent:

- **Billing Portal configuration** — the dev control to open a Portal session
  now exists (§6.12), but the Portal itself has never been configured in the
  Stripe Dashboard, so the first click will fail until it is
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
- `docs/operations/retired-webhook-secret-hygiene.md` — the retired donation flow
