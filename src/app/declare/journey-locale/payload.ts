/* Journey translation payload construction — pure.
 *
 * Separated from review-controller.js so the privacy claim can be proven in
 * plain node: the controller imports the Convex browser client, which a test
 * harness cannot resolve. The most important guarantee in this feature is
 * "a reflection can never ride along", so it must be mechanically testable.
 *
 * The guarantee is structural rather than defensive: the payload is built by
 * an explicit PICK of six named fields from a whole day record, so anything not
 * named simply cannot appear. There is no filtering step to forget.
 */

import { TRANSLATABLE_FIELD_NAMES, type TranslatableFields } from "./types.ts";

export function pickTranslatable(day: unknown): TranslatableFields {
  const out: TranslatableFields = {};
  if (!day || typeof day !== "object") return out;
  const rec = day as Record<string, unknown>;
  for (const k of TRANSLATABLE_FIELD_NAMES) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}
