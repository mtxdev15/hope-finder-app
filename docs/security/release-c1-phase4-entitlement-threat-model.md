# Release C1 Phase 4 — Entitlement Threat Model

Scope: entitlement resolution, usage metering, active-Journey eligibility.
Written against the code as implemented, with the evidence each control holds.

**Governing principle:** every input to an entitlement decision must be one the
user cannot write. Anything else is decoration.

---

## E1 — Forging Plus via generic synced data

**Threat.** Write `tier: "plus"` into synced storage and be treated as a
subscriber.

**Why this is not theoretical.** `convex/userdata.ts:31` `set({key, value})` is a
**public mutation accepting an arbitrary key and value**. Verified: calling it
with `key: "db_journey_lock"` fails on *authentication*, not validation — the
arbitrary key passes. Any signed-in browser can write whatever it likes there.

**Control.** The resolver reads `subscriptions` (webhook-written), `usageCounters`,
`journeySlots` and `accountSettings`. It never reads `userData` or localStorage.
No public mutation writes tier.

**Verified.** `entitlements:setTier` and `usage:setUsage` → `Could not find
public function` (they do not exist). All internal functions likewise unreachable.

---

## E2 — Forging active-Journey count

**Threat.** Journey progress lives in localStorage mirrored to `userData`, so a
user could report "0 active Journeys" and start unlimited new ones.

**Control.** Entitlement counts the dedicated `journeySlots` table and nothing
else. Counting `userData` would be security theatre: the enforced number would
be a number the user controls — blocking honest users while letting anyone with
a console straight past.

**Accepted, documented limitation.** The Journey UI does not write this table
yet, so the trusted count is 0 and the limit is inert. An unwired limit lets
people through; a forged limit is worse than none.

---

## E3 — Selecting another account

**Threat.** Pass someone else's user id to read or spend their entitlement.

**Control.** No public entitlement or usage function declares a `userId`
argument. Identity comes from `authComponent.safeGetAuthUser(ctx)`.

**Verified.**
```
getMyEntitlements {userId}      → ArgumentValidationError
canStartJourney {userId}        → ArgumentValidationError
reserveUsage {userId}           → ArgumentValidationError
registerJourneyStart {userId}   → ArgumentValidationError
```
Cross-account read returns a clean zero state for an unrelated id.

---

## E4 — Unauthenticated access

**Control.** Every public mutation resolves identity first and throws
`not-authenticated`. `getMyEntitlements` deliberately does not throw when signed
out — it returns the **guest** shape (`gentleGuidanceDaily: 0`), because being
signed out is a normal state, not an error.

**Verified.** `reserveUsage`, `registerJourneyStart`, `setTimezone`
unauthenticated → rejected. Signed-out `getMyEntitlements` → `tier: "guest"`.

---

## E5 — Concurrency defeating the quota

**Threat.** Fire N requests at once; each reads "2 used" and all proceed.

**Control.** Reservations. A slot is taken **before** the work starts and the
limit check reads `used + reserved`. Convex mutations are transactional and
serialized per document, making the read-modify-write atomic without a lock.

**Verified.** Three reservations succeed, the fourth returns
`daily-limit-reached` while all three are merely *held* — none finalized.

---

## E6 — Double-spend and double-count

**Control.** `requestId` is a per-user idempotency key. Re-reserving returns the
same reservation; re-finalizing counts once; a spent key is refused rather than
reissued.

**Verified.** Duplicate reserve → same slot. Duplicate finalize → `ok`, counted
once (`used=1`).

---

## E7 — Reservation leak after a crash

**Threat.** A process dies between reserve and finalize, and the hold consumes
the allowance until midnight.

**Control.** `expiresAt` + lazy reclamation on the next reserve.

**Bug found and fixed during verification.** The first implementation released
the reservation *row* but never decremented the counter's `reserved` tally —
which is what the limit check reads. The TTL was cosmetic and the allowance
stayed consumed. Caught because the test asserted *the next reservation
succeeds*, not merely that the row changed state.

**Verified after fix.** Expiring one of three holds allows a new reservation.

---

## E8 — Crisis routing charged as a use

**Threat.** Someone routed to crisis resources loses one of three daily uses.

**Control.** Crisis, support routing, failure, malformed responses, service
unavailability and server-received cancellation all call `releaseUsage`, which
consumes nothing. Only `reason: "failed"` / `"malformed"` increments `failed`,
so **crisis never registers as a failure**.

**Verified.** After 1 finalize + 2 releases (one crisis, one failed):
`used=1, successful=1, failed=1, reserved=0`, remaining 2.

---

## E9 — Timezone manipulation resetting the allowance

**Threat.** At 11pm in New York, switch to a zone where it is already tomorrow,
collect a fresh allowance, switch back for another.

**Control, two layers.** (1) The account day is **monotonic** — clamped to the
highest day the account has reached, so it can never rewind. (2) `setTimezone`
is rate-limited to one change per 24 hours and validates against `Intl`.
IP-derived timezone is never entitlement truth.

**Verified.** `clamp("2026-07-31", last="2026-08-01")` → `2026-08-01`.
DST spring-forward keeps the calendar day stable.

---

## E10 — Historical donor treated as a subscriber

**Threat.** A recurring donor with a Stripe customer and subscription id in gift
history resolves as Plus.

**Control.** The resolver reads only `subscriptions`. Gift tables are never
consulted for entitlement.

**Verified.** A user with a recorded recurring gift carrying both
`subscriptionId` and `customerId` resolves `tier: free`,
`subscriptionStatus: none`, `gentleGuidanceDaily: 3`.

---

## E11 — Limit drift between surfaces

**Threat.** The UI shows 3 while the server enforces 5, or a limit is raised in
one place and not another.

**Control.** One catalog module, no literal limits elsewhere. Public and
internal entry points share a single core function per operation, so the browser
path and the trusted server path cannot diverge.

---

## E12 — Escalation through the internal API

**Control.** Every `*Internal` function is an `internalMutation` /
`internalQuery`, invisible to the public API.

**Verified.** `resolveInternal`, `reserveUsageInternal`, `backfillSlotInternal`
→ `Could not find public function`.

---

## Residual risks and open items

1. **Active-Journey enforcement is inert** until the Journey UI writes
   `journeySlots`. Documented, deliberate, fails open.
2. **Grace period awaits approval** (recommended 3 days).
3. **Invisible abuse limits for Plus are not implemented.** `null` means no
   customer-visible quota; concurrency and abuse ceilings belong to the service
   layer and are deliberately outside the catalog.
4. **Timezone is not yet settable from the UI**, so every account currently
   resolves on UTC.
