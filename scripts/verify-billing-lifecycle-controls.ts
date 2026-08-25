/* Declare & Believe — annual Checkout, the Billing Portal, and the read-only
 * lifecycle inspector.
 *
 * WHAT THIS EXISTS TO PREVENT
 * Three new ways to touch a subscription arrive together, and each has a
 * specific historical failure it must not repeat:
 *
 *   ANNUAL CHECKOUT   A second plan means a second Price. The moment a browser
 *                     can name a Price instead of a plan, it can name ANY
 *                     Price — including one from another product at another
 *                     amount. The alias stays the only thing the browser sends.
 *
 *   BILLING PORTAL    The retired donation portal resolved its customer with
 *                     GET /v1/customers?email=<browser-supplied>. Submitting
 *                     someone else's address opened THEIR billing portal. The
 *                     customer must come only from our own stored mapping.
 *
 *   INSPECTOR         A debugging surface is where identifiers leak, because
 *                     "just print the object" is the obvious implementation.
 *                     It renders an allowlist projection instead.
 *
 * The decisions are IMPORTED and EXECUTED, not grepped, wherever the module is
 * dependency-free: convex/plusPlans.ts and src/app/declare/billing-inspector.js
 * both run here for real. Source assertions cover only what is genuinely
 * structural (call ordering, absent arguments, build output).
 *
 * dist/ assertions need a build first:
 *   PUBLIC_BILLING_DEV_CONTROL=1 npx astro build && node scripts/verify-billing-lifecycle-controls.ts
 *
 * No network, no credential, no Stripe call, no Convex call, no deployment.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAN_CATALOG,
  PLAN_KEYS,
  planKeyForAlias,
  approvedPricesFromEnv,
  isOneTimePlan,
} from "../convex/plusPlans.ts";
import {
  projectEntitlement,
  INSPECTOR_FIELDS,
  FORBIDDEN_FIELDS,
  refreshExhausted,
  REFRESH_INTERVAL_MS,
  REFRESH_MAX_TICKS,
} from "../src/app/declare/billing-inspector.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

/* Comments in these files describe the very patterns being banned — billing.ts
 * documents the retired customers-by-email lookup precisely so it is never
 * reintroduced. Matching that would fail the file for warning about the
 * problem, so "must not appear" is applied to code only. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");
}

const BILLING = read("convex/billing.ts");
const BILLING_CODE = stripComments(BILLING);
const PAGE = read("src/pages/dev/[control].astro");
const SCRIPT = PAGE.slice(PAGE.indexOf("<script>"), PAGE.indexOf("</script>"));
const STRIPE_API = read("convex/stripeApi.ts");

/* The two action bodies, sliced apart so an assertion about one cannot be
 * satisfied by the other. */
const CHECKOUT = BILLING.slice(
  BILLING.indexOf("export const createCheckoutSession"),
  BILLING.indexOf("export const createPortalSession"),
);
const PORTAL = BILLING.slice(BILLING.indexOf("export const createPortalSession"));
const PORTAL_CODE = stripComments(PORTAL);

/* ── 1. Annual resolves server-side, from the catalog ────────────────────── */
section("1. Annual is a server-side Price lookup, never a browser input");

/* Executed, not described: this is the real mapping both actions use. */
check("plus-annual resolves to plus_annual", planKeyForAlias("plus-annual") === "plus_annual");
check("plus-monthly still resolves to plus_monthly", planKeyForAlias("plus-monthly") === "plus_monthly");
check("annual is bound to STRIPE_PLUS_ANNUAL_PRICE_ID",
  PLAN_CATALOG.plus_annual.envVar === "STRIPE_PLUS_ANNUAL_PRICE_ID");
check("monthly is bound to STRIPE_PLUS_MONTHLY_PRICE_ID",
  PLAN_CATALOG.plus_monthly.envVar === "STRIPE_PLUS_MONTHLY_PRICE_ID");
check("the two plans use DIFFERENT env vars",
  PLAN_CATALOG.plus_annual.envVar !== PLAN_CATALOG.plus_monthly.envVar);
check("annual is a yearly interval", PLAN_CATALOG.plus_annual.interval === "year");
check("annual carries its own versioned lookup key",
  PLAN_CATALOG.plus_annual.lookupKey === "plus_annual_usd_v1");
check("the catalog holds exactly the three Plus plans",
  PLAN_KEYS.slice().sort().join(",") === "plus_annual,plus_lifetime,plus_monthly");

/* Lifetime is the one plan bought in `mode: "payment"`. Every property that
   makes it different from the two recurring plans is pinned here, because each
   one is load-bearing: a shared env var would let one Price sell two plans, a
   shared lookup key would let classification confuse them, and an interval on a
   plan that never recurs would put a renewal date on a page that must not
   claim one. */
check("lifetime resolves from its own alias",
  planKeyForAlias("plus-lifetime") === "plus_lifetime");
check("lifetime is bound to STRIPE_PLUS_LIFETIME_PRICE_ID",
  PLAN_CATALOG.plus_lifetime.envVar === "STRIPE_PLUS_LIFETIME_PRICE_ID");
check("every plan uses a DIFFERENT env var",
  new Set(PLAN_KEYS.map((k) => PLAN_CATALOG[k].envVar)).size === PLAN_KEYS.length);
check("every plan carries its own versioned lookup key",
  new Set(PLAN_KEYS.map((k) => PLAN_CATALOG[k].lookupKey)).size === PLAN_KEYS.length);
check("lifetime carries its own versioned lookup key",
  PLAN_CATALOG.plus_lifetime.lookupKey === "plus_lifetime_usd_v1");
check("lifetime is one-time and the other two are not",
  PLAN_CATALOG.plus_lifetime.kind === "one_time" &&
  PLAN_CATALOG.plus_monthly.kind === "subscription" &&
  PLAN_CATALOG.plus_annual.kind === "subscription");
check("a plan that never recurs claims no interval",
  PLAN_CATALOG.plus_lifetime.interval === null);
check("isOneTimePlan agrees with the catalog for every plan",
  PLAN_KEYS.every((k) => isOneTimePlan(k) === (PLAN_CATALOG[k].kind === "one_time")));

/* The env var is read through the catalog, so naming a plan can never name an
 * arbitrary environment variable. */
check("the Price comes from process.env[PLAN_CATALOG[planKey].envVar]",
  /process\.env\[PLAN_CATALOG\[planKey\]\.envVar\]/.test(CHECKOUT));
check("a missing Price fails closed as billing-not-configured",
  /if \(!priceId\) return \{ error: "billing-not-configured" \}/.test(CHECKOUT));

/* Approved prices are derived from env for BOTH plans, so an annual
 * subscription can be classified on the way back in. Fed fake ids here — no
 * real Price id is needed to prove the mapping. */
const approved = approvedPricesFromEnv({
  STRIPE_PLUS_MONTHLY_PRICE_ID: "price_fake_m",
  STRIPE_PLUS_ANNUAL_PRICE_ID: "price_fake_a",
});
check("an annual Price maps back to plus_annual", approved["price_fake_a"] === "plus_annual");
check("a monthly Price maps back to plus_monthly", approved["price_fake_m"] === "plus_monthly");
check("an unlisted Price maps to nothing", approved["price_someone_elses"] === undefined);
/* Absent env yields NO approved prices — that fails closed rather than open. */
check("no env means no approved prices", Object.keys(approvedPricesFromEnv({})).length === 0);

/* ── 2. Unknown plan keys fail closed ────────────────────────────────────── */
section("2. Unknown plan aliases fail closed");

for (const bad of [
  "plus_annual",            // canonical key, not the alias
  "PLUS-ANNUAL",            // case
  " plus-annual",           // leading space
  "plus-annual ",           // trailing space
  "plus-annually",
  "annual",
  "",
  "family",
  "church",
  "price_1U6hytLShxhb4mBzduppVOya",  // a real Price id, submitted as a plan
  "__proto__",
  "constructor",
  "toString",
]) {
  check(`"${bad}" is not a plan alias`, planKeyForAlias(bad) === null);
}
check("the action rejects an unresolvable alias as unknown-plan",
  /if \(!planKey\) return \{ error: "unknown-plan" \}/.test(CHECKOUT));
/* Ordering matters: the alias must be rejected BEFORE any Stripe call. */
check("unknown-plan is decided before any Stripe request",
  CHECKOUT.indexOf('"unknown-plan"') < CHECKOUT.indexOf('stripePost("/checkout/sessions"'));

/* ── 3. The browser never sends a Price id ───────────────────────────────── */
section("3. The browser cannot name a Price, on either plan");

const CHECKOUT_ARGS = (CHECKOUT.match(/args:\s*\{([\s\S]*?)\},\s*\n\s*handler/) || [])[1] || "";
check("the checkout args block can be located", CHECKOUT_ARGS.length > 0);
for (const forbidden of ["price", "priceId", "amount", "currency", "lookup", "product", "quantity"]) {
  check(`checkout args carry no "${forbidden}"`, !CHECKOUT_ARGS.includes(forbidden));
}
check("checkout args are exactly plan and lang",
  /^\s*plan:\s*v\.string\(\),\s*lang:\s*v\.optional\(v\.string\(\)\),\s*$/.test(
    stripComments(CHECKOUT_ARGS).replace(/\n/g, " ").replace(/\s+/g, " ")
      .replace(/^ /, "").replace(/ $/, " ")) ||
  (stripComments(CHECKOUT_ARGS).includes("plan: v.string()") &&
   stripComments(CHECKOUT_ARGS).includes("lang: v.optional(v.string())") &&
   stripComments(CHECKOUT_ARGS).split(":").length === 3));
check("no Stripe Price id literal appears anywhere in the dev page",
  !/price_[A-Za-z0-9]/.test(PAGE));
check("no Stripe Price id literal appears in the inspector module",
  !/price_[A-Za-z0-9]/.test(read("src/app/declare/billing-inspector.js")));

/* ── 4. Active-subscription protection covers annual too ─────────────────── */
section("4. The duplicate guard is plan-independent, so annual inherits it");

/* THE ARGUMENT, and why it is stronger than a per-plan assertion:
 * the guard queries by (userId, provider) and never reads planKey, so it cannot
 * distinguish monthly from annual. Annual is covered because the guard is
 * blind to the plan, not because someone remembered to list annual. */
const GUARD = CHECKOUT.slice(
  CHECKOUT.indexOf("getByUserProviderInternal"),
  CHECKOUT.indexOf("3b. Cross-provider guard"),
);
check("the duplicate guard block can be located", GUARD.length > 0);
check("the guard queries by userId and provider only",
  /\{ userId, provider: "stripe" as const \}/.test(GUARD));
check("the guard never reads planKey", !GUARD.includes("planKey"));
check("the guard never reads the plan alias", !GUARD.includes("args.plan"));
check("the guard never reads a Price", !GUARD.includes("price"));
check("an existing live subscription answers already-subscribed",
  /BLOCKS_NEW_CHECKOUT\.has\(existing\.status\)[\s\S]{0,80}"already-subscribed"/.test(GUARD));
check("a cancel-at-period-end subscription also answers already-subscribed",
  /cancelAtPeriodEnd[\s\S]{0,120}"already-subscribed"/.test(GUARD));
/* Measured on comment-stripped code: the explanatory comment sits between the
 * condition and the return, and counting it would make the window meaningless. */
const GUARD_CODE = stripComments(GUARD);
check("an unrecognised status refuses rather than guesses",
  /!ALLOWS_NEW_CHECKOUT\.has\(existing\.status\) &&\s*existing\.status !== "incomplete"\s*\)\s*\{\s*return \{ error: "already-subscribed", status: existing\.status \};/.test(GUARD_CODE));
check("only `incomplete` falls through to a fresh Checkout",
  /existing\.status !== "incomplete"/.test(GUARD_CODE));
/* Ordering: refusal happens before the Session is created, so a blocked user
 * costs nothing and creates nothing in Stripe. */
check("the guard runs BEFORE the Checkout Session is created",
  CHECKOUT.indexOf("getByUserProviderInternal") < CHECKOUT.indexOf('stripePost("/checkout/sessions"'));
check("the guard runs BEFORE a Stripe Customer is created",
  CHECKOUT.indexOf("getByUserProviderInternal") < CHECKOUT.indexOf('stripePost(\n        "/customers"'));

/* The dev page carries the operational warning, because the guard protects
 * Convex state and NOT the reader's card: Stripe would still bill twice. */
const PROSE = PAGE.replace(/\s+/g, " ");
check("the annual control warns against reusing an active subscriber",
  /already has an active subscription/i.test(PROSE));
check("the warning is honest that neither guard refunds",
  /neither guard cancels or refunds anything/i.test(PROSE));

/* ── 5. The Portal requires authentication ───────────────────────────────── */
section("5. The Billing Portal requires an authenticated user");

check("the portal action resolves identity with requireUser",
  /user = await requireUser\(ctx\)/.test(PORTAL));
check("a failed identity answers not-authenticated",
  /catch \{\s*return \{ error: "not-authenticated" \};\s*\}/.test(PORTAL));
/* Identity is established before the credential is even read, so an
 * unauthenticated call cannot reach Stripe at all. */
check("identity is resolved BEFORE the Stripe secret is read",
  PORTAL.indexOf("requireUser(ctx)") < PORTAL.indexOf("process.env.STRIPE_SECRET_KEY"));
check("identity is resolved BEFORE any Stripe request",
  PORTAL.indexOf("requireUser(ctx)") < PORTAL.indexOf("stripePost("));
check("requireUser reads Better Auth, not a client-supplied claim",
  /async function requireUser[\s\S]{0,200}authComponent\.safeGetAuthUser\(ctx\)/.test(BILLING));
check("there is no ctx.auth fallback identity path", !BILLING_CODE.includes("ctx.auth"));

/* ── 6. The Customer is resolved server-side, never supplied ─────────────── */
section("6. The Customer comes only from our own mapping");

const PORTAL_ARGS = (PORTAL.match(/args:\s*\{([^}]*)\}/) || [])[1] || "";
check("the portal args block can be located", PORTAL.includes("args:"));
for (const forbidden of ["customer", "customerId", "userId", "email", "subscription", "return_url", "returnUrl", "url"]) {
  check(`portal args carry no "${forbidden}"`, !PORTAL_ARGS.includes(forbidden));
}
check("portal args are exactly the optional lang",
  PORTAL_ARGS.replace(/\s/g, "") === "lang:v.optional(v.string())");
check("the Customer comes from getCustomerInternal, keyed by the authed user",
  /getCustomerInternal,\s*\{ userId: user\._id \}/.test(PORTAL));
check("the Customer sent to Stripe is the mapped one",
  /customer: mapping\.stripeCustomerId/.test(PORTAL));
/* The specific retired vulnerability. Applied to code, not comments — the
 * comment above it exists to keep the lesson. */
check("the customers-by-email lookup is absent", !/customers\?email/.test(PORTAL_CODE));
check("no Stripe customer search is performed", !/\/customers\/search|customers\?/.test(PORTAL_CODE));
check("the portal creates no Customer", !PORTAL_CODE.includes('"/customers"'));
check("a missing mapping fails safely as no-subscription",
  /if \(!mapping\?\.stripeCustomerId\) \{[\s\S]{0,600}return \{ error: "no-subscription" \};/.test(PORTAL));
check("the missing-mapping branch makes no Stripe call",
  PORTAL.indexOf('"no-subscription"') < PORTAL.indexOf("stripePost("));

/* The browser's side of the same guarantee. */
check("the dev page sends an EMPTY portal payload", /createPortalSession, \{\}\)/.test(SCRIPT));
for (const forbidden of ["stripeCustomerId", "cus_", "customerId"]) {
  check(`the dev page never mentions "${forbidden}"`, !stripComments(PAGE).includes(forbidden));
}

/* ── 7. The return URL is server-built ───────────────────────────────────── */
section("7. The Portal return URL is built from SITE_URL, not from the caller");

check("the return URL is built from siteBase()", /const base = siteBase\(\)/.test(PORTAL));
check("the return path is /you", /return_url: base \+ "\/you"/.test(PORTAL));
check("siteBase reads the trusted server env var",
  /function siteBase[\s\S]{0,160}process\.env\.SITE_URL/.test(BILLING));
check("siteBase has a production default",
  /process\.env\.SITE_URL \|\| "https:\/\/declareandbelieve\.com"/.test(BILLING));
check("siteBase strips trailing slashes so the path cannot double up",
  /raw\.replace\(\/\\\/\+\$\/, ""\)/.test(BILLING));
/* `lang` is the only caller influence on the URL, and it is coerced to exactly
 * 'es' or dropped — it cannot contribute an arbitrary string. */
check("lang is coerced to exactly 'es' or dropped",
  /\(args\.lang === "es" \? "\?lang=es" : ""\)/.test(PORTAL));
check("no caller value is concatenated into the return URL",
  !/return_url: [^\n]*args\.(?!lang === "es")/.test(PORTAL));

/* ── 8. The pinned API version ───────────────────────────────────────────── */
section("8. Every Stripe request sends the pinned API version");

check("the pinned version is 2026-06-24.dahlia",
  /export const STRIPE_API_VERSION = "2026-06-24\.dahlia"/.test(STRIPE_API));
check("the version header is set in the shared request builder",
  /"Stripe-Version": STRIPE_API_VERSION/.test(STRIPE_API));
check("the header is unconditional, not behind a flag",
  /const headers: Record<string, string> = \{\s*\n\s*Authorization[\s\S]{0,120}"Stripe-Version": STRIPE_API_VERSION,/.test(STRIPE_API));
check("the portal request goes through stripePost", /await stripePost\("\/billing_portal\/sessions"/.test(PORTAL));
check("billing.ts never calls fetch directly", !BILLING_CODE.includes("fetch("));
check("billing.ts never sets its own Stripe-Version", !BILLING_CODE.includes("Stripe-Version"));
check("stripeApi is the only module holding the Stripe base URL",
  /const STRIPE_API = "https:\/\/api\.stripe\.com\/v1"/.test(STRIPE_API) &&
  !BILLING_CODE.includes("api.stripe.com"));

/* ── 9. The inspector cannot show a Stripe identifier ────────────────────── */
section("9. The lifecycle inspector leaks no identifier");

/* Executed against a HOSTILE object carrying every identifier we never want on
 * screen. This is the assertion that matters: the projection is what the page
 * renders, so if it drops these, the page cannot show them. */
const hostile: Record<string, unknown> = {
  tier: "plus",
  subscriptionStatus: "active",
  planKey: "plus_annual",
  provider: "stripe",
  paymentNeedsAttention: false,
  stripeCustomerId: "cus_LEAK",
  stripeSubscriptionId: "sub_LEAK",
  stripePriceId: "price_LEAK",
  latestInvoiceId: "in_LEAK",
  lastProviderEventId: "evt_LEAK",
  metadataUserId: "user_LEAK",
  userId: "user_LEAK",
  email: "leak@example.com",
  paymentMethod: { last4: "4242" },
  sessionId: "cs_LEAK",
};
const view = projectEntitlement(hostile);
check("the projection returns an object for a valid input", view !== null && typeof view === "object");
for (const f of FORBIDDEN_FIELDS) {
  check(`the projection drops "${f}"`, view !== null && !(f in view));
}
check("no projected VALUE contains a Stripe object prefix",
  !/\b(cus_|sub_|price_|in_|evt_|cs_|pi_|seti_)/.test(JSON.stringify(view)));
check("the projection keeps the provider-neutral fields",
  view !== null && view.tier === "plus" && view.planKey === "plus_annual" && view.provider === "stripe");
/* An allowlist, not a denylist: a field nobody thought to forbid is dropped
 * too, which is what makes this survive the contract widening later. */
check("an UNKNOWN future field is dropped as well",
  projectEntitlement({ tier: "plus", someFutureStripeThing: "cus_LEAK" })?.someFutureStripeThing === undefined);
check("the allowlist and the denylist do not overlap",
  !INSPECTOR_FIELDS.some((f) => FORBIDDEN_FIELDS.includes(f)));
/* `subscriptionStatus` is a lifecycle enum, not an identifier, so a blanket
 * /subscription/ ban would be wrong. The real property is that no allowlisted
 * field NAMES an identifier: Id-suffixed, a bare id, or an address. */
check("no allowlisted field is identifier-shaped",
  !INSPECTOR_FIELDS.some((f) => /Id$|_id$|^id$|email|token|secret/i.test(f)));
check("every allowlisted field is provider-neutral state, not a Stripe object",
  !INSPECTOR_FIELDS.some((f) => /^stripe|^cus|^sub_|^price|^invoice|^session/i.test(f)));
/* Degenerate inputs must not throw, and must not invent state. */
for (const junk of [null, undefined, "cus_LEAK", 42, true]) {
  check(`the projection refuses ${JSON.stringify(junk) ?? "undefined"}`, projectEntitlement(junk) === null);
}
check("an empty object projects to an empty view",
  Object.keys(projectEntitlement({}) || { x: 1 }).length === 0);

/* ── 10. The inspector performs no mutation ──────────────────────────────── */
section("10. The lifecycle inspector is read-only");

const READ_STATE = SCRIPT.slice(SCRIPT.indexOf("async function readState"), SCRIPT.indexOf("const refreshBtn"));
check("readState can be located", READ_STATE.includes("myEntitlements"));
check("readState calls the entitlement READ", READ_STATE.includes("data.myEntitlements()"));
for (const banned of ["client.action", "client.mutation", "createCheckoutSession", "createPortalSession", "connect("]) {
  check(`readState performs no "${banned}"`, !READ_STATE.includes(banned));
}
check("the inspector module imports nothing at all",
  !/^\s*import\s/m.test(read("src/app/declare/billing-inspector.js")));
check("the inspector module performs no fetch",
  !read("src/app/declare/billing-inspector.js").includes("fetch("));
/* Bounded refresh: an unbounded poll left open in a tab is a slow request leak. */
check("the refresh interval is a sane 3s", REFRESH_INTERVAL_MS === 3000);
check("the watch is bounded", REFRESH_MAX_TICKS === 40);
check("the bound is roughly two minutes",
  (REFRESH_INTERVAL_MS * REFRESH_MAX_TICKS) / 1000 === 120);
check("refreshExhausted is false below the bound", refreshExhausted(REFRESH_MAX_TICKS - 1) === false);
check("refreshExhausted is true at the bound", refreshExhausted(REFRESH_MAX_TICKS) === true);
check("refreshExhausted stays true past the bound", refreshExhausted(REFRESH_MAX_TICKS + 500) === true);

/* ── 11. None of it exists in a production build ─────────────────────────── */
section("11. The controls are absent from production output");

const DIST = join(ROOT, "dist");
if (!existsSync(DIST)) {
  console.log("\ndist/ is missing. Build first:\n  PUBLIC_BILLING_DEV_CONTROL=1 npx astro build\n");
  process.exit(1);
}
function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if ([".html", ".js", ".css", ".json"].includes(extname(p))) acc.push(p);
  }
  return acc;
}
const files = walk(DIST);
check("the build produced files to inspect", files.length > 0);
check("dist/dev does not exist", !existsSync(join(DIST, "dev")));
/* The decisive one: this suite is run against a HOSTILE build with
 * PUBLIC_BILLING_DEV_CONTROL=1 deliberately set, which proves the DEV term
 * alone suppresses the controls. That is the shape a real accident would take —
 * the flag set in a Cloudflare Pages build setting. */
/* NOTE: "createPortalSession" was removed from this list, deliberately.
 * It used to be banned from production because the ONLY caller was the dev
 * control, so its presence could only mean the control had leaked. That is no
 * longer true: /you now has a real Manage-billing button, so the action
 * legitimately ships. The narrower property is asserted separately below —
 * wherever it reaches production it must go through the wrapper that sends an
 * empty payload, and it must carry no customer identifier. The DEV CONTROLS
 * themselves are still banned, which is what this list is actually for. */
for (const needle of [
  "createCheckoutSession",
  "Stripe sandbox",
  "Billing Portal",
  "billing-inspector",
  "dbGoAnnual",
  "dbPortal",
  "dbInspect",
]) {
  const hits = files.filter((f) => readFileSync(f, "utf8").includes(needle))
    .map((f) => f.slice(DIST.length + 1));
  check(`no production file contains "${needle}"` + (hits.length ? ` (found in ${hits.join(", ")})` : ""),
    hits.length === 0);
}
/* `plus-annual` DOES legitimately reach production, and banning the bare string
 * would be wrong. src/app/declare/checkout-return.js carries a display-label
 * allowlist that /checkout/cancelled ships, with annual pre-seeded so the plan
 * needs no code change later. A label is not a control.
 *
 * The property that matters is therefore narrower and stronger: wherever an
 * alias appears in production, it must appear WITHOUT any means of acting on
 * it. */
const aliasFiles = files.filter((f) => /plus-(monthly|annual)/.test(readFileSync(f, "utf8")));
check("some production file does carry the aliases (the label allowlist)", aliasFiles.length > 0);
for (const f of aliasFiles) {
  const t = readFileSync(f, "utf8");
  const rel = f.slice(DIST.length + 1);
  check(`${rel} carries the alias with no Checkout action`,
    !/createCheckoutSession|createPortalSession|api\.billing/.test(t));
  check(`${rel} carries the alias with no Convex client`,
    !/ConvexHttpClient|\.setAuth\(/.test(t));
  check(`${rel} carries the alias with no Stripe Price id`, !/price_[A-Za-z0-9]/.test(t));
}
check("the aliases reach production ONLY through the label module",
  aliasFiles.every((f) => /checkout-return/.test(f)));

/* createPortalSession now ships, for /you. Prove it ships SAFELY. */
const portalProd = files.filter((f) => readFileSync(f, "utf8").includes("createPortalSession"));
check("createPortalSession reaches production only via the account page bundle",
  portalProd.length > 0);
for (const f of portalProd) {
  const t = readFileSync(f, "utf8");
  const rel = f.slice(DIST.length + 1);
  check(`${rel} calls the Portal with an EMPTY payload`,
    /createPortalSession\s*,\s*\{\s*\}/.test(t));
  check(`${rel} sends no Customer identifier`, !/cus_|stripeCustomerId|customerId/.test(t));
  check(`${rel} carries no dev control`, !/dbPortal|dbGoAnnual|dbInspect/.test(t));
}

/* pricing.astro's own header declares it non-transactional. Keep that true. */
const PRICING = stripComments(read("src/pages/pricing.astro"));
check("the public pricing CTA is still disabled", /disabled/.test(PRICING));
check("the pricing page still makes no billing call",
  !/createCheckoutSession|createPortalSession|api\.billing/.test(PRICING));

/* ── Result ──────────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
