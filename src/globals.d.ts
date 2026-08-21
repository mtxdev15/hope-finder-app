/* Declare & Believe — ambient globals set by scripts in public/.
 *
 * These are NOT modules. `public/declare/i18n.js` is a plain <script> that
 * assigns `window.I18N` at runtime, so nothing in src/ imports it and
 * TypeScript has no way to infer it. Declaring the shape here is what lets
 * `astro check` verify the call sites instead of erroring on every one.
 *
 * The shapes below are transcribed from the real assignment in
 * public/declare/i18n.js. If that object changes, change this to match —
 * a lie here is worse than no declaration at all, because it would type-check
 * calls that fail at runtime.
 */
declare global {
  interface Window {
    /** Assigned by public/declare/i18n.js. Absent until that script runs, so
     *  every call site must still guard — hence `| undefined`. */
    I18N?: {
      /** Current language, 'en' or 'es'. */
      lang: () => string;
      /** Translate `key`, falling back to `fallback` then to the key itself. */
      t: (key: string, fallback?: string) => string;
      setLang: (lang: string) => void;
      toggle: () => void;
      apply: (lang?: string) => void;
    };
    /** One-shot mount guard for the TabBar identity card. */
    __sbIdentityInit?: boolean;

    /* ── Globals assigned by scripts in public/declare/ ──────────────────
       Same rule as I18N: these are plain <script> tags, not modules, so every
       one is optional and every call site must still guard. Signatures are
       transcribed from the real call sites, not invented. */

    /** Scroll-reveal / stagger animations. */
    DeclareMotion?: {
      reveal: (el: Element | null, opts?: { stagger?: number }) => void;
    };
    /** The share sheet. `save` is the caller's own persist function. */
    DeclareShare?: {
      open: (opts: {
        type: string;
        /** Optional: public/declare/share.js reads it as `if (p.text) return
         *  p.text;` and composes a default message when it is absent. */
        text?: string;
        ref?: string;
        subtitle?: string;
        url?: string;
        bg?: unknown;
        save?: (...args: any[]) => any;
      }) => void;
    };
    /** Full-page route transition overlay. */
    RouteLoader?: { show: () => void; hide: () => void };
    /** Theme switcher — 'light' | 'dark' | 'auto', passed through from a
     *  data attribute, so the parameter is a plain string. */
    DeclareTheme?: { set: (mode: string | undefined) => void };
    /** FUMS analytics beacon (Faithlife/Bible API usage tracking). */
    fums?: (event: string, token: string) => void;

    /* Spanish lookup tables. Loaded per page; absent when the page has no
       Spanish. Shapes read from the files that assign them — they are NOT all
       flat string maps, which an earlier version of this file assumed. */

    /** public/declare/i18n-strings.js:5 — keyed by LANGUAGE first. `es` is
     *  optional because i18n.js:34 guards it (`d.es && d.es[key]`). */
    __I18N_STRINGS?: { es?: Record<string, string> };
    /** public/declare/i18n-bible-es.js:4 — three separate maps, not one. */
    __I18N_BIBLE_ES?: {
      groups: Record<string, string>;
      books: Record<string, string>;
      tags: Record<string, string>;
    };
    /** public/declare/i18n-strings.js:568 / :525 — genuinely flat string maps,
     *  keyed by the English source text. */
    __I18N_CHIP_ES?: Record<string, string>;
    __I18N_STRUGGLES_ES?: Record<string, string>;
    /* NOTE: __I18N_JOURNEY_ES is ALSO mis-declared here — public/declare/
       i18n-journey-es.js:6 assigns { from, to, line } objects, not strings.
       Left alone deliberately: its only reader is journey.astro, which is
       excluded from the scoped check, so correcting it here could not be
       verified by that check. Fix it with journey.astro. */
    __I18N_JOURNEY_ES?: Record<string, string>;
  }

  /* The app stamps the original English onto elements before translating them
     in place, so the toggle can restore without a re-render. An expando, but a
     real one — declaring it is more honest than casting at each of the 16 use
     sites. */
  interface Element {
    /** Set as `el.__en = el.textContent` (i18n.js:39 and word.astro's
     *  localizeLibrary), so it carries textContent's own nullability. */
    __en?: string | null;
  }
}

export {};
