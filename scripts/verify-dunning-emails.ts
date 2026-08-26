/* Declare & Believe — the failed-payment email sequence.
 *
 * WHY THIS SUITE EXISTS
 * Nothing else can check this. The sequence is scheduled by a mutation and the
 * later stages fire days afterwards, so the only way to be wrong about it is to
 * be wrong in production, to a subscriber whose card just failed. Every
 * property below is therefore either EXECUTED against the real module or
 * asserted against source.
 *
 * The four failures this is built to prevent, in the order they would hurt:
 *   1. an email promising a date the entitlement layer will not honour
 *   2. an email arriving after the person already paid
 *   3. a fresh set of emails after every Stripe retry
 *   4. copy that reads as a threat to somebody who came here in distress
 *
 * No network, no credential, no Stripe call, no email sent.
 * Run:  node --experimental-strip-types scripts/verify-dunning-emails.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
/* IMPORTED AND EXECUTED, not grepped. dunningSchedule.ts is dependency-free for
   exactly this reason — the same reason plusPlans.ts and subscriptionGuard.ts
   are. A grep proves the file mentions a rule; running it proves the rule. */
import {
  dunningDelayMs, dunningSchedule, copyFor, render, money, longDate,
} from "../convex/dunningSchedule.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/* The live setting, read as TEXT rather than imported: entitlementCatalog.ts is
   a Convex module and cannot be executed here. Parsing the one number keeps the
   suite honest about the value actually in force while leaving the schedule
   functions themselves fully executable at ANY window. */
const CATALOG = read("convex/entitlementCatalog.ts");
const PAST_DUE_GRACE_DAYS = Number(
  (CATALOG.match(/export const PAST_DUE_GRACE_DAYS = (\d+)/) || [])[1],
);
const PAST_DUE_GRACE_MS = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

const DUNNING = read("convex/dunning.ts");
const SCHEDULE = read("convex/dunningSchedule.ts");
const SUBS = read("convex/subscriptions.ts");
const ENTITLEMENTS = read("convex/entitlements.ts");

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

const DAY = 24 * 60 * 60 * 1000;

/* ── 1. The schedule is derived, never typed twice ───────────────────────── */
section("1. Every send time comes from the grace window");

check("the first email is immediate", dunningDelayMs("failed", PAST_DUE_GRACE_MS) === 0);
check("the pause email lands exactly when access stops",
  dunningDelayMs("paused", PAST_DUE_GRACE_MS) === PAST_DUE_GRACE_MS);
/* THE failure mode this prevents: grace is 3 days while Stripe retries for 14.
   A cadence written against Stripe's schedule would have promised a week that
   our own entitlement layer would not honour. */
check("the pause email is tied to OUR grace, not Stripe's retry window",
  dunningDelayMs("paused", PAST_DUE_GRACE_MS) === PAST_DUE_GRACE_DAYS * DAY);
check("no stage is scheduled beyond the grace window",
  dunningSchedule(PAST_DUE_GRACE_MS).every((s) => (dunningDelayMs(s, PAST_DUE_GRACE_MS) ?? 0) <= PAST_DUE_GRACE_MS));
check("stages are strictly ordered in time", (() => {
  const d = dunningSchedule(PAST_DUE_GRACE_MS).map((s) => dunningDelayMs(s, PAST_DUE_GRACE_MS) ?? -1);
  return d.every((v, i) => i === 0 || v > d[i - 1]);
})());

/* The warning email exists only while it can be meaningfully distinct from the
   pause email. Squeezing three emails into a two-day window is nagging. */
if (PAST_DUE_GRACE_DAYS >= 3) {
  check("a final warning is sent 24h before access stops",
    dunningDelayMs("ending", PAST_DUE_GRACE_MS) === PAST_DUE_GRACE_MS - DAY);
  check("the sequence is three emails at this grace setting",
    dunningSchedule(PAST_DUE_GRACE_MS).length === 3);
} else {
  check("no warning email is squeezed into a short grace window",
    dunningDelayMs("ending", PAST_DUE_GRACE_MS) === null);
  check("the sequence is two emails at this grace setting",
    dunningSchedule(PAST_DUE_GRACE_MS).length === 2);
}

/* Skipping the last email before lockout is the single most-cited mistake in
   dunning design. Whatever the grace, SOMETHING must arrive before access ends. */
check("something always arrives before access stops",
  dunningSchedule(PAST_DUE_GRACE_MS).some((s) => {
    const d = dunningDelayMs(s, PAST_DUE_GRACE_MS);
    return d !== null && d < PAST_DUE_GRACE_MS;
  }));
check("the sequence ends — there is no fourth email",
  dunningSchedule(PAST_DUE_GRACE_MS).length <= 3);

/* Proven at OTHER windows, not just the one currently configured. The grace
   setting is documented as awaiting approval, so the schedule has to stay
   correct at whatever it becomes — including the 14 days that would match
   Stripe's own retry window. */
for (const days of [2, 3, 7, 14, 28]) {
  const ms = days * DAY;
  const sched = dunningSchedule(ms);
  check(`at ${days}-day grace the pause email lands on the day access stops`,
    dunningDelayMs("paused", ms) === ms);
  check(`at ${days}-day grace nothing is scheduled after access stops`,
    sched.every((s) => (dunningDelayMs(s, ms) ?? 0) <= ms));
  check(`at ${days}-day grace something warns before access stops`,
    sched.some((s) => { const d = dunningDelayMs(s, ms); return d !== null && d < ms; }));
  check(`at ${days}-day grace there are never more than three emails`, sched.length <= 3);
  check(`at ${days}-day grace the stages are strictly ordered`, (() => {
    const d = sched.map((s) => dunningDelayMs(s, ms) ?? -1);
    return d.every((v, i) => i === 0 || v > d[i - 1]);
  })());
}
check("a two-day window drops the warning rather than squeezing it",
  dunningSchedule(2 * DAY).length === 2 && dunningDelayMs("ending", 2 * DAY) === null);
check("a three-day window is the shortest that carries a warning",
  dunningDelayMs("ending", 3 * DAY) === 2 * DAY);

/* ── 2. It fires once per episode, not once per retry ────────────────────── */
section("2. Scheduled on the transition, never on the event");

check("scheduling is guarded by a not-previously-failing check",
  /!wasFailing/.test(SUBS));
check("a brand-new row is not treated as a lapse",
  /existing && isFailing && !wasFailing/.test(SUBS));
check("lifetime is excluded — it has no renewal to fail",
  /!wasFailing && fields\.planKey !== "plus_lifetime"/.test(SUBS));
/* If these two sets ever diverged we would either email somebody whose access
   was never at risk, or stay silent while it ran out. */
check("the failing statuses match the ones entitlements grants grace to",
  /FAILING_STATUSES[\s\S]{0,200}"past_due", "unpaid"/.test(SUBS) &&
  /status === "past_due" \|\| status === "unpaid"/.test(ENTITLEMENTS));
check("sends are scheduled, not attempted inside the mutation",
  /ctx\.scheduler\.runAfter\(delay, internal\.dunning\.sendDunningEmail/.test(SUBS) &&
  !/resend/i.test(SUBS));

/* ── 3. Every stage re-checks before sending ─────────────────────────────── */
section("3. An email that has become untrue is not sent");

check("the subscription is re-read at send time",
  /getByUserProviderInternal/.test(DUNNING));
check("a recovered or ended subscription cancels the remaining emails",
  /STILL_FAILING\.has\(sub\.status\)/.test(DUNNING) &&
  /recovered-or-ended/.test(DUNNING));
check("a missing subscription sends nothing", /no-subscription/.test(DUNNING));
check("a lifetime row sends nothing", /not-applicable/.test(DUNNING));
check("a missing address sends nothing rather than throwing",
  /no-address/.test(DUNNING));
/* The date in the email must be the date the product enforces, computed the
   same way rather than approximated. */
check("the pause date uses the same arithmetic as entitlements",
  /PAST_DUE_GRACE_MS/.test(DUNNING) &&
  /currentPeriodEnd \? sub\.currentPeriodEnd \* 1000 : sub\.updatedAt/.test(DUNNING));

/* ── 4. Anti-phishing ────────────────────────────────────────────────────── */
section("4. It survives a reader trained to distrust this exact message");

/* "Your payment failed, update your payment information" is among the most
   common phishing templates in existence. */
check("the card brand and last four are included — a phisher knows neither",
  /card\?\.brand/.test(DUNNING) && /card\?\.last4/.test(DUNNING));
check("an alternative to clicking the link is offered",
  /open Declare and go to Billing/.test(SCHEDULE));
check("the link points at our own site, never a Stripe-hosted URL",
  /site \+ "\/billing"/.test(DUNNING) && !/billing\.stripe\.com/.test(DUNNING) && !/billing\.stripe\.com/.test(SCHEDULE));
check("failing to read the card degrades the wording rather than the send",
  /catch \{[\s\S]{0,300}\}/.test(DUNNING) && /facts\.card \? /.test(SCHEDULE));

/* ── 5. Tone ─────────────────────────────────────────────────────────────── */
section("5. Nothing here reads as a threat");

/* An app reached at 3am by people in fear and shame must not adopt
   collections-agency language. In a faith app "your access has been withdrawn"
   can land as a verdict on the person rather than a billing status. */
/* Rendered for real, with realistic facts, so these assertions read the words a
   subscriber would actually receive rather than the source that produces them. */
const FACTS = { card: "Visa ···· 4242", amount: "$8.99", pausesOn: "September 26, 2026" };
const RENDERED = dunningSchedule(PAST_DUE_GRACE_MS)
  .map((s) => {
    const c = copyFor(s, FACTS);
    return c.subject + "\n" + c.heading + "\n" + c.body.join("\n") + "\n" + (c.cta ?? "");
  })
  .join("\n\n");

for (const banned of [
  "suspended", "terminated", "revoked", "delinquent", "overdue",
  "immediately", "final notice", "failure to", "will be lost",
]) {
  check(`no email says "${banned}"`,
    !new RegExp("\\b" + banned + "\\b", "i").test(RENDERED));
}
check("no capitalised shouting", !/[A-Z]{4,}/.test(RENDERED.replace(/Declare|Plus|Visa|Billing/g, "")));
check("no exclamation marks", !RENDERED.includes("!"));
check("the fault is placed on the card, not the reader",
  /rather than anything you did/.test(RENDERED));
check("the first email says nothing has been lost",
  copyFor("failed", FACTS).body.join(" ").includes("Nothing has been lost"));
check("the pause email states the free experience continues",
  copyFor("paused", FACTS).body.join(" ").includes("You still have Declare"));

/* Every email carries the four fields the good ones do, and exactly one action. */
for (const stage of dunningSchedule(PAST_DUE_GRACE_MS)) {
  const c = copyFor(stage, FACTS);
  check(`"${stage}" has a subject`, c.subject.length > 0 && c.subject.length < 80);
  check(`"${stage}" names the card`, c.body.join(" ").includes(FACTS.card));
  check(`"${stage}" offers exactly one action`, typeof c.cta === "string" && c.cta.length > 0);
  const html = render(c, "https://declareandbelieve.com/billing");
  const links = (html.match(/<a /g) || []).length;
  check(`"${stage}" renders exactly one link`, links === 1);
  check(`"${stage}" renders no image or tracking pixel`, !/<img/i.test(html));
}
check("only the first two emails name the pause date — the last one has passed it",
  copyFor("failed", FACTS).body.join(" ").includes(FACTS.pausesOn) &&
  !copyFor("paused", FACTS).body.join(" ").includes(FACTS.pausesOn));
check("the amount appears in the first email", copyFor("failed", FACTS).body.join(" ").includes("$8.99"));

/* Missing facts degrade the sentence rather than printing a gap. */
const BARE = copyFor("failed", { card: null, amount: null, pausesOn: "September 26, 2026" });
check("a missing card leaves no empty bracket", !/\(\s*\)/.test(BARE.body.join(" ")));
/* The real property: dropping a fact must not leave punctuation or spacing
   debris. "Your payment for Declare Plus" is the CORRECT degraded sentence —
   the first version of this check matched that and failed a working string. */
check("a missing amount leaves no double space or repeated preposition",
  !/ {2,}/.test(BARE.body.join(" ")) && !/\bfor\s+for\b/.test(BARE.body.join(" ")));
check("a missing amount still reads as a sentence",
  BARE.body[0].includes("Your payment for Declare Plus didn't go through"));
check("a missing card still names the pause date", BARE.body.join(" ").includes("September 26, 2026"));

/* The formatters, executed. */
check("money formats minor units", money(899, "usd") === "$8.99");
check("money survives an unknown currency", money(899, "zzz") === null || typeof money(899, "zzz") === "string");
check("money returns null rather than NaN", money(null, "usd") === null);
check("longDate is a readable date, not an ISO string",
  /^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(longDate(Date.UTC(2026, 8, 26))));

/* Hardship in the FIRST email. Somebody who cannot pay should hear it before
   they have spent the whole window worrying, and must not be made to explain
   themselves twice. */
check("hardship help is offered in the first email",
  /if money is the reason/i.test(SCHEDULE));
check("the hardship offer asks for no proof",
  /not be asked to explain yourself twice/.test(SCHEDULE));

/* ── Result ──────────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
