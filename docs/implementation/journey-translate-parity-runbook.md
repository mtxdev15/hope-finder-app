# Backend parity deployment — Journey translation transport

**Status: PREPARED, NOT RUN.** Nothing in this document has been executed. No
Worker or Convex deployment happened in the checkpoint that wrote it.

Production last received this transport on **2026-08-14** from
`release-c1-monetization` at commit `ea1695d`. Three later commits changed the
backend. This runbook closes that gap.

---

## 1. What production is missing

Verified by diffing the deployment point against the branch, not by counting
commits:

```
git diff --stat ea1695d..HEAD -- worker/ convex/
```

| File | Change | Deployed by |
|---|---|---|
| `convex/journeyTranslateCore.ts` | allowlist corrected to the twelve real day fields; `LOCALE_SCHEMA_VERSION` 1 → 2 | Convex |
| `convex/journeyTranslate.ts` | same allowlist; joiner wait 5s → 48s | Convex |
| `worker/src/index.js` | `JT_ALLOWED_FIELDS` corrected to the same twelve | Worker |
| `worker/wrangler.toml` | adds the `[env.dev]` block | **neither** — dev-only config |

**`convex/schema.ts` is unchanged.** No table, field, or index changes are
involved, which is what makes the rollback boundary clean.

The localized Scripture-reference correction (`154a662`) touches only
`src/app/declare/journey-locale/review-controller.js` and `src/pages/journey.astro`.
It is **client-only** and has no backend component, so it is not part of this
deployment.

---

## 2. Compatibility — why Worker first is safe

The old allowlist and the new one share exactly one member:

```
old: title, encouragement, commentary, prayer, declaration, reflectionPrompt
new: title, insight, prayerTitle, pray, castOff, repent,
     declare, reflect, actionTitle, action, fruit, fruitTruth
```

Only `title` is in both. The old names never matched the real day object, which
is the bug commit `7d0c767` fixed.

| Order | Result |
|---|---|
| **Worker updated, Convex still old** | The old action can only ever produce `title`, because the other five old names do not exist on a day. The new Worker allows `title`. Behaviour is identical to today. **SAFE.** |
| **Convex updated, Worker still old** | The new action sends `insight`, `pray`, `castOff` and the rest. The old Worker allowlist rejects every one of them with a 400. Every translation fails. **UNSAFE.** |

**Worker first is required, not merely preferred.**

Both Convex changes ship in a single `convex deploy`, so the allowlist fix and
the joiner fix cannot separate. That matters more than it looks:

> Production's recorded single-flight evidence (1 leader + 2 joiners, one model
> call) passed because the translation took **2.05s** — it was only translating
> `title`. With the corrected allowlist the same call translates twelve fields
> and measures **6.5s to 9.6s**, which exceeds the old **5s** joiner ceiling.
> The joiner defect was latent in production and would have become real the
> moment the allowlist fix landed alone. Deploying Convex as one unit avoids it.

Nothing here is user-visible either way: no Journey surface calls this transport
in production. The ordering protects the smoke test and any future enablement,
not a live flow.

---

## 3. Runbook

Every command runs from the repo root on `release-c1-monetization`. Steps 3 and
5 need a real TTY and must be run by Jeff.

### Step 1 — confirm the branch is clean and contains main

```bash
git checkout release-c1-monetization
git status --short                      # expect no tracked changes
git fetch origin
git merge-base --is-ancestor origin/main HEAD && echo "contains main"
git log --oneline -1                    # expect 59f87b2 or later
```

### Step 2 — Worker dry run

```bash
cd worker
npx wrangler deploy --dry-run --env=""
```

Expected bindings, which prove production config is untouched by the dev block:

```
env.BIBLE_KV (823458f407a74de29402b6e88bba5a1e)   KV Namespace
env.CONVEX_SITE_URL ("https://keen-hamster-650.convex.site")
```

If `BIBLE_KV` shows `0e4340248f204654b611e2fe3ee212ba`, you are targeting dev.
Stop.

### Step 3 — deploy the production Worker (TTY)

`--env=""` is explicit on purpose. Now that `[env.dev]` exists, a bare
`wrangler deploy` prints a warning about an unspecified environment; the empty
string names the top-level environment unambiguously.

```bash
npx wrangler deploy --env=""
```

Expected: worker name `hope-finder-worker`, a new version id, 100% deployed.
**Record the new version id.**

Do **not** pass `--env dev`; that redeploys `hope-finder-worker-dev`.

### Step 4 — verify Worker authorization and controlled errors

The route is authenticated; these confirm it rejects correctly without needing a
valid secret.

```bash
W=https://hope-finder-worker.thinktoro.workers.dev/internal/journey/translate
curl -s -o /dev/null -w "no secret   -> %{http_code}\n" -X POST "$W" \
  -H 'content-type: application/json' -d '{"fields":{"title":"x"}}'
curl -s -o /dev/null -w "wrong secret-> %{http_code}\n" -X POST "$W" \
  -H 'content-type: application/json' -H 'x-journey-secret: wrong' -d '{"fields":{"title":"x"}}'
curl -s -o /dev/null -w "GET         -> %{http_code}\n" "$W"
```

Expected `403`, `403`, `405`. Error bodies must carry reason codes only, with no
provider detail, prompt text, or secret.

Also confirm the unrelated Bible route still works, since the same Worker serves it:

```bash
curl -s -o /dev/null -w "bible -> %{http_code}\n" \
  "https://hope-finder-worker.thinktoro.workers.dev/bible?translation=rvr1909&book=PSA&chapter=56"
```

### Step 5 — deploy production Convex (TTY)

`convex deploy` has **no** `--prod` flag. With `CONVEX_DEPLOYMENT` set it targets
the project's production deployment, prompts for confirmation, and needs a TTY.

```bash
cd ..
npx convex deploy
```

Expected: deploys to `keen-hamster-650`, TypeScript passes, schema validated,
**no indexes added or deleted** (schema is unchanged since the last deploy).

Never run this from `main`; main does not contain the transport.

### Step 6 — authenticated backend smoke test

Sign in as a real account on production and, from the browser console on
declareandbelieve.com, call the action directly. This exercises the deployed
Convex action against the deployed Worker.

Verify:

- a first request returns `ok: true` with twelve translated fields and full provenance;
- a repeat returns `cached: true`;
- three simultaneous identical requests return **one** distinct `translatedAt`,
  identical fields, and `cached: false` for exactly one of them;
- a payload containing `reflection` is rejected as `forbidden-field`, non-retryable;
- an unknown field is rejected as `unknown-field`, non-retryable.

The third bullet is the one this deployment is for. Before the joiner fix it
would fail as soon as the allowlist fix landed.

Then delete any rows the smoke test created, through the Convex dashboard, and
confirm `journeyTranslations` and the `journeyTranslate` usage counter are back
to their prior state. Prefer a disposable account over a personal one.

### Step 7 — confirm the frontend still does not call the transport

```bash
npm run build
grep -rlF "translateJourneyDay" dist/ | wc -l    # expect 0
grep -rlF "db_journey_locale"   dist/ | wc -l    # expect 0
grep -rlF "journey-locale"      dist/ | wc -l    # expect 0
```

The transport stays inert. **No Cloudflare Pages deployment is required or
wanted** — this is a Worker and Convex change only, and the frontend is
unchanged by it.

### Step 8 — stop

Do not enable the completed-day review. Do not begin the Fruit Log.

---

## 4. Rollback boundary

No schema or index changes are involved, so rollback is pure code with no data
migration.

| Component | Rollback |
|---|---|
| Worker | `npx wrangler rollback --env=""`, or target the last known-good version `0b04fae3-570c-4294-af0c-f405831aba57` (deployed 2026-08-14T04:55:30Z, confirmed live via `wrangler deployments list`) |
| Convex | `git checkout ea1695d && npx convex deploy` (TTY), then return the working tree to the branch head |

The schema-version bump from 1 to 2 is safe in both directions and is not a
migration. The version is part of the server cache key, so rows written under
one version are simply never read under the other. They are inert rather than
corrupt, and `cleanupInternal` removes stale-schema rows. Nothing is rewritten
and nothing is lost.

Rolling the Worker back while Convex stays updated re-creates the unsafe pairing
in section 2, so roll back **Convex first**, then the Worker.

---

## 5. What this deployment does not touch

Confirmed by the file list in section 1: the diff contains only
`journeyTranslate.ts`, `journeyTranslateCore.ts`, `worker/src/index.js` and the
dev-only `[env.dev]` block.

No change to Stripe, StoreKit, pricing, subscriptions, donations, entitlements,
usage counters outside the `journeyTranslate` key, Gentle Guidance, the Vault,
the Bible route, or any Journey behaviour a user can currently reach.
