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
  /** Which language the CONTENT is in, so the view can mark it honestly.
   *  "mixed-legacy" means the day's own fields disagree: it gets NO lang
   *  attribute, because there is no single true answer to give one. */
  locale: "en" | "es" | "mixed-legacy";
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
  if (!translated) {
    /* No translation: the row shows the CANONICAL day, whose language is
     * whatever that day was written in. Reporting 'en' unconditionally would
     * blanket-label a Spanish canonical day as English — the mixed-record bug
     * wearing a different hat. */
    return { fruit: en.fruit, fruitTruth: en.fruitTruth, locale: sourceLocale(en) };
  }
  return {
    fruit: translated.fruit != null ? translated.fruit : en.fruit,
    fruitTruth: translated.fruitTruth != null ? translated.fruitTruth : en.fruitTruth,
    locale: "es",
  };
}

/* The canonical language of a day. Unstamped days predate the locale boundary
 * and were English, which is what every writer before the stamp produced. */
export function sourceLocale(day: { lang?: string } | null | undefined): "en" | "es" | "mixed-legacy" {
  if (!day) return "en";
  if (day.lang === "es") return "es";
  /* A day whose own fields disagree has no single source language. Collapsing it
     to "en" is what put an English marker on Spanish text — the mixed-record bug
     one layer up, which is exactly what this surface must not reproduce. */
  if (day.lang === "mixed-legacy") return "mixed-legacy";
  return "en";
}

/* What the section banner may honestly claim about a set of completed days.
 *
 * "original-english" only when EVERY canonical source really is English. A set
 * containing any Spanish day is `mixed`, and mixed must not be given one
 * blanket label in either direction — the view shows per-row languages and no
 * original-English provenance, and offers no preparation, because translating a
 * Spanish day English-to-Spanish is exactly what the transport now refuses. */
export function sourceState(days: Array<{ lang?: string }>): "original-english" | "all-spanish" | "mixed" | "none" {
  if (!days || !days.length) return "none";
  const locales = days.map(sourceLocale);
  if (locales.every((l) => l === "en")) return "original-english";
  if (locales.every((l) => l === "es")) return "all-spanish";
  return "mixed";
}

/** May this row be sent for English-to-Spanish translation? Only a day whose
 *  source is unambiguously English. */
export function isRowTranslatable(day: { lang?: string } | null | undefined): boolean {
  return sourceLocale(day) === "en";
}

/* Interface copy for this surface lives in the shipped catalog
 * (public/declare/i18n-strings.js, the `journey.fruitLog.*` keys), reviewed and
 * approved by a native es-LA speaker on 2026-08-20 along with the product term
 * "Registro del Fruto". English stays at the call sites as the tj() fallback,
 * per the house convention. It is deliberately NOT re-exported from here: a
 * second copy of a reviewed string is a second thing to keep in sync, and the
 * runtime registration that once carried it has been removed. */
