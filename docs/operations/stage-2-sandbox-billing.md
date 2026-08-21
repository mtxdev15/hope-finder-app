# Stage 2 — sandbox billing, verified

**Status: the Stripe → Worker → Convex webhook path is verified end to end in
the sandbox.** No Customer, Subscription, Checkout Session or Portal
configuration exists yet, and nothing in live mode has been touched.

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

### What a click would create, and has not

Only in sandbox `acct_1TmENuLShxhb4mBz`, and only after Jeff clicks:

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

## 7. Not yet created

- Stripe Customer, Subscription, Checkout Session
- Billing Portal configuration
- any live-mode object
- annual checkout — the dev control is monthly only
- any production billing CTA — the pricing page CTA is still a disabled
  "Opening soon" button

The webhook parser's field readers remain **provisional**: they accept both known
locations for subscription period bounds and the invoice-to-subscription link.
They must be narrowed only against real payloads captured at the pinned version,
which requires a real subscription and has not happened yet.

## 8. Related

- `docs/architecture/cross-platform-subscriptions.md` — provider neutrality, the runtime split
- `docs/implementation/release-c1-phase4-entitlements.md` — grace window, tax deferral, commercial decisions
- `scripts/verify-webhook-signature.ts` — 34 signature checks
- `scripts/verify-plus-classification.ts` — 44 classification checks
- `scripts/verify-billing-dev-control.ts` — 98 checks on the dev checkout control
  (build `dist/` first, with the flag ON)
- `docs/operations/retired-webhook-secret-hygiene.md` — the retired donation flow
