# The billing secrets, and the live activation steps

**No secret value appears in this document. Variables are named, never read.**
No live Stripe object was created or modified while writing it, no production
Convex variable was set, and no Worker was deployed.

Companion to [billing-production-activation-readiness.md](billing-production-activation-readiness.md),
which remains the authority on *what was audited*. This document exists because
that audit named the variables without ever saying **which of them is a Stripe
secret and which is not** — and that gap is what actually blocked activation.

---

## 1. Why this document exists

Four billing secrets are in play. Three of them contain the words
`WEBHOOK_SECRET`. (Two email secrets were added later — section 9 — and one of
those looks like a third `whsec_` while belonging to a different provider
entirely.)
Exactly one of those three is a Stripe signing secret.

The failure this prevents: pasting a `whsec_...` into `BILLING_WEBHOOK_SECRET`.
That variable is not a Stripe secret and never was — it is a shared password
between our own Worker and our own Convex deployment. A `whsec_` placed there
is not rejected, not logged and not obviously wrong. It simply stops matching
the Worker's copy, and every webhook delivery fails with a 401 that looks like
a Stripe problem.

| Variable | What it actually is | Set on | Shape |
|---|---|---|---|
| `STRIPE_BILLING_WEBHOOK_SECRET` | Stripe's signing secret for the billing endpoint | **Worker only** | `whsec_…` |
| `BILLING_WEBHOOK_SECRET` | A password **we generate**. Proves the caller is our Worker. | **Worker and Convex — identical value** | random, **never** `whsec_` |
| `STRIPE_WEBHOOK_SECRET` | Legacy. Referenced nowhere in the repo. | Worker — stale, remove | `whsec_…` |
| `GIFT_WEBHOOK_SECRET` | Legacy donations. Unrelated to subscriptions. | Convex prod | — |

## 2. The chain, and where each secret is read

```
Stripe  --signs with STRIPE_BILLING_WEBHOOK_SECRET-->  Worker  /billing/webhook
Worker  --header x-billing-secret: BILLING_WEBHOOK_SECRET-->  Convex /billing/subscription-event
```

- `worker/src/index.js:475` — refuses unless `STRIPE_BILLING_WEBHOOK_SECRET`,
  `CONVEX_SITE_URL` and `BILLING_WEBHOOK_SECRET` are all present.
- `worker/src/index.js:493` — verifies Stripe's signature over the **verbatim**
  request bytes, with a defensive `.trim()`.
- `worker/src/index.js:513` — forwards the untouched payload with
  `x-billing-secret`.
- `convex/http.ts:132` — compares that header to its own `BILLING_WEBHOOK_SECRET`
  by exact equality. Mismatch or absent → `401`.

Convex never verifies a Stripe signature. The Worker never holds a Stripe API
credential (rule C5). Neither variable belongs on the other side.

### Reading a failure

| Symptom | Cause |
|---|---|
| `400 Invalid signature` | `STRIPE_BILLING_WEBHOOK_SECRET` wrong, or carries whitespace |
| `500 Downstream error` | the two `BILLING_WEBHOOK_SECRET` values differ |
| `500 Webhook not configured` | a Worker variable is absent |
| `503 Billing not configured` | Convex has no `STRIPE_SECRET_KEY` |

## 3. Two corrections to the readiness document

**The event set is eight, not seven.** §3 of the readiness doc omits
`invoice.payment_action_required`. The authority is `convex/http.ts:59-68`,
which that document itself says to check at activation time rather than trust:

```
checkout.session.completed        customer.subscription.deleted
checkout.session.expired          invoice.paid
customer.subscription.created     invoice.payment_failed
customer.subscription.updated     invoice.payment_action_required
```

**`PUBLIC_BILLING_ENABLED` does not exist.** No such variable is read anywhere
in this repo. Adding it to Cloudflare Pages has no effect. The purchasing gate
is the source constant `PRICING_ENABLED` in
`src/app/declare/plan-display.js:266`, so opening purchasing is a commit and a
deploy — not a dashboard setting.

## 4. Read-only diagnosis

Neither command writes anything.

```bash
npx convex env list --prod          # inspect BILLING_WEBHOOK_SECRET's value
cd worker && npx wrangler secret list   # names only; values are never printed
```

- Convex's `BILLING_WEBHOOK_SECRET` begins with `whsec_` → wrong value, replace it.
- `STRIPE_BILLING_WEBHOOK_SECRET` present on Convex → wrong side, remove it.
- Either absent from Convex → expected; production holds no billing variables yet.

Never reuse `GIFT_WEBHOOK_SECRET`. Donations and subscriptions are different
products, and one compromised integration must not hand over the other —
`convex/http.ts:51`.

## 5. Ordered steps

Each stage is separately authorized; do not merge stages. The full rationale
for each live-mode setting is in the readiness document §3 and §6.

### Stripe, live mode

1. Product **Declare Plus** with two recurring Prices. The amounts are fixed by
   what the page displays — `pricing.astro:95` and `:261` — and a mismatch
   makes the page state a price Stripe will not charge:
   **$8.99/month** (`lookup_key: plus_monthly_usd_v1`) and
   **$79.99/year** (`lookup_key: plus_annual_usd_v1`).
   The lookup keys matter: `convex/plusPlans.ts:155-161` approves a Price by ID
   *or* by lookup key, so classification survives a momentarily wrong env var.
2. Customer Portal per readiness §3 — plan switching, quantity and pause all
   **off**; cancel at period end **on**.
3. Failed-payment customer emails **on**, and Smart Retry's final action chosen
   deliberately. Nothing else tells a subscriber their card failed.
4. Restricted key, live: Customers r/w, Checkout Sessions w, Subscriptions r,
   Invoices r, Portal Sessions w, Prices/Products r. **No Test Clock.**
5. New webhook endpoint → the production Worker's `/billing/webhook`, API
   version `2026-06-24.dahlia` (`convex/stripeApi.ts:26`), all eight events
   from §3 above. Capture its signing secret.
6. **Disable** the legacy donation endpoint. It targets `/give/webhook`, which
   `worker/src/index.js:765-773` answers with `410 Gone`, so it has been
   accruing failed deliveries. Disable, not delete — reversible.

### Platform

```bash
openssl rand -base64 32          # this becomes BILLING_WEBHOOK_SECRET

npx convex env set STRIPE_SECRET_KEY             "…" --prod
npx convex env set STRIPE_PLUS_MONTHLY_PRICE_ID  "…" --prod
npx convex env set STRIPE_PLUS_ANNUAL_PRICE_ID   "…" --prod
npx convex env set BILLING_WEBHOOK_SECRET        "…" --prod

cd worker
npx wrangler secret put STRIPE_BILLING_WEBHOOK_SECRET   # the whsec_ from step 5
npx wrangler secret put BILLING_WEBHOOK_SECRET          # same value as above
```

Type values at the prompt rather than piping them: a trailing newline from a
pipe is invisible in every dashboard and fails verification identically to a
wrong secret. Confirm `SITE_URL` is the canonical domain — every Checkout and
Portal return URL is built from it (`convex/billing.ts:51`).
`CONVEX_SITE_URL` needs no change; `worker/wrangler.toml` already pins it.

### Deploy and verify

Capture the Worker version id first, so rollback has an explicit target.
Deploy Convex, then the Worker. Then send a test webhook from the new endpoint
and require a **200**, reading any other status against the table in §2.

A test webhook grants no entitlement — it carries no real subscription. It
proves the secret chain and nothing more.

### Afterwards, as its own step

Remove `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from the production
Worker. Both are referenced nowhere in its source and contradict rule C5. Two
unused live Stripe secrets on an internet-facing service is avoidable exposure.
Not folded into activation — readiness §4 records the same finding.

## 6. Only our own Checkout can grant Plus

`classifyPlusSubscription` (`convex/plusPlans.ts:134-189`) requires provenance
metadata that only `createCheckoutSession` stamps: the canonical plan key, the
schema version, the source marker, the userId, and an environment derived from
the API key's own prefix.

So a subscription created by hand in the Stripe Dashboard, or through a Payment
Link, is **rejected** and grants no entitlement. Every real subscription must
come through the application's own Checkout. This is deliberate — it is what
makes a retired recurring gift distinguishable from Plus, since both are
`mode: subscription`.

## 7. The public CTA is not wired on `main`

`/pricing` renders a disabled "Plus launches soon" button. Wiring it is **not**
merely flipping `PRICING_ENABLED`: as of `c44f8c0` the enabled branch fires an
analytics event and nothing else, and the only caller of
`createCheckoutSession` in the repo is `src/pages/dev/[control].astro`, which
`getStaticPaths` excludes from every production build.

That wiring exists, reviewed and inert, on branch
`claude/billing-pricing-cta-stage6`. It is deliberately unmerged: production is
currently incapable of starting a Checkout **structurally**, and merging trades
that guarantee for a runtime flag. Nine assertions across four suites enforce
the structural invariant and must each be rewritten — not relaxed — when it
lands. That belongs at Stage 6, after the real-money smoke test, which runs
through `/dev/billing-sandbox` and needs none of it.

## 8. `EXTRA_TRUSTED_ORIGIN` — the fifth variable, and the only temporary one

Not a secret. It holds no credential and grants no access to Stripe. It is
listed here because it lives beside the four secrets in the same Convex
environment list, and because it is the **only** variable in this system that is
meant to be deleted rather than kept.

**What it does.** `convex/auth.ts` builds Better Auth's `trustedOrigins` — the
list of websites allowed to begin a sign-in — from `SITE_URL`, one entry. If
`EXTRA_TRUSTED_ORIGIN` is set, exactly one more origin is appended. Unset, the
list is unchanged, so the variable's absence is its safe state.

**Why it exists.** The live billing smoke test needs a real Checkout started by
our own code, as a real production user. The only caller of
`createCheckoutSession` is the dev control, which `getStaticPaths` excludes from
every production build and which therefore exists only under `npm run dev` — so
the browser doing the test is on `http://localhost:4321`. Better Auth's
`formCsrfMiddleware` sees a browser `fetch`'s `Sec-Fetch-*` headers, calls
`validateOrigin(ctx, forceValidate: true)`, and refuses that origin with
`FORBIDDEN / INVALID_ORIGIN`.

That refusal is correct. It is not a bug and must never be "fixed" by disabling
the origin check, widening the check to a pattern, or hardcoding `localhost`
into `trustedOrigins`. Any of those would widen every deployment, permanently
and invisibly. One env var, absent by default, keeps the widening deliberate and
visible in the deployment's own environment list.

**Set it:**

```bash
npx convex env set EXTRA_TRUSTED_ORIGIN "http://localhost:4321" --prod
```

**Remove it — the same day:**

```bash
npx convex env remove EXTRA_TRUSTED_ORIGIN --prod
npx convex env list --prod | grep EXTRA_TRUSTED_ORIGIN   # must print NOTHING
```

No redeploy is needed either way; Convex reads environment variables at call
time, so both take effect on the next sign-in attempt.

**Exposure while set.** Narrower than it first sounds. Browsers set the `Origin`
header themselves, so a remote attacker's page cannot forge
`http://localhost:4321` — an attacker would need the victim to be running a
hostile app on that exact port on their own machine. The real risk is
**forgetting to remove it**, leaving production's auth list widened for months.
`TODO.md` therefore blocks **C2** — the flag flip that lets money move — on the
grep above printing nothing.

**It does not affect where a local dev server points.** That is decided only by
`.env.development.local` (dev-mode-only, gitignored) on the developer's own
machine. Deleting that file returns local development to the dev Convex
deployment. The normal develop-then-push loop is unchanged by any of this.

---

## 9. The two email secrets — a different chain entirely

Added 2026-08-26 with the failed-payment emails. **Neither is a billing secret,
and the distinction is the point of putting them here rather than leaving them
uncatalogued.**

| Variable | Lives in | Looks like | Read by |
|---|---|---|---|
| `RESEND_API_KEY` | Convex only | `re_…` | the Resend component, when sending |
| `RESEND_WEBHOOK_SECRET` | Convex only | `whsec_…` (svix) | the Resend component, verifying an inbound event |

**`RESEND_WEBHOOK_SECRET` starts with `whsec_` and has nothing to do with
Stripe.** That prefix is svix's convention, which Stripe also uses; three of the
four billing secrets already look alike, and this makes a fifth lookalike. It is
issued by **Resend**, pasted into **Convex**, and pairing it with the Stripe
endpoint — or vice versa — produces signature failures on both.

**The Worker holds neither, and this is not an exception to rule C5.** C5 exists
because the Worker is the public edge in front of a money path and must never
hold a Stripe credential. Resend's events are not a money path: the component
verifies svix's signature itself, so routing them through the Worker would add a
hop and a second copy of a secret to buy nothing. `/resend/email-event` is
therefore a direct Convex route, and the only route in this system that is.

**Both fail closed.** No `RESEND_API_KEY` and every send throws — the sequence is
silent, which is the worst outcome here and the reason it is worth checking
explicitly rather than assuming. No `RESEND_WEBHOOK_SECRET` and inbound events
are rejected before any handler runs: delivery goes unrecorded, and the
bounce-suppression logic has nothing to read. Neither failure is loud on its own,
so both are listed as launch steps in `TODO.md` → *Next up* rather than trusted
to be already set.
