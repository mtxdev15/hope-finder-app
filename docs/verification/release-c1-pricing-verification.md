# Release C1 — Pricing Verification

**Scope:** pricing architecture and presentation. **No payment was activated**,
no Stripe Product or Price created, no StoreKit product created, no deployment.

**Scripts that exist in `package.json`:** `dev`, `build`, `preview`, `astro`.
**There is no lint, test, typecheck or E2E script**, so none was run and none is
claimed. Calculations were verified by executing the shipped module directly.

---

## 1. Calculations — 25/25 against the shipped module

Executed `src/data/pricing.ts` and asserted every derived figure:

| Plan | Monthly | Annual | Save | Per month | % |
|---|---|---|---|---|---|
| Plus web | $8.99 ✅ | $79.99 ✅ | $27.89 ✅ | $6.67 ✅ | 26% ✅ |
| Family web | $14.99 ✅ | $149.99 ✅ | $29.89 ✅ | $12.50 ✅ | 17% ✅ |
| Plus iOS | $9.99 ✅ | $89.99 ✅ | $29.89 ✅ | $7.50 ✅ | 25% ✅ |
| Family iOS | $16.99 ✅ | $169.99 ✅ | $33.89 ✅ | $14.17 ✅ | 17% ✅ |

Also asserted:

- **savings basis is 12 × monthly** ($107.88), not the future standard price
- `checkoutEnabled: false` on **every** price in the catalogue
- **no Family Stripe alias exists** (`plus-monthly`, `plus-annual` only)
- **no `price_` identifier** anywhere in the client-visible config

**Float-drift note:** all arithmetic is integer cents. `8.99 * 12` in IEEE-754
is not exactly `107.88`, and deriving a savings line from that would have been
wrong by a cent on a page about money.

---

## 2. Rendered pages — 36/36 across both languages

`/pricing` (en) and `/es/precios` (es), monthly and annual:

| Check | EN | ES |
|---|---|---|
| Monthly shows $8.99 | ✅ | ✅ |
| **Not** $8.97 | ✅ | ✅ |
| Future standard $10.99 shown | ✅ | ✅ |
| **No "Was/Previously/Normally" framing** | ✅ | ✅ |
| Annual $79.99 | ✅ | ✅ |
| Monthly equivalent $6.67 | ✅ | ✅ |
| Savings $27.89 | ✅ | ✅ |
| Savings 26% | ✅ | ✅ |
| Annual future standard $99.99 | ✅ | ✅ |
| Best-value badge on annual only | ✅ | ✅ |
| Family planned $14.99 / $149.99 | ✅ | ✅ |
| Family Coming Soon | ✅ | ✅ |
| Storefront disclosure present | ✅ | ✅ |
| No platform-economics editorialising | ✅ | ✅ |
| Plus CTA disabled | ✅ | ✅ |
| **No Stripe/billing request on click** | ✅ | ✅ |
| No false urgency or scarcity | ✅ | ✅ |
| `<html lang>` correct | ✅ | ✅ |

---

## 3. Accessibility — 8/9

| Check | Result |
|---|---|
| Toggle is a labelled `radiogroup` | **PASS** |
| Each control announces `aria-checked` | **PASS** |
| Roving tabindex — exactly one tab stop | **PASS** |
| ArrowRight selects annual and moves focus | **PASS** |
| Touch targets ≥ 44×44 (91×44, 83×44) | **PASS** |
| Disabled CTA has explanatory text | **PASS** |
| Disabled CTA does not take focus | **PASS** |
| Savings stated in words, not colour alone | **PASS** |
| Exactly one `<h1>` | **FAIL — pre-existing, see below** |
| FAQ summary ≥ 44px, Enter opens | **PASS** |
| Compare table scrolls in its own container | **PASS** |

**The one failure is not this work.** `public/declare/route-loader.js:48` injects
`<h1>Searching the Word…</h1>` at runtime on **every** page — `/today` and
`/vault` show the same duplicate. The built `/pricing` HTML contains exactly one
`<h1>`. Fixing it means changing a shared loader that affects every route, which
is outside pricing scope. **Recorded as a known pre-existing issue rather than
silently absorbed or silently ignored.**

Touch targets needed a real fix: padding alone left the toggle at ~36px, below
the 44px WCAG 2.5.5 minimum. `min-height`/`min-width` were added.

---

## 4. Price-duplication audit

Before: `src/data/plans.ts` held float constants, and
`public/declare/i18n-strings.js:298` hardcoded `'$79.99 … $27.89'` in Spanish —
a genuine second source that would drift.

After: `src/data/pricing.ts` is the only place an amount is written. `plans.ts`
imports it, the components consume precomputed values, and the duplicated
Spanish string was removed. Grep confirms **zero** hardcoded price literals
outside the source module and historical documentation.

---

## 5. Security

- no raw Stripe Price id accepted or shipped
- no browser-supplied user id, tier or entitlement
- pricing display grants nothing; verified webhook state remains billing truth
- `checkoutEnabled: false` everywhere; clicking the CTA issues no request
- no StoreKit code exists yet, so no unverified transaction can be trusted
- entitlement continues to read no `userData` and no gift table

---

## 6. Routes and build

`npm run build` → **17 pages**, `git diff --check` clean. All four sales routes
build; `/give` and `/es/dar` redirects unchanged; no donation copy returned.

---

## 7. Approved-copy implementation

48 checks across both languages, all passing: hero, kicker, Free heading/CTA/note,
Plus heading and chain, Family heading and planned-feature list, Church heading
and custom-pricing label, compare table (7 rows, scoped col and row headers),
no-trial section, 8 FAQ items, commitment statement, and the computed 26% on the
annual toggle.

Conditional rules verified: **no waitlist button** (none exists) and Contact Us
resolving to a real `mailto:` path.

### Errors caught by rendering rather than reading the diff

1. **Hero kicker landed below the supporting paragraph**, not above it.
2. **Old Family and Church descriptions survived** alongside their replacements,
   duplicating the message.
3. **The entire new CSS block silently no-oped** — several string replacements
   assumed 4-space indentation where the file uses 2. The sections rendered
   *unstyled* while content assertions still passed. Caught only by asserting
   **computed styles** (FAQ summary height, `overflow-x` on the table wrapper),
   not markup presence.

That third one is the durable lesson: a content test can pass against a page
that looks broken. Style assertions are not optional.

Two apparent failures were harness artifacts, not defects: `text-transform:
uppercase` means `innerText` returns "NO TRIAL COUNTDOWN" and "PRÓXIMAMENTE",
so exact-case regexes missed them. Re-verified case-insensitively.

---

## 8. Not verified here

- Real Stripe Checkout (no Product, Price or key configured — by design)
- StoreKit pricing (no product exists; iOS must render StoreKit-localized prices
  at runtime, never these USD planning values)
- Native es-LA editorial review of the Spanish copy
- Fee assumptions, which must be reverified against current Stripe and Apple
  terms before activation
