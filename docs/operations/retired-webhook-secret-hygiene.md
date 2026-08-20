# Retired-webhook secret hygiene — audit

**Status: AUDIT ONLY. Nothing was removed, rotated or added.**

Audited 2026-08-20 from `main` @ `4a09dc6`, after Convex and Worker source parity.

Re-run the mechanical half with `node scripts/audit-retired-secrets.ts`.

---

## 1. Source inventory

Only files **tracked by git on this branch** are counted. A stale agent worktree
under `.claude/worktrees/` holds pre-parity source (`gifts.ts`, `give.js`, the
billing-portal IDOR); it is git-ignored, ships nowhere, and is excluded. It
should be pruned — see the follow-up below.

Comments are excluded using a character-level scanner
(`scripts/lib-strip-comments.mjs`) rather than a regex. This matters: a regex
stripper got `worker/src/index.js` wrong in **both** directions, calling the
retirement comment block executable and real `env.BILLING_WEBHOOK_SECRET` reads
prose. That file documents the retired routes in detail, so its comments are full
of the exact identifiers under audit.

| Token | Executable readers | In comments | Where |
|---|---:|---:|---|
| `GIFT_WEBHOOK_SECRET` | **0** | 1 | `convex/http.ts:36` (comment only) |
| `STRIPE_WEBHOOK_SECRET` | **0** | 0 | nowhere in tracked source |
| `STRIPE_BILLING_WEBHOOK_SECRET` | 2 | 0 | `worker/src/index.js:452,460` |
| `BILLING_WEBHOOK_SECRET` | 4 | 0 | `convex/http.ts:44`; `worker/src/index.js:452,460,528` |
| `STRIPE_SECRET_KEY` | 3 | 0 | `convex/billing.ts:109,233`; `worker/src/index.js:440` |
| `stripe-signature` | 0 | 0 | header is read as `Stripe-Signature` |
| `/give/` | 4 route matches | 9 | `worker/src/index.js:779‑782` — the 410 branch |
| `/billing/webhook` | 1 route match | 2 | `worker/src/index.js:791` |

One tooling mention exists — `scripts/verify-worker-parity.ts:134` names
`STRIPE_SECRET_KEY` inside an assertion that no secret is logged. It is a test,
not a runtime, and is reported separately rather than counted as a reader.

### Runtime component and reachability

| Reference | Component | Deployed | Reads a secret | External traffic reachable |
|---|---|---|---|---|
| `worker/src/index.js:440` `fetchStripeSubscription` | Worker | yes | `STRIPE_SECRET_KEY` | only from the billing webhook, which is gated closed |
| `worker/src/index.js:452,460` billing gate + signature | Worker | yes | billing secrets | `POST /billing/webhook` — **returns 500 before reading the body** |
| `worker/src/index.js:528` forward to Convex | Worker | yes | `BILLING_WEBHOOK_SECRET` | unreachable while the gate fails |
| `worker/src/index.js:779‑782` | Worker | yes | none | yes — answers `410 donations-retired` |
| `convex/http.ts:44` | Convex | yes | `BILLING_WEBHOOK_SECRET` | `POST /billing/subscription-event`, gated |
| `convex/billing.ts:109,233` | Convex | yes | `STRIPE_SECRET_KEY` | authenticated action; unset key means it cannot run |

### Proven mechanically

- `GIFT_WEBHOOK_SECRET` — **zero executable readers**.
- `STRIPE_WEBHOOK_SECRET` — **zero executable readers**, and zero mentions of any
  kind in shipped source.
- Neither controls any active authentication or signature verification: the only
  signature check is `verifyStripeSignature(..., env.STRIPE_BILLING_WEBHOOK_SECRET)`,
  which names a different secret explicitly.
- Removing them cannot enable a fallback: there is no `||` or `??` chain reaching
  either name, and none falling back *from* either name.
- No silent substitution: the billing gate requires
  `STRIPE_BILLING_WEBHOOK_SECRET && CONVEX_SITE_URL && BILLING_WEBHOOK_SECRET`
  and **fails closed** with `500` before the request body is read.

`node scripts/audit-retired-secrets.ts` — **12/12**.

---

## 2. Platform configuration — names only

No secret value was read, printed or requested.

### Production Convex (`keen-hamster-650`)

| Name | Present | Owner | Executable readers | Required by the active deployment |
|---|---|---|---:|---|
| `GIFT_WEBHOOK_SECRET` | **yes** | Convex | **0** | **no** |
| `STRIPE_SECRET_KEY` | no | Convex | 2 | no — its absence keeps checkout inert |
| `BILLING_WEBHOOK_SECRET` | no | Convex | 1 | no — its absence keeps the webhook inert |
| `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `SITE_URL`, `JOURNEY_TRANSLATE_SECRET`, `JOURNEY_TRANSLATE_URL` | yes | Convex | in use | **yes — do not touch** |

### Production Worker (`hope-finder-worker`, version `cd2175a5…`)

| Name | Present | Owner | Executable readers | Required by the active deployment |
|---|---|---|---:|---|
| `STRIPE_WEBHOOK_SECRET` | **yes** | Worker | **0** | **no** |
| `STRIPE_BILLING_WEBHOOK_SECRET` | no | Worker | 2 | no — its absence keeps the webhook inert |
| `STRIPE_SECRET_KEY` | yes | Worker | 1 | only via the gated webhook; currently unreachable |
| `ANTHROPIC_API_KEY`, `BIBLE_API_KEY`, `JOURNEY_TRANSLATE_SECRET`, `UNSPLASH_ACCESS_KEY` | yes | Worker | in use | **yes — do not touch** |
| `BIBLE_KV` → `823458f407a74de29402b6e88bba5a1e`, `CONVEX_SITE_URL` | yes | Worker | in use | **yes — do not touch** |

---

## 3. Stripe endpoints — NOT AUDITED, access unavailable

**I could not inspect the Stripe dashboard.** `STRIPE_SECRET_KEY` exists only as
a Cloudflare Worker secret, which is write-only by design, and no Stripe
credential is present in any local environment file. I did not attempt to
extract it, and no Stripe API call was made.

A 55-second read-only `wrangler tail` of the production Worker captured no
output. That is **inconclusive**, not evidence of absence: the window was short,
Stripe retries on a long backoff, and the tail may require an interactive
session. It is recorded here so nobody later mistakes it for proof.

**This is the blocking gap.** Steps 2–4 of the removal sequence cannot be
justified until the endpoint inventory below is filled in by hand.

### Manual checklist — to be completed in the Stripe dashboard

Go to **Developers → Webhooks**, in **both live and test mode**, and include
**disabled** endpoints. For every endpoint record:

1. endpoint URL;
2. enabled or disabled;
3. live or test mode;
4. subscribed event types;
5. creation date;
6. most recent delivery attempt (timestamp);
7. recent response status codes;
8. which path it targets — `/give/*`, `/billing/webhook`, a retired hostname, a
   current hostname, or another service entirely;
9. whether its signing secret corresponds conceptually to `STRIPE_WEBHOOK_SECRET`
   (the retired donation webhook) or `STRIPE_BILLING_WEBHOOK_SECRET` (the
   subscription webhook that was never configured);
10. whether another application or environment shares the endpoint.

**Do not reveal any signing-secret value.** The name and the endpoint URL are
sufficient.

Then answer, explicitly:

| Question | Answer |
|---|---|
| Does any **live** endpoint still send donation events? | |
| Does any endpoint still call a retired `/give/*` path? | |
| Does any endpoint call `/billing/webhook`? | |
| Are recent attempts receiving 410 / 404 / 405 / 500? | |
| Can the endpoint be deleted safely? | |
| Does the endpoint belong to another environment or application? | |

**Do not delete an endpoint merely because its most recent response failed.**
A 410 from `/give/webhook` is the retirement working as designed, and a 500 from
`/billing/webhook` is the un-configured gate — neither proves the endpoint is
abandoned. Confirm ownership and intended retirement first.

---

## 4. Decision table

| Item | Present | Executable readers | External sender | Recent traffic | Action |
|---|---:|---:|---|---|---|
| Convex `GIFT_WEBHOOK_SECRET` | yes | **0** | unknown — Stripe not audited | unknown | **(2)** remove only after the Stripe endpoint audit clears it |
| Worker `STRIPE_WEBHOOK_SECRET` | yes | **0** | unknown — Stripe not audited | unknown | **(2)** remove only after the Stripe endpoint audit clears it |
| Stripe donation webhook endpoint(s) | unknown | n/a | n/a | unknown | **(4→2)** inventory first; disable, observe, then delete |
| Stripe billing webhook endpoint(s) | unknown | n/a | n/a | unknown | **(3)** keep if any exists — the route is inert by design, not by accident |
| Retired `/give/*` routes | yes, as 410 | 4 route matches | possibly Stripe | 410 verified live | **(1)** no change — the 410 is the retirement, and it works |
| `/billing/webhook` | yes, gated | 1 route match | possibly Stripe | 500 verified live | **(5)** response shape is a separate application decision |
| Convex `STRIPE_SECRET_KEY` (absent) | no | 2 | — | — | **do not add** |
| Convex `BILLING_WEBHOOK_SECRET` (absent) | no | 1 | — | — | **do not add** |
| Worker `STRIPE_BILLING_WEBHOOK_SECRET` (absent) | no | 2 | — | — | **do not add** |
| Worker `STRIPE_SECRET_KEY` (present) | yes | 1 | — | unreachable | **(3)** keep — a live reader exists behind the gate |

Classification key: **(1)** safe now · **(2)** after deleting a stale Stripe
endpoint · **(3)** keep for now · **(4)** belongs to another environment ·
**(5)** needs a separate application change.

Both retired secrets land in **(2)**, not **(1)**. Zero readers makes removal
*safe for the application*; it does not tell us whether an external sender is
still authenticating against one.

---

## 5. Route behaviour is explicitly out of scope

`/billing/webhook` returning `500 Webhook not configured` is arguably wrong for a
deliberately disabled integration — `503` or a retired-style response would say
more honestly that nothing is misconfigured, it is simply switched off. Stripe
also treats 5xx as retryable and 4xx as delivered, so a 500 invites redelivery
that a 4xx would stop.

**That is an application behaviour decision and is not made here.** Recorded as a
follow-up in `TODO.md`. This checkpoint changes no route response; no security
defect was found that would justify doing so.

---

## 6. Proposed operational order — for approval, not yet executed

1. Export or record endpoint metadata from the Stripe dashboard (section 3).
2. **Disable** the retired donation endpoint (do not delete yet).
3. Observe that no legitimate workflow breaks — giving is retired, so nothing
   should depend on it.
4. Delete the endpoint after confirmation.
5. Remove `GIFT_WEBHOOK_SECRET` from production Convex.
6. Remove `STRIPE_WEBHOOK_SECRET` from the production Worker.
7. Re-inventory environment-variable names on both platforms.
8. Verify application behaviour (section 7).
9. Update this document and `production-deployment-status.md`.

If no corresponding Stripe endpoint exists, steps 2–4 are unnecessary and 5–6 can
proceed directly once that is confirmed.

### Does removal require a deployment?

**Convex: no.** `npx convex env remove` applies to the deployment immediately;
environment variables are deployment state, not bundle state. No `convex deploy`
is needed, and none should be run for this.

**Worker: yes, mechanically — and it is not a redeploy of changed code.**
`wrangler secret delete` creates a **new Worker version** with the same script
and one fewer secret. This is unavoidable on the platform; it is not the same as
deploying changed source, and the resulting version should be recorded. The
script content stays byte-identical to `7d0c767`, so `main` remains authoritative.

**Do not deploy either backend for any other reason during this checkpoint.**

---

## 7. Verification plan for after removal

- production Convex function specification unchanged — 51 entries;
- active Worker version recorded before and after; behaviour unchanged;
- `/give/*` still returns `410 donations-retired` on all four;
- `/billing/webhook` still returns `500 Webhook not configured`;
- Journey translation still succeeds end to end;
- `/bible` still returns 200 for WEB and RVR1909;
- guest and authenticated Journey behaviour unchanged;
- no new Worker or Convex errors;
- no Stripe delivery loop remains;
- no checkout, billing, subscription, entitlement, donation or portal flow
  activated;
- no unrelated secret changed — re-list names on both platforms and diff.

Run every deterministic suite if any repository file changes, and report actual
counts rather than carrying previous ones forward.

---

## 8. Rollback

Removing a secret is reversible: set it again by name. **The value cannot be
recovered from either platform** — Convex and Cloudflare both treat secret values
as write-only — so before step 5 or 6, confirm the value is retrievable from
Stripe (for a signing secret, by rolling it on the endpoint) or from the owner's
password manager. If it is not recoverable and the endpoint has already been
deleted, restoration means creating a new endpoint and a new secret.

Deleting a Stripe endpoint is **not** reversible; a replacement gets a new signing
secret. That is why step 2 disables and step 4 deletes, with observation between.
