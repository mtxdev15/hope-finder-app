import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { requireActionCtx } from "@convex-dev/better-auth/utils";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";
import { sendResetPassword, sendVerificationEmail } from "./email";

const siteUrl = process.env.SITE_URL!;

// Component client: integration + helper methods.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL, // auto-provided by Convex
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    // Email + password. Sign-in is NOT blocked on verification (instant access
    // on sign-up = smooth UX, and the cross-domain plugin can't carry a session
    // back from a confirm link anyway). We still SEND a confirmation email
    // (emailVerification.sendOnSignUp below) and nudge unverified users in-app.
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
    // Send a "confirm your email" link on sign-up. autoSignIn is OFF on purpose:
    // the @convex-dev/better-auth cross-domain plugin only bridges a session to
    // the frontend for OAuth/magic-link redirects, NOT /verify-email — so an
    // auto-session created here never reaches declareandbelieve.com. Instead the
    // link verifies the address and redirects to /signin?verified=1, where the
    // user signs in normally (which the cross-domain client handles correctly).
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail(requireActionCtx(ctx), {
          to: user.email,
          url,
        });
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
