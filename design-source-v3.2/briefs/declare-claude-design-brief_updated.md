# Declare — Claude Design Brief & Build Prompt

> Paste this whole document into Claude Design. Attach the eight current mockup HTML files, the Open + Superpower reference screenshots, and the favicon / app-icon images. Build the full responsive app — mobile first, then desktop — on the unified design system described below, and prepare it to merge into the existing production app.

---

## 0. The one-paragraph version (read this first)

Design **Declare**, a faith app that gives Christian men Scripture-rooted "words" — a verse, a short reflection, spoken declarations, and a prayer — for whatever is weighing on them in the moment. The whole experience is **cinematic and atmospheric**: a near-black forest-green field with a warm gold glow breaking through like light in darkness, big editorial serif type, generous negative space, refined thin-line icons, soft depth and glow on every surface, and gentle micro-animations throughout. The aesthetic is a deliberate **merge of two reference apps — Open and Superpower** — adapted into Declare's brand. Build it **mobile-first** with a curved bottom tab bar, then **desktop** with a top nav and a proper footer. Every page and section must connect. It must be ready to merge into the existing Astro + Tailwind + Cloudflare production app and must fully incorporate the features the current production app already has.

---

## 1. Brand & naming

- **App name everywhere in the UI: "Declare."** (Short, simple, works as an app name.)
- Full brand / legal name is "Declare & Believe"; the **domain is declareandbelieve.com**. Use "Declare" in the product; "Declare & Believe" only where a full brand name is appropriate (legal footer, metadata).
- Theological anchor: **Romans 12:2** — transformation by the renewing of the mind.
- Audience & tone: the **"3am man"** — a Christian man arriving in fear, shame, loneliness, or pressure, often in private. The app must feel like a **sanctuary**, never clinical or gamified. Calm, reverent, strong, warm. Never cute.

---

## 2. The aesthetic: Open + Superpower, merged into Declare

Study the attached **Open** and **Superpower** screenshots. Pull from them:

- **From Open:** sparse editorial minimalism, giant confident type, heavy negative space, hairline dividers, big tappable text-link menus with trailing arrows, tiny uppercase labels, a clean curved bottom tab bar with icon-only inactive tabs and a single active label, warm dark fields.
- **From Superpower:** long editorial scroll, warm cinematic atmosphere, big section headers, confident spacing, clean top nav on desktop.

**Merge concept — now unified across the whole app:** "Light in the darkness." A near-black forest field with a warm gold glow breaking through from the top/center. This was originally "drama at the threshold, quiet inside," but it is now **one cinematic system end to end** — every screen carries the dark forest field, the gold glow, the serif headline voice, and the floating gold-tinged depth, dialed slightly calmer on long reading screens so Scripture stays effortless to read.

Do **not** let it drift into generic light "app UI." If a screen looks like a default settings page, it's wrong.

---

## 3. Locked design system (use these exact tokens)

Default theme is **dark (cinematic)**; a Light toggle exists and the app should follow the OS setting by default with a manual override (System / Light / Dark / Auto-by-time).

### Color tokens

**Dark (default / cinematic):**
```
--text:#F3EFE6;  --text2:#C7D6CD;  --muted:#92A89E;  --soft:rgba(244,240,231,.6);
--gold:#D8B85F;  --goldd:#E2C572;  --clay:#D08A5B;
--glow1:rgba(222,190,100,.5);  --glow2:rgba(255,238,180,.5);
--bgfield: radial-gradient(135% 95% at 50% 32%, #1a2a21, #0c130f 72%);
--surface:#1b2c23;  --field:rgba(255,255,255,.05);
--line:rgba(244,239,230,.09);  --line2:rgba(244,239,230,.2);
--cta:#D0AE54; --ctatext:#13211A;  --playbg:#D8B85F; --playicon:#13211A;
```

**Light (warm):**
```
--text:#22382E;  --text2:#465A50;  --muted:#7E8E84;  --soft:rgba(34,56,46,.78);
--gold:#C9A84C;  --goldd:#9A7A24;  --clay:#B5703F;
--glow1:rgba(201,168,76,.30); --glow2:rgba(255,243,210,.5);
--bgfield: radial-gradient(140% 92% at 50% -2%, #FFFFFF, #FAF7F2 50%, #F3EDE0 100%);
--surface:#FFFFFF;  --field:#F4ECDB;
--line:rgba(34,56,46,.08);  --line2:rgba(34,56,46,.16);
--cta:#2D4A3E; --ctatext:#FAF7F2;  --playbg:#2D4A3E; --playicon:#FAF7F2;
```

Named brand colors for reference: **Forest #2D4A3E, Gold #C9A84C, Cream #FAF7F2, Parchment #E8E0D0**, plus the cinematic deep field **#0c130f / #13211A** and dark gold **#D8B85F**.

### Typography
- **Cormorant Garamond** (600/500, italic available) — the wordmark, all headings, all Scripture verses, prayers, and tagline lines. This is the soul voice.
- **DM Sans** (400/500) — all UI, nav, labels, body copy, buttons.
- Section labels: tiny **UPPERCASE, ~10px, letter-spacing .2–.26em, gold**.
- Verses set large in Cormorant, generous line-height (~1.34).

### Depth, glow, motion
- Every card/surface **floats**: soft layered shadows + a faint warm gold halo (especially in dark) + a glassy top highlight. Never flat.
- **Gold core-glow** breaks through near the top of each screen (a hot near-white-gold center fading into the deep green). This is the signature — present on every screen, stronger on threshold screens, gentler behind long reading content.
- **Micro-animations:** staggered fade-rise on load (content rises ~15px and fades in, sequential delays), cards lift on hover/press, smooth momentum scroll, the loading state animates a glowing cross/word, gentle parallax on the hero glow. **Always respect `prefers-reduced-motion`.**
- A quiet **gold dot** sits in the masthead as the brand's heartbeat. **No live clock anywhere** (we removed it).

---

## 4. Icons — use awesome, refined icons (not generic)

Use a **high-quality, cohesive icon set** — e.g., Phosphor, Lucide, or Font Awesome (premium/duotone where it elevates) — never default clip-art or mismatched glyphs. Match the **thin-line, ~1.6–1.8 stroke, gold-tinted** style already established in the mockups. Every icon must be **optically aligned and consistently sized** within its context (nav icons ~22–23px, row icons ~17–18px, inline ~12–14px). Replace any character-glyph arrows with real SVG icons so nothing renders as a missing-glyph box.

---

## 5. The struggle chips — canonical list (single source of truth)

This is the **one authoritative list** of struggles. It drives three things that must stay in sync: (a) the chips on the entry screen + More sheet, (b) the per-struggle SEO/AEO landing pages in §11, and (c) the crawlable AEO content. Do not invent, drop, or rename chips outside this list.

**33 generative chips in 4 categories**, plus a separate crisis link (see note).

**Identity & worth (7):** Shame & Guilt · Feeling Like a Failure · Comparison · Feeling Unworthy · Broken Identity · Feeling Lost · People Pleasing

**Wounds & relationships (10):** Emotional & Verbal Abuse · Rejection & Abandonment · Betrayal · Self-Sabotage · Unforgiveness · Family Conflict · Marriage Struggles · Divorce / Separation · Grief & Loss · Loneliness

**Mind & emotion (8):** Fear & Anxiety · Overthinking · Depression · Anger & Bitterness · Doubt · Control · Perfectionism · Stress & Burnout

**Spirit & season (8):** Spiritual Dryness · Waiting on God · Financial Stress · Sexual Temptation · Addiction · Faith Crisis · Feeling Spiritually Attacked · Drifting from God

**Front six (shown on the entry/Today screen, before "More +"):** Fear & Anxiety · Shame & Guilt · Loneliness · Anger & Bitterness · Doubt · Grief & Loss. (One pre-selected, e.g. Fear & Anxiety.) All six exist in the list above.

**Crisis — handle as a link, NOT a chip.** "Suicidal Thoughts" is intentionally **not** a generative chip. The entry screen and More sheet show a visible **"In crisis? Find help now →"** link that routes to real crisis resources (e.g., 988 Suicide & Crisis Lifeline). Never generate AI "word" content for suicidal ideation — route to human help.

---

## 6. Screens to build (eight are attached as HTML mockups — match them, then refine; the two auth screens are designed from this system)

Build each of these; the attached files are the source of truth for layout and feel.

1. **Hero / landing** (`declare-hero-mockup.html`) — cinematic threshold. Gold core-glow, sparse nav (gold dot left, "Menu" right), giant Cormorant **"Declare"**, italic tagline *"Name what's heavy. Receive His Word for this moment."*, corner actions **Begin →** and **Sign in →**. This is also the marketing landing page on web.
2. **Entry** (`declare-entry-mockup.html`) — "What's weighing on your heart?" Pastoral heading, a write-your-own italic input raised to the top with a gold send button, the **front six chips from §5** (Fear & Anxiety, Shame & Guilt, Loneliness, Anger & Bitterness, Doubt, Grief & Loss — one pre-selected) + **More +**, a **Receive the Word** CTA, and a gentle, always-visible **crisis help** link.
3. **Entry — More sheet** (`declare-entry-more-mockup.html`) — full struggle picker as a bottom sheet: grabber + close, write-your-own at top, and **all 33 chips from §5 grouped into the four canonical categories** (Identity & worth, Wounds & relationships, Mind & emotion, Spirit & season), the **crisis link**, and a sticky **Receive the Word · [struggle]** CTA. Note: the attached mockup shows an older 5-category set — **use the §5 list and categories, not the mockup's chips.**
4. **Results** (`declare-results-mockup.html`) — **the signature screen.** A glowing gold vertical spine with four stations: **Scripture** (large Cormorant verse + reference + a "tap to receive" second verse), **Mindset** (short 2–3 sentence reflection + Read more), **Speak it aloud** (declaration rows with play buttons), and **Prayer** (a glowing parchment centerpiece card, italic Cormorant, gold "Amen."). Footer: **Save this word** + **Begin again.** Per-verse and per-declaration saves; the whole result can be saved as "a word" to Anchor.
5. **The Word / Bible** (`declare-bible-mockup.html`) — title "The Word," a **semantic search** field ("try 'water into wine'"), selected translation pills + "All translations," OT/NT segmented control, and grouped, floating book cards (name, one-line description, chapter count). Supports up to 3 parallel translations in the reader.
6. **Anchor / Journal** (`declare-journal-mockup.html`) — titled **"Anchor"** (Hebrews 6:19), "A place to return to what God has spoken." An active practice space: a glowing "Return to your word" card (most recent), "Speak over yourself today" declaration rows, filter pills (All / Mindset / Verses / Declarations / Prayers), and color-coded saved entries.
7. **Profile** (`declare-profile-home-mockup.html`) — an **editable banner** behind the header, a clearly **editable profile photo** (gold camera badge + "Edit photo"), name in big Cormorant, "City · Country" meta (no username). Small Open-style **quick-access chips** (Anchor, Recents, My Church). A big editorial **menu**: Account, Listen & watch, Support Declare, Help & support, About. Wordmark + "Member since" footer. A **Personalize sheet** lets the user set photo / banner / background from **Photos, Take a Photo, or Unsplash.**
8. **Account** (`declare-account-mockup.html`) — cinematic hairline-row hub: editable photo, **Identity** (Name, Email, Country), **Appearance** (System/Light/Dark/Auto), **Reader** (default translation, text size, daily reminder), **My church** (find a church, home church, recently visited), **Listen & watch** (Podcast, YouTube), **Support Declare** (Give a tithe — the only monetization, kept gentle), Sign out, Delete account.
9. **Sign in** *(no mockup attached — design from this system; this is where the hero's "Sign in →" leads).* Same cinematic threshold as the hero: deep forest field with the gold core-glow breaking through the top. Centered, sparse, reverent — not a busy form. A back affordance and the gold dot at top. Small wordmark "Declare," a quiet welcoming line in italic Cormorant (e.g., *"Welcome back."*), then a tight stack: **Email** and **Password** fields (floating-label, hairline underline or soft inset field, gold focus glow, show/hide on password), a primary **Sign in** CTA, a **"Forgot password?"** text link, a hairline "or" divider, and **Continue with Apple / Continue with Google** secondary buttons (refined, monochrome, properly sized icons — not loud brand chips). Footer line: *"New here?* **Create an account →**" routing to Sign up. Calm, generous spacing, staggered fade-rise on load.
10. **Create an account / Sign up** *(no mockup attached — design from this system; this is where the hero's "Begin →" leads for new users).* Mirror of Sign in, same cinematic field and glow. Welcoming italic Cormorant line (e.g., *"Begin your practice."*), fields: **Name, Email, Password** (with a gentle strength hint, not a harsh validator), primary **Create account** CTA, the same Apple / Google options, a single small line for **Terms & Privacy** consent (links to those pages), and a footer *"Already have an account?* **Sign in →**". Keep it short — one screen, no multi-step wizard. After creating, route into **Today** (entry).

> **Auth flow & routing:** Hero **Begin →** goes to **Sign up** for new users (and straight into **Today** once authenticated); **Sign in →** goes to **Sign in**. Both auth screens cross-link to each other. **Forgot password?** opens a minimal matching screen (single email field + "Send reset link" + confirmation state) in the same style. Authenticated users skip the hero and land on **Today**. Keep these screens free of the bottom tab bar.

`declare-prototype.html` is the **clickable, stitched walkthrough** showing the navigation, the bottom tab bar, and the overall flow — use it to understand how screens connect.

---

## 7. Navigation — connect everything

### Mobile: curved bottom tab bar (Open-style)
A floating, blurred bar with a subtle **concave curve** along its top edge, thin line icons evenly spaced, **labels only on the active tab** (tiny uppercase). **Five tabs, with Today centered and emphasized** (slightly larger, gold-tinted, soft glow):

`The Word · Anchor · **Today** · Listen · You`

- **Today** = home / receive a word (entry). **The Word** = Bible. **Anchor** = journal. **Listen** = audio declarations / podcast. **You** = profile.
- Pushed screens (Results, Account, the More sheet) hide the tab bar and use a back affordance.

### Desktop: top nav + footer
- **Top nav:** wordmark "Declare" left; the same destinations as text links right (The Word, Anchor, Listen, About, Give), gold dot, and a profile avatar. Hairline underline / sparse, editorial — Open/Superpower style.
- Reading column centered (~640px) on working screens; hero full-bleed; Bible parallel translations side-by-side.
- **Desktop footer (do not forget this):** wordmark + tagline, columns of links (Product: The Word, Anchor, Listen; Company: About, Support, Give a tithe; Legal: Privacy, Terms), social (Podcast, YouTube), and a closing benediction line **"To God be the glory."** (This phrase is reserved for the footer only.)

**Every page and every section must be connected** — all nav items, menu rows, quick chips, CTAs, and back actions route to real pages. No dead ends.

---

## 8. Assets — favicon & app icon (user-provided)

Use the **favicon and app-icon image files the user provides** (do not invent a logo). Wire them up and export the standard sizes:
- Favicon: 32×32, 64×64
- Apple touch icon: 180×180
- Social / OG preview: 1200×630
- App icon / square: 1080×1080
- Large / hero share: 2560×1440

Set up `favicon`, `apple-touch-icon`, OG image, and Twitter card image with the provided art.

---

## 9. Responsiveness & quality bar

- **Mobile-first**, then scale up to tablet and desktop.
- Everything **aligned and properly sized** — consistent spacing scale, optical alignment, no orphaned or clipped text, no mismatched icon sizes.
- Dark default, light toggle, OS-aware; both themes must be balanced (light not washed-out, dark not muddy).
- Full **micro-animations and animations** as described, with reduced-motion fallbacks.
- Accessible contrast, focus states, tap targets ≥44px.

---

## 10. Incorporate the existing production app completely

This redesign replaces the current UI but must **keep all existing functionality and content**:
- Struggle chips + free-text input → AI-generated **word** (streaming): verse(s), short reflection ("Mindset"), declarations to speak aloud, and a prayer.
- Up to 3 verses / declarations per response; concise reflection.
- The **Bible section** (six translations incl. NIV/NKJV/NLT/KJV/WEB/ASV, semantic search, multi-translation reader).
- Anchor (saved words/verses/declarations/prayers), Profile, Account, tithe link, podcast/YouTube, church finder, crisis link.
- Existing metadata, schema, and the crawlable AEO content must carry over.

Review the prior design's content and **fold all of it in** — nothing the current app does should be lost.

---

## 11. Subpages for indexing (SEO / AEO)

Create real, crawlable subpages so the app indexes well and answers engines can cite it:
- **Marketing home** (hero) + **About / mission** (Romans 12:2 story).
- **Per-struggle landing pages — one for each of the 33 chips in §5** (e.g., `/fear-and-anxiety`, `/shame-and-guilt`, `/loneliness`, `/grief-and-loss`, `/sexual-temptation`, `/marriage-struggles`, …) — each with crawlable Scripture, a short pastoral paragraph, and a CTA into the app. Use the §5 list verbatim as the source for these pages so chips, pages, and AEO content stay in sync. This is the core AEO surface.
- **The Word** browse pages (books) for indexing.
- **FAQ** (~19 Q&A, FAQPage schema), **Give / Support**, **Privacy**, **Terms**.
- Keep a crawlable `<noscript>`/SSR content block covering the chip-specific Scripture paragraphs.

Use Schema.org (Organization, WebSite, FAQPage, and Article/CreativeWork for struggle pages), clean meta descriptions, OG/Twitter cards with the provided art.

---

## 12. Prepare for merge into production

The redesign must drop into the existing stack with minimal friction:
- **Astro v6.3.7 + Tailwind CSS v4.3.0**, hosted on **Cloudflare Pages**, with a **Cloudflare Worker** proxy to the **Anthropic API** (model `claude-haiku-4-5`). Repo: `github.com/mtxdev15/hope-finder-app`, target branch **`v3.1-experience-redesign`**.
- Express the design system as **CSS custom properties / Tailwind theme tokens** (the tokens in §3) so it maps cleanly onto the existing Tailwind config.
- Componentize: nav (mobile tab bar + desktop top nav), footer, cards, the results "spine," sheets, chips, buttons, form fields — reusable Astro components.
- Keep markup **SSR/crawlable**; don't hide content behind JS-only rendering.
- Deliver as Astro pages/components (or framework-agnostic HTML/CSS that ports easily), matching the attached mockups and this system, ready to wire to the existing Worker/AI endpoints.

---

## 13. Deliverables from Claude Design

1. Full responsive app — **mobile + desktop** — for every screen in §6 (including the **Sign in / Sign up / Forgot password** screens, built from the system), on the unified design system in §3.
2. Mobile curved bottom nav (Today centered) **and** desktop top nav **+ desktop footer** (§7).
3. All **subpages** in §11, indexable.
4. Favicon / app-icon / OG wired from the provided assets (§8).
5. Every page and section **connected** (no dead ends), with all **micro-animations** and reduced-motion fallbacks.
6. Design tokens + reusable components, **ready to merge** into the Astro/Tailwind/Cloudflare production app (§12).

Match the attached mockups for layout and feel; elevate the polish; keep it unmistakably **Declare**.
