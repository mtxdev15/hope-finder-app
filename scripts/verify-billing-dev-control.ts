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
 *   4. the controls can name only `plus-monthly` and `plus-annual`
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
/* Assert the PAYLOAD, not the whole script. An earlier version grepped the
 * entire script for "email", which failed the moment the local variable holding
 * the signed-in user's own address for display gained a type annotation — a
 * false positive that says nothing about what crosses the wire. What matters is
 * the object literal handed to client.action(), so extract exactly that. */
/* Both plans go through ONE Checkout implementation, so there is one payload
 * expression and the alias arrives as its parameter. Assert the payload shape
 * AND that the only values that parameter can ever take are the two literals
 * at the call sites. */
const PAYLOAD = (SCRIPT.match(
  /client\.action\(c?\.?api\.billing\.createCheckoutSession,\s*\{([\s\S]*?)\}\s*\)/,
) || [])[1];
check("the Convex action payload can be located", typeof PAYLOAD === "string");
check("the payload is exactly { plan }", (PAYLOAD || "").trim() === "plan");
for (const forbidden of ["userId", "user_id", "customerId", "customer", "email", "price", "subscription", "token"]) {
  check(`the payload carries no "${forbidden}"`, !(PAYLOAD || "").includes(forbidden));
}
/* The plan parameter is typed as a closed union, so nothing else is even
 * representable. */
check("the plan parameter is a closed two-member union",
  /plan: 'plus-monthly' \| 'plus-annual'/.test(SCRIPT));
check("the alias is never read from the DOM, a dataset or the URL",
  !/dataset\.plan|getAttribute\('data-plan'\)|searchParams\.get\('plan'\)/.test(SCRIPT));
check("the only credential the page sends is a Better Auth token",
  /ac\.convex\.token\(/.test(SCRIPT));

/* ── 4. Only the two approved aliases ────────────────────────────────────── */
section("4. Only plus-monthly and plus-annual are accepted");

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
check("plus-annual resolves to the canonical plus_annual",
  planKeyForAlias("plus-annual") === "plus_annual");
check("plus_annual is bound to STRIPE_PLUS_ANNUAL_PRICE_ID",
  PLAN_CATALOG.plus_annual.envVar === "STRIPE_PLUS_ANNUAL_PRICE_ID");
check("plus_annual is a yearly interval", PLAN_CATALOG.plus_annual.interval === "year");

check("the monthly control sends the literal 'plus-monthly'",
  /startCheckout\(btn, 'plus-monthly'\)/.test(SCRIPT));
check("the annual control sends the literal 'plus-annual'",
  /startCheckout\(btnAnnual, 'plus-annual'\)/.test(SCRIPT));
/* Rather than counting occurrences (which any edit perturbs), read the actual
 * arguments at the call sites and assert the SET. */
const CALL_ALIASES = [...SCRIPT.matchAll(/startCheckout\((?:btn|btnAnnual), '([^']*)'\)/g)]
  .map((m) => m[1]).sort();
check("startCheckout is called at exactly two sites", CALL_ALIASES.length === 2);
check("those sites name exactly plus-monthly and plus-annual",
  CALL_ALIASES.join(",") === "plus-annual,plus-monthly");
check("there is ONE Checkout implementation, not two",
  (SCRIPT.match(/createCheckoutSession/g) || []).length === 1);
check("the page sends no lang argument either",
  !/lang:/.test(SCRIPT));

/* The annual control must carry the warning that stops a tester buying annual
 * on the account that already holds the active monthly subscription. */
/* Prose is line-wrapped in the markup, so collapse whitespace before matching.
 * Asserting on the raw source would make a reflow look like a deleted warning. */
const PROSE = PAGE.replace(/\s+/g, " ");
check("the annual control warns against reusing an active subscriber",
  /already has an active subscription/i.test(PROSE));
check("the warning names the QA-account requirement",
  /separate sandbox QA account/i.test(PROSE));
check("the warning is honest that neither guard refunds",
  /neither guard cancels or refunds anything/i.test(PROSE));

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
/* Attribute-order tolerant: the button gained an id, and a literal match would
 * report "the CTA is enabled" for what is only a reordered attribute list. */
const PLUS_CTA = (PRICING.match(/<button[^>]*data-i18n="pricing\.plusCta"[^>]*>/) || [])[0] || "";
check("the public pricing CTA still exists", PLUS_CTA.length > 0);
check("the public pricing CTA is still disabled", /\bdisabled\b/.test(PLUS_CTA));
check("the CTA has no click handler or href", !/onclick|href/i.test(PLUS_CTA));
check("pricing.astro still says 'Opening soon'", /Opening soon/.test(PRICING));
const PRICING_CODE = stripComments(PRICING).toLowerCase();
for (const leak of ["createCheckoutSession", "plus-monthly", "billing.", "convex/browser", "stripe"]) {
  check(`pricing.astro markup contains no "${leak}"`, !PRICING_CODE.includes(leak.toLowerCase()));
}
/* The bare word "checkout" was removed from that list. It was a proxy for "no
 * Checkout call", and it now matches mayStartCheckout() — the shared GUARD that
 * exists precisely to stop a subscriber starting one. Banning the word would
 * mean renaming a safety function to satisfy a grep. The real property is
 * asserted instead: no way to CREATE a session, and every occurrence of the
 * word belongs to the guard. */
const checkoutHits = (stripComments(PRICING).match(/[A-Za-z]*[Cc]heckout[A-Za-z]*/g) || []);
check("pricing.astro can create no Checkout Session",
  !/createCheckoutSession|checkout\/sessions/.test(stripComments(PRICING)));
check("every 'checkout' in pricing.astro is the guard, not a call",
  checkoutHits.length > 0 && checkoutHits.every((h) => h === "mayStartCheckout"));
/* UPDATED, deliberately. This used to assert that pricing loads NO script.
 * That was a proxy for "pricing cannot transact", and it held only while the
 * page was entirely static. Pricing now performs ONE authenticated read —
 * getMyEntitlements — so a signed-in reader can see which plan they already
 * have. That is a Convex query, not a Stripe call.
 *
 * The property worth protecting is unchanged and is asserted directly: the
 * page imports no billing action, so no Checkout or Portal session can be
 * created from it, and the purchase control is never enabled. The loop above
 * already proves no Stripe/checkout/billing reference survives in its code. */
check("pricing.astro imports NO billing action",
  !/createCheckoutSession|createPortalSession|api\.billing/.test(stripComments(PRICING)));
check("pricing.astro never enables the purchase control",
  !/disabled = false/.test(stripComments(PRICING)));
check("pricing.astro's only import surface is the entitlement read",
  !/convex\/browser|ConvexHttpClient/.test(stripComments(PRICING)));

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

/* NOTE on "plus-monthly": the bare alias is no longer a fingerprint of this
   control. src/app/declare/checkout-return.js ships an ALLOWLIST keyed by it
   so /checkout/cancelled can name the plan a reader was looking at — a lookup
   table with no action attached. What must stay absent from production is a
   Checkout TRIGGER, so the fingerprint below is the alias in payload position
   (`plan:"plus-monthly"`), which is what this page's action call compiles to
   and what the allowlist can never produce. */
const FORBIDDEN = [
  "createCheckoutSession",
  'plan:"plus-monthly"',
  "plan:'plus-monthly'",
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
section("6. Nothing that creates a Stripe object can fire without a click");

/* WHY THIS SECTION WAS REWRITTEN
 * It used to assert "there is exactly one click listener" and "no setTimeout
 * appears anywhere". Those were never the property — they were proxies that
 * happened to hold while the page had a single button and no timer. The page
 * now has three controls and a bounded auto-refresh, so the proxies are false
 * while the PROPERTY is still true and still worth proving.
 *
 * The property: every code path that can create a Stripe object is reachable
 * ONLY from a click. Page load and the refresh timer may perform an entitlement
 * READ and nothing more.
 *
 * So: define the click-reachable spans, then require every dangerous token to
 * live inside one of them. */

/* Body span of a named function, and the single-line span of an arrow listener. */
function fnSpan(marker: string): [number, number] { return spanAfter(SCRIPT, marker); }
function lineSpan(marker: string): [number, number] {
  const i = SCRIPT.indexOf(marker);
  return [i, i + marker.length];
}

const CLICK_REACHABLE: Array<[number, number]> = [
  fnSpan("async function startCheckout"),          // both Checkout paths
  fnSpan("btnPortal.addEventListener('click'"),    // the Portal path
  fnSpan("async function connect"),                // the client + api imports
  lineSpan("btn.addEventListener('click', () => startCheckout(btn, 'plus-monthly'));"),
  lineSpan("btnAnnual.addEventListener('click', () => startCheckout(btnAnnual, 'plus-annual'));"),
];
/* A function DECLARATION is not a call — `async function connect() {` does not
 * invoke anything — so declaration sites are excluded and only invocations are
 * required to sit inside a click-reachable span. */
const isDeclaration = (i: number): boolean => /function\s+$/.test(SCRIPT.slice(Math.max(0, i - 20), i));
const reachableOnlyByClick = (needle: string): boolean => {
  const hits: number[] = [];
  for (let i = SCRIPT.indexOf(needle); i !== -1; i = SCRIPT.indexOf(needle, i + 1)) {
    if (!isDeclaration(i)) hits.push(i);
  }
  return hits.length > 0 && hits.every((i) => CLICK_REACHABLE.some(([a, b]) => i > a && i < b));
};
/* Guard the guard: if the declaration filter ever swallowed EVERY site, the
 * check above would pass vacuously. Pin the real call counts. */
check("startCheckout has exactly two invocations",
  (SCRIPT.match(/startCheckout\((?!b:)/g) || []).length === 2);
check("connect has exactly two invocations",
  (SCRIPT.match(/await connect\(\)/g) || []).length === 2);

for (const needle of [
  "createCheckoutSession",          // creates a Checkout Session
  "createPortalSession",            // creates a Portal session
  "startCheckout(",                 // the only route to the former
  "connect()",                      // mints the authenticated client
  "import('convex/browser')",       // the client itself
  "_generated/api",                 // the action references
]) {
  check(`"${needle}" is reachable only from a click`, reachableOnlyByClick(needle));
}

/* The three click handlers are bound to the three real buttons and to nothing
 * else, so "a click" means a deliberate press of a labelled control. */
const CLICK_TARGETS = [...SCRIPT.matchAll(/(\w+)\.addEventListener\('click'/g)].map((m) => m[1]).sort();
check("click handlers are bound to exactly btn, btnAnnual, btnPortal and dbRefresh",
  CLICK_TARGETS.join(",") === "btn,btnAnnual,btnPortal,refreshBtn");

/* THE TIMER. A timer now exists (the bounded watch), so the old blanket ban is
 * gone. What replaces it is stronger: prove the timer callback cannot reach any
 * of the tokens above. tickWatch may call readState and nothing else. */
const TICK = blockAfter(SCRIPT, "function tickWatch");
for (const banned of ["startCheckout", "connect(", "createCheckoutSession", "createPortalSession", "client.action"]) {
  check(`the refresh timer cannot reach "${banned}"`, !TICK.includes(banned));
}
check("the refresh timer calls only readState", /readState\(\)/.test(TICK));
check("setTimeout is used ONLY by the watch loop",
  (SCRIPT.match(/setTimeout\(/g) || []).length === 1 && TICK.includes("setTimeout("));
check("the watch is bounded, not open-ended", /refreshExhausted\(watchTicks\)/.test(TICK));

/* readState is what runs at load and on the timer. It is a READ: it calls the
 * entitlement query and holds no action call, no Convex client, no Stripe
 * anything. This is the assertion that makes "load is safe" true. */
const READ_STATE = blockAfter(SCRIPT, "async function readState");
check("readState calls the entitlement READ", READ_STATE.includes("data.myEntitlements()"));
for (const banned of ["client.action", "createCheckoutSession", "createPortalSession", "connect(", "convex/browser"]) {
  check(`readState performs no "${banned}"`, !READ_STATE.includes(banned));
}
/* The inspector renders through the allowlist projection, never the raw
 * response, so a widened entitlement contract cannot leak a new field. */
check("readState renders through projectEntitlement", READ_STATE.includes("projectEntitlement(ent)"));
check("readState never renders the raw response", !/esc\(JSON\.stringify\(ent/.test(READ_STATE));

check("nothing is bound to DOMContentLoaded", !/DOMContentLoaded/.test(SCRIPT));
check("nothing is bound to window.onload or load", !/onload|addEventListener\('load'/.test(SCRIPT));
check("no form submit path exists", !/<form|addEventListener\('submit'/.test(PAGE));
/* Only session state and the entitlement read run at load. Neither makes a
 * Stripe call nor creates anything. */
check("initAuth runs before any control is wired",
  SCRIPT.indexOf("auth.initAuth()") < SCRIPT.indexOf("async function startCheckout"));
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
