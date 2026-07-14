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
*App is on **v3.20.1**. Newest first.*
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
