# Hope Finder App — CLAUDE.md

## What This Project Is
A faith-based mind renewal web app built on Romans 12:2. It meets Christians at their lowest moment — fear, shame, broken identity, sleepless nights of doubt — and speaks God's Word back to them through personalized Scripture, declarations, and prayer.

**Live URL:** declareandbelieve.com
**Owner:** JC Kingdom Ventures, LLC — Jeff
**GitHub:** github.com/mtxdev15/hope-finder-app

---

## My Experience Level
I am not a professional developer. I am learning as I build. Always:
- Explain the why behind every change, not just the what
- Give step-by-step instructions
- Never assume prior knowledge
- Make surgical edits — never rewrite everything at once
- Flag risks before making changes
- Ask before touching anything that could break the live site

---

## Tech Stack
- **Framework:** Astro (V1)
- **Styling:** Tailwind CSS (V1)
- **AI Engine:** Anthropic Claude — Haiku 4.5 (claude-haiku-4-5-20251001) for the instant struggle response; Sonnet 4.6 (claude-sonnet-4-6) for the 5-day Journey
- **API Security:** Cloudflare Workers (proxy — API key never touches frontend)
- **Worker URL:** hope-finder-worker.thinktoro.workers.dev
- **Rate Limiting:** 10 requests per IP per minute (enforced in the Worker)
- **Hosting:** Cloudflare Pages + Cloudflare Workers
- **Domain:** declareandbelieve.com (registered and managed in Cloudflare)
- **Version Control:** GitHub (hope-finder-app)

---

## File Structure
hope-finder-app/
├── CLAUDE.md                               — this file
├── README.md                               — repo description
├── declare-and-believe-system-prompt.md    — AI behavior instructions
├── declare-and-believe-project-brief.md    — app identity and keywords
├── declare-and-believe-builders-brief.md   — tech stack and roadmap

---

## Non-Negotiable Rules
1. **Never expose the Anthropic API key in frontend code — ever**
2. The API key lives in Cloudflare Workers environment variables only
3. The browser calls the Worker, the Worker calls Anthropic
4. **Mobile first — always. The 3am user is on their phone**
5. Every page and component must be fully mobile optimized and responsive
6. Test locally before every push to GitHub
7. One change at a time — never refactor and add features simultaneously
8. Every feature decision comes back to: does this help someone encounter God's Word?

---

## Current Status
- [x] Working app built (src/pages/index.astro — migrated from declare-and-believe.html)
- [x] System prompt written
- [x] Project brief written
- [x] Repo created (hope-finder-app)
- [x] Files moved into repo locally
- [x] Astro initialized with Tailwind CSS
- [x] HTML converted to Astro components
- [x] Cloudflare Worker built (API proxy)
- [x] Cloudflare Pages connected to GitHub
- [x] declareandbelieve.com domain connected
- [x] Live

---

## Deployment Pipeline
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

---

## AI Companion
**Name:** HopeFinder Companion (the instant struggle response)
**Model:** claude-haiku-4-5-20251001 (Haiku 4.5 — fast, low-cost, the right tier for instant JSON)
**Temperature:** per caller — 1.0 on `/`, 0.9 on `/today` (module default 0.9)
**Max tokens:** 2048
**Prompt caching:** Enabled — system prompt cached as ephemeral
Full instructions (and the live source of truth, `src/app/declare/declare-api.js`) in `declare-and-believe-system-prompt.md`

**5-day deliverance Journey:** a separate feature in `public/declare/journey-engine.js`, generated one
day at a time on **Claude Sonnet 4.6** (`claude-sonnet-4-6`, max_tokens 1500) — chosen for deeper,
more personal transformation. Flip back to Haiku 4.5 in that file if ever needed.

---

## Design System
- **Forest:** #2D4A3E — primary, buttons, headers
- **Gold:** #C9A84C — accent, highlights
- **Cream:** #FAF7F2 — page background
- **Parchment:** #E8E0D0 — borders, dividers
- **Fonts:** Cormorant Garamond (headings/verses) + DM Sans (body)
- **Mobile:** All components built mobile first, responsive at all breakpoints

---

## Current Architecture (Performance)

The app uses claude-haiku-4-5-20251001 for pastoral response generation. Request flow:

- Frontend (src/pages/index.astro) → Cloudflare Worker (worker/src/index.js) → Anthropic API
- Streaming via Server-Sent Events: the Worker pipes Anthropic's response body through without buffering, and the frontend reads chunks with a stream reader.
- Prompt caching: the system prompt is wrapped with `cache_control: { type: 'ephemeral' }` for ~10x cost reduction on repeat calls.
- max_tokens: 2048 (sized for the JSON response shape).
- Defensive JSON extraction: the frontend slices content between first `{` and last `}` to handle cases where the model appends safety/crisis text after the JSON object.
- The 5-day deliverance Journey (`public/declare/journey-engine.js`) is a separate flow, generated one day at a time on **Claude Sonnet 4.6** (`claude-sonnet-4-6`, max_tokens 1500) for deeper, more personal transformation. The instant struggle response above stays on Haiku 4.5.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
