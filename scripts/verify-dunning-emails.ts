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
  billingUrl, homeUrl, emailLang,
} from "../convex/dunningSchedule.ts";
/* plusPlans.ts is dependency-free for the same reason, so the normaliser that
   decides which language a Stripe metadata value means is run rather than read. */
import { normalizeLang, stampedLang, EMAIL_LANGS } from "../convex/plusPlans.ts";
/* entitlementCatalog imports nothing either, so the grace arithmetic the whole
   system shares can be RUN here rather than pattern-matched. */
import { graceEndsAtMs, isFailingStatus } from "../convex/entitlementCatalog.ts";

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
  check("the sequence is three or four emails at this grace setting",
    [3, 4].includes(dunningSchedule(PAST_DUE_GRACE_MS).length));
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
check("the sequence ends — never more than four, against Stripe's eight",
  dunningSchedule(PAST_DUE_GRACE_MS).length <= 4);
check("no single silence swallows the window", (() => {
  const d = dunningSchedule(PAST_DUE_GRACE_MS).map((s) => dunningDelayMs(s, PAST_DUE_GRACE_MS) ?? 0);
  const cap = Math.max(Math.ceil(PAST_DUE_GRACE_MS / 2), 2 * DAY);
  return d.every((v, i) => i === 0 || v - d[i - 1] <= cap);
})());

/* The approved window, asserted so a silent revert is a failing test rather
   than a discovery. 16 days is Apple's default for monthly-and-longer, and it
   must stay AHEAD of Stripe's 14-day retry window — that margin is the whole
   reason access now ends once instead of flapping. */
const STRIPE_RETRY_DAYS = 14;
check("the grace window is the approved 16 days", PAST_DUE_GRACE_DAYS === 16);
check("grace outlasts Stripe's retry window, so access ends once",
  PAST_DUE_GRACE_DAYS > STRIPE_RETRY_DAYS);
/* The approval must be recorded beside the number, so nobody has to go
   looking for whether 16 was chosen or inherited. The negative half of this
   check originally banned the words "awaiting approval" outright and failed on
   the file's own QUOTATION of the note it replaced — the same trap as banning
   "<table>" in a comment that explains why there is no table. What matters is
   that the phrase no longer describes the CURRENT state. */
check("the approval is recorded where the number lives",
  /APPROVED 2026-08-26 AT 16 DAYS/.test(CATALOG));
check("the setting no longer claims to be awaiting approval",
  !/THIS IS A PRODUCT SETTING AWAITING APPROVAL/i.test(CATALOG));

/* Proven at OTHER windows, not just the one currently configured. The grace
   setting is documented as awaiting approval, so the schedule has to stay
   correct at whatever it becomes — including the 14 days that would match
   Stripe's own retry window. */
for (const days of [2, 3, 7, 14, 16, 28]) {
  const ms = days * DAY;
  const sched = dunningSchedule(ms);
  check(`at ${days}-day grace the pause email lands on the day access stops`,
    dunningDelayMs("paused", ms) === ms);
  check(`at ${days}-day grace nothing is scheduled after access stops`,
    sched.every((s) => (dunningDelayMs(s, ms) ?? 0) <= ms));
  check(`at ${days}-day grace something warns before access stops`,
    sched.some((s) => { const d = dunningDelayMs(s, ms); return d !== null && d < ms; }));
  check(`at ${days}-day grace there are never more than four emails`, sched.length <= 4);
  /* THE failure this stage exists to prevent: at a 16-day window the original
     three-stage shape gave day 0, 15, 16 — one email, then over two weeks of
     silence, then two inside a day.
     The rule is NOT "no gap over a week": that was invented here and is
     stricter than practice, since Recurly's own guidance of 3-4 emails across
     28 days implies gaps of nine days and more. What must never happen is a
     single silence swallowing the window, so no gap may exceed half of it. */
  /* Half the window, with a two-day floor: below about four days the window is
     shorter than this rule can constrain, since emails cannot sit closer than a
     day apart without turning a warning into nagging. */
  check(`at ${days}-day grace no silence exceeds half the window`, (() => {
    const d = sched.map((s) => dunningDelayMs(s, ms) ?? 0);
    const cap = Math.max(Math.ceil(ms / 2), 2 * DAY);
    return d.every((v, i) => i === 0 || v - d[i - 1] <= cap);
  })());
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
/* They cannot diverge, because there is only one of them now. This used to
   compare two hand-written sets and pass as long as both said the same words;
   it now proves neither module has a set of its own to disagree with. */
check("the failing statuses are executed, not restated",
  isFailingStatus("past_due") && isFailingStatus("unpaid"));
check("and nothing else is treated as failing",
  !isFailingStatus("active") && !isFailingStatus("canceled") &&
  !isFailingStatus("incomplete") && !isFailingStatus("paid") &&
  !isFailingStatus("") && !isFailingStatus(undefined));
check("both callers import the decision rather than keeping a copy",
  /isFailingStatus/.test(SUBS) && /isFailingStatus/.test(ENTITLEMENTS) &&
  !/"past_due", "unpaid"/.test(SUBS) &&
  !/status === "past_due" \|\| status === "unpaid"/.test(ENTITLEMENTS));
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
check("the pause date comes from the shared function, not a second copy",
  /graceEndsAtMs\(sub\.currentPeriodEnd, sub\.updatedAt/.test(DUNNING) &&
  !/sub\.currentPeriodEnd \* 1000/.test(DUNNING));
/* Run, not read. The seconds-to-milliseconds conversion is the one mistake here
   that is invisible in review and puts the date fifty thousand years out. */
const PERIOD_END_S = Math.floor(Date.UTC(2026, 7, 26) / 1000);
check("grace runs from the end of the period they last paid for",
  graceEndsAtMs(PERIOD_END_S, 0, Date.UTC(2026, 7, 27)) ===
    Date.UTC(2026, 7, 26) + PAST_DUE_GRACE_MS);
check("a missing period end falls back to when we last heard from them",
  graceEndsAtMs(null, Date.UTC(2026, 7, 20), Date.UTC(2026, 7, 27)) ===
    Date.UTC(2026, 7, 20) + PAST_DUE_GRACE_MS);
/* Neither absent field may produce an unbounded free ride. */
check("with neither, grace is measured from now and still ends",
  graceEndsAtMs(null, null, 1_800_000_000_000) === 1_800_000_000_000 + PAST_DUE_GRACE_MS);
check("a zero period end is treated as absent, not as 1970",
  graceEndsAtMs(0, Date.UTC(2026, 7, 20), Date.UTC(2026, 7, 27)) ===
    Date.UTC(2026, 7, 20) + PAST_DUE_GRACE_MS);

/* ── 4. Anti-phishing ────────────────────────────────────────────────────── */
section("4. It survives a reader trained to distrust this exact message");

/* "Your payment failed, update your payment information" is among the most
   common phishing templates in existence. */
check("the card brand and last four are included — a phisher knows neither",
  /card\?\.brand/.test(DUNNING) && /card\?\.last4/.test(DUNNING));
check("an alternative to clicking the link is offered",
  /open Declare and go to Billing/.test(SCHEDULE));
/* Executed rather than grepped: the property is where the URL POINTS, and only
   running the builder proves that for every language it can produce. */
check("the link points at our own site, never a Stripe-hosted URL",
  EMAIL_LANGS.every((l) => {
    const u = billingUrl("https://declareandbelieve.com", l);
    return u.startsWith("https://declareandbelieve.com/billing") &&
      !/stripe\.com/.test(u);
  }) &&
  !/billing\.stripe\.com/.test(DUNNING) && !/billing\.stripe\.com/.test(SCHEDULE));
check("the email's link is the one the send actually uses",
  /billingUrl\(site, lang\)/.test(DUNNING));
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
/* The Spanish facts are formatted the way the Spanish send formats them, not
   translated by hand — otherwise this suite would assert against a date no
   subscriber ever receives. */
const FACTS_ES = {
  card: "Visa ···· 4242",
  amount: money(899, "usd", "es") as string,
  pausesOn: longDate(Date.UTC(2026, 8, 26), "es"),
};
const factsFor = (lang: "en" | "es") => (lang === "es" ? FACTS_ES : FACTS);

const renderedFor = (lang: "en" | "es") =>
  dunningSchedule(PAST_DUE_GRACE_MS)
    .map((st) => {
      const c = copyFor(st, factsFor(lang), lang);
      return c.subject + "\n" + c.heading + "\n" + c.body.join("\n") + "\n" + (c.cta ?? "");
    })
    .join("\n\n");

const RENDERED = renderedFor("en");

/* The ban lists are NOT translations of each other. Each bans what billing
   letters actually say in that language — translating the English list word for
   word would have banned "vencida", which is the ordinary blameless word for an
   expired CARD and the single most common real cause. */
const BANNED: Record<"en" | "es", string[]> = {
  en: [
    "suspended", "terminated", "revoked", "delinquent", "overdue",
    "immediately", "final notice", "failure to", "will be lost",
  ],
  es: [
    "suspendido", "suspendida", "moroso", "morosa", "en mora",
    "inmediatamente", "aviso final", "dado de baja", "se perderá",
    "incumplimiento", "deuda",
  ],
};

for (const lang of EMAIL_LANGS) {
  const rendered = renderedFor(lang);
  const facts = factsFor(lang);

  for (const banned of BANNED[lang]) {
    check(`[${lang}] no email says "${banned}"`,
      !new RegExp("\\b" + banned + "\\b", "i").test(rendered));
  }
  check(`[${lang}] no capitalised shouting`,
    !/[A-Z]{4,}/.test(rendered.replace(/Declare|Plus|Visa|Billing|Facturación|Palabra|Escrituras/g, "")));
  check(`[${lang}] no exclamation marks`, !rendered.includes("!") && !rendered.includes("¡"));

  /* A LOCKED BRAND RULE, and it applies to the emails exactly as it applies to
     the site: no em dashes, in any form. The instruction is to rewrite the
     sentence rather than swap the punctuation, so this is asserted against the
     RENDERED text — where a full stop or a comma has already done the work.
     The rule survives here and not only in someone's memory. */
  check(`[${lang}] no em dash anywhere in the copy`,
    !rendered.includes("—"));
  /* The en dash is the one people reach for when the em dash is banned, and it
     is the same typographic gesture. It is not a loophole. */
  check(`[${lang}] and no en dash standing in for one`,
    !/\s–\s/.test(rendered));

  /* Every email carries the four fields the good ones do, and exactly one
     action — in whichever language it went out in. */
  for (const stage of dunningSchedule(PAST_DUE_GRACE_MS)) {
    const c = copyFor(stage, facts, lang);
    check(`[${lang}] "${stage}" has a subject`, c.subject.length > 0 && c.subject.length < 80);
    check(`[${lang}] "${stage}" names the card`, c.body.join(" ").includes(facts.card));
    check(`[${lang}] "${stage}" offers exactly one action`,
      typeof c.cta === "string" && c.cta.length > 0);
    const html = render(c, billingUrl("https://declareandbelieve.com", lang), homeUrl("https://declareandbelieve.com", lang));
    check(`[${lang}] "${stage}" renders one action and one way home`,
      (html.match(/<a /g) || []).length === 2);
    check(`[${lang}] "${stage}" renders no image or tracking pixel`, !/<img/i.test(html));
    /* The footer is part of the message, so a translated email with an English
       footer is a half-translated email. */
    check(`[${lang}] "${stage}" renders a footer in its own language`,
      html.includes(c.footer) && c.footer.length > 0);
    /* The footer is copy too, and it is the piece most likely to be written
       once and never re-read. */
    check(`[${lang}] "${stage}" footer carries no em dash`,
      !c.footer.includes("\u2014"));
  }

  check(`[${lang}] every email before the pause names the date it happens`,
    dunningSchedule(PAST_DUE_GRACE_MS)
      .filter((st) => st !== "paused")
      .every((st) => copyFor(st, facts, lang).body.join(" ").includes(facts.pausesOn)));
  check(`[${lang}] the pause email does not name a date that has passed`,
    !copyFor("paused", facts, lang).body.join(" ").includes(facts.pausesOn));
  check(`[${lang}] the amount appears in the first email`,
    copyFor("failed", facts, lang).body.join(" ").includes(facts.amount));

  /* Missing facts degrade the sentence rather than printing a gap — in both
     languages, where the degraded sentence is a DIFFERENT sentence. */
  const bare = copyFor("failed", { card: null, amount: null, pausesOn: facts.pausesOn }, lang);
  const bareText = bare.body.join(" ");
  check(`[${lang}] a missing card leaves no empty bracket`, !/\(\s*\)/.test(bareText));
  check(`[${lang}] a missing amount leaves no double space`, !/ {2,}/.test(bareText));
  check(`[${lang}] a missing amount leaves no repeated preposition`,
    !/\bfor\s+for\b/.test(bareText) && !/\bde\s+de\b/.test(bareText));
  check(`[${lang}] a missing card still names the pause date`,
    bareText.includes(facts.pausesOn));
}

/* The English-specific sentences, kept as themselves rather than folded into
   the loop: these are the exact words, and a paraphrase would pass a looser
   check while losing the thing that makes the email land. */
check("the fault is placed on the card, not the reader",
  /rather than anything you did/.test(RENDERED));
check("the first email says nothing has been lost",
  copyFor("failed", FACTS).body.join(" ").includes("Nothing has been lost"));
check("the pause email states the free experience continues",
  copyFor("paused", FACTS).body.join(" ").includes("You still have Declare"));

/* Their Spanish counterparts, asserted separately for exactly the same reason.
   Without these, copyEs could quietly return the English strings and every
   structural check above would still pass. */
const ES_FAILED = copyFor("failed", FACTS_ES, "es").body.join(" ");
const ES_PAUSED = copyFor("paused", FACTS_ES, "es").body.join(" ");
check("[es] the fault is placed on the card, not the reader",
  /no algo que hayas hecho tú/.test(ES_FAILED));
check("[es] the first email says nothing has been lost",
  ES_FAILED.includes("No has perdido nada"));
check("[es] the pause email states the free experience continues",
  ES_PAUSED.includes("Sigues teniendo Declare"));
check("[es] hardship help is offered in the first email",
  /si el motivo es el dinero/i.test(ES_FAILED));
check("[es] the hardship offer asks for no proof",
  /No tendrás que explicarlo dos veces/.test(ES_FAILED));
check("[es] an alternative to clicking the link is offered",
  /entra a Declare y ve a Facturación/.test(ES_FAILED));
/* The register the rest of the app uses. Usted would read as a letter from a
   collections department — the one thing this file exists to avoid. */
check("[es] the emails address the reader as tú, matching the app",
  /\btu tarjeta\b/.test(renderedFor("es")) && !/\bsu tarjeta\b/.test(renderedFor("es")) &&
  !/\busted\b/i.test(renderedFor("es")));

/* ── 5b. It looks like Declare, without an image ─────────────────────────── */
section("5b. Branded, with nothing to load and nothing to block");

for (const lang of EMAIL_LANGS) {
  for (const stage of dunningSchedule(PAST_DUE_GRACE_MS)) {
    const html = render(copyFor(stage, factsFor(lang), lang),
      billingUrl("https://declareandbelieve.com", lang),
      homeUrl("https://declareandbelieve.com", lang));

    check(`[${lang}] "${stage}" carries the wordmark`,
      html.includes("Declare &amp; Believe"));
    /* Georgia is the one that actually renders. Cormorant Garamond is named
       first so a client that somehow has it uses it, but a stack that ends at a
       webfont this email never loads is a declaration with no font behind it. */
    check(`[${lang}] "${stage}" sets a serif with a fallback that exists`,
      /font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif/.test(html));

    /* THE CONSTRAINT THAT MAKES THE TEXT WORDMARK NECESSARY. A remote image is
       the exact mechanism an open-tracking pixel uses, and Gmail strips inline
       SVG anyway, so neither is a way to add a logo later. */
    check(`[${lang}] "${stage}" loads nothing from anywhere`,
      !/<img/i.test(html) && !/<svg/i.test(html) && !/\ssrc=/i.test(html) &&
      !/background-image/i.test(html) && !/url\(/i.test(html));

    /* THE INVARIANT, and it is about destinations rather than count. Every
       anchor points at our own domain — a link anywhere else is the phishing
       shape we are defending against — and exactly one of them is an ACTION.
       The wordmark links home so an anxious reader can reach the site without
       following a link about money. */
    const hrefs = Array.from(html.matchAll(/<a\s[^>]*href="([^"]*)"/g)).map((m) => m[1]);
    check(`[${lang}] "${stage}" links only to our own domain`,
      hrefs.length > 0 &&
      hrefs.every((h) => h.startsWith("https://declareandbelieve.com")));
    check(`[${lang}] "${stage}" offers exactly one action`,
      hrefs.filter((h) => h.includes("/billing")).length === 1);
    check(`[${lang}] "${stage}" gives the reader a way back to the site`,
      hrefs.some((h) => /^https:\/\/declareandbelieve\.com\/(\?|$)/.test(h)));
    check(`[${lang}] "${stage}" links the wordmark, as the way home`,
      /<a href="[^"]*"[^>]*>Declare &amp; Believe<\/a>/.test(html));
  }
}
/* The palette is the app's, not a generic email template's. */
const BRANDED = render(copyFor("failed", FACTS), billingUrl("https://declareandbelieve.com"), homeUrl("https://declareandbelieve.com"));
check("the button is forest, the app's primary", /background:#2D4A3E/.test(BRANDED));
check("the ground is cream and the rules are parchment",
  /background:#FAF7F2/.test(BRANDED) && /#E8E0D0/.test(BRANDED));

/* ── 6. The language actually reaches the email ──────────────────────────── */
section("6. A Spanish subscriber is written to in Spanish");

/* The whole chain, end to end. Any one link removed and one of these fails.
   Written as separate checks rather than one, so a failure names which link. */
const BILLING = read("convex/billing.ts");
const HTTP = read("convex/http.ts");
const SCHEMA = read("convex/schema.ts");
const PLANS = read("convex/plusPlans.ts");

check("Checkout stamps the language into Stripe metadata",
  /form\["metadata\[lang\]"\]/.test(BILLING));
check("the stamp survives the Checkout Session, on both purchase shapes",
  /subscription_data\[metadata\]\[lang\]/.test(BILLING) &&
  /payment_intent_data\[metadata\]\[lang\]/.test(BILLING));
check("the webhook reads it back on a subscription",
  /stampedLang\(sub, session\)/.test(HTTP));
check("the webhook reads it back on a lifetime purchase",
  /stampedLang\(null, obj\)/.test(HTTP));
check("the row has somewhere to keep it", /locale: v\.optional\(v\.string\(\)\)/.test(SCHEMA));
check("applyWebhook persists it", /\.\.\.\(args\.locale \? \{ locale: args\.locale \} : \{\}\)/.test(SUBS));
check("the send reads it off the row", /emailLang\(sub\.locale\)/.test(DUNNING));

/* IT IS NOT PROVENANCE, and must never become it. A sixth checked key would
   reject every subscription sold before the stamp existed. */
check("classification never reads the language",
  !/md\.lang/.test(PLANS.slice(0, PLANS.indexOf("export type EmailLang"))));
check("the language is stamped outside the provenance loop, not inside it",
  BILLING.indexOf('form["metadata[lang]"]') > BILLING.indexOf("const provenance"));

/* The normaliser, executed. Its job is that nothing unexpected can ever be
   written — a union validator would throw inside a webhook mutation, and Stripe
   answers a throw by retrying the same event forever. */
check("a language we ship is accepted", normalizeLang("es") === "es" && normalizeLang("en") === "en");
check("a regional tag still resolves — es-MX is a Spanish reader",
  normalizeLang("es-MX") === "es" && normalizeLang("ES") === "es" && normalizeLang("es_419") === "es");
for (const junk of [null, undefined, "", "fr", "de-DE", 7, {}, "esp", "english"]) {
  check(`an unrecognised language yields null, not a throw — ${JSON.stringify(junk)}`,
    normalizeLang(junk) === null);
}
check("absent metadata means English, so nothing needs backfilling",
  stampedLang(null, null) === null && emailLang(undefined) === "en" && emailLang(null) === "en");
check("an unknown stored value means English rather than a broken send",
  emailLang("fr") === "en" && emailLang("") === "en");
check("the subscription's stamp wins over the session's",
  stampedLang({ metadata: { lang: "es" } }, { metadata: { lang: "en" } }) === "es");
check("a one-off purchase can still be read from the session alone",
  stampedLang(null, { metadata: { lang: "es" } }) === "es");

/* Formatted for the reader, not for us. */
check("[es] the amount is formatted for a Spanish reader in dollars",
  (money(899, "usd", "es") as string).includes("8,99") === false &&
  (money(899, "usd", "es") as string).includes("8.99"));
check("[es] the date is Spanish, not an English month name",
  /septiembre/.test(longDate(Date.UTC(2026, 8, 26), "es")));
check("[en] the date is unchanged by the language work",
  longDate(Date.UTC(2026, 8, 26)) === "September 26, 2026");
check("the Spanish link carries the language so the page matches the email",
  billingUrl("https://declareandbelieve.com", "es") === "https://declareandbelieve.com/billing?lang=es");
check("the English link carries no parameter at all",
  billingUrl("https://declareandbelieve.com", "en") === "https://declareandbelieve.com/billing");
check("a trailing slash on SITE_URL does not produce a double slash",
  billingUrl("https://declareandbelieve.com/", "es") === "https://declareandbelieve.com/billing?lang=es");
/* i18n.js is what honours the parameter. If that ever stops being true the link
   silently opens in the wrong language, and nothing else would notice. */
check("the page actually honours ?lang=",
  /URLSearchParams\(location\.search\)\.get\('lang'\)/.test(read("public/declare/i18n.js")));
check("and strips it afterwards, so the reader is not pinned to it",
  /searchParams\.delete\('lang'\)/.test(read("public/declare/i18n.js")));

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

/* ── 6b. What we tell people BEFORE they buy ─────────────────────────────── */
section("6b. The promise on /pricing is the promise the code keeps");

/* The FAQ now states the grace window as a number, because a specific is
   believed where "we'll sort it out" is not. A number in customer-facing copy
   that nobody derives is a number that goes stale silently — and this one is a
   PROMISE about how long somebody keeps paid access. So it is checked against
   the same constant the entitlement layer enforces. */
const PRICING = read("src/pages/pricing.astro");
const STRINGS = read("public/declare/i18n-strings.js");
const faqEn = PRICING.slice(PRICING.indexOf('data-i18n="plans.a3"'));
const faqEnAnswer = faqEn.slice(0, faqEn.indexOf("</p>"));

check("the pricing FAQ states the grace window as a number",
  new RegExp("\\b" + PAST_DUE_GRACE_DAYS + " days\\b").test(faqEnAnswer));
check("and the Spanish says the same number",
  new RegExp("\\b" + PAST_DUE_GRACE_DAYS + " días\\b").test(STRINGS));
/* If the window ever moves, these two fail together and name themselves — which
   is the only reason it is safe to print the number at all. */
check("no OTHER day count is promised in the same answer",
  (faqEnAnswer.match(/\b\d+ days\b/g) || []).every((m) => m === PAST_DUE_GRACE_DAYS + " days"));

/* The brand rule is "no em dashes, ever". Asserted on the answers rather than
   the file, because every other one in pricing.astro is in a code comment. */
check("the FAQ answer carries no em dash", !faqEnAnswer.includes("—"));
/* It also promises the hardship reply, which the first email actually honours.
   A promise on the pricing page that the email never mentions would be a
   promise nobody could act on. */
check("the hardship offer is promised where it is also delivered",
  /reply to any of those emails/i.test(faqEnAnswer) &&
  /if money is the reason/i.test(SCHEDULE));

/* ── 7. We know whether it arrived ───────────────────────────────────────── */
section("7. A dunning email that does not arrive is not silent");

const SCHEMA_TXT = read("convex/schema.ts");

check("the component reports delivery events back to us",
  /onEmailEvent: internal\.dunning\.recordEmailEvent/.test(DUNNING));
check("a route exists for Resend to deliver them to",
  /path: "\/resend\/email-event"/.test(HTTP));
check("the route verifies the signature rather than trusting the caller",
  /handleResendEventWebhook/.test(HTTP));
check("there is somewhere durable to record them",
  /dunningSends: defineTable/.test(SCHEMA_TXT));
check("a send is joined to its later events by the message id",
  /recordSendInternal/.test(DUNNING) && /by_email/.test(SCHEMA_TXT));

/* THE PROPERTY THAT MAKES THE TRACKING MORE THAN A LOG LINE. Somebody who
   marked the first email as spam must not receive the remaining three. */
check("a bounce or a spam report stops the rest of the sequence",
  /undeliverableInternal/.test(DUNNING) &&
  /if \(undeliverable\) return \{ sent: false, reason: "undeliverable" \}/.test(DUNNING));
check("the suppression is checked before the address is even resolved",
  DUNNING.indexOf("undeliverableInternal, {") < DUNNING.indexOf("getAnyUserById"));
check("a spam complaint counts as undeliverable, not just a hard bounce",
  /"email\.complained"/.test(DUNNING) && /"email\.bounced"/.test(DUNNING) &&
  /"email\.failed"/.test(DUNNING));

/* It is delivery tracking, NOT analytics. Open tracking would need a pixel,
   and these emails deliberately render no image at all. */
check("opens are not tracked", !/email\.opened/.test(DUNNING));
check("clicks are not tracked", !/email\.clicked/.test(DUNNING));
check("no email address is duplicated into the tracking table",
  !/\bto: v\.string\(\)/.test(SCHEMA_TXT.slice(
    SCHEMA_TXT.indexOf("dunningSends: defineTable"),
    SCHEMA_TXT.indexOf("billingEvents: defineTable"),
  )));
check("an undeliverable send is logged loudly enough to find",
  /\[dunning\] undeliverable/.test(DUNNING));
check("the log names no address and no message content",
  /emailId=/.test(DUNNING) && !/" to=" \+ to/.test(DUNNING));

/* ── 8. The moment access actually ends ──────────────────────────────────── */
section("8. Grace expiry leaves a trace (B4)");

const SCHEMA_B4 = read("convex/schema.ts");
const JOURNEY = read("convex/journeySlots.ts");
const REFUND_END = SUBS.indexOf("export const recordGraceExpiryInternal");
const GRACE_JOB = REFUND_END < 0 ? "" : SUBS.slice(REFUND_END);

check("the expiry job exists", GRACE_JOB.length > 0);
check("it is scheduled when a subscription first turns failing",
  /internal\.subscriptions\.recordGraceExpiryInternal/.test(SUBS));
/* Scheduled from graceEndsAt, NOT from "grace milliseconds from now". The
   window runs from the end of the period they last paid for, and Stripe may
   take a while to tell us; those are the same instant only if the webhook
   was instant. */
check("it fires when grace actually ends, not a window from the webhook",
  /Math\.max\(0, graceEnds - now\)/.test(SUBS) &&
  /graceEndsAtMs\(\s*fields\.currentPeriodEnd/.test(SUBS));

/* IT OBSERVES, IT DOES NOT DECIDE. entitlements.ts remains the only thing that
   says who has Plus, and this job would be redundant to ACCESS if it never ran.
   An observer that can also revoke is one that can revoke wrongly. */
check("it re-checks rather than trusting its own timer",
  /still-in-grace/.test(GRACE_JOB) && /recovered-or-ended/.test(GRACE_JOB));
check("a recovered subscription records nothing",
  /if \(!isFailingStatus\(sub\.status\)\)/.test(GRACE_JOB));
check("it writes a durable, queryable outcome",
  /outcome: "grace-expired"/.test(GRACE_JOB) &&
  /v\.literal\("grace-expired"\)/.test(SCHEMA_B4));
check("one expiry cannot produce two rows",
  /already-recorded/.test(GRACE_JOB) && /by_provider_event/.test(GRACE_JOB));
/* The synthetic id must never be mistakable for a Stripe event id. */
check("the synthetic event id is namespaced and deterministic",
  /"grace:" \+ args\.userId \+ ":" \+ String\(graceEnds\)/.test(GRACE_JOB));
check("it says plainly that no provider event exists for this",
  /no provider event exists/.test(GRACE_JOB));
check("it is alertable from logs as well as the table",
  /\[billing\] grace-expired/.test(GRACE_JOB));

/* THE BUG THIS UNCOVERED. `subscriptions.tier` is a mirror written at webhook
   time, and tierForStatus writes "plus" for past_due — correct while grace
   holds, wrong the moment it does not. Nothing rewrote it, so journeySlots,
   which read the column directly, handed a lapsed subscriber unlimited
   Journeys for ever. Two independent fixes, because one of them is a scheduled
   job and a scheduled job can fail to run. */
check("the stale mirror is corrected when the window closes",
  /tier: "free" as const/.test(GRACE_JOB));
check("the Journey cap interprets the row instead of trusting the mirror",
  /interpret\(sub, Date\.now\(\)\)\.tier/.test(JOURNEY) &&
  !/sub\?\.tier === "plus"/.test(JOURNEY));
check("so a lapsed account is capped even if the job never ran",
  /entitlements/.test(JOURNEY));

/* ── 9. What the Journey cap did, and to whom ────────────────────────────── */
section("9. The Journey limit is recorded, not just enforced");

/* An allowed start leaves a journeySlots row. A REFUSAL used to leave nothing
   at all, so the one event worth knowing about was the only one with no trace. */
check("a refusal is written down", /journeyLimitBlocks/.test(JOURNEY) &&
  /journeyLimitBlocks: defineTable/.test(SCHEMA_B4));
check("both refusal paths record it, the fresh start and the re-open",
  (JOURNEY.match(/await recordBlock\(/g) || []).length === 2);
check("the row says which tier and which cap, not just that it happened",
  /tier, limit, active, at: Date\.now\(\)/.test(JOURNEY));
check("the cap in force is stored on the slot that was allowed",
  /tierAtStart/.test(JOURNEY) && /tierAtStart: v\.optional/.test(SCHEMA_B4));
/* Absent is not zero and not unknown: it means the tier had no visible cap. */
check("an uncapped tier stores no number rather than a misleading one",
  /\.\.\.\(limit !== null \? \{ limitAtStart: limit \} : \{\}\)/.test(JOURNEY));
/* Re-opening is a fresh claim under today's cap, so the stored one is refreshed
   rather than left describing a tier they may no longer be on. */
check("re-opening records the cap in force now, not the original one",
  /\.\.\.\(lim !== null \? \{ limitAtStart: lim \} : \{\}\)/.test(JOURNEY));

/* NO JOURNEY CONTENT, EVER. This table exists to answer "is the cap biting and
   on whom", and nothing else. */
const BLOCKS = SCHEMA_B4.slice(
  SCHEMA_B4.indexOf("journeyLimitBlocks: defineTable"),
  SCHEMA_B4.indexOf("by_user", SCHEMA_B4.indexOf("journeyLimitBlocks: defineTable")),
);
check("the refusal row carries no journey id and no content",
  !/journeyId/.test(BLOCKS) && !/struggle/i.test(BLOCKS) && !/text/i.test(BLOCKS));
check("and the log line carries none either",
  /\[journey\] active-journey-limit/.test(JOURNEY) &&
  !/journeyId=/.test(JOURNEY));

/* ── Result ──────────────────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
