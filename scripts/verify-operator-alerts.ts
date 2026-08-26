/* Declare & Believe — the welcome email, and the alerts that reach a person.
 *
 * TWO ABSENCES THIS PINS DOWN, both found in the pre-launch audit on 2026-08-26.
 *
 * 1. BILLING HAD NO WELCOME. Four emails for a failed payment, one before a
 *    trial charges, and nothing at the moment somebody decides to trust us with
 *    money. The first message a new subscriber ever received from Declare was
 *    either a dunning notice or silence.
 *
 * 2. EIGHT `console.log("[billing] ...")` LINES REACHED NOBODY. Every one marked
 *    a case where money moved and Stripe and Convex disagree about what it
 *    bought: a payment matching no account, a duplicate subscription, a refund
 *    we owed and could not send. All of them stopped at the Convex log, which
 *    nobody watches. You do not find these by looking; you find them when a
 *    customer emails weeks later asking where their money went.
 *
 * The copy is IMPORTED and EXECUTED, not grepped, so a suite failure means the
 * words a reader would actually receive are wrong.
 *
 * No network, no credential, no deployment, no Stripe call, no email sent.
 * Run:  node scripts/verify-operator-alerts.ts
 */
import { readFileSync } from "node:fs";
import { welcomeCopy, type WelcomeKind } from "../convex/dunningSchedule.ts";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

const DUNNING = read("convex/dunning.ts");
const SCHEDULE = read("convex/dunningSchedule.ts");
const SUBS = read("convex/subscriptions.ts");
const BILLING = read("convex/billing.ts");
const SCHEMA = read("convex/schema.ts");

const KINDS: WelcomeKind[] = ["trial", "paid", "lifetime"];
const LANGS = ["en", "es"] as const;
const FACTS = { amount: "$8.99", chargesOn: "September 2", renewsOn: "September 2" };

/* ── 1. The welcome exists, in both languages, for all three kinds ───────── */
section("1. Every kind of Plus has a welcome, in both languages");

for (const kind of KINDS) {
  for (const lang of LANGS) {
    const c = welcomeCopy(kind, FACTS, lang);
    check(`${kind}/${lang} has a subject`, c.subject.length > 8);
    check(`${kind}/${lang} has a heading`, c.heading.length > 4);
    check(`${kind}/${lang} says something`, c.body.length >= 3);
    check(`${kind}/${lang} has one action`, typeof c.cta === "string" && c.cta.length > 2);
    check(`${kind}/${lang} says why it arrived`, c.footer.length > 20);
    /* Not a newsletter, and the footer has to say so. Nobody should have to opt
       out of being told what they bought. */
    check(`${kind}/${lang} is not framed as marketing`,
      /subscription|suscripci/i.test(c.footer));
  }
}
/* Spanish must be TRANSLATED, not English with a Spanish subject. */
for (const kind of KINDS) {
  const en = welcomeCopy(kind, FACTS, "en");
  const es = welcomeCopy(kind, FACTS, "es");
  check(`${kind} is really translated`,
    es.subject !== en.subject && es.heading !== en.heading &&
    es.body.every((b, i) => b !== en.body[i]));
}

/* ── 2. The three say different things, because three things happened ────── */
section("2. Each kind states the fact that kind of buyer needs");

for (const lang of LANGS) {
  const trial = welcomeCopy("trial", FACTS, lang);
  const paid = welcomeCopy("paid", FACTS, lang);
  const life = welcomeCopy("lifetime", FACTS, lang);

  /* The trial's whole job is the date a charge WILL happen. That is the
     promise /pricing makes, arriving somewhere they can find it later. */
  check(`trial/${lang} names the day the card is charged`,
    trial.body.join(" ").includes("September 2"));
  check(`trial/${lang} promises the reminder`, /3/.test(trial.body.join(" ")));

  check(`paid/${lang} names the renewal date`, paid.body.join(" ").includes("September 2"));

  /* LIFETIME MUST NOT PROMISE A RENEWAL, and must not name a date at all: it
     has no next charge, and a date in this email would invent one. */
  check(`lifetime/${lang} names no date`, !life.body.join(" ").includes("September 2"));
  check(`lifetime/${lang} says nothing renews`,
    /renew|renovaci|renueva/i.test(life.body.join(" ")));
  check(`lifetime/${lang} says no card is kept`,
    /card on file|tarjeta/i.test(life.body.join(" ")));
  /* Its button cannot point at a billing page with nothing to manage. */
  check(`lifetime/${lang} does not offer to manage a plan`,
    !/cancel|cancela/i.test(String(life.cta)));
}

/* ── 3. Missing facts degrade the sentence, never print a hole ───────────── */
section("3. An absent fact is a different sentence, not a blank");

for (const lang of LANGS) {
  for (const kind of KINDS) {
    const bare = welcomeCopy(kind, { amount: null, chargesOn: null, renewsOn: null }, lang);
    const all = bare.subject + bare.heading + bare.body.join(" ") + bare.footer;
    check(`${kind}/${lang} with no facts prints no null`, !/null|undefined|NaN/.test(all));
    check(`${kind}/${lang} with no facts leaves no empty slot`, !/\{\w+\}/.test(all));
    check(`${kind}/${lang} with no facts still says something`, bare.body.length >= 3);
  }
}

/* ── 4. Brand rules, on words a customer reads ───────────────────────────── */
section("4. The locked brand rules hold");

for (const kind of KINDS) {
  for (const lang of LANGS) {
    const c = welcomeCopy(kind, FACTS, lang);
    const all = [c.subject, c.heading, ...c.body, String(c.cta)].join(" ");
    check(`${kind}/${lang} uses no em or en dash`, !/[—–]/.test(all));
    /* Courtroom language is banned outright, and "sentence" and "judge" would
       both be easy to reach for in an email about paying. */
    check(`${kind}/${lang} uses no courtroom language`,
      !/\b(verdict|defendant|convicted|sentenced)\b/i.test(all));
    check(`${kind}/${lang} speaks to one person`, !/\byou all\b|\bfolks\b/i.test(all));
  }
}
/* The one promise that outranks the plan. */
for (const lang of LANGS) {
  const paid = welcomeCopy("paid", FACTS, lang);
  check(`paid/${lang} still says Scripture is the same on every plan`,
    /Scripture is the same|la Palabra es la misma/i.test(paid.body.join(" ")));
}

/* ── 5. Sent exactly once, and only if the grant committed ───────────────── */
section("5. Exactly once, and never for a purchase that rolled back");

check("the row carries a welcomed flag", /welcomedAt: v\.optional\(v\.number\(\)\)/.test(SCHEMA));
check("the flag is stamped by the granting mutation, not the email job",
  /\.\.\.\(becomesPlus \? \{ welcomedAt: now \} : \{\}\)/.test(SUBS));
check("and the flag is what stops a second send",
  /becomesPlus[\s\S]{0,300}!existing\?\.welcomedAt/.test(SUBS));
/* Read from the resolved TIER, not from the event name: checkout.session.completed
   also fires for a session that produced an incomplete subscription, and
   invoice.paid fires for a zero-amount trial invoice. */
check("becoming Plus is read from the tier, not the event name",
  /tierForStatus\(args\.status, args\.planKey\) === "plus"/.test(SUBS));
check("the send is scheduled from inside the granting mutation",
  /ctx\.scheduler\.runAfter\(0, internal\.dunning\.sendWelcomeEmail/.test(SUBS));
/* It re-checks before sending, like every other email in dunning.ts: a purchase
   refunded seconds later must not produce a welcome. */
const WELCOME = DUNNING.slice(DUNNING.indexOf("export const sendWelcomeEmail"));
check("the send re-checks the subscription still grants Plus",
  /sub\.tier !== "plus"/.test(WELCOME));
check("it reads which kind from the row, not from its caller",
  /sub\.planKey === "plus_lifetime" \? "lifetime"/.test(WELCOME));
check("it never throws, so a full inbox cannot retry a webhook",
  !/\bthrow\b/.test(WELCOME));

/* ── 6. The alerts that reach a person ───────────────────────────────────── */
section("6. Money-and-data disagreements reach a human");

check("there is an operator alert action", /export const notifyOperator = internalAction/.test(DUNNING));
for (const kind of [
  "unmatched-payment",
  "duplicate-subscription",
  "lifetime-not-replaceable",
  "lifetime-upgrade-needs-human",
]) {
  check(`"${kind}" has copy an operator can act on`,
    new RegExp('"' + kind + '": \\{').test(DUNNING));
}
/* Every alerting kind must be REACHED. Copy for a case nothing fires is worse
   than no copy: it reads as covered. */
check("unmatched payments alert", /kind: "unmatched-payment"/.test(SUBS));
check("subscription conflicts alert", /kind: verdict\.reason/.test(SUBS));
check("an owed refund alerts", /kind: "lifetime-upgrade-needs-human"/.test(BILLING));

/* NOT everything alerts, and that is the design. An alert that fires during
   normal operation is one nobody reads by week three. */
check("ordinary grace expiry does not alert",
  !/grace-expired[\s\S]{0,400}notifyOperator/.test(SUBS));
check("a successful upgrade does not alert",
  !/lifetime-superseded-subscription[\s\S]{0,400}notifyOperator/.test(SUBS));
check("the quiet superseded tail does not alert",
  !/lifetime-superseded"[\s\S]{0,500}notifyOperator/.test(SUBS));
/* An unmatched subscription lifecycle event is noise from another product on
   the same Stripe account. Only events that can carry money alert. */
check("only payment-bearing events alert when unmatched",
  /PAYMENT_BEARING_EVENTS\.has\(args\.eventType\)/.test(SUBS));

/* ── 7. What an alert may carry out of the system ────────────────────────── */
section("7. An alert is still an email leaving our system");

const NOTIFY = DUNNING.slice(DUNNING.indexOf("export const notifyOperator"));
for (const banned of ["email", "card", "last4", "stripeCustomerId", "customer"]) {
  check(`the alert payload carries no ${banned}`,
    !new RegExp("args\\." + banned + "\\b").test(NOTIFY));
}
check("its arguments are only ids, an amount and a short detail",
  /args: \{\s*kind: v\.string\(\),[\s\S]{0,400}?detail: v\.optional\(v\.string\(\)\),\s*\},/.test(NOTIFY));
check("an unknown kind sends nothing rather than a blank alert",
  /if \(!spec\) return \{ sent: false, reason: "unknown-kind" \}/.test(NOTIFY));
check("no operator address configured means no send, not a crash",
  /if \(!to\) return \{ sent: false, reason: "no-operator-email" \}/.test(NOTIFY));
check("it never throws", !/\bthrow\b/.test(NOTIFY));
/* One email per Stripe event, structurally: each caller schedules from the
   transaction that writes its single billingEvents row, and that row is written
   once per (provider, eventId). A redelivery storm cannot become an inbox storm. */
check("alerts are scheduled, never sent inline from a webhook",
  (SUBS.match(/internal\.dunning\.notifyOperator/g) || []).length ===
    (SUBS.match(/scheduler\.runAfter\(0, internal\.dunning\.notifyOperator/g) || []).length);

/* ── 8. The welcome copy still lives with the other email copy ───────────── */
section("8. One home for words a customer reads");

check("welcomeCopy is in dunningSchedule, beside the dunning copy",
  /export function welcomeCopy/.test(SCHEDULE));
check("dunningSchedule still imports nothing from Convex",
  !/from "convex\//.test(SCHEDULE) && !/_generated/.test(SCHEDULE));
check("and still makes no network call", !/fetch\(/.test(SCHEDULE));
check("the welcome renders through the same template as every other email",
  /render\(copy, target, homeUrl\(site, lang\)\)/.test(DUNNING));

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
