# Cross-platform subscriptions — Stripe today, StoreKit later

**Status: architecture of record. No Apple product exists yet, and no iOS code is
written.** This document exists so that building the iOS app later is an
*addition* rather than a billing rewrite.

Written 2026-08-20 during Stage 2A, before the first Stripe sandbox object was
created.

---

## 1. The one rule

**Convex owns the canonical entitlement. Stripe and Apple are billing providers,
and neither is the source of truth.**

A provider tells us *that someone paid and through which rails*. Convex decides
*what that person may do*. Those are different questions, and collapsing them is
what makes a second billing provider expensive to add later.

Concretely:

- `getMyEntitlements` resolves Plus from **either** provider.
- The frontend contains **no** Stripe-specific entitlement logic. It must never
  branch on `stripeSubscriptionId`, a Stripe status string, or a Price id.
- Losing Plus caps what an account may do next. It never deletes content the
  person already has. This holds identically for both providers.

## 2. Provider-neutral model

Every subscription record, whatever the provider, carries these concepts:

| Concept | Values | Notes |
|---|---|---|
| `provider` | `stripe` \| `app_store` | Which rails billed the money |
| `planKey` | `plus_monthly` \| `plus_annual` | **Canonical.** Provider-independent |
| `userId` | Better Auth user id | Derived server-side. Never client-supplied |
| `environment` | `sandbox` \| `production` | A sandbox purchase must never grant production Plus |
| `status` | provider-native, stored verbatim | Not collapsed, so the resolver can distinguish `past_due` from `unpaid` |
| `currentPeriodEnd` | epoch ms | Drives the grace window |
| `cancelAtPeriodEnd` / `canceledAt` | cancellation state | Same meaning on both providers |

Provider-specific identifiers are stored but **compartmentalised**:

| Provider | Identifiers |
|---|---|
| Stripe | `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId` |
| Apple | `appleOriginalTransactionId`, `appleAppAccountToken` |

### Client response contract

**No provider-specific identifier is ever returned to a normal client
response.** `mySubscription` and `getMyEntitlements` return only:

```
tier, status, planKey, provider, currentPeriodEnd,
cancelAtPeriodEnd, needsAttention, graceEndsAt
```

`provider` is included deliberately — it is an enum, not an identifier, and the
billing-management UI needs it to route the customer to the right place. It
reveals nothing that could be used to name another customer.

Withholding the ids means a compromised client cannot even *address* another
customer's billing, which is the structural half of the fix that closed the
retired donation portal's IDOR.

## 3. Plan mapping table

One canonical plan key per row. Provider identifiers hang off it.

| Canonical plan | Stripe sandbox Price | Stripe live Price | Apple product ID |
|---|---|---|---|
| `plus_monthly` | pending | pending | pending |
| `plus_annual` | pending | pending | pending |

**Do not create Apple product IDs yet.** The Apple column stays `pending` until
an App Store Connect app record exists.

Resolution is table-driven in both directions:

- **inbound** — a provider identifier resolves to a `planKey`
- **outbound** — a `planKey` plus a `provider` resolves to what to charge

Nothing outside this table may map a price to a plan. A Product's *display name*
is never evidence of anything (see §5).

## 4. Entitlement resolution across providers

An account may hold rows from more than one provider. The resolver:

1. Reads every subscription row for the user.
2. Interprets each into a tier using the provider-neutral status rules, including
   the `past_due` / `unpaid` grace window of **3 days**.
3. Grants the **most generous** result. Any single row resolving to Plus grants
   Plus.
4. Sets `needsAttention` if *any* row needs attention, so a failing card is
   surfaced even when another provider is currently carrying the entitlement.
5. Sets `duplicateProviders` when **more than one provider** has a row that
   independently resolves to Plus.

`environment` must match the running deployment. A sandbox row never grants Plus
in production.

### Duplicate cross-provider subscriptions

Someone can buy Plus on the web and then buy again inside the iOS app — Apple
cannot see a Stripe subscription and will not prevent it.

- **Detect**: `duplicateProviders` is computed by the resolver, not the client.
- **Warn**: the account screen tells them plainly that they are paying twice and
  which provider to cancel.
- **Never auto-cancel.** Cancelling someone's subscription without asking is a
  refund and support problem, and Apple's rules do not let us cancel an Apple
  subscription from the server anyway.
- **Prevent where possible**: before opening a purchase flow on either platform,
  check the canonical entitlement first and offer "you already have Plus"
  instead of a purchase button.

## 5. Classifying a purchase as Plus

A subscription grants Plus only when **all** server-controlled evidence agrees.
This is the C2 rule, and it exists because the retired donation flow also used
`mode: subscription` — a recurring gift is structurally indistinguishable from a
Plus purchase if you look only at the mode.

**Never sufficient, alone or together:**

- `mode === "subscription"`
- a generic subscription lifecycle event
- a Product display name

**Required, all of them:**

1. an approved Price id or lookup key for the environment
2. `metadata.plan` equal to the canonical `planKey`, and consistent with (1)
3. provenance — the session was created by the authenticated billing action
4. the account mapping resolves server-side

A retired gift must never grant Plus.

## 6. iOS future contract

Recorded now, built later.

| Concern | Contract |
|---|---|
| Purchase | StoreKit 2 in-app purchase, auto-renewable subscription |
| Account linkage | Every purchase sets a stable **`appAccountToken`** (UUID) derived from and stored against the Declare account, so Apple's receipt can be attributed to a user |
| Server updates | **App Store Server Notifications V2** → a Convex HTTP endpoint, verified, idempotent, ordered — the same guarantees `applyWebhook` already gives Stripe |
| State verification | **App Store Server API** is the authority for current state. Notifications are a trigger to re-verify, never the sole input |
| Plan mapping | Apple product IDs map to the same canonical `planKey` values via §3 |
| Web → iOS | A web subscriber signing into iOS gets Plus with **no second purchase**. The entitlement is already canonical; iOS only reads it |
| iOS → web | An Apple subscriber signing into the web app gets Plus, resolved identically |
| Billing management | Stripe customers route to the **Stripe Billing Portal**. Apple customers route to **Apple subscription management** (`itms-apps://apps.apple.com/account/subscriptions`). Routing is driven by the `provider` field |
| Duplicates | Detected and warned per §4 |

### Constraints to design against, not discover later

- Apple's `appAccountToken` must be a UUID and is only available on StoreKit 2.
  It must be minted server-side and stored *before* the purchase begins,
  otherwise an anonymous purchase cannot be attributed to an account.
- Apple has its own sandbox with its own notification URL. `environment` must be
  carried on every Apple row for the same reason it is carried on Stripe rows.
- Apple handles its own tax and remittance. The Stripe Product Tax Code (§7 of
  the Stage 2 report) applies to the **web** only.
- Apple's grace period and billing retry are configured in App Store Connect and
  are *not* the same mechanism as our 3-day `past_due` window. Both must resolve
  to the same customer-visible behaviour.
- Apple takes a commission. Pricing parity between web and iOS is a commercial
  decision that is **not** made in this document.

## 7. What is deliberately not decided here

- Apple product identifiers and App Store Connect configuration
- whether iOS pricing matches web pricing
- refund policy on either provider
- Family and Church, which have no entitlement tier and no price on any provider

## 8. Related

- `convex/entitlementCatalog.ts` — the one place a limit is a number
- `convex/entitlements.ts` — the resolver
- `convex/subscriptions.ts` — the provider mirror and webhook application
- `convex/billing.ts` — authenticated Checkout and Portal
- `docs/operations/retired-webhook-secret-hygiene.md` — the retired donation flow
