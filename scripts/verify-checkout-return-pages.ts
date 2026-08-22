/* Declare & Believe — the checkout return pages.
 *
 * WHAT THIS EXISTS TO PREVENT
 * /checkout/success is the one page a paying reader lands on, and it arrives
 * carrying `?session_id={CHECKOUT_SESSION_ID}` from Stripe. That value is
 * attacker-supplied as far as the page is concerned — anyone can type a
 * session id into the URL bar — so the page must never treat it as proof of
 * anything. Entitlement comes from Convex, which only becomes true after the
 * SIGNED webhook path has run.
 *
 * The decisions under test are IMPORTED from src/app/declare/checkout-return.js,
 * the same module both pages use. A copy would prove nothing about the shipped
 * page and a grep alone would pass against logic that never runs.
 *
 * dist/ assertions need a build first:
 *   npx astro build && node scripts/verify-checkout-return-pages.ts
 *
 * No network, no credential, no Stripe call, no Convex call.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  planLabel,
  stateForEntitlement,
  pollExhausted,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  MAX_POLLS,
} from "../src/app/declare/checkout-return.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

const SUCCESS_REL = "src/pages/checkout/success.astro";
const CANCELLED_REL = "src/pages/checkout/cancelled.astro";
const SUCCESS = read(SUCCESS_REL);
const CANCELLED = read(CANCELLED_REL);
const MODULE = read("src/app/declare/checkout-return.js");
const script = (src: string) => src.slice(src.indexOf("<script>"), src.indexOf("</script>"));
const SUCCESS_JS = script(SUCCESS);
const CANCELLED_JS = script(CANCELLED);

/* ── 1. Routes exist ─────────────────────────────────────────────────────── */
section("1. Both routes exist");

check("src/pages/checkout/success.astro exists", existsSync(join(ROOT, SUCCESS_REL)));
check("src/pages/checkout/cancelled.astro exists", existsSync(join(ROOT, CANCELLED_REL)));
/* These are the exact URLs convex/billing.ts sends people to. If either moves,
 * a paying reader lands on a 404. */
const BILLING = read("convex/billing.ts");
check("billing.ts success_url still points at /checkout/success",
  /success_url:\s*\n?\s*base \+ "\/checkout\/success/.test(BILLING));
check("billing.ts cancel_url still points at /checkout/cancelled",
  /"\/checkout\/cancelled\?plan="/.test(BILLING));

/* ── 2. session_id is never trusted ──────────────────────────────────────── */
section("2. session_id is untrusted, stripped, and never surfaces");

check("session_id is removed from the visible URL",
  /searchParams\.delete\('session_id'\)/.test(SUCCESS_JS));
check("removal uses replaceState, so history and Back do not keep it",
  /history\.replaceState\(/.test(SUCCESS_JS));
/* Presence may be observed; the VALUE must never be read.
 *
 * The strongest form of this is a COUNT: `session_id` may appear exactly twice
 * in the script — the .has() test and the .delete() — and nowhere else. A
 * mutation that reads the value has to mention it a third time, whatever
 * syntax it reaches for, so this catches the whole class rather than one
 * spelling of it. */
check("only the presence of session_id is observed, never its value",
  /searchParams\.has\('session_id'\)/.test(SUCCESS_JS));
/* Counted on CODE only — the comment above the strip block explains the rule
 * and naturally names the parameter, which is not a read. */
const SUCCESS_CODE = SUCCESS_JS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
check("session_id is mentioned exactly twice in code: the has() and the delete()",
  (SUCCESS_CODE.match(/session_id/g) || []).length === 2);
check("the value is never read, by any receiver",
  !/\.get\(\s*['"]session_id['"]\s*\)/.test(SUCCESS_JS));
check("session_id is never assigned to a variable",
  !/(const|let|var)\s+\w+\s*=\s*[^;]*session_id/.test(SUCCESS_JS));
check("session_id never reaches textContent or innerHTML",
  !/(textContent|innerHTML)\s*=\s*[^;]*session_id/.test(SUCCESS_JS));
check("session_id is never logged", !/console\.[a-z]+\([^)]*session_id/.test(SUCCESS_JS));
check("session_id is never stored", !/(localStorage|sessionStorage)[^;]*session_id/.test(SUCCESS_JS));
check("session_id is never sent anywhere", !/(fetch|track|dataLayer)\([^)]*session_id/.test(SUCCESS_JS));
check("session_id never appears in page copy", !/session_id/.test(SUCCESS.replace(SUCCESS_JS, "").replace(/\/\*[\s\S]*?\*\//g, "")));

/* ── 3. Entitlement is the only confirmation ─────────────────────────────── */
section("3. Confirmation comes only from Convex entitlement state");

check("the page reads getMyEntitlements through the existing client",
  /myEntitlements/.test(SUCCESS_JS));
check("the decision is made by the shared module, not inline",
  /stateForEntitlement\(/.test(SUCCESS_JS));
check("the page makes no Stripe call", !/stripe|checkout\.stripe/i.test(SUCCESS_JS));
check("the page creates no Checkout Session", !/createCheckoutSession/.test(SUCCESS));
check("the page runs no mutation", !/runMutation|\.mutation\(/.test(SUCCESS_JS));

/* The real decision function, executed. */
check("tier plus -> confirmed", stateForEntitlement({ tier: "plus" }) === "confirmed");
check("tier free -> pending", stateForEntitlement({ tier: "free" }) === "pending");
check("guest -> pending", stateForEntitlement({ tier: "guest" }) === "pending");
check("null response -> pending, never confirmed",
  stateForEntitlement(null) === "pending");
check("undefined response -> pending", stateForEntitlement(undefined) === "pending");
/* Attention wins over plus: a failing card must never render as success. */
check("paymentNeedsAttention -> attention even when tier is plus",
  stateForEntitlement({ tier: "plus", paymentNeedsAttention: true }) === "attention");
check("nothing but the entitlement object decides — a session id cannot",
  stateForEntitlement({ tier: "free", session_id: "cs_test_anything" } as any) === "pending");

/* ── 4. Polling is bounded and well-behaved ──────────────────────────────── */
section("4. Polling is bounded, single-flight and stoppable");

check("a poll interval is defined", typeof POLL_INTERVAL_MS === "number" && POLL_INTERVAL_MS > 0);
check("interval is roughly two seconds", POLL_INTERVAL_MS >= 1000 && POLL_INTERVAL_MS <= 3000);
check("a timeout is defined", typeof POLL_TIMEOUT_MS === "number" && POLL_TIMEOUT_MS > 0);
check("timeout is roughly thirty seconds", POLL_TIMEOUT_MS >= 15000 && POLL_TIMEOUT_MS <= 60000);
check("the bound is finite and small", MAX_POLLS > 0 && MAX_POLLS <= 60);
check("polling is exhausted at the bound", pollExhausted(MAX_POLLS));
check("polling is not exhausted before the bound", !pollExhausted(MAX_POLLS - 1));
check("the page uses the shared bound, not its own number",
  /pollExhausted\(/.test(SUCCESS_JS) && /MAX_POLLS/.test(SUCCESS_JS));

check("a single-flight guard prevents concurrent reads",
  /inFlight/.test(SUCCESS_JS) && /if \(stopped \|\| inFlight\) return;/.test(SUCCESS_JS));
check("polling stops once Plus is confirmed",
  /show\('stConfirmed'\); stop\(\);/.test(SUCCESS_JS));
check("polling stops on the attention state too",
  /show\('stAttention'\); stop\(\);/.test(SUCCESS_JS));
check("polling stops when the tab is hidden", /visibilitychange/.test(SUCCESS_JS));
check("polling stops when the page goes away", /pagehide/.test(SUCCESS_JS));
check("no interval is left running — timeouts are cleared", /clearTimeout\(timer\)/.test(SUCCESS_JS));

/* ── 5. The states say the right things ──────────────────────────────────── */
section("5. Each state is honest about what it knows");

check("signed-out state exists", /id="stSignedOut"/.test(SUCCESS));
check("signed-out returns here through the existing ?return= contract",
  /'\/signin\?return=' \+ encodeURIComponent\('\/checkout\/success'\)/.test(SUCCESS_JS));
check("confirmed state links into the app at /today", /href="\/today"/.test(SUCCESS));
check("confirmed state links to the account at /you", /href="\/you"/.test(SUCCESS));
/* The attention copy must not say the subscription is active. */
const attention = SUCCESS.slice(SUCCESS.indexOf('id="stAttention"'), SUCCESS.indexOf('id="stTimeout"'));
check("attention state never claims the subscription is active",
  !/is active|subscription is active|you.re all set/i.test(attention));
check("attention state points at the account page", /href="\/you"/.test(attention));
/* The timeout copy must not push someone toward paying twice. */
const timeout = SUCCESS.slice(SUCCESS.indexOf('id="stTimeout"'));
check("timeout state does not encourage another payment",
  !/try again|pay again|purchase again|re-?subscribe/i.test(timeout.replace(/no need to pay again/i, "")));
check("timeout state explicitly says there is no need to pay again",
  /no need to pay again/i.test(timeout));

/* ── 6. The cancelled page is inert ──────────────────────────────────────── */
section("6. The cancelled page does nothing");

check("no Convex query or mutation", !/runQuery|runMutation|myEntitlements|\.mutation\(/.test(CANCELLED_JS));
check("no Stripe call", !/stripe/i.test(CANCELLED_JS));
check("no Checkout Session is created", !/createCheckoutSession/.test(CANCELLED));
check("Checkout is never auto-retried",
  !/location\.href\s*=|location\.replace|\.click\(\)|window\.open/.test(CANCELLED_JS));
check("it states Checkout was cancelled", /Checkout cancelled/i.test(CANCELLED));
check("it states nothing was started here", /did not start a subscription/i.test(CANCELLED));
/* Landing here is not evidence about a charge either way. */
check("it does not claim a charge did or did not happen",
  !/you were not charged|no charge was made|your card was not/i.test(CANCELLED));
check("it links to a pricing surface that exists", /href="\/pricing"/.test(CANCELLED));
check("it links back into the app", /href="\/today"/.test(CANCELLED));
check("it links to the account page", /href="\/you"/.test(CANCELLED));

/* The allowlist, executed. */
check("plus-monthly is allowlisted", planLabel("plus-monthly") === "Plus monthly");
check("plus-annual is ready without a code change", planLabel("plus-annual") === "Plus annual");
for (const bad of ["", "free", "plus_monthly", "PLUS-MONTHLY", "../x",
                   "<script>alert(1)</script>", "plus-monthly ", "constructor", "__proto__"]) {
  check(`unknown plan rejected: ${JSON.stringify(bad)}`, planLabel(bad) === null);
}
check("non-string plan rejected", planLabel(undefined as any) === null && planLabel(42 as any) === null);
check("the page renders the LABEL, never the raw parameter",
  /planLabel\(raw\)/.test(CANCELLED_JS) && !/textContent\s*=\s*raw/.test(CANCELLED_JS));
check("prototype keys cannot escape the allowlist",
  /hasOwnProperty\.call/.test(MODULE));

/* ── 7. No provider identifiers anywhere ─────────────────────────────────── */
section("7. No Stripe object identifiers reach either page");

for (const [name, src] of [["success", SUCCESS], ["cancelled", CANCELLED]] as [string, string][]) {
  check(`${name}: no Stripe id literal`, !/\b(cus|sub|price|prod|in|pi|ch|pm|cs)_[A-Za-z0-9]{8,}/.test(src));
  check(`${name}: no customer/subscription/price field is read`,
    !/stripeCustomerId|stripeSubscriptionId|stripePriceId|latestInvoiceId/.test(src));
  check(`${name}: no hosted Stripe URL`, !/checkout\.stripe\.com|invoice\.stripe\.com/.test(src));
}

/* ── 8. Accessibility and design ─────────────────────────────────────────── */
section("8. Accessibility and design");

for (const [name, src] of [["success", SUCCESS], ["cancelled", CANCELLED]] as [string, string][]) {
  check(`${name}: exactly one <h1>`, (src.match(/<h1/g) || []).length === 1);
  check(`${name}: status is announced politely`,
    /role="status"/.test(src) && /aria-live="polite"/.test(src));
  check(`${name}: heading order is h1 then h2, no skipped level`,
    src.indexOf("<h1") < src.indexOf("<h2") && !/<h[3-6]/.test(src));
  check(`${name}: interactive targets are at least 44px`, /min-height: 44px/.test(src));
  check(`${name}: focus is visible`, /:focus-visible/.test(src));
  check(`${name}: mounts no second navigation landmark`, !/<nav/.test(src));
  check(`${name}: exactly one <main>`, (src.match(/<main/g) || []).length === 1);
  check(`${name}: uses the shared layout`, /DeclareLayout/.test(src));
  check(`${name}: kept out of the index like other utility screens`, /noindex=\{true\}/.test(src));
  check(`${name}: decorative art is hidden from assistive tech`, /aria-hidden="true"/.test(src));
  check(`${name}: uses theme tokens rather than hardcoded page colours`,
    /var\(--text\)/.test(src) && /var\(--surface\)/.test(src));
  check(`${name}: localisation uses the existing data-i18n mechanism`, /data-i18n=/.test(src));
  check(`${name}: no new external package is imported`,
    !/from ['"][a-z@][^'".]*['"]/.test(script(src).replace(/from '\.\.[^']*'/g, "")));
}
check("success: reduced motion stops the spinner",
  /prefers-reduced-motion: reduce/.test(SUCCESS) && /animation: none/.test(SUCCESS));

/* ── 9. Build output ─────────────────────────────────────────────────────── */
section("9. Build output");

const DIST = join(ROOT, "dist");
if (!existsSync(DIST)) {
  console.log("  ✗ dist/ not found — run `npx astro build` first, then re-run this suite.\n");
  process.exit(1);
}
check("dist/checkout/success/index.html was generated",
  existsSync(join(DIST, "checkout/success/index.html")));
check("dist/checkout/cancelled/index.html was generated",
  existsSync(join(DIST, "checkout/cancelled/index.html")));

const TEXT = new Set([".html", ".js", ".mjs", ".css", ".json", ".txt", ".xml", ".map", ".svg"]);
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (TEXT.has(extname(n).toLowerCase())) out.push(p);
  }
  return out;
}
const files = walk(DIST);
/* The dev-only billing control must still be absent from production, and
 * nothing here may have introduced a public Checkout trigger. */
/* "plus-monthly" DOES ship now, as an allowlist key in checkout-return.js so
   the cancelled page can name the plan. That is a lookup table, not a trigger,
   so the ban is on the alias in PAYLOAD position — what an actual
   `client.action(..., { plan: 'plus-monthly' })` compiles to. */
for (const needle of ["createCheckoutSession", 'plan:"plus-monthly"', "plan:'plus-monthly'",
                      "billing-sandbox", "PUBLIC_BILLING_DEV_CONTROL"]) {
  const hits = files.filter((f) => readFileSync(f, "utf8").includes(needle))
    .map((f) => f.slice(DIST.length + 1));
  check(`production build contains no "${needle}"` + (hits.length ? ` (found in ${hits.slice(0, 3).join(", ")})` : ""),
    hits.length === 0);
}
check("no dist/dev/ route was generated", !existsSync(join(DIST, "dev")));
/* And prove the one legitimate occurrence really is inert: every production
   file mentioning the alias must do so as an allowlist VALUE MAPPING, with no
   Convex action anywhere near it. */
const aliasFiles = files.filter((f) => readFileSync(f, "utf8").includes("plus-monthly"));
check("the alias ships only as an allowlist mapping",
  aliasFiles.every((f) => {
    const t = readFileSync(f, "utf8");
    return t.includes('"plus-monthly":"Plus monthly"') && !t.includes("createCheckoutSession");
  }));
check("no production file can invoke a Convex billing action",
  !files.some((f) => /billing\.createCheckoutSession|api\.billing/.test(readFileSync(f, "utf8"))));
/* The shipped success page must not carry a session id either. */
const successHtml = readFileSync(join(DIST, "checkout/success/index.html"), "utf8");
check("the built success page renders no session id", !/cs_test_|cs_live_/.test(successHtml));
check("the built success page has one h1", (successHtml.match(/<h1/g) || []).length === 1);

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
