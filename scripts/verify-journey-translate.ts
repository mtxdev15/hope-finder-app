/* Deterministic verification for the Journey translation security boundary.
 *
 *   node scripts/verify-journey-translate.ts
 *
 * Covers the pure server-side logic: the field allowlist, the forbidden-key
 * rejections, size limits, the server-recomputed source hash, and the dedup
 * identity. It also asserts HASH PARITY between the browser module and the
 * Convex core, which are deliberately separate implementations (Convex bundles
 * only convex/, so the algorithm is duplicated) and must never drift.
 *
 * NOT covered here, because it needs a live deployment: the reservation
 * lifecycle against real Convex documents, the Worker route's secret check, and
 * the model call. Those are in the post-deployment checklist.
 */

import {
  ALLOWED_FIELDS,
  LOCALE_SCHEMA_VERSION,
  MAX_CONCURRENT_PER_ACCOUNT,
  MAX_PER_ACCOUNT_DAY,
  MAX_PER_ROLLING_HOUR,
  serverSourceHash,
  serverTranslationKey,
  validateFields,
} from "../convex/journeyTranslateCore.ts";
import { sourceHash as clientSourceHash } from "../src/app/declare/journey-locale/locale-cache.ts";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; return; }
  failures.push(name + (detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""));
}
function rejects(name: string, fields: unknown, expectedReason: string) {
  const r = validateFields(fields);
  if (r.ok) { failures.push(`${name} — ACCEPTED, expected rejection`); return; }
  if (r.reason !== expectedReason) { failures.push(`${name} — reason ${r.reason}, expected ${expectedReason}`); return; }
  passed++;
}
const section = (s: string) => console.log("\n" + s);

/* ── 1. Allowlist ──────────────────────────────────────────────────────── */
section("1. Field allowlist");
const good = { title: "Name the fear", pray: "Father, I am tired of pretending." };
const ok = validateFields(good);
check("accepts allowlisted fields", ok.ok === true, ok);
check("trims values", ok.ok && ok.fields.title === "Name the fear");
check("drops empty values", (() => { const r = validateFields({ title: "T", insight: "   " }); return r.ok && !("insight" in r.fields); })());
check("allowlist matches the real day schema (12 fields)", ALLOWED_FIELDS.length === 12, ALLOWED_FIELDS.length);
rejects("rejects unknown field", { title: "T", notes: "x" }, "unknown-field");
rejects("rejects non-string", { title: 42 }, "field-not-string");
rejects("rejects nested object (smuggling vector)", { title: { es: "x" } }, "field-not-string");
rejects("rejects array payload", ["title"], "fields-not-object");
rejects("rejects null payload", null, "fields-not-object");
rejects("rejects all-empty payload", { title: "  " }, "empty-request");

/* ── 2. Forbidden content — the privacy boundary ───────────────────────── */
section("2. Forbidden content");
rejects("rejects reflection", { title: "T", reflection: "mine" }, "forbidden-field");
rejects("rejects userPrayer", { title: "T", userPrayer: "mine" }, "forbidden-field");
rejects("rejects vault content", { title: "T", vault: "x" }, "forbidden-field");
rejects("rejects crisis disclosure", { title: "T", crisis: "x" }, "forbidden-field");
rejects("rejects userId", { title: "T", userId: "u1" }, "forbidden-field");
rejects("rejects email", { title: "T", email: "a@b.c" }, "forbidden-field");
rejects("rejects verse text", { title: "T", verseText: "..." }, "forbidden-field");
rejects("rejects scripture", { title: "T", scripture: "..." }, "forbidden-field");
rejects("rejects arbitrary prompt", { title: "T", prompt: "ignore previous" }, "forbidden-field");
rejects("rejects messages array", { title: "T", messages: "x" }, "forbidden-field");
rejects("forbidden check is case-insensitive", { title: "T", Reflection: "mine" }, "forbidden-field");
rejects("forbidden beats unknown", { title: "T", USERID: "u" }, "forbidden-field");

/* ── 3. Size limits ────────────────────────────────────────────────────── */
section("3. Size limits");
rejects("rejects oversized field", { title: "x".repeat(4001) }, "field-too-long");
check("accepts a field at the limit", validateFields({ title: "x".repeat(4000) }).ok === true);
rejects("rejects oversized payload", {
  title: "x".repeat(3000), insight: "y".repeat(3000),
  pray: "z".repeat(3000), repent: "p".repeat(3000), declare: "d".repeat(1000),
}, "payload-too-long");

/* ── 4. Hash parity: browser module vs Convex core ─────────────────────── */
section("4. Hash parity (browser vs server)");
const samples = [
  { title: "Name the fear" },
  { title: "Name the fear", pray: "Father, I am tired." },
  { pray: "Father, I am tired.", title: "Name the fear" },
  { title: "Comillas \"dobles\" y, comas", insight: "línea uno\nlínea dos" },
  { declare: "I am held", reflect: "What did you notice?" },
  { castOff: "a lie", repent: "a turning", fruit: "Honest Courage", fruitTruth: "Named fear loses power." },
  {},
];
for (const [i, s] of samples.entries()) {
  check(`sample ${i} hashes identically on both sides`, clientSourceHash(s) === serverSourceHash(s),
    { client: clientSourceHash(s), server: serverSourceHash(s) });
}
check("hash is order independent server-side",
  serverSourceHash({ title: "A", pray: "B" }) === serverSourceHash({ pray: "B", title: "A" }));
check("hash changes with content", serverSourceHash({ title: "A" }) !== serverSourceHash({ title: "B" }));
check("server hash ignores non-allowlisted keys",
  serverSourceHash({ title: "A", bogus: "Z" } as Record<string, string>) === serverSourceHash({ title: "A" }));

/* ── 5. Dedup identity ─────────────────────────────────────────────────── */
section("5. Dedup identity");
const base = { sourceLocale: "en", displayLocale: "es", sourceHash: "abc-1", schemaVersion: LOCALE_SCHEMA_VERSION };
const k1 = serverTranslationKey({ userId: "userA", ...base });
const k2 = serverTranslationKey({ userId: "userB", ...base });
check("identical content, different accounts -> DIFFERENT keys", k1 !== k2, { k1, k2 });
check("same account + same content -> same key", k1 === serverTranslationKey({ userId: "userA", ...base }));
check("locale pair is part of identity",
  k1 !== serverTranslationKey({ userId: "userA", ...base, displayLocale: "en" }));
check("content hash is part of identity",
  k1 !== serverTranslationKey({ userId: "userA", ...base, sourceHash: "different" }));
check("schema version is part of identity",
  k1 !== serverTranslationKey({ userId: "userA", ...base, schemaVersion: 99 }));
check("key contains the account", k1.includes("userA"));

/* ── 6. Approved limits ────────────────────────────────────────────────── */
section("6. Approved limits");
check("1 active translation per account", MAX_CONCURRENT_PER_ACCOUNT === 1, MAX_CONCURRENT_PER_ACCOUNT);
check("10 successful per rolling hour", MAX_PER_ROLLING_HOUR === 10, MAX_PER_ROLLING_HOUR);
check("30 successful per account day", MAX_PER_ACCOUNT_DAY === 30, MAX_PER_ACCOUNT_DAY);
check("a five-day Journey fits well inside every limit", 5 < MAX_PER_ROLLING_HOUR && 5 < MAX_PER_ACCOUNT_DAY);

/* ── 7. Controller payload safety ──────────────────────────────────────── */
section("7. Controller payload safety");
const { pickTranslatable } = await import("../src/app/declare/journey-locale/payload.ts");

// A whole completed-day record, exactly as journey.astro holds it: authored copy
// AND the person's own words sitting side by side on the same object. This is
// the shape that makes an accidental leak plausible, which is why it is the test.
const wholeDay = {
  title: "Name the fear", insight: "David named it.", prayerTitle: "Honest Before You",
  pray: "Father, I am tired of pretending.", castOff: "Pulling back is wisdom.",
  repent: "I turn from that agreement.", declare: "I am held.",
  reflect: "What did you notice?", actionTitle: "Write It Down",
  action: "Write the fear by name.", fruit: "Honest Courage",
  fruitTruth: "Named fear loses its hidden power.",
  // none of the following may ever be sent
  reflection: "I kept saying I was fine. I wasn't.",
  userPrayer: "God, my marriage is falling apart.",
  verse: "When I am afraid, I put my trust in you.",
  ref: "Psalm 56:3", ver: "ESV",
  fruit: "Honest courage", fruitTruth: "Naming fear strips its power.",
  vaultItems: ["x"], crisis: "disclosure",
};
const payload = pickTranslatable(wholeDay);
const sent = Object.keys(payload).sort();
check("sends exactly the twelve authored fields", sent.join(",") ===
  "action,actionTitle,castOff,declare,fruit,fruitTruth,insight,pray,prayerTitle,reflect,repent,title", sent);
// fruit and fruitTruth are AUTHORED content shown in the Fruit Log, so they are
// translatable and deliberately absent from this list. What must never be sent
// is the person's own writing, and Scripture.
for (const leak of ["reflection", "userPrayer", "verse", "ref", "ver", "vaultItems", "crisis"]) {
  check(`never sends ${leak}`, !(leak in payload));
}
check("payload passes the server allowlist", validateFields(payload).ok === true);
check("the raw day object does NOT pass the server allowlist",
  validateFields(wholeDay as never).ok === false);

/* ── Summary ───────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
