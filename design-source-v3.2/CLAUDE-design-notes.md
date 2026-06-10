# Declare & Believe — project notes for Claude

## Page name → file mapping (IMPORTANT)
The product's brand names differ from some file names. Always wire to the file, use the brand name in copy:

- **Declare** (the daily "receive a word" page: verse + reflection + declarations + prayer) → **`Today.html`**
  - The live daily experience is `Today.html`, branded "Declare". (The old `Anchor.html` has been removed.)
- **Vault** (saved collections: verses, declarations, prayers) → **`Vault.html`**
  - Replaces the old **Anchor** concept.
- **Journey** → `Journey.html`
- **The Word** (reader) → `TheWord.html`
- **Find a Church** (live Airbnb-style flow) → `Find-a-Church-Flow.html`
- **What's New / Release notes** → `Release-Notes.html` (reached from Account → More; version timeline)
- Home/marketing → `Home.html`

When the user says "Today" they mean **Declare** (`Today.html`); when they say "Anchor" they mean **Vault** (`Vault.html`).

## Account / "You"
- The live account page is **`Account-A.html`**. Every avatar / "You" tab across the app routes here (older `Profile.html`, `Account.html`, `Account-B.html` and the `*-Options` comparison pages have been removed).
- The avatar→Account shared-element morph lives in `account-morph.js` (loaded on every page with a "You" entry point).

## Sharing system (reusable)
- `DeclareShare.open({type, ...})` — one entry point. Loaded via `share.js` (+ `share.css`).
  - `type: church` → channel + Embed sheet.
  - `type: verse | reading | declaration | journey` → routes to the **Card Studio**.
- Card Studio: `card-studio.js` + `card-studio.css` (`window.DeclareStudio`).
  - Backgrounds: 8 cinematic procedural moods, **Unsplash gallery** (CORS-clean, exportable), gradients, solid color, photo upload.
  - **Blur + Darken sliders** for photo legibility.
  - 6 fonts (Cormorant, Playfair, Spectral, DM Sans, Caveat, Bebas).
  - Formats: Post 1:1, Portrait 4:5, Story 9:16, Wide 16:9 → real PNG export → native share.
- Church data layer: `church-api.js` (`window.ChurchAPI`) — mock today, Google Places when `googleKey` set; enrichment via `backendBase`. No church events (out of scope). Online filter dropped per product decision.
- Demo/launcher: `Sharing-Demo.html`.

## Rating / testimony system (reusable)
- `DeclareRate.open({stars, source})` — one entry point. Loaded via `rate.js` (+ `rate.css`). Also `DeclareRate.hasRated()` / `.reset()`.
- Warm, testimony-framed hybrid funnel: 4–5★ → invite to the App Store / Google Play; 1–3★ → **private** feedback (never the store). Collects stars + improvement chips + optional note → `localStorage['declare-rating']` (mock backend).
- Entry points: a **"Rate Declare"** row in `Account-A.html` (More section), and an inline testimony prompt on the **Journey-complete** screen (`<div class="dr-jprompt" data-dr-prompt data-dr-source="…">`). Any `[data-dr-prompt]` is auto-wired and hidden once rated.
- **TODO (dev):** real store IDs live in the `STORE` object at the top of `rate.js` (`apps.apple.com/app/idXXXX`, Play package). Persistence is `localStorage` today — swap for the real backend.

## iOS waitlist (reusable)
- `DeclareWaitlist.open({source, email, signedIn})` — one entry point. Loaded via `waitlist.js` (+ `waitlist.css`). Also `.hasJoined()` / `.reset()`.
- "Coming soon" nudge for the native iPhone app. **Adapts to sign-in state:** signed-in users (email known) get a one-tap join; guests get an email field + a "Sign in to join faster" link. Stores to `localStorage['declare-ios-waitlist']` (mock backend).
- Entry point: a **"Declare for iPhone"** row (`#iosWaitRow`, "Soon" badge) at the top of Account → More. Any `[data-dw-row] .badge` flips to "On the list" once joined. Reusable on marketing pages later (call with `signedIn:false`).

## Canvas screenshots
The studio preview is a `<canvas>`; html-to-image renders it BLACK in screenshots even though it's correct. Verify via `getImageData` pixel sampling, not screenshots.
