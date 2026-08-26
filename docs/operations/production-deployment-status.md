# Production Deployment Status

**Last updated: 2026-08-25.** Current state first; the 2026-08-20 parity record
is kept below under *History*.

---

## Current state — 2026-08-25

### Configuration: complete

| Surface | State |
|---|---|
| Live Stripe catalog | 3 prices on `prod_V8OKKIMHiVw0KE` — $8.99/mo, $79.99/yr, **$149 one-off** — each with a versioned lookup key |
| Live webhook | `Declare Production Billing` → Worker `/billing/webhook`, **Active**, 8 events, **0 deliveries ever** |
| Convex prod `keen-hamster-650` | `STRIPE_SECRET_KEY` (`rk_live_`), all three price IDs, `BILLING_WEBHOOK_SECRET`, `SITE_URL` |
| Worker `hope-finder-worker` | `BILLING_WEBHOOK_SECRET`, `STRIPE_BILLING_WEBHOOK_SECRET`, `CONVEX_SITE_URL` — stale Stripe secrets removed |
| Public purchasing | **off** — `PRICING_ENABLED` is `false` and the `/pricing` CTA is unwired |

### Code: `main` is AHEAD of production

The 2026-08-20 record below closed the Convex deploy freeze and made `main`
authoritative. That is still true, **but `main` has moved since** — twelve commits
have touched `convex/`:

| Commits | What | In production? |
|---|---|---|
| `cda4a84`, `e7501bd` | `cancel_at` period-end normalization | unknown |
| `8a74786` … `5fa51bd` | gated test-clock harness + 9 fixes | **no** — the 2026-08-24 audit found zero deployed `testHarness` entries |

The Worker is also behind: `f9cb327` trims both shared secrets at the route
boundary and is not deployed.

**Do not infer the deployed revision from this table.** Establish it with
`npx convex function-spec --prod` before deploying. That command is the only
ground truth; every document in this folder has been wrong about production at
least once.

### Not yet deployed at all

Branch `claude/convex-stripe-billing-webhook-7tnwek` carries the `plus_lifetime`
plan — one-time Checkout, refund revocation, founding-seat cap, schema widening.
Additive, no backfill required (production holds zero billing rows).

Branch `claude/billing-pricing-cta-stage6` carries the `/pricing` CTA wiring and
is **deliberately unmerged** until after the real-money smoke test.

Ordered steps: `TODO.md` → *Next up*.

---

## History

*Everything below is the 2026-08-20 parity record, kept for the reasoning. It
describes a freeze that is closed and a divergence that is fixed.*

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

## Worker: parity complete, freeze CLOSED ✅

> **Worker source parity is complete as of `a224ac7`.**
>
> - `main` is now **authoritative** for the production Worker.
> - The temporary Worker deployment freeze is **closed**.
> - **No production Worker deployment occurred during parity reconciliation.**
>   Production already ran the exact source being reconciled.
> - Future Worker deployments **are permitted from reviewed `main`** whenever
>   `worker/` actually changes.
> - Production deployment must **never** originate from
>   `release-c1-monetization` or any other stale branch.

Both backends are now reproducible from `main`, and neither was redeployed to
achieve it.

## Release rule — before every production Worker deployment

1. Confirm the branch is based on current `main`.
2. Review the complete `worker/` diff.
3. Compare routes and bindings.
4. Inspect authentication and ownership changes.
5. Run `node scripts/verify-worker-parity.ts`.
6. Deploy first to the isolated dev Worker (`wrangler deploy --env dev`).
7. Verify dev routes and integrations.
8. Obtain production approval.
9. Deploy the reviewed commit.
10. Verify the active production version and route behaviour afterwards.

## What is deployed where

| Component | Deployed from | State |
|---|---|---|
| **Convex** `prod:keen-hamster-650` | **`main`** (parity restored `6746655`) | Legacy checkout functions and tables removed; subscription + entitlement functions deployed but **inactive** (no Stripe env vars set) |
| **Cloudflare Worker** `hope-finder-worker` | **`main`** (parity restored `a224ac7`) | All four `/give/*` routes return **410 Gone**; IDOR removed; `GIFT_WEBHOOK_SECRET` not bound |
| **Cloudflare Pages** (frontend) | `main` | Legacy checkout frontend removed; `/pricing` live and **non-transactional** |

All three components now track `main`.

---

## Safe operations

**Safe:** merging frontend-only changes to `main`; Cloudflare Pages builds
triggered by those merges.

**Safe, following the release rules below:** `npx convex deploy` and
`wrangler deploy` from reviewed `main`, and Cloudflare Pages builds from `main`.

**Not safe:** deploying either backend from `release-c1-monetization` or any
other stale branch. `main` is now the only correct source for both.

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

**Worker: resolved.** `a224ac7` ported the deployed Worker source verbatim from
`release-c1-monetization` @ `7d0c767` — both files byte-identical, all twelve
live routes behaving identically to production, and the two hazards `main`
carried (the live legacy checkout handlers and the billing-portal IDOR) removed. The
audit is at `docs/operations/worker-production-parity-audit.md`.

### Operational secret state — recorded, not changed

No secret was added, removed or rotated during parity closure. What follows is a
statement of the current configuration, verified by reading **names only**.

**Intentionally absent, which is why billing is inert:**

| Secret | Where it is read | Production state |
|---|---|---|
| `STRIPE_SECRET_KEY` | `convex/billing.ts` | **absent from production Convex** |
| `BILLING_WEBHOOK_SECRET` | `convex/http.ts`, `worker/src/index.js` | **absent from production Convex** |
| `STRIPE_BILLING_WEBHOOK_SECRET` | `worker/src/index.js` | **absent from the production Worker** |

Checkout and the billing webhook therefore cannot run. `/billing/webhook`
returns `500 Webhook not configured` on both production and dev — verified live.
This is the intended state. **Do not add these secrets** as part of any parity or
hygiene work; adding them is a monetization launch decision.

**Configured but unread — secret-hygiene backlog, not parity:**

| Secret | Where it is set | Current reader |
|---|---|---|
| `GIFT_WEBHOOK_SECRET` | production **Convex** | none — retired with the legacy checkout integration |
| `STRIPE_WEBHOOK_SECRET` | production **Worker** | none — the surviving code reads `STRIPE_BILLING_WEBHOOK_SECRET` |

Both are leftovers from a legacy checkout integration. Neither is a parity gap:
the source on `main` is byte-identical to what is deployed. They should be
removed in a **separate secret-hygiene checkpoint**, with the Stripe dashboard
checked for any endpoint still pointing at the retired webhook first. **Do not
remove them during parity work, and do not rotate anything.**

---

## Current production posture

- Public Plus Checkout: **inactive** (no Stripe key or Price ids in production)
- Gentle Guidance: **inactive** (no model call exists in any deployed function)
- Pricing CTA: **non-transactional** (disabled control, no handler, no href)
- Legacy checkout integration: **fully retired** — no payment path reachable
