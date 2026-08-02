# Release C1 — Pricing Strategy

**Status:** implemented on `release-c1-monetization`. **Payments are not active.**
No Stripe Product or Price exists, no StoreKit product exists, and every price
in the catalogue carries `checkoutEnabled: false`.

---

## Plan table

| | Free | Plus | Family | Church & Groups |
|---|---|---|---|---|
| **Availability** | available | opening soon | coming soon | contact |
| **Web monthly** | $0 | **$8.99** | $14.99 *(planned)* | custom |
| **Web annual** | $0 | **$79.99** | $149.99 *(planned)* | custom |
| **iOS monthly** | $0 | $9.99 *(planned)* | $16.99 *(planned)* | — |
| **iOS annual** | $0 | $89.99 *(planned)* | $169.99 *(planned)* | — |

### Free — deliberately not crippled

Core Bible and Declare experience · saved content with an account · Vault and
completed Journey history · **2 active Journeys** · **3 successful Gentle
Guidance responses per account day** · crisis and support resources always free ·
no ads.

Free is a real plan, not a trap. The Scripture at the heart of the product is
the part that stays free.

### Plus — only what is built

Everything in Free, plus **unlimited Gentle Guidance** and **unlimited active
Journeys** at the product level. Invisible abuse, concurrency and
service-stability protections still apply and are deliberately *not* advertised
as product limits.

Nothing unbuilt is advertised. Scripture memory, weekly reflection, Journey
timeline and exports sit in a separate "Coming to Plus" block with no payment
promise attached.

### Family — planned, not shipped

Up to five individual accounts · private Vaults · optional shared prayer circles
or collections · shared family Journeys · opt-in sharing. **All planned.** The
page says Coming Soon, shows planned pricing as prose, and offers no purchase
control and no waitlist (because no waitlist exists yet).

### Church & Groups — contact only

Custom pricing, real contact path, no automated checkout.

---

## Annual savings (computed, never typed)

Savings are computed against **12 × the monthly price** — the only comparison a
customer could actually have made. They are never computed against the future
standard price, which nobody has ever paid.

| Plan | Monthly | ×12 | Annual | Save | Per month | % |
|---|---|---|---|---|---|---|
| Plus web | $8.99 | $107.88 | $79.99 | **$27.89** | $6.67 | **26%** |
| Family web | $14.99 | $179.88 | $149.99 | $29.89 | $12.50 | 17% |
| Plus iOS | $9.99 | $119.88 | $89.99 | $29.89 | $7.50 | 25% |
| Family iOS | $16.99 | $203.88 | $169.99 | $33.89 | $14.17 | 17% |

All 20 figures verified programmatically against the shipped module.

---

## $8.99, not $8.97 — a product decision

`$8.99` is familiar subscription pricing. It reads as intentional and premium,
and maps cleanly onto App Store price tiers, which matters because the same plan
must exist on both storefronts without looking arbitrary. `$8.97` reads as
aggressive direct-response pricing — the register of a promotion, not of
something you keep. For an app people reach for at 3am, the quieter number is
the right one.

---

## Founding pricing and the reference-price rule

| | Founding (launch) | Future standard |
|---|---|---|
| Plus monthly | $8.99 | $10.99 |
| Plus annual | $79.99 | $99.99 |
| Family monthly | $14.99 | $17.99 |
| Family annual | $149.99 | $179.99 |

**The rule, and why it is not negotiable.** $10.99 has never been charged to
anyone. Presenting it as *"Was $10.99"*, *"Previously"* or *"Normally"* would
claim a discount that never happened — false on its face, and the kind of thing
that quietly costs trust in a product about honesty.

So the page says:

- **"Founding pricing planned for launch"** for the current price
- **"Future standard price: $10.99"** for the reference figure

The label states what the number *is*: a forward-looking intention.

Explicitly excluded: fake countdowns, false urgency, invented scarcity or
deadlines, fabricated customer counts, invented testimonials, lifetime price
promises.

---

## Page structure (approved copy, implemented)

| Section | Content |
|---|---|
| Hero | "Start free. Go deeper when you're ready." + kicker + supporting paragraph |
| Toggle | Monthly · **Annual — Save about 26%** (percentage computed) |
| Free | "Begin with Scripture" · $0 · Included-with-Free list · **Continue Free** · "No payment method required." |
| Plus | "Keep going without limits" · founding price · future standard · annual detail · **Opening Soon** (disabled) |
| Family | "Grow together, privately" · Coming Soon · planned pricing · planned-feature list · **no waitlist button** |
| Church & Groups | "Support spiritual formation together" · Custom pricing · **Contact Us** (real mailto) |
| Compare plans | 7-row table, Free vs Plus |
| No trial countdown | "Free does not expire" |
| FAQ | 8 questions |
| Our commitment | Plus changes capacity, not worth or God's nearness |

**Two conditional rules were honoured, not assumed.** Family has **no waitlist
button** because no waitlist exists — a button collecting nothing is worse than
no button. Church shows **Contact Us** only because a real mailto path exists.

The cross-platform FAQ answer is written in the conditional — *"once mobile
purchase synchronization is available"* — because iOS sync is not implemented,
and presenting it as live would be a promise we cannot keep.

Every number on the page is derived: Free's limits read from the server's
entitlement catalog, and all prices and savings from `src/data/pricing.ts`.

---

## Cross-platform entitlement

One entitlement system, platform-specific storefront prices. A verified purchase
grants the same Plus access whether it came from Stripe on the web or Apple on
iOS. **There are no separate web and iOS feature tiers**, and a subscriber never
pays twice.

Customer-facing disclosure is one restrained line:

> Prices may vary when purchased through an app store.

It does not mention Apple's cut, does not steer anyone to the web to "save", and
does not editorialise about platform economics. That is our business problem,
not the reader's.

---

## Spiritual-safety copy rules

The page must never imply that paying yields greater access to God, divine
favour, spiritual status, stronger prayer, or guaranteed healing or
transformation. The footer states the boundary plainly: *paying changes what the
app allows, not what God gives.*

Subscription language only — plan, subscription, billing interval, renewal,
cancellation, access. Never donation, giving, gift, contribution, or
tax-deductible.
