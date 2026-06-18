# Declare & Believe — Analytics Tracking Plan

*Last updated: 2026-06-18. Owner: Jeff (JC Kingdom Ventures, LLC).*

## Overview
- **Tools:** Google Tag Manager (`GTM-T65GXR22`) loads on every page; Google Analytics 4
  (`G-V0NW7N8RFR`) is configured as a tag *inside* GTM. No hard-coded gtag snippet.
- **Property mode:** analytics-only (see Privacy). This is not an advertising property.
- **Scoreboards:** Search Console is the primary instrument for the ranking goal (impressions,
  queries, position, indexed count). GA4 measures on-site behavior only.

## Hard privacy rule (non-negotiable)
This app receives people's rawest struggles, which reveal religious belief and mental-health state.
- **Category only, never the free text.** The struggle text a user types is NEVER pushed to
  `dataLayer`, sent to GA4, or stored in any analytics property. Only a normalized `struggle_category`
  is sent.
- **No PII in any event or property.** No names, emails, message text, or user-typed content.
- **GA4 settings:** Google Signals OFF, all advertising / ads-personalization features OFF, data
  retention set to 2 months.
- The `track()` helper is the single choke point; it only forwards the whitelisted properties below.

## Naming conventions
- Events: `object_action`, lowercase, underscores (e.g. `struggle_submitted`).
- Properties: lowercase snake_case. Values are short slugs from the controlled lists below.

## Event reference

| Event | Properties | Trigger | Conversion? | Wired in pass 1? |
|---|---|---|---|---|
| `struggle_submitted` | `struggle_category`, `input_method`, `translation` | User submits a struggle on `/today` | **Yes (primary)** | **Yes** |
| `signup_completed` | `method` | `signUp` success in `auth-store.js` | **Yes (secondary)** | **Yes** |
| `word_received` | `struggle_category` | AI response renders successfully | no | later |
| `verse_saved` | `type` | Save action in `vault-store` | no | later |
| `declaration_saved` | `type` | Save action in `vault-store` | no | later |
| `prayer_saved` | `type` | Save action in `vault-store` | no | later |
| `journey_started` | `day_number` | Journey begun | no | later |
| `journey_day_completed` | `day_number` | Journey day finished | no | later |
| `struggle_page_cta_clicked` | `struggle`, `cta` | CTA click on a `/struggles` landing page | no | later |

## Property value lists (controlled vocab)
- `struggle_category`: a normalized slug, never free text. The vocabulary is the actual `/today` chip
  labels (a closed UI set: 39 chip buttons, 33 unique categories — 6 labels appear in both the entry
  row and the More sheet, so they dedupe), slugified and bounded by the `KNOWN_STRUGGLES` allowlist in
  `today.astro`: `fear_and_anxiety`, `shame_and_guilt`, `loneliness`, `anger_and_bitterness`, `doubt`,
  `grief_and_loss`, `feeling_like_a_failure`, `comparison`, `feeling_unworthy`, `broken_identity`,
  `feeling_lost`, `people_pleasing`, `emotional_and_verbal_abuse`, `rejection_and_abandonment`,
  `betrayal`, `self_sabotage`, `unforgiveness`, `family_conflict`, `marriage_struggles`,
  `divorce_separation`, `overthinking`, `depression`, `control`, `perfectionism`, `stress_and_burnout`,
  `spiritual_dryness`, `waiting_on_god`, `financial_stress`, `sexual_temptation`, `addiction`,
  `faith_crisis`, `feeling_spiritually_attacked`, `drifting_from_god`. Typed free text (and any value not
  on the allowlist, e.g. a tampered `?struggle=` param) is recorded as `other`; the raw text is
  discarded at the call site and never reaches `track()`.
- `input_method`: `preset` (chose from the list) | `typed` (free text box).
- `translation`: `nkjv` | `nlt` | `niv`.
- `method`: `email` | `google`. *(Pass 1 wires `email` only; Google sign-ups go through the OAuth
  redirect path and are a later follow-up.)*

## Event layer contract
A small helper pushes to `dataLayer`; GTM Custom Event triggers forward to GA4:
```js
// track(event, props) — only whitelisted, non-PII props are forwarded
window.dataLayer = window.dataLayer || [];
function track(event, props) {
  window.dataLayer.push({ event, ...props });
}
// example (note: NO struggle text, ever)
track('struggle_submitted', { struggle_category: 'anxiety', input_method: 'preset', translation: 'nkjv' });
```

## GA4 configuration (done in dashboards, not code)
- Mark `struggle_submitted` and `signup_completed` as **key events (conversions)**.
- **Referral exclusions:** `keen-hamster-650.convex.site` (live auth host) and `accounts.google.com`
  (OAuth), so returning signed-in users keep their true source.
- Google Signals OFF, ads features OFF, retention 2 months.

## Validation gate (before publishing GTM / merging to main)
- GTM Preview + GA4 DebugView confirm `struggle_submitted` and `signup_completed` each fire **once**,
  with correct properties.
- Inspect the payloads: **zero struggle text, zero PII**.
- Build clean; GTM ID present on every page type; `<noscript>` iframe directly after each `<body>`.

## Deferred to a later pass
`word_received`, `verse_saved` / `declaration_saved` / `prayer_saved`, `journey_started` /
`journey_day_completed`, `struggle_page_cta_clicked` — wired after the two-conversion pipeline is
validated.
