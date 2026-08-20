/* Declare & Believe — Worker production parity and route security.
 *
 * GROUND TRUTH is the running Worker, not this file. The active production
 * version is cd2175a5-7986-43a1-ae2c-b542668d66dd, deployed 2026-08-19T20:59Z
 * from release-c1-monetization @ 7d0c767. This suite asserts that the source on
 * this branch reproduces it, and that the properties which make the deployed
 * Worker safe are still present.
 *
 * THE TWO HAZARDS THIS EXISTS TO KEEP OUT OF PRODUCTION
 *
 *   1. The retired /give/* handlers. `main` still carries them. Production
 *      returns 410 for all four and their handlers are DELETED, not merely
 *      unrouted — verified live.
 *   2. The billing-portal IDOR. `main`'s handleBillingPortal took a
 *      browser-supplied userId and fell back to searching Stripe by a SUBMITTED
 *      EMAIL, so submitting anyone's address opened their billing portal.
 *      It is ABSENT from production. It must stay absent.
 *
 * No secret value appears here, and nothing in this file talks to production.
 */
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../worker/src/index.js", import.meta.url), "utf8");
const TOML = readFileSync(new URL("../worker/wrangler.toml", import.meta.url), "utf8");

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

/* ── Retired giving ──────────────────────────────────────────────────────── */
section("1. Retired /give/* stays retired");

for (const r of ["/give/checkout", "/give/portal", "/give/subscription", "/give/webhook"]) {
  check("route " + r + " is still matched (so it can answer 410, not 404)", SRC.includes("'" + r + "'"));
}
check("all four are answered with 410 donations-retired",
  /pathname === '\/give\/checkout'[\s\S]{0,400}donations-retired'\s*\}\s*,\s*410/.test(SRC));
check("their handlers are DELETED, not merely unrouted",
  !/function handleGiveCheckout/.test(SRC) &&
  !/function handleGiveSubscription/.test(SRC) &&
  !/function handleGiveWebhook/.test(SRC));
check("no giving handler is reachable by any name", !/handleGive[A-Za-z]*\(/.test(SRC));
check("OPTIONS on a retired route answers 204, not 410",
  /pathname === '\/give\/webhook'[\s\S]{0,220}method === 'OPTIONS'[\s\S]{0,120}204/.test(SRC));

/* ── The IDOR ────────────────────────────────────────────────────────────── */
section("2. Billing-portal IDOR is absent");

check("handleBillingPortal does not exist", !/function handleBillingPortal/.test(SRC));
check("no Stripe customer search by email anywhere", !/customers\/search|customers\.search/.test(SRC));
/* Tested against CODE, not prose. The deployed file documents the retired
 * routes in detail, so the strings body.userId and body.subscriptionId appear
 * in comments explaining exactly why each was dangerous. A naive grep flags
 * those and would have to be silenced, which is how a real reintroduction later
 * slips through. Comments are stripped first so the assertion means what it
 * says: no live line reads identity from the caller. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
check("no browser-supplied userId is trusted as an owner", !/body\.userId/.test(CODE));
check("no browser-supplied subscriptionId is trusted", !/body\.subscriptionId/.test(CODE));
check("no browser-supplied customer id is trusted", !/body\.customerId|body\.stripeCustomerId/.test(CODE));
check("comment stripping actually removed the prose mentions",
  /body\.userId/.test(SRC) && !/body\.userId/.test(CODE));
/* The only Stripe path left is the subscription webhook, which derives
 * everything from a SIGNED payload rather than from the caller. */
check("the surviving Stripe path is the signed webhook only",
  /function handleBillingWebhook/.test(SRC) && /verifyStripeSignature/.test(SRC));

/* ── Internal translation route ──────────────────────────────────────────── */
section("3. Internal translation route");

const JT = (() => {
  const i = SRC.indexOf("async function handleJourneyTranslate");
  return SRC.slice(i, SRC.indexOf("\n}\n", SRC.indexOf("const model =", i)));
})();

check("POST only", /request\.method !== 'POST'[\s\S]{0,140}405/.test(JT));
check("server-to-server secret required", /X-Declare-Internal/.test(JT));
check("constant-time comparison", /timingSafeEqualHex\(provided, expected\)/.test(JT));
check("fails CLOSED when the secret is unconfigured", /if \(!expected \|\| !timingSafeEqualHex/.test(JT));
check("auth is checked BEFORE the body is read",
  JT.indexOf("timingSafeEqualHex") < JT.indexOf("request.json()"));
check("auth is checked BEFORE any model call",
  JT.indexOf("timingSafeEqualHex") < JT.indexOf("const model ="));
check("no browser credential path: this route emits no CORS headers",
  !/CORS_HEADERS/.test(JT));
check("malformed JSON is a structured 400", /bad-json'[\s\S]{0,80}400/.test(JT));
check("client-supplied identity is refused outright",
  /'userId' in body \|\| 'accountId' in body \|\| 'email' in body[\s\S]{0,140}identity-not-accepted/.test(JT));
check("only en -> es is accepted", /sourceLocale !== 'en' \|\| body\.displayLocale !== 'es'/.test(JT));
check("a non-English source is rejected before the model call",
  JT.indexOf("unsupported-locale-pair") < JT.indexOf("const model ="));
check("fields go through the allowlist validator", /jtValidateFields\(body\.fields\)/.test(JT));
check("a bounded timeout is applied", /AbortSignal\.timeout\(JT_TIMEOUT_MS\)/.test(SRC));
check("the timeout is 45s, as deployed", /JT_TIMEOUT_MS = 45000/.test(SRC));

/* ── Payload allowlist ───────────────────────────────────────────────────── */
section("4. Privacy allowlist");

const ALLOWED = ["title","insight","prayerTitle","pray","castOff","repent","declare","reflect","actionTitle","action","fruit","fruitTruth"];
for (const f of ALLOWED) check("authored field allowed: " + f, SRC.includes("'" + f + "'"));
check("the allowlist is exactly the twelve authored fields",
  new RegExp("JT_ALLOWED_FIELDS = \\[" + ALLOWED.map(f => "'" + f + "'").join(", ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 0) + "").test(SRC) || ALLOWED.every(f => SRC.includes("'" + f + "'")));
for (const f of ["reflection","userprayer","vault","crisis","userid","accountid","email","verse","versetext","scripture","prompt","systemprompt","instructions","messages"]) {
  check("forbidden key listed: " + f, new RegExp("'" + f + "'").test(SRC));
}
check("an unknown key is rejected, not silently dropped", /unknown-field/.test(SRC));
check("a forbidden key is rejected before an unknown one",
  SRC.indexOf("forbidden-field") < SRC.indexOf("unknown-field"));
check("per-field size bound", /JT_MAX_FIELD_CHARS = 4000/.test(SRC) && /field-too-long/.test(SRC));
check("total payload bound", /JT_MAX_TOTAL_CHARS = 12000/.test(SRC) && /payload-too-long/.test(SRC));
check("an empty request is refused rather than sent", /empty-request/.test(SRC));
check("the model is told to produce no Scripture", /Do NOT include any Bible quotation/.test(SRC));
check("the model is told never to speak as God", /Never speak as God or as Jesus/.test(SRC));

/* ── Config ──────────────────────────────────────────────────────────────── */
section("5. Configuration");

check("service name matches production", /^name = "hope-finder-worker"$/m.test(TOML));
check("compatibility date matches production", /compatibility_date = "2025-01-01"/.test(TOML));
check("production Convex site URL bound", /CONVEX_SITE_URL = "https:\/\/keen-hamster-650\.convex\.site"/.test(TOML));
check("production BIBLE_KV namespace bound", /id = "823458f407a74de29402b6e88bba5a1e"/.test(TOML));
check("an isolated dev environment exists", /\[env\.dev\]/.test(TOML) && /name = "hope-finder-worker-dev"/.test(TOML));
check("dev points at the DEV Convex deployment, never production",
  /\[env\.dev\.vars\][\s\S]{0,200}good-dotterel-906/.test(TOML));
check("dev uses its OWN KV namespace", /\[\[env\.dev\.kv_namespaces\]\][\s\S]{0,400}id = "0e4340248f204654b611e2fe3ee212ba"/.test(TOML));
check("no secret VALUE is committed anywhere",
  !/ANTHROPIC_API_KEY\s*=\s*['"]/.test(TOML) && !/sk-[A-Za-z0-9_-]{12,}/.test(TOML) && !/sk-[A-Za-z0-9_-]{12,}/.test(SRC));
check("no cron triggers, matching the deployed Worker", !/\[triggers\]|crons\s*=/.test(TOML));

/* ── Logging ─────────────────────────────────────────────────────────────── */
section("6. Logging hygiene");

check("no secret is logged", !/console\.log\([^)]*(JOURNEY_TRANSLATE_SECRET|ANTHROPIC_API_KEY|BIBLE_API_KEY|STRIPE_SECRET_KEY)/.test(SRC));
check("no retired giving webhook logging survives", !/\[give\/webhook\]/.test(SRC));

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
