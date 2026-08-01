# Release C1 — Donation Retirement (final): Verification

**Deployment:** Convex **dev** `good-dotterel-906` only. **Production
`keen-hamster-650` was never written to** — verified read-only afterwards: it
holds **none** of the Phase 3/4 functions. No Cloudflare deploy. Not pushed.

**Scripts that exist in `package.json`:** `dev`, `build`, `preview`, `astro`.
**There is no lint, test, typecheck or E2E script.** None was run, none claimed.
TypeScript is not installed locally; the only typecheck is Convex's on push.

---

## 1. Pre-removal production verification (read-only)

| Table | Rows | Finding |
|---|---|---|
| `giftHistory` | **0** | no gift linked to ANY user |
| `giftStats` | 1 | aggregate: 2 gifts, $3.00 |
| `giftEvents` | 2 | one backfill marker, one live session id |

**No record belongs to another person, because no record belongs to any person.**
No full payment identifier is reproduced here.

**Not verifiable from this environment:** whether the test created a recurring
Stripe subscription, and whether it is still active. No Stripe key is reachable
(Worker secret only). Nothing was cancelled — ownership could not be verified.
Escalated in `release-c1-legacy-giving-retention.md`.

---

## 2. Routes and rendering (browser, 390×844)

| # | Test | Result |
|---|---|---|
| 2.1 | `/pricing` renders English, `lang=en` | **PASS** |
| 2.2 | `/es/precios` renders Spanish, `lang=es` | **PASS** |
| 2.3 | `/plus` renders English, `lang=en` | **PASS** |
| 2.4 | `/es/plus` renders Spanish, `lang=es` | **PASS** |
| 2.5 | `/pricing?lang=es` → `/es/precios` | **PASS** |
| 2.6 | Plus CTA non-transactional (disabled) | **PASS** |
| 2.7 | No Stripe reference on `/pricing` | **PASS** |
| 2.8 | No Giving History card on `/you` | **PASS** |
| 2.9 | No giving/gift/donation copy on `/you` | **PASS** |
| 2.10 | `/you` no JS errors | **PASS** |
| 2.11 | `/journey` loads with slot wiring, no errors | **PASS** |

### Two bugs found here and fixed

- **2.2/2.4 failed first**: the i18n engine overwrote server-rendered
  `<html lang>` from a cookie. Fixed with a pre-engine head slot.
- **2.5 failed first**: the engine consumed `?lang=` and stripped it before any
  page script ran. Moved the hop ahead of the engine.
- **2.3 then failed**: `/plus` inherited a Spanish cookie from the previous test
  and rendered English copy under `lang="es"`. Fixed by pinning language on the
  English routes symmetrically.

All three were invisible in the built HTML and only appeared in a real browser.

---

## 3. SEO

| Check | Result |
|---|---|
| All four sales routes built | **PASS** |
| Self-referencing canonical on each | **PASS** |
| Reciprocal `hreflang` en/es on each | **PASS** |
| `x-default` → `/pricing` (or `/plus`) on each | **PASS** |
| All four indexable (no `noindex`) | **PASS** |
| `/checkout/success`, `/checkout/cancelled` `noindex` | **PASS** |
| Sitemap `<loc>` contains no donation URL | **PASS** |
| Sitemap contains all four sales URLs | **PASS** |
| No query-string language variant in sitemap | **PASS** (only in an explanatory comment) |
| No internal link to `/give`, `/es/dar`, `/give-terms`, `/es/terminos-de-donacion` | **PASS** |
| No internal link to `/pricing?lang=es` | **PASS** — 26 Spanish pages repointed to `/es/precios` |
| Spanish content server-rendered (not client-swapped) | **PASS** |
| Redirects are single-hop, no chains or loops | **PASS** by inspection of `_redirects` |

---

## 4. Donation removal

| Check | Result |
|---|---|
| `give.html`, `es/dar.html`, both terms pages absent from build | **PASS** |
| `give.js`, `give.css`, `give-globe.js` absent from build | **PASS** |
| No active donation form or CTA anywhere | **PASS** |
| Worker: all four `/give/*` routes → 410 | **PASS** (verified locally in Phase 3 for three; the fourth added here) |
| `handleWebhook` deleted; shared signature verification retained | **PASS** |
| `gifts.js` / `giving.js` absent from the deployment | **PASS** — function spec lists neither |
| Gift tables removed from schema | **PASS** |
| Client gift helpers removed | **PASS** |

---

## 5. Subscription regression

| Check | Result |
|---|---|
| No subscription → Free, 3 guidance / 2 Journeys | **PASS** |
| Active subscription → Plus, no visible quota | **PASS** |
| Phase 3/4 functions all still deployed (30) | **PASS** |
| Subscription/billing/entitlement tables untouched | **PASS** |
| No Gentle Guidance model call introduced | **PASS** |

---

## 6. Active Journeys (newly wired)

| # | Test | Result |
|---|---|---|
| 6.1 | Free starts Journey 1 | **PASS** |
| 6.2 | Free starts Journey 2 | **PASS** |
| 6.3 | Free blocked from Journey 3 | **PASS** — `active-journey-limit` |
| 6.4 | Completing frees a slot | **PASS** |
| 6.5 | Restart with a new seed is a NEW identity | **PASS** — correctly blocked at cap rather than silently reusing the old slot |
| 6.6 | Plus exceeds 2 | **PASS** — 4 active, limit `null` |
| 6.7 | Resume does not duplicate a slot | **PASS** — `ensureJourneySlot` idempotent |
| 6.8 | Another account cannot affect the count | **PASS** |

Verified through the `*Internal` twins, which share one core function with the
public mutations. Browser-session paths need a signed-in session and were not
exercised; that limitation is stated rather than glossed.

---

## 7. Build

```
npm run build     → 17 pages, Complete, no errors
git diff --check  → clean
node --check worker/src/index.js → valid
npx convex dev --once → typecheck passed
```

---

## 8. Fixtures

All synthetic dev rows purged (10 in the final pass). Dev now holds 0 rows in
`subscriptions`, `billingCustomers`, `billingEvents`, `usageCounters`,
`usageReservations`, `journeySlots`, `accountSettings`. The temporary cleanup
mutation was deleted from disk and from the deployment.

---

## 9. Not done — requires the owner

1. **Cancel the recurring test gift in Stripe**, if one exists. Cannot verify
   ownership or cancel without a Stripe key. Removing the webhook does **not**
   stop a charge.
2. **Delete the 3 production Convex gift rows**, then deploy — in that order,
   or the deploy fails schema validation. Doing it from here would have required
   deploying the unreviewed subscription backend to production.
