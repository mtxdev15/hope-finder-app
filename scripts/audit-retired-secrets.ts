/* Declare & Believe — retired-webhook secret audit.
 *
 * Answers one question mechanically, so it can be re-run before and after any
 * operational removal: does anything that actually SHIPS read the two retired
 * secrets, and could removing them re-open a path?
 *
 * Why this exists as a tool rather than a one-off grep: a regex-based comment
 * stripper got this wrong in BOTH directions on worker/src/index.js — it
 * reported the retirement comment block as executable, and reported real
 * `env.BILLING_WEBHOOK_SECRET` reads as prose. The file documents the retired
 * routes in detail, so its comments are full of the exact identifiers being
 * searched for. An audit whose central claim is "zero executable readers"
 * cannot rest on a stripper that mislabels lines, so this uses a character-level
 * scanner that tracks strings, templates and regex literals.
 *
 * Scope note: only files tracked by git on the current branch are scanned. A
 * stale agent worktree under .claude/worktrees/ holds PRE-parity source
 * (gifts.ts, give.js, the billing-portal IDOR). It is git-ignored and ships
 * nowhere; including it would invent readers that do not exist.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { blankComments } from "./lib-strip-comments.mjs";

const RETIRED = ["GIFT_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET"];
const BILLING = ["STRIPE_BILLING_WEBHOOK_SECRET", "BILLING_WEBHOOK_SECRET", "STRIPE_SECRET_KEY"];

/* Two scopes, deliberately separated. RUNTIME is what actually ships and is the
 * only thing that can read a secret in production. TOOLING is scripts/, which
 * mentions these identifiers precisely because it asserts their absence —
 * counting a test's own assertion as a "reader" is how an audit talks itself
 * into a false positive. */
const tracked = execSync("git ls-files").toString().split("\n")
  .filter((f) => /\.(js|ts|astro|toml)$/.test(f) && !f.includes("_generated"));
const isRuntime = (f: string) => /^(worker|convex|src|public)\//.test(f);
const files = tracked.filter(isRuntime);
const tooling = tracked.filter((f) => !isRuntime(f));

type Row = { file: string; line: number; token: string; exec: boolean; text: string };
const rows: Row[] = [];
for (const p of files) {
  const src = readFileSync(p, "utf8");
  const code = p.endsWith(".toml") ? src.replace(/^\s*#.*$/gm, "") : blankComments(src);
  const O = src.split("\n"), C = code.split("\n");
  O.forEach((line, i) => {
    for (const t of [...RETIRED, ...BILLING]) {
      if (line.includes(t)) rows.push({ file: p, line: i + 1, token: t, exec: (C[i] || "").includes(t), text: line.trim().slice(0, 90) });
    }
  });
}

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }

console.log("\nExecutable readers (comments excluded)\n");
for (const t of [...RETIRED, ...BILLING]) {
  const ex = rows.filter((r) => r.token === t && r.exec);
  console.log("  %s  executable=%d  in-comment=%d", t.padEnd(30), ex.length, rows.filter((r) => r.token === t && !r.exec).length);
  ex.forEach((r) => console.log("      " + r.file + ":" + r.line));
}

/* Reported, not asserted: tooling mentions are expected and harmless. */
const toolingHits = tooling.flatMap((p) => {
  const C = blankComments(readFileSync(p, "utf8")).split("\n");
  return C.flatMap((l, i) => [...RETIRED, ...BILLING].filter((t) => l.includes(t)).map((t) => p + ":" + (i + 1) + " (" + t + ")"));
});
console.log("\nTooling mentions (assertions about these names, not readers)\n");
toolingHits.forEach((h) => console.log("  " + h));
if (!toolingHits.length) console.log("  none");

console.log("\nAssertions (runtime source only)\n");
for (const t of RETIRED) check("retired secret has ZERO executable readers: " + t, rows.filter((r) => r.token === t && r.exec).length === 0);

/* Removing a retired secret must not re-open anything. Two ways that could
 * happen, both checked: a fallback chain naming it, and a billing gate that
 * accepts a retired name as a substitute. */
const CODE = files.filter((f) => /\.(js|ts)$/.test(f))
  .map((p) => blankComments(readFileSync(p, "utf8"))).join("\n");
for (const t of RETIRED) {
  check("no fallback chain reaches " + t, !new RegExp("(\\|\\||\\?\\?)\\s*[A-Za-z_.]*" + t).test(CODE));
  check("nothing falls back FROM " + t, !new RegExp(t + "\\s*(\\|\\||\\?\\?)").test(CODE));
}
check("the billing webhook gate names only billing secrets",
  /!env\.STRIPE_BILLING_WEBHOOK_SECRET \|\| !env\.CONVEX_SITE_URL \|\| !env\.BILLING_WEBHOOK_SECRET/.test(CODE));
check("the billing webhook fails CLOSED when unconfigured",
  /Webhook not configured'?,? \{ status: 500/.test(CODE) || /'Webhook not configured', \{ status: 500 \}/.test(CODE));
check("signature verification names the billing secret explicitly",
  /verifyStripeSignature\([\s\S]{0,120}env\.STRIPE_BILLING_WEBHOOK_SECRET/.test(CODE));
check("the retired giving routes still answer 410",
  /donations-retired'\s*\}\s*,\s*410/.test(CODE));
check("no giving handler is reachable", !/handleGive[A-Za-z]*\(/.test(CODE));
check("no billing-portal handler is reachable", !/handleBillingPortal/.test(CODE));

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
