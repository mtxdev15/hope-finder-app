# Declare & Believe — v3.2 Design Source (reference only)

This folder is the **design source of truth** for the v3 redesign. It is the curated output of the
Claude Design v3.2 build. It is **reference material, not buildable code** — it must live OUTSIDE
`src/` so Astro never tries to build the raw HTML. Recommended location in the repo:
`design-source/v3.2/`.

Every page here is a self-contained HTML file with its own inline head, anti-flash script, and styles.
The integration job is to decompose these into a shared Astro layout + components, and to bring the
shared vanilla JS modules in as plain scripts (no React, no hydration needed). The working v1 Declare
flow in the live repo is the anchor — we re-skin it into this design first, then build the other tabs.

Excluded from this bundle on purpose: the Google Gemini demo applet (a pitch tool, not the product),
the older `app/*.jsx` React-in-browser representation (superseded), and several hundred scratch
screenshots. Ask if any of those are needed.

---

## The five tabs (brand name → file)

The product's brand names differ from some file names. Wire to the file, use the brand name in copy.

- **Word** (in-app Bible reader) → `declare/TheWord.html`
- **Journey** (multi-day adaptive identity journey) → `declare/Journey.html`
- **Declare** (the hero center action: name a struggle → verse + reflection + declarations + prayer) → `declare/Today.html`
- **Vault** (saved verses, declarations, prayers) → `declare/Vault.html`
- **You** (profile + settings) → `declare/Account-A.html`

Entry / shell: `declare/Opening.html` (the near-empty "begin" page) → `declare/Hero.html` / `declare/Home.html` (landing with struggle input).

## SEO content pages (English)

`anxiety, depression, shame, doubt, grief, loneliness, failure, purpose, anger, financial-pressure,
marriage, unforgiveness, church-hurt` — each is `declare/<name>.html`.
Spanish flagship: `declare/es/heridas-de-la-iglesia.html` (Church Hurt).

## Supporting / system pages

`Crisis, FAQ, Help, About, Privacy, Terms, Give, Listen, Results, Breath, Loading, Release-Notes,
Create-Account, Signin, Find-a-Church-Flow`. Plus design-doc pages (`Design System, Motion-System,
Architecture, App-Flow, Church-Data-Spec, ScrollStory, System, Sharing-Demo`) — these are internal
references, not user-facing pages.

Legal/marketing standalones also in `legal/` (about, contact, privacy, terms + legal.css) and
`landing/` (a sample SEO landing + landing.css).

---

## Shared vanilla JS modules (declare/*.js) — reuse these, no React

- `theme.js` — light/dark theme switch + persistence
- `route-loader.js` (+ `route-loader.css`) — page-to-page transition overlay (works with View Transitions)
- `motion.js` (+ `motion.css`) — premium motion primitives (Unseen-Studio-inspired easing)
- `declare-tabbar.js` — the five-tab bottom navigation
- `breath-ring.js` — the breathwork orb (Open-style expand/contract)
- `journey-engine.js` — the multi-day Journey state machine (Vine metaphor, nine daily movements)
- `account-morph.js` — avatar → Account shared-element morph (loaded wherever a "You" entry exists)
- `church-api.js` — the single data seam for Find a Church. Mock today; flips to **Google Places API (New)**
  the moment a key is set via `ChurchAPI.config({ googleKey })`. Geocoding + Nearby/Text Search.
- `church-shared.js` (+ `church-shared.css`) — shared church UI helpers
- `search-flow.js` (+ `search.css`) — the Airbnb-style Find-a-Church search flow
- `card-studio.js` + `card-studio-data.js` (+ `card-studio.css`) — shareable verse/declaration card export (PNG)
- `share.js` (+ `share.css`) — `DeclareShare.open({type})` single share entry point → routes to Card Studio
- `rate.js` (+ `rate.css`) — testimony-framed rating funnel (4–5★ → store, 1–3★ → private feedback)
- `waitlist.js` (+ `waitlist.css`) — iOS "coming soon" waitlist capture
- `bible-data.js` — local verse data (bridge until the Bible APIs are wired through the Worker)

## Core CSS

- `declare.css` — the main app stylesheet (dark cinematic tokens + components)
- The rest are feature-scoped (`card-studio`, `church-shared`, `search`, `share`, `rate`, `waitlist`,
  `route-loader`, `motion`).

---

## Briefs (briefs/)

Design + build references, including: the **MASTER-design-brief.md**, the Journey section briefs and
Claude Design prompts, the SEO page handoffs and additions, the closing-block mappings, and small
reference mockup HTMLs under `briefs/reference-mockups/`. `CLAUDE-design-notes.md` (root) holds the
authoritative brand-name → file mapping and the sharing/rating/waitlist system notes.
