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

Worker diff is **additive only**: 138 insertions, 0 deletions. All four `/give`
routes present and unchanged.

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

## 8. Known state left in the dev deployment

Synthetic test rows remain in **dev only**, under `user_TEST1` and `user_E2E`.
They cannot affect a real account: `mySubscription` looks up by the authenticated
Better Auth user `_id`, which never equals those strings. They are useful
fixtures for Phase 4 resolver work (a `canceled`/`free` subscription). Delete
them from the Convex dashboard if a clean slate is preferred.

`BILLING_WEBHOOK_SECRET` was set on the **dev** deployment for this testing. It
must be regenerated independently for production.

---

## 9. Outstanding before public launch

1. Stripe test-mode Products/Prices + env vars, then section 6.
2. Approve the `past_due` grace window (recommended 3 days).
3. Native es-LA editorial review of billing strings.
4. Phase 4 entitlement resolver — nothing reads `tier` yet.
5. Donation-era `body.userId` and portal email-IDOR remain live **for donations**;
   out of Phase 3 scope, to be addressed when the Worker needs identity for
   Phase 4 metering.
