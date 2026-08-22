import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";
import { fetchSubscription } from "./stripeApi";
import {
  classifyPlusSubscription,
  approvedPricesFromEnv,
  environmentForSecret,
  stampedUserId,
} from "./plusPlans";

const http = httpRouter();

// CORS required for client-side frameworks.
authComponent.registerRoutes(http, createAuth, { cors: true });

/* The two giving httpActions (/give/record and /give/customer-lookup) were
   removed with the donation product. The Worker route that called them is
   retired to 410 and the gift tables are gone. */

/* ===== Plus subscription ingress (Release C1 Phase 3, revised Stage 2) ======
   Trust boundary, stated exactly:

     Stripe  --(signed payload)-->  Worker /billing/webhook
       The Worker verifies the Stripe signature (HMAC-SHA256, constant-time
       compare, 5-minute replay window) BEFORE anything reaches Convex. That
       verification is the only thing standing between the public internet and
       this route, which is why it happens there and is not repeated here.

       The Worker does nothing else. It holds no Stripe credential, makes no
       Stripe API call, and decides nothing about entitlement. It forwards the
       verified event body verbatim.

     Worker  --(x-billing-secret)-->  this httpAction
       A shared secret proves the caller is our Worker. It does NOT prove
       anything about a user, so nothing here trusts a user-supplied field.

     this httpAction
       Fetches the subscription from Stripe through the single pinned client in
       stripeApi.ts, then CLASSIFIES it (plusPlans.classifyPlusSubscription).
       Only a subscription that passes every evidence check reaches the mutation.

     --> internal.subscriptions.applyWebhook
       Idempotency, ordering and account resolution all live in that mutation.

   A signed-in browser can reach none of this. It has no route here, no secret,
   and no public mutation to call.

   Deliberately a SEPARATE secret from GIFT_WEBHOOK_SECRET: donations and
   subscriptions are different products, and one compromised integration must
   not hand over the other. ================================================== */

/* Events that carry subscription lifecycle. Anything else is acknowledged and
   ignored, so Stripe stops retrying without us acting on noise. This lives here
   rather than in the Worker so that widening it is a Convex deploy, not a
   Worker deploy — the Worker is intentionally ignorant of what we care about. */
const BILLING_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
]);

/* Refuse absurd bodies before parsing. The Worker bounds this too; doing it in
   both places means neither has to trust the other. */
const MAX_EVENT_BYTES = 1_048_576; // 1 MiB

/* ── PINNED FIELD READERS (2026-06-24.dahlia) ────────────────────────────────
   These were provisional until a real sandbox purchase was completed on
   2026-08-21 and its payloads read back at the pinned version. Both readers
   were then NARROWED to the one location each field actually occupies. See
   docs/operations/stage-2-sandbox-billing.md §6.8 for the captured shapes.

   What the older, wider versions accepted and these no longer do:
     - `subscription.current_period_start` / `.current_period_end`
     - `invoice.subscription`

   Neither exists under this API version. Reading them was never wrong, it was
   the deliberate absence of a guess while the real shape was unknown. Now it IS
   known, and keeping the fallbacks would be worse than useless: a payload that
   carries ONLY the old fields is not a valid pinned-version payload, and
   silently accepting it would let a version drift — an unpinned client, a
   replayed archive, a hand-built object — flow into the entitlement tables
   looking healthy. Failing closed surfaces the drift instead.

   These are tied to stripeApi.STRIPE_API_VERSION. If that pin ever moves,
   re-capture real payloads and re-narrow; do not widen speculatively. */
function readPeriod(sub: any): { start?: number; end?: number } {
  /* Dahlia carries the period on the subscription ITEM, never on the
   * subscription root. Our Checkout sends exactly one line item, and
   * classification rejects `unexpected-multiple-items`, so item[0] is the
   * only item there can be. */
  const item = sub?.items?.data?.[0];
  const start = item?.current_period_start;
  const end = item?.current_period_end;
  return {
    start: typeof start === "number" ? start : undefined,
    end: typeof end === "number" ? end : undefined,
  };
}

function readInvoiceSubscriptionId(obj: any): string | null {
  /* Dahlia nests the invoice-to-subscription link under `parent`. There is no
   * top-level `invoice.subscription`. Both the plain id and the expanded
   * object are accepted at that one location, since `expand` changes the
   * shape of the value, not where it lives. */
  const nested = obj?.parent?.subscription_details?.subscription;
  if (typeof nested === "string" && nested) return nested;
  if (nested && typeof nested === "object" && typeof nested.id === "string") return nested.id;
  return null;
}

function asId(x: any): string | null {
  if (typeof x === "string" && x) return x;
  if (x && typeof x === "object" && typeof x.id === "string") return x.id;
  return null;
}

const ACK = () => new Response("ok", { status: 200 });

http.route({
  path: "/billing/subscription-event",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secretHeader = req.headers.get("x-billing-secret") || "";
    const expected = process.env.BILLING_WEBHOOK_SECRET || "";
    if (!expected || secretHeader !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }

    const raw = await req.text();
    if (raw.length > MAX_EVENT_BYTES) {
      return new Response("Payload too large", { status: 413 });
    }

    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    const eventId = typeof event?.id === "string" ? event.id : "";
    const eventType = typeof event?.type === "string" ? event.type : "";
    const eventCreated = Number(event?.created);
    if (!eventId || !eventType || !Number.isFinite(eventCreated)) {
      return new Response("Bad request", { status: 400 });
    }

    // Not a lifecycle event we act on. Acknowledged, not an error.
    if (!BILLING_EVENTS.has(eventType)) return ACK();

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      // Billing is not configured in this deployment. Fail closed and let
      // Stripe retry rather than silently dropping a real purchase.
      return new Response("Billing not configured", { status: 503 });
    }
    const environment = environmentForSecret(stripeSecret);
    if (!environment) return new Response("Billing not configured", { status: 503 });

    const obj = event?.data?.object || {};
    let subscriptionId: string | null = null;
    let session: any = null;

    if (eventType.startsWith("customer.subscription.")) {
      subscriptionId = asId(obj);
    } else if (eventType.startsWith("checkout.session.")) {
      /* NOTE: `mode` is NOT used to decide whether this is Plus. A retired
       * recurring gift is also mode 'subscription'. Classification below is the
       * only thing that decides. Mode is read here solely to know whether a
       * subscription id can exist at all. */
      session = obj;
      subscriptionId = asId(obj.subscription);
    } else if (eventType.startsWith("invoice.")) {
      subscriptionId = readInvoiceSubscriptionId(obj);
    }

    // Nothing actionable — e.g. an expired session that never became a
    // subscription. Acknowledge so Stripe stops retrying.
    if (!subscriptionId) return ACK();

    /* The one Stripe call in the webhook path, from the one pinned client.
     * This used to live in the Worker with a second copy of the secret key and
     * no version header. */
    const fetched = await fetchSubscription(subscriptionId, stripeSecret);
    if (!fetched.ok || !fetched.data) {
      // Transient or auth failure: let Stripe retry rather than record a
      // processed event we never applied.
      return new Response("Upstream error", { status: 502 });
    }
    const sub = fetched.data;

    /* ── C2: classification ────────────────────────────────────────────────
     * Every piece of server-controlled evidence must agree. A retired
     * recurring gift fails here — it carries no approved Price, no canonical
     * plan and no provenance — and so can never grant Plus. */
    const verdict = classifyPlusSubscription({
      subscription: sub,
      session,
      approvedPrices: approvedPricesFromEnv(process.env as Record<string, string | undefined>),
      environment,
    });

    if (!verdict.ok) {
      /* Acknowledged, never applied. Logged with the reason and the event id
       * only — never the payload, which carries customer and subscription ids
       * that have no business in logs. */
      console.log(
        "[billing] not-plus event=" + eventId + " type=" + eventType +
          " reason=" + verdict.reason,
      );
      return ACK();
    }

    const customerId = asId(sub.customer);
    if (!customerId) return ACK();

    const item = sub?.items?.data?.[0];
    const price = item?.price;
    const period = readPeriod(sub);
    const interval = price?.recurring?.interval;

    const result = await ctx.runMutation(internal.subscriptions.applyWebhook, {
      provider: "stripe" as const,
      environment,
      planKey: verdict.planKey,
      eventId,
      eventType,
      eventCreated,
      status: String(sub.status || ""),
      stripeCustomerId: customerId,
      stripeSubscriptionId: String(sub.id),
      ...(typeof price?.id === "string" ? { stripePriceId: price.id } : {}),
      ...(interval === "month" || interval === "year"
        ? { billingInterval: interval as "month" | "year" }
        : {}),
      ...(period.start != null ? { currentPeriodStart: period.start } : {}),
      ...(period.end != null ? { currentPeriodEnd: period.end } : {}),
      ...(typeof sub.cancel_at_period_end === "boolean"
        ? { cancelAtPeriodEnd: sub.cancel_at_period_end }
        : {}),
      ...(typeof sub.canceled_at === "number" ? { canceledAt: sub.canceled_at } : {}),
      ...(typeof sub.trial_end === "number" ? { trialEnd: sub.trial_end } : {}),
      ...(asId(sub.latest_invoice) ? { latestInvoiceId: asId(sub.latest_invoice) as string } : {}),
      // Verified provenance, not a browser value: classification has already
      // confirmed this metadata was stamped by our own Checkout action.
      ...(stampedUserId(sub, session)
        ? { metadataUserId: stampedUserId(sub, session) as string }
        : {}),
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
