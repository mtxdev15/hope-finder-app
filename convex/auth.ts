import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;

// Component client: integration + helper methods.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL, // auto-provided by Convex
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    // Email + password only. No verification. 8-char minimum, no other rules.
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
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
