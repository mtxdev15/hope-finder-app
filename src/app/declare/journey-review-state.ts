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

/* ── Completed-day locale classification ────────────────────────────────────
 * Pure, so the fixtures that matter can be exercised in plain Node.
 *
 * THE RULE THIS SERVES: a completed day is a record of something a person
 * actually walked. A language mismatch is never sufficient reason to rewrite
 * it. These functions classify; they never transform. */

/** Fields sampled to decide whether one day is internally consistent. */
export const LOCALE_SAMPLE_FIELDS = ["title", "fruit", "fruitTruth", "insight", "declare"] as const;

/** Cheap language sniff, used ONLY to detect disagreement inside one day and
 *  never to relabel a day that already carries a stamp. */
export function looksSpanish(v: unknown): boolean {
  return typeof v === "string" &&
    (/[áéíóúñ¿¡]/.test(v) ||
     /\b(el|la|los|las|una|del|que|para|con|pero|porque|cuando|donde|tu|tus|te|su|sus|eres|estás|soy|esto|esta)\b/i.test(v));
}

/** Positive English evidence. Required rather than inferred: treating
 *  "not Spanish" as English flagged coherent Spanish days as mixed, because a
 *  short Spanish sentence can carry neither an accent nor a stopword. A field
 *  that looks like neither is AMBIGUOUS and votes for nothing. */
export function looksEnglish(v: unknown): boolean {
  return typeof v === "string" &&
    /\b(the|and|is|are|was|were|you|your|that|this|with|for|not|but|his|her|him|they|what|when|where|have|has|been|from|into|will)\b/i.test(v);
}

/* A day whose own fields are in different languages. Pre-boundary records can
 * hold a Spanish fruit beside an English truth; there is no single true source
 * language for such a day, so it is never given one and never translated.
 *
 * BOTH languages must be positively seen. Ambiguous fields are ignored, which
 * means this under-reports rather than over-reports — and it should, because a
 * false "mixed" needlessly blocks a day from ever being translated. */
export function isInternallyMixed(day: Record<string, unknown> | null | undefined): boolean {
  if (!day) return false;
  let es = false, en = false;
  for (const k of LOCALE_SAMPLE_FIELDS) {
    const v = day[k];
    if (typeof v !== "string" || v.trim().length <= 12) continue;
    if (looksSpanish(v)) es = true;
    else if (looksEnglish(v)) en = true;
  }
  return es && en;
}

export type DayLocale = "en" | "es" | "mixed-legacy";

/* What a completed day's source language is, for display and for deciding
 * whether translation may be offered. An explicit stamp always wins: it was
 * written by the code that created the content and outranks any sniff. */
export function classifyDayLocale(day: Record<string, unknown> | null | undefined): DayLocale {
  if (!day) return "en";
  const stamped = day.lang;
  if (stamped === "en" || stamped === "es" || stamped === "mixed-legacy") return stamped;
  if (isInternallyMixed(day)) return "mixed-legacy";
  return "en";               // pre-boundary writers produced English
}

/** May this day be sent through the English-to-Spanish transport? */
export function isTranslatable(day: Record<string, unknown> | null | undefined): boolean {
  return classifyDayLocale(day) === "en";
}
