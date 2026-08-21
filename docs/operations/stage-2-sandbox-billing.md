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

## 3. Configuration — names only, no values

### Convex dev `good-dotterel-906`

| Name | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | the **only** Stripe runtime credential, `rk_test_…` |
| `BILLING_WEBHOOK_SECRET` | shared secret, Worker → Convex |
| `STRIPE_PLUS_MONTHLY_PRICE_ID` | `price_1U6hytLShxhb4mBzduppVOya` |
| `STRIPE_PLUS_ANNUAL_PRICE_ID` | `price_1U6i0TLShxhb4mBzAldYiOcA` |
| `SITE_URL` | `https://feat-declare-checkout-dev.hope-finder-app.pages.dev` |

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

## 6. Not yet created

- Stripe Customer, Subscription, Checkout Session
- Billing Portal configuration
- any live-mode object
- frontend wiring — the pricing CTA is still a disabled "Opening soon" button and
  `createCheckoutSession` still has no caller

The webhook parser's field readers remain **provisional**: they accept both known
locations for subscription period bounds and the invoice-to-subscription link.
They must be narrowed only against real payloads captured at the pinned version,
which requires a real subscription and has not happened yet.

## 7. Related

- `docs/architecture/cross-platform-subscriptions.md` — provider neutrality, the runtime split
- `docs/implementation/release-c1-phase4-entitlements.md` — grace window, tax deferral, commercial decisions
- `scripts/verify-webhook-signature.ts` — 34 signature checks
- `scripts/verify-plus-classification.ts` — 44 classification checks
- `docs/operations/retired-webhook-secret-hygiene.md` — the retired donation flow
