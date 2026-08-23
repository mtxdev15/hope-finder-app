# Billing test harness — implementation brief

**Status:** design locked, not built. No Stripe object exists for this yet.
**Audited at:** `646a6a5`, against Convex development `good-dotterel-906`.
**Prerequisite audit:** `docs/operations/stage-2-sandbox-billing.md` §6.20 and the
read-only feasibility audit of 2026-08-23.

This brief describes a development-only Convex harness that provisions a
throwaway Stripe subscription on a Test Clock, drives it through exactly one
failed renewal, recovers it, and cleans it up. Its purpose is to exercise the
`past_due` → attention → recovery path with **real** Stripe events, because that
path is the last unverified piece of sandbox billing.

Nothing here runs against the existing monthly or annual subscriber. Ever.

---

## 1. The one fact that shapes everything

The sandbox's recovery policy was read from the Dashboard on 2026-08-23:

| Setting | Value |
|---|---|
| Retry mode | **Smart Retries** |
| Retry attempts / window | Up to **8 retries within 2 weeks** |
| First retry timing | **Dynamic — selected by Stripe** |
| Final action | **Cancel the subscription** |
| Final invoice action | Leave the invoice past-due |
| Failed-payment emails | **Disabled** |
| Billing Automations | **None active** |

**Final action is cancel.** So an over-advanced clock does not merely retry — it
destroys the fixture subscription and fires a real `customer.subscription.deleted`
that the webhook handler will apply. The disposable account would go terminal
mid-test, and the recovery step would have nothing left to recover.

**First retry timing is dynamic**, so it cannot be predicted or hard-coded. It
must be *read* from `next_payment_attempt` after the failure, never assumed.

Together these produce the single most important rule in this document:

> **Advance the clock only far enough to produce the first failed attempt. Never
> advance again until the invoice is paid and the subscription is `active`.**

Two weeks of simulated time is the distance between a working fixture and a
destroyed one. The harness must make it structurally difficult to cross that
distance by accident, not merely discouraged by a comment.

---

## 2. Why a harness is needed at all

The ownership contract already works — that was the audit's main finding, and it
is worth restating because it means the harness needs **no** new trust:

- `classifyPlusSubscription` takes `session` as **optional**
  (`convex/plusPlans.ts:134`). The `client_reference_id` cross-check is guarded
  by `if (session && …)`, so it is skipped for `customer.subscription.*` and
  `invoice.*` events, which carry no session.
- Identity lives on `subscription.metadata.userId`, read by `stampedUserId`
  (`convex/plusPlans.ts:194`) only *after* classification passes.
- `applyWebhook` resolves an unmapped user through its third fallback,
  `if (!userId && args.metadataUserId)` (`convex/subscriptions.ts:266`), then
  **creates the `billingCustomers` mapping itself** (`:337`) and **inserts the
  canonical `subscriptions` row** (`:394`).
- The duplicate guard returns `{ok: true}` immediately when no row exists
  (`convex/subscriptionGuard.ts:121`).

So a directly-created Customer and Subscription carrying the five provenance
fields binds to an app user through exactly the same trusted path a real
Checkout uses. **No manual Convex insert. No weakened check. No widened reader.**

What is missing is only *tooling*. The `stripe-sandbox` MCP exposes no operation
to create or advance a Test Clock, attach or detach a PaymentMethod, or create,
finalize, or pay an Invoice. The harness exists to make those calls server-side
with the pinned Stripe client the rest of the billing code already uses.

---

## 3. Gates

Four independent gates. All must pass on every operation, re-checked per call
rather than once at module load.

```
BILLING_TEST_HARNESS_ENABLED === "true"
BILLING_TEST_HARNESS_DEPLOYMENT === "good-dotterel-906"   // must equal this deployment
environmentForSecret(STRIPE_SECRET_KEY) === "sandbox"      // rk_test_ only
authenticated user present                                 // authComponent.safeGetAuthUser
```

Plus two caller preconditions, checked before the first Stripe write:

```
no billingCustomers row for this user
no canonical subscriptions row for this user
```

`BILLING_TEST_HARNESS_DEPLOYMENT` pinning the deployment name is deliberate. A
boolean flag copied into production environment variables is a single typo away
from being live; a flag that must *also* name a specific dev deployment is not.

### The structural guard that matters most

Every Stripe write the harness performs must target an object whose
**`test_clock` is non-null**, verified by reading the object back before acting
on it.

Both existing subscribers have `test_clock: null` — verified 2026-08-23. That
makes the guard a real structural boundary rather than a naming convention: an
operation cannot touch a real subscriber even if the fixture record were
corrupted, because a real subscriber can never satisfy the precondition.

**Stated without any ambiguity, because the distinction matters:** Stripe does
not prevent writes to ordinary sandbox objects. Nothing about a plain sandbox
Customer stops an API call from reaching it. The harness enforces this boundary
itself, by retrieving every target and rejecting any whose `test_clock` is null
or does not match the authenticated fixture. Stripe supplies the fact; the
refusing is ours. Anyone who later reads this as a Stripe permission boundary
would conclude the check is redundant and be wrong.

Assert this in a shared helper (`assertClockOwned`) called at the top of every
mutating operation. Do not inline it per call site.

---

## 4. The command surface

The browser sends a command string and nothing else:

```
provision | arm_failure | advance_to_renewal | restore_and_pay
cancel_fixture | delete_clock | status
```

The action's arg validator must be exactly `{ command: v.string() }`. There is no
field in which a provider identifier could arrive, which is the same property
that makes `createCheckoutSession` safe — the browser cannot send what the
schema has no room for.

**Never accepted from the browser:** Customer ID, Subscription ID, Test Clock ID,
PaymentMethod ID, Invoice ID, Price ID, application user ID.

**Never returned to the browser:** any of the above. The harness returns only
`{ phase, ok, error?, summary? }`, where `summary` is a provider-neutral
projection in the style of `src/app/declare/billing-inspector.js` — reuse
`INSPECTOR_FIELDS`/`FORBIDDEN_FIELDS` rather than writing a second allowlist.

---

## 5. The fixture record

One new development-only table, `billingTestFixtures`:

| Field | Type | Notes |
|---|---|---|
| `userId` | string | the disposable QA user; unique index |
| `phase` | string | see the state machine |
| `environment` | string | must be `"sandbox"` |
| `testClockId` | optional string | set by `provision` |
| `stripeCustomerId` | optional string | set by `provision` |
| `stripeSubscriptionId` | optional string | set by `provision` |
| `originalPaymentMethodId` | optional string | the working method — captured **before** arming |
| `failingPaymentMethodId` | optional string | detached during recovery |
| `renewalInvoiceId` | optional string | the invoice that failed |
| `frozenTime` | optional number | last known clock time, seconds |
| `renewalAt` | optional number | the advance target, seconds |
| `createdAt` / `updatedAt` | number | |

This table is the only place provider identifiers live. It must be excluded from
any export or fixture-count assertion that claims "billing tables byte-identical",
and the existing verification suites must be updated to name it explicitly rather
than silently ignoring it.

`originalPaymentMethodId` and the subscription-level default are captured **at
provision time**, not at recovery time. Capturing recovery state before the thing
that breaks it is the whole point; capturing it afterwards would record whatever
the failure left behind.

---

## 6. State machine

```
empty → provisioning → healthy → failure_armed → renewal_advancing
      → past_due → recovering → recovered → canceling → terminal → clock_deleted
```

Rules:

- Every operation declares the exact phase(s) it accepts and **rejects anything
  else with `wrong-phase`**. No operation infers, repairs, or resumes.
- A failed operation leaves the phase where it was and returns an error. It never
  advances the phase optimistically.
- `provisioning`, `renewal_advancing`, `recovering` and `canceling` are
  *in-flight* phases. Re-entering the same command while in one returns
  `already-running` rather than starting a second attempt. This is what prevents
  a second payment attempt or a second clock advance from a double-click.

| Command | Accepts | Produces |
|---|---|---|
| `provision` | `empty` | `provisioning` → `healthy` |
| `arm_failure` | `healthy` | `failure_armed` |
| `advance_to_renewal` | `failure_armed` | `renewal_advancing` → `past_due` |
| `restore_and_pay` | `past_due` | `recovering` → `recovered` |
| `cancel_fixture` | `recovered` | `canceling` → `terminal` |
| `delete_clock` | `terminal` | `clock_deleted` |
| `status` | any | unchanged |

Note `restore_and_pay` accepts **only** `past_due`. It cannot be used to "fix"
a `failure_armed` fixture — un-arming without a failure is a different operation
and is deliberately not offered.

---

## 7. Operations

### 7.1 `provision`

The first Stripe write in the entire test is Test Clock creation, and it doubles
as the `subscription_write` scope probe. Do not probe the restricted key against
either existing subscriber.

1. `POST /v1/test_helpers/test_clocks` with `frozen_time` = a **runtime-captured**
   current timestamp.
   - Permission denied → stop. Nothing exists. Report the scope gap.
   - Unknown/ambiguous result → stop and inspect. **Do not retry** — a retry
     without an idempotency key could create a second clock.
   - Created → write `testClockId` to the fixture **before** the next call.
2. `POST /v1/customers` with `test_clock` = that clock, `metadata[userId]`,
   `metadata[environment]=sandbox`, and **no `email`**.
   Emails are disabled at the account level, but omitting the address removes the
   question entirely and costs nothing: ownership comes from subscription
   metadata, and nothing in classification, `applyWebhook`, or entitlements reads
   Customer email.
3. Attach a working sandbox card and set
   `invoice_settings.default_payment_method`. Record it as
   `originalPaymentMethodId`.
4. `POST /v1/subscriptions`:
   - `customer` = the fixture Customer
   - `items[0][price]` = the annual Plus Price from
     `process.env.STRIPE_PLUS_ANNUAL_PRICE_ID` — read server-side, never passed in
   - `billing_mode[type]=flexible` to match production shape
   - `collection_method=charge_automatically`
   - **all five provenance fields** on `metadata`: `userId`, `plan=plus_annual`,
     `source` = `CHECKOUT_SOURCE`, `billing_schema_version` =
     `BILLING_SCHEMA_VERSION`, `environment=sandbox`
   - no trial, no proration, no billing-cycle anchor, quantity 1
5. Wait for genuine webhooks. Poll `getMyEntitlements` for the disposable user
   until `tier=plus`, or time out.

**Idempotency keys** on every create, derived from `userId` (`hz:clock:<userId>`,
`hz:cust:<userId>`, `hz:sub:<userId>`), following the `cust:`/`co:` convention in
`convex/billing.ts`. A retried action must never produce a second object.

**Post-gate:** exactly one new Customer, one canonical `plus_annual` row,
`status=active`, `paymentNeedsAttention=false`, and the two existing subscribers
byte-identical.

**Expected events — a set, not a sequence.** `customer.subscription.created`,
`customer.subscription.updated` and `invoice.paid` may all fire, in any order.
Each subscribed type writes one `billingEvents` row. Express the expected delta
as a **range (+2 to +4)**, never a fixed number. `http.ts` calls `applyWebhook`
once for every subscribed type, so ordering is already handled — `invoice.paid`
arriving before `customer.subscription.created` resolves identically.

### 7.2 `arm_failure`

1. Confirm `originalPaymentMethodId` is still attached and still the Customer
   default. If not, stop — the fixture is not in the state recovery assumes.
2. Attach `pm_card_chargeCustomerFail`. Record as `failingPaymentMethodId`.
3. Set **only** `customer.invoice_settings.default_payment_method` to it.
4. Leave `subscription.default_payment_method` `null`. (§6.18 established that
   the subscription-level override outranks the Customer default; leaving it null
   is what makes the Customer default the effective method.)
5. Read back and require: subscription still `active`, `year × 1`, `cancel_at`
   null, period end unchanged, and the working method **still attached**.

Any unrelated field change → break-glass restore immediately, do not advance.

### 7.3 `advance_to_renewal` — the dangerous one

Read `renewalAt` from `subscription.items.data[0].current_period_end`. Never
compute it, never trust a stored copy without re-reading.

Hard ceiling: **`renewalAt + ADVANCE_MARGIN_SECONDS`**, where the margin is small
(start at 3600) and defined as a named constant. Reject any computed target above
the ceiling before issuing the call. With Smart Retries first-attempt timing
dynamic and cancellation at two weeks, the margin is the safety budget — keep it
minutes-to-hours, never days.

1. Advance to exactly `renewalAt`. Poll the clock until `status === "ready"`
   (Stripe holds `advancing` until every affected object reaches the frozen time).
2. Read the subscription and its latest invoice.
3. If no renewal invoice exists yet, advance in **small increments** (the margin
   constant, once), re-polling to `ready`, and stop the instant `attempt_count`
   reaches 1.
4. Respect the documented rate limit — 10 new invoices per subscription per
   minute — by pausing between reads rather than tight-polling.

**Required after:**

```
attempt_count            = 1
subscription.status      = past_due
invoice.status           = open
invoice.amount_remaining = the annual renewal amount
paymentNeedsAttention    = true
```

and `next_payment_attempt` is **either** later than the clock's frozen time **or**
`null`. Record the observed value; do not assert a specific time, because the
first retry is Stripe-selected.

If `attempt_count > 1` → stop. Do not recover automatically, do not advance
again. Report it: more than one attempt means the advance overshot, and the
sequence's core safety property was violated.

### 7.4 `restore_and_pay`

1. Restore `customer.invoice_settings.default_payment_method` to the **exact**
   `originalPaymentMethodId`. Leave `subscription.default_payment_method` at its
   original value.
2. Read both objects back and prove precedence resolves to the working method.
   **Do not attempt payment until this passes.**
3. `POST /v1/invoices/{invoice}/pay` on `renewalInvoiceId` — **exactly once**,
   with an idempotency key.
4. **Do not advance the clock during recovery.**
5. Wait for genuine `invoice.paid`; accept an accompanying
   `customer.subscription.updated`.
6. Require `status=active`, `paymentNeedsAttention=false`, plan/cadence/period
   unchanged.
7. Detach **only** `failingPaymentMethodId`.

**Break-glass** (payment call fails or is uncertain): restore the exact original
defaults, make **no** second payment attempt, leave invoice and clock intact,
stop and report. Never improvise with a different PaymentMethod or a new invoice.

### 7.5 `cancel_fixture` then `delete_clock` — order is load-bearing

Stripe: *"When the test clock is deleted, the customer and all subscriptions are
also deleted."* Deleting the clock first would remove the Customer and
Subscription **without** necessarily emitting lifecycle events, leaving Convex
holding a canonical row and a customer mapping that point at objects which no
longer exist, and a disposable account still showing Plus.

So:

1. `cancel_fixture` — cancel only the fixture subscription. Wait for a genuine
   `customer.subscription.deleted`. Verify the handler applied it and the
   disposable account no longer has Plus.
2. Only then `delete_clock`.
3. After deletion, verify no unexpected webhook arrived and neither existing
   subscriber changed.

**Known residue:** the `billingCustomers` row for the disposable user will remain,
pointing at a deleted Customer. It is inert for an account never used again, but
it is real and must be recorded in the verification write-up rather than
discovered later. Decide before execution whether to leave it, and say why.

**This cancellation is not the monthly terminal-cancellation TODO.** That item
stays open and date-dependent regardless of what this fixture proves.

---

## 8. Expected application state, derived from source

**Failed** — `entitlements.ts:103-111` and `subscriptions.ts:39`:

```
tier=plus  planKey=plus_annual  subscriptionStatus=past_due
billingInterval=year  cancelAtPeriodEnd=false  paymentNeedsAttention=true
```

Plus access **survives** the grace window. `PLUS_STATUSES` includes `past_due`.

**`/you`** renders `plus-attention`; attention outranks active by explicit design
(`plan-display.js:73`). Badge copy is exactly **`NEEDS ATTENTION`**
(`you.astro:1437`). **No renewal date is shown** — `periodLabelKey` returns `null`
for attention. Manage billing stays available.

**`/pricing`** keeps Plus as current plan; `mayStartCheckout` is true only for
`free`/`guest` (`plan-display.js:91`), so no duplicate Checkout.

**Recovered:** attention `false`, status `active`, everything else unchanged.

---

## 9. Test-clock behaviours the execution task must respect

- **Advance limit is two intervals from frozen time.** For an annual
  subscription that is two years, so one renewal is reachable in a single
  advance. Annual is viable.
- **List calls omit test-clock objects** unless filtered by `customer`,
  `subscription`, or `test_clock`. Every before/after audit must query **by
  customer**, or it will read "unchanged" while missing the fixture entirely.
  This is the single easiest way to produce a confidently wrong verification.
- Creating the Customer **directly on the clock** avoids the Automations
  restriction that applies to attaching a clock to an existing customer. (No
  automations are active, but this keeps it true regardless.)
- Rate limits: 10 new invoices per subscription per minute, 20 per day.

---

## 10. Test suite

New `scripts/verify-billing-test-harness.ts`, following the house idiom —
dependency-free imports, `check(name, ok)`, `PASSED — n/n`, `process.exit(1)`,
runnable under plain `node` with no deployment or credential.

Must prove, by importing and **executing** the real state-machine module rather
than grepping for it:

1. Every gate is checked per operation, not once at module load.
2. Every phase transition is legal; every illegal one is rejected.
3. In-flight phases reject re-entry.
4. The arg validator contains exactly `command` — no field can carry a provider
   identifier.
5. The returned summary contains none of `FORBIDDEN_FIELDS`.
6. `assertClockOwned` is called by every mutating operation. Assert on the
   **parsed call graph or an exported manifest**, not on a comment — the
   comment-matching trap has bitten this repo four times.
7. The advance ceiling rejects any target above `renewalAt + margin`.
8. `restore_and_pay` accepts only `past_due`.
9. `delete_clock` accepts only `terminal`.
10. Production build output contains no harness route, symbol, or command string
    — run against a **hostile build** with the public flag deliberately on, the
    pattern already proven by `verify-billing-dev-control.ts`.

Existing suites must stay green and unchanged: 34, 66, 99, 376, 152, 141, 71,
122, 74.

---

## 11. Scope

**In:** the Convex harness action, the fixture table and its schema entry, the
state machine as a dependency-free module, a dev-only page behind the existing
`import.meta.env.DEV && PUBLIC_*` pattern, and the new suite.

**Out, explicitly:**

- Any change to `readInvoiceSubscriptionId`. The narrow reader stays narrow.
  Widening it to suit a test instrument would trade a correctness and
  data-integrity boundary for convenience — see §6.20.
- Any change to `applyWebhook`, `classifyPlusSubscription`, `entitlements.ts`,
  or the duplicate guard. The audit proved none is needed.
- Any change to Portal or Checkout code paths.
- Creating the third QA account, or any Stripe object. That is execution.

---

## 12. Sequence

1. Merge this brief.
2. Build the harness. Merge behind the gates. **Run nothing.**
3. Create the third disposable QA account.
4. Execute, one command at a time, verifying between each.
5. Document, close the payment-failure TODO, PR.

Steps 3–5 need their own brief, written once the harness exists and its exact
return shapes are known.

---

## 13. Implementation record — merged behind gates, never run

Implemented on branch `feature/billing-test-clock-harness` against
`df46496`. **The harness has never been executed.** No Test Clock, Customer,
Subscription, PaymentMethod, Invoice, Portal Session, Checkout Session or
webhook exists from this work, no deployment was made, and no environment value
was set or changed. Both harness flags are unset, so the code is inert.

### Files

| File | Role |
|---|---|
| `convex/testHarnessState.ts` | **new** — every decision, with no network in it. Dependency-free so `node` executes the real logic. |
| `convex/testHarness.ts` | **new** — gated action, status query, Stripe operations, `assertClockOwned`, `assertInvoiceOwned`, `assertPaymentMethodOwned`. |
| `convex/schema.ts` | `billingTestFixtures` table, indexed `by_user`, phase as a closed union. |
| `convex/stripeApi.ts` | `stripeDelete` added; `request` accepts `DELETE`. Same pinned version header. |
| `src/pages/dev/[control].astro` | `/dev/billing-harness` added to the existing dynamic route, behind its own independent flag. |
| `scripts/verify-billing-test-harness.ts` | **new** — 290 checks. |
| `convex/_generated/api.d.ts` | codegen only: two type imports, zero behaviour. |

### Public surface

- `testHarness.runCommand` — args are exactly `{ command: v.string() }`. Six
  values accepted; everything else is `unknown-command`.
- `testHarness.fixtureStatus` — a query with **no arguments at all**.

Both return only the allowlisted projection: `phase`, `allowed`, `inFlight`,
`attemptCount`, `hasFixture`, `lastError`. The projection is built by
construction from an allowlist rather than by deleting fields, so a column added
to the fixture table later cannot leak by being forgotten.

### The deployment gate, concretely

`BILLING_TEST_HARNESS_DEPLOYMENT` is only the **expected** value; on its own it
proves nothing, because a variable that says "dev" can be set anywhere. The
**actual** deployment is parsed from `CONVEX_CLOUD_URL` / `CONVEX_SITE_URL`,
which Convex sets itself — the same platform-provided value `convex/auth.ts`
already relies on. The gate compares the two and refuses any mismatch.

`BILLING_TEST_HARNESS_ENABLED` must equal the exact string `true`. `"1"`,
`"yes"`, `"TRUE"` and a boolean `true` are all refused, and all of those are
asserted. A flag that accepts anything truthy is a flag that turns itself on.

### One deliberate tightening of this brief

§7.1 sketched idempotency keys as `hz:clock:<userId>`. They are instead derived
from a **SHA-256 digest** of the user id, so no application identifier is sent
to Stripe. The keys remain stable per fixture and distinct per operation, which
is the property that mattered. This is a tightening, not a relaxation, and the
suite asserts that no raw user id or email appears in key derivation.

### Verification

**290 checks**, all executing real logic or parsing stripped source — comments
are removed before any structural assertion, because this repository has been
bitten four times by tests that matched the prose describing a banned pattern.

The suite was **mutation-tested against eighteen deliberate regressions**, each
applied, run, and reverted byte-identically. **All eighteen are caught.**

Four of them initially passed. Every one was a real weakness, and the pattern
across them is worth naming: each was a test that asserted something *adjacent
to* the property rather than the property itself.

The first two were found before the implementation PR was opened:

1. *`assertClockOwned` removed from one object in `arm_failure`* — the check
   only required the call to appear **somewhere** in the function, so an
   operation that verified the Subscription while writing to an unverified
   Customer still passed. Now every object an operation mutates must be the
   object it verified.
2. *the advance-ceiling guard deleted outright* — the ordering check used
   `indexOf(a) < indexOf(b)`, and `indexOf` returns `-1` for a missing needle.
   A **deleted** guard therefore read as correctly ordered. All nine ordering
   assertions now require both strings to exist.

Both fixes were made to the tests, not the implementation.

The other two were found during review of PR #37, and the first of them exposed
a genuine implementation defect rather than only a test weakness:

3. *The per-object ownership check derived only `mutatesCustomer` and
   `mutatesSubscription`.* That is why the Invoice and PaymentMethod gaps
   described below passed 266/266 while being genuinely unprotected. It now
   covers every object each operation mutates.
4. *Asserting that `idempotencyKey()` returns different values for different
   operation names proved nothing about the call sites.* Reverting one call site
   to another operation's name survived. The suite now requires that no two
   Stripe requests share an operation name.

### Recovery-target ownership — the PR #37 correction

`assertClockOwned` verifies an object through its own `test_clock`. An Invoice
and a PaymentMethod carry no `test_clock`, so it cannot speak for them, and the
first implementation mutated both **straight from the fixture record** without
retrieving them.

That was wrong for the reason the whole guard exists: the fixture is our own
writing, and a wrong stored id must not be able to authorise a write. The
invoice pay is the **only money-moving call in the harness**, which made it
exactly the wrong place to make an exception.

Both are now verified through the object that *is* clock-verified:

```
clock -> subscription (verified) -> invoice        (verified against it)
clock -> customer     (verified) -> paymentMethod  (verified against it)
```

**`assertInvoiceOwned`** retrieves the invoice immediately before `/pay` and
requires `livemode: false`, a matching id, status `open`, and
`parent.subscription_details.subscription` equal to the fixture's verified
subscription. That is the same trusted root association `convex/http.ts` reads,
and deliberately **not** the invoice line — which is not a subscription-health
signal and which the production reader refuses to consult. An already-paid,
unrelated, live-mode, wrong-subscription or missing invoice is rejected.

**`assertPaymentMethodOwned`** retrieves the method immediately before
`/detach` and requires `livemode: false`, a matching id, and that it is still
attached to the fixture's verified Customer. A detached method reports
`customer: null` and is refused.

A third defect surfaced while fixing the second. The detach reused the
customer-restore idempotency key, so **two different requests shared one
value**. Stripe refuses a key replayed with different parameters, and the detach
result was discarded — so the detach would have failed silently. It now uses a
dedicated **`pm_detach`** operation and **its response is checked**.

There are **13 Stripe mutation call sites and 13 distinct idempotency operation
names**: `clock`, `customer`, `pm_attach_ok`, `pm_default_ok`, `subscription`,
`pm_attach_fail`, `pm_default_fail`, `advance`, `pm_restore`, `invoice_pay`,
`pm_detach`, `cancel`, `clock_delete`. The suite asserts that no two share a
name, because a shared key means the second request simply fails.

Six of the eighteen mutations target this correction specifically: removing the
invoice validation, moving it after the pay call, accepting a foreign
subscription, removing the payment-method validation, accepting a foreign
customer, and reverting the detach to the shared key. All six are caught, and
every mutated file was restored byte-identically.

### Residual mapping policy — decided, not discovered

**The disposable `billingCustomers` row is intentionally left in place.**

Deleting a Test Clock deletes its Customer and subscriptions, so after cleanup
that row points at a Customer which no longer exists. It is inert: nothing reads
it except `createPortalSession` and `createCheckoutSession`, and both are
reachable only by that one disposable account.

The consequences, accepted deliberately:

- **The disposable QA account is permanently one-time-use.** `provision`
  refuses any user that already has a mapping, so the fixture cannot be rebuilt
  on the same account. A second run needs a fourth account.
- **No general-purpose cleanup mutation was added.** A "delete this account's
  billing rows" command is a production-shaped capability, and adding one to
  reclaim a disposable test account would be a poor trade. There is no seventh
  browser command.
- **The execution record must report the residue explicitly** rather than
  presenting the cleanup as total.

### Still required before anything runs

A separate execution-readiness audit against the compiled harness, then explicit
authorization to set the flags and create the disposable account. Neither flag
should be set until then. `payment-failure / payment-attention` remains open.
