# Production Deployment Status

**Last updated:** 2026-08-20, after the three-release Journey sequence
(`93b5b9e`, `c838cbc`, `2dfee66`).

---

## ⚠️ DO NOT DEPLOY THE BACKEND FROM `main`

> Production Convex and Worker are currently **ahead of `main`** and were deployed
> from `release-c1-monetization`. Until that branch is merged, **do not run
> `npx convex deploy` or `wrangler deploy` from `main`**, because doing so would
> restore retired giving functions and insecure legacy routes.

### Why this is dangerous, concretely

`main` still contains the **pre-retirement** backend source:

- `convex/gifts.ts` — the removed gift functions, including `clearStats`, a
  one-command destructive wipe of the giving tables.
- `convex/schema.ts` — the `giftStats` / `giftHistory` / `giftEvents` tables.
- `worker/src/index.js` — the original `/give/*` handlers, which include:
  - a **billing-portal IDOR**: it searched Stripe customers by a
    browser-submitted email, so submitting anyone's address opened their
    billing portal;
  - browser-supplied `userId` trusted as the gift owner;
  - browser-supplied `subscriptionId` with no ownership check.

Deploying either from `main` would **roll production backwards into those
vulnerabilities.**

---

## What is deployed where

| Component | Deployed from | State |
|---|---|---|
| **Convex** `prod:keen-hamster-650` | `release-c1-monetization` | Gift functions and tables removed; subscription + entitlement functions deployed but **inactive** (no Stripe env vars set) |
| **Cloudflare Worker** `hope-finder-worker` | `release-c1-monetization` | All four `/give/*` routes return **410 Gone**; IDOR removed; `GIFT_WEBHOOK_SECRET` deleted |
| **Cloudflare Pages** (frontend) | `main` | Donation frontend removed; `/pricing` live and **non-transactional** |

The frontend is intentionally the only component that tracks `main`.

---

## Safe operations while this mismatch exists

**Safe:** merging frontend-only changes to `main`; Cloudflare Pages builds
triggered by those merges.

**Not safe:** `npx convex deploy`, `wrangler deploy`, or
`wrangler pages deploy dist` from `main`.

### Before capturing release evidence

A local `npm run build` is **not** release evidence. Vite loads `.env.local` and
`.env`, so a build made with either present bakes in the **development** Convex
and Worker URLs. It runs fine and proves nothing about what Cloudflare Pages
serves. This has already cost one full verification matrix, which had to be
re-run against a clean checkout before it could be trusted.

Run this first:

```
node scripts/check-release-build-env.ts
```

It exits non-zero when the working tree cannot produce a clean release build,
and names the offending files without printing any of their contents. It is
opt-in: it is not wired into `npm run build` or CI, so ordinary development
builds are unaffected.

Release evidence must come from **either** a Cloudflare Pages build whose
relevant public values have been *compared* to production (not assumed equal),
**or** a clean worktree with neither env file, given the exact production public
values. Record the commit built, the build environment, the public variables
compared, the generated asset names, the catalog URL and the lazy chunk names.

---

## How this resolves

> **Backend parity checkpoint, opened 2026-08-20.**
> **Production Convex is ahead of `main`. Do not deploy from `main` until backend
> parity is completed and verified.**
>
> This is no longer only about the retired giving functions. The Spanish Journey
> work shipped on 2026-08-20 depends on `convex/journeyTranslate.ts` and the
> `journeyTranslations`, `usageCounters` and `usageReservations` tables, which
> are **live in production but absent from `main`**. A Convex deploy from `main`
> today would remove backend behaviour the live frontend is already using.
>
> While this checkpoint is open: do not deploy Convex from `main`, do not deploy
> Convex from another branch, do not change the production schema, and do not
> delete deployed functions or tables.

The resolution is a dedicated **backend-parity release** that ports only the
backend source already deployed to production — not a wholesale merge of
`release-c1-monetization`, which also carries unfinished frontend monetization.

Until that lands, backend deployments must be run from the branch the running
backend was actually deployed from.

---

## Current production posture

- Public Plus Checkout: **inactive** (no Stripe key or Price ids in production)
- Gentle Guidance: **inactive** (no model call exists in any deployed function)
- Pricing CTA: **non-transactional** (disabled control, no handler, no href)
- Donation product: **fully retired** — no payment path reachable
