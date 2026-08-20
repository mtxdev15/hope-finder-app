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

## 3. Stripe endpoints — AUDITED (read-only)

Audited **2026-08-20** over the read-only `stripe-live-audit` connection.

**Connected account:** `acct_1Mf55qLL3Uli7L4x` — *JC Kingdom Ventures*.
**Mode: live.** Confirmed from the returned object's own `"livemode": true` field,
not by inspecting a key. No API key, key fragment, or signing-secret value was
read, printed, or requested at any point.

Only two operations were called, both GET: `GetWebhookEndpoints` and
`GetWebhookEndpointsWebhookEndpoint`. Nothing was created, updated, disabled,
deleted, resent, or rotated.

### Endpoint inventory — complete for live mode

**Exactly one endpoint exists.** The list call ran at `limit=100` and returned
`has_more: false`, so this is the whole set — a disabled endpoint would have been
included in that response, and none was.

| # | Field | Value |
|---|---|---|
| — | id | `we_1Tn2plLL3Uli7L4xUrsRKSpi` |
| — | description | `Declare Live Giving Counts` |
| 1 | endpoint URL | `https://hope-finder-worker.thinktoro.workers.dev/give/webhook` |
| 2 | enabled or disabled | **`enabled`** |
| 3 | live or test mode | **live** (`livemode: true`) |
| 4 | subscribed event types | `checkout.session.completed` (one only) |
| 5 | creation date | `1782592093` → **2026-06-27**, ~54 days before this audit |
| 6 | most recent delivery attempt | **not retrievable — see the gap below** |
| 7 | recent response status codes | **not retrievable — see the gap below** |
| 8 | which path it targets | **a retired `/give/*` path**, on the **current** Worker hostname |
| 9 | corresponds conceptually to | **`STRIPE_WEBHOOK_SECRET`** (Worker) — the retired donation webhook. It is the Worker, not Convex, that this endpoint addresses |
| 10 | shared with another app or environment | **no** — the hostname is this project's production Worker, and `application` is `null`, so it was created directly on the account rather than installed by a Stripe app |

`api_version` is pinned at `2022-11-15`. The `metadata` field is redacted by the
audit connection and was not unwrapped.

### Coverage gap — event and delivery history

**Delivery activity could not be inventoried, and this is not the same as finding
none.** The audit connection exposes only the `webhook_endpoints` resource. The
Events API and per-endpoint delivery-attempt history are absent from its operation
index — searches for events, delivery attempts, charges, payment intents, checkout
sessions, and subscriptions all resolve to nothing, so the failure is one of
credential scope, not of a missing record.

Consequently, questions 6 and 7 above are **unanswered, not answered "none"**.
Nobody should read this section as evidence that no deliveries occurred. The
`wrangler tail` note from the earlier pass remains just as inconclusive as it was.

These must be read by hand in **Developers → Webhooks →
`we_1Tn2plLL3Uli7L4xUrsRKSpi`**, before step 4 of the removal sequence:

- the most recent delivery attempt and its timestamp;
- the response codes on recent attempts (a `410` is the retirement working);
- whether any attempt is still **pending or scheduled for retry**.

**Test mode was not enumerable** with this live credential. A separate test-mode
read is required to make the same statement about test endpoints. Test-mode
endpoints cannot deliver live events and do not gate either secret, so this does
not block the decisions below.

### Standing hazard, independent of the secrets

The endpoint is **enabled and subscribed to `checkout.session.completed`** — an
account-wide event, not a donation-specific one. Any live Checkout Session that
completes on this account for **any** reason fans out to a retired `/give/*` path
and collects a `410`. Should the subscription work in `convex/billing.ts` ever be
switched on, its checkout completions would be delivered here too. That is an
argument for disabling the endpoint on its own merits, separate from secret
hygiene.

### Answers

| Question | Answer |
|---|---|
| Does any **live** endpoint still send donation events? | **Yes.** One, `we_1Tn2plLL3Uli7L4xUrsRKSpi`, enabled, on `checkout.session.completed`. |
| Does any endpoint still call a retired `/give/*` path? | **Yes** — that same endpoint, at `/give/webhook`. |
| Does any endpoint call `/billing/webhook`? | **No.** None. The gated billing route receives no Stripe traffic. |
| Does any endpoint target a **retired hostname**? | **No.** It targets the current production Worker hostname. |
| Are recent attempts receiving 410 / 404 / 405 / 500? | **Unknown** — delivery history is outside this credential's scope. The route returns `410` when reached, verified independently in section 1. |
| Do recent or pending deliveries exist? | **Unknown, and must be checked by hand.** Not established either way. |
| Can the endpoint be deleted safely? | **Not yet.** Disable, observe, then delete — per section 6. Its signing secret is also the only recoverable copy of the Worker value; see section 8. |
| Does the endpoint belong to another environment or application? | **No.** `application: null`, current hostname, this account. |

---

## 4. Decision table

Updated after the Stripe audit above. The changed rows are the two endpoint rows
and the two retired-secret rows.

| Item | Present | Executable readers | External sender | Recent traffic | Action |
|---|---:|---:|---|---|---|
| Convex `GIFT_WEBHOOK_SECRET` | yes | **0** | **none — no Stripe endpoint targets Convex** | n/a | **(1)** safe to remove now |
| Worker `STRIPE_WEBHOOK_SECRET` | yes | **0** | **yes — live enabled `we_1Tn2pl…`** | unknown | **(2)** remove only after the endpoint is disabled and deleted |
| Stripe donation webhook endpoint | **yes — 1, live, enabled** | n/a | n/a | unknown | **(2)** disable → observe → delete |
| Stripe billing webhook endpoint | **no — none exists** | n/a | n/a | n/a | nothing to keep or remove |
| Retired `/give/*` routes | yes, as 410 | 4 route matches | **confirmed Stripe** | 410 verified live | **(1)** no change — the 410 is the retirement, and it works |
| `/billing/webhook` | yes, gated | 1 route match | **none — confirmed** | 500 verified live | **(5)** response shape is a separate application decision |
| Convex `STRIPE_SECRET_KEY` (absent) | no | 2 | — | — | **do not add** |
| Convex `BILLING_WEBHOOK_SECRET` (absent) | no | 1 | — | — | **do not add** |
| Worker `STRIPE_BILLING_WEBHOOK_SECRET` (absent) | no | 2 | — | — | **do not add** |
| Worker `STRIPE_SECRET_KEY` (present) | yes | 1 | — | unreachable | **(3)** keep — a live reader exists behind the gate |

Classification key: **(1)** safe now · **(2)** after deleting a stale Stripe
endpoint · **(3)** keep for now · **(4)** belongs to another environment ·
**(5)** needs a separate application change.

### Why the two retired secrets now separate

They were both **(2)** because the external-sender question was open. It is now
closed differently for each.

**`GIFT_WEBHOOK_SECRET` (Convex) → (1), safe to remove.** The single endpoint on
the account addresses the **Worker**, not Convex. No Stripe endpoint delivers to
any Convex URL, so nothing external can be authenticating against this secret. It
has zero executable readers, and the unknown delivery history does not bear on it,
because deliveries that do not arrive at Convex cannot involve it. Both halves of
the (2) gate — no reader, no sender — are now satisfied.

**`STRIPE_WEBHOOK_SECRET` (Worker) → stays (2), do not remove yet.** A live,
enabled endpoint signs with this secret today. Removing it is *application*-safe —
`/give/*` returns `410` from a branch that reads no secret, so behaviour would not
change — but section 6 exists precisely so we do not leave a live endpoint
authenticating against a secret we have deleted. Two further reasons to hold the
order:

- delivery history is unread, so a **pending retry** cannot be ruled out;
- per section 8, the endpoint is the **only recoverable source** of this value.
  Delete the secret while the endpoint lives and the value is still recoverable by
  rolling it. Delete the endpoint first and the value is gone for good — which is
  fine, but only once we are certain we want it gone.

Sequence, unchanged from section 6: **disable the endpoint → observe → delete it →
then remove the Worker secret.** `GIFT_WEBHOOK_SECRET` no longer needs to wait on
any of that.

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

1. Confirm and preserve the live endpoint metadata already recorded in
   Section 3, then inspect the Stripe Dashboard/Workbench for recent delivery
   attempts, response codes, and pending retries for endpoint
   `we_1Tn2plLL3Uli7L4xUrsRKSpi` before any disablement.
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
