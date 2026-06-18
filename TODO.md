# Declare & Believe — Open Items

A running list of work to continue on the site. Newest priorities at the top of each section.
Done items move to the bottom or get deleted.

## 🔧 In progress / immediate
- [x] **Content pages built** — About (`/about`, founder note + Our Mission), Help (`/help`),
      FAQ (`/faq`), Give (`/give`). All links routed site-wide; "Give a tithe" renamed to "Give".
- [ ] **Wire Give payments (Stripe).** `/give` is the finished donation UI but the button is a
      visual stub — it does NOT charge a card yet. Connect a processor (Stripe Checkout / Payment
      Links, or similar) so "Give $X" actually collects the gift. Until then, no real donations flow.

## ✅ Verify on the live site (manual)
- [ ] **Auth round-trip** on declareandbelieve.com: email sign-up, email sign-in, Google sign-in,
      password-reset email (Resend).
- [ ] **Entry flow** on a phone: new visitor sees Begin → tap Begin → `/today`; revisit `/` same day
      skips to `/today`; signed-in always skips; menu → "How it works" → `/welcome`.
- [ ] **Submit sitemap** to Google Search Console: `https://declareandbelieve.com/sitemap.xml`.

## 🚀 Next features
- [ ] **Fast-follow: sync profile + journey state** to Convex the same way the Vault does
      (`profile-store.js` / journey localStorage keys), so the whole account follows the user.
- [ ] **(Optional, later) Email verification via magic-link.** Dropped for now (simple sign-up).
      If re-added, use a magic-link flow (it can carry a session cross-domain; plain email-confirm
      links can't). The email template is still in `convex/email.ts`, dormant. Also add a DMARC DNS
      record then to keep verification emails out of spam.
- [ ] **`bible-verses-for-*` SEO cluster.** The `bible-verses-for-anxiety` landing was deferred
      because it links to 6 sibling pages that don't exist yet (control, depression, fear,
      overthinking, stress-and-burnout, waiting-on-god). Build the cluster, then ship the landing.

## 🎨 Polish / ongoing
- [ ] **Cinematic motion parity.** unseen.co-style scroll animations + atmospheric design should
      reach *every* page, mobile-first, smooth and calm. Audit the static SEO pages + utility pages
      for motion parity with the flagship screens.
- [ ] **Homepage SEO watch.** `/` is now the (thin) Begin page; the keyword-rich `<noscript>` block
      is preserved for crawlers. Monitor that the homepage keeps its indexing.

## ✔️ Recently shipped
- **Vault → Convex account sync** — signed-in users' saved words/verses/declarations/prayers +
  collections persist server-side and follow them across devices (local-first; guests unaffected).
- **Auth working + simplified** — fixed prod `BETTER_AUTH_SECRET` (was 500ing every auth call);
  sign-up is now name + email + password, straight into `/today`, no email-verification step.
- **Struggles hub** (`/struggles`) — editorial index of all 13 struggle pages, grouped into 4
  categories, with scroll-revealed serif rows + hover motion. Linked from the Begin menu, the
  slide-out nav on every struggle page, and the footer (so users + Google discover them on-site,
  not just via AI/search). In the sitemap.
- Content pages: About (founder note + Our Mission), Help (`/help`), FAQ (`/faq`), Give (`/give`).
- v3 app + 14 SEO landing pages live; production Convex + Better Auth; real 404 page.
- Entry flow: Begin page at `/` (v1 retired) + "How it works" landing at `/welcome`.
- Find-a-church fixed (`PUBLIC_GMAPS_KEY` set in Cloudflare prod + preview; key restricted in Google Cloud).
