# Declare & Believe — Open Items

A running list of work to continue on the site. **Newest first within each section.**
Open work is at the top; everything finished lives under **Done** at the bottom.
Reordered 2026-08-25 after the live-billing activation pass.
Refreshed 2026-08-27: the pricing CTA, the 10th webhook event and the
lifetime-on-top case all shipped and are struck through below. Two items added,
the operator-alert deploy and the deferred GTM mapping.
**Also 2026-08-27: the billing launch is parked behind the Journey rework** — see
the section immediately below, and `docs/product/journey-rework-plan.md`.

## 🌿 Journey rework — **billing launch is parked behind this**

*Added 2026-08-27, after the owner walked `/journey` on the live site.*

**The plan lives at [`docs/product/journey-rework-plan.md`](docs/product/journey-rework-plan.md).**
It is written to be picked up cold — open it first, in a fresh session, before
touching anything below.

Three defects sit in front of the launch gate, and one gap under them:

- **D1** — on desktop there is **no way to switch Journeys at all**. The `⋯` control
  is injected into `.mast`, and `public/declare/sidebar.css:32` hides `.mast` at
  `min-width:768px`. On mobile the same control is five taps deep.
- **D2** — the cap sheet's **"Continue this one" restarts at Day 1**. It routes
  through `beginJourney`, which calls `clearLock()` and `clearInstance()`. The button
  labelled Continue destroys the progress it offers to continue.
- **D3** — the reset sheet promises *"your progress is kept, and you can return to it
  whenever you're ready."* **There is no return path in the app.**
- **The gap** — `myOpenJourneys` has exactly one caller (the refusal sheet),
  `db_journey_lock` is a per-struggle progress ledger only ever read at `[active.id]`,
  and **34 authored Journeys have no browsable front door**.

Owner decisions, already made, not to be re-litigated: **full rework first** (missing
screens plus Gentle Guidance), and **a Journey resumes where it was left** — dropped
on Day 3, come back to Day 3.

Work order, from the plan: **(1) resume-by-id** (everything else depends on it, and it
dissolves D2 and D3), (2) the *My Journeys* screen, (3) a reachable chooser on every
viewport, (4) make all 34 browsable, (5) verify Gentle Guidance shows what's left
*before* the wall, (6) the courtroom-language sweep (16 hits in `journey-data.js`).

`PRICING_ENABLED` stays `false` until this is done and walked by hand on a phone
**and** a desktop.

## ⏭️ Next up — the remaining live-billing steps

*Added 2026-08-25. Steps 1–4 were **executed 2026-08-26** and are struck through
below; the deploy is done and the webhook now listens to all nine events. What
is left is the real-money smoke test and the one open API-version risk.*

**Ordering correction, 2026-08-26:** B1 (configure the live Customer Portal) was
listed under Phase B, *after* step 5 — but step 5 is meant to exercise the
portal, cancel-at-period-end and its reversal, none of which exist until B1 is
done. B1 now runs **before** step 5, so the smoke test needs only one round of
real charges instead of two.

- [x] ~~**1. Establish what Convex production actually runs.** `npx convex function-spec --prod`,
      compared against `main` (`c44f8c0`). This is the one thing that could not be checked from
      the web session — `release-c1-monetization @ 332e611` is not in the cloud clone. The audit
      claims 51 functions and zero `testHarness` entries; `main` carries `testHarness.ts` and
      later billing fixes, so there is probably drift. **Do this before deploying anything.**
      **DONE 2026-08-26.** Production ran **55** function-spec entries, not the 51 the audit claimed, including 4 `testHarness.js` entries the audit said were absent. `main`'s function surface matched production module-for-module; the deployed harness is inert (`checkGates` requires `stripeEnvironment === "sandbox"`, derived from the `rk_live_` key).~~
- [x] ~~**2. Deploy `main` alone**, with no lifetime code merged. Closes whatever drift step 1
      found without adding billing behaviour — the harness fails closed, its two env vars were
      never set. Capture the Worker version id first (`npx wrangler deployments list`) so
      rollback has an explicit target rather than a guess.
      **DONE 2026-08-26.** Dry-run showed empty `indexDiffs` on every component and `{}` for both `componentDiffs` and `definitionDiffs` — no schema, index or function change. A Node.js actions version bump only. Worker rollback target captured: `954cf794-da71-40e8-8c22-ba4bdff5c3d6`.~~
- [x] ~~**3. Merge and deploy the lifetime backend** (`claude/convex-stripe-billing-webhook-7tnwek`).
      Run `npm run check:types`, `npm run build && ls dist/dev` (must not exist) and every
      `scripts/verify-*.ts` first — 12 suites, 2,237 checks. Schema change is additive
      (`planKey` gains `plus_lifetime`, plus a `by_plan_environment` index) and needs **no
      backfill**: production holds zero billing rows. The Worker needs redeploying too — this
      branch changed `worker/src/index.js`.
      **DONE 2026-08-26.** Merged as `8f8944d` (PR #51). Typecheck clean, **16** verify suites green (not 12 — four more have been added since that count was written). Convex deployed to `keen-hamster-650`; Worker redeployed, version `27843c86-d885-4daf-a61e-26be2a35715c`. `wrangler secret list` confirmed both `BILLING_WEBHOOK_SECRET` and `STRIPE_BILLING_WEBHOOK_SECRET` present, and no stale `STRIPE_SECRET_KEY` — rule C5 holds on the deployed Worker.~~
- [x] ~~**4. Add `charge.refunded` as the 9th Stripe webhook event**, only after step 3 deploys.
      The destination currently listens to 8. A refund is the **only** way a lifetime purchase
      can be undone — no cancellation, no lapse, no failed renewal — so without it, refunding
      $149 returns the money and leaves Plus granted forever.
      **DONE 2026-08-26.** Destination now listens to 9 events.~~
- [x] **A0. Temporarily let localhost sign in to production — and take it back off.**
      *Needed only for step 5. This is the one deliberate widening of production
      auth in the whole launch, so it gets its own item rather than a footnote.*

      **Why it is needed.** Better Auth only accepts sign-ins from websites on an
      approved list. Production's list holds exactly one entry, the live domain,
      built from `SITE_URL`. The dev checkout control exists only under
      `npm run dev`, so the tester's browser is on `http://localhost:4321` — not on
      the list — and Better Auth's `formCsrfMiddleware` refuses it with
      `FORBIDDEN / INVALID_ORIGIN`. That refusal is the guard working correctly;
      it is not a bug and must not be "fixed" by weakening the check.

      `convex/auth.ts` therefore appends **one** extra origin read from
      `EXTRA_TRUSTED_ORIGIN`, absent by default — so setting it is a visible,
      deliberate act rather than a hardcoded hole.

      **To turn it on:**
      ```bash
      npx convex deploy                                    # ship the auth.ts change
      npx convex env set EXTRA_TRUSTED_ORIGIN "http://localhost:4321" --prod
      ```

      **To take it back off — do this the same day:**
      ```bash
      npx convex env remove EXTRA_TRUSTED_ORIGIN --prod
      npx convex env list --prod | grep EXTRA_TRUSTED_ORIGIN   # must print NOTHING
      ```
      No redeploy is needed. Convex reads environment variables at call time, so the
      removal takes effect on the very next sign-in attempt.

      **How to confirm it is really gone.** The grep above printing nothing is the
      check. If it still prints a line, the variable is still set and production
      still trusts localhost — run the remove again and re-grep. Do not rely on
      memory, the dashboard rendering, or this checkbox: run the command.

      **What it does NOT do.** It does not change which backend your local site
      talks to — that is decided only by `.env.development.local` on your own Mac.
      Delete that file and local development points at dev Convex again exactly as
      before. Nothing about the normal develop-then-push loop changes.

      **The actual risk.** Small while it is set: browsers set the `Origin` header
      themselves, so a remote attacker's site cannot forge `http://localhost:4321` —
      someone would have to run a hostile app on that exact port on their own
      machine. The real risk is **forgetting to remove it** and leaving production's
      auth list widened for months. That is why C2 below is blocked on it.

      **DONE and UNDONE 2026-08-26.** Set at 09:2x, removed the same session. `npx convex env list --prod | grep EXTRA_TRUSTED_ORIGIN` printed nothing on re-check, so production trusts exactly one origin again. The C2 gate below stays in place regardless - it costs one command to run and it is the only thing standing between a forgotten variable and an open checkout.

- [x] ~~**5. Stage 5 real-money smoke test.** *(Do **B1** first — see the ordering
      correction above. Requires **A0** directly above, and A0 must be undone afterwards.)*
      The only true proof: Stripe permits no synthetic events in live mode, and the
      endpoint has 0 deliveries ever. Run `PUBLIC_BILLING_DEV_CONTROL=1 npm run dev`
      with `PUBLIC_CONVEX_URL` / `PUBLIC_CONVEX_SITE_URL` pointed at production.
      **Decided 2026-08-26:** one **$8.99 monthly** purchase only, then refunded.
      Not annual, not lifetime — one charge proves the whole live path (signature →
      shared secret → classification → entitlement grant) and the refund exercises
      `charge.refunded` on the way back out. Cost is the ~56¢ Stripe fee, which a
      refund never returns.
      Also **capture the real `invoice.paid` payload** while you are in there — it is
      the only way to settle the API-version risk below.
      **DONE 2026-08-26 — the live path works end to end.** One $8.99 monthly purchase, real card, real production user. Entitlement flipped to `tier: plus / plus_monthly / stripe`, the live `/billing` rendered it, cancel-at-period-end and its reversal both worked across three surfaces, then cancelled immediately with a full refund and `/billing` returned to Free.
      Provenance confirmed on the live subscription: `source=convex.billing.createCheckoutSession`, `billing_schema_version=1`, `environment=production`, `plan=plus_monthly`, plus the userId - which is exactly what a hand-made Dashboard subscription can never carry.
      **Four things had never carried a real request before this and now have:** the live Stripe signature at the Worker, the shared Worker-to-Convex secret, classification of a live Price with its provenance, and the entitlement write.~~
- [x] ~~**`charge.refunded` now covers all three plans.** *Shipped 2026-08-26.*
      The handler only ever reached LIFETIME purchases, and not because of the plan
      check — because of where provenance lives. `createCheckoutSession` stamps the
      five keys on `payment_intent_data[metadata]` in payment mode but on
      `subscription_data[metadata]` in subscription mode, so a monthly or annual
      refund arrived with EMPTY PaymentIntent metadata and was rejected one gate
      earlier, at `source`. Widening the plan check alone would have changed nothing.
      It now walks charge → invoice → subscription to read the metadata that exists.~~
- [x] ~~**DECIDED 2026-08-26 — a refund never revokes a monthly or annual subscription.**
      Owner's decision, and deliberate. A refund and a cancellation are different
      acts: refunding a month as goodwill to somebody still subscribed, and having
      that cut off their access, punishes the person it was meant to look after.
      When a refund does accompany a real ending, `customer.subscription.deleted`
      has already revoked — so acting here is harmful or redundant, never needed.
      **Lifetime still revokes**, because it has no subscription status to consult
      and the refund is the only signal it will ever get.
      Both halves are asserted in `scripts/verify-duplicate-subscription-guard.ts`
      so neither can be flipped by someone reading the other as a bug.~~
- [ ] **STILL UNVERIFIED IN PRODUCTION — the lifetime revocation path.**
      The logic is covered by suites, but no real lifetime purchase has ever been
      refunded, because lifetime is not yet buyable. The one path that can undo a
      $149 sale has never run against live Stripe. Settle it with the first real
      lifetime purchase after C2, not before.
      *(Superseded the older note that read "`charge.refunded` has never fired our
      revocation path" — that was true of all three plans; it is now true only of
      lifetime, and only in production.)*
- [ ] **`/checkout/success` copy, after the poll fix.** The window is now 20s fast + 100s slow
      (`checkout-return.js`), which covers a cold start. But if it still exhausts, "Still confirming"
      is shown to somebody who has paid. The copy is careful — it says not to pay again — and the
      account page is correct by then. Worth revisiting whether the exhausted state should offer to
      email them instead of leaving them on a page that cannot resolve.
- [ ] **Open risk — webhook API version cannot be changed.** The destination is pinned to
      `2026-07-29.dahlia`; the code pins `2026-06-24.dahlia`. Exposure is narrow because the
      handler re-fetches the subscription through the pinned client, so `classifyPlusSubscription`,
      `readPeriod` and `deriveCancelAtPeriodEnd` are insulated. The one reader touching the
      delivered payload's nested shape is `readInvoiceSubscriptionId` (`convex/http.ts`), which
      reads `obj.parent.subscription_details.subscription`. If that moved between versions,
      `invoice.*` events resolve no subscription and are acknowledged-but-ignored. **Unverified** —
      settle it by capturing a real `invoice.paid` payload during step 5.
- [x] ~~**Stage 6 — the pricing CTA. SHIPPED 2026-08-26, and the guarantee it replaced is
      worth stating.** The old promise was that production was *structurally* incapable of
      starting a Checkout: `createCheckoutSession` appeared nowhere in `dist/`, and four suites
      proved it by grep. That could not survive a wired button. Isolating the call in its own
      module behind `if (!PRICING_ENABLED)` and a dynamic import does **not** drop it, because
      Rollup will not fold a cross-module const to prove the import unreachable. Tried against a
      real build, not assumed.
      Replaced by six properties, all asserted: the flag ships `false`; the served CTA carries
      `disabled`; the trial panel ships `hidden`; `checkout-start.js` is never imported
      statically; the flag is checked before the import, so no network work happens; and the
      browser may name a plan **alias** and nothing else. Owner-authorised.~~

- [x] ~~**The dashboard steps for the billing-page + dunning work. ALL DONE 2026-08-26.**

      1. **`npx convex deploy`** — clean. `Schema validation complete`, `No indexes are deleted`,
         and both `dunningSends` indexes added. The `locale` field does not appear in that output
         because an optional field creates no index; that is expected, not a miss.
      2. **Stripe failed-payment emails OFF** — both *card payments fail* and *bank debit
         payments fail*, verified off in a screenshot after saving. Done AFTER step 1, which was
         the ordering that mattered.
      3. **Smart Retry final action → `leave the subscription past-due`** (B3). Verified.
      4. **Resend webhook** → `https://keen-hamster-650.convex.site/resend/email-event`,
         confirmed via the Resend API as `enabled` with exactly six events —
         `sent, delivered, bounced, complained, failed, delivery_delayed` — and **no
         `opened`/`clicked`**, which our code ignores by design.
         `RESEND_WEBHOOK_SECRET` set on prod. `RESEND_API_KEY` confirmed already present.

      **The near-miss worth remembering.** *Manage payments that require confirmation* has a
      **Subscription status** dropdown that reads almost identically to the one in *Manage failed
      payments*, and it was changed to `leave the subscription past-due` along with the intended
      one. It governs `incomplete` — somebody who started Checkout and never confirmed 3D Secure,
      **so never paid**. `entitlements.ts:119` treats `past_due` as grace and grace grants
      `tier: "plus"`, and with no period end the clock runs from `updatedAt` — so that person
      would have received **16 days of Plus for free**, plus the full four-email sequence telling
      them their Plus "stays on until…". Reverted to `cancel`, which is correct: an initial
      payment never confirmed should expire, not become a debt.
      **If that dropdown ever reads anything but `cancel the subscription`, this is why.**~~

- [x] ~~**STRIPE DASHBOARD — add `customer.subscription.trial_will_end` as the 10th event.**
      **DONE 2026-08-26.** The destination now listens to 10 events, confirmed in the dashboard.
      The reminder three days out is reachable, so the "Day 4: we email you" promise on
      `/pricing` is one the system can now keep.

      *Original note kept below, because the reasoning is the reason it mattered.*~~

  <details><summary>Why this was not optional</summary>
      Settings → Webhooks → the `Declare Production Billing` destination → add that event.

      **Without it the trial is the version people resent.** The code is done and deployed-ready:
      the event is in `BILLING_EVENTS`, the handler is in `convex/http.ts`, and
      `sendTrialEndingEmail` is written in both languages. But Stripe only delivers events the
      destination is subscribed to, so until this is added the handler is unreachable and
      **nobody is warned before their card is charged** — while `/pricing` shows them a timeline
      promising "Day 4: we email you". A promise on the page that the system cannot keep.

      Nothing else in Stripe is needed for the trial. The 7 days are set per Checkout Session
      from `TRIAL_DAYS`, which is code.

      Also confirm this stays **off**, as it already is: *Send a reminder email 7 days before a
      trial ends* under Customer emails. Same reasoning as the failed-payment emails.

      *Harm if skipped: silent. No error, no red check, no failed delivery. Just a charge nobody
      saw coming, which is the one outcome the whole trial design exists to prevent.*
  </details>

- [x] ~~**Buying lifetime on top of a subscription. BUILT 2026-08-27, and the double charge was
      the smaller half of it.** Asked to build the cancellation, found that the purchase was not
      recorded at all: a lifetime purchase creates no Subscription object, so the incoming id is
      null, which is neither the canonical id nor a replaceable status, and the duplicate guard
      refused it. `createCheckoutSession` allows that purchase on purpose. **$149 charged, event
      acknowledged, nothing granted.** Proven by running the real classifier against that input.
      Now: the grant lands, the old subscription is cancelled immediately, and the unused part of
      the period already paid for is refunded. Each step survives the next one failing, and a
      refund that cannot be sent is recorded to the cent and alerted rather than quietly kept.
      Clearing the old subscription id from the row is the load-bearing half: left in place, the
      very cancellation we perform comes back and overwrites the $149 purchase.~~

- [ ] **TOMORROW, FIRST — walk the Journey cap on a real account, before the flag.**
      *Owner's call 2026-08-27: this is a gate on **C2**, not a nice-to-have.*

      **Why it needs a person.** The screen is asserted by 29 checks and was rendered in a
      real browser in both themes and both languages, but always with an **empty list** —
      there was no signed-in session, so `myOpenJourneys` returned null every time. Nobody
      has yet seen their own three Journeys listed in it. This is new code on the path
      somebody takes when they are already struggling, and its only real-world test so far
      was synthetic.

      **It does not need the flag.** The cap fires whether or not purchasing is on, so this
      can and should happen first.

      **The walk, on the live site, signed in:**
      1. Start a Journey. Then start a second, then a third. Each one sets the previous
         aside; that is the app working as it always has.
      2. Try to start a **fourth**. The sheet should appear instead of the Journey.
      3. Check the heading counts correctly: *"You have three Journeys still open"*.
      4. Check all three are listed **by name**, as `From → To`, with their own line.
         An empty list here means `myOpenJourneys` is not resolving and the whole screen
         is useless. That is the single most likely failure.
      5. If one of them is on day 5, the hint above the list should offer to finish it
         rather than set anything down.
      6. Press **Continue this one** on any of them. It should take you into that Journey.
      7. Come back and hit the cap again. This time press **Let this one go**. The slot
         frees and the fourth Journey should begin without another refusal.
      8. Confirm the Plus line reads *"$8.99 a month, and the first 7 days are free"* and
         that **See Plus** opens `/pricing`.
      9. Switch to Spanish and re-open the sheet. The heading, both buttons and the Plus
         line should all be Spanish.

      **Afterwards, clean up your own account.** You will be holding three or four open
      slots. Either finish them, use *Let this one go* on each, or set `status` to
      `archived` on the rows in Convex → Data → `journeySlots`. Leaving them means your own
      account sits at the cap.

      *If anything here is wrong, fix it before C2. A broken refusal screen in front of the
      3am user cannot be taken back, and the flag can wait a day.*

- [x] ~~**DEPLOY the operator-alert send fix.**~~ **Done 2026-08-27, deployed and seen working.**
      `notifyOperator` records its send, and every email now carries
      `Reply-To: support@declareandbelieve.com`. Both confirmed by running the real function
      against production and reading the delivered message, not by reasoning about the code.

- [ ] **EMAIL DELIVERABILITY — what was actually found, and what is left.**
      *Investigated 2026-08-27 after the first operator alert landed in Junk at iCloud.*

      **Authentication is not the problem, and this is measured rather than assumed.** The
      `Authentication-Results` headers on a real delivered message read:
      ```
      dmarc=pass  header.from=declareandbelieve.com
      dkim=pass   header.d=declareandbelieve.com     (ours, aligned with From)
      dkim=pass   header.d=amazonses.com
      spf=pass
      ```
      Two valid DKIM signatures, SPF pass, DMARC pass. **Do not go looking for a DNS fault.**
      The 12 Cloudflare records are correct as they stand: root SPF authorises iCloud, the
      `send.` subdomain authorises Amazon and is what Resend actually authenticates against,
      `resend._domainkey` and `sig1._domainkey` are both live, and `_dmarc` is published.

      Junk placement is therefore a REPUTATION and CONTENT decision made after authentication
      cleared. Three things stacked: the domain had sent one email in its entire life; Apple
      hosts this domain's mailboxes and received mail from it via a third party; and a payment
      email from a no-reply address carrying a link is phishing-shaped whatever its contents.

      **Corrections to earlier notes in this file and elsewhere:** `support@declareandbelieve.com`
      does **not** forward. The MX records are `mx01`/`mx02.mail.icloud.com`, so it is an iCloud
      Custom Email Domain with direct delivery, and SPF never breaks in transit. Any note here
      reasoning about a forwarding hop was wrong.

      **Still open, in order:**
      1. **Point the DMARC reports at a mailbox that exists.** *Decided 2026-08-27: option A,
         send them to `support@`.* The `rua=` address was `dmarcreports@declareandbelieve.com`,
         which was never created, so every report the world sent was bouncing off nothing.
         Mailboxes for this domain live in **iCloud**, not Cloudflare: the MX rows point at
         `mx01`/`mx02.mail.icloud.com`, so Cloudflare holds only the records. Apple caps a
         person at three addresses per domain, which is why a dedicated reports mailbox was
         not worth a slot. Cloudflare → DNS → `_dmarc`, change one word:
         ```
         v=DMARC1; p=none; rua=mailto:support@declareandbelieve.com; fo=1
         ```
         Safe to do at any time: `p=none` asks receivers to take no action, so a malformed
         record cannot cause a rejection. XML attachments beginning to arrive at `support@`
         is the success signal. This gates step 2.
      2. **Then move `_dmarc` from `p=none` to `p=quarantine`,** after two to four weeks of clean
         reports. Both sending sources authenticate, which the headers above prove, so this is
         safe. It is also what `bimi=skipped reason="insufficient dmarc"` in those same headers
         is complaining about. Do not tighten before reading reports.

         *If the XML turns out to be noise nobody reads, that is the moment to move `rua=` to a
         free DMARC digest service instead. Do not skip step 2 for lack of a nicer report format:
         unread reports are the same as no reports, and the policy stays at `p=none` for ever.*
      3. **Optional housekeeping:** add `include:amazonses.com` to the root SPF record. It is
         **not** the fix and SPF already passes without it, but the root currently announces that
         only iCloud sends for this domain while a third party sends from it. Costs nothing.

      *Nothing here blocks launch. Recorded so the next person does not re-derive it.*

- [ ] **GTM → GA4 — map the six new events.** *Deliberately deferred 2026-08-27, owner's call.*
      The code pushes to `window.dataLayer` and is verified doing so against the real minified
      bundle. Nothing reaches a report until the container side is wired, so until then these
      are collected by the browser and read by nobody.

      | Event | Properties |
      |---|---|
      | `checkout_opened` | `authenticated`, `displayed_tier`, `selected_interval`, `plan_alias` |
      | `guidance_limit_reached` | `authenticated`, `displayed_tier` |
      | `journey_limit_reached` | `authenticated`, `displayed_tier`, `open_journeys`, `journey_limit` |
      | `journey_continue_selected` | `authenticated`, `displayed_tier`, `source` |
      | `journey_let_go_selected` | `authenticated`, `displayed_tier`, `journey_category` |
      | `journey_upsell_selected` | `authenticated`, `displayed_tier`, `source` |

      **`checkout_opened` is the one to do first if only one gets done.** It is the single event
      measuring somebody actually starting a purchase, and it had been firing into nothing since
      the CTA was wired because it was never in the `ALLOWED` map. That is now fixed in code and
      asserted, but a GA4 report still needs the container.

      The other five answer one question: **does the ask at the moment of loss earn its place?**
      `journey_limit_reached` is the denominator; every reader who meets the cap resolves it by
      finishing one, letting one go, looking at Plus, or none of those. If the Plus share is
      negligible, that ask should be made quieter or removed. Full reference and the property
      vocabulary are in `.agents/tracking-plan.md`.

      *Harm if skipped: no error, no failure, just decisions made on guesses.*

- [ ] **SECURITY — rotate `RESEND_API_KEY`.** The live key was pasted into a chat transcript on
      2026-08-26 (`re_AnQGhWaD…`) and should be treated as compromised. Deliberately deferred at
      the time, recorded here so it is not lost. Nothing is at risk while no subscriber has a
      failing card, but a leaked sending key is a spam-from-your-domain problem, and domain
      reputation is what gets these emails delivered at all.
      Order matters — a new key is useless if Convex still holds the old one:
      1. Resend → API Keys → new key with **Sending access**
      2. `npx convex env set RESEND_API_KEY <new> --prod`
      3. Resend → delete the old key
      Between 2 and 3 both work, so there is no window where sending breaks.
      To check presence without printing values: `npx convex env list --prod | grep -o '^[A-Z_]*'`

## 💳 Path to the first paying subscriber

*Senior-dev audit, 2026-08-25. Ordered by what blocks revenue, then by what
protects the people who pay. Phase A is the at-home commands above.*

*Amended 2026-08-26: **B1 runs before step 5**, not after — step 5 cannot test a
portal that does not exist. B2–B5 still wait on step 5 passing.*

### Phase B — required before ANY real customer can subscribe

These are not polish. Each one, missing, produces a specific harm to someone who
has paid you money.

- [x] ~~**B1. Configure the live Customer Portal.** Without it a subscriber cannot
      cancel, cannot update a failing card, and cannot see what they were
      charged. Shape it like the sandbox: cancel at period end **on**; plan
      switching, quantity and pause **off**. *Harm if skipped: a paying customer
      with no way out. That is a consumer-protection problem, not a UX one.*
      **DONE 2026-08-26.** Cancel subscriptions on, at end of billing period; cancellation reason collected; plan switching and quantity change off; payment-method updates and invoice history on. "Next generation portal experience" left **off** on purpose - it is a preview whose behaviour can change underneath us, and this path has carried zero real deliveries.~~
- [x] ~~**B2. Failed-payment emails — BUILT OURS, Stripe's toggle stays off.**
      *Shipped 2026-08-26. Full reasoning in `docs/operations/dunning-plan.md`.*
      The decisive fact: Stripe's toggle sends **one email per retry attempt** — eight at the
      default — and the copy cannot be changed. Eight escalating payment demands to somebody who
      reaches this app at 3am is a collections experience. Recurly's own guidance is three to four
      messages; Paddle sends four.
      Ours is three, then silence: immediately, 24h before access stops, and when it stops. The
      cadence is DERIVED from `PAST_DUE_GRACE_DAYS` so it can never promise a date the entitlement
      layer will not honour — which mattered at once, since grace is 3 days while Stripe retries
      for 14. Scheduled on the status TRANSITION, so retries cannot re-trigger it, and every stage
      re-checks before sending so a card fixed on day one cancels the rest.
      Carries the four fields the good ones do (amount, card brand + last four, plan, the date
      access ends) behind one button, plus an explicit alternative to clicking the link — because
      "your payment failed, update your details" is among the most common phishing templates that
      exists. Hardship help is offered in the FIRST email, not the last.
      92 checks in `scripts/verify-dunning-emails.ts`, executing the real copy.~~
- [x] ~~**B2a. Email language — DONE 2026-08-26. English and Spanish.**
      `createCheckoutSession`'s `lang` is now stamped into `subscription_data[metadata][lang]`
      (or `payment_intent_data[metadata][lang]` for lifetime — the same asymmetry provenance
      uses), read back by `plusPlans.stampedLang`, persisted on the subscriptions row as
      `locale`, and read by `dunning.ts` weeks later.
      **Carried metadata, never provenance.** `classifyPlusSubscription` does not read it and
      must not start — a sixth checked key would reject every subscription sold before the stamp
      existed. `verify-plus-classification.ts` asserts both directions.
      **Absence means English**, so nothing needed backfilling. `normalizeLang` accepts regional
      tags (`es-MX`, `es_419`) and returns `null` for anything else — null rather than a throw,
      because this runs in a webhook mutation and Stripe answers a throw with infinite retries.
      The Spanish is `tú` (matching the app), its ban list is written for Spanish rather than
      translated from English, and money and dates format as `es-US`. The link carries `?lang=es`
      so the page opens in the email's language; `i18n.js` honours it and strips it.~~
- [x] ~~**B2b. Email delivery tracking — DONE 2026-08-26.** `onEmailEvent` is registered and
      `/resend/email-event` routed; the component verifies the svix signature itself, so this
      route does not go through the Worker (rule C5 is about the *Stripe* credential — adding a
      hop and a second copy of a secret here would buy nothing).
      Each send writes a `dunningSends` row joining the message id to the user and stage.
      **Delivery tracking, not analytics:** no opens, no clicks, no pixel, no duplicated address.
      **The part that matters:** a bounce, hard failure or spam complaint suppresses the
      remaining stages, checked at send time before the address is even resolved.
      *Needs one dashboard step — see Next up.*~~
- [x] ~~**B2c. DECIDED 2026-08-26 — the grace window is 16 days, Apple's model.**
      Was 3, carrying its own note that it was "awaiting approval, not a silently chosen default".
      Three days was shorter than the retries it covered: Stripe retries for **two weeks**, so
      somebody lost Plus on day 4 and could get it back on day 10 — access flapping while we were
      still trying to charge them.
      **16 is Apple's own default** for monthly-and-longer subscriptions (3/16/28, full access
      throughout), and it **exceeds Stripe's 14-day retry window by two days**, so access now ends
      exactly once, after the retries have finished, with margin rather than a race.
      Consequence, and it was not obvious: the three-email cadence read correctly at 3 days
      (0, 2, 3) but became 0, 15, 16 at sixteen — one email, two weeks of silence, then two inside
      a day. A midpoint `reminder` stage was added, so the sequence is now 0, 8, 15, 16. Four
      emails, against Stripe's eight.
- [x] ~~**B3. Smart Retry's final action — DONE 2026-08-26.** Changed from the default
      `cancel the subscription` to **`leave the subscription past-due`**, verified in a
      screenshot after saving. A returning subscriber now repairs a card through the Portal
      rather than buying again from scratch — which is exactly what the `lapsed` state on
      `/billing` exists to serve. On `cancel` that state would have rendered a button leading
      nowhere.~~
- [x] ~~**B4. Grace expiry is observed — DONE 2026-08-26, and it was hiding a real bug.**
      `subscriptions.recordGraceExpiry` is scheduled alongside the four dunning emails, timed
      to `graceEndsAt` rather than a window from the webhook. It writes a `billingEvents` row
      with outcome `grace-expired`, a namespaced deterministic id so a retry cannot double-write,
      and an alertable log line. It **observes and does not decide** — `entitlements.ts` stays
      the only authority, and this job is redundant to access if it never runs.
      **The bug:** `subscriptions.tier` is a webhook-time mirror, `tierForStatus` writes `plus`
      for `past_due`, and nothing rewrote it when grace closed. `journeySlots.limitFor` read
      that column **directly**, so a lapsed subscriber kept **unlimited Journeys for ever** — a
      paid benefit and a live model call each time. Fixed twice: the job corrects the mirror,
      and `limitFor` now calls `entitlements.interpret`, because a scheduled job can fail to run
      and the second fix needs nothing to have happened.
      Also consolidated the grace arithmetic into `entitlementCatalog.graceEndsAtMs` — the
      resolver, the emails and this job had three copies, and three copies of a date a
      subscriber is told is three chances to tell them the wrong one.
- [x] ~~**Journey limit tracking — DONE 2026-08-26.** An allowed start left a `journeySlots`
      row; a refusal left nothing, so the cap biting a real person was the one event with no
      trace. New `journeyLimitBlocks` records who, which tier, what the cap was, how many they
      had and when — no journey id, no content. Slots now carry `tierAtStart`/`limitAtStart`,
      so "what were they allowed when they started this?" survives a tier change.~~
- [ ] **C1. Merge `claude/billing-pricing-cta-stage6`.** Nine assertions across
      four suites must be **rewritten, not relaxed** — they enforce that
      production is *structurally* incapable of starting a Checkout, and merging
      deliberately trades that for a runtime flag.
- [ ] **C2. Flip `PRICING_ENABLED` to `true`** in `src/app/declare/plan-display.js`,
      update the one guard assertion, deploy. **This is the moment money can
      move.** Everything above must be done first.

      **ALSO BLOCKED on walking the Journey cap** — see *TOMORROW, FIRST* at the top
      of **Next up**. Added 2026-08-27 at the owner's direction. That screen has never
      been seen with real data, and it sits on the path of somebody who is already
      struggling.

      **BLOCKED until `EXTRA_TRUSTED_ORIGIN` is gone from production.** Run this
      first, every time, and read the output rather than assuming:
      ```bash
      npx convex env list --prod | grep EXTRA_TRUSTED_ORIGIN
      ```
      **It must print nothing.** If it prints a line, stop — production auth still
      trusts `localhost`, and opening purchasing on top of that is exactly the
      combination nobody would choose deliberately. Remove it (see **A0**), re-run
      the grep, and only then flip the flag. This gate exists because the failure
      mode of A0 is forgetting, and forgetting is not something a checkbox catches.
- [ ] **C3. Watch the first real subscriber end to end** — Checkout, webhook,
      entitlement, `/you`, `/billing`. Roll back on: webhook failures above a
      small threshold over 15 minutes; any entitlement granted without a matching
      subscription row; any duplicate subscription for one account; any Checkout
      success that does not produce Plus within a minute.

### Phase D — right after launch, not before

- [ ] **D1. Tax.** `automatic_tax` is explicitly `false` and that was a deliberate
      deferral, not an oversight. Before volume: review Stripe Tax, home-state
      obligations, economic-nexus thresholds and the product tax code **with an
      accountant**.
- [ ] **D2. Spanish for `/checkout/success`** — English-only today, on a page a
      Spanish-speaking customer reaches immediately after paying.
- [ ] **D3. Verify analytics fire** on the Checkout and Portal paths, so you can
      tell whether any of this is working.
- [ ] **D5. `/billing/webhook` returns 500 for a switched-off integration.**
      Arguably wrong: 500 says "misconfigured" when the truth is "switched off".
      Stripe treats **5xx as retryable and 4xx as delivered**, so the current
      shape invites redelivery that a 4xx would stop. Less likely to fire now
      that all three Worker variables are set, but the same reasoning applies to
      the `Downstream error` 500. Decide the right code — 503, or a
      retired-style 410. *Carried over from `chore/retired-webhook-secret-hygiene`,
      merged 2026-08-25.*
- [ ] **D4. Settle the webhook API-version question** by capturing a real
      `invoice.paid` payload during A5. See *Next up*.

### Phase E — hygiene, parallel, blocks nothing

- [x] **E1. Merge `chore/retired-webhook-secret-hygiene`** — DONE 2026-08-25.
      ~~Merge it and run it.~~ Merged; `scripts/audit-retired-secrets.ts` run, and
      both retired secrets confirmed gone. Its three open items resolved as: the
      secret-hygiene block is **cleared** (both removed, verified in the
      dashboards), the stale agent worktree is **already pruned**, and the
      500-vs-4xx question moved to D5. Original item below.
- [ ] ~~**E1. Merge `chore/retired-webhook-secret-hygiene`**~~ (unmerged since
      2026-08-20, 3 commits). It carries `scripts/audit-retired-secrets.ts` — a
      character-level scanner that answers "does anything shipping still read
      these retired secrets?" mechanically. We answered that **by hand** on
      2026-08-25 while this tool sat on a branch. Merge it and run it.
- [ ] **E2. Merge `docs/cross-platform-subscription-contract`** (1 commit,
      2026-08-24) — records the verified live Stripe product and prices. Overlaps
      the 2026-08-25 addendum in `cross-platform-subscriptions.md`; reconcile
      rather than merging blind.
- [ ] **E3. Delete the 37 fully-merged branches** — `./scripts/delete-merged-branches.sh --yes`.
      Prepared but **not executed**: the cloud session cannot delete remote
      branches (403 on `push --delete`; it may push its own branch only). The
      script recomputes the merged set at run time rather than trusting a list,
      so a branch that gained unmerged work since is skipped automatically. Tip
      SHAs recorded in `docs/operations/branch-cleanup-2026-08-25.md` — restore any
      with `git push origin <sha>:refs/heads/<branch>`.
      **Three ways to run it, pick one:**
      `bash scripts/delete-branches-oneliner.sh` (one push, 37 branches, fastest),
      `./scripts/delete-merged-branches.sh --yes` (recomputes the set first —
      safest if time has passed), or paste from
      `docs/operations/branches-to-delete.txt` (plain list, one per line).
      ~~Delete the ~30 fully-merged branches.~~ Everything with `ahead: 0`
      against main — the `fix/harness-*`, `verify/stripe-*`, `docs/billing-*`
      and `feature/*` sets. **Keep `release-c1-monetization`** until
      `convex function-spec --prod` confirms production no longer needs it as a
      reference.
- [ ] **E4. Decide the fate of the pre-parity branches** — `feat/give-*`,
      `v2.0-redesign`, `v3*-redesign`, `welcome-copy-pass`, `fix/billing-portal`,
      `fix/nav-footer-links`. All 137 behind main, all from June/July, several
      carrying the retired donation code and the billing-portal IDOR. Archive as
      tags and delete, or delete outright.

---

## 🔧 In progress / immediate
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
- [ ] **Real store IDs in `public/declare/rate.js`.** The Rate & Review flow still ships with
      placeholder App Store / Play IDs (`TODO dev` at `rate.js:24`). Drop in the real IDs before the
      iOS launch so the "rate us" links point somewhere.
- [ ] **Re-submit the sitemap** to Google Search Console after any big sitemap change to force a
      re-read (initial submit already succeeded).
- [ ] **Spanish strings for `/checkout/success` (found 2026-08-24 during the Plans/Billing work).**
      Twelve `checkout.*` keys used by that page have no Spanish entry in
      `public/declare/i18n-strings.js`, so a Spanish reader falls back to English at the moment they
      have just paid. Pre-existing, not introduced by the Plans/Billing redesign, and unrelated to
      it — Plans and Billing both have full parity. Worth closing before production activation.

## ✅ Verify on the live site (manual)
- [ ] **Auth round-trip** on declareandbelieve.com: email sign-up, email sign-in, Google sign-in,
      password-reset email (Resend).
- [ ] **Entry flow** on a phone: new visitor sees Begin → tap Begin → `/today`; revisit `/` same day
      skips to `/today`; signed-in always skips; menu → "How it works" → `/welcome`.

## 🔒 Billing guardrails (standing)

- Do not reuse archived legacy Products, Prices, sessions or metadata. Seven
  archived sessions and two archived Products remain in the sandbox from an
  earlier integration and are permanent negative test fixtures, not building
  material.
- Do not point sandbox webhooks at the production Worker.
- Do not put `STRIPE_SECRET_KEY` in Cloudflare. Its absence from the Worker is
  asserted by `scripts/verify-plus-classification.ts`.
- Do not enable production checkout without a separate live-promotion approval.
- Preserve cross-platform entitlement support for future iOS StoreKit purchases.
- Keep Stripe and Apple as billing **providers**. Convex remains the entitlement
  source of truth.


## ✔️ Done

*Everything below is finished. Newest first. Kept rather than deleted because
several of these are permanent negative fixtures, or explain why something is
deliberately absent.*

### Live billing activation (2026-08-25)

- [x] **Live Stripe catalog complete.** Product `Declare Plus` (`prod_V8OKKIMHiVw0KE`) with
      three prices, all carrying versioned lookup keys: $8.99/mo `plus_monthly_usd_v1`,
      $79.99/yr `plus_annual_usd_v1`, $149.00 **one-off** `plus_lifetime_usd_v1`.
- [x] **Live webhook destination exists and is correct.** `Declare Production Billing` → the
      production Worker's `/billing/webhook`, Active, 8 events. The legacy donation endpoint is
      **gone** — it had been pointing at `/give/webhook`, which answers `410 Gone`.
- [x] **Convex production fully configured.** `STRIPE_SECRET_KEY` (`rk_live_`, from the scoped
      restricted key `declare-production-billing-convex`), all three price IDs,
      `BILLING_WEBHOOK_SECRET`, `SITE_URL`. `GIFT_WEBHOOK_SECRET` removed.
- [x] **Worker secrets set from known-good sources**, so the two `BILLING_WEBHOOK_SECRET` values
      match by construction rather than by inspection — Cloudflare secrets cannot be read back,
      so inspection was never available.
- [x] **The suspected bug did not exist.** `BILLING_WEBHOOK_SECRET` on Convex was correct all
      along — random text, never a `whsec_`. Nothing was broken; the setup had simply never been
      exercised. 0 deliveries, 0 failures.
- [x] **`docs/operations/billing-production-activation-readiness.md` is unreliable.** Four
      separate claims in it were false by the time they were checked. Treat it as history.
      `docs/operations/billing-secret-topology.md` replaces it for the secrets.
- [x] **Lifetime plan built** — catalog, one-time classifier, entitlement resolution, schema
      widening, `mode: payment` Checkout, `charge.refunded` revocation, and a soft
      founding-member seat cap (`LIFETIME_SEATS = 200`).
- [x] **Family and Church offers removed** from `/pricing`. The church *finder* is untouched.
- [x] **Shared-secret trim asymmetry fixed.** The Worker trimmed `STRIPE_BILLING_WEBHOOK_SECRET`
      but not `BILLING_WEBHOOK_SECRET`, which is the harder one to diagnose — one invisible
      trailing space is a 401 on every delivery with nothing to indicate why. Both sides trim now.

### Worker source parity — resolved

- [x] **Worker source parity.** ~~`main` still carries legacy checkout handlers, including the
      billing-portal IDOR that searched Stripe customers by a browser-submitted email.~~
      **Verified false 2026-08-25.** `main`'s `worker/src/index.js` answers all four `/give/*`
      routes with `410 Gone` and reads `env.STRIPE_SECRET_KEY` nowhere. Deploying the Worker from
      `main` does not roll production backwards. Original note kept verbatim below.

  > - [ ] **Worker source parity (same hazard class as the Convex divergence).** `worker/src/index.js`
  >       on `main` still carries legacy checkout handlers, including the billing-portal IDOR
  >       that searched Stripe customers by a browser-submitted email. Production runs the hardened
  >       Worker deployed from `release-c1-monetization`. The Convex parity branch deliberately does
  >       not touch this. Until it is reconciled, `wrangler deploy` from `main` would roll production
  >       backwards into those vulnerabilities. See
  >       `docs/operations/convex-production-parity-audit.md`.

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

### Stripe sandbox checkout and subscription validation

**Paused at a verified checkpoint, 2026-08-21.** Everything below is sandbox-only.
Nothing in live mode has been created or touched. Full record in
`docs/operations/stage-2-sandbox-billing.md`; PR #20 is the active review surface.

#### Completed

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
- [x] Recurring-checkout contamination bug fixed (C2). Any recurring checkout is
      also `mode: subscription`, so mode alone could have granted Plus to someone
      who never bought Plus
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

#### Intentionally not completed

None of these are oversights. Each is a deliberate stop.

- [ ] No checkout control exists in production. The dev-only one has never been
      clicked, so it has created nothing
- [ ] No Stripe Customer has been created
- [ ] No real Checkout Session has been created through the app
- [ ] No Subscription or invoice has been created
- [ ] No test payment has been completed
- [x] Sandbox Billing Portal **configuration** is complete and verified
      (2026-08-22, §6.12.1) — active default, sandbox-only
- [x] Portal **sessions** have been created and opened (2026-08-24) — three of
      them, from the authenticated app on a disposable Test Clock fixture. Every
      criterion this item named is now exercised: return to `/you`, cancellation
      (scheduled at period end **and** reversed), payment-method update, and
      invoice history. Recovery of a genuinely failed renewal payment was
      performed **through the hosted Portal**, not the API. Record:
      `docs/operations/billing-portal-release-gate-2026-08-23.md`
- [ ] No annual Checkout Session has been created. The annual dev control now
      exists (resume step 6d); the annual Price has never been exercised
- [x] Payment failure and recovery **have** been exercised (2026-08-23) on a
      disposable QA account via a Stripe Test Clock, leaving both existing
      subscribers untouched. Subscription cancellation was exercised on that
      same throwaway fixture only
- [ ] No cancellation has been performed on a **real** QA subscriber through the
      Portal. The monthly subscriber's end-of-period cancellation (§6.17) was
      set through the API. *Narrowed 2026-08-24:* the hosted Portal cancellation
      flow itself **has** now been walked — scheduled at period end and then
      reversed — but on the disposable Test Clock fixture, not on a real
      subscriber. Stripe recorded the schedule as `cancel_at` with
      `cancel_at_period_end: false`, and the app normalized it to
      `cancelAtPeriodEnd: true` correctly. What remains is the real monthly
      subscriber reaching its already-set end date
- [ ] No production billing CTA is enabled — the pricing page CTA is still a
      disabled "Plus launches soon" button. **Still true and deliberate
      (2026-08-25):** the wiring exists on `claude/billing-pricing-cta-stage6`
      and is held unmerged until Stage 6. See *Next up*, last item
- [x] ~~No live Stripe Product, Price, webhook or secret has been created~~
      **Superseded 2026-08-25** — all of it now exists. See *Live billing
      activation* at the top of Done
- [ ] No StoreKit or App Store Connect product has been created
- [x] **Stale live Stripe secrets on the production Worker (found 2026-08-24,
      removed by 2026-08-25).** ~~`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
      are still set on `hope-finder-worker`~~ — both are gone. Verified: the
      Worker's variable list holds only `ANTHROPIC_API_KEY`, `BIBLE_API_KEY`,
      `BILLING_WEBHOOK_SECRET`, `CONVEX_SITE_URL`, `JOURNEY_TRANSLATE_SECRET`,
      `STRIPE_BILLING_WEBHOOK_SECRET` and `UNSPLASH_ACCESS_KEY`. Rule C5 holds:
      the Worker carries no Stripe credential

#### Stage 2 sandbox validation — outcome

*Condensed 2026-08-25. This ran from 2026-08-21 to 2026-08-24 and is finished
except for the four items at the bottom. The full step-by-step narrative is in
git history and, in more detail than was ever here, in
`docs/operations/stage-2-sandbox-billing.md` §6.1–§6.20.*

**Proven end to end in the sandbox** (`Declare checkout dev`): monthly and annual
Checkout through the real app path; webhook ingestion with correct provenance and
no conflicts; Customer mapping resolved server-side; entitlement activation;
Billing Portal sessions, invoice viewing and payment-method replacement; failed
renewal and recovery via Test Clock; cancellation scheduled at period end and
reversed; `cancel_at` → `cancelAtPeriodEnd` normalization against a real Portal
action.

**Built during it, and still load-bearing:**

- `src/pages/dev/[control].astro` — the dev-only checkout, annual and Portal
  controls, plus a read-only lifecycle inspector that renders an allowlist
  projection so no Stripe identifier reaches the screen (§6, §6.12)
- `convex/subscriptionGuard.ts` — the duplicate-subscription guard, in
  `applyWebhook` because the checkout-time guard cannot see a Session minted
  before the first subscription existed and completed within its 24-hour window
  (§6.10)
- `/checkout/success` and `/checkout/cancelled` — success treats `session_id` as
  untrusted and confirms only from `getMyEntitlements` (§6.11)
- `src/app/declare/plan-display.js` — one shared interpreter so `/you`,
  `/pricing` and `/billing` cannot drift (§6.13)
- The webhook field readers, **narrowed against captured payloads rather than
  memory**: `readPeriod` reads only `subscription.items.data[0]`,
  `readInvoiceSubscriptionId` only
  `invoice.parent.subscription_details.subscription` (§6.9)
- The Test Clock harness, behind two unset flags and deployed nowhere
  (`docs/implementation/billing-test-harness-brief.md` §13,
  `docs/operations/billing-test-harness-execution-readiness.md`). Getting it to
  run took three provisioning stops and seven safe-stop fixes (PRs #39–#47),
  four of them the same bug — a webhook-driven convergence checked with a single
  immediate read, fixed as a class with one bounded poller everywhere. Records:
  `docs/operations/billing-test-harness-provisioning-convergence-stop-2026-08-23.md`,
  `docs/operations/billing-test-harness-stale-error-stop-2026-08-23.md`

Suites that pin all of it: `verify-plus-classification.ts`,
`verify-duplicate-subscription-guard.ts`, `verify-checkout-return-pages.ts`,
`verify-billing-lifecycle-controls.ts`, `verify-billing-dev-control.ts`,
`verify-subscription-visibility.ts`, `verify-billing-test-harness.ts`.

**Never observed anywhere, and production prerequisites:** Stripe's automatic
Smart Retry cadence actually firing (recovery was always driven manually), and
failed-payment notification delivery (sandbox emails were disabled). Records:
`docs/operations/billing-test-harness-execution-record-2026-08-23.md`,
`docs/operations/billing-portal-release-gate-2026-08-23.md`.

**Why a one-off invoice cannot exercise payment-attention** (§6.20) — worth
keeping because it looks like a shortcut and is not. Two independent reasons,
both deliberate fail-closed design, neither a defect:
`readInvoiceSubscriptionId` never reads invoice *lines*, so a one-off invoice
resolves to `null` and `http.ts` ACKs before `applyWebhook`; and
`paymentNeedsAttention` is a pure function of the stored **subscription**
status, which a failed one-off invoice never changes. The path is reachable
only by genuinely moving a subscription to `past_due`.

**Standing rule — do not run a second Checkout on an account that already holds
a live subscription.** Convex refuses the purchase and the webhook guard refuses
to repoint the canonical row, but **neither cancels nor refunds** — Stripe would
still bill twice. Use a separate QA account. Note that end-of-period
cancellation leaves a subscription `active` until the period actually ends, so
cancelling does not free an account quickly.

**Still open from Stage 2:**

- [ ] verify the sandbox subscription remains active for its entire remaining period
- [ ] verify terminal `customer.subscription.deleted` at the real period end
- [ ] verify access changes at terminal cancellation
- [ ] production Portal activation — configure the live Portal to the sandbox's
      shape (cancel at period end **on**; plan switching, quantity and pause
      **off**). See the live-activation steps under *Next up*
#### Account experience

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

### Recently shipped
*App is on **v3.20.2**. Newest first.*

- **The night of 2026-08-27: the two free limits became real, and billing learned to
  speak.** Six things, and the first one is why the rest mattered.

  **Free and Plus were the same product.** `/pricing` promised Free three Gentle Guidance
  responses a day and a Journey cap. `convex/usage.ts` held a complete meter, and
  **nothing in the browser had ever called it** — `reserveUsage`, `finalizeUsage` and
  `releaseUsage` had zero call sites. The counter was read, which is why `/billing` could
  display "3 left today" forever, and never written. Turning purchasing on would have sold
  a plan that changed nothing.

  **The guidance limit is enforced**, held inside `generateContent` rather than at each
  call site so a third caller cannot forget it. It **fails open**, which is the opposite of
  how billing fails and deliberately so: only a counted `daily-limit-reached` stops
  anybody, because being wrong here refuses Scripture to somebody at 3am over a network
  blip. A slot is only spent on an answer worth showing. The refusal gets its own screen,
  names the Word and the Vault first, and mentions the plan last.

  **Guests are untouched.** `GUEST.gentleGuidanceDaily` is `0` with a comment saying
  sign-in should come first. Nobody has taken that product decision and this did not take
  it: a signed-out reader never reaches the meter. Recorded so the unenforced `0` reads as
  deliberate.

  **The Journey cap counted restarts, not Journeys.** The client sent `<id>:<seed>` as the
  slot id and `beginJourney` re-rolls the seed, so restarting the same Journey claimed a
  second slot that nothing released. Someone who began Anxiety three times held three
  slots for one Journey. Fixed to the bare id; `normalizeSlotIdsInternal` collapsed the
  rows the old client wrote — **7 of 7 in production carried a seed**, so nobody had a
  clean row. Raised to **3**, and "Journeys active at once" became "Journeys open at a
  time" because only one is ever on screen: that phrase described an experience nobody had
  had. Eight places state that number in two languages and all eight are now pinned to
  `entitlementCatalog.ts` by a suite.

  **Billing only ever spoke to people when something went wrong.** Four emails for a failed
  payment, one before a trial charges, nothing at the moment somebody decides to trust us
  with money, and nothing at all when they join. The only email whose first words were
  "Welcome to Declare & Believe" was `sendVerificationEmail`, and `requireEmailVerification`
  is `false`, so it had never been sent to anybody. There is now a sign-up welcome and a
  Plus welcome in three flavours, both languages, and which flavour is read from the row so
  the email cannot describe a plan the database disagrees with.

  **Eight `console.log("[billing] …")` lines reached nobody.** Four now reach an inbox:
  an unmatched payment, a duplicate subscription, a subscription landing on an account that
  already bought lifetime, and a refund we owe and could not send. Ordinary lifecycle stays
  in the log, because an alert that fires during normal operation is one nobody reads by
  week three. `OPERATOR_EMAIL` set to `support@declareandbelieve.com` on 2026-08-27.

  **Two analytics events were being thrown away.** `analytics.js` drops any event not in its
  allowlist, silently, by design. `guidance_limit_reached` and `checkout_opened` were both
  firing and neither was listed — the second had been missing for as long as the CTA had
  existed. A suite now scans every `track()` call in `src/` and fails if the name is not
  allowlisted, so the next one cannot go quiet.

  20 verify suites, 3,609 checks. Rendered and measured in a real browser in both themes and
  both languages.

- **Plans and Billing separated into two surfaces (2026-08-24, branch
  `feat/plans-billing-experience`).** `/pricing` became **Plans** — one job, "which plan is right
  for me?": a monthly/annual selector, two cards, a short comparison, reassurance and an FAQ.
  Subscription management moved out of the `/you` card onto its own **Billing** page at `/billing`,
  which answers "what do I have and how do I manage it?" and hands payment methods, invoices and
  cancellation to Stripe's hosted Portal rather than rebuilding them.
  Fixed with it: the two cards no longer decide independently whether they are current, so Free and
  Plus can never both look selected — `currentPlanId()` resolves it once and an executed invariant
  proves at most one card is ever current. "Declare stays free", "Nothing here charges you", and
  telling a paying subscriber Plus is "Opening soon" are gone; a non-subscriber now sees the
  truthful "Plus launches soon" while purchasing stays disabled. Family and Church are no longer
  presented as a third consumer plan. Purchasing remains inert until production activation.
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
  fixed (6 entries pointed en/x-default at a since-retired route; full reciprocity now script-verified),
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
- Content pages: About (founder note + Our Mission), Help (`/help`), FAQ (`/faq`).
- v3 app + 14 SEO landing pages live; production Convex + Better Auth; real 404 page.
- Entry flow: Begin page at `/` (v1 retired) + "How it works" landing at `/welcome`.
- Find-a-church fixed (`PUBLIC_GMAPS_KEY` set in Cloudflare prod + preview; key restricted in Google Cloud).
