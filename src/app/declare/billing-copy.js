/* Declare & Believe — billing state copy (English + Spanish).
 *
 * The billing actions in convex/billing.ts return CODES, never sentences:
 * 'already-subscribed', 'no-subscription', 'stripe-error', and so on. That is
 * deliberate — a server response that carries English prose cannot be shown to
 * a Spanish reader, and localisation does not belong in a payments backend.
 * This module is the single place those codes become words.
 *
 * Follows the house convention: English inline here, Spanish via the global
 * I18N engine. No third string system.
 */

function esL() {
  try {
    return !!(window.I18N && window.I18N.lang && window.I18N.lang() === 'es');
  } catch (e) { return false; }
}

function t(key, en) {
  try {
    if (esL() && window.I18N && window.I18N.t) {
      const s = window.I18N.t(key);
      if (s) return s;
    }
  } catch (e) {}
  return en;
}

/* Every code the billing actions can return, plus a deliberate default.
 * `action` tells the caller what control to offer, so a state that needs the
 * billing portal never renders a "try again" button that would just fail. */
const STATES = {
  'already-subscribed': {
    key: 'billing.alreadySubscribed',
    en: 'You already have an active subscription. Manage it from your account.',
    action: 'portal',
  },
  'no-subscription': {
    key: 'billing.noSubscription',
    en: 'We could not find an active subscription on this account.',
    action: 'none',
  },
  'not-authenticated': {
    key: 'billing.signinRequired',
    en: 'Sign in to manage your billing.',
    action: 'signin',
  },
  // Everything below is our problem, not theirs, so the copy never asks the
  // person to fix something they cannot fix.
  'billing-not-configured': {
    key: 'billing.unavailable',
    en: 'Billing is not available right now. Please try again in a moment.',
    action: 'retry',
  },
  'stripe-error': {
    key: 'billing.unavailable',
    en: 'Billing is not available right now. Please try again in a moment.',
    action: 'retry',
  },
  'unknown-plan': {
    key: 'billing.unavailable',
    en: 'Billing is not available right now. Please try again in a moment.',
    action: 'retry',
  },
  // A mapping conflict means two Stripe customers claim one account. That needs
  // a human, so route to support rather than inviting a retry that will not help.
  'customer-mapping-conflict': {
    key: 'billing.unavailable',
    en: 'We need to check something on your billing account. Please email support@declareandbelieve.com.',
    action: 'support',
  },
};

/* Map a server code (or a null transport failure) to display copy. */
export function billingMessage(code) {
  const s = STATES[code] || STATES['stripe-error'];
  return { text: t(s.key, s.en), action: s.action };
}

/* "Your subscription ends on <date>" — for a cancel-at-period-end plan.
 * Formatted in the reader's language rather than hardcoded en-US. */
export function endingOn(currentPeriodEndSeconds) {
  if (!currentPeriodEndSeconds) return '';
  const d = new Date(currentPeriodEndSeconds * 1000);
  if (isNaN(d.getTime())) return '';
  const locale = esL() ? 'es' : 'en';
  let when;
  try {
    when = d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) { when = d.toDateString(); }
  return t('billing.endingSoon', 'Your subscription ends on') + ' ' + when;
}

export function manageLabel() {
  return t('billing.manage', 'Manage billing');
}
