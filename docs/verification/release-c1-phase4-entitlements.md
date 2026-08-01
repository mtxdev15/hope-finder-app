# Release C1 Phase 4 — Verification Report

**Deployment touched:** Convex **dev** `good-dotterel-906` only, via
`npx convex dev --once` (also the only available typecheck).
**Production `keen-hamster-650` was not written to.** One read-only check
confirmed prod `giftStats` is intact. Nothing deployed to Cloudflare. Phase 4 is
**not pushed**.

---

## 0. Honest scope

**Scripts that exist in `package.json`:** `dev`, `build`, `preview`, `astro`.
**There is no lint, test, typecheck or E2E script.** None was run, none is
claimed. TypeScript is not installed locally; the only typecheck is Convex's on
push.

Authenticated *browser-session* paths could not be exercised (no signed-in
session available). They were tested through the `*Internal` twins, which share
**one core function** with the public mutations — so the logic under test is the
same logic that ships. Argument-level rejection was verified against the public
API directly.

---

## 1. Tier resolution — all nine branches

| Case | Expected | Result |
|---|---|---|
| no subscription | free, 3/2 | **PASS** |
| `active` | plus, null/null | **PASS** |
| `cancel_at_period_end`, period remaining | **plus** | **PASS** |
| `cancel_at_period_end`, period elapsed | free | **PASS** |
| `past_due` within grace | plus + attention | **PASS** |
| `past_due` past grace | free + attention | **PASS** |
| `unpaid` past grace | free + attention | **PASS** |
| `canceled` | free | **PASS** |
| `trialing` | plus | **PASS** |

---

## 2. Usage counters

| # | Test | Result |
|---|---|---|
| 2.1 | Free: reservations 1–3 allowed | **PASS** (remaining 2 → 1 → 0) |
| 2.2 | Free: 4th blocked | **PASS** — `daily-limit-reached` |
| 2.3 | Concurrency cannot exceed allowance | **PASS** — limit reads `used + reserved` |
| 2.4 | Duplicate reserve, same `requestId` | **PASS** — same slot, not a second |
| 2.5 | Finalize consumes one | **PASS** |
| 2.6 | Duplicate finalize | **PASS** — idempotent, counted once |
| 2.7 | Release does not consume | **PASS** — used 1, remaining 2 |
| 2.8 | Crisis release not counted as failure | **PASS** — `failed=1` from the `failed` reason only |
| 2.9 | Expired reservation reclaimed | **PASS** *(after fixing the bug below)* |
| 2.10 | Plus receives no visible block | **PASS** — 5 consecutive reservations |
| 2.11 | Spent `requestId` refused | **PASS** — `request-already-resolved` |

### Bug found and fixed: reservation expiry was cosmetic

The first implementation marked the expired reservation row `released` but never
decremented the counter's `reserved` tally — which is what the limit check reads.
A crashed process therefore still consumed the allowance for the rest of the
day: exactly what the TTL exists to prevent.

Caught because the test asserted **the next reservation succeeds**, not merely
that the row changed state. Fixed by decrementing the counter during reclaim and
re-reading it before the limit check. Re-verified: expiring one of three holds
allows a new reservation.

---

## 3. Account day and timezone

Pure-function verification at `2026-08-01T03:30:00Z`:

```
UTC                -> 2026-08-01
America/New_York   -> 2026-07-31   (still yesterday)
Europe/London      -> 2026-08-01
Pacific/Kiritimati -> 2026-08-01   (UTC+14)
```

DST, US spring-forward 2026-03-08 (02:00 EST → 03:00 EDT):
```
06:59Z -> 2026-03-08
07:01Z -> 2026-03-08   (calendar day stable across the jump)
```

Monotonic clamp:
```
clamp("2026-07-31", last="2026-08-01") -> 2026-08-01   (cannot rewind)
clamp("2026-08-02", last="2026-08-01") -> 2026-08-02   (may advance)
```

Rate limit verified by inspection: `setTimezone` refuses with
`timezone-change-too-soon` inside `TIMEZONE_CHANGE_MIN_INTERVAL_MS` (24h), and
rejects a zone `Intl` will not accept.

---

## 4. Active Journeys

| # | Test | Result |
|---|---|---|
| 4.1 | Free starts Journey 1 | **PASS** |
| 4.2 | Free starts Journey 2 | **PASS** |
| 4.3 | Free **cannot** start Journey 3 | **PASS** — `active-journey-limit`, active 2 limit 2 |
| 4.4 | Duplicate start idempotent | **PASS** |
| 4.5 | Completed Journey frees a slot | **PASS** |
| 4.6 | Archived Journey frees a slot | **PASS** |
| 4.7 | Plus exceeds 2 | **PASS** — limit `null` |
| 4.8 | Another account cannot affect the count | **PASS** |

### Grandfathering

| # | Test | Result |
|---|---|---|
| 4.9 | Backfilled over-limit Free user keeps all 4 | **PASS** — active 4, slots left 0 |
| 4.10 | Cannot start a **new** one | **PASS** |
| 4.11 | Can still open an **existing** one | **PASS** |
| 4.12 | Can still complete an existing one | **PASS** |

No content is deleted, force-completed or force-archived by any path.

---

## 5. Security

| # | Test | Result |
|---|---|---|
| 5.1 | `getMyEntitlements {userId}` | **PASS** — ArgumentValidationError |
| 5.2 | `canStartJourney {userId}` | **PASS** — ArgumentValidationError |
| 5.3 | `reserveUsage {userId}` | **PASS** — ArgumentValidationError |
| 5.4 | `registerJourneyStart {userId}` | **PASS** — ArgumentValidationError |
| 5.5 | `entitlements:setTier` | **PASS** — does not exist |
| 5.6 | `usage:setUsage` | **PASS** — does not exist |
| 5.7 | `resolveInternal` via public API | **PASS** — not found |
| 5.8 | `reserveUsageInternal` via public API | **PASS** — not found |
| 5.9 | `backfillSlotInternal` via public API | **PASS** — not found |
| 5.10 | Unauthenticated `reserveUsage` | **PASS** — rejected |
| 5.11 | Unauthenticated `registerJourneyStart` | **PASS** — rejected |
| 5.12 | Unauthenticated `setTimezone` | **PASS** — rejected |
| 5.13 | Signed-out returns guest shape | **PASS** — `tier: guest`, `gentleGuidanceDaily: 0` |
| 5.14 | **Recurring donor remains Free** | **PASS** — `tier: free`, `status: none`, limit 3 |
| 5.15 | `userdata.set` accepts an arbitrary key | **CONFIRMED VULNERABLE** — fails on auth, not validation. This is why entitlement never reads it. |

---

## 6. Build

```
npm run build     → 14 pages, Complete, no errors
git diff --check  → clean
npx convex dev --once → "Convex functions ready" (typecheck passed)
```

---

## 7. Fixtures removed

All Phase 3 and Phase 4 synthetic rows were purged from **dev** using a
temporary `internalMutation` scoped to the fixture id prefixes, which was then
deleted from disk and from the deployment (73 + 1 rows).

Final dev state — `subscriptions`, `billingCustomers`, `billingEvents`,
`usageCounters`, `usageReservations`, `journeySlots`, `accountSettings`,
`giftHistory`, `giftStats`: **0 rows each**.

One fixture had incremented dev's public giving counter (`giftStats`) by $25.00;
that fabricated figure was removed too.

**Production untouched and verified read-only:** prod `giftStats` still holds its
real historical row (2 gifts, $3.00), created long before this work.

---

## 8. Not executed

| Test | Blocked on |
|---|---|
| Authenticated browser-session reserve/finalize/release | signed-in session |
| `setTimezone` rate limit end-to-end | signed-in session (logic verified by inspection) |
| Real day rollover across midnight | wall-clock time; helper verified deterministically |
| Journey UI actually writing `journeySlots` | its own phase — currently unwired |
