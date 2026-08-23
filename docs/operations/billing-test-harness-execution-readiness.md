# Billing Test Clock harness — execution readiness

**This document does not authorize execution.** It is the audit that proves the
merged harness *could* be run safely, and the runbook the operator follows when
a separate task authorizes it. Nothing here has been run.

**Audited commit:** `8f62ba9` (merge of PR #37).
**Harness state:** disabled, undeployed, never invoked.
**Deployed development functions:** 47 callable, **0 attributed to
`testHarness`**. `runCommand` and `fixtureStatus` are both absent from
`good-dotterel-906`.

Locally generated types do not imply deployed availability. The deployed
function specification is the only authority on what exists, and it says the
harness does not.

---

## 1. Why this harness exists

`paymentNeedsAttention` is a pure function of the **subscription's** status
(`entitlements.ts`, `past_due` / `unpaid`), and the webhook stores that status
from the live subscription — never from an invoice. A failed one-off invoice is
therefore ignored twice: the resolver reads only
`invoice.parent.subscription_details.subscription`, and even a mapped invoice
would not move the subscription's status. See §6.20 of
`stage-2-sandbox-billing.md`.

Only a genuine `subscription_cycle` failure reaches this path, and only a Test
Clock produces one on demand.

---

## 2. Public contract

Two functions, both authenticated.

| | |
|---|---|
| Action | `testHarness.runCommand` |
| Args | **exactly** `{ command: v.string() }` |
| Query | `testHarness.fixtureStatus` |
| Args | **none at all** |

Six commands, everything else rejected as `unknown-command`:

```
provision  arm_failure  advance_to_renewal
restore_and_pay  cancel_fixture  delete_clock
```

**Response — the complete set of fields an operator ever sees:**

```
phase  allowed  inFlight  attemptCount  hasFixture  lastError
```

Built by construction from an allowlist, not by deleting fields, so a column
added to the fixture table later cannot leak by being forgotten. No application
user id, Customer, Subscription, Test Clock, Invoice, PaymentMethod, event or
Price identifier, no email, no URL, no raw Stripe response, no secret.

**The operator never needs a provider identifier to run this.** Every decision
is made from `phase`, `allowed`, `inFlight`, `attemptCount` and `lastError`.

### Reading the outcome

| Situation | How it presents |
|---|---|
| Accepted and complete | `ok: true`, `phase` = the command's terminal phase |
| Waiting on webhook convergence | `ok: false`, `lastError: not-converged`, phase stays in-flight |
| Double-clicked | `already-running` |
| Wrong phase | `wrong-phase` |
| Harness off | `harness-disabled` |
| Wrong deployment | `wrong-deployment` |
| Not signed in | `not-authenticated` |
| Unsafe provider relationship | `clock-not-owned` |
| Advance target too far | `advance-target-unsafe` |
| More than one failed attempt | `unexpected-attempt-count` |
| Unknown external result | `stripe-error` |

Sixteen codes total. Stripe's own error text never escapes the server, because
it can carry request details and object ids.

---

## 3. Environment inventory

Exact names, taken from merged source. **No secret values appear here.**

| Variable | Runtime | When | Required | Notes |
|---|---|---|---|---|
| `BILLING_TEST_HARNESS_ENABLED` | Convex server | runtime | **set to enable** | Must equal the exact string `true`. `"1"`, `"yes"`, `"TRUE"`, whitespace variants and boolean-like values are all refused. |
| `BILLING_TEST_HARNESS_DEPLOYMENT` | Convex server | runtime | **set to enable** | The *expected* deployment name, `good-dotterel-906`. On its own it proves nothing. |
| `CONVEX_CLOUD_URL` | Convex server | runtime | already present | **Platform-set.** The *actual* deployment identity. |
| `CONVEX_SITE_URL` | Convex server | runtime | already present | Fallback for the above; already used by `convex/auth.ts`. |
| `STRIPE_SECRET_KEY` | Convex server | runtime | already present | Must resolve to `sandbox` via `environmentForSecret`. |
| `STRIPE_PLUS_ANNUAL_PRICE_ID` | Convex server | runtime | already present | Read server-side through `PLAN_CATALOG.plus_annual.envVar`. Never from a browser. |
| `PUBLIC_BILLING_HARNESS_CONTROL` | Astro build | **build-time** | **set to `1` to expose the page** | Independent of the checkout control's flag. |
| `PUBLIC_CONVEX_URL` | Astro build | build-time | already present | |
| `PUBLIC_BILLING_DEV_CONTROL` | Astro build | build-time | **leave unset** | The *other* dev control. Neither flag enables the other. |

**Currently configured: none of the two harness flags, anywhere.** Not in the
shell, not in any repository `.env*` file.

### How deployment identity is actually established

```
deploymentNameFromUrl(CONVEX_CLOUD_URL)  ===  BILLING_TEST_HARNESS_DEPLOYMENT
```

`CONVEX_CLOUD_URL` is set by the platform, so it reports where the code is
really running. The pin is only the expectation. A production deployment cannot
pass by receiving a development-looking pin, because the parsed actual name
would not match. A malformed or missing URL yields `null` and rejects.

Missing variables mean **disabled**. That is the default with nothing set.

---

## 4. Ownership chain

**Stripe does not prevent writes to ordinary sandbox objects.** Nothing about a
plain sandbox Customer stops an API call from reaching it. The harness supplies
the protection, by retrieving every target and refusing what does not belong to
this fixture. Both existing subscribers report `test_clock: null` and therefore
fail the precondition — because of our check, not Stripe's.

```
Test Clock ─┬─ Customer     ── temporary PaymentMethod
            └─ Subscription ── renewal Invoice
```

- **Customer, Subscription** — verified by `assertClockOwned` through their own
  `test_clock`, plus matching id and `livemode: false`.
- **Invoice** — has no `test_clock`. Verified by `assertInvoiceOwned` through
  `parent.subscription_details.subscription` equalling the already-verified
  fixture Subscription, plus matching id, `livemode: false`, status `open`. That
  is the trusted **root** association, deliberately not the invoice line.
- **PaymentMethod** — has no `test_clock`. Verified by
  `assertPaymentMethodOwned` through attachment to the already-verified fixture
  Customer, plus matching id and `livemode: false`. A detached method reports
  `customer: null` and is refused.

**Fixture-stored ids say what to retrieve. They are never proof of ownership.**

### Per-command verification

| Command | Mutates | Verified immediately before, by |
|---|---|---|
| `provision` | clock, customer, subscription (all created) | clock create is the only write with no existing target; the created Customer and Subscription are each verified by `assertClockOwned` before being used |
| `arm_failure` | Customer | `assertClockOwned` (Customer **and** Subscription) |
| `advance_to_renewal` | Test Clock | `assertClockOwned` (Subscription, which reports that exact clock) |
| `restore_and_pay` | Customer, **Invoice**, **PaymentMethod** | `assertClockOwned` (Customer, Subscription), `assertInvoiceOwned`, `assertPaymentMethodOwned` |
| `cancel_fixture` | Subscription | `assertClockOwned` |
| `delete_clock` | Test Clock | clock re-read for matching id and `livemode: false` |

---

## 5. Idempotency

Thirteen Stripe mutation call sites, **thirteen distinct operation names**:

```
clock  customer  pm_attach_ok  pm_default_ok  subscription
pm_attach_fail  pm_default_fail  advance
pm_restore  invoice_pay  pm_detach  cancel  clock_delete
```

Keys are server-generated from a SHA-256 digest of the user id — never the raw
id, and never anything from the browser. A shared name would mean two different
requests using one key, which Stripe refuses; the suite asserts no two are
shared. An uncertain external result **stops** rather than retrying.

---

## 6. Retry policy and the over-advance rule

Verified in the Dashboard 2026-08-23, unchanged since:

| | |
|---|---|
| Retry mode | Smart Retries |
| Attempts / window | up to 8 retries within 2 weeks |
| First retry timing | **Dynamic — Stripe-selected** |
| Final subscription action | **Cancel the subscription** |
| Final invoice action | leave past-due |
| Failed-payment emails | disabled |
| Billing Automations | none active |

**`ADVANCE_MARGIN_SECONDS = 3600`**, enforced *before* the Stripe request:

```
retrieve Subscription -> read renewal boundary from Stripe
  -> target = boundary (or boundary + small step)
  -> REJECT if target > boundary + 3600
  -> persist target and in-flight phase
  -> advance once
```

The safety rule:

> Advance only to the first renewal attempt. Wait for `ready`. Require
> `attempt_count = 1`. Read `next_payment_attempt`. **Do not advance again.**
> Recover before anything else.

Stated plainly, because these are the ways it goes wrong:

- **The two-week window is not headroom.** Final action is *cancel*, so an
  over-advance destroys the fixture subscription and fires a terminal webhook
  mid-test.
- **A cancellation before recovery makes the test unrecoverable.** There is no
  path back; it needs a fresh clock and a fourth account.
- **The next retry time cannot be precomputed.** It is Stripe-selected.
  `next_payment_attempt` is *observed after* the failure, never asserted against
  a fixed time.
- **Never advance while unhealthy.**

---

## 7. Filtered audits

Stripe omits test-clock objects from broad list calls unless the request is
scoped to a `customer`, `subscription`, or `test_clock`.

**A broad `GET /v1/invoices` cannot prove the fixture is absent.** It returns
calmly having found nothing, which is the easiest possible way to produce a
confidently wrong verification. The harness builds fixture reads through a
helper that cannot produce an unscoped path.

Evidence the execution report must capture, each from the right kind of query:

| Subject | How to read it |
|---|---|
| Existing monthly subscriber | scoped to its own Customer |
| Existing annual subscriber | scoped to its own Customer |
| Disposable Customer / Subscription / Invoice / Clock | scoped to the fixture Customer, Subscription, or clock |
| Convex `subscriptions`, `billingCustomers`, `billingEvents` | snapshot export, hashed per table |
| Fixture phase | `fixtureStatus` |

Global Stripe counts alone are never sufficient.

---

## 8. Disposable account prerequisites

Before `provision`, the account must be:

- newly created and authenticated in the application;
- **Free** — `tier` is not `plus`;
- **no** `billingCustomers` mapping;
- **no** canonical `subscriptions` row;
- **no** existing harness fixture;
- never through Checkout;
- neither existing subscriber.

**Proving it without touching data:** sign in as the account and read
`getMyEntitlements` (Free) and `fixtureStatus` (`hasFixture: false`,
`phase: empty`). `provision` re-checks the mapping and canonical row server-side
and returns `already-has-billing` if either exists. **No manual Convex insert or
delete is required or permitted.**

The application account has an authentication email. **The Stripe Customer the
harness creates omits email entirely** — ownership comes from subscription
metadata, and omitting it removes the failure-notification question.

The account is **permanently one-time-use**: after cleanup the
`billingCustomers` row is intentionally retained, and `provision` refuses any
user that already has a mapping. A second run needs a fourth account.

---

## 9. Enablement sequence — for the authorized task, not this one

Do not run any of this now.

```
# 1. Development Convex variables (dashboard or CLI, dev deployment only)
#    BILLING_TEST_HARNESS_ENABLED=true
#    BILLING_TEST_HARNESS_DEPLOYMENT=good-dotterel-906

# 2. Deploy the harness functions to DEVELOPMENT only
npx convex deploy            # against good-dotterel-906

# 3. Local development web surface only
PUBLIC_BILLING_HARNESS_CONTROL=1 npm run dev
#    -> http://localhost:4321/dev/billing-harness

# 4. Verify production is untouched (see §10)
# 5. Create the disposable account, sign in as it
# 6. Run the six commands, one at a time, with a checkpoint between each
# 7. Disable: unset PUBLIC_BILLING_HARNESS_CONTROL, rebuild
# 8. Disable: unset BILLING_TEST_HARNESS_ENABLED on the dev deployment
```

**`npx convex codegen` is not a deployment command.** It prints
*"Uploading functions to Convex"* as part of type analysis, and its own `--help`
states it does not modify deployed code — confirmed empirically, since the
harness is absent from the deployed spec despite codegen having run. Never treat
that log line as evidence either way; the function spec is the authority.

**Build targets.** The route is `/dev/billing-harness`, a param on the existing
dynamic route `src/pages/dev/[control].astro`. Gate A (`getStaticPaths`) and
Gate B (client script) both require `import.meta.env.DEV && PUBLIC_BILLING_HARNESS_CONTROL === '1'`
with inline literals, so Vite folds it away. `DEV` is false in every
`astro build` — **the page cannot be produced by a Cloudflare Pages build even
if the public flag were set there.** No Pages rebuild should be performed for
this; local dev is the only intended surface.

**The Worker is not involved.** Zero worker files reference the harness. No
Worker deployment is required. The disposable subscription's webhooks arrive at
the same development endpoint the existing sandbox subscribers already use.

---

## 10. Production non-impact

Before and after execution:

- `dist/` is 14 pages, 66 HTML files, **no `dist/dev/`**;
- no production file contains `runCommand`, `billing-harness`, `testHarness`,
  `test_helpers`, `pm_card_chargeCustomerFail`, or any command string —
  asserted by the suite against a hostile build with the flag deliberately on;
- production Convex holds no harness function;
- `convex/http.ts`, `subscriptions.ts`, `subscriptionGuard.ts`,
  `entitlements.ts`, `plusPlans.ts` are byte-unchanged by the harness work.

---

## 11. Command table

| Command | From | In-flight | To | External writes | Must converge to |
|---|---|---|---|---|---|
| `provision` | `empty` | `provisioning` | `healthy` | clock, customer, PM attach, customer default, subscription | canonical `plus_annual` row + mapping, created **only** by genuine webhook |
| `arm_failure` | `healthy` | `failure_armed` | `failure_armed` | PM attach, customer default | subscription unchanged: `active`, `year × 1`, period end unchanged |
| `advance_to_renewal` | `failure_armed` | `renewal_advancing` | `past_due` | **one** clock advance | `attempt_count = 1`, invoice `open`, subscription `past_due`, `paymentNeedsAttention: true` |
| `restore_and_pay` | `past_due` | `recovering` | `recovered` | customer default restore, **one** invoice pay, PM detach | subscription `active`, `paymentNeedsAttention: false`, plan/cadence/period unchanged |
| `cancel_fixture` | `recovered` | `canceling` | `terminal` | subscription cancel | genuine `customer.subscription.deleted`, disposable account loses Plus |
| `delete_clock` | `terminal` | `terminal` | `clock_deleted` | clock delete | clock gone; Customer and Subscription deleted with it |

`restore_and_pay` accepts **only** `past_due` — it cannot un-arm a fixture.
`delete_clock` is refused from all ten other phases. In-flight phases refuse
re-entry, which is what stops a double-click becoming a second advance or a
second payment.

---

## 12. Operator checkpoints

Stop at each. Continue only when the harness reports the exact expected phase
**and** the application state matches.

| # | Checkpoint | Stop if |
|---|---|---|
| 1 | Harness deployed to development; absent from production | any harness function appears in production |
| 2 | Both flags set in development only | either flag reachable from a production build |
| 3 | Disposable account Free, no billing rows, no fixture | `already-has-billing`, or any existing row |
| 4 | `provision` → `healthy` | not `healthy`; canonical row missing; either existing subscriber changed |
| 5 | `arm_failure` → `failure_armed`, **no payment yet** | any invoice or charge appeared |
| 6 | `advance_to_renewal` → `past_due`, `attemptCount = 1` | `unexpected-attempt-count`; clock not `ready`; subscription not `past_due` |
| 7 | `/you` shows **NEEDS ATTENTION**, no renewal date, Manage billing present | renewal date shown; attention absent; any provider id visible |
| 8 | `/pricing` still "Your current plan", no duplicate Checkout | any enabled purchase control |
| 9 | `restore_and_pay` → `recovered`, attention cleared | still `past_due`; plan/cadence/period changed |
| 10 | Temporary method detached | detach returned not-ok |
| 11 | `cancel_fixture` → `terminal`, Plus lost | canonical row still `plus` |
| 12 | `delete_clock` → `clock_deleted` | attempted before `terminal` |
| 13 | Retained mapping recorded in the report | omitted |
| 14 | Both flags disabled; surface removed | either still enabled |
| 15 | Production confirmed untouched | any difference |

---

## 13. Emergency stop

**General rules, in order of importance:**

1. **Never blindly retry a Stripe mutation.** An uncertain result is a reason to
   look, not to repeat. The harness itself never auto-retries.
2. **Never advance the clock again while unhealthy.** Final action is cancel.
3. **Never manually edit a canonical subscription row.**
4. **Never widen the production invoice reader** to make something work.
5. **Never delete billing rows to "repair" the disposable account.** It is
   one-time-use by design; use a fresh account.
6. Preserve fixture state for investigation — do not clear the phase.
7. Distinguish a **safe read retry** from an **unsafe mutation repeat**. Reads
   are always safe.

| Situation | Do |
|---|---|
| Wrong deployment (`wrong-deployment`) | Stop. Nothing ran — the gate rejected before any Stripe call. |
| Wrong account (`already-has-billing`) | Stop. Use a genuinely new account. |
| Unexpected fixture phase | Stop. Do not force. Report the phase. |
| Clock not `ready` | Wait, re-read. Never re-issue the advance. |
| `attemptCount > 1` | **Stop.** The advance overshot; the core safety property was violated. Report, do not auto-recover. |
| `next_payment_attempt` missing | Record as observed-null. Not itself a failure. |
| Subscription cancelled before recovery | **Unrecoverable.** Stop, disable flags, report. Cleanup only. |
| `clock-not-owned` on invoice or PM | Stop. A fixture id no longer matches a live relationship — investigate before anything else. |
| Invoice pay returns unknown | Stop. **Do not pay again** — the idempotency key means a repeat returns the cached result, but an unknown state needs eyes first. |
| Webhook convergence timeout (`not-converged`) | Re-read status. Do not re-issue the command. |
| Still `past_due` after payment | Stop. Report a payment-recovery reader defect. Do not edit Convex. |
| Cancellation webhook timeout | Wait and re-read. **Do not delete the clock** — deleting it removes the Customer and Subscription and would strand Convex. |
| Clock deletion failure | Stop. Leave the clock; report. |
| Unexpected provider object | Stop. |
| Production route exposure | Immediately unset `PUBLIC_BILLING_HARNESS_CONTROL`, rebuild, verify `dist/dev/` absent. |

**To stop execution at any point:** unset `PUBLIC_BILLING_HARNESS_CONTROL` and
rebuild (removes the surface), then unset `BILLING_TEST_HARNESS_ENABLED` on the
development deployment (removes the server capability). Either alone is
sufficient; both is correct.

---

## 14. Cleanup and the retained mapping

Order is load-bearing. Deleting a Test Clock deletes its Customer and
subscriptions, so:

```
recovered -> cancel disposable subscription
          -> wait for genuine customer.subscription.deleted
          -> confirm the disposable account lost Plus
          -> ONLY THEN delete the Test Clock
```

Deleting the clock first would leave Convex holding a canonical row and a
mapping pointing at objects that no longer exist, with the account still
showing Plus.

**The disposable `billingCustomers` row is intentionally retained.** After the
clock Customer is deleted it is inert — nothing reads it but
`createPortalSession` and `createCheckoutSession`, both reachable only by that
one account. No general-purpose billing-row deletion capability was added, and
there is no seventh command: that is a production-shaped capability, and
reclaiming a disposable test account is a poor reason to build one.

**The execution report must state this residue explicitly** rather than
presenting cleanup as total.

**This disposable cancellation is not the monthly terminal-cancellation TODO.**
That item stays open and date-dependent regardless of what this fixture proves.

---

## 15. Evidence the execution report must capture

- Every command's returned `phase`, `attemptCount`, `lastError`.
- Convex table hashes before, at `past_due`, and after recovery.
- `billingEvents` deltas as **ranges**, not fixed counts — subscribed event sets
  and ordering are not guaranteed.
- Both existing subscribers proven unchanged by **scoped** queries.
- The observed `next_payment_attempt`, recorded not asserted.
- `/you` and `/pricing` states at checkpoints 7 and 8.
- The retained mapping.
- Confirmation both flags were disabled afterwards.
- No provider identifier, QA email, card value, or hosted Stripe URL anywhere.

---

## 15b. Provisioning convergence and adoption

Added 2026-08-23 after two provisioning stops. Neither reached `arm_failure`;
no clock advanced and no payment was attempted. Record:
`billing-test-harness-provisioning-convergence-stop-2026-08-23.md`.

- Normal provisioning now **polls boundedly** for webhook convergence, and
  requires the canonical row to *be* the created subscription plus a customer
  mapping — not merely that the account is Plus.
- Each provider identifier is **persisted before the next external write**, so
  a late failure can never leave a fixture that knows the clock but not what is
  on it.
- A **read-only adoption path** recovers exactly that state through the same
  `provision` command. No seventh command; no Stripe write; scoped discovery
  only. A fixture with no clock id stays unrecoverable.

## 16. What the next task must authorize explicitly

1. Setting `BILLING_TEST_HARNESS_ENABLED=true` and
   `BILLING_TEST_HARNESS_DEPLOYMENT=good-dotterel-906` on `good-dotterel-906`.
2. Deploying the harness functions to that development deployment.
3. Setting `PUBLIC_BILLING_HARNESS_CONTROL=1` for a **local** dev server only.
4. Creating one disposable QA application account.
5. Running the six commands in order, with checkpoints.
6. Creating exactly: one Test Clock, one Customer, one Subscription, two
   PaymentMethods, one paid renewal Invoice — and one failed payment attempt.
7. Deleting the Test Clock after terminal convergence.
8. Disabling both flags afterwards.

Until a task grants those explicitly, the harness stays off.
