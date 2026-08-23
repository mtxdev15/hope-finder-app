# Test Clock harness — stale error stop, 2026-08-23

The third safe stop, and the smallest. Nothing was wrong with the fixture; the
label on it was.

No clock advancement. No payment attempt. No Stripe mutation of any kind.

---

## Adoption succeeded

Read-only adoption recovered the fixture stranded by the previous convergence
stop. It issued **zero Stripe mutations** and created nothing:

- Convex unchanged at `subscriptions 3 / billingCustomers 3 / billingEvents 12`;
- one Test Clock, one clock-owned Customer, one active annual Plus Subscription,
  one paid initial Invoice — all pre-existing, none duplicated;
- the fixture became **complete**: clock, Customer, Subscription, working
  Customer default and renewal boundary all present, `attemptCount` still 0;
- no failing PaymentMethod, no renewal Invoice, no clock advance;
- the historical first fixture untouched and still retired.

---

## Why it stopped anyway

The fixture read `healthy` **and** `not-converged` at the same time.

The success path tried to clear the error with:

```ts
patch: { ...(result.patch || {}), lastError: undefined }
```

Convex function arguments are serialized. `undefined` has no serialized form, so
the key disappeared before the internal mutation ever saw it, and the stored
value survived. The bug had always been there — this was simply the first
success that followed a recorded failure, so the first time it could show.

**A stale label is not cosmetic when it is the only signal an operator has.**
`healthy` beside `not-converged` is unreadable: it could mean recovered, or it
could mean something is still wrong, and nothing on the outside distinguishes
them. Continuing would have meant carrying a misleading status through five
irreversible commands, caveating each one.

So the lifecycle stopped before `arm_failure`, both development flags were
removed, and the local server was stopped. Production was never touched.

---

## The fix

**An explicit clear signal.** `clearLastError: true` is a boolean, so it
survives serialization; the field removal is then constructed locally against
`ctx.db.patch`, never relayed. Setting and clearing in one call is rejected
rather than silently resolved, and only `true` clears — `false` or a missing
signal leaves the value alone.

No schema change was needed. `lastError` is already `v.optional(v.string())`,
and removing an optional field is exactly what makes the public status report
`null`.

**A narrow normalization path.** The same `provision` command clears the
stranded label on an already-healthy fixture, without moving the phase
backward. It is read-only externally: it re-proves the whole graph — clock,
Customer, effective working default, Subscription, provenance binding, renewal
boundary, canonical row and mapping — and then writes only the cleared label.

While that label stands, `arm_failure` is **withheld**. An operator should not
begin arming a failure against a fixture whose reported state they cannot read.

`not-converged` is the only classification it will clear, because it is the only
one the broken clear could have stranded. Any other error on a healthy fixture
stops for a human. The six-command surface is unchanged; no normalize, reset or
repair command was added.

---

## Status

`payment-failure / payment-attention` remains **open**. TODO unchanged.

No provider identifier, account identity, renewal timestamp, key material,
webhook URL or card detail appears in this record.
