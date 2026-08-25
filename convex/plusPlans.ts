/* Canonical plans, and the ONE place that decides whether a Stripe subscription
 * is a Plus purchase.
 *
 * WHY THIS FILE EXISTS (C2)
 * The retired donation flow also used `mode: "subscription"` — a recurring gift
 * and a Plus subscription are structurally identical if you look only at the
 * mode. The Worker's old guard read:
 *
 *     if (obj.mode !== 'subscription') return ok;   // comment claimed this
 *                                                   // excluded recurring gifts
 *
 * It did not. A recurring gift IS mode 'subscription', so a completed gift
 * would have been forwarded as a Plus purchase and granted Plus to a donor who
 * never bought it. The archived sandbox sessions that prove this are kept as
 * permanent negative fixtures in scripts/verify-plus-classification.ts.
 *
 * NEVER evidence of Plus, alone or together:
 *   - mode === "subscription"
 *   - a generic subscription lifecycle event
 *   - a Product display name ("Recurring gift — Declare & Believe" is a
 *     subscription with a friendly name, nothing more)
 *
 * REQUIRED, all of them:
 *   E1  an approved Price id or lookup key
 *   E2  metadata.plan equal to the canonical planKey, consistent with E1
 *   E3  provenance — stamped by our own authenticated Checkout action
 *   E4  the environment matches this runtime
 *
 * DELIBERATELY DEPENDENCY-FREE. No Convex imports, no `v` validators, no fetch.
 * That is what lets the regression suite import and exercise it directly under
 * plain `node`, with no deployment and no credential.
 */

export type PlanKey = "plus_monthly" | "plus_annual";
export type Provider = "stripe" | "app_store";
export type Environment = "sandbox" | "production";

export const PLAN_KEYS: readonly PlanKey[] = ["plus_monthly", "plus_annual"];
export const PROVIDERS: readonly Provider[] = ["stripe", "app_store"];

/* Bumped only when the provenance contract itself changes. A subscription
 * stamped with an older version is not silently accepted. */
export const BILLING_SCHEMA_VERSION = "1";

/* Stamped into metadata by createCheckoutSession. A session we did not create
 * cannot carry this, because nothing else writes it. */
export const CHECKOUT_SOURCE = "convex.billing.createCheckoutSession";

export type PlanDefinition = {
  /* The only plan identifier a browser may submit. Never a Price id. */
  alias: string;
  /* Server-side env var holding the trusted Price id for this environment. */
  envVar: string;
  interval: "month" | "year";
  /* Versioned so a future price change creates _v2 rather than mutating a
   * Price that existing subscribers already hold. */
  lookupKey: string;
};

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  plus_monthly: {
    alias: "plus-monthly",
    envVar: "STRIPE_PLUS_MONTHLY_PRICE_ID",
    interval: "month",
    lookupKey: "plus_monthly_usd_v1",
  },
  plus_annual: {
    alias: "plus-annual",
    envVar: "STRIPE_PLUS_ANNUAL_PRICE_ID",
    interval: "year",
    lookupKey: "plus_annual_usd_v1",
  },
};

export function isPlanKey(x: unknown): x is PlanKey {
  return typeof x === "string" && (PLAN_KEYS as readonly string[]).includes(x);
}

/* Browser-supplied alias -> canonical plan. Only a purchasable plan has an
 * alias, so anything else a browser might name is unrepresentable rather than
 * merely unhandled — there is no branch to reach. */
export function planKeyForAlias(alias: string): PlanKey | null {
  for (const key of PLAN_KEYS) {
    if (PLAN_CATALOG[key].alias === alias) return key;
  }
  return null;
}

function planKeyForLookupKey(lookupKey: string): PlanKey | null {
  for (const key of PLAN_KEYS) {
    if (PLAN_CATALOG[key].lookupKey === lookupKey) return key;
  }
  return null;
}

/* Which environment this runtime is. Derived from the credential itself rather
 * than from a separate env var, so it cannot drift out of sync with the key
 * actually in use: a sandbox key can never claim to be production. */
export function environmentForSecret(secret: string | undefined): Environment | null {
  if (!secret) return null;
  if (secret.startsWith("sk_test_") || secret.startsWith("rk_test_")) return "sandbox";
  if (secret.startsWith("sk_live_") || secret.startsWith("rk_live_")) return "production";
  return null; // unrecognised shape: refuse rather than guess
}

/* priceId -> planKey, from trusted server env. Absent env vars simply yield no
 * approved price, which fails closed. */
export type ApprovedPrices = Record<string, PlanKey>;

export function approvedPricesFromEnv(
  env: Record<string, string | undefined>,
): ApprovedPrices {
  const out: ApprovedPrices = {};
  for (const key of PLAN_KEYS) {
    const priceId = env[PLAN_CATALOG[key].envVar];
    if (priceId) out[priceId] = key;
  }
  return out;
}

export type Classification =
  | { ok: true; planKey: PlanKey }
  | { ok: false; reason: string };

function reject(reason: string): Classification {
  return { ok: false, reason };
}

/* The classification. Every check must pass.
 *
 * `session` is present only for checkout.session.* events. Subscription and
 * invoice events carry no session, which is exactly why the provenance
 * metadata is stamped onto subscription_data.metadata as well — otherwise E2
 * and E3 would have nothing to read on every event after the first. */
export function classifyPlusSubscription(input: {
  subscription: any;
  session?: any | null;
  approvedPrices: ApprovedPrices;
  environment: Environment | null;
}): Classification {
  const { subscription, session, approvedPrices, environment } = input;

  if (!environment) return reject("environment-unresolvable");
  if (!subscription || typeof subscription !== "object") return reject("no-subscription");

  /* ── E1: an approved Price ─────────────────────────────────────────────── */
  const items = subscription.items && subscription.items.data;
  if (!Array.isArray(items) || items.length === 0) return reject("no-subscription-items");
  /* More than one item cannot be a Plus purchase: our Checkout sends exactly
   * one line item. A multi-item subscription is something else entirely. */
  if (items.length > 1) return reject("unexpected-multiple-items");

  const price = items[0] && items[0].price;
  if (!price || typeof price !== "object") return reject("no-price");

  let planFromPrice: PlanKey | null = null;
  if (typeof price.id === "string" && approvedPrices[price.id]) {
    planFromPrice = approvedPrices[price.id];
  } else if (typeof price.lookup_key === "string" && price.lookup_key) {
    planFromPrice = planKeyForLookupKey(price.lookup_key);
  }
  if (!planFromPrice) return reject("price-not-approved");

  /* Subscription metadata wins over session metadata: the subscription is the
   * durable object and the one later events carry. */
  const sessionMeta = (session && typeof session.metadata === "object" && session.metadata) || {};
  const subMeta =
    (typeof subscription.metadata === "object" && subscription.metadata) || {};
  const md: Record<string, any> = { ...sessionMeta, ...subMeta };

  /* ── E2: canonical plan, consistent with the Price ─────────────────────── */
  if (!isPlanKey(md.plan)) return reject("plan-metadata-missing");
  if (md.plan !== planFromPrice) return reject("plan-price-mismatch");

  /* ── E3: provenance ────────────────────────────────────────────────────── */
  if (md.billing_schema_version !== BILLING_SCHEMA_VERSION) {
    return reject("provenance-schema-version");
  }
  if (md.source !== CHECKOUT_SOURCE) return reject("provenance-source");
  if (typeof md.userId !== "string" || !md.userId) return reject("provenance-user-missing");
  /* Only checkable when a session is present, and then it must agree. */
  if (session && session.client_reference_id !== md.userId) {
    return reject("provenance-client-reference-mismatch");
  }

  /* ── E4: environment ───────────────────────────────────────────────────── */
  if (md.environment !== environment) return reject("environment-mismatch");

  return { ok: true, planKey: md.plan };
}

/* Convenience for the webhook path: the userId our own Checkout stamped. Only
 * ever read AFTER classification succeeds, so it is never an attacker-chosen
 * value — an unclassified subscription never reaches this. */
export function stampedUserId(subscription: any, session?: any | null): string | null {
  const subMeta = (subscription && subscription.metadata) || {};
  const sessionMeta = (session && session.metadata) || {};
  const id = subMeta.userId || sessionMeta.userId;
  return typeof id === "string" && id ? id : null;
}
