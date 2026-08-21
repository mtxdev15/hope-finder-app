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
  }
}

export {};
