# Production Deployment Status

**Last updated:** 2026-08-01, after reconciling production `main` into
`release-c1-monetization` (merge `e09f410`).

**Reconciliation status:** the production frontend hotfix and this document now
also live on `release-c1-monetization`, so that branch is a superset of what is
deployed. The warning below still applies, because `main` itself has not
changed — it still carries the pre-retirement backend source.

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

---

## Reconciliation already done

`release-c1-monetization` has merged `main` (commit `e09f410`), so the release
branch contains the deployed hotfix history. Nothing further is needed in that
direction. What remains is the *other* direction: merging the release branch
into `main`.

---

## How this resolves

Merge `release-c1-monetization` once its Journey redesign, subscription backend
and entitlement work are approved. At that point `main` carries the same backend
source that production already runs, and the restriction lifts.

Until then, backend deployments must be run from `release-c1-monetization`.

---

## Current production posture

- Public Plus Checkout: **inactive** (no Stripe key or Price ids in production)
- Gentle Guidance: **inactive** (no model call exists in any deployed function)
- Pricing CTA: **non-transactional** (disabled control, no handler, no href)
- Donation product: **fully retired** — no payment path reachable
