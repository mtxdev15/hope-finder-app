# Test Clock harness — provisioning convergence stop, 2026-08-23

The second authorized attempt at the payment-failure lifecycle. It stopped
before `arm_failure`, for a reason worth recording carefully: **almost
everything worked.**

No clock advancement occurred. No failed payment attempt occurred. Both
existing subscribers are unchanged.

---

## What succeeded

`provision` was submitted **once**, from a Free disposable account with no
mapping, no canonical subscription and no fixture.

- one Test Clock created;
- one Customer created **directly on that clock**, with **email omitted**;
- the working sandbox method attached and set as the Customer default;
- one **active annual Plus Subscription**, `year × 1`, $79.99, clock-owned,
  `livemode: false`, carrying the five provenance fields;
- the initial invoice **paid**;
- the canonical Convex subscription and the `billingCustomers` mapping created
  **entirely through genuine webhook handling** — `billingEvents` 10 → 12;
- **no manual billing insert of any kind.**

That last point is the one that matters most. The central unproven claim of
this whole design was that a directly-created Customer and Subscription
carrying the five provenance fields would bind to an application user through
the same trusted path a real Checkout uses, with no manual Convex write. **It
did.** The ownership contract is proven.

---

## Why it stopped anyway

`opProvision` read the canonical row **once**, immediately after creating the
subscription — before an asynchronous webhook could possibly have landed. It
returned `not-converged` for a run that was, in substance, healthy.

Compounding it: `stripeCustomerId` and `stripeSubscriptionId` were written only
in the final success patch. A late failure therefore left a fixture that knew
the clock but **not what was on it**, so no downstream command could proceed.

The result was a healthy object graph in Stripe and Convex with a fixture
record unable to drive it.

---

## What held

- The **clock isolation held.** The fixture subscription carries a
  `test_clock`, so it can never satisfy `assertClockOwned` for either real
  subscriber.
- The **pre-write rollback from the previous fix behaved correctly.** A clock
  id had been persisted, so it kept the fixture in-flight rather than resetting
  — exactly the intended distinction.
- **Both existing subscribers unchanged**: monthly `plus_monthly / active`,
  ending September 21 2026; annual `plus_annual / active`, renewing August 22
  2027. Both `test_clock: null`.

---

## Teardown

Nothing was retried. Both development harness variables were removed, the local
server was stopped, and production was never touched — no harness function, no
harness variable, at any point.

`payment-failure / payment-attention` remains **open**. No execution record was
written and no TODO was closed.

---

## The three fixes

1. **Bounded convergence polling** in normal provisioning, reusing the bounds
   `opAdvance` already uses. Reads only, never recursive. Convergence now
   requires the canonical row to *be* the subscription just created and the
   customer mapping to exist — health alone would pass on a pre-existing
   subscription and call a foreign object ours.

2. **Incremental persistence.** Each provider identifier is stored immediately
   after it is created and verified, before the next external write. The
   working Customer default is read back from Stripe and confirmed to be the
   actual invoice default before being recorded. The persistence mutation
   refuses to repoint or clear an identifier.

3. **Read-only adoption.** The same `provision` command — no seventh command —
   recovers a fixture in exactly this state. It issues **no Stripe write**: it
   re-derives the graph from the clock id, verifies every edge, and writes only
   our own row. Discovery is scoped throughout, because Stripe omits clock-owned
   customers from unfiltered lists. Exactly one Customer and one Subscription,
   or it refuses; ambiguity is never a best-effort match.

### Which fixtures are recoverable, and which are not

The **first** failed fixture — no clock id, generic `stripe-error` — remains
permanently unrecoverable and untouched. Nothing about it says whether anything
exists in Stripe, so nothing can be safely re-derived.

The **second** is recoverable for a specific reason: the clock id is known, and
from a clock the entire object graph can be re-derived and re-verified without
creating anything. That distinction is the predicate, not a convenience.

---

## Scope note

No provider identifier, account identity, key material, webhook URL or card
detail appears in this record, by design.
