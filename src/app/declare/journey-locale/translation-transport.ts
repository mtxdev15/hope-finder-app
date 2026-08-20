/* Declare & Believe — Journey translation transport contract and mock.
 *
 * This module defines the SHAPE of translation and provides a deterministic
 * offline mock. It deliberately contains no network code and no endpoint.
 *
 * The production transport is a separately approved deployment checkpoint:
 * an authenticated Convex action calling an internal-only Worker route, with a
 * server-to-server secret, single-flight, invisible quotas and privacy-safe
 * logging. Until that exists, surfaces must be wired to the mock or to nothing
 * — never to a fake or absent network endpoint.
 *
 * PRIVACY IS ENFORCED HERE, NOT ASSUMED
 *
 * A request may carry ONLY Journey-authored fields. The person's reflection,
 * their own written prayers, Vault content, crisis or support disclosures, and
 * any account identifier must never reach a translation prompt. The type system
 * expresses that, and assertNoUserAuthoredContent() enforces it at runtime,
 * because payloads get assembled from untyped objects at call sites and a type
 * alone would not survive that.
 */

import {
  FORBIDDEN_REQUEST_KEYS,
  LOCALE_SCHEMA_VERSION,
  TRANSLATABLE_FIELD_NAMES,
  type JourneyLocaleTranslation,
  type LocaleSchemaVersion,
  type TranslatableFields,
} from "./types.ts";
import { localeCacheKey } from "./locale-cache.ts";

export const TRANSPORT_VERSION = "journey-translate/1";

/* ── Request ───────────────────────────────────────────────────────────────
 * Note what is NOT here: no userId, no auth token, no verse text. Identity is
 * derived server-side from the trusted authentication integration; the browser
 * never submits it. Scripture never round-trips through translation. */
export interface JourneyTranslationRequest {
  instance: string;
  day: number;
  sourceLocale: "en";
  displayLocale: "es";
  sourceHash: string;
  schemaVersion: LocaleSchemaVersion;
  fields: TranslatableFields;
}

export type TranslationFailureReason =
  | "forbidden-content"
  | "empty-request"
  | "network"
  | "rate-limited"
  | "model-failure"
  | "bad-response-shape"
  | "cancelled";

export interface TranslationUnavailable {
  ok: false;
  reason: TranslationFailureReason;
  detail?: string;
  /** Only rate-limited and network failures are worth retrying automatically. */
  retryable: boolean;
}

export type TranslationResult =
  | { ok: true; translation: JourneyLocaleTranslation }
  | TranslationUnavailable;

export interface JourneyTranslationTransport {
  translate(request: JourneyTranslationRequest): Promise<TranslationResult>;
}

/* ── Privacy guard ─────────────────────────────────────────────────────────
 * Throws rather than returning a failure: a request carrying a reflection is a
 * programming error at the call site, not a runtime condition to be handled.
 * Failing loudly in development is the entire point. */
export function assertNoUserAuthoredContent(request: unknown): void {
  if (!request || typeof request !== "object") {
    throw new Error("translation request must be an object");
  }
  const top = request as Record<string, unknown>;

  for (const key of FORBIDDEN_REQUEST_KEYS) {
    if (key in top) {
      throw new Error(
        `translation request must not contain "${key}". User-authored text and ` +
          `Scripture are never sent for translation.`,
      );
    }
  }

  const fields = top.fields;
  if (!fields || typeof fields !== "object") {
    throw new Error("translation request must contain a fields object");
  }
  const allowed = new Set<string>(TRANSLATABLE_FIELD_NAMES);
  for (const name of Object.keys(fields as Record<string, unknown>)) {
    if (!allowed.has(name)) {
      throw new Error(
        `translation request field "${name}" is not translatable. Only ` +
          `Journey-authored copy may be sent.`,
      );
    }
  }
}

/** True when there is actually something to translate. Used to avoid spending a
 *  quota slot (and a model call) on an empty request. */
export function hasTranslatableContent(fields: TranslatableFields): boolean {
  return TRANSLATABLE_FIELD_NAMES.some((n) => typeof fields[n] === "string" && fields[n]!.trim());
}

/* ── Single-flight ─────────────────────────────────────────────────────────
 * The locale cache identity doubles as the dedup identity, so the client and
 * the server agree on what "the same translation" means without inventing a
 * second scheme. Repeated taps join the in-flight promise; only one call is
 * made and both callers get the same result. */
export function translationRequestKey(request: JourneyTranslationRequest): string {
  return localeCacheKey({
    instance: request.instance,
    day: request.day,
    sourceLocale: request.sourceLocale,
    displayLocale: request.displayLocale,
    sourceHash: request.sourceHash,
    schemaVersion: request.schemaVersion,
  });
}

export function withSingleFlight(
  transport: JourneyTranslationTransport,
): JourneyTranslationTransport & { inFlightCount(): number } {
  const inFlight = new Map<string, Promise<TranslationResult>>();
  return {
    inFlightCount: () => inFlight.size,
    translate(request) {
      const key = translationRequestKey(request);
      const existing = inFlight.get(key);
      if (existing) return existing;
      const p = transport
        .translate(request)
        .finally(() => { inFlight.delete(key); });
      inFlight.set(key, p);
      return p;
    },
  };
}

/* ── Mock transport ────────────────────────────────────────────────────────
 * Deterministic and offline, for prototypes and verification. It performs no
 * translation: it returns whatever the fixture supplies, so a test asserts
 * plumbing and guards rather than model behaviour.
 *
 * It runs the same privacy guard as production on purpose — a leak should fail
 * in the mock, long before anything is wired to a network. */
export interface MockTransportOptions {
  /** Keyed by translationRequestKey(). */
  fixtures?: Record<string, TranslatableFields>;
  /** Forced failure, for exercising the Spanish retry state. */
  failWith?: TranslationUnavailable;
  now?: () => number;
  model?: string;
  onCall?: (key: string) => void;
}

export function createMockTransport(opts: MockTransportOptions = {}): JourneyTranslationTransport & {
  calls(): string[];
} {
  const calls: string[] = [];
  const now = opts.now ?? (() => 0);
  const model = opts.model ?? "mock-translate";
  return {
    calls: () => calls.slice(),
    async translate(request) {
      assertNoUserAuthoredContent(request);
      const key = translationRequestKey(request);
      calls.push(key);
      opts.onCall?.(key);

      if (opts.failWith) return opts.failWith;
      if (!hasTranslatableContent(request.fields)) {
        return { ok: false, reason: "empty-request", retryable: false };
      }

      const fields = opts.fixtures?.[key];
      if (!fields) {
        return {
          ok: false,
          reason: "bad-response-shape",
          detail: `no mock fixture for ${key}`,
          retryable: false,
        };
      }
      return {
        ok: true,
        translation: {
          sourceLocale: "en",
          displayLocale: "es",
          sourceHash: request.sourceHash,
          schemaVersion: LOCALE_SCHEMA_VERSION,
          fields,
          provenance: { translatedAt: now(), model, transportVersion: TRANSPORT_VERSION },
        },
      };
    },
  };
}

/* ── Response validation ───────────────────────────────────────────────────
 * Applied to whatever the real transport returns, so a malformed server
 * response becomes a Spanish retry state rather than a half-rendered screen. */
export function validateTranslation(
  value: unknown,
  request: JourneyTranslationRequest,
): JourneyLocaleTranslation | TranslationUnavailable {
  if (!value || typeof value !== "object") {
    return { ok: false, reason: "bad-response-shape", detail: "not an object", retryable: false };
  }
  const t = value as Partial<JourneyLocaleTranslation>;
  if (t.sourceLocale !== "en" || t.displayLocale !== "es") {
    return { ok: false, reason: "bad-response-shape", detail: "locale pair mismatch", retryable: false };
  }
  if (t.sourceHash !== request.sourceHash) {
    return { ok: false, reason: "bad-response-shape", detail: "sourceHash mismatch", retryable: false };
  }
  if (t.schemaVersion !== LOCALE_SCHEMA_VERSION) {
    return { ok: false, reason: "bad-response-shape", detail: "schemaVersion mismatch", retryable: false };
  }
  if (!t.fields || typeof t.fields !== "object") {
    return { ok: false, reason: "bad-response-shape", detail: "missing fields", retryable: false };
  }
  const allowed = new Set<string>(TRANSLATABLE_FIELD_NAMES);
  for (const name of Object.keys(t.fields)) {
    if (!allowed.has(name)) {
      return { ok: false, reason: "bad-response-shape", detail: `unexpected field ${name}`, retryable: false };
    }
  }
  if (!t.provenance || typeof t.provenance.model !== "string") {
    return { ok: false, reason: "bad-response-shape", detail: "missing provenance", retryable: false };
  }
  return t as JourneyLocaleTranslation;
}
