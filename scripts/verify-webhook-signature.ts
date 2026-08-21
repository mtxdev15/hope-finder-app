/* Declare & Believe — Stripe webhook signature verification.
 *
 * WHAT THIS EXISTS TO PREVENT
 * The first sandbox delivery to hope-finder-worker-dev returned
 * `400 Invalid signature`, and there was no way to tell which of four
 * different failures had occurred — no header, malformed header, stale
 * timestamp, or no matching v1 all returned the same opaque response with no
 * log line. Diagnosing it meant probing the live endpoint. This suite makes
 * every one of those cases assertable offline.
 *
 * The functions under test are EXTRACTED FROM worker/src/index.js VERBATIM.
 * Testing a copy would prove nothing about the code that actually runs.
 *
 * Uses a SYNTHETIC secret throughout. The real signing secret is never
 * requested, read, printed, or needed. No network, no credential, no deploy.
 *
 * Run:  node scripts/verify-webhook-signature.ts
 */
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

const SRC = readFileSync(new URL("../worker/src/index.js", import.meta.url), "utf8");

/* Pull a function out of the Worker source by walking its braces. */
function extract(signature: string): string {
  const start = SRC.indexOf(signature);
  if (start < 0) throw new Error("not found in worker source: " + signature);
  const open = SRC.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}") {
      depth--;
      if (depth === 0) return SRC.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced braces: " + signature);
}

const mod: any = await import(
  "data:text/javascript," +
    encodeURIComponent(
      extract("function timingSafeEqualHex") +
        "\n" +
        extract("async function verifyStripeSignature") +
        "\nexport { timingSafeEqualHex, verifyStripeSignature };",
    )
);
const { verifyStripeSignature } = mod;

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

/* Stripe's documented scheme, implemented independently here so the test does
 * not borrow the implementation it is checking. */
const SECRET = "whsec_SYNTHETIC_TEST_SECRET_not_a_real_value";
const OTHER = "whsec_SYNTHETIC_DIFFERENT_SECRET_value_here";
const sign = (payload: string, secret: string, ts: number) =>
  createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
const now = () => Math.floor(Date.now() / 1000);
const header = (payload: string, secret: string, ts = now()) =>
  `t=${ts},v1=${sign(payload, secret, ts)}`;

const BODY = JSON.stringify({
  id: "evt_test",
  type: "checkout.session.expired",
  created: 1787279862,
  data: { object: { id: "cs_test_x", mode: "subscription" } },
});

const ok = async (name: string, sigHeader: any, secret = SECRET, payload = BODY) =>
  check(name, (await verifyStripeSignature(payload, sigHeader, secret)).ok === true);
const rejected = async (name: string, sigHeader: any, reason: string, secret = SECRET, payload = BODY) => {
  const v = await verifyStripeSignature(payload, sigHeader, secret);
  check(name, v.ok === false && v.reason === reason);
};

/* ── Core ────────────────────────────────────────────────────────────────── */
section("1. Core verification");

await ok("valid signature accepted", header(BODY, SECRET));
await rejected("wrong secret rejected", header(BODY, OTHER), "no-matching-v1");
await rejected("tampered payload rejected", header(BODY, SECRET), "no-matching-v1", SECRET, BODY + " ");
await rejected("missing header rejected", null, "no-header");
await rejected("empty header rejected", "", "no-header");
await rejected("absent secret rejected", header(BODY, SECRET), "no-secret", "");
await rejected("header with no v1 rejected", `t=${now()}`, "malformed-header");
await rejected("header with no t rejected", `v1=${sign(BODY, SECRET, now())}`, "malformed-header");
await rejected("garbage header rejected", "not-a-signature", "malformed-header");

/* ── Signed payload construction ─────────────────────────────────────────── */
section("2. The signed payload is timestamp + '.' + rawBody");

const ts = now();
await rejected(
  "signing the body alone is rejected",
  `t=${ts},v1=${createHmac("sha256", SECRET).update(BODY).digest("hex")}`,
  "no-matching-v1",
);
await rejected(
  "re-serialised JSON rejected (raw bytes matter)",
  header(BODY, SECRET), "no-matching-v1", SECRET,
  JSON.stringify(JSON.parse(BODY), null, 2),
);
const UNICODE = JSON.stringify({ d: "Declare Plus — sandbox", e: "✝" });
await ok("UTF-8 body (em dash, non-ASCII) verifies", header(UNICODE, SECRET), SECRET, UNICODE);

/* ── Encoding ────────────────────────────────────────────────────────────── */
section("3. Lowercase hexadecimal, never Base64");

await rejected(
  "Base64 signature rejected",
  `t=${ts},v1=${createHmac("sha256", SECRET).update(`${ts}.${BODY}`).digest("base64")}`,
  "no-matching-v1",
);
await rejected(
  "uppercase hex rejected (implementation emits lowercase)",
  `t=${ts},v1=${sign(BODY, SECRET, ts).toUpperCase()}`,
  "no-matching-v1",
);

/* ── Multiple v1 — the secret-rotation overlap ───────────────────────────── */
section("4. Multiple v1 signatures (secret rotation)");

await ok("ours second of two", `t=${ts},v1=${sign(BODY, OTHER, ts)},v1=${sign(BODY, SECRET, ts)}`);
await ok("ours first of two", `t=${ts},v1=${sign(BODY, SECRET, ts)},v1=${sign(BODY, OTHER, ts)}`);
await ok("v0 entries ignored, v1 still matched", `t=${ts},v0=deadbeef,v1=${sign(BODY, SECRET, ts)}`);
await rejected("two v1, neither ours", `t=${ts},v1=${sign(BODY, OTHER, ts)},v1=${sign(BODY, OTHER + "x", ts)}`, "no-matching-v1");

/* ── Timestamp tolerance ─────────────────────────────────────────────────── */
section("5. Timestamp tolerance");

await ok("299s old accepted", header(BODY, SECRET, ts - 299));
await rejected("301s old rejected", header(BODY, SECRET, ts - 301), "stale-timestamp");
await rejected("301s in the future rejected", header(BODY, SECRET, ts + 301), "stale-timestamp");
await rejected("non-numeric timestamp rejected", `t=abc,v1=${sign(BODY, SECRET, ts)}`, "stale-timestamp");

/* ── Secret handling ─────────────────────────────────────────────────────── */
section("6. Secret handling");

await rejected(
  "whsec_ prefix is part of the key, not stripped",
  `t=${ts},v1=${createHmac("sha256", SECRET.replace(/^whsec_/, "")).update(`${ts}.${BODY}`).digest("hex")}`,
  "no-matching-v1",
);
/* These two are why the call site trims. An untrimmed secret fails exactly like
 * a wrong one, and is invisible in every dashboard. */
await rejected("trailing newline in secret breaks verification", header(BODY, SECRET), "no-matching-v1", SECRET + "\n");
await rejected("trailing space in secret breaks verification", header(BODY, SECRET), "no-matching-v1", SECRET + " ");
await ok("trimmed secret verifies", header(BODY, SECRET), (SECRET + "\n").trim());

/* ── Header whitespace ───────────────────────────────────────────────────── */
section("7. Header whitespace tolerance");

await ok("space-separated parts accepted", `t=${ts}, v1=${sign(BODY, SECRET, ts)}`);
await ok("leading/trailing whitespace on parts accepted", ` t=${ts} , v1=${sign(BODY, SECRET, ts)} `);

/* ── Source-level guarantees ─────────────────────────────────────────────── */
section("8. The reason never leaves the Worker");

check("call site trims the signing secret",
  /\(env\.STRIPE_BILLING_WEBHOOK_SECRET \|\| ''\)\.trim\(\)/.test(SRC));
check("rejection reason is logged", /rejected reason=' \+ verdict\.reason/.test(SRC));
check("response body stays opaque",
  /new Response\('Invalid signature', \{ status: 400 \}\)/.test(SRC));
check("reason is NOT interpolated into any Response body",
  !/new Response\([^)]*verdict\.reason/.test(SRC));
check("verification result is used as an object, not a bare boolean",
  /if \(!verdict\.ok\)/.test(SRC));
check("Worker still holds no Stripe credential", !/env\.STRIPE_SECRET_KEY/.test(SRC));

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
