# Current Data Map

*The real Convex schema, tables, and auth model on `redesign/desktop-web-shell`, plus what exists on
the separate, unmerged `feature/root-pattern-insight` branch. Nothing here has been merged or
modified as part of producing this document.*

## Tables on this branch (`convex/schema.ts`)

| Table | Shape | Purpose |
|---|---|---|
| `vaultItems` | `userId, clientId, type, ts, struggle?, translation?, explanation?, prayer?, text?, ref?, coll?, bgKind?/bgPhotoId?/bgSrc?/bgBy?/bgByLink?/bgColor?, verses?, declarations?` | Saved content (a "word," a verse, a declaration, a prayer, or a Card Studio image). Indexed `by_user` and `by_user_and_client` (idempotent save/update via a deterministic client-generated id). |
| `userData` | `userId, key, value` (value is a JSON string) | Generic per-user key/value blobs — Journey progress, cached insight text, anything small and bounded. Indexed `by_user` and `by_user_and_key`. |
| `vaultCollections` | `userId, name, kind (verse\|declaration\|prayer\|null), ts` | User-curated or auto-grouped Vault collections. |
| `reviews` | `userId, firstName, score_met_you, score_the_word, score_coming_back, testimonial?, isPublic, status (pending\|approved), createdAt` | Rate & Review submissions; nothing goes public until manually approved. |
| `giftStats` | `key ("total"), totalCents, giftCount` | A single denormalized public giving counter. |
| `giftHistory` | `userId, amountCents, currency, recurring, frequency?, sessionId, giftedAt, subscriptionId?, customerId?` | Per-user giving history, written by the Stripe webhook. |
| `giftEvents` | `sessionId` | Idempotency guard so webhook retries never double-count a gift. |

## Auth (`convex/auth.ts`, `convex/auth.config.ts`)

`@convex-dev/better-auth`. Email + password (no email-verification step) and Google OAuth, both
reading credentials from Convex environment variables. `trustedOrigins` is the single `SITE_URL` env
var. Every table above derives its `userId` server-side via `authComponent.safeGetAuthUser(ctx)` (or
the equivalent `requireUserId` helper pattern in newer files) — no function anywhere accepts a
client-supplied user id for authorization, matching `convex/_generated/ai/guidelines.md`'s rule.

`getCurrentUser` (a public query in `auth.ts`) is the one place the client asks "who am I" — it
normalizes Convex's `undefined`-on-signed-out into `null` for a stable client contract.

## Email (`convex/email.ts`)

`@convex-dev/resend`, sending from `Declare <noreply@declareandbelieve.com>` (verified domain,
`testMode: false`, so delivery is real to any address). Currently used for password reset;
`sendVerificationEmail` exists but is unused (no verification step is enabled in `auth.ts`).

## Separate, unmerged: `feature/root-pattern-insight`

One commit (`219991e`) ahead of `main`, not merged into this branch or any other. Adds:

- **`convex/schema.ts`**: a new `struggleHistory` table — `{ userId, struggle, askedAt }`, indexed
  `by_user` only. Deliberately minimal (no verse/declaration/prayer text saved) — the lightest,
  least-sensitive record of a genuinely sensitive history (fear, shame, grief) that still lets a
  pattern be seen over time. Named and shaped to match `giftHistory`'s append-only-log convention,
  not `vaultItems`'s "saved content" model.
- **`convex/struggleHistory.ts`**: `log` (mutation, fire-and-forget from `/today` right after a
  successful "Receive the Word," requires auth via the same `safeGetAuthUser` pattern), `recent`
  (bounded query, newest first, for the insight generator), plus (per the file, not fully quoted
  here) a `clearMine`/`clearMineInternal` pair for a future "clear my history" control — batched
  self-rescheduling delete, matching the Convex guideline for bulk deletes exceeding one transaction.
- **`convex/insight.ts`**: a `generate` action. Threshold-gated (`MIN_ENTRIES = 5` — no insight
  attempted below this, since naming a pattern off 1-2 data points would feel presumptuous). Caches
  its result in `userData` under `db_root_insight`, only recomputing once `RECOMPUTE_EVERY = 5` new
  entries have accumulated since the last computation. Calls the same Worker endpoint used by
  Journey (non-streaming, Sonnet-tier reasoning pattern), with its own system prompt (mirrored in
  `declare-root-insight-system-prompt.md` on that branch) that explicitly forbids clinical language,
  forbids asserting anything about the person as settled truth ("these seem to circle," never
  "you are"), and forbids quoting a past struggle back verbatim.
- **`src/app/declare/convex-data.js`**: thin client wrappers (`logStruggle`, `struggleHistorySummary`,
  `struggleHistoryClearMine`) following the same fail-soft `ensure()`/`runQuery`/`runMutation`
  pattern every other helper in that file already uses.
- **`src/pages/today.astro`** (this branch's own, pre-desktop-redesign copy, since the branch was
  cut from `main` before the redesign work started): a fire-and-forget `logStruggle(...)` call
  wired into the successful-response path.

## How this relates to the master build prompt's "Future memory" section (§13)

The master prompt describes a not-yet-approved future memory engine tracking things like "selected
struggle," "possible underlying lie," "fruit observation," with requirements to explain what's
stored, allow review/deletion, enforce ownership in Convex, and avoid asserting a spiritual
diagnosis. `feature/root-pattern-insight` is a real, working, much narrower first slice of exactly
that idea — logging only `{struggle, askedAt}` (not the richer objects the master prompt imagines),
already enforcing per-user ownership via Convex auth, and already writing its system prompt to avoid
diagnostic language. It is ahead of the master prompt's own roadmap, not behind it, but it has not
been merged, deployed against a live Convex environment, or reviewed against the master prompt's
specific "Future memory" requirements (explicit privacy-policy language, a real "Clear my history"
UI control, export planning) — those remain open work, tracked as a separate future review per
Jeff's instruction, not touched here.
