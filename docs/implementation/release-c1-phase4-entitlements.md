# Release C1 Phase 4 — Entitlements and Usage Counters

**Status:** implemented locally, **not pushed**. No production deployment.
**Scope:** server-authoritative entitlement resolution and metering. Nothing
customer-facing is activated: Gentle Guidance does not exist, the Journey limit
sheet is a later phase, and the pricing CTA remains non-transactional.

---

## 1. The finding that shaped this phase

Journey progress lives in `localStorage` and is mirrored into Convex `userData`
by `account-sync.js`. `convex/userdata.ts:31` `set({key, value})` is a **public
mutation accepting an arbitrary key and an arbitrary value**.

Verified: calling it with `key: "db_journey_lock"` fails on **authentication**,
not on validation — the arbitrary key passes. So any signed-in browser can write
its own Journey state in one console call.

**Consequence:** active-Journey enforcement cannot read `userData`. Doing so
would be security theatre — the number being enforced would be a number the user
controls, blocking honest users while letting anyone who opens a console
straight past. Phase 4 therefore introduces a dedicated server-authoritative
`journeySlots` table, and entitlement counts that and nothing else.

**Honest consequence of the honest fix:** the Journey UI does not call these
mutations yet (wiring it is its own reviewed phase), so the trusted active count
is currently 0 for everyone and the limit is inert. That is the correct failure
mode — an unwired limit lets people through; a forged one is worse than none.

---

## 2. Entitlement catalog — `convex/entitlementCatalog.ts`

One module. No limit is written anywhere else — a limit in two places is a limit
that will disagree with itself, and the version the customer sees will not be
the version enforced.

| | Guest | Free | Plus |
|---|---|---|---|
| `gentleGuidanceDaily` | `0` | `3` | `null` |
| `activeJourneys` | `null` (no account entitlement) | `2` | `null` |
| `collections` | `null` | `null` | `null` |
| `imageCards` | `null` | `null` | `null` |
| `monthlyNewJourneys` | `null` | `null` | `null` |

**`null` means no customer-visible quota — not infinity.** Invisible safety,
abuse, concurrency and service-stability protections still apply and are
deliberately kept *out* of this catalog, so raising a product limit can never
accidentally raise an abuse ceiling.

Guest `gentleGuidanceDaily: 0` encodes "may see it, must sign in before consent
or submission". Guest `activeJourneys: null` means no *account* entitlement —
guests are device-local.

**Family and Church are absent, not defined-and-unused**, so nothing can resolve
to them before their seat model exists. The catalog has room for `seats`,
`features`, trials, grace, overrides and promotional access.

The catalog is **code, not data** — there is no write path for a client to
reach.

---

## 3. Resolver — `convex/entitlements.ts`

`getMyEntitlements` takes **no arguments**, so there is nothing to point at
another account. It returns:

```json
{
  "tier": "free",
  "subscriptionStatus": "none",
  "paymentNeedsAttention": false,
  "graceEndsAt": null,
  "accountDay": "2026-08-01",
  "timezone": "UTC",
  "limits": { "gentleGuidanceDaily": 3, "activeJourneys": 2, ... },
  "usage": { "gentleGuidanceToday": 1, "activeJourneys": 1 },
  "remaining": { "gentleGuidanceToday": 2, "activeJourneySlots": 1 }
}
```

Inputs are exclusively trusted: identity from context, subscription from the
webhook-written `subscriptions` table, usage from `usageCounters`, Journeys from
`journeySlots`. It never reads localStorage, `userData`, a browser-submitted
plan or user id, a Stripe redirect parameter, or pricing-page state.

`remaining` is `null` wherever the limit is `null` — never a number, so no
caller can mistake "no quota" for "quota of 0".

---

## 4. Subscription interpretation

| Stripe status | Tier | `paymentNeedsAttention` | Notes |
|---|---|---|---|
| none | free | false | |
| `active` | **plus** | false | |
| `trialing` | **plus** | false | No trial advertised or configured. Honoured if legacy/manual state exists rather than silently downgraded. |
| `active` + `cancelAtPeriodEnd`, period remaining | **plus** | false | They paid for the period; taking it early would be theft |
| `active` + `cancelAtPeriodEnd`, period elapsed | free | false | |
| `past_due` within grace | **plus** | **true** | |
| `past_due` past grace | free | **true** | |
| `unpaid` within / past grace | plus / free | **true** | |
| `canceled` | free | false | |
| anything else | free | false | |

**Verified against the dev deployment — all nine branches.**

**Content is never deleted by any transition.** Not reflections, Vault items,
Journeys, images, collections or Giving History. Losing Plus caps what you can
do next; it never removes what you already have.

---

## 5. Grace period — **awaiting product approval**

```
PAST_DUE_GRACE_DAYS = 3
```

**This is a product setting, not a silently chosen default.** A failed card
retry is usually a bank hiccup or an expired card, and dropping someone out of
Plus the moment a retry fails is the wrong default for an app people reach for
at 3am. Grace runs from the end of the period they last paid for; when Stripe
gives no period end it falls back to when we last heard about the subscription,
so a missing field cannot grant an unbounded free ride.

`paymentNeedsAttention` is exposed separately so the UI can ask someone to fix
billing without a hard stop.

**Please confirm 3 days, or specify a different value.**

---

## 6. Account day and timezone — `convex/accountDay.ts`

The repo had two disagreeing helpers: `journey.astro:520` builds a **non-padded
local** date (`2026-8-1`), `index.astro:354` uses a **UTC ISO slice**
(`2026-08-01`). Neither is usable for entitlement — one is unpadded, both are
computed on a device the user controls. This module replaces both for anything
that counts.

- Computed **server-side**; a browser-provided date key is never trusted.
- Uses the account's stored **IANA** timezone, UTC when absent.
- **DST-correct**, because `Intl` resolves the wall-clock date in the zone
  rather than applying a fixed offset. Verified across the 2026-03-08 US
  spring-forward: the calendar day is stable across the jump.
- **Monotonic per account.** The day key may never move backwards.

The monotonic rule is the security-relevant one. Without it, someone at 11pm in
New York could switch to a zone where it is already tomorrow, collect a fresh
allowance, then switch back for another. Clamping to the highest day the account
has ever reached makes a spent allowance impossible to rewind, whatever the
timezone claims.

Second layer: `setTimezone` is rate-limited to **one change per 24 hours**
(`TIMEZONE_CHANGE_MIN_INTERVAL_MS`). A genuine traveller changes zones far less
often. IP-derived timezone is **not** used as entitlement or billing truth.

Verified: UTC / New York / London / Kiritimati (UTC+14) all resolve correctly at
`2026-08-01T03:30Z`; the clamp refuses `2026-07-31` when the account has reached
`2026-08-01`, and accepts `2026-08-02`.

---

## 7. Usage counters and reservations — `convex/usage.ts`

**The problem:** "check, then work, then increment" is a race. Three concurrent
requests all read "2 used" and all proceed, and a 3-per-day allowance quietly
serves five. So a request takes its slot **before** the work starts.

```
reserveUsage(feature, requestId)  -> takes a slot, or refuses
finalizeUsage(requestId)          -> the slot becomes a consumed use
releaseUsage(requestId, reason)   -> the slot returns, nothing consumed
```

`usageCounters` is keyed by **(userId, feature, accountDay)** with `used`,
`reserved`, `successful`, `failed`. The limit check reads `used + reserved`, so
in-flight requests count — otherwise concurrency defeats the quota.

Convex mutations are transactional and serialized per document, so the
read-modify-write inside one mutation is atomic. That is what makes this safe
without an explicit lock.

**`requestId` is an idempotency key scoped per user.** Reserving twice with the
same key returns the same reservation rather than taking a second slot, so a
retried network call cannot cost two uses. A key that is already finalized or
released is refused rather than silently reissued.

### What must NOT consume an allowance

Failure, malformed response, service unavailable, **crisis routing**,
support-required routing, and a cancellation that reaches the server. Callers
signal these with `releaseUsage` instead of `finalizeUsage`.

Only `reason: "failed"` or `"malformed"` increments the `failed` tally.
**Crisis routing is not a failure and must never look like one** — someone in
crisis must never be charged a daily use for being routed to help.

### Expiry

Every reservation carries `expiresAt` (`RESERVATION_TTL_MS`, 5 minutes).
Expired holds are reclaimed **lazily** on the next reserve for that
(user, feature, day). Lazy is deliberate: it needs no scheduler, and the only
person affected by a stale hold is the one about to make the next request — who
is exactly who triggers the sweep.

> **Bug found and fixed during verification.** The first implementation marked
> the expired *reservation row* released but never decremented the counter's
> `reserved` tally — which is what the limit check actually reads. The TTL was
> cosmetic: a crashed process still consumed the allowance for the rest of the
> day, precisely what the expiry exists to prevent. Caught because the test
> asserted the *next reservation succeeds*, not merely that the row changed.

---

## 8. Active Journeys — `convex/journeySlots.ts`

**"Active" means:** started, and not yet completed or archived.

Not counted: completed, archived, deleted (row removed), and abandoned cache
entries the product does not treat as resumable. The product currently treats a
started-but-unfinished Journey as resumable, so it counts — the honest reading
of the data model rather than the convenient one.

### Grandfathering

A Free user already over the limit **keeps every Journey**. Nothing is
force-completed, force-archived or deleted. They may open, continue, complete
and archive all of them; they simply cannot **start another** until they are
back at or under the cap.

This falls out of the design rather than needing special handling:
`registerJourneyStart` is the only thing that checks the limit, and it is only
called when starting something new. Existing rows are never re-validated.
`backfillSlotInternal` records pre-existing Journeys without a limit check —
backfill records reality, it does not judge it.

**Verified:** a user backfilled with 4 active Journeys keeps all 4, cannot start
a 5th, and can still open and complete the existing ones.

---

## 9. Client APIs

| Exposed | Notes |
|---|---|
| `entitlements.getMyEntitlements` | no arguments |
| `entitlements.canStartJourney` | no arguments, stable reason codes |
| `entitlements.setTimezone` | validated, rate-limited, self-only |
| `usage.reserveUsage` / `finalizeUsage` / `releaseUsage` | identity from context |
| `journeySlots.registerJourneyStart` / `releaseJourneySlot` | identity from context |

**Not exposed:** tier mutation, usage mutation, arbitrary user lookup, another
account's entitlement, raw Stripe identifiers. Errors are stable codes
(`daily-limit-reached`, `active-journey-limit`, `timezone-change-too-soon`), not
server-written English.

Each public mutation is a thin auth wrapper over a shared core function, with an
`internalMutation` twin for trusted server code that has already resolved
identity. **One code path**, so the browser route and the server route cannot
drift apart on something as load-bearing as a quota check.

---

## 10. Future Worker interface

Gentle Guidance will be metered like this:

```
resolve entitlement
  → usage.reserveUsageInternal(userId, 'gentleGuidance', requestId)
  → process guidance
  → finalizeUsageInternal on a valid normal response
  → releaseUsageInternal on failure / crisis / support routing / cancellation
```

The Worker still cannot verify Better Auth identity. The recommendation stands:
run the metered call from a **Convex action** that resolves identity and then
calls the internal mutations, rather than adding token verification to the
Worker and creating a second auth implementation to keep in sync.

---

## 11. Deferred to later phases

- Journey UI calling `registerJourneyStart` / `releaseJourneySlot`, plus the
  grandfathering backfill
- The customer-facing limit sheet (explicitly not activated)
- Gentle Guidance itself: model call, crisis classification, consent UI
- Public Plus checkout activation and the transactional pricing CTA
