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
- [ ] **Finish Google OAuth branding (Google Auth Platform → Branding).** App published to production
      (auth fixed). Still: set App name = Declare, support email, home page, privacy `/privacy`, terms
      `/terms`; authorized domains cleaned (added declareandbelieve.com, removed stale Supabase domain).
      Logo upload + Google verification deferred (logo triggers a review). Until verified, the consent
      screen may still show the convex.site domain instead of "Sign in to Declare." Cosmetic, not a blocker.

## ✅ Verify on the live site (manual)
- [ ] **Auth round-trip** on declareandbelieve.com: email sign-up, email sign-in, Google sign-in,
      password-reset email (Resend).
- [ ] **Entry flow** on a phone: new visitor sees Begin → tap Begin → `/today`; revisit `/` same day
      skips to `/today`; signed-in always skips; menu → "How it works" → `/welcome`.

## 🚀 Next features
- [ ] **Full Spanish app — see the dedicated tracked plan: [`SPANISH-APP-PLAN.md`](SPANISH-APP-PLAN.md).**
      Jeff greenlit the WHOLE app in Spanish (banner + toggle, auto-detect flips on last; RVR1909-only
      + default in the Spanish Word; Yesenia Then voice for Spanish Profundiza; chip-autofill invariant
      preserved). Work lives on branch `feature/es-full-app`. Layers 1-2 done (Bible + SEO pages);
      Layers 3-5 (app UI strings, AI-in-Spanish, detect/banner/toggle) remain. That plan supersedes the
      rough three-layer note below.
- [ ] **Spanish translation (large, phased).** Big underserved market. Three layers: (1) Bible text —
      add a Spanish translation to the `/word` reader via api.bible (RV1960 is copyrighted and may be
      gated; RVR1909 is the free fallback); (2) AI content — add a `language` param so the struggle
      response (`src/app/declare/declare-api.js`) and the 5-day Journey (`public/declare/journey-engine.js`)
      generate in Spanish, plus Spanish fallback banks + `DB_CONTENT_ES`; (3) static UI — ~190-240
      hardcoded strings + 33 struggle chips + ~20 SEO pages, and a language toggle / `/es` routing.
      Recommend phasing: core flow + results + Journey first, then full UI. Voice: Latin American
      (es-LA), informal "tú".
      - **SEO struggle pages → /es (DONE, v3.14.0).** All 14 existing struggle pages are live in
        Spanish with RVR1909 Scripture: `heridas-de-la-iglesia`, `ansiedad`, `depresion`, `soledad`,
        `duelo`, `ira`, `duda`, `fracaso`, `presion-financiera`, `matrimonio`, `proposito`,
        `verguenza`, `falta-de-perdon`, `sobrepensar`. Each has Spanish menu/footer, `Profundiza`
        breakdowns + `data-read-label`, RVR1909 `&t=rvr1909` deep-links, translated JSON-LD FAQ,
        canonical + reciprocal hreflang + sitemap pair. RVR1909 is also live in the `/word` reader.
        Repro script pattern: `scratchpad/es_<slug>.py` (fetch verse text from the deployed worker,
        never fabricate). **Spanish hub `/es/luchas` DONE (v3.15.0)** — all 15 rows point to their
        `/es` slugs, wired into every Spanish page's slide-out menu + footer + breadcrumb (giving pages
        `dar`/`terminos-de-donacion` have no Luchas link, matching the English `/give`). **Still to do:**
        translate any NEW English struggle pages as they ship (as `/es` pages were built, related-link
        cross-links were repointed to live `/es` slugs).
- [ ] **(Optional, later) Email verification via magic-link.** Dropped for now (simple sign-up).
      If re-added, use a magic-link flow (it can carry a session cross-domain; plain email-confirm
      links can't). The email template is still in `convex/email.ts`, dormant. Also add a DMARC DNS
      record then to keep verification emails out of spam.
- [ ] **`bible-verses-for-*` SEO cluster.** The `bible-verses-for-anxiety` landing was deferred
      because it links to 6 sibling pages that don't exist yet (control, depression, fear,
      overthinking, stress-and-burnout, waiting-on-god). Build the cluster, then ship the landing.
- [ ] **Build out SEO struggle pages for the remaining chips — one new page per week.** 13 of 35
      struggles have a `/public/<slug>.html` page; ~22 remain. The weekly cadence is deliberate: a
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
        (shipped 2026-07-02, EN `/burnout` + ES `/es/estres-y-agotamiento`) · [ ] Rejection & Abandonment ·
        [ ] Addiction · [ ] Waiting on God
      - [ ] **Suicidal Thoughts** — build crisis-first: lead with the 988 Suicide & Crisis Lifeline
        (help before content, visible immediately), hope-first non-triggering copy, reuse the app's
        existing 988 banner pattern. Confirm final copy with Jeff before shipping.
      - **Remaining:** [ ] Comparison · [ ] Feeling Unworthy · [ ] Broken Identity ·
        [ ] People Pleasing · [ ] Emotional & Verbal Abuse · [ ] Betrayal · [ ] Self-Sabotage ·
        [ ] Family Conflict · [ ] Divorce / Separation · [ ] Control · [ ] Perfectionism ·
        [ ] Spiritual Dryness · [ ] Sexual Temptation · [ ] Faith Crisis ·
        [ ] Feeling Spiritually Attacked · [ ] Drifting from God
      - **This week:** Overthinking (slug `overthinking`) — pairs with the live `anxiety` page for
        immediate Related-Articles cross-linking. Full build process + verification in
        `~/.claude/plans/please-check-on-whats-shimmering-moore.md`.

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
*App is on **v3.13.0**. Newest first.*
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
  God"); account-linked gift history + live next-charge line on `/you`; Stripe Customer Portal to
  manage/cancel; "Manage giving" on the give pages + the Giving terms FAQ; Spanish Giving terms page
  (`/es/terminos-de-donacion`) + hreflang + sitemap. SemVer adopted at v3.9.1.
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
