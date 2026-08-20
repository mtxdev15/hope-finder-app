import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";

/* Plus billing — authenticated Checkout and Customer Portal.
 *
 * WHY THIS LIVES IN CONVEX AND NOT THE WORKER
 * The Worker cannot verify Better Auth identity: it has no session check, no
 * JWT verification, and no Better Auth import. That is exactly why the legacy
 * donation flow ended up trusting a browser-supplied `body.userId`. Convex
 * resolves identity from trusted context, so here the prohibited pattern is not
 * merely avoided, it is unrepresentable — there is no userId argument to spoof.
 *
 * Two rules this file exists to enforce:
 *   1. Identity comes only from authComponent.safeGetAuthUser(ctx).
 *   2. The browser may name a PLAN ALIAS, never a Stripe Price id, customer id,
 *      subscription id, or email. Everything Stripe-shaped is server-resolved.
 */

const STRIPE_API = "https://api.stripe.com/v1";

/* The only plan aliases a client may submit. An arbitrary `price_...` from the
 * browser is rejected: otherwise anyone could check out against a $0 price, or
 * a price belonging to a different product entirely. Family and Church have no
 * active price in this phase and deliberately have no alias. */
const PRICE_ALIASES: Record<string, { envVar: string; interval: string }> = {
  "plus-monthly": { envVar: "STRIPE_PLUS_MONTHLY_PRICE_ID", interval: "month" },
  "plus-annual": { envVar: "STRIPE_PLUS_ANNUAL_PRICE_ID", interval: "year" },
};

/* Lifecycle -> what happens when this user asks to check out again.
 * Decided server-side from OUR mirrored Stripe state, never from the frontend. */
const BLOCKS_NEW_CHECKOUT = new Set([
  "active", // already paying
  "trialing", // not advertised, but honour it if legacy state exists
  "past_due", // card failing: fix billing, do not stack a second subscription
  "unpaid", // same
]);
const ALLOWS_NEW_CHECKOUT = new Set([
  "canceled",
  "incomplete_expired",
  "ended",
]);

function stripeForm(obj: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(obj)) p.set(k, val);
  return p.toString();
}

async function stripePost(
  path: string,
  secret: string,
  form: Record<string, string>,
  idempotencyKey?: string,
) {
  const headers: Record<string, string> = {
    Authorization: "Bearer " + secret,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(STRIPE_API + path, {
    method: "POST",
    headers,
    body: stripeForm(form),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

/* Return URLs. Built from SITE_URL (a trusted server env var), never from a
 * browser-supplied origin or path — that is how an open redirect gets laundered
 * through a payment provider. `lang` is the one thing the caller influences,
 * and it is coerced to exactly 'es' or dropped. */
function siteBase(): string {
  const raw = process.env.SITE_URL || "https://declareandbelieve.com";
  return raw.replace(/\/+$/, "");
}

type AuthedUser = { _id: string; email?: string; name?: string };

async function requireUser(ctx: any): Promise<AuthedUser> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("not-authenticated");
  return user as AuthedUser;
}

/* ── Checkout ────────────────────────────────────────────────────────────── */

export const createCheckoutSession = action({
  args: {
    // The ONLY billing input the browser controls.
    plan: v.string(),
    lang: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ url?: string; error?: string; status?: string }> => {
    // 1. Trusted identity FIRST. No userId argument exists to spoof, and an
    //    anonymous caller learns nothing about our configuration before it is
    //    established who they are.
    let user: AuthedUser;
    try {
      user = await requireUser(ctx);
    } catch {
      return { error: "not-authenticated" };
    }
    const userId = user._id;

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return { error: "billing-not-configured" };

    // 2. Alias -> trusted Price id.
    const alias = PRICE_ALIASES[String(args.plan)];
    if (!alias) return { error: "unknown-plan" };
    const priceId = process.env[alias.envVar];
    if (!priceId) return { error: "billing-not-configured" };

    // 3. Duplicate prevention, from server-authoritative state.
    const existing = await ctx.runQuery(
      internal.subscriptions.getByUserInternal,
      { userId },
    );
    if (existing) {
      if (BLOCKS_NEW_CHECKOUT.has(existing.status)) {
        return { error: "already-subscribed", status: existing.status };
      }
      // Cancelling but still inside the paid period: they already have Plus
      // through currentPeriodEnd. Buying again would double-bill for a window
      // they have already paid for — send them to the portal to resume.
      if (existing.cancelAtPeriodEnd && existing.status !== "canceled") {
        return { error: "already-subscribed", status: "cancel-at-period-end" };
      }
      if (
        !ALLOWS_NEW_CHECKOUT.has(existing.status) &&
        existing.status !== "incomplete"
      ) {
        // Unrecognised lifecycle: refuse rather than guess. Better a support
        // email than an accidental second charge.
        return { error: "already-subscribed", status: existing.status };
      }
      // `incomplete` falls through: their last attempt never completed, so a
      // fresh Checkout Session is the correct recovery. Stripe expires the old
      // one on its own.
    }

    // 4. Resolve or create the Stripe customer. Reuse the stored mapping so a
    //    returning subscriber keeps one customer and one billing history.
    const mapping = await ctx.runQuery(
      internal.subscriptions.getCustomerInternal,
      { userId },
    );
    let customerId: string | null = mapping?.stripeCustomerId ?? null;

    if (!customerId) {
      // Email comes from the authenticated profile, never from the request.
      const created = await stripePost(
        "/customers",
        secret,
        {
          ...(user.email ? { email: user.email } : {}),
          "metadata[userId]": userId,
        },
        // One customer per account even if the action is retried.
        "cust:" + userId,
      );
      if (!created.ok || !created.data?.id) {
        return { error: "stripe-error" };
      }
      customerId = created.data.id as string;
      try {
        await ctx.runMutation(internal.subscriptions.linkCustomer, {
          userId,
          stripeCustomerId: customerId,
        });
      } catch {
        // Mapping conflict: another customer is already bound to this account.
        // Do not silently repoint billing — surface it.
        return { error: "customer-mapping-conflict" };
      }
    }

    // 5. Create the session.
    const base = siteBase();
    const langQ = args.lang === "es" ? "&lang=es" : "";
    const form: Record<string, string> = {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      // Ties the session to our internal user without putting anything
      // sensitive in Stripe. No struggle text, no reflection, no spiritual data.
      client_reference_id: userId,
      "metadata[userId]": userId,
      "metadata[plan]": String(args.plan),
      "subscription_data[metadata][userId]": userId,
      // {CHECKOUT_SESSION_ID} is substituted by Stripe. The success page uses it
      // only as a correlation hint while it waits for webhook-backed state — it
      // is never itself proof of payment.
      success_url: base + "/checkout/success?session_id={CHECKOUT_SESSION_ID}" + langQ,
      // Cancelling preserves the chosen plan so returning to pricing does not
      // lose their selection.
      cancel_url:
        base + "/checkout/cancelled?plan=" + encodeURIComponent(String(args.plan)) + langQ,
      // No trial has been approved; none is configured here.
    };

    // Bucketed so a double-click reuses one session, but a genuine retry
    // minutes later is allowed to make a new one.
    const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const idem = `co:${userId}:${args.plan}:${bucket}`;

    const res = await stripePost("/checkout/sessions", secret, form, idem);
    if (!res.ok || !res.data?.url) {
      return { error: "stripe-error" };
    }
    return { url: res.data.url as string };
  },
});

/* ── Customer Portal ─────────────────────────────────────────────────────── */

export const createPortalSession = action({
  args: { lang: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ url?: string; error?: string }> => {
    // 1. Trusted identity first — see createCheckoutSession.
    let user: AuthedUser;
    try {
      user = await requireUser(ctx);
    } catch {
      return { error: "not-authenticated" };
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return { error: "billing-not-configured" };

    /* 2. Customer comes ONLY from our stored mapping.
     *
     * The legacy donation portal fell back to GET /v1/customers?email=… using a
     * browser-submitted email, which meant submitting anyone's address opened
     * their billing portal. That fallback is deliberately absent here and must
     * never be reintroduced: no email lookup, no customer id from the browser,
     * no search. If we have no mapping, the answer is no. */
    const mapping = await ctx.runQuery(
      internal.subscriptions.getCustomerInternal,
      { userId: user._id },
    );
    if (!mapping?.stripeCustomerId) {
      // Note: a past DONOR may well have a Stripe customer in gift history.
      // We deliberately do not consult it — a donation is not a subscription,
      // and opening a Plus portal for a donor would misrepresent what they hold.
      return { error: "no-subscription" };
    }

    const base = siteBase();
    const res = await stripePost("/billing_portal/sessions", secret, {
      customer: mapping.stripeCustomerId,
      return_url: base + "/you" + (args.lang === "es" ? "?lang=es" : ""),
    });
    if (!res.ok || !res.data?.url) return { error: "stripe-error" };
    return { url: res.data.url as string };
  },
});
