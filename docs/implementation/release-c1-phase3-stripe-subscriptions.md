# Release C1 Phase 3 — Stripe Subscription Backend (test mode)

**Status:** implemented locally, not pushed, not deployed to production.
**Scope:** billing truth and lifecycle storage only. **This phase grants no
application entitlement.** Phase 4 adds the centralized resolver.

---

## 1. What this phase does and does not do

| Does | Does not |
|---|---|
| Authenticated Checkout Session creation | Activate the public Plus CTA |
| Real Product/Price id configuration | Gentle Guidance |
| Verified subscription webhooks | Usage counters |
| Server-authoritative customer mapping | Active-Journey enforcement |
| Subscription lifecycle storage | Plan-based UI gates |
| Customer Portal session creation | Family / Church checkout |
| Duplicate-subscription prevention | Production Stripe mode |
| Idempotency and ordering guards | Public deployment |
| success / cancelled backend routes | Worker AI changes |

A subscription row with `tier: "plus"` currently unlocks **nothing**. No code
reads it yet. That is intentional: billing truth lands first, enforcement second,
so a bug in one cannot silently become a bug in the other.

---

## 2. Architecture and why

```
                    ┌───────────────────────────────┐
  signed-in browser │  no user id, no email,        │
        │           │  no Stripe id ever sent       │
        │  plan alias only ("plus-monthly")         │
        ▼           └───────────────────────────────┘
  convex/billing.ts  (action)
        │  identity  = authComponent.safeGetAuthUser(ctx)   ← trusted context
        │  price      = PRICE_ALIASES[alias] -> env Price id
        │  customer   = stored mapping, or created once
        ▼
     Stripe API  ──────────────────────────────────────────┐
                                                           │
  Stripe ──(signed)──► Worker /billing/webhook             │
                          verifies HMAC-SHA256,            │
                          constant-time, 5-min replay      │
                          extracts minimal fields          │
                              │ x-billing-secret           │
                              ▼                            │
                   Convex /billing/subscription-event      │
                              │                            │
                              ▼                            │
              internal.subscriptions.applyWebhook  ◄───────┘
                 idempotency · ordering · identity
                              │
                              ▼
                    subscriptions table (truth)
```

### Why Checkout and Portal are Convex actions, not Worker routes

The Worker **cannot verify Better Auth identity**. It has no session check, no
JWT verification and no Better Auth import — which is exactly how the donation
flow ended up trusting a browser-supplied `body.userId`
(`worker/src/index.js:590`). Two options existed:

1. Add JWT verification to the Worker. This means new crypto, a second copy of
   auth logic, and a new class of bug where the two implementations disagree.
2. Put the authenticated operations where identity already lives.

We chose (2). In a Convex action, `authComponent.safeGetAuthUser(ctx)` resolves
identity from trusted context, so the prohibited pattern is not merely avoided —
**it is unrepresentable.** There is no `userId` argument on either action, so
there is nothing to spoof. Verified: passing one returns
`ArgumentValidationError` before the handler runs.

### Why the webhook stays in the Worker

Stripe needs a stable public endpoint, and the Worker already has reviewed,
constant-time signature verification with a replay window. Reusing it means no
new crypto. The Worker forwards minimized state to Convex over a shared secret,
matching the existing `/give/record` topology.

**Trade-off, stated plainly:** this puts `STRIPE_SECRET_KEY` in two trusted
environments (Convex for the API calls, Worker for reading subscription detail
during webhook handling). The alternative — routing Convex→Worker→Stripe — would
keep one copy of the secret but adds a whole new authenticated channel that
itself becomes a target, where a leaked shared secret would let anyone mint
Checkout Sessions for arbitrary users. Fewer trust boundaries won.

---

## 3. Environment variables

**No secret values are committed.** Names only.

### Convex (`npx convex env set …`)

| Name | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API calls for Checkout + Portal. **Test key in test mode.** |
| `STRIPE_PLUS_MONTHLY_PRICE_ID` | Trusted Price id for `plus-monthly` |
| `STRIPE_PLUS_ANNUAL_PRICE_ID` | Trusted Price id for `plus-annual` |
| `BILLING_WEBHOOK_SECRET` | Shared secret proving the caller is our Worker |
| `SITE_URL` | Already present. Builds success/cancel URLs server-side. |

### Cloudflare Worker (`wrangler secret put …`)

| Name | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Already present (donations). Reads subscription detail. |
| `STRIPE_BILLING_WEBHOOK_SECRET` | Stripe signing secret for the **subscription** endpoint |
| `BILLING_WEBHOOK_SECRET` | Must match the Convex value |
| `CONVEX_SITE_URL` | Already present |

`STRIPE_BILLING_WEBHOOK_SECRET` is deliberately **separate** from
`STRIPE_WEBHOOK_SECRET` (donations). Two products, two endpoints, two signing
secrets — one leaked secret must not compromise the other.

---

## 4. Products and Prices

Approved: **Plus Monthly $8.99/mo**, **Plus Annual $79.99/yr**, both USD.

Create these as real Stripe Products with recurring Prices in **test mode**, then
set the two Price id env vars. The ad-hoc `price_data` construction used by
donations (`worker/src/index.js:416-422`) is **not** reused: an inline price is
fine for a variable donation amount but wrong for a fixed product, since it
leaves no catalog, no reporting dimension and no way to change price without a
code deploy.

**Client may submit only these aliases:**

```
plus-monthly
plus-annual
```

Anything else — including a raw `price_...` — is rejected with `unknown-plan`.
Without this, a client could check out against a $0 price or a price belonging
to a different product.

**Family and Church have no alias and no active Price in this phase.**
**No trial is configured or advertised** (none was approved).

---

## 5. Data model

Three new tables. All separate from the donation archive.

### `subscriptions`
Mirrors verified Stripe lifecycle. Indexed `by_user`, `by_subscription`,
`by_customer`. `status` is stored **verbatim** from Stripe rather than collapsed
to a boolean, so Phase 4 can distinguish `past_due` from `unpaid` from `canceled`
without re-querying Stripe.

### `billingCustomers`
The account → Stripe customer mapping, deliberately a **separate table** so it
survives a subscription being deleted. A returning subscriber must land on their
existing Stripe customer, or their billing history fragments across duplicates.

### `billingEvents`
Subscription webhook idempotency. **Not `giftEvents`** — that table is keyed by
Checkout session and belongs to the donation archive. Sharing it would let one
product's replay suppress the other's legitimate event.

### Why not `userData`

`convex/userdata.ts:31-48` `set({key, value})` accepts **arbitrary key and value**
from any signed-in browser. Plan state placed there is forgeable in one console
line. Nothing in this design reads plan state from `userData`, and there is no
public mutation on any billing table.

---

## 6. Lifecycle decisions (Phase 4 enforces these)

| Stripe status | Stored `tier` | Checkout again? | Phase 4 entitlement |
|---|---|---|---|
| `active` | `plus` | blocked → portal | Plus |
| `trialing` | `plus` | blocked → portal | Plus (not advertised; honoured if legacy state exists) |
| `past_due` | `plus` | blocked → portal | **Plus during a configurable grace window**, then Free |
| `unpaid` | `free` | blocked → portal | Free. No new premium usage. Content preserved. |
| `canceled` | `free` | allowed | Free |
| `incomplete` | `free` | **allowed** (fresh session is the correct recovery) | Free |
| `incomplete_expired` | `free` | allowed | Free |
| cancel-at-period-end | `plus` | blocked → portal | Plus **through `currentPeriodEnd`**, then Free |
| unrecognised | as returned | **blocked** | refuse rather than guess |

**Recommended grace period for `past_due`: 3 days**, configurable. Rationale: a
failed card retry is usually a bank hiccup, and dropping someone from Plus the
instant a retry fails is the wrong pastoral default. This is a **recommendation
for approval**, not an activated policy — Phase 4 implements it.

**Content is never deleted on downgrade.** Not reflections, Journeys, Vault
items or verse images. Losing Plus caps what you can do next; it never takes
away what God has already given you through the app.

---

## 7. Historical donation isolation

Gift and subscription semantics are never mixed.

- `giftStats`, `giftHistory`, `giftEvents` remain untouched historical records.
- A historical gift `subscriptionId` is a **recurring donation**, not Plus.
- A `customerId` in gift history is **not** consulted by the Portal action.
- Total giving, donor status and recurring-gift state grant **nothing**.
- `checkout.session.completed` is ignored unless `mode === 'subscription'`, so a
  recurring gift can never be read as a Plus purchase.

**A donor is a Free user unless they separately subscribe to Plus.**

### Customer reconciliation strategy

A past donor may already have a Stripe customer from giving. This phase
**deliberately does not reuse it**:

- Gift history is incomplete (the donation webhook only ever handled
  `checkout.session.completed`, so renewals were never recorded).
- A donation customer and a subscription customer being the same record is
  convenient but not *proven* identity.

`linkCustomer` therefore **refuses to silently repoint** an account at a
different Stripe customer, throwing `customer-mapping-conflict` instead. That
surfaces as a support path rather than a silent billing merge.

**Administrative reconciliation (manual, deliberate):** when a duplicate is
confirmed by a human, merge in the Stripe dashboard first, then update the
single `billingCustomers` row. Never automate it — an incorrect merge attaches
one person's payment method to another's account.

---

## 8. Files

| File | Change |
|---|---|
| `convex/schema.ts` | +3 tables (`subscriptions`, `billingCustomers`, `billingEvents`) |
| `convex/subscriptions.ts` | new — 1 narrowed public query, 2 internal queries, 2 internal mutations |
| `convex/billing.ts` | new — `createCheckoutSession`, `createPortalSession` actions |
| `convex/http.ts` | +`/billing/subscription-event` httpAction |
| `worker/src/index.js` | +`/billing/webhook` route and handler (**additive only**, 138 insertions, 0 deletions) |
| `src/app/declare/convex-data.js` | +`runAction`, +3 billing helpers |
| `src/app/declare/billing-copy.js` | new — server codes → localized copy |
| `src/app/declare/analytics.js` | +8 allowlisted billing events |
| `src/pages/checkout/success.astro` | new |
| `src/pages/checkout/cancelled.astro` | new |
| `public/declare/i18n-strings.js` | +checkout/billing Spanish (needs es-LA review) |

---

## 9. Phase 4 dependencies

1. **Central entitlement resolver** — one server-side function returning
   `{ tier, limits, usage }`. Nothing else may decide entitlement.
2. **Free vs Plus evaluation** — 2 active Journeys / 3 Gentle Guidance per day
   on Free; unlimited on Plus.
3. **Grace-period enforcement** — the `past_due` window recommended above.
4. **Usage counters** — atomic per-user-per-day. Note the existing day-boundary
   conflict: `journey.astro:520` `todayStr()` is non-padded local time while
   `index.astro:354` is UTC ISO. **Pick one deliberately before counting.**
5. **Active-Journey enforcement**.
6. **Worker integration** — Gentle Guidance is metered, and the Worker still
   cannot verify identity. Either add token verification there or move the
   metered call into a Convex action (fewer new security surfaces).
