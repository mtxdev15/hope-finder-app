/* Declare & Believe — analytics event layer (the privacy choke point).
   Pushes whitelisted, non-PII events to window.dataLayer for GTM → GA4.

   HARD RULE: struggle free text and any PII never leave this file. The
   ALLOWED map below is an allowlist of event names AND the exact property
   keys each may carry. Unknown events are dropped; unknown props are
   stripped. To add an event later, add it to ALLOWED (see
   .agents/tracking-plan.md). Fails closed and never throws. */

const ALLOWED = {
  // pass 1 — the two core conversions
  struggle_submitted: ['struggle_category', 'input_method', 'translation'],
  signup_completed: ['method'],
  // signin_completed has been fired by auth-store.js since Google sign-in
  // shipped, but was never allowlisted — so every one of those events was
  // silently dropped. Allowlisted here with the same single non-PII prop
  // signup_completed carries.
  signin_completed: ['method'],         // method: google | email
  // pass 2 — rate & review (testimonial text is NEVER an allowed key)
  rate_prompt_shown: [],
  rate_started: ['source'],             // source: toast | profile | footer | menu
  rate_submitted: ['rating', 'shared'], // rating: overall 1-5; shared: boolean
  rate_dismissed: [],
  /* Plans and Billing. Every allowed key here is provider-neutral and
     non-identifying by construction: a boolean, a tier word, a cadence word,
     and a presentation-state name. There is deliberately no key for an email,
     a user id, a Stripe identifier, a payment detail or a raw plan object, so
     one cannot be sent by mistake — the stripping below drops anything not
     named, and the event itself is dropped if it is not listed. */
  plans_viewed: ['authenticated', 'displayed_tier', 'selected_interval', 'presentation', 'pricing_enabled'],
  billing_interval_selected: ['authenticated', 'displayed_tier', 'selected_interval', 'pricing_enabled'],
  upgrade_cta_selected: ['authenticated', 'displayed_tier', 'selected_interval', 'pricing_enabled'],
  manage_billing_selected: ['authenticated', 'displayed_tier', 'presentation', 'source'],
  view_plans_selected: ['authenticated', 'displayed_tier', 'source'],
  payment_attention_cta_selected: ['authenticated', 'displayed_tier', 'source'],
  switch_to_annual_selected: ['authenticated', 'displayed_tier', 'source'],
  switch_to_annual_confirmed: ['authenticated', 'displayed_tier', 'source'],
  keep_plus_selected: ['authenticated', 'displayed_tier', 'source'],
  /* THE ONE THAT MATTERS MOST, and it was being dropped. pricing.astro has
     fired this since the CTA was wired, and it was never listed, so the single
     event measuring somebody actually starting a purchase went nowhere.
     `plan_alias` is one of three authored strings from plusPlans.ts and can
     carry no amount, Price or identifier. */
  checkout_opened: ['authenticated', 'displayed_tier', 'selected_interval', 'plan_alias'],
  /* ── The free limits, and the moment each one is felt ──────────────────
     Added 2026-08-27, and `guidance_limit_reached` is a correction rather than
     an addition: today.astro has fired it since the daily limit was wired, and
     it was never listed here, so every one of them was dropped. Exactly what
     the note on signin_completed above describes happening before.
     scripts/verify-guidance-quota.ts now asserts that every event fired
     anywhere in src/ appears in this map, so the next one cannot go missing
     quietly.

     WHAT THESE ANSWER. Whether the ask at the moment of loss earns its place:
     how often somebody reaches a limit, what they do about it, and how many go
     on to look at Plus. Nothing here identifies anybody. */
  guidance_limit_reached: ['authenticated', 'displayed_tier'],
  journey_limit_reached: ['authenticated', 'displayed_tier', 'open_journeys', 'journey_limit'],
  journey_continue_selected: ['authenticated', 'displayed_tier', 'source'],
  /* `journey_category` is a Journey id from journey-data.js, which is a closed
     authored set, exactly like struggle_category on struggle_submitted. It is
     here and nowhere else because it answers something worth acting on: which
     Journeys people give up on. No free text can reach it. */
  journey_let_go_selected: ['authenticated', 'displayed_tier', 'journey_category'],
  journey_upsell_selected: ['authenticated', 'displayed_tier', 'source'],
  // later passes add: word_received, verse_saved, declaration_saved,
  // prayer_saved, journey_started, journey_day_completed,
  // struggle_page_cta_clicked
};

export function track(event, props) {
  try {
    if (typeof window === 'undefined') return;
    const allow = ALLOWED[event];
    if (!allow) return; // unknown event → drop (fail closed)
    const safe = {};
    for (const key of allow) {
      const v = props && props[key];
      if (v !== undefined && v !== null && v !== '') safe[key] = v;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...safe });
  } catch (e) { /* analytics must never break the app */ }
}
