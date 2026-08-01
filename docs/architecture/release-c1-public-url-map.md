# Release C1 — Public URL Map

Final monetization URL structure after donation retirement.

## Public, indexable (in sitemap)

| Route | Purpose | Auth | Indexable | Canonical | Redirect source | Alternate | Owner |
|---|---|---|---|---|---|---|---|
| `/pricing` | Plan comparison, EN | none | yes | self | `/give`, `/give-terms`, `/pricing?lang=es`→ES | es `/es/precios`, x-default self | `src/pages/pricing.astro` → `PricingBody.astro` |
| `/es/precios` | Plan comparison, ES | none | yes | self | `/es/dar`, `/dar`, `/es/terminos-de-donacion` | en `/pricing`, x-default `/pricing` | `src/pages/es/precios.astro` → `PricingBody.astro` |
| `/plus` | Plus detail + **subscription terms**, EN | none | yes | self | — | es `/es/plus`, x-default self | `src/pages/plus.astro` → `PlusBody.astro` |
| `/es/plus` | Plus detail + subscription terms, ES | none | yes | self | — | en `/plus`, x-default `/plus` | `src/pages/es/plus.astro` → `PlusBody.astro` |

All four render from **one** component pair and **one** data module
(`src/data/plans.ts`), which imports its limits from
`convex/entitlementCatalog.ts` — the same object the server enforces. There is
no second copy of the plan table and no duplicated entitlement logic.

**Language is pinned by URL.** Each route declares its language in a head script
that runs *before* the i18n engine, which otherwise derives language from a
cookie and overwrites `<html lang>`. Without the pin, an English URL opened with
a Spanish cookie renders English copy under `lang="es"` with Spanish chrome —
incoherent to read and a contradiction of the hreflang promise.

**No automatic browser-language redirect exists.** Only an explicit, stale
`?lang=es` is hopped.

## Private / non-indexable (never in sitemap)

| Route | Purpose | Auth | Indexable | Owner |
|---|---|---|---|---|
| `/checkout/success` | Post-checkout confirmation; polls server truth | required to show a plan | **noindex** | `src/pages/checkout/success.astro` |
| `/checkout/cancelled` | "Nothing was charged" | none | **noindex** | `src/pages/checkout/cancelled.astro` |
| `/you` | Account: profile, settings, plan | required | **noindex** (pre-existing) | `src/pages/you.astro` |
| `/signin`, `/create-account` | Auth shells | none | noindex | existing |

## Redirect map — every hop is permanent and single

| From | To | Status | Note |
|---|---|---|---|
| `/give` | `/pricing` | 301 | includes `?status=success`/`?status=cancelled`; Cloudflare Pages does not match query strings, so all variants land here |
| `/es/dar` | `/es/precios` | 301 | **direct**, not via `/pricing?lang=es` — that would be a chain |
| `/dar` | `/es/precios` | 301 | was `/dar → /es/dar`; repointed so the vanity path stays one hop |
| `/give-terms` | `/pricing` | 301 | |
| `/es/terminos-de-donacion` | `/es/precios` | 301 | |
| `/pricing?lang=es` | `/es/precios` | client-side `replace()` | Cloudflare cannot match query strings; runs before i18n consumes `?lang=` |

**No chains.** `/es/dar` reaches Spanish pricing in one hop. **No loops** — every
target is a terminal page.

## Removed URLs

`/give`, `/es/dar`, `/give-terms`, `/es/terminos-de-donacion` no longer exist as
pages. They are absent from the sitemap and 301 rather than 404, so existing
inbound links and any search equity land somewhere useful.
