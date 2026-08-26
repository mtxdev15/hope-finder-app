import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { stripePost } from "./stripeApi";
import {
  PLAN_CATALOG,
  BILLING_SCHEMA_VERSION,
  CHECKOUT_SOURCE,
  planKeyForAlias,
  environmentForSecret,
  isOneTimePlan,
  LIFETIME_SEATS,
  type PlanKey,
} from "./plusPlans";

/* Plus billing — authenticated Checkout and Customer Portal.
 *
 * WHY THIS LIVES IN CONVEX AND NOT THE WORKER
 * The Worker cannot verify Better Auth identity: it has no session check, no
 * JWT verification, and no Better Auth import. That is exactly why the legacy
 * donation flow ended up trusting a browser-supplied `body.userId`. Convex
 * resolves identity from trusted context, so here the prohibited pattern is not
 * merely avoided, it is unrepresentable — there is no userId argument to spoof.
 *
 * THE STRIPE CREDENTIAL LIVES HERE AND NOWHERE ELSE
 * Every Stripe API call in this application originates in Convex, through
 * stripeApi.ts, with an explicit pinned API version. The Worker owns the webhook
 * edge — signature verification and forwarding — and carries no Stripe
 * credential at all. One credential, one runtime, one API version.
 *
 * Two rules this file exists to enforce:
 *   1. Identity comes only from authComponent.safeGetAuthUser(ctx).
 *   2. The browser may name a PLAN ALIAS, never a Stripe Price id, customer id,
 *      subscription id, or email. Everything Stripe-shaped is server-resolved.
 */

/* Lifecycle -> what happens when this user asks to check out again.
 * Decided server-side from OUR mirrored state, never from the frontend. */
const BLOCKS_NEW_CHECKOUT = new Set([
  "active", // already paying
  "trialing", // not advertised, but honour it if legacy state exists
  "past_due", // card failing: fix billing, do not stack a second subscription
  "unpaid", // same
]);
const ALLOWS_NEW_CHECKOUT = new Set(["canceled", "incomplete_expired", "ended"]);

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
    // The ONLY billing input the browser controls: a plan alias.
    plan: v.string(),
    lang: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ url?: string; error?: string; status?: string }> => {
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

    /* Which environment this runtime is, derived from the credential itself so
     * it cannot drift: a sandbox key can never claim to be production. Stamped
     * into metadata and checked again at webhook time. */
    const environment = environmentForSecret(secret);
    if (!environment) return { error: "billing-not-configured" };

    // 2. Alias -> canonical plan -> trusted Price id.
    const planKey: PlanKey | null = planKeyForAlias(String(args.plan));
    if (!planKey) return { error: "unknown-plan" };
    const priceId = process.env[PLAN_CATALOG[planKey].envVar];
    if (!priceId) return { error: "billing-not-configured" };

    // 3. Duplicate prevention, from server-authoritative state. Scoped to the
    //    Stripe provider: an Apple subscription is handled by the cross-provider
    //    check below, not by Stripe's lifecycle rules.
    const existing = await ctx.runQuery(
      internal.subscriptions.getByUserProviderInternal,
      { userId, provider: "stripe" as const },
    );
    if (existing) {
      /* A lifetime holder already owns everything any other plan sells, and
       * their row's `paid` status is not in either set below — it belongs to a
       * different vocabulary entirely. Without this branch they would fall
       * through to the unrecognised-lifecycle refusal at the end, which is the
       * right ANSWER for the wrong REASON, and would tell them "already
       * subscribed" with a status string no surface knows how to render. */
      if (existing.planKey === "plus_lifetime" && existing.status === "paid") {
        return { error: "already-subscribed", status: "lifetime" };
      }
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

    /* 3b. Cross-provider guard. Apple cannot see a Stripe subscription and
     *     will not stop someone buying twice, so we check the canonical
     *     entitlement before opening a purchase flow rather than letting them
     *     pay two companies for the same thing. */
    const appleRow = await ctx.runQuery(
      internal.subscriptions.getByUserProviderInternal,
      { userId, provider: "app_store" as const },
    );
    if (appleRow && appleRow.tier === "plus") {
      return { error: "already-subscribed", status: "app-store" };
    }

    /* 3c. The founding-member cap, checked only for the one-time plan.
     *
     * Deliberately AFTER the duplicate checks above: someone who already
     * subscribes should be told that, not told the round is full. And
     * deliberately before the customer is created, so a refused purchase
     * leaves no Stripe object behind.
     *
     * Soft by construction — see LIFETIME_SEATS. A seat is consumed when the
     * webhook records a paid purchase, not when a Checkout opens, so
     * simultaneous buyers can both pass here. Acceptable for a founding round;
     * making it exact would need reservations with expiry. */
    if (isOneTimePlan(planKey)) {
      const sold: number = await ctx.runQuery(
        internal.subscriptions.countLifetimeSoldInternal,
        { environment },
      );
      if (sold >= LIFETIME_SEATS) return { error: "lifetime-sold-out" };
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
          "metadata[environment]": environment,
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

    /* PROVENANCE (C2). Stamped onto the session AND onto subscription_data, so
     * every later lifecycle event carries it too. Without the subscription
     * copy, classification would pass at checkout.session.completed and then
     * have nothing to read on customer.subscription.updated or invoice.paid —
     * it would silently degrade to unverifiable exactly when it matters.
     *
     * A retired recurring gift carries none of these. That is what makes it
     * distinguishable from Plus, since both are mode 'subscription'. */
    const provenance: Record<string, string> = {
      userId,
      plan: planKey, // canonical key, not the browser's alias
      source: CHECKOUT_SOURCE,
      billing_schema_version: BILLING_SCHEMA_VERSION,
      environment,
    };

    /* A one-time plan is bought in `mode: "payment"`. That single difference
     * is what makes lifetime a different purchase and the same product. */
    const oneTime = isOneTimePlan(planKey);

    const form: Record<string, string> = {
      mode: oneTime ? "payment" : "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      // Ties the session to our internal user without putting anything
      // sensitive in Stripe. No struggle text, no reflection, no spiritual data.
      client_reference_id: userId,
      /* Tax calculation is intentionally deferred during sandbox billing
       * development. Set explicitly rather than left to a default so the
       * decision is visible in the request itself. Before live charging,
       * review Stripe Tax monitoring, home-state obligations, economic-nexus
       * thresholds, the product tax code and registrations with an accountant.
       * See docs/implementation/release-c1-phase4-entitlements.md. */
      "automatic_tax[enabled]": "false",
      // {CHECKOUT_SESSION_ID} is substituted by Stripe. The success page uses it
      // only as a correlation hint while it waits for webhook-backed state — it
      // is never itself proof of payment.
      success_url:
        base + "/checkout/success?session_id={CHECKOUT_SESSION_ID}" + langQ,
      // Cancelling preserves the chosen plan so returning to pricing does not
      // lose their selection.
      cancel_url:
        base +
        "/checkout/cancelled?plan=" +
        encodeURIComponent(String(args.plan)) +
        langQ,
      // No trial has been approved; none is configured here.
    };
    for (const [k, val] of Object.entries(provenance)) {
      form["metadata[" + k + "]"] = val;
      /* The second copy has to go somewhere that OUTLIVES the session.
       *
       * For a subscription, that is subscription_data — every later lifecycle
       * event carries the subscription, so classification has something to read
       * on customer.subscription.updated and invoice.paid.
       *
       * For a one-time payment there IS no such later event, and no
       * subscription_data field to write: sending it in payment mode is an API
       * error, not a harmless extra. The durable object is the PaymentIntent,
       * so the copy goes there — which is also where a refund event will carry
       * it back to us. */
      form[
        (oneTime ? "payment_intent_data[metadata][" : "subscription_data[metadata][") +
          k + "]"
      ] = val;
    }

    // Bucketed so a double-click reuses one session, but a genuine retry
    // minutes later is allowed to make a new one.
    const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const idem = `co:${userId}:${planKey}:${bucket}`;

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
      //
      // An APPLE subscriber also lands here, correctly: Stripe has no portal
      // for a subscription Apple billed. The UI routes them to Apple's own
      // subscription management using the `provider` field.
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
