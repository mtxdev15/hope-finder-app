/* The ONE Stripe client. Every Stripe API request in this application goes
 * through here.
 *
 * WHY THIS FILE EXISTS (C5)
 * The Worker used to call Stripe directly with its own copy of the secret key
 * and no `Stripe-Version` header, which meant it silently inherited whatever
 * the account default happened to be. The webhook endpoint could be pinned to
 * one version while the Worker's own fetch returned a different shape, and
 * nothing would report the disagreement — it would simply parse fields that
 * were no longer there.
 *
 * Two rules:
 *   1. Every request sends an explicit `Stripe-Version`. The account default is
 *      then irrelevant, which is the actual fix.
 *   2. The Stripe secret exists in ONE runtime. The Worker has no Stripe
 *      credential at all and cannot call this API.
 *
 * The pinned version below must match the `api_version` on the Stripe webhook
 * endpoint and the version recorded on any captured test fixture. Changing it
 * is a deliberate migration: re-capture fixtures, re-verify the parser, and
 * update the endpoint — never a casual bump.
 */

/* Selected during the Stage 2 audit from the api_version enum Stripe itself
 * returned for PostWebhookEndpoints — queried, not remembered. */
export const STRIPE_API_VERSION = "2026-06-24.dahlia";

const STRIPE_API = "https://api.stripe.com/v1";

export type StripeResult = { ok: boolean; status: number; data: any };

function encodeForm(obj: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(obj)) p.set(k, val);
  return p.toString();
}

async function request(
  method: "GET" | "POST" | "DELETE",
  path: string,
  secret: string,
  body?: Record<string, string>,
  idempotencyKey?: string,
): Promise<StripeResult> {
  const headers: Record<string, string> = {
    Authorization: "Bearer " + secret,
    // Rule 1. Never omitted, on any request.
    "Stripe-Version": STRIPE_API_VERSION,
  };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  try {
    const res = await fetch(STRIPE_API + path, {
      method,
      headers,
      ...(body ? { body: encodeForm(body) } : {}),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    // Network failure. Never surface the cause to a caller that might return it
    // to a browser — it can carry request details.
    return { ok: false, status: 0, data: null };
  }
}

export function stripeGet(path: string, secret: string): Promise<StripeResult> {
  return request("GET", path, secret);
}

export function stripePost(
  path: string,
  secret: string,
  body: Record<string, string>,
  idempotencyKey?: string,
): Promise<StripeResult> {
  return request("POST", path, secret, body, idempotencyKey);
}

/* DELETE. Added for the development-only Test Clock harness, which must detach
 * a PaymentMethod and delete its own clock. No production path calls this: the
 * subscription lifecycle cancels through POST, never DELETE.
 *
 * Same pinned version header as every other request — see rule 1 above. */
export function stripeDelete(
  path: string,
  secret: string,
  idempotencyKey?: string,
): Promise<StripeResult> {
  return request("DELETE", path, secret, undefined, idempotencyKey);
}

/* Retrieve a subscription, expanding the price so classification can read
 * `items.data[0].price.lookup_key` without a second round trip.
 *
 * This moved OUT of the Worker deliberately. The Worker verifies a signature
 * and forwards; it does not talk to Stripe. */
export function fetchSubscription(subscriptionId: string, secret: string) {
  return stripeGet(
    "/subscriptions/" + encodeURIComponent(subscriptionId) +
      "?expand[]=items.data.price",
    secret,
  );
}
