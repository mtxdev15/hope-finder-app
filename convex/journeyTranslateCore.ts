/* Journey translation — PURE core.
 *
 * Constants, validation and hashing with NO Convex imports, so the security
 * boundary can be exercised deterministically in plain node:
 *
 *   node scripts/verify-journey-translate.ts
 *
 * convex/journeyTranslate.ts imports everything from here. The Worker
 * deliberately re-implements the same validation independently — two boundaries,
 * because one shared check is one point of failure.
 */

/* ── Invisible operational limits (service layer, NOT entitlements) ────────── */
export const JOURNEY_TRANSLATE_FEATURE = "journeyTranslate";
/** One at a time per account: a Journey is read one day at a time. */
export const MAX_CONCURRENT_PER_ACCOUNT = 1;
/** Successful NEW translations. A five-day Journey never approaches this. */
export const MAX_PER_ROLLING_HOUR = 10;
export const MAX_PER_ACCOUNT_DAY = 30;
export const ROLLING_WINDOW_MS = 60 * 60 * 1000;
/** Shorter than the Gentle Guidance TTL: a translation is one model call, so a
 *  hold older than this is a crashed process, not a slow one. */
export const TRANSLATE_RESERVATION_TTL_MS = 2 * 60 * 1000;

export const TRANSPORT_VERSION = "journey-translate/1";
export const LOCALE_SCHEMA_VERSION = 1;

/* ── Server-side allowlist ─────────────────────────────────────────────────
 * The ONLY fields that may be translated. Anything else is rejected outright
 * rather than dropped, so a caller learns its payload was wrong instead of
 * silently losing content. Reflections, user-written prayers, Vault content,
 * crisis disclosures, account identifiers and Bible text are absent by
 * construction and rejected explicitly below. */
export const ALLOWED_FIELDS = [
  "title",
  "encouragement",
  "commentary",
  "prayer",
  "declaration",
  "reflectionPrompt",
] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];
const ALLOWED = new Set<string>(ALLOWED_FIELDS);

/** Keys that must never appear anywhere in the payload, at any depth. */
const FORBIDDEN_KEYS = new Set([
  "reflection", "reflectiontext", "userprayer", "usertext", "usernote",
  "vault", "vaultitems", "crisis", "supportdisclosure",
  "userid", "accountid", "email", "sub", "identity",
  "verse", "versetext", "scripture", "biblia", "prompt", "systemprompt",
  "instructions", "messages",
]);

const MAX_FIELD_CHARS = 4000;
const MAX_TOTAL_CHARS = 12000;

export type ValidationFailure = { ok: false; reason: string; detail?: string };
export type ValidatedFields = { ok: true; fields: Record<AllowedField, string> };

/** Rejects unknown fields, nested objects, forbidden keys and oversized input.
 *  Deliberately duplicated in the Worker: two independent boundaries, because a
 *  single shared check is a single point of failure. */
export function validateFields(raw: unknown): ValidatedFields | ValidationFailure {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "fields-not-object" };
  }
  const out = {} as Record<AllowedField, string>;
  let total = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(lower)) {
      return { ok: false, reason: "forbidden-field", detail: key };
    }
    if (!ALLOWED.has(key)) {
      return { ok: false, reason: "unknown-field", detail: key };
    }
    // Only flat strings. A nested object is how user content would smuggle in.
    if (typeof value !== "string") {
      return { ok: false, reason: "field-not-string", detail: key };
    }
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_FIELD_CHARS) {
      return { ok: false, reason: "field-too-long", detail: key };
    }
    total += trimmed.length;
    out[key as AllowedField] = trimmed;
  }
  if (total === 0) return { ok: false, reason: "empty-request" };
  if (total > MAX_TOTAL_CHARS) return { ok: false, reason: "payload-too-long" };
  return { ok: true, fields: out };
}

/* ── Server-computed source hash ───────────────────────────────────────────
 * MUST MATCH src/app/declare/journey-locale/locale-cache.ts exactly. Duplicated
 * rather than imported because Convex bundles only the convex/ directory; the
 * parity is asserted by scripts/verify-journey-translate.ts, which imports both
 * and compares. If you change one, change the other and re-run that script.
 *
 * The client's hash is NEVER trusted. This value is recomputed here and is the
 * authoritative half of the dedup identity. */
export function serverSourceHash(fields: Record<string, string>): string {
  const parts: string[] = [];
  for (const name of [...ALLOWED_FIELDS].sort()) {
    const value = fields[name];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    parts.push(JSON.stringify(name) + ":" + JSON.stringify(trimmed));
  }
  const input = parts.join(",");
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + "-" + input.length.toString(36);
}

/* The authoritative single-flight identity. Bound to the AUTHENTICATED account,
 * so two accounts translating identical content never share a slot or a result,
 * and a browser cannot join someone else's request by guessing a key. */
export function serverTranslationKey(input: {
  userId: string;
  sourceLocale: string;
  displayLocale: string;
  sourceHash: string;
  schemaVersion: number;
}): string {
  return [
    input.userId,
    input.sourceLocale,
    input.displayLocale,
    input.sourceHash,
    "v" + input.schemaVersion,
  ].join("|");
}
