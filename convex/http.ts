import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// CORS required for client-side frameworks.
authComponent.registerRoutes(http, createAuth, { cors: true });

/* The two giving httpActions (/give/record and /give/customer-lookup) were
   removed with the donation product. The Worker route that called them is
   retired to 410 and the gift tables are gone. */

/* ===== Plus subscription ingress (Release C1 Phase 3) =======================
   Trust boundary, stated exactly:

     Stripe  --(signed payload)-->  Worker /billing/webhook
       The Worker verifies the Stripe signature (HMAC-SHA256, constant-time
       compare, 5-minute replay window) BEFORE anything reaches Convex. That
       verification is the only thing standing between the public internet and
       this route, which is why it happens there and is not repeated here.

     Worker  --(x-billing-secret)-->  this httpAction
       A shared secret proves the caller is our Worker. It does NOT prove
       anything about a user, so nothing here trusts a user-supplied field:
       `metadataUserId` is only ever the value WE set as client_reference_id on
       a Checkout Session we ourselves created for an authenticated user.

     this httpAction --> internal.subscriptions.applyWebhook
       Idempotency, ordering and account resolution all live in that mutation.

   A signed-in browser can reach none of this. It has no route here, no secret,
   and no public mutation to call.

   Deliberately a SEPARATE secret from GIFT_WEBHOOK_SECRET: donations and
   subscriptions are different products, and one compromised integration must
   not hand over the other. ================================================== */
http.route({
  path: "/billing/subscription-event",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = req.headers.get("x-billing-secret") || "";
    const expected = process.env.BILLING_WEBHOOK_SECRET || "";
    if (!expected || secret !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    const eventId = body?.eventId ? String(body.eventId) : "";
    const eventType = body?.eventType ? String(body.eventType) : "";
    const stripeCustomerId = body?.stripeCustomerId ? String(body.stripeCustomerId) : "";
    const stripeSubscriptionId = body?.stripeSubscriptionId
      ? String(body.stripeSubscriptionId)
      : "";
    const status = body?.status ? String(body.status) : "";
    const eventCreated = Number(body?.eventCreated);

    if (
      !eventId ||
      !eventType ||
      !stripeCustomerId ||
      !stripeSubscriptionId ||
      !status ||
      !Number.isFinite(eventCreated)
    ) {
      return new Response("Bad request", { status: 400 });
    }

    const num = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : undefined);

    const result = await ctx.runMutation(internal.subscriptions.applyWebhook, {
      eventId,
      eventType,
      eventCreated,
      stripeCustomerId,
      stripeSubscriptionId,
      status,
      ...(body.stripePriceId ? { stripePriceId: String(body.stripePriceId) } : {}),
      ...(body.billingInterval ? { billingInterval: String(body.billingInterval) } : {}),
      ...(num(body.currentPeriodStart) != null
        ? { currentPeriodStart: num(body.currentPeriodStart) }
        : {}),
      ...(num(body.currentPeriodEnd) != null
        ? { currentPeriodEnd: num(body.currentPeriodEnd) }
        : {}),
      ...(typeof body.cancelAtPeriodEnd === "boolean"
        ? { cancelAtPeriodEnd: body.cancelAtPeriodEnd }
        : {}),
      ...(num(body.canceledAt) != null ? { canceledAt: num(body.canceledAt) } : {}),
      ...(num(body.trialEnd) != null ? { trialEnd: num(body.trialEnd) } : {}),
      ...(body.latestInvoiceId ? { latestInvoiceId: String(body.latestInvoiceId) } : {}),
      ...(body.metadataUserId ? { metadataUserId: String(body.metadataUserId) } : {}),
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
