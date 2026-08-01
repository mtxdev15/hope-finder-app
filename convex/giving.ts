import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";

/* Legacy donation account operations — secured.
 *
 * These replace three Cloudflare Worker routes that trusted the browser:
 *
 *   /give/portal        took body.userId AND fell back to searching Stripe by a
 *                       submitted email, so submitting anyone's address opened
 *                       THEIR billing portal (full IDOR: payment method,
 *                       invoices, cancellation).
 *   /give/subscription  took body.subscriptionId and returned that
 *                       subscription's status, period end and cancellation
 *                       state with no ownership check at all. Its comment
 *                       claimed the id "comes from the caller's own authed gift
 *                       history"; nothing enforced it.
 *   /give/checkout      took body.userId as the gift's owner, so a gift could
 *                       be attributed to another account.
 *
 * The Worker cannot verify Better Auth identity, which is the root cause of all
 * three. Here identity comes from trusted context and the Stripe ids are
 * resolved from the caller's OWN gift history — never from the request. There
 * is no userId, email, customerId or subscriptionId argument on either action,
 * so there is nothing to spoof.
 *
 * Donations are retired as a product. These exist only so an existing recurring
 * donor can still see and cancel what they already have. They are deliberately
 * SEPARATE from Plus billing (convex/billing.ts): a donation portal must never
 * become the Plus portal, and a donor is a Free user unless they subscribe.
 */

const STRIPE_API = "https://api.stripe.com/v1";

type AuthedUser = { _id: string };

async function requireUser(ctx: any): Promise<AuthedUser> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("not-authenticated");
  return user as AuthedUser;
}

function siteBase(): string {
  return (process.env.SITE_URL || "https://declareandbelieve.com").replace(/\/+$/, "");
}

/* Open a Stripe billing portal for the caller's OWN recurring donation.
 *
 * The customer id comes from this user's most recent recurring gift, looked up
 * server-side by their authenticated id. No email search exists here and none
 * may be reintroduced — that was the IDOR. */
export const donationPortalSession = action({
  args: { lang: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ url?: string; error?: string }> => {
    let user: AuthedUser;
    try {
      user = await requireUser(ctx);
    } catch {
      return { error: "not-authenticated" };
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return { error: "billing-not-configured" };

    const gift = await ctx.runQuery(internal.gifts.mostRecentRecurring, {
      userId: user._id,
    });

    // Resolve the customer from OUR record of THEIR gift. If we captured the
    // customer id at webhook time, use it; otherwise resolve it from their own
    // subscription id. Both come from this user's row — never from the request.
    let customerId: string | null = gift?.customerId ?? null;
    if (!customerId && gift?.subscriptionId) {
      try {
        const r = await fetch(STRIPE_API + "/subscriptions/" + gift.subscriptionId, {
          headers: { Authorization: "Bearer " + secret },
        });
        if (r.ok) {
          const sub = await r.json();
          customerId = typeof sub.customer === "string" ? sub.customer : null;
        }
      } catch {
        /* fall through to no-recurring-gift */
      }
    }
    if (!customerId) return { error: "no-recurring-gift" };

    const p = new URLSearchParams();
    p.set("customer", customerId);
    p.set("return_url", siteBase() + "/you" + (args.lang === "es" ? "?lang=es" : ""));
    try {
      const res = await fetch(STRIPE_API + "/billing_portal/sessions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + secret,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: p.toString(),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) return { error: "stripe-error" };
      return { url: data.url as string };
    } catch {
      return { error: "stripe-error" };
    }
  },
});

/* Live status of the caller's OWN recurring donation, for the giving card.
 *
 * Takes no subscription id. The id is resolved from this user's gift history,
 * so a submitted `sub_...` cannot select another person's subscription. */
export const myRecurringGiftStatus = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    status?: string;
    currentPeriodEnd?: number | null;
    cancelAtPeriodEnd?: boolean;
    error?: string;
  }> => {
    let user: AuthedUser;
    try {
      user = await requireUser(ctx);
    } catch {
      return { error: "not-authenticated" };
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return { error: "billing-not-configured" };

    const gift = await ctx.runQuery(internal.gifts.mostRecentRecurring, {
      userId: user._id,
    });
    if (!gift?.subscriptionId) return { error: "no-recurring-gift" };

    try {
      const r = await fetch(STRIPE_API + "/subscriptions/" + gift.subscriptionId, {
        headers: { Authorization: "Bearer " + secret },
      });
      if (!r.ok) return { error: "no-recurring-gift" };
      const sub = await r.json();
      const item = sub.items && sub.items.data && sub.items.data[0];
      return {
        status: sub.status,
        currentPeriodEnd: sub.current_period_end || (item && item.current_period_end) || null,
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      };
    } catch {
      return { error: "stripe-error" };
    }
  },
});
