/* Starting a Checkout, in a module of its very own.
 *
 * WHY THIS IS NOT IN convex-data.js WITH EVERY OTHER CALL.
 *
 * The rule this codebase holds is that production must be STRUCTURALLY unable
 * to start a Checkout, not merely unwilling: the shipped JavaScript cannot even
 * name `createCheckoutSession`, and six suites grep dist/ to keep it that way.
 * That is a far stronger guarantee than a disabled button, because it is
 * checkable by looking rather than by reasoning about which branches are
 * reachable.
 *
 * convex-data.js is imported statically by /pricing for entitlements, so
 * anything living there ships whether it is called or not. Alone in this file,
 * behind a dynamic import gated on PRICING_ENABLED, it ships only when
 * purchasing is genuinely on.
 *
 * So flipping that flag changes the BUILD OUTPUT, not just a runtime branch,
 * and the suites can go on proving the guarantee by grep.
 *
 * Do not add anything else to this file, and do not import it statically. */
import { ensure, runAction, api } from "./convex-data.js";

/* Open a Stripe Checkout Session for a plan.
 *
 * THE ONLY THING THE BROWSER MAY NAME IS A PLAN ALIAS. Not a Price id, not an
 * amount, not a customer or user id, and not a trial length. `plusPlans.ts`
 * maps the alias to the canonical plan server-side and reads the Price from
 * trusted environment; anything the browser could name instead would be
 * something it could tamper with. The trial is decided server-side too, from
 * TRIAL_DAYS and this account's own eligibility, so a modified request cannot
 * mint a longer trial or a second one.
 *
 * `lang` only chooses which language the return pages open in. It is stamped
 * into subscription metadata so the failed-payment and trial emails weeks later
 * are in the language they bought in.
 *
 * Returns { url } to redirect to, { error } for a handled refusal
 * (`already-subscribed`, `lifetime-sold-out`, `not-authenticated`,
 * `billing-not-configured`, `customer-mapping-conflict`, `stripe-error`), or
 * null when the client is unavailable. Null is "unknown", never success: a
 * caller that treats it as success sends somebody to a blank page believing
 * they bought something. */
export async function startCheckout(plan, lang) {
  return (await ensure())
    ? runAction(api().billing.createCheckoutSession, { plan, ...(lang ? { lang } : {}) })
    : null;
}
