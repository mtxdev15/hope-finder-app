# Current Route Map

*The actual routes in `src/pages/` today, what each one does, and a recommended outline for
reconciling `TODO.md`'s existing approved subdomain plan with the master build prompt's §10/§17
target model. This is a recommendation only — no Cloudflare, DNS, routing, or config changes have
been made.*

## Routes as they exist today

| Route | File | What it does | Auth required? |
|---|---|---|---|
| `/` | `src/pages/index.astro` | The original V1 React single-page app (`src/app/app.jsx`), same struggle → Scripture/declaration/prayer loop, sharing `declare-api.js` with `/today`. | No |
| `/today` | `src/pages/today.astro` | The current app experience: struggle entry, then a client-side "results view" swap (Scripture spine, Mindset, declarations, prayer, per-verse Breakdown, Journey cross-sell). No separate route for results. | No (Save/Journey persistence needs sign-in) |
| `/word` | `src/pages/word.astro` | Full Bible reader — chapter reading and full-text search, via the Worker's `/bible`/`/bible/search` routes (API.Bible). | No |
| `/journey` | `src/pages/journey.astro` | The 5-day guided arc, one day generated at a time. | Persistence needs sign-in |
| `/vault` | `src/pages/vault.astro` | Saved verses, declarations, prayers, words. | Persistence needs sign-in |
| `/you` | `src/pages/you.astro` | Profile, account, settings. | Yes for most content |
| `/signin` | `src/pages/signin.astro` | Sign-in (email/password + Google). | — |
| `/create-account` | `src/pages/create-account.astro` | Account creation. | — |
| `/reset-password` | `src/pages/reset-password.astro` | Password reset (Better Auth + Resend). | — |
| `/crisis` | `src/pages/crisis.astro` | Dedicated crisis-help page, static, real `tel:`/`sms:` links. | No |
| `/404` | `src/pages/404.astro` | Not-found page. | No |

All on one domain, `declareandbelieve.com`. No `app.*` subdomain exists yet.

## Master prompt's target model (§10, not yet built)

Proposes splitting into a public marketing site (`declareandbelieve.com`: `/`, `/how-it-works`,
`/pricing`, `/churches`, `/resources`, `/about`, `/privacy`, `/terms`, `/sign-in`) and a product app
on `app.declareandbelieve.com` (`/today`, `/word`, `/declare`, `/results/:sessionId`, `/journey`,
`/journey/:journeyId/day/:dayNumber`, `/vine`, `/vault`, `/you`, `/settings`, `/crisis`).

## `TODO.md`'s existing, separately-approved plan (2026-07-16, not touched by this task)

Also targets `app.declareandbelieve.com`, studied against Psalmlog's `app.psalmlog.com` structure,
with its own 7-phase breakdown (add the custom domain → no-op middleware → fix a relative link →
wire auth for both origins → rename 4 routes on `app.*` only → update canonical/OG tags → the actual
Host-based-redirect cutover). Route renames proposed there: `/today` → `/declare`, `/word` → `/bible`,
`/you` → `/profile`, `/signin` → `/login`.

## Where the two plans agree

- Both want `app.declareandbelieve.com` as the product domain and `declareandbelieve.com` to stay
  (or become) the marketing/public site.
- Both treat this as a multi-phase, low-risk-first migration (new domain attached before anything
  else changes), not a single risky cutover.
- Both explicitly protect `/crisis` from depending on any redirect.

## Where they differ

- **Naming**: `TODO.md` renames `/today` → `/declare` and `/word` → `/bible`; the master prompt's
  model treats `/today` and `/declare` as two *separate* routes (an orientation/dashboard page vs.
  the intake), and keeps `/word` as `/word`. These are not the same shape.
- **Granularity**: `TODO.md` is a concrete, ordered, single-repo-aware phase plan already written
  against this actual codebase (specific files, specific Convex dashboards, specific Google Cloud
  Console steps). The master prompt's model is a target IA sketched at a higher level, without a
  phase-by-phase cutover plan of its own.
- **Scope**: the master prompt's model also proposes new routes that don't exist in any form today
  (`/results/:sessionId` as a real route, `/vine`, `/settings` as its own route rather than folded
  into `/you`). `TODO.md` does not propose any new routes, only renames of existing ones.

## Recommended merged outline (content only, nothing implemented)

1. **Adopt `TODO.md`'s phase order as the actual execution plan** — it is already scoped against
   this repository's real files, dashboards, and auth configuration, which the master prompt's
   model is not.
2. **Adopt the master prompt's target names only where `TODO.md` is silent**: keep `/word` as
   `/word` (not `/bible` — avoids confusion with the Worker's own `/bible` API route, which is a
   different thing living at a different layer); decide `/today` vs. `/declare` naming with Jeff
   directly, since the two plans disagree here and it is a real product-naming decision, not a
   technical one.
3. **Do not introduce `/results/:sessionId` as a real route** as part of this migration — Results is
   currently, deliberately, a client-side view swap inside one page (not a separate resource with
   its own shareable URL). Making it a real route is a separate, larger product decision (does a
   result need to be linkable/bookmarkable?) that shouldn't be bundled into a domain migration.
4. **Do not introduce `/vine` or a standalone `/settings` route yet** — both are tied to features
   (Tree of Life / Vine visualization, a dedicated settings surface) that are still roadmap items,
   not built. Adding empty routes ahead of the feature would create dead surface area.
5. **Keep `/crisis` un-redirected in every phase**, matching both plans' explicit agreement on this
   point.
6. **Sequence**: run `TODO.md`'s 7 phases as written, substituting the naming decision from step 2
   once Jeff makes it, and treat "new routes" (`/results`, `/vine`, `/settings`) as out of scope for
   the domain migration itself — they get added later, under their own feature branches, once the
   domain split is already stable.

This outline is a starting point for a conversation, not a final decision — Jeff should confirm the
`/today` vs. `/declare` naming call and whether `/results` should ever become a real route before
any implementation begins.
