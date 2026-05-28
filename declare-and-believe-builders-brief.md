# Declare and Believe — Builder's Brief
*The working guide for building, deploying, and growing DeclareAndBelieve.com*
*Owner: JC Kingdom Ventures, LLC — Jeff*

---

## Who Is Building This

Jeff is building this for the first time as a serious project. He is not a professional developer but has a professional developer's setup and is willing to learn every step of the process. He has:

- MacBook Air M2, 24GB RAM, 1TB storage
- GitHub account with iTerm2 configured with GitHub shortcuts
- VS Code as his IDE
- Cloudflare account with `declareandbelieve.com` registered
- Anthropic API key
- YouVersion API application in progress

**How Claude should work with Jeff:**
- Step-by-step instructions for every technical task
- Explain the *why* behind each step, not just the *what*
- Never assume prior knowledge — always clarify
- Surgical edits over full rewrites when possible
- Flag risks before making changes
- Ask before touching anything that could break the live site

---

## The Vision

Declare and Believe is a faith-based mind renewal web app built on Romans 12:2. It meets Christians at their lowest moment — fear, shame, broken identity, sleepless nights of doubt — and speaks God's Word directly back to them through personalized Scripture, pastoral explanation, declarations, and prayer.

Jeff will drive traffic through his **Podcast** and **YouTube Channel**. The tool is expected to see significant usage from launch. It is built to scale.

**Six-month north star:** A monetized, account-based platform that has genuinely helped thousands of people renew their minds with God's Word — and has a live counter proving it.

---

## Tech Stack

| Layer | Tool | Status |
|---|---|---|
| Framework | Astro | Live ✓ |
| Styling | Tailwind CSS | Live ✓ |
| AI Assistant | Claude Code (CLI) | Ready ✓ |
| IDE | VS Code | Ready ✓ |
| AI Engine | Anthropic Claude (claude-haiku-4-5-20251001) | Integrated ✓ |
| API Security | Cloudflare Workers (serverless proxy) | Live ✓ |
| Worker URL | hope-finder-worker.thinktoro.workers.dev | Live ✓ |
| Hosting | Cloudflare Pages | Live ✓ |
| Domain | declareandbelieve.com via Cloudflare | Registered ✓ |
| Version Control | GitHub (hope-finder-app) | Ready ✓ |
| Database | Supabase (PostgreSQL) | V2 |
| Auth | Supabase Auth | V2 |
| Bible API | YouVersion (pending approval) | Applied / waiting |
| Bible Bridge | Claude writes verse text until YouVersion approved | Active ✓ |
| Payments | Stripe | V3 |
| Analytics | Cloudflare Analytics | V3 |

---

## Deployment Pipeline

```
VS Code + Claude Code (write and edit code)
    ↓
Astro build (compiles to static files)
    ↓
GitHub (push changes — triggers auto deploy)
    ↓
Cloudflare Pages (serves the Astro build)
  + Cloudflare Workers (secure API proxy)
    ↓
declareandbelieve.com (live)
```

**API Key Security Rule — Non-Negotiable:**
The Anthropic API key must NEVER be exposed in frontend code. It lives in Cloudflare Workers environment variables only. The browser calls the Worker, the Worker calls Anthropic. The key never touches the client.

Same rule applies to all future API keys (YouVersion, Google, etc.)

---

## Version Roadmap

### Version 1 — Ship the Core (Current Focus)
**Goal:** Get the declarations experience live at declareandbelieve.com

- [x] Declarations app logic built (HTML)
- [x] Struggle chips + free text input
- [x] Claude-powered Scripture, explanation, declarations, prayer
- [x] NKJV / NLT / NIV translation toggle
- [x] Crisis banner with 988 lifeline
- [x] Copy / Share / Save actions
- [x] SEO / AEO / GEO meta tags
- [x] Install Claude Code CLI
- [x] Initialize Astro project with Tailwind CSS
- [x] Convert HTML to Astro components
- [x] Build Cloudflare Worker as secure API proxy
- [x] Set up Cloudflare Pages — connect to GitHub
- [x] Connect declareandbelieve.com domain
- [x] Design and add logo
- [x] Test end-to-end on mobile
- [x] Launch

**Version 1 is done when:** A stranger can go to declareandbelieve.com, describe their struggle, and receive God's Word — with zero errors and zero exposed API keys.

---

### Version 2 — Community & Accounts
**Goal:** Give users a reason to come back

- User authentication: Apple ID, Google, YouVersion, Email
- Personal dashboard
- Save declarations, prayers, mindset breakthroughs
- Share results as cards or links
- YouVersion Bible integration (when API approved)
- Email newsletter signup / capture

---

### Version 3 — Growth & Monetization
**Goal:** Sustainable revenue to support the ministry

- Donation system (Stripe or similar)
- Google Ads integration
- Live user counter — "X people set free today" (homepage dashboard)
- Analytics dashboard (internal)
- SEO-optimized landing pages per struggle topic

---

### Version 4 — Destination Platform
**Goal:** Declare and Believe becomes the go-to Christian mind renewal destination

- Full Bible reader (YouVersion)
- Site-wide search — declarations, Scripture, mindset topics
- Blog / editorial content (Jeff's voice)
- AI learns user patterns and adapts responses over time
- Podcast and YouTube content integration

---

## Traffic Strategy

Jeff drives traffic through:
- **Podcast** — direct listeners to the tool during episodes
- **YouTube Channel** — demonstrations, testimonies, call-to-action to use the app

**SEO anchor:** The app is built to rank for 2–4am crisis searches — "I feel worthless," "Bible verses for anxiety," "what does God say about me." See `declare-and-believe-project-brief.md` for full keyword strategy.

---

## Design System

The visual identity is fully defined. See `declare-and-believe-brand.html` for the complete brand guide.

**Styling approach:** Tailwind CSS with custom design tokens extending the brand colors. All brand values are configured in `tailwind.config.mjs` so every component uses the same palette automatically.

**Core tokens:**
- Forest: `#2D4A3E` — primary, buttons, headers
- Gold: `#C9A84C` — accent, highlights
- Cream: `#FAF7F2` — page background
- Parchment: `#E8E0D0` — borders, dividers
- Fonts: Cormorant Garamond (serif, headings/verses) + DM Sans (sans, body)

**Logo:** Live. Cross icon + "Declare & Believe" wordmark in Cormorant Garamond. "Believe" in italic.

---

## AI Engine

**Name:** HopeFinder Companion
**Model:** claude-haiku-4-5-20251001
**Temperature:** 0.7
**Max tokens:** 1500

Full system prompt lives in `declare-and-believe-system-prompt.md`. That file is the source of truth for all AI behavior. Any changes to tone, declarations, format, or crisis protocol are made in declare-and-believe-system-prompt.md first, then reflected in src/pages/index.astro.

**Verse text:** Claude writes verse text directly in the selected translation (NKJV, NLT, NIV) until YouVersion API is approved. When YouVersion is integrated, the `text` field returns to `""` and YouVersion fills it. No other structural changes needed.

---

## Rules for Building

1. **Never expose API keys in frontend code** — ever
2. **Mobile first** — the 3am user is on their phone
3. **Ship simple, add complexity** — version 1 is one page, one purpose
4. **Test before deploy** — always test locally before pushing to GitHub
5. **One change at a time** — never refactor and add features simultaneously
6. **Brand consistency** — every new element follows the design system
7. **God first** — every feature decision comes back to: does this help someone encounter God's Word more effectively?

---

*Last updated: May 2026*
