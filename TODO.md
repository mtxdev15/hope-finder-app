# Declare & Believe — Open Items

A running list of work to continue on the site. Newest priorities at the top of each section.
Done items move to the bottom or get deleted.

## 🔧 In progress / immediate
- [ ] **Find a church** — add `PUBLIC_GMAPS_KEY` to **Cloudflare Pages → Production** env vars
      (copy the value from local `.env`), then redeploy. Confirm in **Google Cloud** that the key has
      **Maps JavaScript API + Places API enabled** and an **HTTP-referrer restriction** including
      `https://declareandbelieve.com/*`. Live `/you` currently shows the "needs its Google Maps key"
      fallback because the var is missing in production.

## ✅ Verify on the live site (manual)
- [ ] **Auth round-trip** on declareandbelieve.com: email sign-up, email sign-in, Google sign-in,
      password-reset email (Resend).
- [ ] **Entry flow** on a phone: new visitor sees Begin → tap Begin → `/today`; revisit `/` same day
      skips to `/today`; signed-in always skips; menu → "How it works" → `/welcome`.
- [ ] **Submit sitemap** to Google Search Console: `https://declareandbelieve.com/sitemap.xml`.

## 🚀 Next features
- [ ] **Vault → Convex (account-synced data).** Today the Vault, profile, and journey live in the
      browser's `localStorage` — a user's saved verses don't follow them to another device. Add a
      Convex schema + sync so signing in keeps their Word tied to their account. This is the real V2
      payoff (the backend is auth-only right now).
- [ ] **`bible-verses-for-*` SEO cluster.** The `bible-verses-for-anxiety` landing was deferred
      because it links to 6 sibling pages that don't exist yet (control, depression, fear,
      overthinking, stress-and-burnout, waiting-on-god). Build the cluster, then ship the landing.
- [ ] **Orphan nav/footer links.** About, Give, Help, Listen have no real pages (currently point to
      `/`). Build them or remove the links.

## 🎨 Polish / ongoing
- [ ] **Cinematic motion parity.** unseen.co-style scroll animations + atmospheric design should
      reach *every* page, mobile-first, smooth and calm. Audit the static SEO pages + utility pages
      for motion parity with the flagship screens.
- [ ] **Homepage SEO watch.** `/` is now the (thin) Begin page; the keyword-rich `<noscript>` block
      is preserved for crawlers. Monitor that the homepage keeps its indexing.

## ✔️ Recently shipped
- v3 app + 14 SEO landing pages live; production Convex + Better Auth; real 404 page.
- Entry flow: Begin page at `/` (v1 retired) + "How it works" landing at `/welcome`.
