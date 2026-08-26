# Declare & Believe

A faith-based mind-renewal web app built on Romans 12:2. It meets Christians at
their lowest moment — fear, shame, broken identity, sleepless nights of doubt —
and speaks God's Word back to them through personalised Scripture, declarations
and prayer.

**Live:** [declareandbelieve.com](https://declareandbelieve.com) ·
**Owner:** JC Kingdom Ventures, LLC

*Last updated 2026-08-25.*

---

## Stack

| | |
|---|---|
| Frontend | Astro + Tailwind, mobile-first |
| Backend | Convex (`keen-hamster-650` in production) |
| API proxy | Cloudflare Worker `hope-finder-worker` — the Anthropic key never reaches the browser |
| Hosting | Cloudflare Pages + Workers |
| AI | `claude-haiku-4-5-20251001` for the instant struggle response; `claude-sonnet-4-6` for the 5-day Journey |
| Billing | Stripe, with **Convex as the entitlement source of truth** |

## Plans

| Plan | Price | Status |
|---|---|---|
| Free | — | live |
| Plus monthly | $8.99 / month | configured, not yet on sale |
| Plus annual | $79.99 / year | configured, not yet on sale |
| Plus lifetime | $149 one-off, 200 founding seats | built, not yet deployed |

**Public purchasing is off.** `PRICING_ENABLED` in
`src/app/declare/plan-display.js` is `false`, and production is *structurally*
incapable of starting a Checkout — four test suites scan `dist/` to keep it that
way. Turning it on is a commit, not a dashboard setting.

## Start here

| Read | For |
|---|---|
| `CLAUDE.md` | House rules, architecture, and the non-negotiables |
| `TODO.md` → *Next up* | What to do next. Current work at the top, finished at the bottom |
| `docs/operations/billing-secret-topology.md` | **Before touching any billing secret.** Four exist and three look alike |
| `docs/architecture/cross-platform-subscriptions.md` | The entitlement model, and why iOS will be an addition rather than a rewrite |
| `docs/operations/production-deployment-status.md` | What is actually deployed |

Docs in `docs/operations/` and `docs/verification/` are dated records of
particular days. Where one has been overtaken by events it says so in its first
line — trust the banner over the body.

## Verify

```bash
npm run check:types
npm run build && ls dist/dev          # must NOT exist
for f in scripts/verify-*.ts; do node --experimental-strip-types "$f"; done
```

Twelve billing and plan suites, 2,237 checks. They are executable contracts, not
smoke tests — several import the real decision functions and run them.

## Non-negotiables

1. The Anthropic API key never appears in frontend code. The browser calls the
   Worker; the Worker calls Anthropic.
2. The Worker holds **no Stripe credential**. It verifies signatures and relays
   bytes; Convex owns every Stripe call, at one pinned API version.
3. Mobile first, always. The 3am user is on their phone.
4. One change at a time — never refactor and add features together.
