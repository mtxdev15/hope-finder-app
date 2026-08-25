
> # ✅ RESOLVED — the problem this describes is fixed
>
> Worker source parity was reconciled by **`a224ac7`** (2026-08-20) — see
> `production-deployment-status.md`.
>
> Verified 2026-08-25 against `origin/main`: `worker/src/index.js` answers all four
> `/give/*` routes with **`410 Gone`** and reads `env.STRIPE_SECRET_KEY` **nowhere**.
> Deploying the Worker from `main` does not reintroduce the billing-portal IDOR.
>
> The Worker's live secrets have also changed since this was written: the stale
> `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are gone, and
> `BILLING_WEBHOOK_SECRET` / `STRIPE_BILLING_WEBHOOK_SECRET` are set.
>
> Note that `main` now contains a Worker change not yet deployed: both shared
> secrets are trimmed at the route boundary (`f9cb327`).

# Cloudflare Worker production-parity audit

**Status: audit complete. Source ported, nothing deployed to production.**

Audited 2026-08-20, immediately after Convex source parity (`6746655`).

---

## Active production Worker

Established from Cloudflare deployment records, not from repository history.

| | |
|---|---|
| Service name | `hope-finder-worker` |
| Active version | `cd2175a5-7986-43a1-ae2c-b542668d66dd` |
| Deployed | 2026-08-19T20:59:37Z |
| Handlers | `fetch` only — **no cron triggers, no scheduled work** |
| Compatibility date | `2025-01-01` |
| Compatibility flags | none |
| URL | `hope-finder-worker.thinktoro.workers.dev` |

**Deployed source revision: `release-c1-monetization` @ `7d0c767`** ("align the
translation allowlist with the real day schema", authored 2026-08-19T19:54Z — the
last commit touching `worker/` before the 20:59Z deploy). The next candidate,
`db3d49e` at 19:13Z, is older and differs by two lines in the allowlist.

`main`'s newest `worker/` commit is `5de75ba`, dated **2026-07-16** — five weeks
behind, and the commit that introduced the billing-portal handler.

### Bindings and configuration

| Kind | Name | Value / resource |
|---|---|---|
| KV namespace | `BIBLE_KV` | `823458f407a74de29402b6e88bba5a1e` |
| Environment variable | `CONVEX_SITE_URL` | `https://keen-hamster-650.convex.site` |
| Secret (name only) | `ANTHROPIC_API_KEY` | — |
| Secret (name only) | `BIBLE_API_KEY` | — |
| Secret (name only) | `JOURNEY_TRANSLATE_SECRET` | — |
| Secret (name only) | `STRIPE_SECRET_KEY` | — |
| Secret (name only) | `STRIPE_WEBHOOK_SECRET` | — |
| Secret (name only) | `UNSPLASH_ACCESS_KEY` | — |

No secret value was read, requested or recorded. No D1, R2, queue, Durable
Object, analytics dataset or service binding exists on either side.

**`GIFT_WEBHOOK_SECRET` is not bound to the production Worker** — it was deleted
when the legacy checkout integration was retired. It does still exist on production **Convex**, where
nothing reads it; recorded as leftover cleanup.

---

## Route inventory

| Route | Method | Production | Main | Authentication | Purpose | Parity action |
|---|---|---|---|---|---|---|
| `/bible` | GET, OPTIONS | ✅ 200 | ✅ | none (public read) | Scripture retrieval, KV-cached | none |
| `/bible/search` | GET | ✅ | ✅ | none (public read) | Scripture search | none |
| `/unsplash/search` | GET | ✅ | ✅ | none | Card Studio photos | none |
| `/unsplash/photo` | GET | ✅ | ✅ | none | Card Studio photos | none |
| `/unsplash/track` | POST | ✅ | ✅ | none | Unsplash attribution ping | none |
| `/internal/journey/translate` | POST | ✅ 403 unauth | ❌ **absent** | **server-to-server secret** | Journey prose translation | **add** |
| `/billing/webhook` | POST | ✅ 500 unconfigured | ❌ **absent** | Stripe signature + shared secret | Plus subscription events | **add (inert)** |
| `/give/checkout` | POST | ✅ **410** | ⚠️ **live handler** | none — trusted the browser | legacy checkout | **retire** |
| `/give/portal` | POST | ✅ **410** | ⚠️ **live handler, IDOR** | none — trusted the browser | legacy checkout | **retire** |
| `/give/subscription` | POST | ✅ **410** | ⚠️ **live handler** | none — trusted the browser | legacy checkout | **retire** |
| `/give/webhook` | POST | ✅ **410** | ⚠️ **live handler** | Stripe signature | legacy checkout | **retire** |
| CORS preflight on retired routes | OPTIONS | ✅ 204 | ⚠️ differs | none | preflight | **retire** |
| anything else | any | ✅ 405 | ✅ 405 | none | fallback | none |

Classification: **public** — `/bible*`, `/unsplash/*`; **internal
server-to-server** — `/internal/journey/translate`; **billing** —
`/billing/webhook`; **retired legacy checkout** — all four `/give/*`; **unknown
fallback** — 405. There is no health or diagnostics route on either side, and no
authentication route (auth is served by Convex, not the Worker).

All production values above were observed live, not inferred.

---

## Hazard 1 — retired `/give/*`

**Production is clean.** All four routes answer `410 {"error":"donations-retired"}`,
verified live. The deployed source states the handlers are *deleted, not merely
unrouted*, and grep confirms no `handleGive*` function survives.

**`main` would reintroduce them.** It carries live handlers for all four,
reachable at the same paths. The files that must change for parity are exactly
`worker/src/index.js` and `worker/wrangler.toml`.

The retired routes could reach Stripe checkout sessions, Stripe billing-portal
sessions, Stripe subscription objects, and the `giftHistory` / `giftStats` /
`giftEvents` Convex tables. Production `giftHistory` held **zero** rows, so no
account was ever linked to a gift.

Stripe no longer has a webhook endpoint pointing at `/give/webhook`; a 410 is
treated by Stripe as delivered-and-rejected, so nothing retries. **Giving is not
restored by this branch.**

---

## Hazard 2 — billing-portal IDOR

**Not present in production.** There is no `handleBillingPortal` in the deployed
source, and `/give/portal` returns 410 live. **This is not an active security
incident.**

**Present on `main`.** `worker/src/index.js` @ `main` defines
`handleBillingPortal`, which:

- takes the account identity from **`body.userId`**, supplied by the browser;
- on lookup failure, falls back to **searching Stripe by a submitted email**.

Ownership was therefore *selected by the caller* rather than derived
server-side, so submitting another person's address would open their billing
portal. Parity removes it.

No test was run against any real user. Production was probed only with the
synthetic address `synthetic-qa@example.invalid`, which returned 410 before any
handler ran.

---

## Internal route security, as deployed

| Property | Deployed behaviour |
|---|---|
| Method | POST only; otherwise `405 method-not-allowed` |
| Authentication | `X-Declare-Internal` header vs `JOURNEY_TRANSLATE_SECRET` |
| Comparison | `timingSafeEqualHex`, constant time |
| Unconfigured secret | **fails closed** — refuses rather than allowing all |
| Order | auth is checked **before** the body is read and **before** any model call |
| CORS | **none emitted on this route**, deliberately — a browser must not read it |
| Identity in payload | `userId` / `accountId` / `email` → `identity-not-accepted` |
| Source language | only `en` → `es`; anything else rejected pre-model |
| Field allowlist | 12 authored fields only |
| Forbidden keys | reflections, user prayers, vault, crisis, identity, verse/scripture, prompt/system/instructions/messages |
| Per-field limit | 4000 characters |
| Total payload limit | 12000 characters |
| Empty payload | `empty-request`, never sent |
| Timeout | `AbortSignal.timeout(45000)` |
| Response | complete validated JSON required; failures are structured `{ok:false, reason}` |
| Logging | no secret is logged |

The schema was **not broadened** during parity work.

---

## Deliberately excluded

- No secret rotated, created or read.
- No production binding, KV namespace, route, service binding, compatibility
  setting or observability configuration changed.
- No Stripe product, price, checkout session or portal session created.
- No unrelated refactoring. `worker/src/index.js` and `worker/wrangler.toml` are
  **byte-identical** to `7d0c767`.
