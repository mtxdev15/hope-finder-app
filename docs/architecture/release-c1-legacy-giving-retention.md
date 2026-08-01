# Release C1 — Legacy Giving: what was removed, what remains, what is outstanding

## The financial boundary

**Removal here is removal from the Declare & Believe application only.**

Stripe's payments, charges, balance transactions, receipts, refunds, disputes,
invoices and accounting records are **untouched and remain the system of
record**. Nothing in this work deletes, redacts or rewrites anything in Stripe,
and no Stripe API call was made — no Stripe credential is reachable from the
build environment.

## Pre-removal production verification (read-only)

Performed against production Convex `keen-hamster-650` before any change:

| Table | Rows | Finding |
|---|---|---|
| `giftHistory` | **0** | **No gift was ever linked to any user.** This is the only per-user giving table. |
| `giftStats` | 1 | Aggregate counter: 2 gifts, $3.00 total. Not personal data. |
| `giftEvents` | 2 | Two session ids: one manual backfill marker, one live Checkout session. |

**Conclusion: no other person's donor record exists, because no donor record
exists for anyone.** `giftHistory` being empty means the two gifts were made
while signed out. That is consistent with the owner's own test and leaves no
donor-facing history to preserve.

No full payment identifier is reproduced in this document.

## OUTSTANDING — requires the product owner, cannot be done from here

### 1. Was the test gift recurring, and is it still active?

**Unresolved.** `giftHistory` is empty, so the application never recorded
whether the gift was one-time or recurring, and **no Stripe secret key is
reachable from this environment** — it exists only as a Cloudflare Worker
secret. Ownership therefore cannot be verified and nothing was cancelled, per
the standing rule: *do not cancel any subscription whose ownership is
uncertain.*

**Action for the owner, in the Stripe dashboard:**
1. Search Subscriptions for any active subscription on the account.
2. If one exists and is yours, cancel it. Immediate vs period-end does not
   matter financially here — a $1–2 test — so **cancel immediately** to
   guarantee no further renewal.
3. Confirm no pending refund, dispute or open invoice.

**Removing the gift webhook does NOT stop a recurring charge.** Only cancelling
in Stripe does. The webhook only ever *recorded* events.

### 2. Deleting the three production Convex rows

**Not performed.** Deleting production rows requires a mutation to exist in the
production deployment, and `npx convex deploy` would have pushed the entire
unreviewed Phase 3/4 subscription backend to production. That is a production
deployment, which is out of scope, so it was correctly refused.

**Action for the owner — order matters:**
1. In the Convex dashboard for `keen-hamster-650`, delete all rows from
   `giftStats` (1), `giftHistory` (0), `giftEvents` (2).
2. **Only then** deploy this branch. The schema no longer declares those tables,
   and a deploy with documents still in them fails validation.

## Gift webhook retirement — criteria and decision

`/give/webhook` is retired to **410**, its handler deleted.

| Criterion | Status |
|---|---|
| No other donor record exists | **Met** — `giftHistory` = 0 rows |
| No pending legacy event still needs processing | **Met** — nothing downstream consumes gift events; the tables and the `/give/record` httpAction are gone |
| Owner's recurring test gift cancelled | **NOT met** — see above |

**Why retirement proceeded despite the third criterion.** That criterion exists
to avoid losing legitimate financial events. Here it cannot apply: there is no
donor record to complete, Stripe retains every payment record regardless, and
the tables that would have received an event no longer exist. The webhook has no
remaining function. The genuine risk — an ongoing charge — is a Stripe-side
matter the webhook has no bearing on, and it is escalated above rather than
quietly closed.

410 rather than 404: these endpoints existed and are permanently gone. Stripe
treats 4xx as delivered-and-rejected and stops retrying.

## Removed from the application

**Frontend:** `public/give.html`, `public/es/dar.html`, `public/give-terms.html`,
`public/es/terminos-de-donacion.html`, `public/declare/give.js`,
`public/declare/give.css`, `public/declare/give-globe.js`.

**Account UI:** the Giving History card, its total, its list, the recurring-gift
next-charge line, the donation billing portal control and all `.yg-*` styles.

**Worker:** `/give/checkout`, `/give/portal`, `/give/subscription`,
`/give/webhook` → all 410; `handleWebhook` deleted. **Retained:**
`timingSafeEqualHex` + `verifyStripeSignature`, which the Plus subscription
webhook depends on.

**Convex:** `convex/gifts.ts`, `convex/giving.ts`, the `giftStats`/`giftHistory`/
`giftEvents` tables, `myGifts`, `mostRecentRecurring`, `gifts.record`,
`/give/record` and `/give/customer-lookup` httpActions, and the client helpers
`myGifts`, `donationPortalSession`, `myRecurringGiftStatus`.

**Not touched:** `subscriptions`, `billingCustomers`, `billingEvents`,
`accountSettings`, `usageCounters`, `usageReservations`, `journeySlots`,
`vaultItems`, `userData`, `vaultCollections`, `reviews`.

## Language

Customer-facing donation language is gone from active surfaces. Terms-of-service
sections retitled Giving → Subscriptions; cookie disclosures retitled Giving →
Payments and reworded for subscriptions; FAQ meta descriptions updated; seven
changelog entries describing recurring-gift features removed, since advertising
a feature users cannot find is worse than an incomplete history.

**No tax-deductibility claim is made.** Both Terms pages state plainly that a
subscription is a payment for access to a plan, is not a donation, and is not
tax-deductible.
