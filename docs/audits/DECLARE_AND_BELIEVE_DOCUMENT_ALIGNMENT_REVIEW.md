# Declare & Believe Document Alignment Review

## Executive conclusion

The existing documentation is strong, but it describes more than one generation of the product.

The safest approach is not to overwrite any current file. Keep the existing files as historical and operational context, then add one master build prompt that resolves conflicts and tells Claude Code which source wins when documents disagree.

## Strong alignment across the files

The following ideas are consistent and should remain non-negotiable:

- Declare & Believe is a Scripture-first mind-renewal product rooted in Romans 12:2.
- The primary user is often exhausted, vulnerable, and using a phone late at night.
- The core interaction begins with a selected struggle or free-text burden.
- Scripture, declarations, prayer, and identity in Christ are central.
- The voice is pastoral, direct, specific, grounded, and never clinical.
- Mobile-first behavior is mandatory.
- The visual identity uses forest, gold, cream, Cormorant Garamond, and DM Sans.
- API keys must remain behind Cloudflare Workers.
- Changes must be surgical, tested locally, and reviewed before production.
- App copy should not use em dashes, except typographic verse ranges.
- The product should avoid wellness-app tropes, social feeds, streak anxiety, badges, XP, and shallow inspirational content.

## Conflicts that must be resolved before Claude builds

### 1. V1 single-screen product versus the current platform

`PRODUCT.md` and the original project brief describe a single-screen, one-interaction product. That was correct for the first version.

The current product already includes:

- Word
- Declare
- Results
- Journey
- Vault
- You
- Accounts
- Convex persistence

Resolution:

- Preserve the core loop: one burden, one Word, one focused encounter.
- Treat the surrounding routes as a platform that supports that loop.
- Do not force every feature onto one screen.
- Do not turn the product into a generic dashboard.

### 2. Light cream design versus the approved dark sanctuary experience

`DESIGN.md` is a detailed V1 light-theme system centered on cream backgrounds and white cards. The current application and approved redesign use a dark, cinematic, forest sanctuary environment.

Resolution:

- Do not delete `DESIGN.md`.
- Treat it as the V1 design foundation and potential future light-mode reference.
- Build a V2 semantic token layer for the dark app.
- Preserve the same brand DNA:
  - forest authority
  - gold sacred emphasis
  - Cormorant for sacred content
  - DM Sans for interface content
  - Scripture-first hierarchy
  - accessibility and reduced motion
- Do not blindly apply V1 cream-background rules to the current app.

### 3. Convex versus Supabase

The Builder's Brief lists Supabase as a future V2 backend and auth provider. The current repository instructions and the owner's current architecture use Convex.

Resolution:

- Convex is the active backend source of truth.
- Do not install or migrate to Supabase.
- Before modifying Convex code, read `convex/_generated/ai/guidelines.md`.
- Mark the Supabase rows in the Builder's Brief as historical when documentation is updated.

### 4. Source of truth for the AI prompts

The current runtime structure has two separate AI systems:

- Instant Declare response:
  - live source: `src/app/declare/declare-api.js`
  - model: Claude Haiku 4.5
- Five-day Journey:
  - live source: `public/declare/journey-engine.js`
  - model: Claude Sonnet 4.6

`declare-and-believe-system-prompt.md` documents the instant Declare behavior. It is not the Journey prompt and it is not a replacement for the live code.

Resolution:

- Do not merge the two prompts.
- Do not overwrite either runtime file during a visual redesign.
- Audit code before proposing prompt changes.
- Any prompt change requires explicit approval, tests, and a rollback path.

### 5. Scripture text architecture

The instant Declare flow currently receives verse text inline from Claude.

The separate Word reader uses API.Bible.

Resolution:

- Preserve the current behavior during UI phases.
- Do not silently move Declare verse resolution to API.Bible.
- If canonical lookup is desired later, make it a separate architecture proposal that accounts for translation licensing, FUMS tracking, caching, latency, fallback behavior, and response validation.

### 6. Crisis behavior

The documents describe both a conditional crisis banner and an always-visible crisis entry point.

Resolution:

- Keep a low-profile crisis-help link visible throughout Declare and Results.
- Show a prominent crisis panel when the user selects a crisis-specific struggle or the current safety system identifies elevated risk.
- Do not bury crisis resources.
- Do not let AI be the only safety layer.
- Any change to crisis behavior requires separate review.

### 7. Old monetization roadmap versus subscription direction

The original Builder's Brief includes donations and advertising. The current product direction is Free, Plus, Family, and Church subscriptions.

Resolution:

- Do not add ads to the sacred app experience.
- Do not implement subscription gating until the core Declare, Results, Journey, Vault, and You flows are stable.
- Pricing and entitlements require a separate approved phase.

### 8. Tagline differences

Existing language includes:

- Scripture for the weight you carry.
- Scripture to Renew Your Mind.
- Renew your mind with Scripture, instantly, personally, powerfully.

Resolution:

Use a hierarchy:

- Primary brand promise: `Scripture for the weight you carry.`
- Product descriptor: `Scripture to Renew Your Mind.`
- SEO or explanatory copy may use the longer phrase when needed.

## Recommended document treatment

Do not overwrite the current files.

Keep:

- `CLAUDE.md`
- `DESIGN.md`
- `PRODUCT.md`
- `declare-and-believe-project-brief.md`
- `declare-and-believe-builders-brief.md`
- `declare-and-believe-system-prompt.md`

Add:

- `docs/prompts/DECLARE_AND_BELIEVE_MASTER_BUILD_PROMPT.md`
- Later: `docs/product/PRODUCT_V2.md`
- Later: `docs/design/DESIGN_V2.md`
- Later: `docs/architecture/CURRENT_ARCHITECTURE.md`

Claude should first audit the code and propose documentation amendments. It should not rewrite the historical documents until the owner explicitly approves the changes.
