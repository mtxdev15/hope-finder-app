# Declare & Believe — Open Items

A running list of work to continue on the site. Newest priorities at the top of each section.
Done items move to the bottom or get deleted.

## 🔧 In progress / immediate
- [ ] **Worker source parity (same hazard class as the Convex divergence).** `worker/src/index.js`
      on `main` still carries the retired `/give/*` handlers, including the billing-portal IDOR
      that searched Stripe customers by a browser-submitted email. Production runs the hardened
      Worker deployed from `release-c1-monetization`. The Convex parity branch deliberately does
      not touch this. Until it is reconciled, `wrangler deploy` from `main` would roll production
      backwards into those vulnerabilities. See
      `docs/operations/convex-production-parity-audit.md`.
- [ ] **Improvements deferred out of the Convex parity port.** The parity branch ports production
      logic **verbatim** — nothing was tidied on the way through, on purpose, because a parity
      port whose behaviour differs is not a parity port. Candidates noticed while reading the
      deployed source, to be evaluated separately and never inside a parity change:
      `journeyTranslate.ts` and `usage.ts` each carry their own reservation lifecycle and could
      share one; `entitlementCatalog.ts` limits are literals rather than configuration; the
      `journeySlots` release path rejects unknown statuses with a generic `invalid-status` that
      does not say which values are valid.
- [ ] **RELEASE PROCESS — a local build is not release evidence.** Vite loads `.env.local`
      and `.env` during `npm run build`, so a build made with either present bakes in the
      **development** Convex and Worker URLs. That build runs fine and is useless as evidence,
      because it is not the bundle Cloudflare Pages produces. It has already cost one full
      39-item matrix, which had to be re-run against a clean checkout before it could be
      trusted. Release evidence must come from **either** a Cloudflare Pages build whose
      relevant public values have been *compared* to production (not assumed equal), **or** a
      clean worktree with neither env file, given the exact production public values. Run
      `node scripts/check-release-build-env.ts` before capturing evidence; it exits non-zero
      when the tree cannot produce a clean build. Record the commit built, the build
      environment, the public variables compared, the asset names, the catalog URL and the
      lazy chunk names. See the evidence section of PR #11 for a worked example.
- [ ] **Better Auth re-persists its own cookie key (non-blocking, observe only).** After
      `endSession()` clears `better-auth_cookie`, the library writes it back from its own
      `get-session` response, so the key can reappear. Since PR #13 this is **inert**: no
      Convex token is minted without a session, so the reappearing key produces no requests,
      no 401s and no console errors — verified across five consecutive loads in production.
      Do **not** add cookie-fighting logic or override the library's storage. Revisit only if
      the key later causes real requests, identity leakage, a retry loop, or anything a
      reader can see.
- [ ] **GUARDRAIL — completed Journey content is immutable.** Any restore or migration capable of
      changing canonical completed content must use **persisted** completion state
      (`db_journey_lock` and `db_active_journey`, taking the higher value) and must pass a
      byte-for-byte completed-content preservation fixture before production. Do not derive
      completion from `state.day`: it is assigned *after* `restoreInstance()` runs, so during restore
      it reads `1` and reports zero completed days. That is exactly how a shipped release replaced
      walked-day content that could not be recovered — see
      `docs/operations/journey-completed-day-data-loss.md`.
- [ ] **Recurring expired-session 401 in production (noticed repeatedly during Journey verification,
      2026-08-19/20).** `keen-hamster-650.convex.site/api/auth/convex/token` returns 401 on page load
      once a session has aged, and it appears in the console every time. The app degrades correctly —
      it falls back to guest, the Spanish review shows the guest notice rather than erroring, and
      nothing user-visible breaks — so this is **not blocking**. But an unexplained 401 sitting in
      production console output indefinitely makes real errors harder to notice, and it may mean
      sessions are expiring sooner than intended. The endpoint is not a literal anywhere in `src/`
      (it comes from the better-auth client), so start at `src/app/declare/auth-store.js` and the
      token-refresh path. Decide whether the correct outcome is a silent refresh, a quiet re-auth, or
      simply not logging an expected 401.
- [ ] **Mast avatar icon may be redundant nav (raised during Release B / B2.2, 2026-07-29).** Jeff
      flagged the circular profile/avatar icon in the top-right mast (`DeclareLayout.astro`, shared
      sitewide, every page, both languages) as possibly making no sense alongside the bottom "You"/"Tú"
      tab — if both lead to the same account destination, that's duplicate navigation. Needs: confirm
      what the mast avatar actually links to/does on each page today vs. the You tab, then decide
      remove vs. repurpose. Sitewide change (not Journey-specific) — deserves its own pass, not a
      same-turn patch.
- [ ] **Journey day content doesn't always match the active language (found during Release B / B2.2,
      2026-07-29).** With Spanish active, the Day-Opening screen (and identically, the pre-existing
      "Today's Journey" card on `/journey` — confirmed both show the exact same English title/verse
      in the same test) can show English day title/verse/encouragement while the surrounding UI chrome
      is correctly Spanish. Root cause: that content only gets rewritten in Spanish by the Journey
      Worker's AI call (`ensureDay()` in `journey.astro` → `journey-engine.js`); if that call fails or
      hasn't resolved yet, it silently falls back to the English authored bank regardless of active
      language (by design — no error surfaced). Confirmed pre-existing, not introduced by B2.2. Not
      touched here — the original Release B brief explicitly protects `journey-engine.js`/the Worker
      from changes without separate approval. Needs investigation into why the AI call isn't
      completing (at minimum in local dev — unclear yet if this also happens in production).
- [ ] **"Preview tomorrow" shouldn't be a live production button (found during Release B / B2.2,
      2026-07-29).** The Journey lock-note's `#lnPreview` button (`src/pages/journey.astro`) lets any
      user tap past the one-day-per-day pacing lock (`db_journey_lock`) and unlock the next day
      early — undercutting the "faithfulness, not speed" design intent. The original Release B
      Journey prompt explicitly called for this to be "a development/testing affordance, not a
      normal production CTA," but it currently renders unconditionally with no gating. Fix: hide it
      from production (dev-console-only, or a `?debug=1`-style flag) and keep `previewTomorrow()`
      reachable for QA.
- [x] **Journey Step 6 reflections are never actually saved (found during Release B / B2.2,
      2026-07-29; implemented as B3.3, 2026-07-30).** ~~The "Reflect" textarea in the seven-step day
      flow always rendered blank with just a placeholder — nothing read or wrote it to storage.~~
      B3.3 built the approved (corrected) model: a debounced local draft autosave while typing
      (restores after refresh/close/resume, never sent to Vault or Convex), an explicit "Save
      Reflection" action that durably saves to the Vault (new `journeyReflection` item type,
      mirrored to Convex for signed-in users like every other Vault item), draft-vs-saved conflict
      recovery, and read-only display in completed-day review. Step 6 is now gated on a successful
      save, same as steps 3/4/5. An optional AI "Gentle Guidance" response (with its own consent
      flow) remains explicitly deferred to B3.4 — B3.3 only persists the reflection, it doesn't
      interpret it.
- [ ] **Lead magnet: free declarations download (PAUSED — needs Jeff's 4 answers).** Replace the
      weak "early access" band at the bottom of `/welcome` (and 15 other pages, the `fsignup`/`nlForm`
      block) with a free PDF download offer. Today the form redirects to a broken `Signin.html` and
      captures nothing. Plan: (a) redesign the section into a free-download offer (copy + impeccable
      design); (b) backend capture — new Convex `leads` table + an unauthenticated http endpoint that
      stores the email and sends the PDF via Resend (mirror `convex/email.ts`); (c) rebuild the
      "Declare Who I Am" PDF from `~/Downloads/declare-who-i-am-build-spec.md` with edits, host under
      `public/declare/downloads/`. **PDF edits:** name Jeff Toro → Jeff Martinez / "Jeff, Founder of
      Declare"; remove "I am a millionaire in formation…" under Financial; add "(skip if you are a
      woman)" to Husband; add a Women section (Wife/Mother/Woman of God); make universal sections
      gender-neutral; replace the closing "To God be the glory. Always." (never-use line).
      **4 decisions still needed:** 1) PDF structure (neutral core + men's sections + new women's
      sections, recommended); 2) intro voice (reframe to Declare, drop Righteously Unrighteous,
      recommended); 3) delivery (instant download + email, recommended); 4) keep the list for the iOS
      launch (recommended). Generate the PDF via headless-Chrome print (no new deps).
- [ ] **Finish Google OAuth branding (Google Auth Platform → Branding).** App published to production
      (auth fixed). Still: set App name = Declare, support email, home page, privacy `/privacy`, terms
      `/terms`; authorized domains cleaned (added declareandbelieve.com, removed stale Supabase domain).
      Logo upload + Google verification deferred (logo triggers a review). Until verified, the consent
      screen may still show the convex.site domain instead of "Sign in to Declare." Cosmetic, not a blocker.

## Deferred — Stripe sandbox checkout and subscription validation

**Paused at a verified checkpoint, 2026-08-21.** Everything below is sandbox-only.
Nothing in live mode has been created or touched. Full record in
`docs/operations/stage-2-sandbox-billing.md`; PR #20 is the active review surface.

### Completed

- [x] Stripe sandbox account confirmed: **Declare checkout dev** (`acct_1TmENuLShxhb4mBz`)
- [x] Sandbox Product created: `prod_V6voPpxBKesWPc`
- [x] Monthly Price created: `price_1U6hytLShxhb4mBzduppVOya` — 899 usd/month
- [x] Annual Price created: `price_1U6i0TLShxhb4mBzAldYiOcA` — 7999 usd/year
- [x] Sandbox webhook endpoint created: `we_1U6iKwLShxhb4mBzE0uOMDR2`
      - targets the **isolated dev Worker**:
        `https://hope-finder-worker-dev.thinktoro.workers.dev/billing/webhook`
      - API version pinned to **`2026-06-24.dahlia`**
      - forwards to Convex dev deployment **`good-dotterel-906`**
- [x] Dev Worker version verified: **`95ca744d-71c4-4fe7-b505-e5ddcefe0d96`**
- [x] `checkout.session.expired` verified end to end: **HTTP 200 `ok`**
- [x] Provider-neutral Stripe / App Store entitlement architecture documented
      (`docs/architecture/cross-platform-subscriptions.md`)
- [x] Recurring-donation contamination bug fixed (C2). A recurring gift is also
      `mode: subscription`, so mode alone could have granted Plus to a donor
- [x] Stripe API access moved entirely into Convex (C5). One credential, one
      runtime, one pinned API version
- [x] Worker reduced to signature verification and event forwarding. It holds no
      Stripe credential
- [x] Webhook signature diagnostics added and deployed
- [x] PR #20 remains the active Stage 2 review surface
- [x] **Resume step 1 — development-only authenticated monthly checkout control**
      (`src/pages/dev/[control].astro`, dev URL `/dev/billing-sandbox`).
      `billing.createCheckoutSession` now has exactly one caller. Two gates keep
      it out of production: a dynamic route that generates zero pages, and an
      inline-literal `import.meta.env.DEV` check that Vite folds away. Proven by
      `scripts/verify-billing-dev-control.ts` (98 checks) against a **hostile**
      build made with `PUBLIC_BILLING_DEV_CONTROL=1`. Nothing has been clicked.

### Intentionally not completed

None of these are oversights. Each is a deliberate stop.

- [ ] No checkout control exists in production. The dev-only one has never been
      clicked, so it has created nothing
- [ ] No Stripe Customer has been created
- [ ] No real Checkout Session has been created through the app
- [ ] No Subscription or invoice has been created
- [ ] No test payment has been completed
- [x] Sandbox Billing Portal **configuration** is complete and verified
      (2026-08-22, §6.12.1) — active default, sandbox-only
- [ ] No Portal **session** has been created or opened. Configuration is not
      validation: return to `/you`, cancellation, payment-method updates and
      invoice history are all still unexercised
- [ ] No annual Checkout Session has been created. The annual dev control now
      exists (resume step 6d); the annual Price has never been exercised
- [ ] No cancellation has been performed and no payment failure has been
      simulated
- [ ] No production billing CTA is enabled — the pricing page CTA is still a
      disabled "Opening soon" button
- [ ] No live Stripe Product, Price, webhook or secret has been created
- [ ] No StoreKit or App Store Connect product has been created

### Resume point

When Stage 2 resumes, in this order:

1. ~~**Build a development-only authenticated monthly checkout control.**~~
   **DONE.** `src/pages/dev/[control].astro`. Enable with
   `PUBLIC_BILLING_DEV_CONTROL=1 npm run dev`, then open
   `http://localhost:4321/dev/billing-sandbox`. The browser sends only
   `{ plan: 'plus-monthly' }`; the user, the Price and the Customer all resolve
   server-side in Convex. See `docs/operations/stage-2-sandbox-billing.md` §6.
2. **Create one sandbox monthly Checkout Session through the actual app**, not
   through the API directly. The point is to exercise the real path.
3. **Complete a test subscription payment.**
4. **Capture real payloads** for the pinned API version.
5. **Verify against those payloads:**
   - Checkout Session ownership
   - Customer mapping
   - subscription period fields
   - invoice-to-subscription relationship
   - metadata provenance
   - cancellation state
   - entitlement activation
6. ~~**Narrow the provisional webhook field readers.**~~ **DONE.** Narrowed
   against the real payloads captured at step 3, not from memory:
   `readPeriod` now reads only `subscription.items.data[0]`, and
   `readInvoiceSubscriptionId` only
   `invoice.parent.subscription_details.subscription`. The Checkout Session
   reader and all cancellation fields were unchanged, because the captured
   payloads showed neither moved. `verify-plus-classification.ts` grew 44 -> 96
   checks and the new assertions were mutation-tested. See
   `docs/operations/stage-2-sandbox-billing.md` §6.9.
6b. ~~**Add the duplicate-subscription webhook guard.**~~ **DONE.** A webhook
   for a DIFFERENT Stripe subscription id can no longer replace a nonterminal
   one for the same user. The checkout-time guard in `billing.ts` could not
   cover this: a Session minted before the first subscription existed stays
   payable for 24 hours, and completing it later produces a second real
   subscription that guard never saw — after which `applyWebhook` would have
   repointed the canonical row in place, leaving one tidy Convex row reading
   Plus while Stripe billed twice. The guard lives in `applyWebhook`, the one
   mutation that writes the `subscriptions` table, with the decision in the
   dependency-free `convex/subscriptionGuard.ts`. Conflicts leave the canonical
   row untouched, record `outcome: "duplicate-subscription-conflict"` on the
   event, log for alerting, and return 200 so Stripe stops retrying.
   `verify-duplicate-subscription-guard.ts`, 71 checks, mutation-tested both
   ways. **It protects Convex state; it does NOT cancel or refund a duplicate
   Stripe charge** — that remediation is manual and documented in
   `docs/operations/stage-2-sandbox-billing.md` §6.10.

   *Further Checkout Session testing is now unblocked by this guard, but the
   remaining items below are still outstanding.*
6c. ~~**Build the checkout return pages.**~~ **DONE.** `/checkout/success` and
   `/checkout/cancelled` exist; a completed payment no longer lands on a 404.
   The success page treats `session_id` as UNTRUSTED — it observes only that
   the parameter exists, strips it from the visible URL with
   `history.replaceState`, and never renders, stores, logs or sends it.
   Confirmation comes only from `getMyEntitlements`, polled on a bound (~2s
   interval, ~30s cap, single-flight, stops when hidden or confirmed).
   `paymentNeedsAttention` never renders as success, and the timeout state
   explicitly says not to pay again. The cancelled page is inert: no Convex or
   Stripe call, never auto-retries, and allowlists `?plan=`. Neither page
   activates public billing. `verify-checkout-return-pages.ts`, 118 checks,
   mutation-tested. See `docs/operations/stage-2-sandbox-billing.md` §6.11.
6d. ~~**Prepare the annual, Portal and lifecycle controls.**~~ **DONE — built
   and tested, never exercised.** Three controls on `/dev/billing-sandbox`:
   annual Checkout (`{ plan: 'plus-annual' }` and nothing else), Billing Portal
   (an **empty** payload — Convex resolves the Customer from our own mapping),
   and a read-only lifecycle inspector that renders an allowlist projection so
   no Stripe identifier can reach the screen. Annual did not fork the Checkout
   path: one implementation, the plan typed as a closed two-member union, the
   alias a hardcoded literal at each call site. `createPortalSession` already
   existed and already met every requirement, so no Convex change was needed —
   only a caller and the tests that pin it.
   `verify-billing-lifecycle-controls.ts` (149 checks) plus
   `verify-billing-dev-control.ts` (98 -> 136), four mutations applied and each
   caught. See `docs/operations/stage-2-sandbox-billing.md` §6.12.

   **Nothing here has been run against Stripe.** No annual Session, no Portal
   session, no cancellation, no payment failure, no deployment.

   **Do not exercise annual on the account holding the active monthly
   subscription.** Convex refuses a second purchase and the webhook guard
   refuses to repoint the row, but **neither cancels or refunds** — Stripe would
   still bill twice. Use a separate sandbox QA account, or wait until the
   monthly subscription is genuinely terminal.

   *Known gap:* `getMyEntitlements` does not surface `cancelAtPeriodEnd`, so a
   scheduled cancellation still reads as `active` in the inspector. Confirm
   cancellation in the Stripe Dashboard. Surfacing that field is an
   entitlement-contract change, deliberately out of scope.
7. ~~**Configure and read back the Stripe sandbox Billing Portal settings.**~~
   **DONE 2026-08-22.** The active default configuration exists in **Declare
   checkout dev** and was verified through read-only Stripe API responses:
   `active=true`, `is_default=true`, `livemode=false`, one configuration
   returned. Plan switching and quantity updates disabled, cancellation enabled
   at `at_period_end`, cancellation reasons enabled, payment-method updates
   enabled, invoice history enabled. Retention coupons are
   **NOT EXPOSED BY READ API** — they are a Dashboard deflection feature and do
   not appear on the configuration object, so absence was not read as proof.
   `proration_behavior` is `none`, correct for end-of-period cancellation.
   Full result in `docs/operations/stage-2-sandbox-billing.md` §6.12.1.

   `is_default` matters because `createPortalSession` sends no `configuration`
   parameter, so Stripe uses the account default.

   **Configuration is not validation.** Everything below is still outstanding.

8. **Validate the Portal and the rest of the lifecycle.** **Portal smoke
   testing is COMPLETE (2026-08-22, §6.12.2); Portal lifecycle validation is
   NOT.** One session was created through the app, the hosted page rendered the
   configured controls, and the return to `/you` worked. Nothing was cancelled,
   changed or paid. The remaining items:

   - [x] deploy the PR #23 code to Convex development after merge
         (2026-08-22, `good-dotterel-906`)
   - [x] create and open one sandbox Portal session (2026-08-22, §6.12.2)
   - [x] verify Portal return to `/you` — exact path, no Stripe id appended,
         session survived
   - [x] verify the Portal resolves the authenticated user's server-side
         Customer mapping — browser sent `{}`; the deployed action accepts
         `lang` only
   - [x] verify invoice-history visibility (present, not opened)
   - [x] verify payment-method management control visibility (present, not used)
   - [x] verify cancellation control visibility (present, not used)
   - [x] **schedule cancellation at period end** — done 2026-08-22 through the
         Portal; the subscription is scheduled to end September 21, 2026 (§6.12.2,
         §6.16)
   - [x] **verify a post-fix `customer.subscription.updated`** — one genuinely new
         event (new provider event id, `outcome: applied`) generated by a
         same-state `cancel_at` reassertion. The two earlier events were NOT
         replayed: they are idempotency keys and would have been deduplicated
   - [x] **verify `cancelAtPeriodEnd=true` in Convex** — the deployed normalizer
         resolved `cancel_at === currentPeriodEnd` to `true` (§6.16)
   - [x] **verify active Plus access remains through period end** — status stays
         `active`, tier stays Plus, period end unchanged
   - [x] **verify `/you` renders the cancellation-scheduled state** — "Cancels
         September 21, 2026", chip reads ENDING, "Renews" absent
   - [x] **verify `/you` removes renewal language** — confirmed absent
   - [x] **verify pricing keeps Plus as current plan and blocks duplicate
         Checkout** — "Your current plan", CTA hidden and disabled, zero enabled
         purchase controls
   - [ ] verify the subscription remains active for the entire remaining period
   - [ ] verify terminal `customer.subscription.deleted` at the real period end
   - [ ] verify access changes at terminal cancellation
   - [x] **commit the regenerated `convex/_generated/api.d.ts`** — done
         2026-08-22. Regenerated from merged main with `npx convex codegen`, so
         `stripeCancellation` is now represented in the generated module map.
         Two lines: one `import type` and one entry in `fullApi`. It adds **no
         remotely callable Convex function** — the module exports only ordinary
         TypeScript helpers and declares no query, mutation, action or HTTP
         action, and the deployment still attributes zero functions to it. No
         deployment was required: `convex codegen` writes local files only.
   - [x] **actually update a payment method** — DONE 2026-08-22 (§6.18), on the
         **annual QA account**; the monthly subscriber was untouched and is
         byte-identical. One Portal session, one replacement, sandbox Visa →
         sandbox Mastercard, no real card. The subscription-level
         `default_payment_method` override was **cleared** and the customer
         default now points at the new method, so the next annual invoice
         resolves to it (Acceptable result B). No charge, no new invoice, no
         refund or credit, renewal date unchanged.
         *Note:* clearing the override fired a real `customer.subscription.updated`
         webhook (`billingEvents` 9 → 10, `outcome: applied`), which changed only
         `lastProviderEventAt` / `updatedAt` on the canonical row. Expected and
         benign — that type is subscribed because cancellation needs it.
   - [x] **open or download an invoice** — DONE 2026-08-23 UTC (§6.19), on the
         **annual QA account**; the monthly subscriber was untouched and its
         invoice history was never opened. One Portal session (browser payload
         `args:[{}]`, zero provider identifiers), the one existing paid annual
         invoice opened once, and exactly one invoice PDF downloaded. The
         **receipt was deliberately not downloaded**. The PDF was validated
         outside the repository and then deleted along with every extracted
         byte; nothing was retained.
         Stripe is field-identical before and after — Customers 2, Subscriptions
         2, Invoices 1, PaymentIntents 1, Checkout Sessions 1, credit-note
         amounts 0, `next_invoice_sequence` still 2. Convex is byte-identical in
         all seven tables and **`billingEvents` stayed at 10**: reading an
         invoice fires no subscribed webhook at all.
         *Limit:* PDF **text** could not be validated from the command line — no
         `pdftotext`/`pdfinfo`/`mutool`/`qpdf`/`pypdf` here, and the browser
         blocks `file:`. Amount, paid state, cadence and period are recorded
         from the hosted invoice page and the Stripe API instead. See [[§6.19]].
   - [ ] verify payment-failure / payment-attention behaviour
         **Design locked 2026-08-23** — see
         `docs/implementation/billing-test-harness-brief.md`. Route is a Test
         Clock fixture on a third disposable QA account, driven by a
         development-only Convex harness. The ownership contract needs no
         change: a directly-created Customer + Subscription carrying the five
         provenance fields binds through the same trusted path Checkout uses,
         and `applyWebhook` creates both the mapping and the canonical row
         itself. The harness exists only because the MCP exposes no Test Clock,
         PaymentMethod, or Invoice write operations.
         *Sandbox recovery policy, read 2026-08-23:* Smart Retries, up to 8
         retries in 2 weeks, first retry dynamic, **final action cancel**,
         failure emails disabled, no active automations. Because the final
         action is cancel, an over-advanced clock destroys the fixture — hence
         the standing rule: advance only to the first renewal attempt, require
         `attempt_count=1`, read `next_payment_attempt`, and recover before
         advancing again.
         **Execution-readiness audit complete 2026-08-23** — runbook at
         `docs/operations/billing-test-harness-execution-readiness.md`. The
         harness remains disabled, undeployed (0 of 47 deployed functions are
         `testHarness`), and unexecuted. Separate authorization is required to
         set either flag, deploy to development, or create the disposable
         account.
         **Harness implemented behind gates 2026-08-23; execution NOT started.**
         See `docs/implementation/billing-test-harness-brief.md` §13. Both flags
         are unset, nothing was deployed, and no Stripe object exists from it.
         266 verification checks, mutation-tested against 12 regressions.
         **BLOCKED as originally planned** — audited 2026-08-23 UTC (§6.20), no
         Stripe write made. A one-off $1.00 invoice cannot exercise this path,
         for two independent reasons in the shipped code:
         (1) `readInvoiceSubscriptionId` reads only
         `invoice.parent.subscription_details.subscription` and never invoice
         lines, so a one-off invoice resolves to `null` and `http.ts` ACKs before
         `applyWebhook` — no `billingEvents` row, no state change;
         (2) `paymentNeedsAttention` is a pure function of the stored
         subscription **status** (`past_due`/`unpaid`), and the webhook writes
         status from the live *subscription*, never the invoice — a failed
         one-off invoice leaves the annual subscription `active`.
         Neither is a defect; both are deliberate fail-closed design. The path is
         reachable only by genuinely moving a subscription to `past_due`. Next
         attempt should use a **Stripe test clock on its own throwaway QA
         subscription**, which leaves both existing subscribers untouched.
   - [x] **surface entitlement state and add a billing entry point** — DONE
         2026-08-22 (§6.13). `getMyEntitlements` now returns `periodEndAt`,
         `cancelAtPeriodEnd` and `billingInterval`; `/checkout/success` welcomes
         confirmed subscribers; `/you` has a persistent Plan & Billing card at
         `#plan-billing` with a click-only, single-flight Manage billing button;
         `/pricing` reflects the authenticated current plan and stays
         non-transactional. One shared interpreter
         (`src/app/declare/plan-display.js`) so the three surfaces cannot drift.
         `verify-subscription-visibility.ts`, 374 checks, four mutations caught.
         **No Stripe lifecycle test was performed.**
   - [x] **test annual Checkout with a separate sandbox QA account** — DONE
         2026-08-22 (§6.17), on commit `203a800` against `good-dotterel-906`.
         No Convex redeploy was needed. Subchecks:
         - [x] successful annual sandbox payment ($79.99/year, test card, one
               Checkout Session, one submit that actually charged)
         - [x] webhook ingestion — `checkout.session.completed`,
               `customer.subscription.created` and `invoice.paid`, each with a
               new provider event id and `outcome: applied`, no conflicts
         - [x] annual entitlement — `planKey: plus_annual`, `tier: plus`,
               `status: active`, `billingInterval: year`,
               `cancelAtPeriodEnd: false`, period end present
         - [x] account display — `/you` shows "Annual plan · Renews August 22,
               2027", non-gold PLUS badge, benefits, Manage billing
         - [x] pricing behaviour — Plus marked current, duplicate Checkout
               blocked, zero enabled purchase controls
         - [x] Portal visibility — annual subscription, $79.99/year, matching
               renewal date, paid invoice, no plan switching or quantity
         **The monthly subscriber was not used and is byte-identical.**
         Public billing remains intentionally inactive: `/pricing` has no annual
         control, so the existing development-only control was used.
   - [ ] production Portal activation

   **Do not use the current active monthly subscriber for annual Checkout.**
   Convex refuses a second purchase and the webhook guard refuses to repoint the
   row, but **neither cancels or refunds** — Stripe would still bill twice. Use a
   separate sandbox QA account, or wait until that monthly subscription is
   genuinely terminal. Note that end-of-period cancellation leaves it `active`
   until the period actually ends, so cancelling does not free that account
   quickly.

### Account experience

- [x] **Plus identity badge is no longer gold** (2026-08-22, §6.14). Root cause
      was a `.ybadge` class collision with the church-finder "Home" marker, not
      the colour written; the badge now has its own `.yplus` class. Verified by
      COMPUTED browser values in both themes, not CSS source.
- [x] **`/you` redesigned to the hybrid hierarchy** — identity, Plan & billing,
      Your Formation, Account, Experience, Privacy & support, Mobile app, Sign
      out. One centred column, grouped rows, every existing capability kept.
- [x] **Your Formation added** — built only from existing data
      (`db_active_journey`, vault `listItems()`, `db_journeys_done`) and linking
      only to existing routes. No streaks, scores, XP or achievements.
- [x] **Local visual verification passed** across 390 / 1024 / 1440 in light and
      dark, plus checkout success and pricing (§6.14).
- [x] **Final visual verification from merged main** (2026-08-22, commit
      `2408b5d`, §6.15). Badge computed non-gold in both themes, hierarchy
      verified by measured position, Plan & Billing / Your Formation / grouped
      settings all pass, 1440 / 1024 / 390 in light and dark, checkout-success
      and pricing regressions green. **No Convex redeploy was needed — PR #26
      contained no Convex code.**
- [ ] Spanish `/you` and `/pricing` verified in-browser — still skipped, because
      switching locale writes Convex data via `userdata:set`
- [ ] Signed-out success and pricing verified in an isolated browser context

### Guardrails

- Do not reuse archived donation Products, Prices, sessions or metadata. Seven
  archived gift sessions and two archived gift Products remain in the sandbox and
  are permanent negative test fixtures, not building material.
- Do not point sandbox webhooks at the production Worker.
- Do not put `STRIPE_SECRET_KEY` in Cloudflare. Its absence from the Worker is
  asserted by `scripts/verify-plus-classification.ts`.
- Do not enable production checkout without a separate live-promotion approval.
- Preserve cross-platform entitlement support for future iOS StoreKit purchases.
- Keep Stripe and Apple as billing **providers**. Convex remains the entitlement
  source of truth.


## ✅ Verify on the live site (manual)
- [ ] **Auth round-trip** on declareandbelieve.com: email sign-up, email sign-in, Google sign-in,
      password-reset email (Resend).
- [ ] **Entry flow** on a phone: new visitor sees Begin → tap Begin → `/today`; revisit `/` same day
      skips to `/today`; signed-in always skips; menu → "How it works" → `/welcome`.

## 🚀 Next features
- [ ] **Navigation IA Migration — Bible · Journeys · Declare · Saved · You.**
      Status: **approved and deferred.** Begin after the current Spanish Journey surface
      work is complete and stable. Documentation-only for now; no navigation code, labels,
      routes, analytics, SEO, GTM or Search Console changes have been made.

      **Sequencing decision — 2026-08-21.** Do **not** begin this migration inside PR #20
      or during the current billing and type-check cleanup. Finish the Stage 2
      billing/type-check plan first. After PR #20 is merged or otherwise closed, create a
      dedicated navigation planning branch. This is in addition to the Spanish-Journey
      gate above, not a replacement for it.

      Five things must be settled on that branch **before any implementation begins**:

      1. Reconcile this route map with the approved app.declareandbelieve.com split plan
         below — they currently disagree (see finding 2).
      2. Decide the canonical account route: `/you` or `/profile`.
      3. Decide the canonical authentication route: `/signin` or `/login`.
      4. Include `/journey`→`/journeys` and `/vault`→`/saved` in the final unified map;
         the app.* plan predates both and omits them.
      5. Resolve the `/declare` static-asset namespace collision before renaming
         `/today`→`/declare` (see finding 1).

      The eventual migration must be **coordinated across all of it in one pass**: English
      and Spanish tab labels; page and file routes; one-hop permanent redirects; active
      states and accessibility; internal and deep links; Journey-resume and Saved-content
      links; authentication **and billing** return paths; canonical, hreflang, sitemap,
      robots, metadata and Open Graph URLs; GTM, GA, funnels, conversions and historical
      analytics mapping; Cloudflare redirects and Search Console verification; and mobile
      tab bar, tablet rail and desktop sidebar parity. The detailed requirements for each
      are already specified further down this item — this list is the scope, not a second
      copy of the spec.

      One dependency worth naming because nothing else records it: Stage 2 billing builds
      Checkout `success_url` and `cancel_url` from `SITE_URL` in `convex/billing.ts`, and
      those point at `/checkout/success` and `/checkout/cancelled`, which do not exist as
      routes yet. Whoever builds those routes and whoever renames routes are touching the
      same return-path surface, so the billing return paths must be part of the unified
      map rather than discovered afterwards.

      **Changing only Word→Bible or Vault→Saved is not implementation and is not
      completion.** (Restated here because it is the tempting subset; the guardrail at the
      end of this item says the same thing.)

      The **mast-avatar duplicate-navigation question** (see "🔧 In progress / immediate")
      stays a separate sitewide decision. Do not bundle it into this route migration or
      into the current type-cleanup work.

      **Approved tab bar:** Bible · Journeys · Declare · Saved · You

      **Intended route migration:** `/word`→`/bible`, `/journey`→`/journeys`,
      `/today`→`/declare`, `/vault`→`/saved`, `/you` stays `/you`.

      **Two things found while recording this, both of which change the audit:**

      1. **`/declare` is not a page route — it is the static asset directory.**
         `public/declare/` holds ~30 shipped assets (`atmosphere.css`, `card-studio.js`,
         `i18n-strings.js`, `theme.js`, and the rest), all served from `/declare/*` and
         referenced from versioned `<script>`/`<link>` tags across every page. Renaming
         `/today`→`/declare` puts a page route on top of that prefix. Resolve this BEFORE
         any rename: either move the assets to a different prefix (a cache-busting event
         for every returning reader, so it needs its own version bump plan) or choose a
         different Declare destination. The brief's "prevent route collision between the
         current Declare experience and /today" is really this.
      2. **An already-approved plan disagrees with this one.** The
         app.declareandbelieve.com split below specifies `/you`→`/profile` and
         `/signin`→`/login`; this migration keeps `/you` and is silent on `/signin`. It
         also predates `/journey`→`/journeys` and `/vault`→`/saved`. **Reconcile the two
         into one route map before either starts** — whichever ships first will make the
         other's redirect matrix wrong.

      **Required pre-implementation audit.** Before changing code: audit the existing
      `/declare` prefix and the declaration flow; prevent the collision above; inventory
      every English and Spanish navigation label; inventory every internal link, deep
      link, authentication return URL, Journey resume link, saved-content link and
      external link; inventory canonical URLs, hreflang, sitemap entries, structured data,
      page metadata, Open Graph URLs and robots behaviour; inventory GTM triggers,
      variables, lookup tables, analytics events, funnels, conversions, content groups and
      dashboards; prepare the Search Console migration checklist; prepare the Cloudflare
      redirect matrix; preserve historical analytics mapping where practical.

      **Accessibility and UX requirements.** 44×44 minimum targets; visible active state;
      `aria-current` on the active destination; accurate screen-reader labels; keyboard
      navigation; reduced-motion behaviour; light and dark parity; mobile tab bar; tablet
      rail; desktop sidebar; no duplicate navigation landmarks; no duplicate page-level
      headings.

      **Redirect requirements.** Every replaced public URL redirects permanently in ONE
      hop: `/word`→`/bible`, `/journey`→`/journeys`, `/today`→the approved Declare
      destination, `/vault`→`/saved`. Also cover trailing-slash variants, Spanish
      equivalents, nested legacy routes, query parameters, safe deep-link state, canonical
      tags, sitemap entries and internal links. No chains, no loops.

      **Three mandatory sweeps.**
      - [ ] **Sweep 1 — source and configuration.** Search the whole repository for `Word`,
        `Journey`, `Today`, `Vault`, `/word`, `/journey`, `/today`, `/vault` and the Spanish
        equivalents and route variants. Classify every hit as intentionally retained,
        redirect compatibility, historical documentation, unrelated natural-language use,
        or a defect requiring conversion.
      - [ ] **Sweep 2 — built output and runtime.** Build and serve production output.
        Verify new labels, new URLs, one-hop redirects, no broken links, no redirect loops,
        correct active state, canonical, hreflang and sitemap, correct English and Spanish
        behaviour, no stale user-facing labels, and no stale routes in generated HTML or JS.
      - [ ] **Sweep 3 — external systems.** Audit and update GTM, Google Analytics, Search
        Console, Cloudflare routing, sitemap submission, external links, documentation,
        screenshots, emails and notifications, browser history and bookmarks, and
        authenticated return paths. Repeat the full repository search and produce a final
        legacy-match report.

      **Deliverables.** (1) route and navigation inventory; (2) `/declare` collision
      decision; (3) final route map; (4) English and Spanish prototypes; (5) redirect
      matrix; (6) SEO migration plan; (7) GTM and analytics migration plan; (8) Search
      Console checklist; (9) implementation commits; (10) three completed sweep reports;
      (11) production verification; (12) rollback and post-launch monitoring plan.

      **Guardrails.** Do not combine with Fruit Log or another Spanish Journey surface. Do
      not remove legacy routes without redirects. Do not rename routes before resolving
      the `/declare` prefix. Do not mark complete after changing labels only. Do not leave
      analytics, SEO, Spanish routes or external systems behind. Do not accept completion
      until all three sweeps pass.

- [ ] **i18n release hardening (from the two bugs found closing Release B).**
      - [x] **Harness evaluates the catalog instead of text-matching it.** Done in Release
        B. `scripts/verify-journey-locale.ts` now executes `i18n-strings.js` and asserts on
        the resulting object. The bug it missed: sixteen ported keys sat inside an
        unterminated `/* */` block, so the file parsed, the keys were plainly visible, and
        the Spanish review silently rendered its English fallbacks. A substring check is
        true whether or not a key survives parsing. Confirmed by reintroducing the bug and
        watching the suite fail.
      - [ ] **Release check: the i18n asset version MUST change when the catalog changes.**
        `i18n-strings.js` is loaded from a versioned URL (`?v=3.21.0`) from
        `src/layouts/DeclareLayout.astro` and `src/pages/index.astro`. Release B added
        sixteen keys without bumping it at first; every returning reader would have kept
        the stale catalog and seen the Spanish review in English — a release-day bug that
        reads as a translation failure rather than a caching one. Make this mechanical:
        fail the build or the harness when `public/declare/i18n-strings.js` changes and the
        `?v=` stamp does not.
      - [ ] **Verify the deployed page references the new versioned catalog URL.** A
        post-deploy assertion that the live HTML carries the expected `?v=`, and that
        fetching it returns the expected key count. Both halves matter: the stamp can be
        right while the file is stale behind a CDN.

- [ ] **Split the app onto app.declareandbelieve.com (studied Psalmlog's app.psalmlog.com
      structure as the reference).** Full architecture + phase breakdown lives in
      `.claude/plans/please-use-the-skills-shimmying-wombat.md` — plan approved 2026-07-16,
      not yet started. Goal: `declareandbelieve.com` stays the marketing/SEO site,
      `app.declareandbelieve.com` becomes the actual app, with `/today`→`/declare`,
      `/word`→`/bible`, `/you`→`/profile`, `/signin`→`/login` (all real URL renames with
      redirects). One Cloudflare Pages project, both domains attached, a new
      `functions/_middleware.ts` does Host-based routing — no repo restructuring, no second
      build pipeline. Do the 7 phases below **in order, one at a time**, verifying each
      before moving on:
      - [ ] **Phase 1 — add `app.declareandbelieve.com`** as a custom domain in Cloudflare
        Pages on the existing Pages project (zero risk, mirrors current site, nothing on
        `declareandbelieve.com` changes).
      - [ ] **Phase 2 — add a no-op `functions/_middleware.ts`** (pure passthrough) to prove
        Cloudflare Pages Functions work before adding real routing logic.
      - [ ] **Phase 3 — fix the relative `/welcome` link** in `DeclareLayout.astro` and
        `index.astro` (currently breaks on `app.*` since it's a relative link).
      - [ ] **Phase 4 — wire up auth for the new domain.** `convex/auth.ts` `trustedOrigins`
        needs to support both origins; update Convex dashboard `SITE_URL` on dev
        (`good-dotterel-906`) first, test Google + email sign-in on `app.*`, then repeat on
        prod (`keen-hamster-650`). Also verify Google Cloud Console "Authorized JavaScript
        origins."
      - [ ] **Phase 5 — rename the 4 routes on `app.*` only** (no real traffic there yet):
        `today.astro`→`declare.astro`, `word.astro`→`bible.astro`, `you.astro`→`profile.astro`,
        `signin.astro`→`login.astro`. Update `TabBar.astro`, `auth-modal.js`'s default
        `?return=` target, `create-account.astro`/`reset-password.astro` cross-links. Click
        through the whole app on `app.*` to confirm nothing 404s.
      - [ ] **Phase 6 — update canonical/OG tags** in `DeclareLayout.astro` and `index.astro`
        to the new `app.*` base (accepted risk: could re-trigger Google's OAuth branding
        review, per Jeff's call).
      - [ ] **Phase 7 — the actual cutover (needs Jeff's explicit go-ahead).** Add
        Host-conditional single-hop 301s in `functions/_middleware.ts` sending old
        `declareandbelieve.com` routes straight to their final `app.*` names (e.g.
        `/today`→`app.declareandbelieve.com/declare`). Excludes `/crisis` and `/` — crisis
        must never depend on a redirect, and root-domain `/` is a separate later decision.
        Expect a temporary Search Console ranking dip on `/declare` and `/bible` (both
        currently indexed) for 1–2 weeks post-redirect — normal, not a break.
      **Not part of this project:** journaling, paywalls, or any Psalmlog product features —
      only the domain/routing structure is being adopted. Comparison report + a
      `/declare-vs-psalmlog` page, and a Mobbin-referenced dashboard/marketing redesign, are
      separate follow-on efforts (references saved in the plan file).
- [ ] **iOS app (Capacitor, same repo).** Decided 2026-07-02: wrap the existing web app with
      Capacitor rather than rewriting native — `npx cap add ios` creates an `ios/` folder Xcode opens
      directly; web changes flow with `npm run build && npx cap sync`. Prereq: Apple Developer Program
      ($99/yr, JC Kingdom Ventures). Bundle assets locally + add native touches (push notifications
      for Journey reminders, haptics, splash, Sign in with Apple) so App Review doesn't see a bare
      wrapper. Also drop the real store IDs into `rate.js` at launch (see Polish).
- [ ] **Performance round 2 (from the 2026-07-02 infra audit; round 1 shipped in v3.17.0).**
      Ranked leftovers: (a) **long-term asset caching** — version the remaining unversioned
      `/declare/*` references (declare.css, motion.css, route-loader.css, brand images, tree JPEGs),
      set `_headers` to `max-age=31536000, immutable` for `/_astro/*` + versioned `/declare/*`, then
      flip the Cloudflare zone Browser Cache TTL to "Respect Existing Headers" (never before versioning
      — an unversioned ref under immutable = sticky stale); (b) **GTM delay** to window.load + idle
      (~122 KB br off first paint; Jeff to accept slight undercount of instant bounces); (c) **fonts**
      — self-host latin-subset woff2, preload the 2 critical faces, metric-override fallback (kills the
      FOUT reflow); (d) **tree JPEGs → WebP** (~1 MB → ~300 KB); (e) `modulepreload` for the shared
      auth/module chain; (f) split `journey-data.js` (294 KB) per struggle, fetch on demand; (g) drop
      the unused `react()` Astro integration (193 KB dead build output); (h) compress `brand/og.png`
      (582 KB, unfurls only).
- [ ] **Spanish for NEW content (the launch itself is DONE, v3.16.0).** Standing rules as the site
      grows: every new English struggle page ships with its `/es` twin (hreflang + sitemap + luchas
      hub row); every new app string gets a `data-i18n` key or an `esLock()`/`esW()` ternary; every
      What's-new entry is bilingual (`['New', en, es]`); any changed `/declare/*.js` bumps its `?v=`
      at every load site (4h browser cache otherwise serves stale).
- [ ] **(Optional, later) Email verification via magic-link.** Dropped for now (simple sign-up).
      If re-added, use a magic-link flow (it can carry a session cross-domain; plain email-confirm
      links can't). The email template is still in `convex/email.ts`, dormant. Also add a DMARC DNS
      record then to keep verification emails out of spam.
- [ ] **`bible-verses-for-*` SEO cluster.** The `bible-verses-for-anxiety` landing was deferred
      because it links to 6 sibling pages that don't exist yet (control, depression, fear,
      overthinking, stress-and-burnout, waiting-on-god). Build the cluster, then ship the landing.
- [ ] **Build out SEO struggle pages for the remaining chips — one new page per week.** 15 of 35
      struggles have a `/public/<slug>.html` page (each with an `/es/` twin); ~20 remain. The weekly cadence is deliberate: a
      steady publishing rhythm signals to Google that the site keeps adding fresh content. Each new
      page copies the `public/anxiety.html` template exactly (GTM analytics `GTM-T65GXR22`, fixed
      header/nav + slide-out menu + footer, `.rv` scroll reveals, `data-atmos` atmosphere zones), with
      researched pastoral content written **real and raw** for the 3am reader, and 12 FAQs targeting
      what people actually ask across Google + the AI engines (ChatGPT, Perplexity, Copilot, Gemini,
      Apple AI, Claude) with a matching `FAQPage` JSON-LD, plus a curated Related Articles block.
      Verse citations deep-link into the in-app `/word` reader, and each verse has a "Break this down"
      commentary popup (shared `public/declare/commentary.{js,css}`, breakdown text kept in the DOM for
      SEO). Register each page in `public/struggles.html` + `public/sitemap.xml`, and backfill Related
      Articles links on existing pages so internal linking stays complete. **Process each week:**
      search-intent research → Claude drafts content → Jeff approves → build → ship → re-submit
      sitemap. Check off each chip as it ships.
      - **Batch 1 (high search / need):** [x] Overthinking (shipped 2026-07-01) · [x] Stress & Burnout
        (shipped 2026-07-02, EN `/burnout` + ES `/es/estres-y-agotamiento`) · [x] Rejection & Abandonment
        (shipped 2026-07-15 as a 3-page mini-cluster, see below) · [ ] Addiction · [ ] Waiting on God
      - [ ] **Suicidal Thoughts** — build crisis-first: lead with the 988 Suicide & Crisis Lifeline
        (help before content, visible immediately), hope-first non-triggering copy, reuse the app's
        existing 988 banner pattern. Confirm final copy with Jeff before shipping.
      - **Remaining:** [ ] Comparison · [ ] Feeling Unworthy · [ ] Broken Identity ·
        [ ] People Pleasing · [ ] Emotional & Verbal Abuse · [ ] Betrayal · [ ] Self-Sabotage ·
        [ ] Family Conflict · [ ] Divorce / Separation · [ ] Control · [ ] Perfectionism ·
        [ ] Spiritual Dryness · [ ] Sexual Temptation · [ ] Faith Crisis ·
        [ ] Feeling Spiritually Attacked · [ ] Drifting from God ·
        [ ] **Parental Abandonment** (added 2026-07-15, not one of the original 33 chips — a real,
        searched, previously-uncovered wound: a parent, often a mother, who gave a child up or never
        wanted them; shipped as part of the Rejection & Abandonment batch below, kept in this list as
        a permanent addition to the backlog going forward)
      - **Next up:** Addiction, then Waiting on God, then Betrayal (unchanged order — betrayal/
        infidelity/"a partner who's been lying to me" content stays queued for the dedicated Betrayal
        page rather than pulled forward).
      - **AEO requirements for every new page (added 2026-07-13):** keyword-first H1
        ("Keyword — emotional line"), `Article` JSON-LD, a line in `llms.txt`, sitemap entry with
        reciprocal EN/ES hreflang, then after deploy: ping IndexNow (key `8ae6ca7f…` at site root)
        and Request Indexing in GSC.

## 🎨 Polish / ongoing
- [ ] **Homepage SEO watch.** `/` is the (thin) Begin page; the keyword-rich `<noscript>` block
      is preserved for crawlers. Monitor that the homepage keeps its indexing.
- [ ] **Add a logo to the Google consent screen** once you're ready for Google's brand verification
      review (separate, multi-day). Makes the sign-in screen show your mark + "Sign in to Declare."
- [ ] **Giving copy: confirm the yearly option.** The rest of the old give copy/ratio pass shipped
      ("set free" wording, per-person impact counter, Giving terms FAQ, tax disclosure), but a yearly
      giving option was never clearly confirmed as live. Verify it exists on `/give`, or add it.
- [ ] **Real store IDs in `public/declare/rate.js`.** The Rate & Review flow still ships with
      placeholder App Store / Play IDs (`TODO dev` at `rate.js:24`). Drop in the real IDs before the
      iOS launch so the "rate us" links point somewhere.
- [ ] **Re-submit the sitemap** to Google Search Console after any big sitemap change to force a
      re-read (initial submit already succeeded).

## ✔️ Recently shipped
*App is on **v3.20.2**. Newest first.*
- **Real Stripe billing portal, replacing the static email-login page (2026-07-16, branch
  `fix/billing-portal`, from Jeff's report that clicking "Manage giving" and entering his
  email never delivered a login link).** Root cause: every "Manage giving" link sitewide
  (EN + ES — give.html footer, the post-gift thank-you screen, `you.astro`'s giving card,
  both give-terms FAQ pages) pointed at the same static Stripe-hosted login page, which
  emails a magic link with no idea the visitor was already signed in on our own site.
  Signed-in users now get a real Stripe Billing Portal session opened server-side with
  zero email step: new Worker endpoint `/give/portal` resolves the Stripe customer via a
  3-tier fallback (stored `customerId` → live subscription lookup → Stripe customer search
  by account email, since gifts recorded before this fix have no `customerId` on file),
  then opens the portal directly. Convex's `giftHistory` now stores `customerId` from the
  webhook going forward (`gifts.ts`, `http.ts`, new `by_user_and_recurring` index). Native
  `alert()` error states replaced with inline, on-brand messaging that keeps
  support@declareandbelieve.com as a visible fallback. FAQ pages repointed from the static
  Stripe URL to the working button; help/give-terms pages now set a "we typically respond
  within 1-2 business days" expectation for support@. Also ran a full `/email-marketing-bible`
  audit: DKIM and the Resend `send.` subdomain were already correctly configured (no fix
  needed); DMARC is intentionally monitor-only (`p=none`) for now — revisit `p=quarantine`
  once a few weeks of clean reports confirm nothing legitimate fails; mail (incl. support@)
  routes through Apple's iCloud Custom Email Domain, not this codebase, so a true automated
  auto-reply would require moving MX to Cloudflare Email Routing — deferred as a separate
  project, not done here. Verified end-to-end (give.html + es/dar.html share the same
  `give.js`, `you.astro`'s card uses the identical fetch), Cloudflare Pages preview reviewed
  and approved by Jeff, merged to main and confirmed live on declareandbelieve.com.
  **Known follow-up:** the Stripe email-search fallback found no customer matching
  `jeffmt15_social@icloud.com` (the email from Jeff's original screenshot) — need to confirm
  which email Jeff's actual recurring gift is recorded under in the Stripe Dashboard to
  verify his own account resolves cleanly.
  **Not done in this pass (Stripe Dashboard settings, not code):** Settings → Billing →
  Customer portal — enable current plan/payment method/invoice history/cancel, keep
  cancellation to one click with no required reason, and set the portal's business name +
  logo to match "Declare and Believe." Also a known limitation: donors can't change their
  monthly amount from inside the portal yet (checkout builds an ad-hoc price rather than a
  saved Stripe Price) — they can cancel and start a new gift at a different amount instead.
- **Rejection & Abandonment mini-cluster — 3 struggle pages, 6 URLs (2026-07-15, branch
  `content/rejection-abandonment-cluster`).** Instead of one general page, shipped three
  distinct, non-overlapping pages after Jeff named three real, unserved pains: `/rejection`
  (general rejection, Psalm 27:10 anchor), `/parental-abandonment` (a parent, often a
  mother, who gave a child up or never wanted them — Jeremiah 1:5, Psalm 139:13-14, Psalm
  68:5, coda Romans 8:15, adoption theme; NOT one of the original 33 chips, added
  permanently to the backlog), `/feeling-unloved-in-marriage` (feeling unwanted by your
  own spouse inside an intact marriage, distinct from `marriage.html`'s betrayal/divorce
  content — anchored on Proverbs 30:23, which literally names "an unloved woman" as one
  of four things the earth cannot bear, plus Isaiah 54:5, Psalm 55:22, coda Psalm 34:18;
  FAQ carries an explicit "when to seek counseling" note so the page never reads as "endure
  mistreatment quietly"). Each has an ES twin (`/es/rechazo`, `/es/abandono-de-padres`,
  `/es/no-amado-en-el-matrimonio`) with genuine RVR1909 verse text pulled from the site's
  own Bible worker (never fabricated or paraphrased — verified every citation, including
  catching that Proverbs 30:23's "unloved" wording only appears in the WEB translation
  among the site's supported versions, not NLT/NIV/KJV). All 6 pages follow the AEO rules:
  keyword-first H1, `Article` + `FAQPage` JSON-LD, registered in `struggles.html`/
  `luchas.html` (CollectionPage/ItemList) and `sitemap.xml` with reciprocal hreflang and
  `llms.txt`. Backfilled reciprocal Related Articles links on `shame`, `loneliness`,
  `church-hurt`, `marriage` (EN + their ES twins where that pattern already existed).
  Betrayal/infidelity content stays deliberately out of scope here — that's the separate,
  already-queued Betrayal page.
- **Bing Site Scan audit — all clear (2026-07-13).** The 4-day-old "D&B Scan" (1 error, 4
  warnings) reviewed against the live site post-AEO-branch: the 1 HTTP-4xx error is the
  stale `/Signin.html` path (dead since the 7/3 fix; zero references remain; all 54 sitemap
  URLs verified 200). Alt-attribute warnings: zero images missing alt sitewide today. "H1
  missing: 64" is inflated by `?struggle=` param variants of the JS-rendered app pages
  (real count: 9 utility/app screens, all canonicalized, /today + /word now carry noscript
  content). Two genuinely long titles (overthinking 91 / es sobrepensar 94 chars) left as
  deliberate keyword titles — display truncation only, keyword is front-loaded. Jeff
  resubmitted sitemaps in GSC + Bing; IndexNow ping accepted (202, key file validated
  live). Action: re-run Bing Site Scan for a fresh post-deploy snapshot.
- **AEO/SEO foundations branch (fix/aeo-foundations, 2026-07-13, from Jeff's website-review
  PDF).** Diagnosis: the PDF's "keyword problem" is the dead meta-keywords tag (Google
  ignores it); the real issue is the ~4-week-old domain has ZERO indexed pages in
  Google/Brave/Bing (verified via site: queries) — AI engines can't cite what isn't
  indexed. Crawler access verified fine (all bots 200). Shipped: sitemap hreflang bug
  fixed (6 entries pointed en/x-default at /give; full reciprocity now script-verified),
  orphaned Layout.astro schema (WebApplication + 19-Q FAQPage + GEO metas) mounted on the
  live homepage and the orphan deleted, homepage meta description 153 chars + keywords
  meta, all 30 struggle pages got keyword-blended H1s ("Bible Verses for Anxiety — you
  can't turn your mind off…") + Article JSON-LD, struggles/luchas hubs got
  CollectionPage+ItemList, llms.txt lists all 30 guides with descriptions, today/word/
  journey got crawlable noscript blocks + real meta descriptions, IndexNow key hosted
  (8ae6ca7f…) + ping on deploy. RULE for new struggle pages: include keyword-first H1,
  Article schema, llms.txt line, sitemap entry with reciprocal hreflang.
  HONEST NOTE: visibility now needs indexing time + the ~22 missing struggle pages +
  backlinks — technical foundations are no longer the bottleneck.
- **Share badge logo no longer cut off in chat apps (v3.20.2, 2026-07-13, from Jeff's
  GroupMe screenshot).** Root cause: favicon-32/64 were tight edge-to-edge crops of the
  mark; GroupMe/iMessage circle-crop the site favicon, clipping the mark. Rebuilt
  favicon-32/64 + apple-touch-icon from the transparent mark.png on the sampled green
  vignette with a circular safe zone (mark 60% of canvas; bbox stays inside the
  inscribed circle). Added icon-192/512-maskable.png + "purpose: maskable" entries in
  site.webmanifest for Android. Bumped icon URLs to ?v=3.20.2 across layouts and all
  public/*.html so chat-app caches re-fetch. Rebuild script pattern lives in the session
  scratchpad (PIL venv); mark source: public/declare/brand/mark.png.
- **Google consent screen now shows "Declare and Believe" + logo (2026-07-13, console +
  homepage).** Google's branding verification kept rejecting because the checker reads
  the homepage's machine-readable name tags, which said just "Declare"/"Declare &
  Believe". Unified every signal on index.astro + site.webmanifest to the exact string
  "Declare and Believe" (title, description, og:site_name/og:title, application-name
  meta, JSON-LD WebSite schema, manifest name) and uploaded the 120x120 green DB logo
  (public/declare/brand/declare-google-logo-120-green.png). Verified + published in
  Google Auth Platform → Branding; live consent page now reads "to continue to Declare
  and Believe". RULE: keep those homepage tags in sync with the console App name or
  re-verification fails.
- **Continue with Google actually signs you in now (v3.20.1, 2026-07-13, from a user
  report).** Root cause: after Google's redirect the session comes back as a one-time
  token (`?ott=`) that must be exchanged at the Better Auth cross-domain verify
  endpoint — that exchange only exists in the library's React provider, which our
  vanilla client never used, so every Google user since launch (6 accounts) completed
  OAuth but landed back signed out with zero synced data. auth-store now consumes the
  token on load. Also: OAuth failures return to the page with a friendly reopened
  modal (errorCallbackURL) instead of a blank convex.site page, the Google button is
  guarded with a timeout, and in-app browsers (Instagram/FB/etc.), which Google blocks
  outright, get clear "open in Safari/Chrome" guidance. Verified end-to-end with a
  headless browser against the dev deployment (real ott exchange, reload persistence,
  bogus-token, error-return, and webview paths).
- **Journey Day 1 can no longer be lost + save-progress invitation (v3.20.0, 2026-07-11,
  from a user report).** Root cause: re-entering /journey through the "Start a 5-Day
  Journey" card silently replanted Day 1 (wiping lock, instance, reflections) — now it
  continues the growing journey (same struggle resumes even mid-day; different struggle
  opens the existing progress-kept sheet). Day Complete now shows a gentle bilingual
  "Save your progress" card to signed-out walkers (peak-end ask, dismissible), opening
  the signup modal with a save-your-Day-N message. Account sync gained per-key merge
  resolvers (`src/app/declare/journey-merge.js`) so signing in/up can never pull stale
  account data (incl. the 'null' tombstone) over fresh guest progress; journey writes now
  carry a timestamp. No Convex changes. Verified end-to-end in headless Chrome (EN + ES,
  live worker) + 21 merge unit tests.
- **Spanish struggle-name leaks fixed everywhere + rating flow habla español (v3.19.2,
  2026-07-08).** In Spanish, struggle names no longer fall back to English ("donde sexual
  temptation ha estado") — the `__I18N_STRUGGLES_ES` map now covers all 33 chips + 4 legacy
  deep-link keys, fixing the /today results header, 5-day Journey card, share subtitle, and
  Vault collection names (proper nouns kept: "esperar en Dios"). The Rate & Review toast +
  sheet, Vault "Be transplanted" card, share-sheet row labels, and "tap to receive this verse"
  are translated too (data-i18n — Spanish only when español is toggled on, English default
  untouched). Also fixed: the header now names the right struggle in the right language while
  the word streams. Verified end-to-end in headless Chrome (es + en sessions) before merge.
  Reminder honored: `i18n-strings.js` `?v=` bumped in both loaders.
- **Speed + stability pass (v3.17.0, 2026-07-02).** Killed the per-tap 308 redirect (tab links +
  prefetch now hit `/word/`-style URLs directly), pure-crossfade view transitions (no more bounce),
  all render-blocking scripts removed from every app page (/journey's ~400 KB classic stack + the
  1 MB eager Tree-of-Life image preload now defer/lazy), sibling-tab prefetch, route-loader threshold
  320 ms. Cookie policy live (`/cookies` + `/es/cookies`) with an accept notice on all 46 pages +
  footer/menu links. RVR1909-from-English: picking RVR1909 in The Word presents the whole Word in
  Spanish (reversible). Fixed the signed-in language toggle saga: theme-engine class collision
  (corrupted `declare-theme`), account-sync push/pull races (udSetOk + pending flag), `?lang=` param
  consumption, reconcile-via-setLang; toggle readable + shows active language. Two senior audits
  (integration + infra/perf) ran and their confirmed findings are fixed or tracked above.
- **Declare habla español — the FULL app (v3.16.0, 2026-07-02).** Live on declareandbelieve.com:
  19 Spanish static pages (15 struggle + luchas hub + bienvenido + dar + ayuda) interlinked with
  `lang=es` app handoffs; runtime cookie i18n across every app screen (home, today, word, journey,
  you, vault, signin, crisis, auth modal, share sheets, Card Studio, church finder, what's-new);
  RVR1909-only lock in the Spanish Word; the AI answers in Spanish (/today Option A warm-friend +
  Yesenia-voice breakdown; 5-day Journey Option B Yesenia throughout, strictly RVR1909); gentle
  "¿Ver en español?" auto-detect banner; language follows the account (Convex userData); chip-autofill
  invariant preserved. Sitemap 48 URLs, full hreflang pairs, GSC resubmitted.
- **All 14 struggle pages translated to Spanish (v3.14.0).** Every English struggle page now has a
  full `/es/<slug>` twin with RVR1909 Scripture (verse text pulled from the deployed worker, never
  fabricated), Spanish menu/footer/JSON-LD FAQ, `Profundiza` breakdowns, RVR1909 `/word` deep-links,
  and canonical + hreflang + sitemap pairs. RVR1909 is live in the `/word` reader too. Remaining
  Spanish work: a `/es/luchas` hub. Repro scripts: `scratchpad/es_<slug>.py`.
- **Struggle pages leveled up (v3.13.0).** Twilight/editorial template rolled out to every struggle
  page (each in its own hue), SEO titles + metas rewritten to kill the repeated "What God Says"
  formula, verse citations now deep-link into the `/word` reader, and a "Break this down" commentary
  popup (short, Scripture-grounded study) added to every verse on every page.
  Overthinking is the source-of-truth page (also has the immersive coda + editorial 2am).
- **13 SEO struggle pages live** — anxiety, anger, depression, doubt, failure, financial-pressure,
  grief, loneliness, marriage, purpose, shame, unforgiveness, church-hurt (static `/public/*.html`,
  registered in `struggles.html` + `sitemap.xml`). Each uses the cinematic template (motion +
  atmosphere), a 12-Q&A FAQ with `FAQPage` schema, and a curated Related Articles block. Build-out of
  the remaining ~22 is now tracked under "Next features."
- **Tree of Life on the Journey** (v3.12.0–3.12.1) — the Journey centerpiece is now an image-based
  death-to-life living tree that comes alive as each of the 5 days completes.
- **Journey resume + persistence** (v3.11.4–3.11.5) — the Journey now resumes where you left off
  (content + progress persist), and the day-complete vine no longer clips.
- **Vault refinements** (v3.11.x) — saved words/verses/declarations continue to sync and follow the account.
- **Giving system — fully live.** Cinematic `/give` + `/es/dar` with Stripe Checkout (one-time +
  recurring, Apple Pay); webhook → Convex public impact counter ("X people set free by the Word of
  God"); account-linked gift history + live next-charge line on `/you`; "Manage giving" on the give
  pages + the Giving terms FAQ; Spanish Giving terms page (`/es/terminos-de-donacion`) + hreflang +
  sitemap. SemVer adopted at v3.9.1. (This entry originally claimed a working Stripe Customer Portal —
  it shipped as one static email-login link duplicated everywhere, not a real per-customer flow; see
  the 2026-07-16 billing portal fix above, which replaced it with a real session-based portal.)
- **Site-wide navigation unified** — every explore page's logo/back goes to `/welcome` (no longer
  dumps people into the app); give/help/faq/struggles now share the canonical header + slide-out menu
  + footer (shared `public/declare/chrome.css` + `menu.js`); the in-app mast brand links back to
  `/welcome` (app is no longer a one-way door).
- **"Support" wording cleaned up** — nav + menu now say "Give"; "Support" only means contact now.
  Footer + menu use "Help & support" → `/help` uniformly. Added a "Help & support" card on `/you`.
- **What's new release-notes card** on `/you` (plain-language log of New/Improved/Fixed), version
  bumped to 3.3. Add future entries to the `RELEASES` array in `src/pages/you.astro`.
- **Google sign-in fixed** — OAuth app was stuck in "Testing" mode (only test users allowed), so
  new users were blocked. Published to "In production." Branding/redirect URIs verified.
- **Profile + journey → Convex account sync** — profile (name/church/verse/about/interests/avatar)
  and journey progress now follow the account across devices, same pattern as the Vault.
- **Avatar photos** — upload + drag/zoom/pinch cropper + native camera capture on `/you`.
- **Rate & Review + testimonials wall** — star flow, draggable testimonials marquee on `/welcome`
  and `/about`, approved public reviews from Convex.
- **Cinematic motion** — unseen.co-style scroll reveals + atmosphere across welcome, all 13 struggle
  pages, Spanish, and utility pages. Lighthouse perf + a11y pass.
- **Vault → Convex account sync** — saved words/verses/declarations/prayers + collections persist
  server-side and follow signed-in users (local-first; guests unaffected).
- **Auth working + simplified** — name + email + password straight into `/today`, no email-verify step.
- **Struggles hub** (`/struggles`) — editorial index of all 13 struggle pages, in the sitemap.
- Content pages: About (founder note + Our Mission), Help (`/help`), FAQ (`/faq`), Give (`/give`).
- v3 app + 14 SEO landing pages live; production Convex + Better Auth; real 404 page.
- Entry flow: Begin page at `/` (v1 retired) + "How it works" landing at `/welcome`.
- Find-a-church fixed (`PUBLIC_GMAPS_KEY` set in Cloudflare prod + preview; key restricted in Google Cloud).
