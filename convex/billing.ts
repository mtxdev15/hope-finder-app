import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { fetchSubscription, stripeGet, stripePost } from "./stripeApi";
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

    /* THE READER'S LANGUAGE, carried the same way and trusted differently.
     *
     * Deliberately stamped AFTER the provenance loop and not inside it. The
     * five keys above are checked by classifyPlusSubscription; this one is not,
     * and must never be — a sixth checked key would reject every subscription
     * sold before this line existed. Extra metadata keys are inert to
     * classification, which is what makes this additive and safe.
     *
     * It goes to the same two places for the same reason: the Checkout Session
     * is gone within a day, and the failed-payment emails that need this are
     * written weeks later against whatever survived. For a subscription that is
     * subscription_data; for a one-off it is the PaymentIntent.
     *
     * English is the absence of the key rather than a stamped "en", so a row
     * that predates this reads identically to one stamped by an English
     * checkout. Nothing has to be backfilled. */
    const stampLang = args.lang === "es" ? "es" : null;
    if (stampLang) {
      form["metadata[lang]"] = stampLang;
      form[
        (oneTime ? "payment_intent_data[metadata][lang]" : "subscription_data[metadata][lang]")
      ] = stampLang;
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

/* Undo a scheduled cancellation, without sending anyone to Stripe's portal.
 *
 * WHY THIS EXISTS
 * "Keep Plus" on /billing used to open the Customer Portal, where the same
 * single intention is spelled three different ways across two screens: our
 * "Keep Plus", then Stripe's "Don't cancel subscription", then Stripe's "Renew
 * subscription". That last one is the damaging one — it reads as though it is
 * about to charge you again, to somebody who only wanted to undo a mistake.
 *
 * Cancelling should keep its friction; a confirmation step protects people from
 * cancelling by accident. Un-cancelling should have none: that person has
 * already decided to stay, and every extra screen is a chance to lose them for
 * no reason. So this is one click, on our page, in our words.
 *
 * WHAT IT DELIBERATELY IS NOT
 * Not a general "update my subscription" endpoint. It sets exactly one field to
 * exactly one value. It takes no subscription id, no customer id, no price and
 * no status from the browser — the same rule createPortalSession states about
 * the legacy email lookup applies here: if we have no stored mapping for this
 * authenticated user, the answer is no.
 *
 * IT DOES NOT WRITE OUR OWN TABLES
 * Stripe is told; the `customer.subscription.updated` webhook is what updates
 * the subscription row, through the same classification and guard path as every
 * other change. Writing the row here as well would create a second, unverified
 * way for entitlement state to change — and the whole design holds because
 * there is only one. */
export const resumeSubscription = action({
  args: {},
  handler: async (ctx): Promise<{ ok?: true; error?: string }> => {
    // 1. Trusted identity first — see createCheckoutSession.
    let user: AuthedUser;
    try {
      user = await requireUser(ctx);
    } catch {
      return { error: "not-authenticated" };
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return { error: "billing-not-configured" };

    /* 2. The subscription comes ONLY from our stored mapping for THIS user.
     *    No id crosses the wire, so there is nothing to point at someone else's
     *    subscription. */
    const existing = await ctx.runQuery(
      internal.subscriptions.getByUserProviderInternal,
      { userId: user._id, provider: "stripe" as const },
    );
    if (!existing?.stripeSubscriptionId) return { error: "no-subscription" };

    /* 3. A lifetime purchase has no recurring subscription to resume. Its row
     *    carries no `stripeSubscriptionId` at all, so the check above already
     *    catches it — this is the explicit, readable refusal rather than an
     *    accident of field absence. */
    if (existing.planKey === "plus_lifetime") return { error: "not-applicable" };

    /* 4. Only a subscription that is actually scheduled to cancel can be
     *    resumed. Refusing otherwise keeps this from being a way to poke at a
     *    subscription in any other state — a canceled one cannot be revived by
     *    flipping a boolean, and an already-active one has nothing to undo. */
    if (!existing.cancelAtPeriodEnd) return { error: "not-cancelling" };
    if (existing.status === "canceled") return { error: "already-ended" };

    const res = await stripePost(
      "/subscriptions/" + existing.stripeSubscriptionId,
      secret,
      { cancel_at_period_end: "false" },
    );
    if (!res.ok) return { error: "stripe-error" };

    /* Deliberately returns no subscription state. The caller re-reads
     * getMyEntitlements, so there is exactly one description of what someone
     * holds and it is never this function's guess about what Stripe just did. */
    return { ok: true };
  },
});

/* Billing history, read from Stripe on demand and sanitised on the way out.
 *
 * WHY NOT A TABLE
 * The obvious alternative is to persist invoices as `invoice.*` webhooks
 * arrive. It was rejected for two reasons. It would only ever show invoices
 * from the day the feature shipped, so every existing subscriber would open
 * their history and find it empty — the exact opposite of what a history is
 * for. And it would create a second copy of a fact Stripe already owns, which
 * can then drift from it. Reading through is one call on a page nobody visits
 * in a loop, and it cannot be wrong.
 *
 * WHY THE RETURN SHAPE CARRIES NO IDENTIFIER
 * `scripts/verify-subscription-visibility.ts` bans every Stripe id prefix from
 * the built bundle, and the entitlement contract bans invoice identifiers by
 * name. That is not incidental strictness: an id in the browser is the raw
 * material for pointing a request at somebody else's object. So this returns
 * amounts, dates and a status word — the things a person reads — and nothing
 * that could address a Stripe object.
 *
 * Amounts stay in MINOR UNITS with their currency. Formatting is the caller's
 * job, in the caller's locale; a server that pre-formats "$8.99" has silently
 * decided the reader is American. */
export const listInvoices = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    invoices?: Array<{
      createdAt: number;
      amountPaid: number;
      currency: string;
      status: string;
      description: string | null;
    }>;
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

    /* The customer comes ONLY from our stored mapping — same rule as
     * createPortalSession, and for the same reason: no email lookup, no id from
     * the browser, no search. Without a mapping the answer is an empty history,
     * not somebody else's. */
    const mapping = await ctx.runQuery(
      internal.subscriptions.getCustomerInternal,
      { userId: user._id },
    );
    if (!mapping?.stripeCustomerId) return { invoices: [] };

    /* Bounded. A subscriber with years of history does not need all of it on a
     * settings page, and an unbounded list is an unbounded response. */
    const res = await stripeGet(
      "/invoices?limit=12&customer=" + encodeURIComponent(mapping.stripeCustomerId),
      secret,
    );
    if (!res.ok) return { error: "stripe-error" };

    const raw = Array.isArray(res.data?.data) ? res.data.data : [];
    /* An allowlist, built field by field. Spreading Stripe's object and
     * deleting the ids would leak every field Stripe adds in future versions —
     * this leaks nothing that is not named here. */
    const invoices = raw.map((inv: any) => ({
      createdAt: typeof inv?.created === "number" ? inv.created * 1000 : 0,
      amountPaid: typeof inv?.amount_paid === "number" ? inv.amount_paid : 0,
      currency: typeof inv?.currency === "string" ? inv.currency : "usd",
      /* Stripe's own vocabulary: draft | open | paid | uncollectible | void.
       * Passed through rather than remapped, so the page never claims a state
       * Stripe does not report. */
      status: typeof inv?.status === "string" ? inv.status : "unknown",
      description:
        typeof inv?.lines?.data?.[0]?.description === "string"
          ? inv.lines.data[0].description
          : null,
    }));

    return { invoices };
  },
});

/* Stripe returns a related object as either a bare id string or an expanded
 * object, depending on what was requested. Same shape as convex/http.ts:asId —
 * duplicated rather than shared because http.ts is the webhook runtime and this
 * is the action runtime, and a helper that spans both invites one caller's
 * change to alter the other's behaviour. */
function asStripeId(x: any): string | null {
  if (typeof x === "string" && x) return x;
  if (x && typeof x === "object" && typeof x.id === "string") return x.id;
  return null;
}

/* Monthly → annual, in place, with Stripe's own proration.
 *
 * WHY IT IS NOT A CHECKOUT
 * An active subscriber's status is in BLOCKS_NEW_CHECKOUT, so createCheckoutSession
 * refuses them before any Stripe call — correctly, since a second Checkout would
 * create a second subscription and bill twice. And if one were somehow created,
 * subscriptionGuard would refuse to repoint the row ("active" is not a replaceable
 * status), leaving Stripe billing twice while our row tracked one. The only sound
 * shape is an update to the subscription that already exists.
 *
 * WHY THE PRICE AND THE METADATA MOVE IN THE SAME REQUEST
 * classifyPlusSubscription's E2 compares the subscription's `metadata.plan`
 * against the plan derived from its Price. Change the Price alone and the next
 * webhook rejects with `plan-price-mismatch` — which http.ts logs and ACKs 200,
 * so it fails SILENTLY: Stripe bills annually forever while our row still says
 * monthly. Two requests would leave that window open between them. One request
 * closes it.
 *
 * WHY items[0][id] IS MANDATORY
 * Omit it and Stripe ADDS the annual price as a second item instead of replacing
 * the monthly one. A two-item subscription is permanently unclassifiable
 * (`unexpected-multiple-items`), so every future event for that subscriber —
 * renewal, failure, cancellation — is dropped and their row freezes. We do not
 * store the item id, so it is read back from Stripe first.
 *
 * Metadata is merged per key by Stripe, so sending only `metadata[plan]` keeps
 * source, billing_schema_version, environment and userId intact. Sending a whole
 * metadata object would wipe them and the next event would reject on provenance. */
const UPGRADE_FROM: ReadonlySet<string> = new Set(["active", "trialing"]);

export const upgradeToAnnual = action({
  args: {},
  handler: async (ctx): Promise<{ ok?: true; error?: string }> => {
    let user: AuthedUser;
    try {
      user = await requireUser(ctx);
    } catch {
      return { error: "not-authenticated" };
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return { error: "billing-not-configured" };

    const annualPriceId = process.env[PLAN_CATALOG.plus_annual.envVar];
    if (!annualPriceId) return { error: "billing-not-configured" };

    const existing = await ctx.runQuery(
      internal.subscriptions.getByUserProviderInternal,
      { userId: user._id, provider: "stripe" as const },
    );
    if (!existing?.stripeSubscriptionId) return { error: "no-subscription" };

    /* Eligibility, stated rather than inferred. Each of these would be a
     * different kind of wrong, so each gets its own answer the UI can render. */
    if (existing.planKey === "plus_lifetime") return { error: "not-applicable" };
    if (existing.planKey === "plus_annual") return { error: "already-annual" };
    if (existing.planKey !== "plus_monthly") return { error: "not-applicable" };
    if (!UPGRADE_FROM.has(existing.status)) return { error: "not-upgradeable" };
    /* A subscription already scheduled to end must resume first. Upgrading one
     * that is cancelling would charge a year to somebody who has said they are
     * leaving — and the cancellation would still be pending afterwards. */
    if (existing.cancelAtPeriodEnd) return { error: "cancelling" };

    /* The item id is not ours to guess — read the live subscription. */
    const sub = await fetchSubscription(existing.stripeSubscriptionId, secret);
    if (!sub.ok) return { error: "stripe-error" };
    const itemId = sub.data?.items?.data?.[0]?.id;
    if (typeof itemId !== "string" || !itemId) return { error: "stripe-error" };
    /* If Stripe already shows more than one item, this subscription is not one
     * we built and an upgrade would make it worse, not better. */
    if ((sub.data?.items?.data?.length || 0) !== 1) return { error: "not-applicable" };

    /* Idempotency: unlike resumeSubscription — which sets one field to one value
     * and is naturally idempotent — a proration can mint extra invoice line items
     * if replayed. Bucketed like the Checkout key so a double-click collapses but
     * a deliberate retry minutes later is allowed to be a real request. */
    const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const idem = `up:${user._id}:plus_annual:${bucket}`;

    const res = await stripePost(
      "/subscriptions/" + existing.stripeSubscriptionId,
      secret,
      {
        "items[0][id]": itemId,
        "items[0][price]": annualPriceId,
        /* Credit the unused remainder of the current period and charge the
         * difference now. This is the industry-standard reading of "credit what
         * they have paid": the consumed months are consumed. */
        proration_behavior: "create_prorations",
        /* Bill the proration immediately rather than parking it on the next
         * invoice, so the charge matches what the confirm screen said. */
        payment_behavior: "allow_incomplete",
        "metadata[plan]": "plus_annual",
      },
      idem,
    );
    if (!res.ok) return { error: "stripe-error" };

    /* No local write. The customer.subscription.updated webhook carries the new
     * Price and the corrected metadata through the same classification and guard
     * path as everything else — the row has one author. */
    return { ok: true };
  },
});

/* What switching to annual would cost today, asked of Stripe before committing.
 *
 * THIS ENDPOINT IS UNVERIFIED AT OUR PINNED API VERSION.
 * Stripe renamed the upcoming-invoice preview, and nothing in this repo has ever
 * called either name at `2026-06-24.dahlia`. Rather than guess and risk printing
 * a wrong figure on a payment screen — the single worst place to be confidently
 * wrong — this returns `amountDue: null` on ANY failure and the caller renders
 * honest prose instead of a number.
 *
 * So the design degrades to correct, never to fabricated:
 *   Stripe answers  -> the exact amount due today
 *   Stripe does not -> "you will pay less than the full price today", which is
 *                      true under create_prorations regardless
 *
 * When a real upgrade confirms the shape, narrow this the way http.ts narrowed
 * its field readers, and delete the fallback path only then. */
export const previewAnnualUpgrade = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    amountDue: number | null;
    currency: string | null;
    error?: string;
  }> => {
    let user: AuthedUser;
    try {
      user = await requireUser(ctx);
    } catch {
      return { amountDue: null, currency: null, error: "not-authenticated" };
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    const annualPriceId = process.env[PLAN_CATALOG.plus_annual.envVar];
    if (!secret || !annualPriceId) {
      return { amountDue: null, currency: null, error: "billing-not-configured" };
    }

    const existing = await ctx.runQuery(
      internal.subscriptions.getByUserProviderInternal,
      { userId: user._id, provider: "stripe" as const },
    );
    if (!existing?.stripeSubscriptionId || existing.planKey !== "plus_monthly") {
      return { amountDue: null, currency: null, error: "not-applicable" };
    }

    const sub = await fetchSubscription(existing.stripeSubscriptionId, secret);
    if (!sub.ok) return { amountDue: null, currency: null };
    const itemId = sub.data?.items?.data?.[0]?.id;
    const customerId = asStripeId(sub.data?.customer);
    if (typeof itemId !== "string" || !customerId) {
      return { amountDue: null, currency: null };
    }

    const res = await stripePost("/invoices/create_preview", secret, {
      customer: customerId,
      subscription: existing.stripeSubscriptionId,
      "subscription_details[items][0][id]": itemId,
      "subscription_details[items][0][price]": annualPriceId,
      "subscription_details[proration_behavior]": "create_prorations",
    });
    /* Every failure lands here — wrong endpoint name, wrong parameter shape,
     * an API version that moved the field. All of them mean the same thing to
     * the caller: we do not know the number, so do not print one. */
    if (!res.ok) return { amountDue: null, currency: null };

    const due = res.data?.amount_due;
    const cur = res.data?.currency;
    if (typeof due !== "number" || typeof cur !== "string") {
      return { amountDue: null, currency: null };
    }
    return { amountDue: due, currency: cur };
  },
});
