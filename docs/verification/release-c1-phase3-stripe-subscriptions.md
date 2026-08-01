# Release C1 Phase 3 — Verification Report

**Deployments touched:** Convex **dev** `good-dotterel-906` only (schema + functions
pushed via `npx convex dev --once`, which is also the only available typecheck).
**Production `keen-hamster-650` was not touched. Nothing was deployed to
Cloudflare. Phase 3 is not pushed.**

---

## 0. Honest scope of this report

**Scripts that exist in `package.json`:** `dev`, `build`, `preview`, `astro`.

**There is no lint, test, typecheck or E2E script in this repository.** No such
script was run and none is claimed. TypeScript is not installed locally, so the
only typecheck performed is the one Convex runs when pushing functions.

Tests below are grouped into what was **executed** and what **requires
credentials** not available in this environment. Nothing in the second group is
reported as passing.

---

## 1. Executed — Convex function security

Probed against `https://good-dotterel-906.convex.cloud/api/{query,action}`.

| # | Test | Expected | Result |
|---|---|---|---|
| 1.1 | `mySubscription` unauthenticated | success + null | **PASS** — `null` |
| 1.2 | `createCheckoutSession` unauthenticated | rejected | **PASS** — `{error:"not-authenticated"}` |
| 1.3 | `createPortalSession` unauthenticated | rejected | **PASS** — `{error:"not-authenticated"}` |
| 1.4 | **Spoofed `userId` on checkout** | argument rejected | **PASS** — `ArgumentValidationError: Object contains extra field 'userId' that is not in the validator` |
| 1.5 | **`email` on portal** (the IDOR vector) | argument rejected | **PASS** — `ArgumentValidationError: … extra field 'email' …` |
| 1.6 | **`customerId` on portal** | argument rejected | **PASS** — `ArgumentValidationError: … extra field 'customerId' …` |
| 1.7 | `applyWebhook` via public API | not found | **PASS** — `Could not find public function` |
| 1.8 | `linkCustomer` via public API | not found | **PASS** — `Could not find public function` |
| 1.9 | `getByUserInternal` via public API | not found | **PASS** — `Could not find public function` |

**1.4–1.6 are the two donation-era vulnerabilities being structurally closed.**
The arguments do not exist on the validators, so they are rejected *before the
handler runs*.

**Ordering fix found during testing:** the first run returned
`billing-not-configured` to an unauthenticated caller, leaking configuration
state before identity was established. Auth now precedes the config check in
both actions; re-verified above.

---

## 2. Executed — Convex webhook ingress (shared secret)

Against `https://good-dotterel-906.convex.site/billing/subscription-event`.

| # | Test | Result |
|---|---|---|
| 2.1 | Wrong `x-billing-secret` | **PASS** — 401 |
| 2.2 | No secret header | **PASS** — 401 |
| 2.3 | Malformed body, valid secret | **PASS** — 400 |
| 2.4 | First event (`active`, t=1000) | **PASS** — `{ok:true}` |
| 2.5 | Replay same event id | **PASS** — `{ok:true, deduped:true}` |
| 2.6 | Newer event (`canceled`, t=3000) | **PASS** — `{ok:true}` |
| 2.7 | **Out-of-order older `active`, t=2000** | **PASS** — `{ok:true, stale:true}` |

Stored state after 2.7 — the stale event did **not** regress it:
```
status=canceled  tier=free  currentPeriodEnd=2000  (stale 9999 rejected)
lastWebhookEventId=evt_2
```

**Storage integrity:** 1 `subscriptions` row across 3 events (updated in place,
not duplicated), 1 `billingCustomers` row, 3 `billingEvents` rows with the
replay recorded exactly once.

---

## 3. Executed — full chain, Stripe-signed → Worker → Convex → DB

Worker run locally via `npx wrangler dev --local` with **test-only** values in
the gitignored `worker/.dev.vars`. Payloads signed with a real HMAC-SHA256
Stripe signature. No real Stripe credentials were used; `customer.subscription.*`
events carry full state so no Stripe API call is needed.

| # | Test | Result |
|---|---|---|
| 3.1 | Malformed `Stripe-Signature` header | **PASS** — 400 Invalid signature |
| 3.2 | Valid format, **wrong signing secret** | **PASS** — 400 Invalid signature |
| 3.3 | Valid signature but **1 hour old** (replay window) | **PASS** — 400 Invalid signature |
| 3.4 | `customer.subscription.created` (active) | **PASS** — 200, row created |
| 3.5 | Replay of 3.4 | **PASS** — 200, recorded once |
| 3.6 | `customer.subscription.deleted` (newer) | **PASS** — 200, applied |
| 3.7 | Out-of-order older `active` with `currentPeriodEnd=99999999` | **PASS** — ignored |
| 3.8 | **Donation session (`mode=payment`)** | **PASS** — ignored, no row for `user_DONOR` |
| 3.9 | Subscription-mode session with no subscription id | **PASS** — acknowledged, no row |
| 3.10 | Unrelated event type (`customer.created`) | **PASS** — 200, no state change |

Final stored row:
```
userId=user_E2E  stripeSubscriptionId=sub_E2E  stripeCustomerId=cus_E2E
stripePriceId=price_test_m  billingInterval=month
tier=free  status=canceled
currentPeriodEnd=1788124291   ← NOT the stale 99999999
lastWebhookEventId=evt_e2e_2
```

**3.8 is the donation-isolation guarantee**: a donation Checkout session cannot
become a Plus subscription.

Rig torn down: wrangler stopped, `worker/.dev.vars` deleted (confirmed
gitignored while it existed).

---

## 4. Executed — checkout routes, both languages

390×844, English and Spanish, dev server.

| # | Test | EN | ES |
|---|---|---|---|
| 4.1 | **Forged `session_id` grants nothing** | **PASS** | **PASS** |
| 4.2 | Signed out → sign-in state | **PASS** | **PASS** |
| 4.3 | No JS errors on success | **PASS** | **PASS** |
| 4.4 | Cancelled preserves `plus-annual` | **PASS** | **PASS** |
| 4.5 | No JS errors on cancelled | **PASS** | **PASS** |
| 4.6 | **Hostile `?plan=//evil.com` rejected** → `/pricing` | **PASS** | **PASS** |
| 4.7 | Spanish renders | n/a | **PASS** — "Inicia sesión para ver tu plan", "No se inició ninguna suscripción" |

4.1 used `session_id=cs_test_FORGED_BY_ATTACKER`: the confirmed state stayed
hidden and the sign-in state rendered.

---

## 5. Executed — build and static checks

```
npm run build      → 14 pages, Complete, no errors
git diff --check   → clean
node --check worker/src/index.js        → valid
node --check public/declare/i18n-strings.js → valid
npx convex dev --once  → "Convex functions ready" (typecheck passed)
```

Worker diff at the end of the **four original Phase 3 commits** was additive
only: 138 insertions, 0 deletions, all four `/give` routes unchanged.

The **security follow-up** then deliberately removed code: 48 insertions,
**236 deletions**, retiring three unsafe `/give/*` routes and deleting their
handlers. `/give/webhook` remains unchanged. See section 8.

---

## 6. NOT executed — requires credentials

These need real Stripe **test-mode** keys, configured Price ids, and a signed-in
browser session. **None of these are claimed as passing.**

| Test | Blocked on |
|---|---|
| Monthly Plus Checkout Session creation | Stripe test key + `STRIPE_PLUS_MONTHLY_PRICE_ID` |
| Annual Plus Checkout Session creation | Stripe test key + `STRIPE_PLUS_ANNUAL_PRICE_ID` |
| Invalid alias rejected **when authenticated** | signed-in session (unauth returns `not-authenticated` first, correctly) |
| Arbitrary `price_...` rejected **when authenticated** | signed-in session |
| Existing active subscriber blocked from duplicate | Stripe test key + a completed test subscription |
| Idempotent Checkout retry (same `Idempotency-Key`) | Stripe test key |
| Stripe customer created once and reused | Stripe test key |
| Authenticated Plus user receives their portal | Stripe test key + subscription |
| User without mapping rejected from portal | signed-in session (code path verified by inspection: returns `no-subscription`) |
| `invoice.paid` / `invoice.payment_failed` lifecycle | Stripe test key (these fetch the subscription from Stripe) |
| Stripe Test Clocks for renewal / past_due | Stripe test key |
| Success page reaching **confirmed** state | signed-in session + completed test subscription |

**To complete these:** create the two Products/Prices in Stripe test mode, set
the env vars in section 3 of the implementation doc, point a Stripe test webhook
at the Worker's `/billing/webhook`, then re-run with a signed-in test account.

---

## 7. Verified by inspection

- No `export const … = mutation(` in `convex/subscriptions.ts` — no public write path.
- `convex/userdata.ts` contains no plan/tier/subscription concept.
- No read path from `giftHistory` / `giftStats` / `giftEvents` into any billing decision.
- `success_url`, `cancel_url`, `return_url` are all built from `SITE_URL`, never
  from a browser-supplied origin or path.
- Stripe metadata carries `userId` and `plan` alias only — no reflection text,
  struggle text or spiritual content.
- Subscription webhook logs event type and downstream status only, never payload.

---

## 8. Security follow-up — legacy donation routes (executed)

Audit of **every** `/give/*` route for browser-supplied identity:

| Route | Accepted from browser | Disposition |
|---|---|---|
| `/give/checkout` | `userId`, amount, `path` | **Retired 410**, `handleCheckout` deleted |
| `/give/portal` | `userId`, **`email`** | **Retired 410**, `handleBillingPortal` deleted incl. email search |
| `/give/subscription` | **`subscriptionId`** (no ownership check) | **Retired 410**, `handleSubscription` deleted |
| `/give/webhook` | nothing (Stripe-signed) | **Unchanged** — still records historical gifts |

Handlers were **deleted, not merely unrouted**: leaving a working IDOR one route
line away from being reachable again is not a fix. Worker diff: 48 insertions,
**236 deletions**.

Replaced by authenticated Convex actions in `convex/giving.ts`.

| # | Test | Result |
|---|---|---|
| 8.1 | `donationPortalSession` unauthenticated | **PASS** — `not-authenticated` |
| 8.2 | `donationPortalSession {email}` | **PASS** — ArgumentValidationError |
| 8.3 | `donationPortalSession {customerId}` | **PASS** — ArgumentValidationError |
| 8.4 | `donationPortalSession {stripeCustomerId}` | **PASS** — ArgumentValidationError |
| 8.5 | `donationPortalSession {userId}` | **PASS** — ArgumentValidationError |
| 8.6 | `myRecurringGiftStatus` unauthenticated | **PASS** — `not-authenticated` |
| 8.7 | `myRecurringGiftStatus {subscriptionId}` | **PASS** — ArgumentValidationError |
| 8.8 | `myRecurringGiftStatus {userId}` | **PASS** — ArgumentValidationError |
| 8.9 | `POST /give/checkout {userId:"victim_user"}` | **PASS** — 410, nothing created |
| 8.10 | `POST /give/portal {userId,email}` | **PASS** — 410 |
| 8.11 | `POST /give/subscription {subscriptionId}` | **PASS** — 410 |
| 8.12 | `/give/webhook` still routed | **PASS** — 400 (signature check running) |
| 8.13 | `/billing/webhook` still routed | **PASS** — 400 |
| 8.14 | Historical receipt `/give?status=success` | **PASS** — renders, no redirect |
| 8.15 | Historical receipt `/es/dar?status=success` | **PASS** — renders |
| 8.16 | Ordinary `/give` and `/es/dar` visits | **PASS** — redirect to `/pricing` |
| 8.17 | No gift history → archive hidden | **PASS** |
| 8.18 | `/you` makes **no** call to retired routes | **PASS** — 0 requests |
| 8.19 | Pricing CTA still non-transactional | **PASS** |
| 8.20 | Forged `session_id` grants nothing | **PASS** |

`grep` confirms `v1/customers?email`, executable `body.userId`, `body.email` and
`body.subscriptionId` no longer appear in `worker/src/index.js` (remaining
matches are prose inside the retirement comment).

**No gift record was modified.** `giftHistory`/`giftStats`/`giftEvents` schema and
queries are untouched by this follow-up; the dev deployment holds 0 gift rows
(real history is in prod, which was not touched).

**No Plus entitlement was created.** **No production Stripe call was made** — the
Worker ran locally with a placeholder key, and no `--prod` command was issued.

---

## 9. Dev fixtures — removed

The synthetic rows under `user_TEST1` and `user_E2E` have been **deleted** from
dev (2 subscription rows, 2 customer mappings, 6 event rows) using a temporary
`internalMutation` scoped to those exact ids, which was then deleted from disk
and from the deployment. Verified afterwards: `subscriptions` 0 rows,
`billingEvents` 0 rows, `_devcleanup` absent from the function spec.

They were not required for repeatable testing — fixtures are reproducible by
replaying signed webhooks, which section 3 demonstrates.

**Absent from production, verified read-only:** `npx convex function-spec --prod`
lists 23 functions, **none** of them `subscriptions:*`, `billing:*` or `giving:*`.
The tables do not exist in prod, so the fixtures could not have existed there.
No real record was deleted.

### Development webhook secret

`BILLING_WEBHOOK_SECRET` on `dev:good-dotterel-906` is **development-only**.

- It must **not** be reused in production.
- Production must receive an **independently generated** secret.
- Its value is not printed here, not in any committed file, and not in any doc.
- Not rotated, since the current dev test environment still uses it.

The same applies to `STRIPE_BILLING_WEBHOOK_SECRET`, which was generated locally
for the Worker test rig in a gitignored `worker/.dev.vars` that has since been
deleted.

---

## 9. Outstanding before public launch

1. Stripe test-mode Products/Prices + env vars, then section 6.
2. Approve the `past_due` grace window (recommended 3 days).
3. Native es-LA editorial review of billing strings.
4. Phase 4 entitlement resolver — nothing reads `tier` yet.
5. Donation-era `body.userId` and portal email-IDOR remain live **for donations**;
   out of Phase 3 scope, to be addressed when the Worker needs identity for
   Phase 4 metering.
