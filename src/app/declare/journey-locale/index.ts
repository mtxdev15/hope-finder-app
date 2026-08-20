/* Declare & Believe — Journey locale module.
 *
 * Pure, dependency-free building blocks for Spanish Journey content. Nothing
 * here touches the DOM, storage, or the network, and NOTHING IN THE PRODUCT
 * IMPORTS THIS YET — surfaces are wired in a later, separately reviewed step,
 * and only once the production translation transport exists.
 *
 * Verify with:  node scripts/verify-journey-locale.ts
 */

export * from "./types.ts";
export * from "./locale-cache.ts";
export * from "./verified-scripture.ts";
export * from "./translation-transport.ts";
