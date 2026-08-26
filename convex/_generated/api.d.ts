/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountDay from "../accountDay.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as dunning from "../dunning.js";
import type * as dunningSchedule from "../dunningSchedule.js";
import type * as email from "../email.js";
import type * as entitlementCatalog from "../entitlementCatalog.js";
import type * as entitlements from "../entitlements.js";
import type * as http from "../http.js";
import type * as journeySlots from "../journeySlots.js";
import type * as journeyTranslate from "../journeyTranslate.js";
import type * as journeyTranslateCore from "../journeyTranslateCore.js";
import type * as plusPlans from "../plusPlans.js";
import type * as reviews from "../reviews.js";
import type * as stripeApi from "../stripeApi.js";
import type * as stripeCancellation from "../stripeCancellation.js";
import type * as subscriptionGuard from "../subscriptionGuard.js";
import type * as subscriptions from "../subscriptions.js";
import type * as testHarness from "../testHarness.js";
import type * as testHarnessState from "../testHarnessState.js";
import type * as usage from "../usage.js";
import type * as userdata from "../userdata.js";
import type * as vault from "../vault.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountDay: typeof accountDay;
  auth: typeof auth;
  billing: typeof billing;
  dunning: typeof dunning;
  dunningSchedule: typeof dunningSchedule;
  email: typeof email;
  entitlementCatalog: typeof entitlementCatalog;
  entitlements: typeof entitlements;
  http: typeof http;
  journeySlots: typeof journeySlots;
  journeyTranslate: typeof journeyTranslate;
  journeyTranslateCore: typeof journeyTranslateCore;
  plusPlans: typeof plusPlans;
  reviews: typeof reviews;
  stripeApi: typeof stripeApi;
  stripeCancellation: typeof stripeCancellation;
  subscriptionGuard: typeof subscriptionGuard;
  subscriptions: typeof subscriptions;
  testHarness: typeof testHarness;
  testHarnessState: typeof testHarnessState;
  usage: typeof usage;
  userdata: typeof userdata;
  vault: typeof vault;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
