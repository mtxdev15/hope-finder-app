/* Declare & Believe — the sign-in gate nudge.
   ensureSignedIn(message?) -> boolean
     true  : signed in (or accounts not configured yet — gates fail open)
     false : signed out; a toast slides up with the message and a gold
             "Sign in" button that opens the account modal IN PLACE
             (Julienne model — the user never loses where they are).

   Self-contained: injects its own styles + element once, body-level, so any
   page can import it without touching its own toast. Call initAuth() before
   gating (each page does this on load). */

import { isConfigured, isSignedIn } from './auth-store.js';
import { openAuthModal } from './auth-modal.js';

let el = null, hideT = null, lastMsg = '';

const CSS = `
.gate-toast { position: fixed; left: 50%; bottom: 104px; transform: translate(-50%, 16px); z-index: 90;
  display: flex; align-items: center; gap: 12px; width: min(440px, calc(100vw - 28px));
  background: var(--surface, #16241c); border: 1px solid var(--line2, rgba(255,255,255,.14));
  border-radius: 16px; padding: 12px 12px 12px 16px; box-shadow: 0 24px 60px -18px rgba(0,0,0,.7);
  opacity: 0; visibility: hidden; transition: opacity .35s ease, transform .45s cubic-bezier(.22,1,.36,1), visibility .45s; }
.gate-toast.show { opacity: 1; visibility: visible; transform: translate(-50%, 0); }
.gate-toast .gt-m { flex: 1; min-width: 0; font-family: 'DM Sans', sans-serif; font-size: 13px;
  line-height: 1.45; color: var(--text, #F3EFE6); }
.gate-toast .gt-go { flex: 0 0 auto; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 700;
  color: #13211A; background: var(--gold, #D8B85F); border: 0; border-radius: 100px; padding: 10px 16px;
  cursor: pointer; white-space: nowrap; box-shadow: 0 10px 24px -10px rgba(216,184,95,.6); }
@media (min-width: 481px) { .gate-toast { bottom: 36px; } }
`;

function mount() {
  if (el) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  el = document.createElement('div');
  el.className = 'gate-toast';
  el.setAttribute('role', 'status');
  el.innerHTML = '<span class="gt-m"></span><button class="gt-go" type="button">Sign in</button>';
  el.querySelector('.gt-go').addEventListener('click', () => {
    el.classList.remove('show');
    openAuthModal({ mode: 'signup', message: lastMsg });
  });
  document.body.appendChild(el);
}

export function ensureSignedIn(message) {
  if (!isConfigured() || isSignedIn()) return true;
  mount();
  lastMsg = message || 'Create a free account to keep what God gives you.';
  el.querySelector('.gt-m').textContent = lastMsg;
  el.classList.add('show');
  clearTimeout(hideT);
  hideT = setTimeout(() => el.classList.remove('show'), 5200);
  return false;
}
