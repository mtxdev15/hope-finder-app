/* Declare & Believe — what a completed-day review is actually showing.
 *
 * A completed day can be on screen in four different relationships between the
 * interface language and the content language, and the review has to be honest
 * about which one the reader is in:
 *
 *   interface  content   origin       what the reader must be told
 *   ---------  -------   ----------   -------------------------------------
 *   en         en        original     nothing beyond "this is a review"
 *   es         es        translation  this Spanish was translated from English
 *   es         en        original     THIS IS THE ORIGINAL ENGLISH
 *   en         es        —            cannot occur; Spanish is only ever a
 *                                     translation shown under Spanish chrome
 *
 * The third row is the one that was missing. A Spanish reader who chooses to
 * read the original saw Spanish chrome, a generic "reviewing a completed day"
 * banner, and then English prose with nothing explaining the change. The
 * content was correct and immutable; the labelling was not.
 *
 * WHY THIS IS NOT AN AUTHENTICATION CHECK
 * It is tempting to say "signed-out means English original", because that is
 * how the gap was found. It is wrong. A SIGNED-IN reader who taps "Ver el
 * original en inglés" is in exactly the same relationship and needs exactly the
 * same label. The state is derived from the content relationship alone, so both
 * paths get it and neither can drift from the other.
 *
 * Pure. No DOM, no network, no storage. The view renders what this returns.
 */

import type { LocaleCode } from "./types.ts";

/** What the provenance area must say, if anything. */
export type ProvenanceKind =
  /** Spanish copy derived from the English record. */
  | "translated-spanish"
  /** The immutable English record, displayed under Spanish chrome. */
  | "original-english"
  /** Interface and content agree; the generic review banner is enough. */
  | "none";

export interface ReviewViewState {
  interfaceLocale: LocaleCode;
  contentLocale: LocaleCode;
  contentOrigin: "original" | "translation";
  readOnly: boolean;
  provenanceKind: ProvenanceKind;
}

export interface ReviewViewInput {
  /** The locale of the surrounding app chrome. */
  interfaceLocale: LocaleCode;
  /** True only when verified Spanish copy is what is actually on screen. */
  translationShown: boolean;
  /** False for the live day; provenance only applies to a completed review. */
  reviewing: boolean;
}

/* The single decision. Everything downstream reads the result rather than
 * re-deriving it, which is what stops the guest path and the signed-in
 * "view original" path from disagreeing again. */
export function resolveReviewViewState(input: ReviewViewInput): ReviewViewState {
  const interfaceLocale: LocaleCode = input.interfaceLocale === "es" ? "es" : "en";

  // Spanish on screen is always a translation of the English record — the
  // Journey never authors a completed day in Spanish and then calls it original.
  if (input.reviewing && input.translationShown) {
    return {
      interfaceLocale,
      contentLocale: "es",
      contentOrigin: "translation",
      readOnly: true,
      provenanceKind: "translated-spanish",
    };
  }

  const state: ReviewViewState = {
    interfaceLocale,
    contentLocale: "en",
    contentOrigin: "original",
    readOnly: !!input.reviewing,
    provenanceKind: "none",
  };

  // The rule: Spanish chrome over the immutable English original must say so.
  // Deliberately independent of how the reader got here.
  if (input.reviewing && interfaceLocale === "es") state.provenanceKind = "original-english";
  return state;
}

/* ── Which elements hold the English authored record ────────────────────────
 * Used to mark the immutable English content with lang="en" so a screen reader
 * switches voice for it while the Spanish interface around it stays Spanish.
 *
 * These are CONTENT selectors, never chrome. Step labels ("1 Recibe"), the
 * struggle line ("Temor -> Valentía"), prompts and buttons are interface and
 * stay in the interface language, so they are absent here on purpose.
 *
 * The reflection textarea and the saved-reflection review box are absent for a
 * stronger reason: that text belongs to the reader, its language is not known,
 * and claiming it is English would be a guess about a person's own words. */
export const ENGLISH_CONTENT_SELECTORS: readonly string[] = [
  ".df-h",         // day title
  ".vref-link",    // Scripture reference + version label
  ".verse",        // the quotation itself
  ".insight",      // commentary
  ".ptitle",       // authored prayer title
  ".pr",           // authored prayer
  ".lie-t",        // authored lie to cast off
  ".repent-t",     // authored repentance prayer
  ".dc",           // authored declaration
  "#reflectPrompt", // the authored PROMPT, not the reader's answer
  ".act-t",        // authored action title
  ".act-d",        // authored action
];

/* ── Interface copy ─────────────────────────────────────────────────────────
 * Keyed exactly as the shipping catalog keys them, and read through the normal
 * I18N lookup by the view, so promoting this feature to release is a matter of
 * moving these four entries into public/declare/i18n-strings.js and deleting
 * the registration call — no call site changes.
 *
 * They live here rather than in the shipping catalog for one reason: the
 * completed-day review is still behind a development-only build guard, and the
 * production bundle audit requires that none of its user-facing strings appear
 * in a production build. A dictionary entry is inert, but it is still the copy
 * of an unreleased feature sitting in a file the public can read.
 *
 * The view asks for a short alias ("banner") rather than a key, for the same
 * reason: renderStepChrome() ships to production even while the feature does
 * not, so a literal key name written there would put the name of an unreleased
 * feature into a production bundle. This module does the alias-to-key step. */
export const REVIEW_COPY_KEYS = {
  banner: "journey.review.originalEnglishBanner",
  support: "journey.review.originalEnglishSupport",
  signIn: "journey.review.signInForSpanish",
  returnToday: "journey.review.returnToToday",
} as const;

export type ReviewCopyAlias = keyof typeof REVIEW_COPY_KEYS;

export const REVIEW_COPY_ES: Readonly<Record<string, string>> = {
  "journey.review.originalEnglishBanner": "Contenido original en inglés · Solo lectura",
  "journey.review.originalEnglishSupport": "Este día se completó originalmente en inglés.",
  "journey.review.signInForSpanish": "Iniciar sesión para verlo en español",
  "journey.review.returnToToday": "Volver al camino de hoy",
};

/** English source strings, kept beside the keys so the fallback a caller passes
 *  to the I18N lookup cannot drift from the key it belongs to. */
export const REVIEW_COPY_EN: Readonly<Record<string, string>> = {
  "journey.review.originalEnglishBanner": "Original English content · Read only",
  "journey.review.originalEnglishSupport": "This day was originally completed in English.",
  "journey.review.signInForSpanish": "Sign in to read it in Spanish",
  "journey.review.returnToToday": "Back to today's path",
};
