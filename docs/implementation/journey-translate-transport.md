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

### 2a. Persistence: this changes the device-local claim

The earlier plan said locale copies are device-local. With this table that is no longer the whole
truth, and the documentation is corrected rather than left to drift:

- **Guest locale copies remain device-local.** Guest translation is deferred, so a signed-out reader
  has no server-side copy at all.
- **For authenticated users, completed Journey-prose translations may be cached server-side and
  restored across signed-in browsers.** When the server-computed identity matches, a second device
  reuses the cached result with no further model call.
- **The original English completed content remains immutable** and is never stored here.
- **Reflections and prayer entries remain separate, untranslated, and are never stored here.**
- **Progress and completion remain language-neutral** and live in their existing keys and tables.

This is a genuine improvement — a person who reads on their phone and their laptop prepares a
translation once — but it must be described honestly rather than presented as still device-local.

### 2b. Atomic leadership

Leadership acquisition and the pending-row insert happen inside **one** `internalMutation`,
`claimInternal`, which is a single Convex transaction:

```
claimInternal(userId, serverKey)
  -> db.query("journeyTranslations").withIndex("by_user_key", userId + serverKey).first()
  -> if absent: db.insert({ status: "pending" })      <- same transaction as the read
```

Convex mutations are transactional with optimistic concurrency control. If two callers read "no row"
concurrently, only one commit succeeds; the other is detected as a write conflict, retried, and on
retry it observes the committed row and becomes a **joiner**. Two leaders are therefore not
representable. The read and the insert are never split across two mutations, which is the mistake that
would make this a race.

Index used: `by_user_key` on `["userId", "serverKey"]` — the same index the cache-hit read uses, so
lookup and claim contend on the same document range.

The Node harness proves the *algorithm*; the production checklist exercises the real transaction path
with three genuinely concurrent requests.

### 2c. Row lifecycle and retention

| State | Meaning | Reclaim / retention |
|---|---|---|
| `pending`, fresh | a leader is working | joiners wait; no second model call |
| `pending`, 3 min or older | leader crashed or was abandoned | next caller **takes over** as leader; `cleanupInternal` also deletes it |
| deleted after failure | leader failed | `abandonInternal` removes the row so the next attempt is a fresh leader, not a stuck joiner |
| `done` | authenticated server cache | served as a cache hit; costs no quota; retained until superseded |
| stale **source hash** | English content changed | key no longer matches, so it is never read; removable via `cleanupInternal` with `keepKeys` |
| stale **schema version** | translation contract changed | key suffix no longer matches, so it is never read; removed by `cleanupInternal` |

Quota reservations have their own independent expiry: `TRANSLATE_RESERVATION_TTL_MS` (2 minutes), with
expired holds reclaimed lazily on the next reserve, and the counter's `reserved` tally decremented too.

**Cleanup policy.** `cleanupInternal(userId, keepKeys?, dryRun?)` is ops-invoked rather than scheduled;
there is no cron in this project, and a translation cache is small enough that lazy plus manual cleanup
is honest and sufficient. Its scope is deliberately narrow: it queries and deletes **only**
`journeyTranslations` rows for one account. It never touches Journey progress, reflections, Vault data,
original completed content, active-Journey slots, usage counters or reservations — those tables are not
referenced in the function at all. It supports `dryRun` so a sweep can be inspected before it deletes.

### 2d. Server cache privacy

The `journeyTranslations` row contains app-authored translated prose and nothing else. It must not, and
by construction does not, contain: reflections, user prayer entries, Vault content, crisis disclosures,
account email, display name, the browser cache key, any authentication token, or Bible quotation text.

The stored columns are `userId`, `serverKey`, `status`, `createdAt`, `fields` (allowlisted translated
copy), `model`, `translatedAt`. `userId` is the internal authenticated account identifier, used for
ownership and indexes only — **it is never sent to the model**. The Worker receives no identifier at
all and rejects a body that carries one.

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

**Worker model boundaries**, all server-owned:

| Boundary | How |
|---|---|
| Fixed system instruction | `JT_SYSTEM`, a server constant. There is no field through which a browser could supply or influence a prompt. |
| No browser-supplied prompt | `prompt`, `systemPrompt`, `instructions` and `messages` are in the forbidden-key set and rejected with 400. |
| Structured JSON only | the model is told to return only a JSON object keyed exactly as given; output is parsed and then re-validated against the allowlist. |
| Input size ceiling | 4,000 chars per field, 12,000 total. |
| **Output size ceiling** | `JT_MAX_RESPONSE_CHARS` = 64,000 on the RAW provider response, refused before parsing. A runaway generation cannot be parsed at all. |
| **Request timeout** | `JT_TIMEOUT_MS` = 45s via `AbortSignal.timeout`. Without it a stalled provider would pin an account's single concurrent slot until the 2-minute reservation TTL reclaimed it. Returns `504 provider-timeout`. |
| Locale validation | only `en -> es`; anything else is 400. |
| No provider body in errors | every failure returns a bare reason code. No provider response, prompt, translated prose, stack trace or secret is ever echoed. |
| Logs | counts and model name only. |

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
# 0. Branch must be release-c1-monetization, clean, synchronized, containing main
git branch --show-current && git status --short && git merge-base --is-ancestor origin/main HEAD

# 1. Generate a secret used ONLY for Journey translation
openssl rand -hex 32                     # -> SECRET (never logged, never committed)

# 2. Worker secret FIRST
cd worker && npx wrangler secret put JOURNEY_TRANSLATE_SECRET

# 3. Deploy the Worker route
npx wrangler deploy

# 4. VERIFY the Worker before Convex knows about it:
#    no secret -> 403, wrong secret -> 403, right secret + bad body -> 400

# 5. Convex production configuration
npx convex env set JOURNEY_TRANSLATE_SECRET "SECRET" --prod
npx convex env set JOURNEY_TRANSLATE_URL \
  "https://hope-finder-worker.thinktoro.workers.dev/internal/journey/translate" --prod

# 6. Deploy Convex FROM release-c1-monetization, never from main
npx convex deploy --prod

# 7. Authenticated production verification with a DEDICATED TEST ACCOUNT
# 8. Confirm no Journey surface calls the action. Stop before Steps 5-9.
```

**Order matters.** The Worker goes first and is verified in isolation: the route existing before Convex
knows about it is safe, because it rejects everything without the secret. Convex goes last because it is
the caller — deploying it first would point an action at a route that has not landed.

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
