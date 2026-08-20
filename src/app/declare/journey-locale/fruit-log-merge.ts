/* Declare & Believe — the pure half of the Spanish Fruit Log.
 *
 * Deliberately free of DOM, network, storage and auth, so it can be exercised
 * by the verification harness in plain Node. The orchestration that needs a
 * browser lives in fruit-log-controller.js and imports these.
 *
 * The one rule worth stating twice: `fruitRow` NEVER writes to the day record.
 * `fruit` and `fruitTruth` are read in five places — this list, the Today card's
 * focus line, the Today card's fruit preview, the Vine, and the past-Journeys
 * grid — and only the first is in scope. Merging into the record would localise
 * all five at once and ship four surfaces nobody reviewed.
 */

/** The two fields the Fruit Log displays. Both are already in the translation
 *  allowlist, so this surface adds nothing to what may be sent. */
export interface FruitFields {
  fruit?: string;
  fruitTruth?: string;
}

export interface FruitRow {
  fruit?: string;
  fruitTruth?: string;
  /** Which language the CONTENT is in, so the view can mark it honestly. */
  locale: "en" | "es";
}

export interface InventoryItem {
  day: number;
  english: unknown;
}

/* Which completed days the Fruit Log is showing. `completedCount` comes from
 * the view rather than being re-derived here, so the two cannot disagree about
 * what the list contains. Clamped at both ends: a negative count yields nothing
 * and an over-long one cannot run past the plan. */
export function inventory(input: { plan: unknown[]; completedCount: number }): InventoryItem[] {
  const plan = Array.isArray(input.plan) ? input.plan : [];
  const n = Math.max(0, Math.min(Number(input.completedCount) | 0, plan.length));
  const days: InventoryItem[] = [];
  for (let day = 1; day <= n; day++) days.push({ day, english: plan[day - 1] });
  return days;
}

/* The ONLY place translated fruit reaches the view. Returns a new object every
 * time; the record passed in is never touched.
 *
 * A field missing from the translation falls back to English rather than
 * rendering empty — the list is a record of grace, and a blank row would read as
 * loss. In practice both fields are always present together, because they are
 * translated as part of one day. */
export function fruitRow(english: FruitFields | null | undefined, translated: FruitFields | null | undefined): FruitRow {
  const en = english || {};
  if (!translated) return { fruit: en.fruit, fruitTruth: en.fruitTruth, locale: "en" };
  return {
    fruit: translated.fruit != null ? translated.fruit : en.fruit,
    fruitTruth: translated.fruitTruth != null ? translated.fruitTruth : en.fruitTruth,
    locale: "es",
  };
}

/* ── Interface copy ─────────────────────────────────────────────────────────
 * These four strings are NEW and have NOT been through native es-LA review, so
 * they deliberately do not live in public/declare/i18n-strings.js. Shipping
 * unreviewed Spanish in a file any reader can open is the thing the review gate
 * exists to prevent, and the production-bundle audit would flag it.
 *
 * They are keyed exactly as the catalog would key them and are registered into
 * the live dictionary by the dev-gated view, so promotion after review is a
 * matter of moving these four entries across and deleting the registration —
 * no call site changes. Everything else this surface renders reuses copy that
 * is already approved and already shipped. */
export const FRUIT_LOG_COPY_ES: Readonly<Record<string, string>> = {
  "journey.fruitLog.prepareAction": "Preparar mi Registro de Fruto en español",
  "journey.fruitLog.preparing": "Preparando tu Registro de Fruto en español…",
  "journey.fruitLog.progress": "Día {n} de {total}",
  "journey.fruitLog.failBody": "No pudimos preparar todo tu Registro de Fruto. Nada se perdió y lo que ya estaba listo se guardó. Puedes intentarlo de nuevo.",
};

export const FRUIT_LOG_COPY_EN: Readonly<Record<string, string>> = {
  "journey.fruitLog.prepareAction": "Prepare my Fruit Log in Spanish",
  "journey.fruitLog.preparing": "Preparing your Fruit Log in Spanish…",
  "journey.fruitLog.progress": "Day {n} of {total}",
  "journey.fruitLog.failBody": "We could not prepare your whole Fruit Log. Nothing was lost and what was ready has been kept. You can try again.",
};

/** Short aliases so the view never carries a catalog key literal. */
export const FRUIT_LOG_COPY_KEYS = {
  prepare: "journey.fruitLog.prepareAction",
  preparing: "journey.fruitLog.preparing",
  progress: "journey.fruitLog.progress",
  failBody: "journey.fruitLog.failBody",
} as const;
