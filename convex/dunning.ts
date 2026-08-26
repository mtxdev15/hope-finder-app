/* Declare & Believe — telling somebody their card failed.
 *
 * WHY THIS IS OURS AND NOT STRIPE'S TOGGLE
 * Stripe's "send emails when card payments fail" sends one email PER RETRY
 * ATTEMPT. At the default eight retries that is eight emails saying your
 * payment failed, and the copy cannot be changed — Stripe's branding settings
 * expose colour, icon and logo, nothing more. Eight escalating payment demands
 * is a collections experience, and this app is reached by people at 3am in real
 * distress. Every serious vendor sends far fewer: Recurly's own guidance is
 * three to four messages, Paddle sends four.
 *
 * So we send at most four, and Stripe's toggle stays off. Turning it on as well
 * would mean twelve.
 *
 * THE CADENCE IS DERIVED, NEVER TYPED TWICE
 * Every send time comes from PAST_DUE_GRACE_DAYS. If that number changes, the
 * schedule moves with it and the emails cannot start promising a date the
 * entitlement layer disagrees with. That mattered immediately: the window moved
 * from 3 days to 16 in the session this was written, and the whole cadence
 * followed without a line being retyped.
 *
 * WHAT EACH EMAIL IS FOR
 *   failed  sent at once. The card, the amount, the date Plus pauses, one
 *           button — and the hardship line, in the FIRST email rather than the
 *           last, because someone who cannot pay should hear it before they
 *           have spent the whole window worrying.
 *   reminder halfway through, and only when the window is a week or longer.
 *           Without it a 16-day grace is one email, two weeks of silence, then
 *           two inside a day.
 *   ending  24h before access stops. Skipping the last email before lockout is
 *           the single most-cited mistake in dunning design.
 *   paused  access has stopped. Calm and permanent, never a threat: this one
 *           exists so nobody discovers the change by finding a feature missing.
 * Then silence. There is no fifth.
 *
 * ANTI-PHISHING IS A DESIGN CONSTRAINT, NOT A NICETY
 * "Your payment failed, update your payment information" is among the most
 * common phishing templates in existence, and consumer advice tells people not
 * to click those links. Three things here answer that: the card's brand and
 * last four (a phisher does not know them), the plan by name, and — the one
 * almost nobody does — an explicit alternative to the link, telling the reader
 * they can ignore it and open the app themselves.
 *
 * LANGUAGE
 * English and Spanish. The language is stamped into Stripe metadata by the
 * Checkout that sold the subscription and persisted on the row as `locale`, so
 * an email written three weeks after the purchase still arrives in the language
 * that person actually reads. Absent means English, which is why nothing had to
 * be backfilled when this shipped.
 *
 * It is carried metadata, NOT provenance: classifyPlusSubscription never reads
 * it, and it must not start — a sixth checked key would reject every
 * subscription sold before the stamp existed.
 */
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Resend, vOnEmailEventArgs } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { authComponent } from "./auth";
import { fetchSubscription, stripeGet } from "./stripeApi";
import { graceEndsAtMs } from "./entitlementCatalog";
import {
  type DunningStage,
  billingUrl,
  homeUrl,
  copyFor,
  emailLang,
  longDate,
  money,
  render,
  trialEndingCopy,
} from "./dunningSchedule";

const FROM_EMAIL = "Declare <noreply@declareandbelieve.com>";
/* onEmailEvent is what closes the loop. Without it the component sends and
 * forgets, and a bounce is indistinguishable from a delivery. */
export const resendClient: Resend = new Resend(components.resend, {
  testMode: false,
  onEmailEvent: internal.dunning.recordEmailEvent,
});

/* The events that mean this person did not, or will not, receive it.
 *
 * `complained` is a spam report and is treated as the strongest of the three:
 * somebody who marked our billing email as spam must not receive the remaining
 * three. Continuing would be both a deliverability problem for every other
 * email this domain sends and, more simply, ignoring somebody who has just told
 * us to stop. */
const UNDELIVERABLE: ReadonlySet<string> = new Set([
  "email.bounced",
  "email.complained",
  "email.failed",
]);

/* The statuses that mean "still failing". Anything else — active, trialing,
 * canceled — means this email is no longer true and must not be sent. */
const STILL_FAILING: ReadonlySet<string> = new Set(["past_due", "unpaid"]);

/* ── The send ─────────────────────────────────────────────────────────────── */

/* Scheduled by subscriptions.applyWebhook when a subscription first enters a
 * failing status. Every stage RE-CHECKS before sending, because the whole point
 * of a retry window is that most of these are fixed before the later emails are
 * due — and "your Plus pauses tomorrow" arriving after they already paid is the
 * kind of message that makes somebody cancel on purpose. */
export const sendDunningEmail = internalAction({
  args: {
    userId: v.string(),
    stage: v.union(
      v.literal("failed"),
      v.literal("reminder"),
      v.literal("ending"),
      v.literal("paused"),
    ),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
    const sub = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
      userId: args.userId,
      provider: "stripe" as const,
    });

    /* Recovered, cancelled, or gone. Any of them makes this email false. */
    if (!sub) return { sent: false, reason: "no-subscription" };
    if (!STILL_FAILING.has(sub.status)) return { sent: false, reason: "recovered-or-ended" };
    /* A lifetime row cannot be past_due; if one somehow is, this copy is wrong
       for it and silence is better than a confusing email about a plan that
       does not renew. */
    if (sub.planKey === "plus_lifetime") return { sent: false, reason: "not-applicable" };

    /* A bounce or a spam report on an earlier stage stops the rest.
       Checked here, at the moment of sending, rather than acted on when the
       event arrived — the same principle as every other pre-send check in this
       action. Somebody who marked the first email as spam has told us to stop,
       and three more would be both rude and a deliverability problem for every
       other email this domain sends. */
    const undeliverable = await ctx.runQuery(internal.dunning.undeliverableInternal, {
      userId: args.userId,
    });
    if (undeliverable) return { sent: false, reason: "undeliverable" };

    const user = await authComponent.getAnyUserById(ctx, args.userId);
    const to = user && typeof user.email === "string" ? user.email : null;
    if (!to) return { sent: false, reason: "no-address" };

    /* When Plus actually stops. The SAME function entitlements.ts uses, not
       the same arithmetic written out again, so the date in the email cannot
       drift from the date the product enforces. */
    /* The language they bought in, stamped through Stripe metadata at Checkout
       and persisted on this row. Absent — an unstamped row, or one sold before
       the column existed — means English. */
    const lang = emailLang(sub.locale);

    const pausesOn = longDate(
      graceEndsAtMs(sub.currentPeriodEnd, sub.updatedAt, Date.now(), sub.hasEverPaid),
      lang,
    );

    /* The card and the amount are the anti-phishing signal, so they are worth a
       Stripe call — but not worth losing the email over. Every failure here
       degrades the wording and still sends. */
    let card: string | null = null;
    let amount: string | null = null;
    const secret = process.env.STRIPE_SECRET_KEY;
    if (secret && sub.stripeSubscriptionId) {
      try {
        const live = await fetchSubscription(sub.stripeSubscriptionId, secret);
        if (live.ok) {
          const price = live.data?.items?.data?.[0]?.price;
          amount = money(price?.unit_amount ?? null, price?.currency ?? null, lang);
          const pmId =
            typeof live.data?.default_payment_method === "string"
              ? live.data.default_payment_method
              : live.data?.default_payment_method?.id;
          if (typeof pmId === "string" && pmId) {
            const pm = await stripeGet("/payment_methods/" + pmId, secret);
            const brand = pm.data?.card?.brand;
            const last4 = pm.data?.card?.last4;
            if (typeof brand === "string" && typeof last4 === "string") {
              card = brand.charAt(0).toUpperCase() + brand.slice(1) + " ···· " + last4;
            }
          }
        }
      } catch {
        /* Deliberately swallowed. The email is the point; the card digits are a
           trust signal we would rather lose than the message itself. */
      }
    }

    const site = (process.env.SITE_URL || "https://declareandbelieve.com").replace(/\/+$/, "");
    const copy = copyFor(args.stage, { card, amount, pausesOn }, lang);

    const emailId = await resendClient.sendEmail(ctx, {
      from: FROM_EMAIL,
      to,
      subject: copy.subject,
      html: render(copy, billingUrl(site, lang), homeUrl(site, lang)),
    });

    /* The join between "we sent this" and whatever Resend later says about it.
       Without this row an event has nothing to attach to and the send is
       unobservable again. */
    await ctx.runMutation(internal.dunning.recordSendInternal, {
      emailId,
      userId: args.userId,
      stage: args.stage,
    });

    return { sent: true };
  },
});

/* ── Did it arrive? ───────────────────────────────────────────────────────── */

/* Called by the Resend component for every event on a message we sent, via the
 * webhook route in http.ts. Records the outcome against the send.
 *
 * WHY THIS DOES NOT TAKE ACTION ITSELF
 * A bounce is not a reason to change anybody's entitlement — their card failed,
 * which is already handled, and their mailbox being full is not a billing fact.
 * The only thing that acts on this is the next stage's own pre-send check,
 * which is where the decision belongs: at the moment of sending, against the
 * state as it is then. */
export const recordEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("dunningSends")
      .withIndex("by_email", (q) => q.eq("emailId", args.id))
      .first();
    /* Not ours, or the send row lost a race with a very fast webhook. Either
       way there is nothing to attach this to, and inventing a row keyed to no
       user would be worse than dropping it. */
    if (!row) return;

    await ctx.db.patch(row._id, {
      lastEvent: args.event.type,
      lastEventAt: Date.now(),
    });

    /* Loud, and deliberately so: this is the one class of failure nobody would
       otherwise notice. No address and no message content — the emailId is how
       an operator finds those. */
    if (UNDELIVERABLE.has(args.event.type)) {
      console.log(
        "[dunning] undeliverable stage=" + row.stage +
          " event=" + args.event.type +
          " emailId=" + args.id +
          " — remaining stages will be suppressed for this subscriber",
      );
    }
  },
});

/* Written after the send, not before: an emailId only exists once the component
 * has accepted the message, and a row claiming a send that never happened would
 * be worse than no row. */
export const recordSendInternal = internalMutation({
  args: { emailId: v.string(), userId: v.string(), stage: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("dunningSends", {
      emailId: args.emailId,
      userId: args.userId,
      stage: args.stage,
      sentAt: Date.now(),
    });
  },
});

/* Has this person already told us, or has their provider already told us, that
 * these messages are not reaching them? Read immediately before each send. */
export const undeliverableInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    const rows = await ctx.db
      .query("dunningSends")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const r of rows) {
      if (r.lastEvent && UNDELIVERABLE.has(r.lastEvent)) return r.lastEvent;
    }
    return null;
  },
});

/* ── The trial reminder ───────────────────────────────────────────────────── */

/* Sent when Stripe fires customer.subscription.trial_will_end, three days
 * before an unconverted trial is charged.
 *
 * WHY THIS IS NOT A DUNNING STAGE
 * Nothing has gone wrong. The sequence in sendDunningEmail exists because a
 * payment failed and gets progressively more urgent; this is a promise being
 * kept on a subscription that is working exactly as intended. Folding it in
 * would mean every re-check, suppression rule and stage name in that action had
 * to hold two unrelated meanings.
 *
 * IT SHARES THE SUPPRESSION LIST ANYWAY. Somebody who marked our billing email
 * as spam has told us to stop, and that applies here too.
 *
 * IT IS NOT RETRIED AND NOT DEDUPED BEYOND STRIPE'S OWN BEHAVIOUR. Stripe fires
 * trial_will_end once per trial; the webhook layer already drops replays by
 * event id before this is reached. */
export const sendTrialEndingEmail = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
    const sub = await ctx.runQuery(internal.subscriptions.getByUserProviderInternal, {
      userId: args.userId,
      provider: "stripe" as const,
    });

    if (!sub) return { sent: false, reason: "no-subscription" };
    /* Already converted, already cancelled, or otherwise no longer a trial. Any
       of those makes "your trial ends in 3 days" false. */
    if (sub.status !== "trialing") return { sent: false, reason: "not-trialing" };
    if (sub.planKey === "plus_lifetime") return { sent: false, reason: "not-applicable" };

    const undeliverable = await ctx.runQuery(internal.dunning.undeliverableInternal, {
      userId: args.userId,
    });
    if (undeliverable) return { sent: false, reason: "undeliverable" };

    const user = await authComponent.getAnyUserById(ctx, args.userId);
    const to = user && typeof user.email === "string" ? user.email : null;
    if (!to) return { sent: false, reason: "no-address" };

    const lang = emailLang(sub.locale);

    /* The date Stripe will actually charge, which is the trial end it told us,
       not three days from now. Those differ whenever the event is delayed, and
       the whole value of this email is that the date in it is right. */
    const chargeAtMs = sub.trialEnd
      ? sub.trialEnd * 1000
      : sub.currentPeriodEnd
        ? sub.currentPeriodEnd * 1000
        : null;
    /* No date means no email. "Your trial ends soon" without the day is the
       vague warning this was written to replace. */
    if (chargeAtMs === null) return { sent: false, reason: "no-charge-date" };
    const chargesOn = longDate(chargeAtMs, lang);

    /* The amount is the point of the message, so it is worth a Stripe call —
       but a failure degrades the sentence rather than losing the reminder. */
    let amount: string | null = null;
    let card: string | null = null;
    const secret = process.env.STRIPE_SECRET_KEY;
    if (secret && sub.stripeSubscriptionId) {
      try {
        const live = await fetchSubscription(sub.stripeSubscriptionId, secret);
        if (live.ok) {
          const price = live.data?.items?.data?.[0]?.price;
          amount = money(price?.unit_amount ?? null, price?.currency ?? null, lang);
          const pmId =
            typeof live.data?.default_payment_method === "string"
              ? live.data.default_payment_method
              : live.data?.default_payment_method?.id;
          if (typeof pmId === "string" && pmId) {
            const pm = await stripeGet("/payment_methods/" + pmId, secret);
            const brand = pm.data?.card?.brand;
            const last4 = pm.data?.card?.last4;
            if (typeof brand === "string" && typeof last4 === "string") {
              card = brand.charAt(0).toUpperCase() + brand.slice(1) + " ···· " + last4;
            }
          }
        }
      } catch {
        /* Deliberately swallowed, same as the failed-payment path. */
      }
    }

    const site = (process.env.SITE_URL || "https://declareandbelieve.com").replace(/\/+$/, "");
    const copy = trialEndingCopy({ amount, chargesOn, card }, lang);

    const emailId = await resendClient.sendEmail(ctx, {
      from: FROM_EMAIL,
      to,
      subject: copy.subject,
      html: render(copy, billingUrl(site, lang), homeUrl(site, lang)),
    });

    await ctx.runMutation(internal.dunning.recordSendInternal, {
      emailId,
      userId: args.userId,
      stage: "trial-ending",
    });

    return { sent: true };
  },
});
