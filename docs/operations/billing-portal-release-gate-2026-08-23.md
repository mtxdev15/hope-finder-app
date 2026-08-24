# Hosted Billing Portal — release gate record

**Date:** 2026-08-23 / 2026-08-24 UTC
**Environment:** Stripe development sandbox only. Convex development `good-dotterel-906` only.
**Result:** the Portal release gate is **closed**. Recovery, cancellation
scheduling and cancellation reversal were all exercised through the hosted
Billing Portal a real subscriber would see, on a disposable Test Clock fixture,
and the fixture was cleaned up to completion.

**Source commits**

| Point | Commit |
|---|---|
| Gate started at | `0804e47884602a33cd62c92037f617e81cb3fb4c` |
| Recovery-resume fix merged (PR #47) | `7df8a3d4b92c3100a3da8c619562a3ad001ff904` |

**Scope and authorization.** Sandbox only. No live-mode object was created,
read-write, or configured. Production Convex was never deployed to and never
held a harness function or a harness variable at any point. Neither existing
sandbox subscriber was written. One disposable application account, one Test
Clock, one Customer, one Subscription; the clock was advanced exactly once and
the renewal invoice was paid exactly once.

No account identity, provider identifier, hosted URL, card value or secret
appears in this record.

---

## 1. The authenticated disabled gate, observed live

This was the one claim the previous milestone could not make. It can be made now.

With the deployment pin set, **`BILLING_TEST_HARNESS_ENABLED` deliberately
absent**, an authenticated session, and no fixture in existence, `provision` was
submitted exactly once through the development harness page.

The server returned **`harness-disabled`** — the merged refusal from
`checkGates`, reaching the browser through the allowlisted error projection.

**Nothing was written.** Verified on both sides rather than assumed:

- `billingTestFixtures` unchanged at 2 rows, **byte-identical** to the
  pre-click capture — no fixture row was created
- `subscriptions`, `billingCustomers` and `billingEvents` all unchanged
- Stripe still held exactly two Customers and two Subscriptions, none
  clock-bound — no Test Clock, Customer, Subscription, PaymentMethod or Invoice
  came into existence
- the account remained Free; `hasFixture` stayed `false`

This is consistent with the code: `runCommand` calls `gate()` before it reads
the fixture, before it touches the Stripe secret, and before any network call.

**One correction to how the gate was described.** `checkGates` evaluates
`authenticated → enabled → deployment → sandbox` **in that order**, so with the
enable flag absent it returns `harness-disabled` *before* the deployment
comparison runs. The deployment check did not execute during this observation.
That ordering is the safer one — the cheapest refusal first — and it is what
was observed, so it is what is recorded.

`fixtureStatus` is deliberately **not** flag-gated, which is why the page still
rendered a status and why `provision` still appeared clickable. That is correct
and it is what made this observation possible: the button being enabled proves
nothing, and the server refusing it proves everything.

---

## 2. Disposable account prerequisites

A new application account was created by the owner in a controlled browser. Its
identity is not recorded here and was never requested.

Before any command ran: authenticated, **Free** tier, no `billingCustomers`
mapping, no canonical subscription, `hasFixture: false`, `inFlight: false`,
`lastError: null`, and `provision` the only admitted command.

That it was genuinely a new account is provable without naming it. Every
previously used account has at least one row in `subscriptions`,
`billingCustomers` or `billingTestFixtures` — including the earlier disposable
account, whose fixture row sits at `clock_deleted`. `fixtureStatus` queries by
the authenticated caller's own id and returned `hasFixture: false`, and `/you`
reported Free. No prior account can satisfy both.

---

## 3. The lifecycle

| Step | Command | Phase reached | Evidence |
|---|---|---|---|
| 1 | `provision` | `healthy` | Customer and Subscription created on the clock; initial invoice paid; mapping and canonical row created by **genuine webhooks** — exactly `invoice.paid` then `customer.subscription.created`, one new row per table |
| 2 | `arm_failure` | `failure_armed` | Customer default swapped to the declining alias. Still exactly one invoice, no payment attempted, no clock movement |
| 3 | `advance_to_renewal` | `past_due` | One advance. Renewal invoice finalized at **exactly `renewalAt + 3600`**, `attempt_count: 1`, `next_payment_attempt` observed |
| 4 | hosted **Portal** | — | payment method updated and the open renewal invoice paid, through the hosted flow |
| 5 | `restore_and_pay` | `not-converged` → **stop** | refused at a stale precondition; see §6 |
| 6 | hosted **Portal** | — | cancellation scheduled, then reversed |
| 7 | `restore_and_pay` (resumed, after the fix) | `recovered` | invoice observed already paid; **zero** pay requests issued; failing method detached |
| 8 | `cancel_fixture` | `terminal` | genuine `customer.subscription.deleted`; account lost Plus |
| 9 | `delete_clock` | `clock_deleted` | clock removed, taking its Customer and Subscription with it; `allowed: []` |

The clock was advanced **once**. One payment attempt failed. One payment
succeeded, and it came from the hosted Portal.

---

## 4. Past-due application behaviour

Observed on `/you` while the subscription was `past_due`:

> Declare Plus · Annual plan · **NEEDS ATTENTION**
> Something about your payment needs a second look. You still have access while
> we sort it out.
> Manage billing

- The attention badge rendered in the dedicated attention treatment, **not**
  the gold used for a healthy plan, and not the muted tone used for a scheduled
  ending. Three plan states, three visually distinct badges.
- **No renewal date was shown.** The app does not promise a renewal it cannot
  confirm.
- Plus features remained listed and available.
- Exactly one **Manage billing** control was present.
- Zero Stripe identifiers appeared in the rendered text.

On `/pricing`: Plus still marked **CURRENT PLAN**, the only call to action still
the disabled "Opening soon" button, no duplicate Checkout, no provider detail.

> **Correction to the previous record.** The 2026-08-23 payment-failure record
> reported the attention badge colour as `rgb(34, 56, 46)`. That reading was
> taken from a surrounding element, not the badge. The badge is styled by
> `.pbcard[data-plan-state="plus-attention"] .pb-state` and renders `#E4736B`;
> the healthy `plus-active` badge renders gold. The conclusion in that record —
> deliberately not gold — was right; the sampled value was wrong. The earlier
> file is left as written and corrected here rather than rewritten.

---

## 5. Hosted Portal recovery

The Portal was opened by clicking **Manage billing** in the authenticated
application, which creates the session server-side from the stored customer
mapping. There is no browser-supplied customer id and no email lookup.

Verified on the hosted page:

- the session was a **sandbox** session, badged as such, and belonged to the
  clock-owned disposable Customer
- the return links pointed at the **local development origin**, never
  production — the return URL is built server-side from `SITE_URL`, so this is a
  property of configuration rather than of inspection
- the Portal surfaced the failed payment plainly, and offered a combined
  update-payment-method-and-pay-the-open-invoice flow
- invoice history listed the failed renewal and the earlier paid invoice

A working official sandbox payment method already on file was selected and the
open renewal invoice was paid through the hosted flow. No card value is recorded
here.

**Result, read from Stripe:**

- the **same** renewal invoice moved to `paid` — same invoice number, not a
  replacement
- **no second invoice** was created
- exactly **one** `invoice_payment`, carrying exactly **one** PaymentIntent
- `amount_overpaid: 0`
- `attempt_count` remained **1** — the single failed attempt; the Portal payment
  was an explicit payment, not a retry
- the Subscription returned to `active`, annual, quantity 1, correct new period
- a genuine `invoice.paid` webhook was received and applied

**The Portal also set `subscription.default_payment_method`.** That is the
Portal doing its job, and it is the fact the rest of this record turns on.

Application state after convergence: `tier=plus`, `planKey=plus_annual`,
`status=active`, `billingInterval=year`, `cancelAtPeriodEnd=false`, no payment
attention. `/you` showed the attention message gone, the gold **ACTIVE** badge,
and the annual renewal line restored. `/pricing` still treated Plus as current
with no duplicate Checkout. Zero identifiers on either page.

**Recovery here was performed by the hosted Portal, not by the harness.**

---

## 6. The seventh safe stop, and what it was really about

`restore_and_pay` then refused a fixture that had already recovered.

The refusal came from a precondition requiring the subscription-level default
payment method to still equal the value captured at provisioning. For this
fixture that captured value is **absent by design**: the subscription is created
with no subscription-level default precisely so the Customer default is the
effective one.

So the Portal set that field to a working card, the subscription became
*healthier* than the state on record, and recovery rejected it — **before the
invoice was ever inspected**, which meant the harness could not even observe
that the payment had already succeeded. It returned in under five seconds,
never reaching a convergence poll.

That is the defect of the previous two stops in a new place: **a stored value
standing in for evidence about the world.** The pattern has now cost seven
stops, and the shape is identical every time.

The correction, merged as PR #47, replaces snapshot equality with the question
the code should have been asking: *is the method that would actually be charged
a good one?* Payment precedence is resolved the way Stripe resolves it — the
subscription-level default when set, otherwise the Customer default — and how
strict that has to be depends on whether money is about to move:

| Renewal invoice | Requirement on the effective method |
|---|---|
| still **open** | must be the exact method this fixture already proved works, because the next call is a charge |
| already **paid** | any method genuinely belonging to this Customer and not the failing one — **including one the Portal chose** |

The failing method is refused in both branches, absence is refused in both, and
the id is retrieved and validated rather than trusted from a field.

**A Portal-set subscription default is preserved.** Recovery does not reach in
and undo a decision a person completed successfully through the hosted flow. It
issues no subscription write at all; a test asserts its only write targets are
`/customers`, `/invoices` and `/payment_methods`.

The historical snapshot is still recorded on the fixture. It is history now, not
an authorization boundary.

Three smaller repeats-are-safe corrections travelled with it, each the same
shape as the guard that once refused a `paid` invoice:

- the Customer default is not rewritten when it is already correct
- a PaymentMethod that is **already detached** is observed and accepted rather
  than refused — a run interrupted after a successful detach was previously
  punished for having done the right thing
- the detach response is inspected, not merely its status code

Verification of the fix: harness suite **538 → 592 checks**, all passing;
**31/31 mutation scenarios caught**, sources restoring byte-identically; every
other suite unchanged.

Mutation testing found a real gap in the suite as it stood. The convergence
assertions checked that the shared poller was *called*, not that its answer was
*used*, so a short-circuited binding kept them green. A poller that runs and has
its verdict discarded is worse than none: it pays the latency and still returns
the wrong answer. Both recovery and cancellation now pin the binding and the
refusal that consumes it.

---

## 7. Hosted Portal cancellation scheduling and reversal

Both were exercised on the **same** disposable Subscription, before the fix was
written, and neither was repeated afterwards.

**Scheduling.** The Portal stated the terms plainly — the subscription would
remain available until the end of the billing period — and confirmed on return
with a "Cancels …" heading and a "Don't cancel subscription" control.

Stripe recorded this as **`cancel_at` set to the period end with
`cancel_at_period_end: false`**, not as `cancel_at_period_end: true`. The
application's normalization handled it correctly and the canonical row read
**`cancelAtPeriodEnd: true`** — the exact case
`verify-stripe-cancel-at-normalization` exists for, now confirmed against a real
hosted Portal action rather than an API call.

The subscription stayed `active` and Plus, on the same annual price at quantity
1, with no new subscription, no charge and no proration invoice.

`/you` presented it as:

> Declare Plus · Annual plan · **Cancels August 23, 2028** · ENDING
> Your Plus access remains available until then.

A third distinct badge treatment, muted rather than gold or coral. No provider
identifier appeared.

**Reversal.** The Portal's renew control stated that the subscription would no
longer be canceled and would renew on its existing date. After confirming,
Stripe reported `cancel_at: null`, `cancel_at_period_end: false`,
`canceled_at: null` and no cancellation reason, on the **same** subscription —
no replacement subscription, no Checkout session, no charge, no proration
invoice, still exactly two invoices.

The canonical row followed to `cancelAtPeriodEnd: false`, and `/you` returned to
the ordinary active annual presentation with the scheduled-cancellation copy
gone. `/pricing` still treated Plus as current.

> **Minor finding, not a blocker.** After reversal the canonical row still
> carries a `canceledAt` value even though Stripe reports `canceled_at: null`.
> The user-visible state is correct because `cancelAtPeriodEnd` is `false` and
> the status is `active`, and nothing reads `canceledAt` for entitlement. It is
> stale data on an active subscription and worth tidying before any future logic
> starts trusting that field.

---

## 8. Resumed recovery, and the proof no payment was repeated

After the fix was merged and deployed to development only, the **existing**
fixture was resumed. No new account, Test Clock, Customer, Subscription or
Invoice was created, the clock was not advanced again, and the Portal was not
reopened.

Pre-resume state: `phase=recovering`, `attemptCount=1`, `hasFixture=true`,
`lastError=not-converged`, `inFlight=false`, and `restore_and_pay` the only
admitted command.

`restore_and_pay` was submitted **once** and reached **`recovered`** with
`lastError` cleared, `attemptCount` still 1, and `cancel_fixture` the only
newly admitted command.

**Zero duplicate payment, proven three independent ways:**

1. The renewal invoice's expanded payment list still contained exactly **one**
   `invoice_payment`, with the **same** identity and the **same** single
   PaymentIntent created at the moment of the Portal payment. Not a new payment
   that happened to match — the same object, unchanged.
2. `amount_overpaid` remained **0**, `attempt_count` remained **1**, and there
   were still exactly two invoices on the subscription.
3. **`billingEvents` did not grow at all** across the resumed run. No
   `invoice.paid`, no subscription update, nothing. A second payment cannot
   happen silently; it would have produced an event.

Also confirmed: the Customer default was already correct and was **not**
rewritten, and the Portal-set subscription default was **preserved unchanged**.

The temporary failing PaymentMethod was detached. The operation cannot return
success without either detaching it and confirming the response reports no
customer, or observing it already detached — any other outcome is a refusal that
leaves the phase in `recovering`. Independent re-reading of the PaymentMethod
was not possible: the Stripe MCP surface exposes no PaymentMethod operation at
all, which is the same gap that made this harness necessary in the first place.
The detach therefore rests on the operation's own verified post-condition, which
is unit-tested and mutation-covered, rather than on a second observation.

---

## 9. Terminal cleanup

`cancel_fixture` → **`terminal`**. Only the clock-owned disposable subscription
was cancelled. A genuine `customer.subscription.deleted` webhook arrived and was
applied; the canonical row moved to `status: canceled`, `tier: free`; `/you`
returned to the **Free plan** presentation with zero billing controls and zero
identifiers. Both existing subscribers were untouched.

`delete_clock` → **`clock_deleted`**, and only after terminal convergence was
verified. The clock was re-read and confirmed sandbox before deletion, and its
Customer and Subscription were removed with it.

**Retained on purpose:** the fixture audit row, the terminal canonical history,
and the `billingCustomers` mapping. The mapping is what makes the disposable
account permanently one-time-use — `provision` refuses any account that already
has a mapping — and deleting it would quietly re-arm an account that has already
been through the whole lifecycle. `allowed` is now empty.

---

## 10. Post-execution audit

**Stripe.** Zero Test Clocks remain. Exactly two Subscriptions and two
Customers, **none clock-bound**. Both existing subscribers match their recorded
baselines field for field: the annual subscriber active with no `cancel_at`, the
monthly subscriber active with its documented pre-existing end-of-period
cancellation.

**Convex.** The two real subscriber rows were last written at `1787438253205`
and `1787429997151`. The execution window opened at `1787532457032`. **Both
timestamps precede the window**, so neither row was written during this gate at
all — which is stronger than comparing field values.

| Table | Baseline | Final | Delta |
|---|---|---|---|
| `subscriptions` | 3 | 4 | +1 disposable, terminal |
| `billingCustomers` | 3 | 4 | +1 mapping, intentionally retained |
| `billingTestFixtures` | 2 | 3 | +1, at `clock_deleted` |
| `billingEvents` | 18 | 29 | +11 |

The eleven events, in creation order and without identifiers:

```
invoice.paid → customer.subscription.created → customer.subscription.updated
→ invoice.payment_failed → customer.subscription.updated
→ customer.subscription.updated → invoice.paid
→ customer.subscription.updated → customer.subscription.updated
→ customer.subscription.updated → customer.subscription.deleted
```

Exactly one `invoice.payment_failed`. Two `invoice.paid` — the initial invoice
and the single hosted-Portal renewal payment. No duplicate canonical row, no
duplicate mapping, no failed webhook-processing state.

**Residue.** One `billingTestFixtures` row remains at
`provisioning` / `stripe-error` from an abandoned first attempt in the previous
milestone. It holds no provider identifiers at all, which the Stripe audit
confirms — nothing was created for it. Left in place rather than hand-edited,
because hand-editing fixture state is the thing this harness exists to avoid.

---

## 11. Disablement and separation

`BILLING_TEST_HARNESS_ENABLED` was removed first, then
`BILLING_TEST_HARNESS_DEPLOYMENT`. Both are absent from development and have
been absent from production throughout. The local development server was stopped
by its captured PID, port 4321 is free, and the route it served is unreachable.

`PUBLIC_BILLING_HARNESS_CONTROL` existed only on that process. It is in no
environment file, and no public or Cloudflare harness route was ever deployed.

The harness functions remain deployed to development and are inert.

| | Functions | `testHarness` | Harness variables |
|---|---|---|---|
| Development `good-dotterel-906` | 55 | 4 (2 public, 2 internal) | 0 |
| Production `keen-hamster-650` | **51** | **0** | **0** |

The production function specification is **byte-identical** to the capture taken
before any work began.

---

## 12. Not observed

- **Stripe's automatic Smart Retry cadence.** The retry was scheduled and its
  timing observed as a value on the failed invoice — roughly two days of clock
  time out — but the clock was never advanced to let it fire. Recovery was
  driven by a person through the Portal, which is the flow that matters for a
  real subscriber, but it is not the same as watching the automatic schedule
  run. The configured sandbox policy remains up to 8 retries over two weeks with
  a **final action of cancel**, which is exactly why the advance is bounded to
  the first attempt.
- **Failed-payment emails.** Disabled at the account level in this sandbox, so
  none were sent and none were checked. See the production runbook: silent
  dunning must not ship.
- **Any production behaviour.** Nothing here executed against live mode.

**Production prerequisite carried forward:** production must not go live with
silent dunning. Either Stripe's failed-payment customer emails are enabled, or a
separately verified application-owned notification path exists. See
[billing-production-activation-readiness.md](billing-production-activation-readiness.md).
