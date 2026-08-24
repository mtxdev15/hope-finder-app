# Payment-failure / payment-attention lifecycle — execution record

**Date:** 2026-08-23 UTC
**Account:** Stripe development sandbox `acct_1TmENuLShxhb4mBz`
**Convex:** development `good-dotterel-906` only. Production `keen-hamster-650`
was never deployed to, never configured, and holds zero `testHarness` functions.
**Result:** the full lifecycle ran end to end. `verify payment-failure /
payment-attention behaviour` is now closed.

This is the first time the application's payment-attention path has been
exercised by a real failed payment rather than reasoned about.

---

## 1. What was proven

A throwaway sandbox subscription on a Stripe Test Clock was driven through a
failed renewal and back to healthy, and the application followed at every step.

| Step | Command | Phase reached | What the app did |
|---|---|---|---|
| 1 | `provision` | `healthy` | Customer, Subscription and canonical row created **through the webhook**, no manual write |
| 2 | `arm_failure` | `failure_armed` | default PaymentMethod swapped to a card that declines. No charge attempted |
| 3 | `advance_to_renewal` | `past_due` | renewal invoice failed, `attempt_count = 1` |
| 4 | `restore_and_pay` | `recovered` | good card restored, invoice paid, subscription back to `active` |
| 5 | `cancel_fixture` | `terminal` | disposable account lost Plus |
| 6 | `delete_clock` | `clock_deleted` | fixture Customer and Subscription removed from Stripe |

**The user-facing claim, observed on `/you`:**

*While `past_due`* — "Declare Plus / Annual plan / NEEDS ATTENTION / Something
about your payment needs a second look. You still have access while we sort it
out. / Manage billing". The status badge rendered `rgb(34, 56, 46)`, deliberately
**not** the gold used for a healthy plan, and **no renewal date was shown** —
because the app must not promise a renewal it cannot confirm.

*After recovery* — the attention message is gone and the line reads "Annual plan
· Renews August 23, 2028". Screenshot: `docs/verification/screenshots/billing-failure-lifecycle/04-recovered-you.png`.

Zero Stripe identifiers leaked to the page in either state (checked for `sub_`,
`cus_`, `in_`, `pm_`, `price_`, `acct_` in the rendered text).

The central unproven claim of the whole design also held: a **directly created**
Customer and Subscription carrying the five provenance fields binds to an
application user through genuine webhook handling, with **no manual Convex
insert**.

---

## 2. Post-execution audit

**Stripe** — 0 Test Clocks remain. Exactly 2 subscriptions exist, both `active`,
**neither carrying a `test_clock`**: the annual QA subscriber (period end
2027-08-22, no `cancel_at`) and the monthly QA subscriber (`cancel_at`
2026-09-21, its documented pre-existing end-of-period cancellation from §6.17).
Both match their recorded baselines.

**Convex** — the two real subscriber rows were last written at
`1787438253205` and `1787429997151`. The test window opened at
`1787516802440`. **Both timestamps precede the test**, so neither row was
touched. This is stronger than comparing field values: nothing wrote to them at
all.

**`billingEvents`** — 18 rows, of which 8 fall inside the test window and are
exactly the expected lifecycle:

```
invoice.paid → customer.subscription.created → customer.subscription.updated
→ invoice.payment_failed → customer.subscription.updated
→ invoice.paid → customer.subscription.updated → customer.subscription.deleted
```

The 10 pre-existing rows were unchanged.

**Residue.** Two `billingTestFixtures` rows remain in development. One is the
completed fixture at `clock_deleted`. The other is the first, abandoned attempt,
still labelled `provisioning` / `stripe-error` — it predates the rollback fix
below and holds **no provider identifiers at all**, which the Stripe audit
confirms: nothing was created for it. Harmless, and left in place rather than
hand-edited, because hand-editing fixture state is the thing this harness exists
to avoid.

---

## 3. Six safe stops before the lifecycle would run

Every one of these stopped the run rather than pressing on, and every one was
fixed and merged before continuing. They are recorded because the *pattern*
matters more than the individual bugs.

| PR | Stop | Root cause |
|---|---|---|
| #39 | `provision` → `stripe-error` at the first write | restricted key lacked Test Clocks permission; the fixture then held a phase it had not earned |
| #40 | `provision` → `not-converged` despite full Stripe success | convergence checked **once**, immediately, against a webhook that had not arrived |
| #41 | `lastError` would not clear | `undefined` has no serialized form in Convex — the key simply vanished from the arguments |
| #42 | `advance_to_renewal` → `not-converged` | Stripe holds a renewal invoice as `draft` for one hour before attempting payment; the advance targeted only the period boundary |
| #43 | resumed advance → `stripe-error` | an idempotency key replayed with a *different* `frozen_time`, which Stripe correctly refuses |
| #44 | a stale `stripe-error` label locked the fixture | the decision to advance trusted a **stored label** instead of reading the world |
| #45 | `restore_and_pay` → `not-converged` after a payment that **succeeded** | the same one-shot convergence check, now in recovery |

Four of these are one bug: **a webhook-driven convergence checked with a single
immediate read.** PR #45 fixed the class rather than the instance — one shared
bounded poller at every convergence point, plus skip-if-already-done guards so a
resumed run never repeats an irreversible step.

The principle PR #44 established, and #45 generalised, is the one worth keeping:
**read the world before writing to it.** A stored status label is a hint; it is
not evidence, and it must never be the thing that authorises an irreversible
action.

PR #42 is worth reading twice. The live period-end had already rolled forward to
2028, so advancing toward the *live* value rather than the *stored* boundary
would have jumped the clock past the retry window — and because this sandbox's
final retry action is **cancel**, that would have destroyed the fixture instead
of failing one payment.

---

## 4. Verification

- `verify-billing-test-harness` — **538/538** (was 512 before PR #45)
- `verify-billing-dev-control` 141/141, `verify-plus-classification` 99/99,
  `verify-webhook-signature` 34/34, `verify-worker-parity` 74/74,
  `verify-auth-expired-session` 26/26
- `tsc --noEmit -p convex/tsconfig.json` clean
- **Mutation testing: 13/13 caught.** One survived the first pass —
  `isCancelResumable` ignoring its `phase` check, because the sweep over all
  other phases had been written for recovery and not for cancellation.

---

## 5. Disablement

`BILLING_TEST_HARNESS_ENABLED` was removed first, then
`BILLING_TEST_HARNESS_DEPLOYMENT`. `npx convex env list` on development now
returns neither. The functions remain deployed to development and are inert:
`runCommand` calls `checkGates` before reading the Stripe secret, before
admitting a command, and before any network call.

**One honest limit.** The live refusal was **not** observed against an
authenticated caller. `runCommand` runs `requireUser` before `checkGates`, so an
unauthenticated CLI call returns `not-authenticated` and proves nothing about
the flags; the browser test that would have proven it was blocked by a tool
permission and was not worked around. The disabled state therefore rests on two
things instead: both variables are absent from the deployment, and `checkGates`
refusing on an absent flag is unit-tested in the suite above.

`fixtureStatus` is **deliberately not** flag-gated, so the harness page still
renders a status after disablement. That is correct and not a gate failure: it
is authenticated, read-only, and returns a six-field allowlist projection built
field by field, so it cannot mutate anything, cannot reach Stripe, and cannot
leak a column added to the table later.

---

## 6. Not observed

- Stripe's **automatic** Smart Retry schedule. Recovery here was driven manually
  by paying the invoice. The configured policy (up to 8 retries in 2 weeks,
  final action **cancel**) was read, and was the reason the advance is bounded
  to the first attempt, but the retry cadence itself was never allowed to run.
- Failed-payment **emails** — disabled in this sandbox, so none were sent and
  none were checked.
- Dunning through the **Portal**. Recovery went through the API, not the hosted
  recovery flow a real subscriber would see.
  **Closed 2026-08-24** — hosted Portal recovery, cancellation scheduling and
  cancellation reversal were all exercised on a second disposable fixture. See
  [billing-portal-release-gate-2026-08-23.md](billing-portal-release-gate-2026-08-23.md),
  which also corrects the attention-badge colour recorded in §1 above.
- Any **production** behaviour. Nothing in this record was executed against
  live mode, and no live key, Product, Price, or webhook exists. What production
  would still need is inventoried in
  [billing-production-activation-readiness.md](billing-production-activation-readiness.md).
