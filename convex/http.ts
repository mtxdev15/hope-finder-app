import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// CORS required for client-side frameworks.
authComponent.registerRoutes(http, createAuth, { cors: true });

// Giving counter ingress. The Cloudflare Worker calls this AFTER it has verified
// the Stripe webhook signature, so this only needs a shared secret to confirm the
// caller is our Worker. Increments the public counter (+ per-user history).
http.route({
  path: "/give/record",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = req.headers.get("x-gift-secret") || "";
    const expected = process.env.GIFT_WEBHOOK_SECRET || "";
    if (!expected || secret !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const amountCents = Math.round(Number(body && body.amountCents));
    const sessionId = body && body.sessionId ? String(body.sessionId) : "";
    if (!sessionId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return new Response("Bad request", { status: 400 });
    }
    await ctx.runMutation(internal.gifts.record, {
      sessionId,
      amountCents,
      currency: body.currency ? String(body.currency) : "usd",
      recurring: !!(body && body.recurring),
      ...(body.frequency ? { frequency: String(body.frequency) } : {}),
      ...(body.userId ? { userId: String(body.userId) } : {}),
      ...(body.subscriptionId ? { subscriptionId: String(body.subscriptionId) } : {}),
      ...(body.customerId ? { customerId: String(body.customerId) } : {}),
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Billing-portal ingress. The Worker's /give/portal endpoint calls this to
// resolve which Stripe customer a signed-in user's most recent recurring gift
// belongs to, so it can open a real portal session with zero email step.
// Same shared-secret guard as /give/record — no new secret to provision.
http.route({
  path: "/give/customer-lookup",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = req.headers.get("x-gift-secret") || "";
    const expected = process.env.GIFT_WEBHOOK_SECRET || "";
    if (!expected || secret !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const userId = body && body.userId ? String(body.userId) : "";
    if (!userId) return new Response("Bad request", { status: 400 });
    const result = await ctx.runQuery(internal.gifts.mostRecentRecurring, { userId });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
