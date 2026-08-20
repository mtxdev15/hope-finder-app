# Convex production-parity audit

**Status: audit complete. Source ported, nothing deployed to production.**

Production deployment: `keen-hamster-650`. Audited 2026-08-20, after the three
Journey releases (`93b5b9e`, `c838cbc`, `2dfee66`) and the guardrail merge
(`b304238`).

---

## Why this exists

`main` is not a truthful representation of the backend production is running.
The Spanish Journey work that shipped on 2026-08-20 depends on
`convex/journeyTranslate.ts` and three tables that live in production but not on
`main`. Worse in the other direction: `main` still carries `convex/gifts.ts`,
which production **does not have**, including `clearStats` — a one-command wipe
of the giving tables. A Convex deploy from `main` today would simultaneously
remove behaviour the live frontend uses and restore a destructive function.

Nobody can reproduce production from the default branch, and the default branch
is unsafe to deploy. That is the whole problem.

## How the deployed revision was identified

Not by assumption. `npx convex function-spec --prod` was taken as ground truth
and compared against the source of every candidate branch:

- production exposes **46 functions + 5 HTTP actions** across 10 modules;
- `release-c1-monetization` exports exactly those 46, with **zero**
  production-only functions;
- the only two branch exports missing from the spec are `auth.js:createAuth`
  and `auth.js:authComponent`, which are exported *values*, not Convex
  functions, so they never appear in a function spec;
- production has **no `gifts.js`**, matching that branch and not `main`;
- the last commit touching `convex/` on that branch is **`332e611`**.

**Deployed source: `release-c1-monetization` @ `332e611`.** Every ported file was
then checked byte-for-byte against that revision — all 18 identical.

## Inventory

| Production function/table | Present on main | Source commit | Required for parity | Activation risk |
|---|---|---|---|---|
| `auth.js:getCurrentUser` | yes | `332e611` | no | Live and already on main. |
| `billing.js:createCheckoutSession` | no | `332e611` | yes | Inert. No frontend call site exists in the built bundle; Stripe env vars are unset in production. |
| `billing.js:createPortalSession` | no | `332e611` | yes | Inert. No frontend call site exists in the built bundle; Stripe env vars are unset in production. |
| `entitlements.js:canStartJourney` | no | `332e611` | yes | Inert. No frontend call site in the built bundle. |
| `entitlements.js:getMyEntitlements` | no | `332e611` | yes | Inert. No frontend call site in the built bundle. |
| `entitlements.js:resolveInternal` | no | `332e611` | yes | Inert. No frontend call site in the built bundle. |
| `entitlements.js:setTimezone` | no | `332e611` | yes | Inert. No frontend call site in the built bundle. |
| `journeySlots.js:backfillSlotInternal` | no | `332e611` | yes | Live. Enforcing the active-Journey limit. |
| `journeySlots.js:ensureJourneySlot` | no | `332e611` | yes | Live. Enforcing the active-Journey limit. |
| `journeySlots.js:registerJourneyStart` | no | `332e611` | yes | Live. Enforcing the active-Journey limit. |
| `journeySlots.js:registerJourneyStartInternal` | no | `332e611` | yes | Live. Enforcing the active-Journey limit. |
| `journeySlots.js:releaseJourneySlot` | no | `332e611` | yes | Live. Enforcing the active-Journey limit. |
| `journeySlots.js:releaseJourneySlotInternal` | no | `332e611` | yes | Live. Enforcing the active-Journey limit. |
| `journeyTranslate.js:abandonInternal` | no | `332e611` | yes | Live. The Spanish Journey release depends on it. |
| `journeyTranslate.js:claimInternal` | no | `332e611` | yes | Live. The Spanish Journey release depends on it. |
| `journeyTranslate.js:cleanupInternal` | no | `332e611` | yes | Live. The Spanish Journey release depends on it. |
| `journeyTranslate.js:completeInternal` | no | `332e611` | yes | Live. The Spanish Journey release depends on it. |
| `journeyTranslate.js:finalizeInternal` | no | `332e611` | yes | Live. The Spanish Journey release depends on it. |
| `journeyTranslate.js:readInternal` | no | `332e611` | yes | Live. The Spanish Journey release depends on it. |
| `journeyTranslate.js:releaseInternal` | no | `332e611` | yes | Live. The Spanish Journey release depends on it. |
| `journeyTranslate.js:reserveInternal` | no | `332e611` | yes | Live. The Spanish Journey release depends on it. |
| `journeyTranslate.js:translateJourneyDay` | no | `332e611` | yes | Live. The Spanish Journey release depends on it. |
| `reviews.js:listApprovedPublic` | yes | `332e611` | no | Live and already on main. |
| `reviews.js:myReview` | yes | `332e611` | no | Live and already on main. |
| `reviews.js:submit` | yes | `332e611` | no | Live and already on main. |
| `subscriptions.js:applyWebhook` | no | `332e611` | yes | Inert. Read-only from the frontend and never called; webhook path is internal. |
| `subscriptions.js:getByUserInternal` | no | `332e611` | yes | Inert. Read-only from the frontend and never called; webhook path is internal. |
| `subscriptions.js:getCustomerInternal` | no | `332e611` | yes | Inert. Read-only from the frontend and never called; webhook path is internal. |
| `subscriptions.js:linkCustomer` | no | `332e611` | yes | Inert. Read-only from the frontend and never called; webhook path is internal. |
| `subscriptions.js:mySubscription` | no | `332e611` | yes | Inert. Read-only from the frontend and never called; webhook path is internal. |
| `usage.js:counterInternal` | no | `332e611` | yes | Live. Already enforcing quotas for the translation feature. |
| `usage.js:expireReservationInternal` | no | `332e611` | yes | Live. Already enforcing quotas for the translation feature. |
| `usage.js:finalizeUsage` | no | `332e611` | yes | Live. Already enforcing quotas for the translation feature. |
| `usage.js:finalizeUsageInternal` | no | `332e611` | yes | Live. Already enforcing quotas for the translation feature. |
| `usage.js:releaseUsage` | no | `332e611` | yes | Live. Already enforcing quotas for the translation feature. |
| `usage.js:releaseUsageInternal` | no | `332e611` | yes | Live. Already enforcing quotas for the translation feature. |
| `usage.js:reserveUsage` | no | `332e611` | yes | Live. Already enforcing quotas for the translation feature. |
| `usage.js:reserveUsageInternal` | no | `332e611` | yes | Live. Already enforcing quotas for the translation feature. |
| `userdata.js:getAll` | yes | `332e611` | no | Live and already on main. |
| `userdata.js:set` | yes | `332e611` | no | Live and already on main. |
| `vault.js:addCollection` | yes | `332e611` | no | Live and already on main. |
| `vault.js:list` | yes | `332e611` | no | Live and already on main. |
| `vault.js:listCollections` | yes | `332e611` | no | Live and already on main. |
| `vault.js:remove` | yes | `332e611` | no | Live and already on main. |
| `vault.js:removeCollection` | yes | `332e611` | no | Live and already on main. |
| `vault.js:save` | yes | `332e611` | no | Live and already on main. |
| table `accountSettings` | no | `332e611` | yes | Live table. |
| table `billingCustomers` | no | `332e611` | yes | Live table. |
| table `billingEvents` | no | `332e611` | yes | Live table. |
| table `giftEvents` | yes | `332e611` | no — matches production | Legacy. **Not declared by the deployed schema and not by this branch.** Rows persist untouched; Convex does not drop undeclared tables. |
| table `giftHistory` | yes | `332e611` | no — matches production | Legacy. **Not declared by the deployed schema and not by this branch.** Rows persist untouched; Convex does not drop undeclared tables. |
| table `giftStats` | yes | `332e611` | no — matches production | Legacy. **Not declared by the deployed schema and not by this branch.** Rows persist untouched; Convex does not drop undeclared tables. |
| table `journeySlots` | no | `332e611` | yes | Live table. |
| table `journeyTranslations` | no | `332e611` | yes | Live table. |
| table `reviews` | yes | `332e611` | no | Live table. |
| table `subscriptions` | no | `332e611` | yes | Live table. |
| table `usageCounters` | no | `332e611` | yes | Live table. |
| table `usageReservations` | no | `332e611` | yes | Live table. |
| table `userData` | yes | `332e611` | no | Live table. |
| table `vaultCollections` | yes | `332e611` | no | Live table. |
| table `vaultItems` | yes | `332e611` | no | Live table. |

### HTTP actions

| Route | Present on main | Source commit |
|---|---|---|
| `GET /.well-known/openid-configuration` | yes | `332e611` |
| `GET /api/auth/*` | yes | `332e611` |
| `OPTIONS /api/auth/*` | yes | `332e611` |
| `POST /api/auth/*` | yes | `332e611` |
| `POST /billing/subscription-event` | **no** | `332e611` |

`convex/http.ts` differs between `main` and production; the ported file is the
deployed one.

### Environment-variable names

No environment variable is added or renamed by this branch. The ported source
reads the same names the deployed code already reads. Values are set on the
deployment, not in source, and none were read or written during this audit.

## Scheduled functions

None. Neither deployment registers a cron or scheduled function.

## What was deliberately excluded

- **All frontend monetization.** No pricing, checkout, StoreKit or entitlement
  UI is ported. The built bundle contains **zero** references to
  `createCheckoutSession`, `createPortalSession`, `mySubscription`,
  `getMyEntitlements`, `canStartJourney` or `setTimezone` — verified by grepping
  `dist/`.
- **Everything else on `release-c1-monetization`.** Only `convex/` was touched.
- **The Worker.** `worker/src/index.js` also diverges between `main` and
  production and carries the retired `/give/*` handlers on `main`. That is the
  same class of hazard and is **not** fixed here; recorded as follow-up.

## What was deliberately removed

`convex/gifts.ts`, and the `giftStats` / `giftHistory` / `giftEvents` tables from
`convex/schema.ts` — because production has neither. This is parity, not
deletion: the tables and their rows continue to exist in the production
database, exactly as they do today under the deployed schema, which also does
not declare them.

## No cleanup was applied

Production logic was ported verbatim. Nothing was tidied, renamed, refactored or
"improved" on the way through. Improvements belong in `TODO.md`, not in a parity
port, because a parity port whose behaviour differs is not a parity port.
