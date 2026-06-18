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
