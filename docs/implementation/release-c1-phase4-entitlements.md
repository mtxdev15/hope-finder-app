> **Historical — predates the 2026-08-25 billing work.** Written before the live
> Stripe catalog existed and before `plus_lifetime` was added. It still lists
> **Family** and **Church**, which were removed from the product entirely on
> 2026-08-25. Current sources: `TODO.md` → *Next up*,
> `docs/operations/billing-secret-topology.md`,
> `docs/architecture/cross-platform-subscriptions.md`.

# Release C1 Phase 4 — entitlement decisions

**Status: APPROVED 2026-08-20 by Jeff (JC Kingdom Ventures, LLC).**

`convex/entitlementCatalog.ts` has cited this file for sign-off since Phase 4 was
written, but the file did not exist — so `PAST_DUE_GRACE_DAYS = 3` was running in
code with no recorded approval anywhere. That gap was found during the Stage 2
audit and is closed here.

---

## 1. Failed-payment grace window — the decision this file exists for

**Approved: 3 days.**

```
convex/entitlementCatalog.ts
  export const PAST_DUE_GRACE_DAYS = 3;
```

When Stripe reports `past_due` or `unpaid`, the account keeps Plus for 3 days
past the end of the period they last paid for, while Stripe retries the card.
After that it resolves to Free.

**Why 3 days.** A failed retry is usually a bank hiccup or an expired card, not
a decision to stop paying. Dropping someone out of Plus the moment a retry fails
is the wrong default for an app people reach for at 3am. Three days is long
enough to cover a weekend and a card update, short enough that it is not a free
month.

**What it never does.** Losing Plus caps what an account may do next. It never
deletes anything already saved. No reflection, Journey, vault entry or card is
removed by any billing transition.

`paymentNeedsAttention` is exposed to the UI throughout the window, so the
person can be asked to fix billing without a hard stop.

### Fallback when Stripe gives us no period end

Grace runs from `currentPeriodEnd`. If that field is missing, it runs from
`updatedAt` — when we last heard about them — so a missing field cannot grant an
unbounded free ride.

## 2. Status → tier

| Provider status | Resolves to | Notes |
|---|---|---|
| `active` | **plus** | |
| `trialing` | **plus** | The 7-day trial (`TRIAL_DAYS`, added 2026-08-26) unlocks everything, so a trialist is a Plus user in every respect. Also covers manually-created state |
| `active` + `cancel_at_period_end` | **plus** through `currentPeriodEnd` | They paid for the period. Taking it early would be theft |
| `past_due` / `unpaid` | **plus** for 3 days, then **free** | `paymentNeedsAttention: true` throughout |
| `canceled`, anything else | **free** | |

Resolution runs across **every** provider the account holds, and the most
generous result wins. See `docs/architecture/cross-platform-subscriptions.md`.

## 3. Commercial decisions confirmed

| Decision | Value |
|---|---|
| Plus monthly | **$8.99 USD** |
| Plus annual | **$79.99 USD** |
| Both ship in sandbox | yes |
| Trial | **none** |
| Cancellation timing | **at period end** |
| Monthly ↔ annual switching | **disabled initially** |
| Proration | **none initially** (follows from switching being disabled) |
| Failed-payment grace | **3 days** (§1) |
| Free | permanent, no card |
| Family | Coming Soon — no entitlement tier, no price, on any provider |
| Church and groups | custom / contact |
| Donations | retired |

Family and Church are deliberately **absent** from `entitlementCatalog.ts`
rather than defined-and-unused, so nothing can resolve to them by accident
before their seat model is designed.

## 4. Tax — intentionally deferred

**Tax calculation is intentionally deferred during sandbox billing
development.** For this phase:

```
currency        usd
tax_behavior    exclusive
automatic_tax   false
product tax code  NOT SET
```

Customer address collection is **not** required for tax at this stage.

**Before live charging**, review with an accountant or tax professional:

- Stripe Tax monitoring and what it does and does not cover
- the business's **home-state** obligations — physical presence creates nexus
  immediately, with no threshold, and Stripe explicitly does **not** monitor
  your home state or country
- applicable **economic-nexus thresholds**, which vary by jurisdiction
- non-US obligations: several jurisdictions require registration from the
  **first** transaction, with no threshold at all
- the correct **product tax code**. Two candidates were identified from Stripe's
  live tax-code list during Stage 2, and the choice between them is a tax
  determination rather than an engineering one:
  - `txcd_10103000` — Software as a service (SaaS), personal use
  - `txcd_10105001` — AI as a Service (AIaaS), cloud based, personal use
- registrations in every location where an obligation exists

### A number that must not be encoded anywhere

**"$10,000 means no tax is owed" is false and must never appear in this
codebase.** Stripe's threshold figures are *notification triggers* tied to
specific jurisdictions, not a universal registration threshold. Thresholds vary,
several jurisdictions have none, and the home state is never monitored at all.

`tax_behavior: exclusive` is set on the Prices at creation and is not freely
editable afterwards. It means $8.99 is the price and tax would be added on top
when tax is eventually enabled — the normal US model. If inclusive pricing is
ever needed, the versioned lookup keys (`plus_monthly_usd_v1`) allow a `_v2`
Price rather than mutating one that existing subscribers hold.

## 5. Related

- `convex/entitlementCatalog.ts` — the one place a limit is a number
- `convex/entitlements.ts` — the resolver
- `convex/plusPlans.ts` — canonical plans and Plus classification
- `docs/architecture/cross-platform-subscriptions.md` — provider neutrality
- `scripts/verify-plus-classification.ts` — the regression suite
