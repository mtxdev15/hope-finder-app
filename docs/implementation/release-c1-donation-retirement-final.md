# Release C1 — Donation Retirement (final) and Subscription URL Migration

**Status:** implemented locally, **not pushed**, **no production deployment**.
Public Plus Checkout remains inactive and the pricing CTA is non-transactional.

## Decision

The giving product is removed from the application. The only live donation was
the owner's own test, made while signed out, so no donor-facing compatibility
was preserved: no acknowledgement route, no Giving History, no recurring-gift
management.

Financial evidence stays in **Stripe**, which is untouched. See
`release-c1-legacy-giving-retention.md`, including two items that require the
owner and could not be done from here.

## Sales URL structure

```
/pricing        /plus          (English)
/es/precios     /es/plus       (Spanish)
```

One data module and one component pair serve all four. `src/data/plans.ts`
**imports its limits from `convex/entitlementCatalog.ts`** — the same object the
server enforces — so a price page cannot advertise a limit the server does not
apply. Prices and copy live in `plans.ts` because they are sales concerns; the
server has no business knowing what $8.99 is.

Full route table, redirect map, canonical/hreflang and ownership:
`release-c1-public-url-map.md`.

### Two SEO bugs found and fixed during verification

1. **The i18n engine overwrote the server-rendered language.** `i18n.js:53` sets
   `<html lang>` from a cookie, so `/es/precios` shipped `lang="es"` and then
   reverted to `en` in the browser — breaking the hreflang promise that the URL
   *is* the Spanish page. Fixed with a head slot that runs before the engine, on
   all four routes symmetrically.

2. **`/pricing?lang=es` could not redirect.** The same engine consumes `?lang=`
   and strips it via `replaceState` before any page script runs. Moved the hop
   into the pre-engine head slot.

Both were only visible in a browser; the built HTML looked correct.

### Redirect-chain fix

All 28 Spanish static pages linked `/pricing?lang=es`, which would have made
every Spanish link a redirect hop into a query-string URL. Repointed to
`/es/precios`. `/dar` was also repointed from `/es/dar` so the vanity path stays
one hop.

## Subscription legal separation

Plus terms are written **from scratch** on `/plus` and `/es/plus`: billing
interval, automatic renewal, cancellation, and that cancelling never deletes
saved content. The historical donation terms were **not renamed** into
subscription terms — a gift and a paid plan are different transactions and
relabelling one as the other misrepresents both.

Both Terms-of-Service pages now state that a subscription is a payment for
access to a plan, not a donation, and is not tax-deductible.

## Past-due grace — approved

```
convex/entitlementCatalog.ts → PAST_DUE_GRACE_DAYS = 3
```

Named server-side configuration, not a hardcoded assumption. Plus remains
available during grace, `paymentNeedsAttention` is exposed for the billing UI,
content is preserved, and the account resolves to Free once grace expires.
Changing the number requires no schema or feature rewrite.

## Active-Journey wiring

`journeySlots` was inert because the Journey flow never wrote to it. Now:

| Event | Call | Enforcing? |
|---|---|---|
| Start a new Journey | `registerJourneyStart` | **yes** |
| Resume an existing one | `ensureJourneySlot` | **no** |
| Complete | `releaseJourneySlot('completed')` | — |

**Why resume needs a separate, non-enforcing mutation:** a grandfathered user
over the cap must be able to resume. Running the limit check on resume would
refuse to record a Journey they are already inside — losing the slot and
blocking legitimate work. The limit belongs on starting something new, and
nowhere else.

**Slot identity carries the seed** (`catalogId:seed`, mirroring
`reflectClientId`). Restarting a completed Journey is a genuinely new run and
gets a new identity; the bare catalog id would silently re-open the old slot.

All three calls are **fire-and-forget**. Journey progress lives locally and is
the user's real work — a sync failure must never block or lose it.

**The visible limit sheet is deliberately NOT activated.** Enforcement is
recorded server-side and verified, but the UI does not yet block, per the
instruction to keep the sheet off until the integration is reviewed.

## Account UI

The account area now carries subscription concerns only. Giving History, the
lifetime total, the recurring-gift line, the donation portal control and all
`.yg-*` styles are gone, along with seven changelog entries advertising
recurring-gift features that no longer exist.
