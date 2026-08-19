/* Declare & Believe — Spanish copy for the completed-day review.
 *
 * The two ORIGINAL-ENGLISH provenance strings are NOT here: they shipped as a
 * production hotfix and now live in public/declare/i18n-strings.js like any
 * other released string. What remains is the copy that only makes sense once
 * translated review is enabled — offering to sign in for Spanish, and the
 * fuller return label that goes with that flow. Advertising either in
 * production would promise a feature that is switched off.
 *
 * The state vocabulary moved to ../journey-review-state.ts, which ships.
 */

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
  signIn: "journey.review.signInForSpanish",
  returnToday: "journey.review.returnToToday",
} as const;

export type ReviewCopyAlias = keyof typeof REVIEW_COPY_KEYS;

export const REVIEW_COPY_ES: Readonly<Record<string, string>> = {
  "journey.review.signInForSpanish": "Iniciar sesión para verlo en español",
  "journey.review.returnToToday": "Volver al camino de hoy",
};

/** English source strings, kept beside the keys so the fallback a caller passes
 *  to the I18N lookup cannot drift from the key it belongs to. */
export const REVIEW_COPY_EN: Readonly<Record<string, string>> = {
  "journey.review.signInForSpanish": "Sign in to read it in Spanish",
  "journey.review.returnToToday": "Back to today's path",
};
