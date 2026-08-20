/* Declare & Believe — what a completed-day review is actually showing.
 *
 * THIS MODULE SHIPS TO PRODUCTION. It used to live under journey-locale/, which
 * is excluded from production bundles because that is where the unreleased
 * translation feature lives. That was right while the only consumer was the
 * translated-Spanish review, and wrong the moment the original-English
 * provenance shipped as a production hotfix: a Spanish reader meeting the
 * immutable English original needs to be told so whether or not translation is
 * enabled. Keeping the rule in one shipped module is what stops the release
 * branch and production from answering the question differently.
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

import type { LocaleCode } from "./journey-locale/types.ts";

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
