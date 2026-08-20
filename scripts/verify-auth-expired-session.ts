/* Declare & Believe — expired-session recovery.
 *
 * THE SYMPTOM: /api/auth/convex/token returned 401 on every page load, forever,
 * once a session had aged out. The app degraded correctly to guest, so nothing
 * user-visible broke — but a permanent error in production console output makes
 * real errors harder to see.
 *
 * THE CAUSE was not the 401. convex-data's authed() minted a token before
 * asking whether there was a session to mint one for, so every Convex call by a
 * guest hit the endpoint and was correctly refused. The endpoint was right; the
 * question should never have been asked.
 *
 * WHAT MUST NOT REGRESS: this is not "swallow 401". Four situations look alike
 * from the client and must stay distinguishable, and a credential refusal that
 * happens INSIDE a session's validity window has to remain observable.
 */
import { readFileSync } from "node:fs";

const AUTH = readFileSync(new URL("../src/app/declare/auth-store.js", import.meta.url), "utf8");
const DATA = readFileSync(new URL("../src/app/declare/convex-data.js", import.meta.url), "utf8");

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) { if (ok) passed++; else failures.push(name); }
function section(t: string) { console.log("\n" + t + "\n"); }

/* ── 1. The root cause ───────────────────────────────────────────────────── */
section("1. No token is minted without a session");

check("authed() refuses before minting", /if \(!isSignedIn\(\)\) return null;/.test(DATA));
check("the session check runs BEFORE the token request",
  DATA.indexOf("if (!isSignedIn()) return null;") < DATA.indexOf("await freshToken()"));
check("initAuth is awaited so a page-start race cannot skip a real session",
  /await initAuth\(\)/.test(DATA) &&
  DATA.indexOf("await initAuth()") < DATA.indexOf("if (!isSignedIn()) return null;"));
check("isSignedIn and initAuth are imported", /import \{[^}]*initAuth[^}]*isSignedIn[^}]*\} from '\.\/auth-store\.js'/.test(DATA));
check("freshToken itself is unchanged and still fails soft",
  /ac\.convex\.token\(\{ fetchOptions: \{ throw: false \} \}\)/.test(DATA));

/* ── 2. Four failures, four answers ──────────────────────────────────────── */
section("2. Failure classification");

check("a thrown or timed-out request does NOT end the session",
  /catch \(e\) \{[\s\S]{0,200}sessionData = null;[\s\S]{0,200}return sessionData;/.test(AUTH));
/* Scoped to refreshSession. The OAuth one-time-token path and the sign-in
 * paths still clear on timeout, and should: there the credential being held is
 * known-dead, not merely unverified. */
const REFRESH = (() => {
  const i = AUTH.indexOf("async function refreshSession");
  return AUTH.slice(i, AUTH.indexOf("\n}", AUTH.indexOf("return sessionData;", i)));
})();
check("refreshSession no longer clears credentials on a timeout",
  REFRESH.length > 0 && !/clearStaleAuth/.test(REFRESH));
check("refreshSession ends the session only through endSession",
  /endSession\(/.test(REFRESH) && !/clearPersonalData/.test(REFRESH));
check("an offline device keeps its credentials",
  /navigator\.onLine === false\) return sessionData/.test(AUTH));
check("only a completed request with no session ends it",
  /if \(sessionData \|\| !hadStoredAuth\) return sessionData;/.test(AUTH));
check("an in-window refusal is classified as rejected",
  /exp !== null && exp > Date\.now\(\) \? 'rejected' : 'expired'/.test(AUTH));
check("a rejection stays observable as a console error",
  /reason === 'rejected'[\s\S]{0,220}console\.error/.test(AUTH));
check("ordinary expiry does NOT log an error",
  !/reason === 'expired'[\s\S]{0,120}console\.(error|warn)/.test(AUTH));
check("401 is never blanket-swallowed", !/catch[\s\S]{0,80}401/.test(AUTH));

/* ── 3. One bounded attempt, one notification ────────────────────────────── */
section("3. Bounded and quiet");

check("the session resolves once per load and is memoised",
  /if \(inited\) return inited;/.test(AUTH));
check("listeners are notified exactly once per load",
  (AUTH.match(/\.then\(\(s\) => \{ fire\(\); return s; \}\)/g) || []).length === 1);
check("the expiry path does not fire listeners again",
  !/function endSession[\s\S]{0,400}fire\(\)/.test(AUTH));
check("dead credentials are dropped before the client is built",
  /dropExpiredAuthBeforeInit\(\);[\s\S]{0,400}inited = consumePendingOAuth\(\)/.test(AUTH));
check("that pre-check only acts on a readable, past expiry",
  /if \(exp === null \|\| exp > Date\.now\(\)\) return false;/.test(AUTH));
check("a corrupt session record is treated as unknown, never as expired",
  /catch \(e\) \{ return null; \}/.test(AUTH) && /Number\.isFinite\(t\) \? t : null/.test(AUTH));

/* ── 4. What must survive ────────────────────────────────────────────────── */
section("4. Data safety");

const END = (() => {
  const i = AUTH.indexOf("function endSession");
  return AUTH.slice(i, AUTH.indexOf("\n}", i));
})();
check("ending a session clears the dead credentials", /clearStaleAuth\(\)/.test(END));
check("ending a session clears personal profile data", /clearPersonalData\(\)/.test(END));
check("Journey progress is NEVER deleted", !/db_journey/.test(END) && !/db_journey/.test(AUTH));
check("the Vault is NEVER deleted", !/vault/i.test(END));
check("the locale cache is NEVER deleted", !/db_journey_locale/.test(AUTH));
/* Deleting the locale cache would throw away paid-for translations that become
 * valid again on sign-in. It does not need deleting: eligibility already
 * withholds it from a guest, which is the property that matters. */
check("clearPersonalData still touches only the three profile keys",
  (AUTH.match(/removeItem\('declare-(profile-v1|rate-v1|words-received)'\)/g) || []).length === 3);

console.log("\n" + "─".repeat(62));
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} checks`);
