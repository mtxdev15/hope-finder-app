/* Declare & Believe — the storefront pricing source of truth.
 *
 * ONE module owns every customer-visible price, for every tier, on every
 * storefront. Nothing else may hardcode an amount: a price written twice is a
 * price that will eventually disagree with itself, and the copy the customer
 * reads will not be the copy that gets charged.
 *
 * TWO DELIBERATE DESIGN RULES
 *
 * 1. AMOUNTS ARE INTEGER CENTS. Never floats. `8.99 * 12` is not exactly
 *    107.88 in IEEE-754, and a savings line derived from that drifts by a cent
 *    at the worst possible moment — on a page about money. Every figure here is
 *    computed in cents and formatted only at the edge.
 *
 * 2. DERIVED FIGURES ARE COMPUTED, NEVER TYPED. Monthly-equivalent, annual
 *    savings and savings percentage are all functions of the two prices. Typing
 *    "save $27.89" by hand is how a page ends up claiming a discount that the
 *    arithmetic does not support.
 *
 * ENTITLEMENT IS NOT PRICING. This file describes what a plan COSTS. What a
 * plan GRANTS lives in convex/entitlementCatalog.ts and is enforced
 * server-side. A customer gets the same Plus entitlement whether they bought
 * through Stripe on the web or Apple on iOS; only the price differs by
 * storefront. Nothing here grants anything.
 *
 * NO PRIVATE IDENTIFIERS. Stripe Price ids are server-only secrets resolved
 * from environment variables in convex/billing.ts. This module ships to the
 * browser and carries only the public plan ALIAS.
 */

export type PlanTier = "free" | "plus" | "family" | "church";
export type Storefront = "web" | "ios";
export type BillingInterval = "monthly" | "annual";
export type Availability = "available" | "opening-soon" | "coming-soon" | "contact";

export interface StorefrontPrice {
  tier: PlanTier;
  storefront: Storefront;
  interval: BillingInterval;
  currency: "USD";
  /** Integer cents. null = no price (Free, or contact-based). */
  amountCents: number | null;
  /** The intended standard price once founding pricing ends. Integer cents. */
  futureStandardCents?: number;
  availability: Availability;
  /** Hard gate. Nothing in the UI may start a purchase while this is false. */
  checkoutEnabled: boolean;
  /** Public alias the browser may submit; the server maps it to a Price id. */
  stripePlanAlias?: string;
  /** Planned only. No StoreKit product exists yet. */
  storeKitProductId?: string;
}

/* ── Storefront catalogue ────────────────────────────────────────────────────
 * Founding prices are the launch prices. `futureStandardCents` is what we
 * intend to charge later — it is NOT a "was" price, because it was never
 * offered. See referencePriceLabel() for how it may be shown. */

export const PRICES: StorefrontPrice[] = [
  // Free — same everywhere, costs nothing, always available.
  { tier: "free", storefront: "web", interval: "monthly", currency: "USD", amountCents: 0, availability: "available", checkoutEnabled: false },
  { tier: "free", storefront: "ios", interval: "monthly", currency: "USD", amountCents: 0, availability: "available", checkoutEnabled: false },

  // Plus — web. Checkout stays OFF until the coordinated launch.
  { tier: "plus", storefront: "web", interval: "monthly", currency: "USD",
    amountCents: 899, futureStandardCents: 1099,
    availability: "opening-soon", checkoutEnabled: false, stripePlanAlias: "plus-monthly" },
  { tier: "plus", storefront: "web", interval: "annual", currency: "USD",
    amountCents: 7999, futureStandardCents: 9999,
    availability: "opening-soon", checkoutEnabled: false, stripePlanAlias: "plus-annual" },

  // Plus — iOS. Planning values. No StoreKit product exists; ids are proposed.
  { tier: "plus", storefront: "ios", interval: "monthly", currency: "USD",
    amountCents: 999, availability: "coming-soon", checkoutEnabled: false,
    storeKitProductId: "plus_monthly" },
  { tier: "plus", storefront: "ios", interval: "annual", currency: "USD",
    amountCents: 8999, availability: "coming-soon", checkoutEnabled: false,
    storeKitProductId: "plus_annual" },

  // Family — not built. Aliases are PREPARED but deliberately absent, so no
  // client can submit one and no server path can resolve it.
  { tier: "family", storefront: "web", interval: "monthly", currency: "USD",
    amountCents: 1499, futureStandardCents: 1799,
    availability: "coming-soon", checkoutEnabled: false },
  { tier: "family", storefront: "web", interval: "annual", currency: "USD",
    amountCents: 14999, futureStandardCents: 17999,
    availability: "coming-soon", checkoutEnabled: false },
  { tier: "family", storefront: "ios", interval: "monthly", currency: "USD",
    amountCents: 1699, availability: "coming-soon", checkoutEnabled: false,
    storeKitProductId: "family_monthly" },
  { tier: "family", storefront: "ios", interval: "annual", currency: "USD",
    amountCents: 16999, availability: "coming-soon", checkoutEnabled: false,
    storeKitProductId: "family_annual" },

  // Church — custom, contact-based. No automated purchase on any storefront.
  { tier: "church", storefront: "web", interval: "monthly", currency: "USD",
    amountCents: null, availability: "contact", checkoutEnabled: false },
];

export function priceFor(
  tier: PlanTier,
  storefront: Storefront,
  interval: BillingInterval,
): StorefrontPrice | undefined {
  return PRICES.find(
    (p) => p.tier === tier && p.storefront === storefront && p.interval === interval,
  );
}

/* ── Derived figures ─────────────────────────────────────────────────────────
 * All computed from the two stored prices, in cents. */

export interface AnnualSavings {
  /** 12 x the monthly price — the honest comparison basis. */
  yearAtMonthlyCents: number;
  savingsCents: number;
  /** Annual price divided by 12, rounded to the nearest cent. */
  monthlyEquivalentCents: number;
  /** Rounded to a whole percent for display. */
  savingsPercent: number;
}

/* The savings basis is 12 x MONTHLY, never the future standard price. Comparing
 * against a price nobody has ever paid would manufacture a discount that does
 * not exist. */
export function annualSavings(
  tier: PlanTier,
  storefront: Storefront,
): AnnualSavings | null {
  const m = priceFor(tier, storefront, "monthly");
  const a = priceFor(tier, storefront, "annual");
  if (!m?.amountCents || !a?.amountCents) return null;
  const yearAtMonthlyCents = m.amountCents * 12;
  const savingsCents = yearAtMonthlyCents - a.amountCents;
  return {
    yearAtMonthlyCents,
    savingsCents,
    monthlyEquivalentCents: Math.round(a.amountCents / 12),
    savingsPercent: Math.round((savingsCents / yearAtMonthlyCents) * 100),
  };
}

/* ── Formatting ──────────────────────────────────────────────────────────────
 * Locale-aware, so a Spanish reader sees Spanish conventions. The NUMBERS are
 * identical across languages — only their presentation is localized. There is
 * deliberately no second set of Spanish prices. */
export function formatUSD(cents: number, lang: "en" | "es" = "en"): string {
  return new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/* ── Reference-price honesty ─────────────────────────────────────────────────
 * A future standard price may be shown ONLY as a forward-looking statement.
 * "Was $10.99" / "Normally $10.99" would be false: $10.99 has never been
 * charged to anyone. The label must say what the figure actually is. */
export const REFERENCE_PRICE_KIND = "future-standard" as const;

/* ── Storefront disclosure ───────────────────────────────────────────────────
 * Restrained and factual. It does not mention Apple's cut, does not steer
 * anyone to the web to "save", and does not editorialise about platform
 * economics — that is our business problem, not the reader's. */
export const STOREFRONT_DISCLOSURE = {
  en: "Prices may vary when purchased through an app store.",
  es: "Los precios pueden variar si compras a través de una tienda de aplicaciones.",
};

/* Every customer-visible amount used by the sales pages, precomputed once so a
 * page never does arithmetic inline. */
export function webPlanSummary(lang: "en" | "es" = "en") {
  const pm = priceFor("plus", "web", "monthly")!;
  const pa = priceFor("plus", "web", "annual")!;
  const fm = priceFor("family", "web", "monthly")!;
  const fa = priceFor("family", "web", "annual")!;
  const ps = annualSavings("plus", "web")!;
  const fs = annualSavings("family", "web")!;
  const f = (c: number) => formatUSD(c, lang);
  return {
    plus: {
      monthly: f(pm.amountCents!),
      annual: f(pa.amountCents!),
      monthlyEquivalent: f(ps.monthlyEquivalentCents),
      savings: f(ps.savingsCents),
      savingsPercent: ps.savingsPercent,
      futureStandardMonthly: f(pm.futureStandardCents!),
      futureStandardAnnual: f(pa.futureStandardCents!),
      checkoutEnabled: pm.checkoutEnabled || pa.checkoutEnabled,
    },
    family: {
      monthly: f(fm.amountCents!),
      annual: f(fa.amountCents!),
      monthlyEquivalent: f(fs.monthlyEquivalentCents),
      savings: f(fs.savingsCents),
      savingsPercent: fs.savingsPercent,
      availability: fm.availability,
    },
  };
}
