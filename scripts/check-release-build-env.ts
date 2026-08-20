/* Declare & Believe — release-build environment check.
 *
 * Vite loads .env.local and .env during `npm run build`. Those files hold the
 * DEVELOPMENT backends, so a local build made with them present silently ships
 * dev Convex and dev Worker URLs. That build is fine to run; it is NOT release
 * evidence, because it is not the bundle Cloudflare Pages produces.
 *
 * This was found the hard way: a full 39-item matrix was run against a build
 * that had baked in the dev deployment, and the whole thing had to be redone
 * against a clean checkout before it could be trusted.
 *
 * Run before capturing release evidence:
 *   node scripts/check-release-build-env.ts
 *
 * Exits non-zero when the working tree cannot produce a clean release build.
 */
import { existsSync } from "node:fs";

const OFFENDERS = [".env.local", ".env"];
const present = OFFENDERS.filter((f) => existsSync(new URL("../" + f, import.meta.url)));

console.log("Release-build environment check\n");

if (!present.length) {
  console.log("  ✓ no .env.local, no .env — this tree can produce release evidence");
  console.log("\nRemember to supply the production public values explicitly.");
  process.exit(0);
}

console.log("  ✗ present: " + present.join(", "));
console.log(`
A build from this tree is NOT acceptable release evidence: Vite will load those
files and bake their values into the client bundle.

Use one of the two approved paths instead:

  1. The Cloudflare Pages build for the PR, after confirming its relevant public
     values match production. Compare them; do not assume they match.

  2. A clean worktree with neither file, given the exact production public
     values:

       git worktree add --detach ../release-build <commit>
       # supply the production PUBLIC_* values, then build there

Whichever you use, record: the commit built, the build environment, the public
variables compared, the generated asset names, the catalog URL, and the lazy
chunk names.`);
process.exit(1);
