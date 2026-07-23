# Document Conflicts

*Every place the 11 audited documents (`CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`,
`declare-and-believe-project-brief.md`, `declare-and-believe-builders-brief.md`,
`declare-and-believe-system-prompt.md`, `docs/audits/DECLARE_AND_BELIEVE_DOCUMENT_ALIGNMENT_REVIEW.md`,
`docs/prompts/DECLARE_AND_BELIEVE_MASTER_CLAUDE_CODE_PROMPT.md`, `src/app/declare/declare-api.js`,
`public/declare/journey-engine.js`, `convex/_generated/ai/guidelines.md`) disagree with the real
repository, or with each other. No document listed here has been edited or overwritten.*

## Conflicts already correctly identified by `DECLARE_AND_BELIEVE_DOCUMENT_ALIGNMENT_REVIEW.md`

Independently re-checked against live source in this audit; all confirmed still accurate:

1. **V1 single-screen product vs. the current multi-route platform** — confirmed. The core loop
   (one burden, one Word) is preserved; the surrounding routes (Word, Journey, Vault, You, accounts)
   are real and live.
2. **Light cream `DESIGN.md` vs. the dark, cinematic app** — confirmed exactly. See "Design tokens"
   below for the specific token-level detail.
3. **Convex vs. Supabase** — confirmed. Convex is the only live backend; no Supabase code exists
   anywhere in the repo.
4. **Two separate AI systems, not one** — confirmed. `declare-api.js` (Haiku 4.5, instant) and
   `journey-engine.js` (Sonnet 4.6, Journey) remain genuinely separate files, models, and caching
   strategies. Neither has been merged.
5. **Scripture text architecture** — confirmed. Instant Declare still gets verse text written
   inline by the model; `/word` still resolves through API.Bible. No silent migration has happened
   either direction.
6. **Crisis behavior (banner + always-visible link)** — confirmed. Both layers are live; the AI is
   not the only safety mechanism.
7. **Old monetization roadmap (donations/ads) vs. subscription direction** — no pricing/entitlement
   code exists yet either way; this conflict is dormant, not resolved, since nothing has been built.
8. **Tagline hierarchy** — not something code can confirm or deny; still an open copy decision.

## Additional conflicts found in this audit, not previously documented

### CLAUDE.md's Worker description is out of date

CLAUDE.md describes the Worker as "a generic Anthropic-API passthrough with IP rate limiting." The
real `worker/src/index.js` also serves:
- `/bible` and `/bible/search` (API.Bible proxy for `/word`)
- `/unsplash/search`, `/unsplash/track`, `/unsplash/photo` (Card Studio background search)
- `/give/checkout`, `/give/webhook`, `/give/subscription`, `/give/portal` (Stripe giving flow)

Not incorrect, just incomplete. Worth a small factual update to CLAUDE.md's tech-stack section
whenever that file is next touched (not done here — it's a protected file for this task).

### The master prompt's route/domain model is aspirational, not descriptive

`DECLARE_AND_BELIEVE_MASTER_CLAUDE_CODE_PROMPT.md` §10 describes a target IA
(`app.declareandbelieve.com`, `/declare`, `/results/:sessionId`, `/vine`, `/settings`) that does not
exist yet. The real route map is flat, single-domain, and uses different names (`/today` for what
the target model calls `/declare`; no `/results` route at all — Results is a view swap inside
`/today`, not a route). See `../architecture/current-route-map.md` for the recommended reconciled
migration outline.

### Two independent, not-yet-reconciled subdomain plans

`TODO.md` (outside the audited 11, but load-bearing) already has its own approved
`app.declareandbelieve.com` plan, dated 2026-07-16, with a different phase breakdown than the master
prompt's §17. Neither has been implemented. They should be merged into one plan before either is
acted on — see the recommended outline in `../architecture/current-route-map.md`.

### The master prompt's "V2 semantic token layer" (§11) substantially already exists

The master prompt asks for new tokens (`surface-canvas`, `surface-shell`, `text-primary`,
`accent-gold`, etc.) as if none exist. `public/declare/declare.css` already has an equivalent
semantic system (`--bg`, `--surface`, `--text`, `--gold`, `--field`, `--line`, `--spine`, etc.),
dark-by-default, already covering the same ground under different names. Building a second,
parallel token system without reconciling names first would create a real duplication risk.

### No test framework exists, but the master prompt's testing section (§20) assumes one

`package.json` has no test dependency or script; no `*.test.*`/`*.spec.*` files exist in app source.
The master prompt's instruction to "run the repository's existing tests after each phase" has
nothing to run against today. See `production-risk-map.md` for the recommended interim standard.

### Tailwind v4's actual architecture differs from the Builder's Brief's description

The Builder's Brief describes "Tailwind CSS with custom design tokens... all brand values configured
in `tailwind.config.mjs`." The real setup is Tailwind v4 via `@tailwindcss/vite` (no
`tailwind.config.mjs`-driven token system), and in practice almost none of the real `/today` UI uses
Tailwind utility classes at all — the actual design system is the hand-authored CSS under
`public/declare/`.

### This session's unmerged work goes beyond every audited document's "current state"

`redesign/desktop-web-shell` already has a real, Jeff-reviewed sidebar shell (all three breakpoints)
and a real Results-page redesign (verse index, two-part Breakdown, Recent Words, a live Translation
switcher) — none of which any of the 11 documents describe, since all of it was built after those
documents were last updated. Functionally, this **is** the master prompt's Phase 1 and Phase 2; see
`../implementation/phase-1-existing-work-summary.md` and `phase-2-existing-work-summary.md`.

### `feature/root-pattern-insight` anticipates the master prompt's own "Future memory" section

A separate, unmerged branch already implements a `struggleHistory` log table and an
`insight`-generation action — almost exactly what the master prompt's §13 "Future memory" section
describes as a not-yet-approved future direction. It is ahead of the documented plan, not behind it.
Full detail: `../architecture/current-data-map.md`.

## Conflicts that remain genuinely open (not resolvable by reading code)

- Whether `/` (the legacy React app) is still a live, intentional entry point or should be retired.
- Which of the two subdomain-migration plans (`TODO.md` vs. master prompt §17) is authoritative.
- Whether a real test framework should be adopted now, given none exists.
- Tagline hierarchy (Primary brand promise / Product descriptor / SEO copy) — a copy decision, not
  a code fact.

These are listed as open questions for Jeff in the Phase 0 plan; nothing here resolves them
unilaterally.
