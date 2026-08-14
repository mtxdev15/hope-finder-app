# Journey translation transport — implementation, awaiting deployment approval

**Status: implemented and locally verified. NOT DEPLOYED.** No `npx convex deploy`, no
`wrangler deploy`, no production environment variable or secret was created or changed. No Journey
production surface imports or calls this transport.

---

## 1. File and schema diff

| File | Change | Lines |
|---|---|---|
| `convex/journeyTranslateCore.ts` | **new** — pure constants, allowlist validation, server hash, dedup identity. No Convex imports, so it is verifiable in plain node. | +137 |
| `convex/journeyTranslate.ts` | **new** — reserve/finalize/release, single-flight claim, the authenticated action. | +330 |
| `convex/schema.ts` | **+1 table**, `journeyTranslations`. Nothing existing modified. | +27 |
| `convex/_generated/api.d.ts` | regenerated, additive only: 4 lines registering the two modules. | +4 |
| `worker/src/index.js` | **+1 route**, `/internal/journey/translate`, plus its handler. Nothing existing modified. | +195 |
| `scripts/verify-journey-translate.ts` | **new** — 44 deterministic checks. | +130 |

Untouched: `convex/usage.ts`, `convex/entitlements.ts`, `convex/entitlementCatalog.ts`,
`convex/journeySlots.ts`, `src/pages/journey.astro`, `public/declare/journey-engine.js`, the `/today`
proxy, and every existing Worker route.

---

## 2. The new Convex table, and why it exists

```ts
journeyTranslations: {
  userId, serverKey, status: 'pending' | 'done',
  createdAt, fields?, model?, translatedAt?
}
  .index("by_user_key", ["userId", "serverKey"])
  .index("by_user", ["userId"])
```

**The row is the single-flight lock.** The first caller inserts `pending` and becomes the leader.
Concurrent callers find that row and wait rather than issuing a second model call. A `done` row is a
cache hit and costs no quota. This is why three simultaneous identical requests produce exactly one
model call.

It stores **only Journey-authored translated copy**. No reflection, no user-written prayer, no Vault
content, no Scripture — all rejected before anything reaches it, by the action and again by the Worker.

`serverKey` is computed server-side from the authenticated account, the locale pair, the normalized
allowlisted fields and the schema version. **The account is inside the key**, so two accounts with
identical content can never share a slot or a result, and a browser cannot join someone else's request
by guessing.

No other table was added. The reservation lifecycle reuses the existing `usageCounters` and
`usageReservations`, isolated by `feature: "journeyTranslate"`, so Gentle Guidance counters are never
touched and `convex/usage.ts` needed no change.

---

## 3. Authentication path

```
Browser
  └─ ctx.action journeyTranslate:translateJourneyDay   (args: fields, sourceLocale, displayLocale)
       └─ authComponent.safeGetAuthUser(ctx)           ← identity, server-side only
            └─ internal mutations (userId passed by trusted server code)
                 └─ fetch → Worker /internal/journey/translate  (X-Declare-Internal secret)
                      └─ Anthropic
```

There is **no `userId` argument** on the action, so there is nothing to spoof. Identity resolves before
anything else happens, so an anonymous caller learns nothing about configuration. Same pattern as
`convex/billing.ts`.

The internal mutations accept `userId` because they are `internalMutation` — unreachable from a browser
and callable only by trusted server code that has already resolved identity.

---

## 4. Server-side validation rules

Applied **independently in two places**: the Convex action and the Worker. One shared check would be a
single point of failure.

**Allowlist, exactly six fields:** `title`, `encouragement`, `commentary`, `prayer`, `declaration`,
`reflectionPrompt`. Anything else is *rejected*, not dropped, so a wrong payload is loud.

**Rejected outright** (case-insensitive): `reflection`, `reflectionText`, `userPrayer`, `userText`,
`userNote`, `vault`, `vaultItems`, `crisis`, `supportDisclosure`, `userId`, `accountId`, `email`, `sub`,
`identity`, `verse`, `verseText`, `scripture`, `prompt`, `systemPrompt`, `instructions`, `messages`.

**Structural:** values must be flat strings — a nested object is exactly how user content would smuggle
in, so it is refused. Max 4,000 chars per field, 12,000 total. Empty payload refused before a slot is
spent.

**Locale pair:** only `en → es`. Anything else is refused rather than defaulted.

**Model output is validated too**, with the same allowlist, plus a check that every returned key was one
we sent. The model may not invent a section and may not return Scripture. A malformed response releases
the reservation and never reaches the reader.

The Worker additionally rejects a body carrying `userId`, `accountId` or `email` at the top level, and
refuses when the secret is unset rather than allowing all.

---

## 5. Single-flight design

The authoritative identity is:

```
userId | sourceLocale | displayLocale | serverSourceHash(normalized fields) | vSchemaVersion
```

The client's browser cache key (`db_journey_locale:<instance>:day<day>:<src>:<dst>:<hash>:v1`) is
**never trusted as identity**. The source hash is recomputed server-side from the normalized allowlisted
fields.

| Caller | Outcome | Quota |
|---|---|---|
| First | leader — reserves, calls the model | 1 slot, finalized on success |
| Concurrent | joiner — polls up to 5s for the leader's result | **none** |
| Later, same content | cache hit from the `done` row | **none** |
| Joiner that times out | `translation-in-progress`, retryable | **none** |

A leader that fails calls `abandonInternal`, deleting the pending row so the next attempt is a fresh
leader rather than a joiner waiting on something that will never finish. A pending row older than 3
minutes is treated as abandoned and taken over.

**Hash parity is asserted by test.** The browser and Convex implementations are deliberately separate
(Convex bundles only `convex/`), and `scripts/verify-journey-translate.ts` imports both and compares
across six samples including quotes, commas and newlines.

---

## 6. Quota reservation lifecycle

Approved limits, as named constants in `journeyTranslateCore.ts`, not scattered literals:

```ts
MAX_CONCURRENT_PER_ACCOUNT = 1
MAX_PER_ROLLING_HOUR       = 10   // successful only
MAX_PER_ACCOUNT_DAY        = 30   // successful only
ROLLING_WINDOW_MS          = 60 * 60 * 1000
TRANSLATE_RESERVATION_TTL_MS = 2 * 60 * 1000
```

1. **Check** — concurrency from `counter.reserved`, daily from `counter.used`, rolling hour by counting
   `finalized` reservations with `resolvedAt` inside the window (scanning today's and yesterday's
   buckets so the window can cross midnight).
2. **Reserve** — increment `reserved`, insert a reservation row with `expiresAt`.
3. **Call** the Worker.
4. **Finalize** — only after a successful response that passes schema, locale, and returned-field
   validation. `reserved--`, `used++`, `successful++`.
5. **Release** — on provider failure, timeout, malformed output, validation failure, cancellation, or
   an unconfigured transport. `reserved--`, `failed++`, nothing consumed.

**Never counted:** cache hits, joined single-flight requests, rejected privacy payloads, malformed
requests, timeouts, network or provider failures, invalid model output, Scripture failures (which never
reach this path at all), cancellations.

**Abandoned reservations cannot block an account.** Every reservation carries `expiresAt`, and expired
holds are reclaimed lazily on the next reserve for that account — no scheduler needed, and the only
person who triggers the sweep is the one about to make the next request. The counter's `reserved` tally
is decremented too, not just the row status; decrementing only the row is the mistake that makes a TTL
cosmetic.

These are **invisible operational limits**, deliberately in the service layer and never in
`entitlementCatalog`, so raising a product limit can never raise an abuse ceiling. No upgrade gate, no
customer-visible allowance, no Gentle Guidance consumption.

---

## 7. Secrets and configuration

| Name | Where | Value | Notes |
|---|---|---|---|
| `JOURNEY_TRANSLATE_SECRET` | **both** Convex env and Worker secret | new random hex, 64 chars | Must be identical on both sides. Independent of every existing secret. |
| `JOURNEY_TRANSLATE_URL` | Convex env | `https://hope-finder-worker.thinktoro.workers.dev/internal/journey/translate` | Kept configurable so staging can point elsewhere. |
| `ANTHROPIC_API_KEY` | Worker | **already exists** | Reused; not created or rotated by this work. |

Generate with `openssl rand -hex 32`. The comparison is constant-time (`timingSafeEqualHex`, the helper
the Stripe webhook already uses). If either side is unset, the action returns
`translation-not-configured` and the Worker returns `403` — **fail closed, never open**.

---

## 8. Privacy-safe logging

The Worker logs shape only:

```json
{"evt":"journey_translate","fields":4,"chars":1180,"model":"claude-sonnet-4-6"}
```

No content, no account, no Scripture reference, no cache key, no IP. Nothing in that line could
reconstruct what was translated or who asked. Convex logs nothing beyond its normal function telemetry;
failures surface as returned reason codes, not logged prose.

---

## 9. Local verification results

```
node scripts/verify-journey-translate.ts   → PASSED 44/44
node scripts/verify-journey-locale.ts      → PASSED 74/74
npx convex codegen                         → exit 0 (TypeScript passed)
npm run build                              → 17 pages
```

The 44 checks cover: the six-field allowlist; rejection of unknown fields, non-strings and nested
objects; every forbidden key including case variants; size limits at and over the boundary; hash parity
between browser and server across six samples; and dedup identity, including the check that **identical
content under two different accounts produces different keys**.

**Honest scope note.** `npx convex codegen` uploads functions to the **dev** deployment
(`dev:good-dotterel-906`) as part of typechecking — that is how it validates. Production
(`keen-hamster-650`) was not touched, and no `--prod` flag was used. If dev should also stay untouched,
say so and I will avoid codegen in future.

**Not verified locally, because it needs a live deployment:** the reservation lifecycle against real
Convex documents, the Worker secret check, concurrency behaviour under genuine parallel requests, and
the model call itself. Those are section 12.

---

## 10. Failure and rollback plan

| Failure | Symptom | Action |
|---|---|---|
| Secret mismatch | every translation returns `translation-unavailable`; Worker logs 403s | Re-set both sides to the same value. No data written, no quota consumed. |
| Worker route bad | 502s | Roll back the Worker: `wrangler rollback` or redeploy the previous commit. The route is additive, so removing it restores exactly the prior behaviour. |
| Convex action bad | action errors | `npx convex deploy` from the previous commit. |
| Quota too tight | users see `translation-in-progress` or limit reasons | Constants are in one file; raise and redeploy Convex only. |
| Model output poor | Spanish quality complaints | No rollback needed — nothing is wired to a surface yet. |

**Nothing is user-visible until Steps 5 to 9 wire the surfaces.** This transport can be deployed,
observed, and rolled back with zero user impact, which is the point of deploying it separately.

The `journeyTranslations` table is additive; rolling back code leaves orphaned rows that nothing reads.
Dropping it is optional and safe.

---

## 11. Exact production deployment commands

**Do not run these yet.** Listed for approval.

```bash
# 1. Generate the shared secret once
openssl rand -hex 32                     # -> SECRET

# 2. Worker secret (interactive; paste SECRET)
cd worker && npx wrangler secret put JOURNEY_TRANSLATE_SECRET

# 3. Convex production env
npx convex env set JOURNEY_TRANSLATE_SECRET "SECRET" --prod
npx convex env set JOURNEY_TRANSLATE_URL \
  "https://hope-finder-worker.thinktoro.workers.dev/internal/journey/translate" --prod

# 4. Deploy the Worker (adds the route)
cd worker && npx wrangler deploy

# 5. Deploy Convex FROM release-c1-monetization, never from main
npx convex deploy --prod
```

**Order matters.** Secrets before code: if the Worker route deploys before its secret exists it returns
403, which is safe but noisy. Convex last, because it is the caller.

**The standing rule still applies:** production Convex and the Worker are ahead of `main`, so both
deploys must run from `release-c1-monetization`.

---

## 12. Post-deployment verification checklist

1. **Route is not browser-reachable.** From a browser console on the live site,
   `fetch('https://…/internal/journey/translate', {method:'POST'})` → **403**, and no CORS headers, so
   the response is unreadable cross-origin either way.
2. **Wrong secret → 403.** `curl -X POST -H 'X-Declare-Internal: wrong' …` → 403.
3. **Method guard.** `GET` on the route → 405.
4. **Identity refused.** POST with `{"userId":"x"}` in the body → 400 `identity-not-accepted`.
5. **Privacy rejection.** POST with `fields:{reflection:"..."}` → 400 `forbidden-field`.
6. **Signed-out action** → `not-authenticated`, and no row is written.
7. **Happy path**, signed in: returns Spanish fields with provenance; `usageCounters` for
   `journeyTranslate` shows `used: 1`, `reserved: 0`.
8. **Cache hit**: identical second call returns `cached: true` and `used` stays 1.
9. **Single-flight**: three simultaneous identical calls → exactly one `journeyTranslations` row, one
   `used`, and the other two return the same content or `translation-in-progress`.
10. **Release path**: temporarily set a bad `JOURNEY_TRANSLATE_URL`, call once → failure, and confirm
    `used` did **not** increment while `failed` did.
11. **Gentle Guidance untouched**: the `gentleGuidance` counter is unchanged throughout, and a Free
    user still has their three responses.
12. **Concurrency limit**: with one translation in flight, a second distinct translation returns
    `translation-in-progress`.
13. **No Scripture in the path**: confirm no verse text appears in any request or response.
14. **Logs**: confirm the Worker log line contains counts only — no content, no account.

---

## 13. Confirmations

- Journey production surfaces **do not import or call** this transport. Verified by grep across
  `src/pages`, `src/components`, `src/layouts` and `public/`.
- `src/pages/journey.astro`, `public/declare/journey-engine.js` and `public/declare/journey-data.js` are
  **untouched**.
- `convex/usage.ts`, `convex/entitlements.ts` and `convex/entitlementCatalog.ts` are **untouched**;
  Gentle Guidance cannot be consumed by a translation.
- The `/today` proxy and its IP rate limit are **untouched** and are not used by this path.
- No subscription, entitlement or upgrade gate exists anywhere in this transport.
- Scripture retrieval is **not** part of it; verse text is never sent to or returned from the model.
- **Nothing was deployed.** No production environment variable or secret was created or changed.
