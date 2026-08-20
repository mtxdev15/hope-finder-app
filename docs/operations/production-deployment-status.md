# Production Deployment Status

**Last updated:** 2026-08-20, after Convex source parity (`6746655`).

---

## Convex: parity complete, freeze CLOSED ✅

> **Convex source parity is complete as of `6746655`.**
>
> - `main` is now the **authoritative source** for production Convex.
> - The temporary "do not deploy Convex from `main`" freeze is **closed**.
> - **No production Convex deployment occurred during parity reconciliation.**
>   Production already ran the same functions and schema; redeploying identical
>   code would have added deployment risk without changing behaviour.
> - Future Convex deployments **are permitted from reviewed `main`** whenever
>   `convex/` actually changes.
> - Deployments must **not** originate from stale release branches.

## ⚠️ Worker: DO NOT DEPLOY THE WORKER FROM `main`

> **Production Worker source is divergent from `main`. Do not deploy the Worker
> from `main` until Worker parity is completed and verified.**
>
> `main` still carries the retired `/give/*` handlers and the billing-portal
> IDOR. Production runs the hardened Worker deployed from
> `release-c1-monetization`. Deploying the Worker from `main` would roll
> production backwards into those vulnerabilities.

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
| **Convex** `prod:keen-hamster-650` | **`main`** (parity restored `6746655`) | Gift functions and tables removed; subscription + entitlement functions deployed but **inactive** (no Stripe env vars set) |
| **Cloudflare Worker** `hope-finder-worker` | `release-c1-monetization` | All four `/give/*` routes return **410 Gone**; IDOR removed; `GIFT_WEBHOOK_SECRET` deleted |
| **Cloudflare Pages** (frontend) | `main` | Donation frontend removed; `/pricing` live and **non-transactional** |

The frontend is intentionally the only component that tracks `main`.

---

## Safe operations while this mismatch exists

**Safe:** merging frontend-only changes to `main`; Cloudflare Pages builds
triggered by those merges.

**Safe:** `npx convex deploy` from reviewed `main`, following the release rule
below.

**Not safe:** `wrangler deploy` or `wrangler pages deploy dist` from `main`, until
Worker parity closes.

## Release rule — before every production Convex deployment

1. Confirm the branch is based on current `main`.
2. Inspect the `function-spec` diff.
3. Inspect schema and index changes.
4. Identify any destructive or validator-tightening change.
5. Deploy first to the isolated **dev** Convex deployment.
6. Run backend verification.
7. Obtain approval for production.
8. Deploy from the reviewed commit.
9. Rerun the production `function-spec` and smoke checks.

Deploy only when `main` carries an **intentional** backend difference from the
running production revision. Identical code is not a reason to deploy.

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

**Convex: resolved.** `6746655` ported the deployed backend source verbatim from
`release-c1-monetization` @ `332e611` — 18 files byte-identical, zero
production-only functions, zero validator differences across all 51 entries. The
audit is at `docs/operations/convex-production-parity-audit.md`.

**Worker: open.** A dedicated Worker parity checkpoint is in progress. Until it
lands, Worker deployments must be run from the branch the running Worker was
actually deployed from.

### Convex environment variables — intentional gaps

`convex/billing.ts` reads `STRIPE_SECRET_KEY` and `convex/http.ts` reads
`BILLING_WEBHOOK_SECRET`. **Neither is set in production**, which is exactly why
checkout and the billing webhook are inert. This is the intended state, not a
parity gap. `GIFT_WEBHOOK_SECRET` is still set on production Convex but nothing
in the deployed source reads it — a leftover from the retired giving product,
safe to remove once Worker parity closes.

---

## Current production posture

- Public Plus Checkout: **inactive** (no Stripe key or Price ids in production)
- Gentle Guidance: **inactive** (no model call exists in any deployed function)
- Pricing CTA: **non-transactional** (disabled control, no handler, no href)
- Donation product: **fully retired** — no payment path reachable
