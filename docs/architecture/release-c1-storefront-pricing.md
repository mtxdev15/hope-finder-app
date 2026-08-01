# Release C1 — Storefront Pricing Architecture

## Source of truth

`src/data/pricing.ts` owns every customer-visible amount, for every tier, on
every storefront. `src/data/plans.ts` is the **copy layer** — it decides what
words wrap the numbers, never what the numbers are — and imports both:

```
convex/entitlementCatalog.ts  ──> what a plan GRANTS (server-enforced)
src/data/pricing.ts           ──> what a plan COSTS
                                        │
                                        ▼
                              src/data/plans.ts  (copy, EN + ES)
                                        │
                    ┌───────────────────┴───────────────────┐
            PricingBody.astro                        PlusBody.astro
                    │                                        │
        /pricing  /es/precios                       /plus  /es/plus
```

Four routes, one data source, no second copy of a price or a limit.

### Two rules the module exists to enforce

**1. Integer cents, never floats.** `8.99 * 12` is not exactly `107.88` in
IEEE-754. A savings line derived from float arithmetic drifts by a cent at the
worst possible moment — on a page about money. Everything is computed in cents
and formatted only at the edge.

**2. Derived figures are computed, never typed.** Monthly-equivalent, annual
savings and savings percentage are all functions of the two stored prices.
Typing "save $27.89" by hand is how a page ends up claiming a discount the
arithmetic does not support.

### Shape

```ts
interface StorefrontPrice {
  tier: "free" | "plus" | "family" | "church";
  storefront: "web" | "ios";
  interval: "monthly" | "annual";
  currency: "USD";
  amountCents: number | null;      // integer cents
  futureStandardCents?: number;    // forward-looking, never a "was" price
  availability: "available" | "opening-soon" | "coming-soon" | "contact";
  checkoutEnabled: boolean;        // hard gate — false everywhere today
  stripePlanAlias?: string;        // PUBLIC alias only
  storeKitProductId?: string;      // planned only
}
```

**No private identifiers ship to the browser.** Stripe Price ids are server-only,
resolved from environment variables inside `convex/billing.ts`. This module
carries only the public alias. Verified: no `price_` string appears anywhere in
the client config.

---

## Stripe

| Alias | State |
|---|---|
| `plus-monthly` | present, mapped server-side to `STRIPE_PLUS_MONTHLY_PRICE_ID` |
| `plus-annual` | present, mapped server-side to `STRIPE_PLUS_ANNUAL_PRICE_ID` |
| `family-monthly` | **prepared but deliberately absent** |
| `family-annual` | **prepared but deliberately absent** |

Family aliases are documented but **not defined in code**, so no client can
submit one and no server path can resolve one. That is stronger than defining
them and rejecting them.

The browser submits only an alias. The server maps alias → Price id. A raw
`price_...` from the client is rejected. Pricing display grants nothing;
verified webhook state remains the only source of billing truth.

---

## StoreKit (planned — nothing activated)

Proposed product identifiers, following the bundle convention:

```
plus_monthly    plus_annual
family_monthly  family_annual
```

Required before any iOS purchase ships:

- read the **localized** price and currency from StoreKit, never a hardcoded
  display string — the amounts in this module are USD web/planning values and
  must not be rendered as iOS prices
- verify transactions **server-side** against Apple; never trust a client
  receipt
- support restore purchases
- synchronize entitlement to the authenticated account, so the same person is
  Plus on both platforms
- distinguish billing source, and never ask an active web subscriber to pay
  again on iOS, or an Apple subscriber to pay again on the web

Account UI should support billing-source labels conceptually equal to
*"Billed through Declare & Believe"* and *"Billed through Apple"*, without
exposing raw payment identifiers.

---

## Internal fee planning — ASSUMPTIONS, reverify before activation

**Internal only. Never shown to customers.** Every figure below is an assumption
and must be reverified against current Stripe and Apple terms before payments
are switched on.

Assumed: Stripe 2.9% + $0.30 per transaction. Apple 30% standard, 15% under the
Small Business Program (and after 12 months of paid subscription).

| Plan | Price | Assumed fee | Assumed net |
|---|---|---|---|
| Plus web monthly | $8.99 | ~$0.56 | ~$8.43 |
| Plus web annual | $79.99 | ~$2.62 | ~$77.37 |
| Plus iOS monthly (15%) | $9.99 | ~$1.50 | ~$8.49 |
| Plus iOS monthly (30%) | $9.99 | ~$3.00 | ~$6.99 |
| Plus iOS annual (15%) | $89.99 | ~$13.50 | ~$76.49 |
| Plus iOS annual (30%) | $89.99 | ~$27.00 | ~$62.99 |

Annual is materially better on both storefronts: one fee instead of twelve on
web, and Apple's rate drops after twelve months — which annual reaches in a
single transaction.

**Excluded from these figures:** taxes, refunds, disputes and chargebacks,
international card fees, currency conversion, Apple's tax handling, AI usage
cost, infrastructure cost, customer-support cost.

**Fee calculations must never influence entitlement.** What a customer receives
is decided by `convex/entitlementCatalog.ts` and verified subscription state —
never by margin.

---

## Localization

One numeric source; only presentation is localized. `formatUSD()` uses
`Intl.NumberFormat` with `es-US` for Spanish, so conventions follow the reader
while the amounts stay identical across languages. There is deliberately **no
second set of Spanish prices** — a duplicated Spanish savings string was removed
from `i18n-strings.js` for exactly this reason.

Spanish copy is marked **NEEDS NATIVE es-LA EDITORIAL REVIEW**.
