/* The canonical account-day function.
 *
 * The repo already had two disagreeing date helpers: `todayStr()` in
 * journey.astro:520 builds a non-padded LOCAL date ("2026-8-1"), while
 * index.astro:354 uses a UTC ISO slice ("2026-08-01"). Neither is usable for
 * entitlement — one is browser-local and unpadded, both are computed on a
 * device the user controls. This module replaces both for anything that counts.
 *
 * Rules:
 *   - the day is computed SERVER-SIDE, never from a browser-supplied date key
 *   - it uses the account's stored IANA timezone, falling back to UTC
 *   - it is DST-correct, because Intl resolves the wall-clock date in the zone
 *     rather than applying a fixed offset
 *   - it is MONOTONIC per account: the key may never move backwards
 *
 * The monotonic rule is the security-relevant one. Without it, someone at 11pm
 * in New York could switch to a timezone where it is already tomorrow and be
 * handed a fresh daily allowance; switching back the next morning would hand
 * them another. Clamping to the highest day the account has ever reached makes
 * the allowance impossible to rewind, whatever the timezone says.
 */

/* Format a timestamp as YYYY-MM-DD in an IANA zone. `en-CA` yields exactly that
 * shape, which avoids hand-assembling parts and getting padding wrong the way
 * the existing local helper does. */
export function dayKeyInZone(ms: number, timezone?: string | null): string {
  const tz = timezone || "UTC";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  } catch {
    // An invalid or unknown zone must never throw an entitlement check. Fall
    // back to UTC, which is the same default as having no timezone at all.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  }
}

/* Apply the monotonic clamp. Day keys are YYYY-MM-DD, so lexicographic
 * comparison is chronological — no parsing required. */
export function clampForward(computed: string, lastSeen?: string | null): string {
  if (!lastSeen) return computed;
  return computed > lastSeen ? computed : lastSeen;
}

/* Validate a client-proposed IANA timezone before storing it. We store only
 * what Intl itself accepts, so a junk value can never reach the day computation
 * and silently degrade it. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
