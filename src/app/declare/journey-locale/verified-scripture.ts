/* Declare & Believe — verified Scripture retrieval.
 *
 * ONE rule governs this module: a Bible quotation is either retrieved from the
 * verified source and labelled with the version THAT SOURCE REPORTED, or it is
 * not rendered at all. There is no third path. No model ever produces or
 * translates quoted Scripture.
 *
 * This exists because the Journey engine currently hands the model English ESV
 * text, asks it to recall RVR1909 from memory, and then stamps
 * `obj.ver = 'RVR1909'` unconditionally without validating anything. That can
 * present English text to a Spanish reader under a Spanish translation name.
 * For a product built on speaking God's Word accurately, that is the most
 * serious defect in the Journey surface.
 *
 * SOURCE, VERIFIED 2026-08-14 against the already-deployed Worker (read-only,
 * no deploy). GET /bible?translation=rvr1909&book=<USFM>&chapter=<n> returns:
 *
 *   { reference: "Salmos 56", translation: "RVR1909",
 *     book: "PSA", chapter: 56, verses: [{ n: 1, t: "..." }, ...] }
 *
 * Confirmed across Psalms, John and Isaiah. No copyright/FUMS field is present
 * (RVR1909 is public domain). A bad chapter returns 400 {"error":"..."}.
 *
 * The fetch itself is injected, so every branch here is testable without a
 * network and without a browser.
 */

import { USFM } from "../../../data/usfm.js";
import type {
  ScriptureProvenance,
  ScriptureRef,
  ScriptureResult,
  ScriptureUnavailable,
} from "./types.ts";

/** Translation ids the Worker accepts. Spanish Journey uses rvr1909 only. */
export type BibleTranslationId = "rvr1909" | "web" | "kjv" | "asv" | "nkjv" | "niv" | "nlt";

/* ── Reference parsing ─────────────────────────────────────────────────────
 * BOOK_ALIASES is currently duplicated in at least four places
 * (today.astro, journey.astro, vault.astro, word.astro) with inconsistent
 * casing conventions — word.astro lowercases its keys, the others Title Case
 * them. Normalising case-insensitively here makes this the single source and
 * removes a real drift risk. */
const BOOK_ALIASES: Record<string, string> = {
  psalm: "Psalms",
  psalms: "Psalms",
  "song of songs": "Song of Solomon",
  "songs of solomon": "Song of Solomon",
  "song of solomon": "Song of Solomon",
  revelations: "Revelation",
  revelation: "Revelation",
};

const USFM_BY_LOWER_NAME: Record<string, { name: string; usfm: string }> = (() => {
  const out: Record<string, { name: string; usfm: string }> = {};
  for (const [name, usfm] of Object.entries(USFM as Record<string, string>)) {
    out[name.toLowerCase()] = { name, usfm };
  }
  return out;
})();

/** Accepts "Psalm 56:3", "Salmos 56:3" is NOT accepted (references are stored
 *  in English), "1 Corinthians 13:4-7", and tolerates loose spacing. */
export function parseReference(raw: string): ScriptureRef | ScriptureUnavailable {
  const text = (raw || "").trim();
  const m = text.match(/^(.+?)\s+(\d+)\s*:\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/);
  if (!m) return { ok: false, reason: "unparseable-reference", detail: text };

  const rawBook = m[1].trim().replace(/\s+/g, " ");
  const canonical = BOOK_ALIASES[rawBook.toLowerCase()] || rawBook;
  const found = USFM_BY_LOWER_NAME[canonical.toLowerCase()];
  if (!found) return { ok: false, reason: "unknown-book", detail: rawBook };

  const chapter = Number(m[2]);
  const verse = Number(m[3]);
  const verseEnd = m[4] ? Number(m[4]) : undefined;
  if (chapter < 1 || verse < 1) {
    return { ok: false, reason: "unparseable-reference", detail: text };
  }
  if (verseEnd !== undefined && verseEnd < verse) {
    return { ok: false, reason: "verse-out-of-range", detail: `${verse}-${verseEnd}` };
  }
  return { book: found.name, usfm: found.usfm, chapter, verse, verseEnd };
}

export function isScriptureFailure(v: unknown): v is ScriptureUnavailable {
  return !!v && typeof v === "object" && (v as { ok?: unknown }).ok === false;
}

/* ── Response validation ───────────────────────────────────────────────────
 * Validated structurally rather than trusted. The translation check is the
 * important one: if the source did not report the translation we asked for, we
 * do not have what we think we have, and we withhold rather than mislabel. */

export interface ChapterResponse {
  reference?: unknown;
  translation?: unknown;
  book?: unknown;
  chapter?: unknown;
  verses?: unknown;
}

export interface ValidatedChapter {
  ok: true;
  reference: string;
  /** As reported by the source. This is what may be displayed. */
  translation: string;
  verses: Array<{ n: number; t: string }>;
}

export function validateChapterResponse(
  json: unknown,
  expectedTranslationLabel: string,
): ValidatedChapter | ScriptureUnavailable {
  if (!json || typeof json !== "object") {
    return { ok: false, reason: "bad-response-shape", detail: "not an object" };
  }
  const body = json as ChapterResponse;
  if (typeof body.translation !== "string" || !body.translation) {
    return { ok: false, reason: "bad-response-shape", detail: "missing translation" };
  }
  if (!Array.isArray(body.verses)) {
    return { ok: false, reason: "bad-response-shape", detail: "missing verses" };
  }
  // Case-insensitive: the source reports "RVR1909" while the request uses
  // "rvr1909". Anything else is a mismatch and must not be relabelled.
  if (body.translation.toLowerCase() !== expectedTranslationLabel.toLowerCase()) {
    return {
      ok: false,
      reason: "translation-mismatch",
      detail: `asked ${expectedTranslationLabel}, source reported ${body.translation}`,
    };
  }
  const verses: Array<{ n: number; t: string }> = [];
  for (const entry of body.verses) {
    if (!entry || typeof entry !== "object") continue;
    const n = Number((entry as { n?: unknown }).n);
    const t = (entry as { t?: unknown }).t;
    if (!Number.isInteger(n) || typeof t !== "string") continue;
    verses.push({ n, t });
  }
  if (!verses.length) {
    return { ok: false, reason: "bad-response-shape", detail: "no usable verses" };
  }
  return {
    ok: true,
    reference: typeof body.reference === "string" ? body.reference : "",
    translation: body.translation,
    verses,
  };
}

/* ── Extraction ───────────────────────────────────────────────────────────── */

export function extractVerses(
  chapter: ValidatedChapter,
  ref: ScriptureRef,
  fetchedAt: number,
): ScriptureResult {
  const first = ref.verse;
  const last = ref.verseEnd ?? ref.verse;
  const picked: string[] = [];
  for (let n = first; n <= last; n++) {
    const hit = chapter.verses.find((v) => v.n === n);
    if (!hit) {
      return { ok: false, reason: "verse-out-of-range", detail: `verse ${n} not in chapter` };
    }
    picked.push(hit.t.trim());
  }
  const text = picked.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "empty-verse-text" };

  const provenance: ScriptureProvenance = {
    verseSource: "bible-api",
    // Straight from the response. Never a local constant — that is exactly the
    // mistake this module exists to prevent.
    translationId: chapter.translation,
    fetchedAt,
  };
  return {
    ok: true,
    ref,
    sourceReference: chapter.reference,
    text,
    versionLabel: chapter.translation,
    provenance,
  };
}

/* ── Orchestration ─────────────────────────────────────────────────────────
 * `fetchChapter` is injected so this is unit-testable offline. In production it
 * wraps the existing Worker chapter endpoint — no Worker change, no deploy. */

export type ChapterFetcher = (args: {
  translation: BibleTranslationId;
  usfm: string;
  chapter: number;
}) => Promise<unknown>;

export interface FetchVerseOptions {
  reference: string;
  translation: BibleTranslationId;
  /** Label the source is expected to report, e.g. "RVR1909". */
  expectedTranslationLabel: string;
  fetchChapter: ChapterFetcher;
  now?: () => number;
}

export async function fetchVerse(opts: FetchVerseOptions): Promise<ScriptureResult> {
  const parsed = parseReference(opts.reference);
  if (isScriptureFailure(parsed)) return parsed;

  let raw: unknown;
  try {
    raw = await opts.fetchChapter({
      translation: opts.translation,
      usfm: parsed.usfm,
      chapter: parsed.chapter,
    });
  } catch (e) {
    return { ok: false, reason: "network", detail: String((e as Error)?.message ?? e).slice(0, 160) };
  }

  const chapter = validateChapterResponse(raw, opts.expectedTranslationLabel);
  if (isScriptureFailure(chapter)) return chapter;

  return extractVerses(chapter, parsed, (opts.now ?? Date.now)());
}

/* ── Display guard ─────────────────────────────────────────────────────────
 * The single place the UI should ask "may I show a version label?". Without
 * provenance the answer is always no, and without a verse there is nothing to
 * label anyway. */
export function displayableVersionLabel(result: ScriptureResult): string | null {
  if (!result.ok) return null;
  if (!result.provenance || result.provenance.verseSource !== "bible-api") return null;
  if (!result.provenance.translationId) return null;
  return result.versionLabel;
}
