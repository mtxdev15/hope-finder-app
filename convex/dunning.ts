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
 * So we send three, and Stripe's toggle stays off. Turning it on as well would
 * mean eleven.
 *
 * THE CADENCE IS DERIVED, NEVER TYPED TWICE
 * Every send time comes from PAST_DUE_GRACE_DAYS. If that number changes, the
 * schedule moves with it and the emails cannot start promising a date the
 * entitlement layer disagrees with. That mattered immediately: grace is 3 days
 * while Stripe retries for 14, so a "we'll try again next week" email written
 * against Stripe's schedule would have been false on our own.
 *
 * WHAT EACH EMAIL IS FOR
 *   failed  sent at once. The card, the amount, the date Plus pauses, one
 *           button — and the hardship line, in the FIRST email rather than the
 *           last, because someone who cannot pay should hear it before they
 *           have spent three days worrying.
 *   ending  24h before access stops. Skipping the last email before lockout is
 *           the single most-cited mistake in dunning design.
 *   paused  access has stopped. Calm and permanent, never a threat: this one
 *           exists so nobody discovers the change by finding a feature missing.
 * Then silence. There is no fourth.
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
 * English only, deliberately and visibly. Nothing in this codebase records a
 * user's language: `accountSettings` holds a timezone and no locale, and the
 * webhook that triggers this has no request to read one from. Guessing from a
 * Stripe address would be worse than the honest default. The fix is to stamp
 * the checkout's `lang` into subscription metadata and persist it — recorded in
 * docs/operations/dunning-plan.md rather than left as a silent gap.
 */
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { authComponent } from "./auth";
import { fetchSubscription, stripeGet } from "./stripeApi";
import { PAST_DUE_GRACE_MS } from "./entitlementCatalog";
import { type DunningStage, copyFor, render, longDate, money } from "./dunningSchedule";

const FROM_EMAIL = "Declare <noreply@declareandbelieve.com>";
const resend: Resend = new Resend(components.resend, { testMode: false });

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
    stage: v.union(v.literal("failed"), v.literal("ending"), v.literal("paused")),
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

    const user = await authComponent.getAnyUserById(ctx, args.userId);
    const to = user && typeof user.email === "string" ? user.email : null;
    if (!to) return { sent: false, reason: "no-address" };

    /* When Plus actually stops. Same arithmetic entitlements.ts uses, so the
       date in the email is the date the product will enforce. */
    const base = sub.currentPeriodEnd ? sub.currentPeriodEnd * 1000 : sub.updatedAt;
    const pausesOn = longDate(base + PAST_DUE_GRACE_MS);

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
          amount = money(price?.unit_amount ?? null, price?.currency ?? null);
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
    const copy = copyFor(args.stage, { card, amount, pausesOn });

    await resend.sendEmail(ctx, {
      from: FROM_EMAIL,
      to,
      subject: copy.subject,
      html: render(copy, site + "/billing"),
    });

    return { sent: true };
  },
});
