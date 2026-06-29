# Declare & Believe — Open Items

A running list of work to continue on the site. Newest priorities at the top of each section.
Done items move to the bottom or get deleted.

## 🔧 In progress / immediate
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
- [x] **Rotate two secrets — DONE (Jeff rotated `RESEND_API_KEY` + `BETTER_AUTH_SECRET`).**
- [ ] **Finish Google OAuth branding (Google Auth Platform → Branding).** App published to production
      (auth fixed). Still: set App name = Declare, support email, home page, privacy `/privacy`, terms
      `/terms`; authorized domains cleaned (added declareandbelieve.com, removed stale Supabase domain).
      Logo upload + Google verification deferred (logo triggers a review). Until verified, the consent
      screen may still show the convex.site domain instead of "Sign in to Declare." Cosmetic, not a blocker.
- [ ] **Give redesign + Stripe checkout (branch `feat/declare-checkout-dev`).** Replacing the old
      stub `/give` with the cinematic "Sow into the river" design (Tree of Life / living water / world
      globe / amount cards / recurring Wellspring / Apple Pay) and wiring real giving via Stripe.
      Architecture: hosted Stripe Checkout created by the Worker (`POST /give/checkout`); secret in
      `wrangler secret STRIPE_SECRET_KEY` (test sandbox "Declare checkout dev" now, live later).
      - [x] Phase 1 — design ported into `public/give.html` + `public/declare/give.{css,js}` +
            `give-globe.js` (exact, Tweaks panel stripped, absolute paths, back → `/welcome`). Builds clean.
      - [x] Phase 0 — `STRIPE_SECRET_KEY` (test) loaded into the Worker.
      - [x] Phase 2 — Worker `/give/checkout` route (one-time + subscription) deployed; `give.js`
            `doGive()` redirects to Stripe; Thank-you on `?status=success`. Verified via curl (test
            sessions return). REMAINING: Stripe Dashboard branding (logo + Forest/Gold) + browser test.
      - [ ] Phase 3 — test card + Apple Pay, one-time + recurring, on a Cloudflare preview URL.
      - [ ] Phase 4 (later) — go live (live keys, merge to main) + Convex `donations` webhook/backfill.
      - [ ] Giving history — let signed-in users see what they have given (total + a list of past gifts).
            Needs each gift linked to the account (pass the user's email/id to Stripe Checkout) + the
            Convex `donations` table (webhook). Pair with Stripe's hosted Customer Portal for receipts +
            self-serve cancel/manage of recurring gifts. UI on `/you` or a small `/giving` page. Builds
            directly on Phases 2 and 4.
      - [ ] Copy/ratio pass — "set free" wording, per-person ratio (design = $2.50/person), yearly
            option, for-profit "gifts are not tax-deductible" disclosure (JC Kingdom Ventures, LLC).

## ✅ Verify on the live site (manual)
- [ ] **Confirm Google sign-in for the reporter.** Publishing the OAuth app to production fixed the
      "can't create an account" block. Have the user who reported it (macaulay.bmt@gmail.com) retry
      "Sign in with Google" and confirm an account is created.
- [ ] **Auth round-trip** on declareandbelieve.com: email sign-up, email sign-in, Google sign-in,
      password-reset email (Resend).
- [ ] **Entry flow** on a phone: new visitor sees Begin → tap Begin → `/today`; revisit `/` same day
      skips to `/today`; signed-in always skips; menu → "How it works" → `/welcome`.
- [ ] **Submit sitemap** to Google Search Console: `https://declareandbelieve.com/sitemap.xml`.

## 🚀 Next features
- [ ] **Spanish translation (large, phased).** Big underserved market. Three layers: (1) Bible text —
      add a Spanish translation to the `/word` reader via api.bible (RV1960 is copyrighted and may be
      gated; RVR1909 is the free fallback); (2) AI content — add a `language` param so the struggle
      response (`src/app/declare/declare-api.js`) and the 5-day Journey (`public/declare/journey-engine.js`)
      generate in Spanish, plus Spanish fallback banks + `DB_CONTENT_ES`; (3) static UI — ~190-240
      hardcoded strings + 33 struggle chips + ~20 SEO pages, and a language toggle / `/es` routing
      (only proof so far: `public/es/heridas-de-la-iglesia.html`). Recommend phasing: core flow +
      results + Journey first, then full UI. Voice: Latin American (es-LA), informal "tú".
- [ ] **(Optional, later) Email verification via magic-link.** Dropped for now (simple sign-up).
      If re-added, use a magic-link flow (it can carry a session cross-domain; plain email-confirm
      links can't). The email template is still in `convex/email.ts`, dormant. Also add a DMARC DNS
      record then to keep verification emails out of spam.
- [ ] **`bible-verses-for-*` SEO cluster.** The `bible-verses-for-anxiety` landing was deferred
      because it links to 6 sibling pages that don't exist yet (control, depression, fear,
      overthinking, stress-and-burnout, waiting-on-god). Build the cluster, then ship the landing.

## 🎨 Polish / ongoing
- [ ] **Homepage SEO watch.** `/` is the (thin) Begin page; the keyword-rich `<noscript>` block
      is preserved for crawlers. Monitor that the homepage keeps its indexing.
- [ ] **Add a logo to the Google consent screen** once you're ready for Google's brand verification
      review (separate, multi-day). Makes the sign-in screen show your mark + "Sign in to Declare."

## ✔️ Recently shipped
- **Giving system — fully live.** Cinematic `/give` + `/es/dar` with Stripe Checkout (one-time +
  recurring, Apple Pay); webhook → Convex public impact counter ("X people set free by the Word of
  God"); account-linked gift history + live next-charge line on `/you`; Stripe Customer Portal to
  manage/cancel; "Manage giving" on the give pages + the Giving terms FAQ; Spanish Giving terms page
  (`/es/terminos-de-donacion`) + hreflang + sitemap. SemVer adopted (now v3.9.1). Supersedes the old
  "Give redesign + Stripe checkout" block above.
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
