/* Declare & Believe — Journey locale types.
 *
 * Pure types. No I/O, no DOM, no network. This module is the vocabulary the
 * rest of the locale work is written in, so the invariants live here where
 * they cannot drift.
 *
 * THE INVARIANTS, IN ONE PLACE
 *
 * 1. A completed day is a record of something a person actually walked. It is
 *    NEVER regenerated. A Spanish view is a TRANSLATION of that record.
 * 2. The English original is immutable. Once written it is never written again,
 *    which is what makes "switch back to English" exact rather than approximate.
 * 3. The Bible quotation is never produced or translated by a model. Verse text
 *    comes from the verified Bible source or it is not rendered at all.
 * 4. User-authored text (reflections, prayer entries) is never translated and
 *    never leaves the device for translation.
 * 5. Progress is language-neutral. Only displayed content varies by locale.
 */

export type LocaleCode = "en" | "es";

/** Bumped when the translation contract changes, invalidating every prior copy. */
export const LOCALE_SCHEMA_VERSION = 2 as const;
export type LocaleSchemaVersion = typeof LOCALE_SCHEMA_VERSION;

/* ── Translatable content ──────────────────────────────────────────────────
 * EXACTLY the Journey-authored fields that may be translated. This type is the
 * privacy boundary, not just a convenience: a field that is not listed here
 * cannot be put into a translation request without a type error. Reflections
 * and user-written prayers are deliberately absent and must stay absent. */
export interface TranslatableFields {
  title?: string;
  /** The day's commentary. */
  insight?: string;
  prayerTitle?: string;
  /** The AUTHORED prayer of the ritual, never a prayer the user wrote. */
  pray?: string;
  /** The authored lie to cast off. */
  castOff?: string;
  /** The authored repentance prayer. */
  repent?: string;
  declare?: string;
  /** The authored reflection PROMPT. The user's ANSWER lives in the Vault as a
   *  separate record and is never part of this object. */
  reflect?: string;
  actionTitle?: string;
  action?: string;
  fruit?: string;
  fruitTruth?: string;
}

/** Field names that may ever be sent for translation, as runtime data. */
export const TRANSLATABLE_FIELD_NAMES = [
  "title",
  "insight",
  "prayerTitle",
  "pray",
  "castOff",
  "repent",
  "declare",
  "reflect",
  "actionTitle",
  "action",
  "fruit",
  "fruitTruth",
] as const;

/** Keys that must NEVER appear in a translation request. Enforced at runtime by
 *  assertNoUserAuthoredContent() — a type is not enough, because payloads can be
 *  assembled from untyped objects at a call site. */
export const FORBIDDEN_REQUEST_KEYS = [
  "reflection",
  "reflectionText",
  "userPrayer",
  "userText",
  "vault",
  "vaultItems",
  "crisis",
  "supportDisclosure",
  "userId",
  "accountId",
  "email",
  "verse",
  "verseText",
  "scripture",
] as const;

/* ── Provenance ────────────────────────────────────────────────────────────
 * Prose and Scripture provenance are independent on purpose. A day may carry
 * verified Scripture beside translated prose, and the UI must be able to label
 * each honestly. */

export interface TranslationProvenance {
  translatedAt: number;
  model: string;
  transportVersion: string;
}

export interface ScriptureProvenance {
  /** Fixed string identifying the retrieval path, not a translation name. */
  verseSource: "bible-api";
  /** The translation id as REPORTED BY THE SOURCE. Never hardcoded locally. */
  translationId: string;
  fetchedAt: number;
}

/* ── The transport result ─────────────────────────────────────────────────── */

export interface JourneyLocaleTranslation {
  sourceLocale: "en";
  displayLocale: "es";
  sourceHash: string;
  schemaVersion: LocaleSchemaVersion;
  fields: TranslatableFields;
  provenance: TranslationProvenance;
}

/* ── Stored records ────────────────────────────────────────────────────────
 * `localeStatus` distinguishes how the locale came to be known:
 *   authored        — generated in this locale
 *   translated      — derived from another locale's record
 *   legacy-adopted  — INFERRED during migration, not observed at generation
 * The third value exists so a later pass can tell inference from fact. */
export type LocaleStatus = "authored" | "translated" | "legacy-adopted";

export interface JourneyLocaleRecord {
  instance: string;
  day: number;
  sourceLocale: LocaleCode;
  displayLocale: LocaleCode;
  sourceHash: string;
  schemaVersion: LocaleSchemaVersion;
  localeStatus: LocaleStatus;
  fields: TranslatableFields;
  translation?: TranslationProvenance;
  scripture?: ScriptureProvenance;
  /** True when this record IS the original walked content. Never overwrite. */
  immutable: boolean;
}

/* ── Scripture ─────────────────────────────────────────────────────────────
 * Results are returned, never thrown, because "we could not verify this verse"
 * is a normal product state with its own Spanish screen, not an exception. */

export interface ScriptureRef {
  /** Canonical English book name, e.g. "Psalms". */
  book: string;
  /** USFM code for the API, e.g. "PSA". */
  usfm: string;
  chapter: number;
  verse: number;
  /** Inclusive end of a range. Absent for a single verse. */
  verseEnd?: number;
}

export interface VerifiedVerse {
  ok: true;
  ref: ScriptureRef;
  /** Reference string as reported by the source, e.g. "Salmos 56". */
  sourceReference: string;
  text: string;
  /** Safe to display ONLY because provenance is present. */
  versionLabel: string;
  provenance: ScriptureProvenance;
}

export type ScriptureFailureReason =
  | "unparseable-reference"
  | "unknown-book"
  | "network"
  | "bad-response-shape"
  | "translation-mismatch"
  | "verse-out-of-range"
  | "empty-verse-text";

export interface ScriptureUnavailable {
  ok: false;
  reason: ScriptureFailureReason;
  detail?: string;
}

export type ScriptureResult = VerifiedVerse | ScriptureUnavailable;
