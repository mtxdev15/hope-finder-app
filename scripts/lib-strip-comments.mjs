/* A character-level scanner that blanks comments while preserving byte offsets
 * and line numbers, so a grep over the result is line-accurate.
 *
 * Written because a regex-based stripper got this wrong in BOTH directions on
 * worker/src/index.js: it reported the retirement comment block as executable
 * and real `env.BILLING_WEBHOOK_SECRET` reads as prose. An audit whose central
 * claim is "zero executable readers" cannot rest on a stripper that mislabels
 * lines, so this tracks strings, templates and regex literals properly.
 */
export function blankComments(src) {
  const out = Array.from(src);
  const n = src.length;
  let i = 0;
  let prevSignificant = "";
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " "; };

  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      blank(i, stop); i = stop; continue;
    }
    if (c === "/" && d === "/") {
      let end = src.indexOf("\n", i); if (end === -1) end = n;
      blank(i, end); i = end; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c; i++;
      while (i < n) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        i++;
      }
      prevSignificant = quote; continue;
    }
    /* A `/` starts a regex literal only where a value cannot already have
       ended — otherwise it is division. Approximated by the previous
       significant character, which is enough for this codebase. */
    if (c === "/" && !")]}".includes(prevSignificant) && !/[A-Za-z0-9_$]/.test(prevSignificant)) {
      let j = i + 1, inClass = false;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        else if (src[j] === "/" && !inClass) { j++; break; }
        else if (src[j] === "\n") break;
        j++;
      }
      i = j; prevSignificant = "/"; continue;
    }
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }
  return out.join("");
}
