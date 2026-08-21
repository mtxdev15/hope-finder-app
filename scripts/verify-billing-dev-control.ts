/* Declare & Believe — the development-only Plus checkout control.
 *
 * WHAT THIS EXISTS TO PREVENT
 * Until Stage 2 resume step 1, `billing.createCheckoutSession` had ZERO callers
 * anywhere in the repo. Production was protected structurally: there was
 * nothing to click. src/pages/dev/[control].astro gives the action its first
 * caller, so that protection becomes conditional — it now depends on two gates
 * staying correct. This suite is what makes those gates assertable instead of
 * assumed.
 *
 * Six properties, each of which would be a real incident if it regressed:
 *   1. an unauthenticated caller cannot invoke checkout
 *   2. the browser cannot supply a Stripe Price id
 *   3. the browser cannot supply anyone's identity, its own or another's
 *   4. the control can name only `plus-monthly`
 *   5. the control cannot render or run in production
 *   6. nothing fires on page load
 *
 * Section 5 reads dist/ and is the decisive one. Build FIRST, and build
 * hostile — with the public flag deliberately ON — because that is the failure
 * mode a real accident takes:
 *
 *     PUBLIC_BILLING_DEV_CONTROL=1 npx astro build
 *     node scripts/verify-billing-dev-control.ts
 *
 * No network, no credential, no deployment, and the checkout action is never
 * invoked.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, extname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/* The page filename contains brackets, which do not survive a URL round trip —
 * hence path.join throughout rather than the new URL(...) idiom used elsewhere. */
const PAGE_REL = "src/pages/dev/[control].astro";
const PAGE = read(PAGE_REL);
const BILLING = read("convex/billing.ts");
const PRICING = read("src/pages/pricing.astro");

import { planKeyForAlias, PLAN_CATALOG } from "../convex/plusPlans.ts";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

/* Walk braces from the first `{` after `marker` and return that block. Same
 * naive technique verify-webhook-signature.ts uses on the Worker source: these
 * files contain no unbalanced brace inside a string literal, and a naive walk
 * that breaks loudly is better than a regex that passes quietly. */
function blockAfter(src: string, marker: string): string {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("marker not found: " + marker);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error("unbalanced braces after: " + marker);
}
/* Several assertions below are "this string must not appear". Comments in these
 * files DESCRIBE the very patterns being banned — convex/billing.ts documents
 * the retired customers-by-email lookup so it is never reintroduced, and
 * pricing.astro's header declares it contains no Stripe reference, using the
 * word "Stripe" to do so. Matching those would fail a file for warning about
 * the problem, so the ban is applied to code only. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");
}

/* Byte range of that block, for containment tests. */
function spanAfter(src: string, marker: string): [number, number] {
  const start = src.indexOf(marker);
  const open = src.indexOf("{", start);
  return [open, open + blockAfter(src, marker).length];
}

const CHECKOUT = BILLING.slice(
  BILLING.indexOf("export const createCheckoutSession"),
  BILLING.indexOf("export const createPortalSession"),
);
const SCRIPT = PAGE.slice(PAGE.indexOf("<script>"), PAGE.indexOf("</script>"));

/* ── 1. An unauthenticated caller cannot invoke checkout ─────────────────── */
section("1. Unauthenticated callers cannot invoke checkout");

check("identity comes from Better Auth via authComponent.safeGetAuthUser",
  /authComponent\.safeGetAuthUser\(ctx\)/.test(BILLING));
check("requireUser throws when no user is resolved",
  /if \(!user\) throw new Error\("not-authenticated"\)/.test(BILLING));
check("the handler resolves identity before anything else",
  /1\. Trusted identity FIRST/.test(CHECKOUT));
check("an unauthenticated caller gets not-authenticated",
  /return \{ error: "not-authenticated" \}/.test(CHECKOUT));
/* Ordering is the property, not merely presence: an anonymous caller must learn
 * nothing about our configuration — not even whether billing is configured —
 * before it is established who they are. */
check("requireUser runs BEFORE the Stripe credential is read",
  CHECKOUT.indexOf("requireUser(ctx)") < CHECKOUT.indexOf("process.env.STRIPE_SECRET_KEY"));
check("requireUser runs BEFORE the plan alias is resolved",
  CHECKOUT.indexOf("requireUser(ctx)") < CHECKOUT.indexOf("planKeyForAlias"));
check("no ctx.auth.getUserIdentity fallback path exists",
  !/getUserIdentity/.test(BILLING));
check("no token, header or cookie is read from the request",
  !/req\.headers|Authorization|Bearer /.test(BILLING));
check("the dev control does not attempt an unauthenticated call",
  /if \(!token\)/.test(SCRIPT) && /client\.setAuth\(token\)/.test(SCRIPT));
check("the dev control hides the button when signed out",
  /isSignedIn\(\)/.test(SCRIPT) && /ctrl\.hidden = false/.test(SCRIPT));

/* ── 2. The browser cannot supply a Stripe Price id ──────────────────────── */
section("2. The browser cannot supply a Stripe Price id");

const ARGS = blockAfter(CHECKOUT, "args:");
const argKeys = [...ARGS.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort();

check("the args validator holds exactly plan and lang",
  JSON.stringify(argKeys) === JSON.stringify(["lang", "plan"]));
for (const forbidden of ["price", "priceId", "stripePriceId", "lookupKey", "amount", "currency", "interval"]) {
  check(`args cannot carry "${forbidden}"`, !new RegExp("\\b" + forbidden + "\\s*:").test(ARGS));
}
check("the Price id is read from trusted server env only",
  /const priceId = process\.env\[PLAN_CATALOG\[planKey\]\.envVar\]/.test(CHECKOUT));
check("a missing Price env var fails closed",
  /if \(!priceId\) return \{ error: "billing-not-configured" \}/.test(CHECKOUT));
check("the line item is fed from that server-resolved priceId",
  /"line_items\[0\]\[price\]": priceId/.test(CHECKOUT));
check("no args.* value ever reaches line_items",
  !/line_items\[0\]\[price\]"\]?\s*:\s*(args|String\(args)/.test(CHECKOUT));
check("convex/billing.ts contains no hardcoded Price id",
  !/\bprice_[A-Za-z0-9]{8}/.test(BILLING));
check("the dev page contains no Price id",
  !/\bprice_[A-Za-z0-9]{8}/.test(PAGE));
check("the dev page never names a Stripe Price at all",
  !/priceId|price_id|lookup_key/.test(PAGE));

/* ── 3. The browser cannot supply anyone's identity ──────────────────────── */
section("3. The browser cannot supply anyone's identity");

for (const forbidden of ["userId", "email", "customer", "customerId", "subscriptionId", "clientReferenceId"]) {
  check(`args cannot carry "${forbidden}"`, !new RegExp("\\b" + forbidden + "\\s*:").test(ARGS));
}
check("userId is derived from the authenticated session",
  /const userId = user\._id/.test(CHECKOUT));
check("client_reference_id comes from that derived userId",
  /client_reference_id: userId/.test(CHECKOUT));
check("the customer email comes from the authenticated profile",
  /user\.email \? \{ email: user\.email \}/.test(CHECKOUT));
check("no request field is ever read as an email",
  !/args\.email/.test(BILLING));
check("no request field is ever read as a userId",
  !/args\.userId/.test(BILLING));
/* The retired donation portal looked a customer up by a browser-submitted
 * email, which meant submitting anyone's address opened their billing portal.
 * That fallback must never reappear in either action. */
check("the retired customers-by-email lookup is absent from the code",
  !/customers\?email/.test(stripComments(BILLING)));
check("the dev page sends no identity of any kind",
  !/userId|user_id|customerId|\bemail\b/.test(SCRIPT.replace(/u\.email/g, "").replace(/\/\*[\s\S]*?\*\//g, "")));
check("the only credential the page sends is a Better Auth token",
  /ac\.convex\.token\(/.test(SCRIPT));

/* ── 4. Only plus-monthly ────────────────────────────────────────────────── */
section("4. Only plus-monthly is accepted");

check("plus-monthly resolves to the canonical plus_monthly",
  planKeyForAlias("plus-monthly") === "plus_monthly");
check("plus_monthly is bound to STRIPE_PLUS_MONTHLY_PRICE_ID",
  PLAN_CATALOG.plus_monthly.envVar === "STRIPE_PLUS_MONTHLY_PRICE_ID");
check("plus_monthly is a monthly interval",
  PLAN_CATALOG.plus_monthly.interval === "month");

/* Everything else is rejected server-side, including near misses that a typo,
 * a copy-paste or a probing client would actually produce. */
for (const bad of [
  "plus_monthly", "PLUS-MONTHLY", "Plus-Monthly", " plus-monthly", "plus-monthly ",
  "plus-monthly\n", "", "plus", "monthly", "family", "church", "free",
  "price_1U6hytLShxhb4mBzduppVOya", "plus-monthly;plus-annual", "../plus-monthly",
]) {
  check(`alias rejected: ${JSON.stringify(bad)}`, planKeyForAlias(bad) === null);
}
check("an unknown alias fails closed with unknown-plan",
  /if \(!planKey\) return \{ error: "unknown-plan" \}/.test(CHECKOUT));
check("the page sends the literal 'plus-monthly'",
  /plan: 'plus-monthly'/.test(SCRIPT));
check("the alias appears exactly once, as a constant",
  (SCRIPT.match(/'plus-monthly'/g) || []).length === 1);
check("the page never mentions plus-annual",
  !/plus-annual/.test(PAGE));
check("the page sends no lang argument either",
  !/lang:/.test(SCRIPT));

/* ── 5. Cannot render or run in production ───────────────────────────────── */
section("5. The control cannot render or run in production");

check("GATE A: the route is dynamic, so it can generate zero pages",
  PAGE_REL.includes("[control]") && /export function getStaticPaths/.test(PAGE));
check("GATE A gates on DEV && the public flag",
  /import\.meta\.env\.DEV && import\.meta\.env\.PUBLIC_BILLING_DEV_CONTROL === '1'/.test(
    blockAfter(PAGE, "export function getStaticPaths")));
check("GATE A returns [] when disabled",
  /\? \[\{ params: \{ control: 'billing-sandbox' \} \}\] : \[\]/.test(PAGE));
check("GATE B repeats the check inside the client script",
  /if \(import\.meta\.env\.DEV && import\.meta\.env\.PUBLIC_BILLING_DEV_CONTROL === '1'\)/.test(SCRIPT));
/* Written with the literals inline rather than through a frontmatter variable,
 * so Vite substitutes them at transform time and esbuild drops the whole body.
 * Reading them through a variable would defeat the fold. */
check("GATE B uses inline literals, not a frontmatter variable",
  !/if \(BILLING_DEV|if \(DEV_CONTROL|if \(enabled\)/.test(SCRIPT));
check("the DEV term is present in both gates (the public flag alone is not a gate)",
  (PAGE.match(/import\.meta\.env\.DEV/g) || []).length >= 2);
/* .env.local is loaded by Vite in EVERY mode, production builds included. */
check("the reason DEV is load-bearing is documented on the page",
  /\.env\.local/.test(PAGE) && /production build/.test(PAGE));

/* pricing.astro stays non-transactional — asserted, not trusted. */
check("the public pricing CTA is still disabled",
  /<button type="button" class="btn btn-primary" disabled/.test(PRICING));
check("pricing.astro still says 'Opening soon'", /Opening soon/.test(PRICING));
const PRICING_CODE = stripComments(PRICING).toLowerCase();
for (const leak of ["createCheckoutSession", "plus-monthly", "billing.", "convex/browser", "stripe", "checkout"]) {
  check(`pricing.astro markup contains no "${leak}"`, !PRICING_CODE.includes(leak.toLowerCase()));
}
check("pricing.astro loads no script at all", !/<script/.test(PRICING));

/* ── 5b. The build output itself ─────────────────────────────────────────── */
section("5b. Build output — dist/ must contain none of it");

const DIST = join(ROOT, "dist");
if (!existsSync(DIST)) {
  console.log("  ✗ dist/ not found.\n");
  console.log("    Section 5b is the decisive proof and cannot be skipped. Build first,");
  console.log("    and build HOSTILE — with the public flag deliberately on — so the test");
  console.log("    proves the DEV term alone suppresses the control:\n");
  console.log("      PUBLIC_BILLING_DEV_CONTROL=1 npx astro build");
  console.log("      node scripts/verify-billing-dev-control.ts\n");
  process.exit(1);
}

check("GATE A held: dist/dev/ was not generated at all", !existsSync(join(DIST, "dev")));

const TEXT = new Set([".html", ".js", ".mjs", ".css", ".json", ".txt", ".xml", ".map", ".svg"]);
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (TEXT.has(extname(name).toLowerCase())) out.push(p);
  }
  return out;
}
const files = walk(DIST);
check("dist/ contains files to inspect", files.length > 0);

const FORBIDDEN = [
  "createCheckoutSession",
  "plus-monthly",
  "billing-sandbox",
  "Stripe sandbox — no real charge",
  "PUBLIC_BILLING_DEV_CONTROL",
];
for (const needle of FORBIDDEN) {
  const hits = files.filter((f) => readFileSync(f, "utf8").includes(needle))
    .map((f) => f.slice(DIST.length + 1));
  check(`no production file contains "${needle}"` + (hits.length ? ` (found in ${hits.slice(0, 3).join(", ")})` : ""),
    hits.length === 0);
}

/* ── 6. Nothing fires on page load ───────────────────────────────────────── */
section("6. No checkout request fires on page load");

const [clickStart, clickEnd] = spanAfter(SCRIPT, "addEventListener('click'");
const insideClick = (needle: string) => {
  const i = SCRIPT.indexOf(needle);
  return i > clickStart && i < clickEnd;
};

check("there is exactly one click listener on the control",
  (SCRIPT.match(/addEventListener\('click'/g) || []).length === 1);
check("createCheckoutSession appears exactly once",
  (SCRIPT.match(/createCheckoutSession/g) || []).length === 1);
check("createCheckoutSession is INSIDE the click handler",
  insideClick("createCheckoutSession"));
check("the Convex client is imported INSIDE the click handler",
  insideClick("import('convex/browser')"));
check("the generated api is imported INSIDE the click handler",
  insideClick("_generated/api"));
check("the Convex action call is INSIDE the click handler",
  insideClick("client.action("));
check("nothing is bound to DOMContentLoaded", !/DOMContentLoaded/.test(SCRIPT));
check("nothing is bound to window.onload or load", !/onload|addEventListener\('load'/.test(SCRIPT));
check("no timer can invoke it", !/setTimeout|setInterval|requestIdleCallback/.test(SCRIPT));
check("no form submit path exists", !/<form|addEventListener\('submit'/.test(PAGE));
/* Only the session lookup runs at load. That makes no Stripe call and creates
 * nothing — it is what decides whether to render the button at all. */
check("only initAuth runs at load", SCRIPT.indexOf("initAuth()") < clickStart);
check("the returned Checkout URL is NOT auto-navigated",
  !/location\.href|location\.assign|location\.replace|window\.open/.test(SCRIPT));
check("opening Checkout is a separate, deliberate second click",
  /Open Stripe Checkout in a new tab/.test(SCRIPT));

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
