import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { requireActionCtx } from "@convex-dev/better-auth/utils";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";
import { sendResetPassword } from "./email";

const siteUrl = process.env.SITE_URL!;

/* ONE additional trusted origin, for pointing a LOCAL dev server at a DEPLOYED
 * backend — the live billing smoke test, where a real Checkout has to be
 * started by our own code as a real production user, and the dev control that
 * starts it only exists under `npm run dev`.
 *
 * WHY THIS IS NEEDED AT ALL
 * Better Auth's sign-in route runs formCsrfMiddleware. A browser `fetch` always
 * carries Sec-Fetch-* headers, which sends that middleware into
 * validateOrigin(ctx, forceValidate: true) — so the `useCookies` escape hatch
 * never applies and the Origin header is checked unconditionally. From
 * http://localhost:4321 against a deployment whose SITE_URL is the live domain,
 * that is a hard FORBIDDEN / INVALID_ORIGIN. There is no client-side way around
 * it, and there should not be.
 *
 * WHY AN ENV VAR RATHER THAN A HARDCODED localhost ENTRY
 * Absent by default. A deployment trusts exactly ONE origin unless somebody
 * deliberately sets this, and having set it is then visible in that
 * deployment's environment-variable list — so the widening is discoverable by
 * looking, not only by reading source. Hardcoding localhost would widen every
 * deployment forever, silently, including production.
 *
 * REMOVE IT WHEN THE TEST IS DONE. While it is set, that origin can begin a
 * sign-in against this deployment. */
const extraTrustedOrigin = process.env.EXTRA_TRUSTED_ORIGIN;
const trustedOrigins = extraTrustedOrigin
  ? [siteUrl, extraTrustedOrigin]
  : [siteUrl];

// Component client: integration + helper methods.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL, // auto-provided by Convex
    trustedOrigins,
    database: authComponent.adapter(ctx),
    // Email + password. Simple sign-up: name, email, password, then straight
    // into the app. No email-verification step (it can be added later as a
    // magic-link flow if it is ever needed).
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        await sendResetPassword(requireActionCtx(ctx), {
          to: user.email,
          url,
        });
      },
    },
    /* ── The welcome, at the one moment it belongs ─────────────────────────
     *
     * Fires once per account, for email sign-up and for Google alike, because
     * both land here. Nothing else in the system knows an account has just
     * come into existence.
     *
     * WRAPPED IN try/catch, AND THAT IS THE POINT. Everything in this block is
     * downstream of a person pressing "create account". A mail provider being
     * slow, an action context not being available in some future auth flow, a
     * transient network failure: none of them may turn into a failed sign-up.
     * The email is nice to have; the account is the thing they came for.
     *
     * Scheduled rather than awaited, so the send never sits in the critical
     * path of the response that lets them into the app. */
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              const email = typeof user?.email === "string" ? user.email : "";
              if (!email) return;
              await requireActionCtx(ctx).scheduler.runAfter(
                0,
                internal.dunning.sendSignupWelcome,
                { to: email },
              );
            } catch (e) {
              /* Deliberately swallowed, and deliberately not logged as an
                 error: a missing welcome is not a failure of the thing the
                 person was doing. */
            }
          },
        },
      },
    },
    // Google OAuth. Credentials read from Convex env vars (never hardcoded).
    // Redirect URI is {CONVEX_SITE_URL}/api/auth/callback/google, already registered in Google Cloud.
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    plugins: [
      // Required for client-side frameworks (cross-domain cookies).
      crossDomain({ siteUrl }),
      // Required for Convex compatibility.
      convex({ authConfig }),
    ],
  });
};

// Convenience query for the current user (returns null when signed out).
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    // safeGetAuthUser resolves to undefined when unauthenticated; normalize to null
    // since Convex serializes undefined as null and the contract is "user or null".
    return (await authComponent.safeGetAuthUser(ctx)) ?? null;
  },
});
