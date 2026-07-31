# Release C1 Phase 3 — Billing Threat Model

Scope: Plus subscription creation, webhook provisioning, subscription storage
and billing management. Written against the code as implemented, with the
verification evidence that each control actually holds.

**Two donation-era vulnerabilities are the reason this document exists.** Both
are real, both are in production today for donations, and neither is carried
forward.

---

## T1 — Browser-provided user id (spoofing another account's plan)

**Donation-era flaw.** `worker/src/index.js:590-591` accepts
`body.userId` straight from the browser; `public/declare/give.js:32-39` reads it
out of `localStorage['better-auth_session_data']`. Today a spoofed id only
mis-attributes a gift. **Under subscriptions the same line would grant Plus to an
arbitrary account** — or attribute your payment to someone else.

**Control.** Checkout and Portal are Convex actions whose identity comes from
`authComponent.safeGetAuthUser(ctx)`. Neither action declares a `userId`
argument, so Convex's validator rejects one *before the handler runs*.

**Verified.**
```
createCheckoutSession {plan:"plus-monthly", userId:"victim_user_id"}
  → ArgumentValidationError: Object contains extra field `userId`
    that is not in the validator.
```
**Residual risk:** none for this path. The argument does not exist. The legacy
donation route still has the flaw and is out of scope for Phase 3 — it is
recorded in the Phase 4 dependency list because the same Worker will need
identity for Gentle Guidance metering.

---

## T2 — Billing portal IDOR (opening someone else's billing)

**Donation-era flaw.** `worker/src/index.js:637-648` falls back to
`GET /v1/customers?email=…` using a browser-submitted email. Submitting **any**
email opens a Stripe billing portal session for whoever owns it — full access to
that person's payment method, invoices and cancellation.

**Control.** `createPortalSession` takes **no** email and **no** customer id.
The customer comes solely from the `billingCustomers` mapping for the
authenticated user. No email search exists in the new code path. If no mapping
exists the answer is `no-subscription` — never a lookup.

**Verified.**
```
createPortalSession {email:"victim@example.com"}  → ArgumentValidationError
createPortalSession {customerId:"cus_VICTIM"}     → ArgumentValidationError
createPortalSession {} (unauthenticated)          → { error: "not-authenticated" }
```
**Residual risk:** an attacker who fully compromises a session gets that user's
own portal — inherent to being signed in, not an IDOR.

---

## T3 — Arbitrary Stripe Price id submission

**Threat.** Client submits `price_...` for a $0.01 price, a price from another
product, or a price with a different interval than displayed.

**Control.** The client submits a bounded **alias** only. `PRICE_ALIASES` is a
fixed two-key map; anything else returns `unknown-plan`. Price ids come from
server env vars and never from the request.

**Residual risk:** a misconfigured env var could point an alias at the wrong
Price. Mitigation is operational: verify both Price ids in the Stripe dashboard
after setting them, in test mode first.

---

## T4 — Forged plan state (client writes itself Plus)

**Threat.** A signed-in browser writes `tier: "plus"` directly.

**Control.** `subscriptions.ts` exports **no public mutation**. Writes are
`internalMutation` only. Plan state is deliberately **not** in `userData`, whose
`set({key, value})` accepts arbitrary key/value from any authed browser and is
forgeable in one console line.

**Verified.**
```
subscriptions:applyWebhook   → Could not find public function
subscriptions:linkCustomer   → Could not find public function
subscriptions:getByUserInternal → Could not find public function
```
Grep confirms no `export const … = mutation(` in `subscriptions.ts`, and nothing
in `convex/userdata.ts` or `account-sync.js` references tier, plan or
subscription.

---

## T5 — Webhook forgery

**Threat.** Attacker POSTs a fabricated `customer.subscription.updated` granting
themselves Plus.

**Control.** Two independent gates. The Worker verifies the Stripe signature
(HMAC-SHA256, constant-time compare via `timingSafeEqualHex`, 5-minute replay
window) before anything reaches Convex. The Convex ingress additionally requires
`x-billing-secret`, so even a Worker-internal mistake cannot be reached from the
public internet.

**Verified.**
```
wrong x-billing-secret → 401 Unauthorized
no secret header       → 401 Unauthorized
malformed body + valid secret → 400 Bad request
```
**Residual risk:** compromise of `STRIPE_BILLING_WEBHOOK_SECRET` **and**
`BILLING_WEBHOOK_SECRET` together. Separated from the donation secrets so one
product's breach does not become the other's.

---

## T6 — Webhook replay

**Threat.** A captured valid webhook is re-sent to double-apply state.

**Control.** Stripe's own 5-minute timestamp window, plus `billingEvents`
recording every processed `evt_` id. A replay returns `{ok:true, deduped:true}`
and touches nothing.

**Verified.** Same event id twice → second returns `deduped:true`; `billingEvents`
holds exactly one row for it.

**Design note.** The event row is inserted **after** the state write, not before.
If the write throws, the event is not marked processed and Stripe's retry
reprocesses it. The inverse ordering would silently drop a real subscription
change.

---

## T7 — Out-of-order delivery regressing state

**Threat.** Stripe does not guarantee ordering. A late `updated` (status
`active`) arriving after a `deleted` would resurrect a cancelled subscription —
free Plus forever.

**Control.** `applyWebhook` compares the event's `created` against the stored
`lastWebhookCreated` and ignores anything older, returning `{stale:true}`.

**Verified.** Applied `created` t=1000 active → t=3000 canceled → t=2000 active.
Final stored state:
```
status = canceled   tier = free
currentPeriodEnd = 2000   (the stale event's 9999 was rejected)
lastWebhookEventId = evt_2
```

---

## T8 — Duplicate subscriptions (double billing)

**Threat.** A user checks out twice and is charged twice.

**Control.** Checkout inspects server-authoritative state first.
`active`/`trialing`/`past_due`/`unpaid` block. Cancel-at-period-end also blocks —
they already hold Plus through a period they paid for, and buying again would
double-bill that window. Unrecognised statuses refuse rather than guess. A
5-minute bucketed `Idempotency-Key` means a double-click reuses one session.
`incomplete` deliberately falls through, because a fresh session is the correct
recovery for an abandoned attempt.

**Residual risk:** two Checkouts completing inside the same webhook-delivery gap.
Narrow, and Stripe's idempotency key covers the double-click case that causes it
in practice. Worth a reconciliation query before launch.

---

## T9 — Success-page entitlement spoofing

**Threat.** Anyone can open `/checkout/success?session_id=anything`. If the page
granted Plus on arrival, that is free Plus for everyone.

**Control.** The page grants nothing. It polls `mySubscription`, which returns
**only the caller's own row**, and reports Plus only when the server says so. The
`session_id` is never used to look anything up, so a session belonging to another
account cannot surface.

**Verified.** Signed out with `session_id=cs_test_FORGED_BY_ATTACKER` → the
confirmed state stays hidden; the sign-in state renders. Both languages.

---

## T10 — Customer mapping collisions

**Threat.** Two Stripe customers claim one account, or one customer is
repointed to another account — payment methods and invoices cross accounts.

**Control.** `linkCustomer` is idempotent and **throws
`customer-mapping-conflict`** rather than repointing. `billingCustomers` is
indexed both ways so a collision is detectable. Reconciliation is documented as
a deliberate manual procedure; automation is explicitly rejected.

**Residual risk:** requires human handling. Accepted — an incorrect automated
merge attaches one person's card to another's account.

---

## T11 — Historical donor / subscriber confusion

**Threat.** A recurring donor is treated as a Plus subscriber (or vice versa),
so someone gets Plus they never bought, or a donor's portal shows a subscription
they do not hold.

**Control.** Complete separation: separate tables, separate webhook route,
separate signing secret, separate idempotency ledger. The Portal action does not
consult gift history even though it contains customer ids.
`checkout.session.completed` is ignored unless `mode === 'subscription'`.

**Verified.** Grep confirms no read path from `giftHistory`/`giftStats` into any
billing decision.

---

## T12 — Log leakage

**Threat.** Customer ids, subscription ids, emails or amounts in logs.

**Control.** The subscription webhook logs event type and downstream status only
— never the payload. The donation webhook's more verbose logging is untouched and
out of scope.

**Residual risk:** Stripe's own dashboard holds full data (expected and
necessary). No reflection text, struggle text or spiritual content is ever sent
to Stripe: metadata carries `userId` and `plan` alias only.

---

## T13 — Open redirects via billing

**Threat.** Laundering an off-site redirect through a payment provider's
`success_url`, `cancel_url` or `return_url`.

**Control.** All three are built server-side from `SITE_URL`, never from a
browser-supplied origin or path. Contrast the donation flow, which accepts
`body.path` (`worker/src/index.js:405`). The only client influence is `lang`,
coerced to exactly `es` or dropped. On the cancelled page the `plan` param is
bounded to the two known aliases before it reaches an `href`.

**Verified.** `/checkout/cancelled?plan=//evil.com` → link falls back to
`/pricing`.

**Related, already fixed:** commit `ebe13e6` closed a real open redirect in the
auth shells where `?return=/\evil.com` passed a `startsWith` guard.

---

## T14 — Cross-account session access

**Threat.** Reading another account's subscription state.

**Control.** `mySubscription` derives the user from trusted context and queries
`by_user` with that id. It takes no arguments at all, so there is nothing to
point at another account. The returned object is **narrowed**: no
`stripeCustomerId`, no `stripeSubscriptionId`. A compromised client cannot even
name another customer.

---

## Open items before public launch

1. **Set and verify test-mode env vars**, then repeat the authenticated tests
   (see the verification report's "requires credentials" section).
2. **Approve the `past_due` grace window** (recommended 3 days).
3. **Native es-LA editorial review** of the billing strings.
4. **Reconciliation query** for donors who later subscribe.
5. **Donation-era T1/T2 remain live for donations.** Out of scope here, but the
   Worker will need identity for Phase 4 metering — fix them then.
