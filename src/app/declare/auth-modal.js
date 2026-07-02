/* Declare & Believe — the account modal (Julienne onboarding model).
   One centered split card opened OVER the page the user is already on:
   brand visual on the left, a compact form on the right, sign-in and
   create-account as two modes of the same card (toggle in the footer),
   inline validation, a loading state on the button, and a check-your-inbox
   state for the password-reset email. The user never loses their
   place in the app.

     openAuthModal({ mode: 'signup'|'signin', message?, onSuccess? })

   Self-contained like auth-gate.js: injects its own styles + DOM once.
   Mobile (<720px): a bottom sheet with a slim brand band; desktop: the
   Julienne split card with backdrop blur (house overlay pattern). */

import { isConfigured, isSignedIn, signIn, signUp, signInWithProvider, resetPassword, updatePassword } from './auth-store.js';
import { getProfile, setProfile } from './profile-store.js';

// Spanish display layer (declare-lang cookie, via the global window.I18N engine).
function amES() { return !!(typeof window !== 'undefined' && window.I18N && window.I18N.lang && window.I18N.lang() === 'es'); }
function amT(en, es) { return amES() ? es : en; }

let root = null, state = null;

/* Social logins appear ONLY for providers listed in PUBLIC_AUTH_PROVIDERS
   (comma-separated, e.g. "google" or "google,apple,facebook"). Until a
   provider is both configured in Better Auth AND named here, its button never
   shows — no dead controls while setup is in progress. */
const PROVIDERS = {
  google: { label: 'Continue with Google', labelEs: 'Continúa con Google',
    icon: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.6c-.2 1.3-1 2.4-2 3.1v2.6h3.3c1.9-1.8 3.1-4.4 3.1-7.6z"/><path fill="#34A853" d="M12 22c2.7 0 5-1 6.6-2.5l-3.3-2.6c-.9.6-2 1-3.3 1-2.6 0-4.7-1.7-5.5-4.1H3.1v2.6C4.7 19.7 8.1 22 12 22z"/><path fill="#FBBC05" d="M6.5 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H3.1C2.4 9 2 10.5 2 12s.4 3 1.1 4.4l3.4-2.6z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 3 14.7 2 12 2 8.1 2 4.7 4.3 3.1 7.6l3.4 2.6C7.3 7.8 9.4 6.1 12 6.1z"/></svg>' },
  apple: { label: 'Continue with Apple', labelEs: 'Continúa con Apple',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.9c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.5-.4 6.1 1 8.1.7 1 1.4 2.1 2.4 2 1-.1 1.3-.6 2.5-.6s1.5.6 2.6.6 1.7-1 2.4-2c.7-1.1 1-2.2 1-2.3-.1 0-1.9-.8-1.9-2.9zM14.6 6.3c.5-.7.9-1.6.8-2.6-.8 0-1.8.6-2.4 1.2-.5.6-1 1.5-.8 2.4.9.1 1.8-.4 2.4-1z"/></svg>' },
  facebook: { label: 'Continue with Facebook', labelEs: 'Continúa con Facebook',
    icon: '<svg viewBox="0 0 24 24" fill="#1877F2"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>' },
};
const ENABLED = (import.meta.env.PUBLIC_AUTH_PROVIDERS || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter((p) => PROVIDERS[p]);

const CSS = `
/* visibility/opacity (not display) so the card eases both in AND out — unseen.co calm */
.am-wrap { position: fixed; inset: 0; z-index: 95; opacity: 0; visibility: hidden;
  transition: opacity .5s ease, visibility .5s; }
.am-wrap.open { opacity: 1; visibility: visible; }
.am-back { position: absolute; inset: 0; background: rgba(6, 11, 8, .55); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px);
  transition: backdrop-filter .6s ease, -webkit-backdrop-filter .6s ease; }
.am-wrap.open .am-back { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.am-card { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; overflow: hidden;
  background: var(--screen, #101b14); border-top: 1px solid var(--line2, rgba(255,255,255,.14)); border-radius: 24px 24px 0 0;
  max-height: 92dvh; overflow-y: auto; scroll-behavior: smooth; scrollbar-width: none; box-shadow: 0 -24px 60px -18px rgba(0,0,0,.7); }
.am-card::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: no-preference) {
  .am-wrap.open .am-card { animation: amUp .62s cubic-bezier(.16,1,.3,1) both; }
}
@keyframes amUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }

.am-x { position: absolute; top: 14px; right: 14px; z-index: 4; width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid var(--line2, rgba(255,255,255,.14)); background: color-mix(in srgb, var(--screen, #101b14) 70%, transparent);
  color: var(--text, #F3EFE6); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color .25s ease, transform .25s ease; }
.am-x:hover { border-color: var(--soft, #6f8377); transform: rotate(90deg); }
.am-x svg { width: 15px; height: 15px; }

/* brand visual — slim band on mobile, full left panel on desktop (no illustration: just the mark, a soft light) */
.am-art { position: relative; flex: 0 0 auto; height: 132px; overflow: hidden;
  background: radial-gradient(120% 115% at 50% 8%, #21402f, #0a120d 80%); display: flex; align-items: center; justify-content: center; }
.am-art::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(60% 55% at 50% 30%, rgba(216,184,95,.16), transparent 72%); }
.am-brand { position: relative; z-index: 2; display: flex; align-items: center; gap: 13px; padding: 18px; }
.am-brand img { width: 46px; height: auto; filter: drop-shadow(0 6px 20px rgba(0,0,0,.55)); }
.am-brand .bw { text-align: left; }
.am-brand .bn { font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 600; color: #F3EFE6; line-height: 1.05; }
.am-brand .bt { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 12.5px; color: rgba(243,239,230,.62); margin-top: 3px; }

.am-form { padding: 22px 22px max(26px, env(safe-area-inset-bottom)); }

/* ===== cinematic staggered reveal (expo-out, unseen.co cadence) ===== */
@keyframes amRise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: no-preference) {
  .am-wrap.open .am-brand { opacity: 0; animation: amRise .8s cubic-bezier(.16,1,.3,1) .14s both; }
  .am-wrap.open .am-k { opacity: 0; animation: amRise .7s cubic-bezier(.16,1,.3,1) .20s both; }
  .am-wrap.open .am-h { opacity: 0; animation: amRise .72s cubic-bezier(.16,1,.3,1) .27s both; }
  .am-wrap.open .am-sub { opacity: 0; animation: amRise .72s cubic-bezier(.16,1,.3,1) .34s both; }
  .am-wrap.open .am-fields > * { opacity: 0; animation: amRise .72s cubic-bezier(.16,1,.3,1) both; }
  .am-wrap.open #amNameF { animation-delay: .40s; }
  .am-wrap.open #amEmailF { animation-delay: .46s; }
  .am-wrap.open #amPwF { animation-delay: .52s; }
  .am-wrap.open #amForgot { animation-delay: .55s; }
  .am-wrap.open #amHint { animation-delay: .56s; }
  .am-wrap.open #amGo { animation-delay: .60s; }
  .am-wrap.open .am-or { opacity: 0; animation: amRise .7s cubic-bezier(.16,1,.3,1) .64s both; }
  .am-wrap.open .am-prov > * { opacity: 0; animation: amRise .7s cubic-bezier(.16,1,.3,1) .70s both; }
  .am-wrap.open .am-swap { opacity: 0; animation: amRise .7s cubic-bezier(.16,1,.3,1) .76s both; }
  .am-wrap.open .am-fine { opacity: 0; animation: amRise .7s cubic-bezier(.16,1,.3,1) .82s both; }
}
.am-k { font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: var(--goldd, #cfae57); font-weight: 700; }
.am-h { font-family: 'Cormorant Garamond', serif; font-size: 27px; font-weight: 600; color: var(--text, #F3EFE6); line-height: 1.12; margin-top: 9px; }
.am-sub { font-family: 'DM Sans', sans-serif; font-size: 13.5px; line-height: 1.55; color: var(--text2, #cfd7cd); margin-top: 9px; }

.am-fields { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
.am-field { position: relative; display: flex; align-items: center; background: var(--field, rgba(255,255,255,.05));
  border: 1px solid var(--line2, rgba(255,255,255,.14)); border-radius: 13px; transition: border-color .25s ease; }
.am-field.focus { border-color: color-mix(in srgb, var(--gold, #D8B85F) 55%, transparent); }
.am-field.err { border-color: color-mix(in srgb, var(--clay, #c4644b) 70%, transparent); }
.am-field input { flex: 1; min-width: 0; background: transparent; border: 0; outline: 0; font-family: 'DM Sans', sans-serif;
  font-size: 15px; color: var(--text, #F3EFE6); padding: 14px 12px 14px 15px; caret-color: var(--gold, #D8B85F); }
.am-field input::placeholder { color: var(--muted, #97a59a); opacity: .7; }
.am-field .tag { flex: 0 0 auto; font-family: 'DM Sans', sans-serif; font-size: 11px; letter-spacing: .06em; color: var(--muted, #97a59a); padding-right: 14px; pointer-events: none; }
.am-peek { flex: 0 0 auto; width: 40px; height: 44px; border: 0; background: none; color: var(--muted, #97a59a); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.am-peek svg { width: 18px; height: 18px; }
.am-forgot { align-self: flex-end; margin-top: 2px; background: none; border: 0; padding: 2px; cursor: pointer;
  font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; color: var(--goldd, #cfae57); }
.am-forgot:hover { text-decoration: underline; text-underline-offset: 3px; }
.am-hint { font-family: 'DM Sans', sans-serif; font-size: 11.5px; color: var(--muted, #97a59a); margin-top: 8px; min-height: 15px; transition: color .25s ease; }
.am-hint.err { color: var(--clay, #c4644b); }

.am-go { display: flex; align-items: center; justify-content: center; width: 100%; margin-top: 16px; padding: 15px;
  border: 0; border-radius: 100px; background: var(--gold, #D8B85F); color: #13211A; font-family: 'DM Sans', sans-serif;
  font-size: 14.5px; font-weight: 700; cursor: pointer; box-shadow: 0 14px 34px -12px rgba(216,184,95,.6);
  transition: opacity .25s ease, transform .15s ease; }
.am-go:active { transform: scale(.985); }
.am-go[disabled] { opacity: .55; cursor: default; }

/* check-your-inbox state (replaces the button, Julienne's verifying pill) */
.am-inbox { display: none; align-items: center; gap: 10px; margin-top: 16px; padding: 13px 16px; border-radius: 13px;
  border: 1px solid color-mix(in srgb, var(--gold, #D8B85F) 36%, transparent); background: color-mix(in srgb, var(--gold, #D8B85F) 10%, transparent);
  font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.5; color: var(--text, #F3EFE6); }
.am-inbox svg { width: 18px; height: 18px; flex: 0 0 auto; color: var(--goldd, #cfae57); }
.am-card.sent .am-inbox { display: flex; }
.am-card.sent .am-go { display: none; }

/* social providers */
.am-or { display: flex; align-items: center; gap: 14px; margin: 18px 0 14px; color: var(--muted, #97a59a);
  font-family: 'DM Sans', sans-serif; font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; }
.am-or::before, .am-or::after { content: ''; flex: 1; height: 1px; background: var(--line, rgba(255,255,255,.08)); }
.am-prov { display: flex; flex-direction: column; gap: 10px; }
.am-pbtn { display: flex; align-items: center; justify-content: center; gap: 11px; padding: 13px; cursor: pointer;
  border: 1px solid var(--line2, rgba(255,255,255,.14)); border-radius: 13px; background: var(--field, rgba(255,255,255,.05));
  color: var(--text, #F3EFE6); font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
  transition: border-color .2s ease, background .2s ease, transform .15s ease; }
.am-pbtn:hover { border-color: var(--soft, #6f8377); background: color-mix(in srgb, var(--surface, #16241c) 60%, transparent); }
.am-pbtn:active { transform: scale(.99); }
.am-pbtn[disabled] { opacity: .55; cursor: default; }
.am-pbtn svg { width: 18px; height: 18px; flex: 0 0 auto; }

.am-swap { margin-top: 18px; text-align: center; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--muted, #97a59a); }
.am-swap button { background: none; border: 0; padding: 0; font: inherit; font-weight: 600; color: var(--goldd, #cfae57); cursor: pointer; }
.am-swap button:hover { text-decoration: underline; text-underline-offset: 3px; }
.am-fine { margin-top: 12px; text-align: center; font-family: 'DM Sans', sans-serif; font-size: 10.5px; line-height: 1.55; color: var(--muted, #97a59a); opacity: .8; }

/* ===== desktop: the Julienne split card ===== */
@media (min-width: 720px) {
  .am-card { left: 50%; right: auto; bottom: auto; top: 50%; transform: translate(-50%, -50%); flex-direction: row;
    width: min(860px, calc(100vw - 40px)); max-height: min(640px, 92vh); border-radius: 26px;
    border: 1px solid var(--line2, rgba(255,255,255,.14)); box-shadow: 0 50px 130px -40px rgba(0,0,0,.8); }
  @media (prefers-reduced-motion: no-preference) {
    .am-wrap.open .am-card { animation: amInC .46s cubic-bezier(.16,1,.3,1) both; }
  }
  .am-art { flex: 0 0 46%; height: auto; }
  .am-brand { flex-direction: column; text-align: center; gap: 14px; }
  .am-brand .bw { text-align: center; }
  .am-brand img { width: 84px; }
  .am-brand .bn { font-size: 30px; }
  .am-brand .bt { font-size: 14px; margin-top: 6px; }
  .am-form { flex: 1; padding: 44px 44px 38px; display: flex; flex-direction: column; justify-content: center; overflow-y: auto; scroll-behavior: smooth; scrollbar-width: none; }
  .am-form::-webkit-scrollbar { display: none; }
  .am-h { font-size: 31px; }
}
@keyframes amInC { from { opacity: 0; transform: translate(-50%, -48%) scale(.965); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
`;

const PEEK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';

function mount() {
  if (root) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement('div');
  root.className = 'am-wrap';
  root.innerHTML =
    '<div class="am-back" data-am-close></div>'
    + '<div class="am-card" role="dialog" aria-modal="true" aria-label="' + amT('Your account', 'Tu cuenta') + '">'
    +   '<button class="am-x" data-am-close aria-label="' + amT('Close', 'Cerrar') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
    +   '<div class="am-art">'
    +     '<div class="am-brand"><img src="/declare/brand/mark.png" alt="" />'
    +       '<div class="bw"><div class="bn">Declare</div><div class="bt">' + amT('Scripture, for the weight you carry.', 'La Escritura, para el peso que cargas.') + '</div></div>'
    +     '</div></div>'
    +   '<div class="am-form">'
    +     '<div class="am-k" id="amK"></div>'
    +     '<h2 class="am-h" id="amH"></h2>'
    +     '<p class="am-sub" id="amSub"></p>'
    +     '<form class="am-fields" id="amForm" novalidate>'
    +       '<div class="am-field" id="amNameF"><input type="text" id="amName" placeholder="' + amT('First name', 'Nombre') + '" autocomplete="given-name" autocapitalize="words" aria-label="' + amT('First name', 'Nombre') + '" /><span class="tag">' + amT('Name', 'Nombre') + '</span></div>'
    +       '<div class="am-field" id="amEmailF"><input type="email" id="amEmail" placeholder="' + amT('e.g. you@gmail.com', 'ej. tu@gmail.com') + '" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" aria-label="' + amT('Email address', 'Correo electrónico') + '" /><span class="tag">' + amT('Email', 'Correo') + '</span></div>'
    +       '<div class="am-field" id="amPwF"><input type="password" id="amPw" placeholder="' + amT('Enter your password', 'Escribe tu contraseña') + '" aria-label="' + amT('Password', 'Contraseña') + '" /><button type="button" class="am-peek" id="amPeek" aria-label="' + amT('Show password', 'Mostrar contraseña') + '">' + PEEK_SVG + '</button></div>'
    +       '<button type="button" class="am-forgot" id="amForgot">' + amT('Forgot password?', '¿Olvidaste tu contraseña?') + '</button>'
    +       '<div class="am-hint" id="amHint"></div>'
    +       '<button class="am-go" id="amGo" type="submit">' + amT('Continue', 'Continuar') + '</button>'
    +       '<div class="am-inbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/></svg><span id="amInboxT"></span></div>'
    +     '</form>'
    +     (ENABLED.length ? ('<div class="am-or">' + amT('or continue with', 'o continúa con') + '</div><div class="am-prov">'
    +       ENABLED.map((p) => '<button type="button" class="am-pbtn" data-prov="' + p + '">' + PROVIDERS[p].icon + amT(PROVIDERS[p].label, PROVIDERS[p].labelEs) + '</button>').join('')
    +       '</div>') : '')
    +     '<div class="am-swap" id="amSwap"></div>'
    +     '<div class="am-fine">' + amT('Free forever for what matters &mdash; your words, verses, and journeys.', 'Gratis para siempre en lo que importa: tus palabras, versículos y caminos.') + '</div>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(root);

  root.addEventListener('click', (e) => { if (e.target.closest('[data-am-close]')) closeAuthModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('open')) closeAuthModal(); });

  const pw = root.querySelector('#amPw');
  root.querySelector('#amPeek').addEventListener('click', function () {
    const t = pw.type === 'password' ? 'text' : 'password'; pw.type = t;
    this.style.color = t === 'text' ? 'var(--goldd)' : '';
  });
  ['amName', 'amEmail', 'amPw'].forEach((id) => {
    const f = root.querySelector('#' + id);
    f.addEventListener('focus', () => f.parentElement.classList.add('focus'));
    f.addEventListener('blur', () => f.parentElement.classList.remove('focus'));
    // typing clears the error — focusing must not, or submit's message vanishes
    f.addEventListener('input', () => { f.parentElement.classList.remove('err'); hint(''); });
  });
  root.querySelector('#amForm').addEventListener('submit', submit);
  root.querySelector('#amSwap').addEventListener('click', (e) => {
    if (!e.target.closest('button')) return;
    // from forgot/reset, the swap goes back to sign-in; otherwise toggle signup/signin
    setMode((state.mode === 'forgot' || state.mode === 'reset') ? 'signin' : (state.mode === 'signup' ? 'signin' : 'signup'));
  });
  root.querySelector('#amForgot').addEventListener('click', () => setMode('forgot'));
  // OAuth: a full-page redirect, so we hand the provider where to send the user
  // back — the page they were on (or the shell's ?return target).
  root.querySelectorAll('.am-pbtn').forEach((b) => b.addEventListener('click', async () => {
    const path = (state && state.returnTo) || (location.pathname + location.search);
    b.disabled = true;
    const res = await signInWithProvider(b.dataset.prov, location.origin + path);
    if (!res.ok) { b.disabled = false; hint(res.error, true); }
  }));
}

function hint(msg, isErr) {
  const h = root.querySelector('#amHint');
  h.textContent = msg || (state && (state.mode === 'signup' || state.mode === 'reset') ? amT('At least 8 characters.', 'Al menos 8 caracteres.') : '');
  h.classList.toggle('err', !!isErr);
}

function setMode(mode) {
  state.mode = mode;
  const signup = mode === 'signup', signin = mode === 'signin', forgot = mode === 'forgot', reset = mode === 'reset';
  root.querySelector('.am-card').classList.remove('sent');
  root.querySelector('#amK').textContent = (forgot || reset) ? amT('Account', 'Cuenta') : (signup ? amT('Start free', 'Comienza gratis') : amT('Welcome back', 'Bienvenido de nuevo'));
  root.querySelector('#amH').textContent = forgot ? amT('Reset your password', 'Restablece tu contraseña') : reset ? amT('Set a new password', 'Crea una nueva contraseña')
    : signup ? amT('Create your account', 'Crea tu cuenta') : amT('Sign in to Declare', 'Inicia sesión en Declare');
  root.querySelector('#amSub').textContent = (!forgot && !reset && state.message) ? state.message
    : forgot ? amT('Enter your email and we’ll send a link to set a new one.', 'Escribe tu correo y te enviaremos un enlace para crear una nueva.')
    : reset ? amT('Choose a new password for your account.', 'Elige una nueva contraseña para tu cuenta.')
    : signup ? amT('Keep what God gives you — words, verses, and journeys — wherever you sign in.', 'Guarda lo que Dios te da — palabras, versículos y caminos — dondequiera que inicies sesión.')
    : amT('Pick up right where you left off.', 'Continúa justo donde lo dejaste.');
  // field visibility per mode
  root.querySelector('#amNameF').style.display = signup ? '' : 'none';
  root.querySelector('#amEmailF').style.display = reset ? 'none' : '';   // reset has the recovery session; no email needed
  root.querySelector('#amPwF').style.display = forgot ? 'none' : '';      // forgot only asks for the email
  root.querySelector('#amForgot').style.display = signin ? '' : 'none';
  root.querySelector('#amPw').placeholder = reset ? amT('New password', 'Nueva contraseña') : signup ? amT('Create a password', 'Crea una contraseña') : amT('Enter your password', 'Escribe tu contraseña');
  root.querySelector('#amPw').setAttribute('autocomplete', (reset || signup) ? 'new-password' : 'current-password');
  root.querySelector('#amGo').textContent = forgot ? amT('Send reset link', 'Enviar enlace') : reset ? amT('Update password', 'Actualizar contraseña') : amT('Continue', 'Continuar');
  // social providers only belong on the actual sign-in / sign-up
  const orEl = root.querySelector('.am-or'), provEl = root.querySelector('.am-prov');
  if (orEl) orEl.style.display = (signin || signup) ? '' : 'none';
  if (provEl) provEl.style.display = (signin || signup) ? '' : 'none';
  root.querySelector('#amSwap').innerHTML = (forgot || reset)
    ? '<button type="button">&larr; ' + amT('Back to sign in', 'Volver a iniciar sesión') + '</button>'
    : signup ? amT('Already have an account? ', '¿Ya tienes una cuenta? ') + '<button type="button">' + amT('Sign in', 'Inicia sesión') + '</button>'
    : amT('New here? ', '¿Nuevo aquí? ') + '<button type="button">' + amT('Create an account', 'Crea una cuenta') + '</button>';
  ['amNameF', 'amEmailF', 'amPwF'].forEach((id) => root.querySelector('#' + id).classList.remove('err'));
  hint('');
}

function fieldErr(fid, msg) {
  root.querySelector('#' + fid).classList.add('err');
  hint(msg, true);
}

async function submit(e) {
  e.preventDefault();
  const mode = state.mode;
  const go = root.querySelector('#amGo');
  const email = root.querySelector('#amEmail').value.trim();
  const pwv = root.querySelector('#amPw').value;

  // ── forgot: just the email, then send the reset link ──
  if (mode === 'forgot') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldErr('amEmailF', amT('That doesn’t look like an email address.', 'Eso no parece un correo electrónico.')); root.querySelector('#amEmail').focus(); return; }
    go.disabled = true; go.textContent = amT('Sending the link…', 'Enviando el enlace…');
    const res = await resetPassword(email, location.origin + '/reset-password');
    go.disabled = false; go.textContent = amT('Send reset link', 'Enviar enlace');
    if (!res.ok) { fieldErr('amEmailF', res.error); return; }
    root.querySelector('#amInboxT').innerHTML = amT('Check your inbox — a reset link is on its way to <b></b>. Open it on this device to set a new password.', 'Revisa tu correo — un enlace va en camino a <b></b>. Ábrelo en este dispositivo para crear una nueva contraseña.');
    root.querySelector('#amInboxT b').textContent = email;
    root.querySelector('.am-card').classList.add('sent');
    return;
  }

  // ── reset: set the new password (recovery session is already active) ──
  if (mode === 'reset') {
    if (pwv.length < 8) { fieldErr('amPwF', amT('Use at least 8 characters.', 'Usa al menos 8 caracteres.')); root.querySelector('#amPw').focus(); return; }
    go.disabled = true; go.textContent = amT('Updating…', 'Actualizando…');
    const res = await updatePassword(pwv);
    go.disabled = false; go.textContent = amT('Update password', 'Actualizar contraseña');
    if (!res.ok) { fieldErr('amPwF', res.error); return; }
    const cb = state.onSuccess;
    closeAuthModal();
    if (cb) { try { cb(); } catch (err) {} }
    return;
  }

  // ── signin / signup ──
  const signupMode = mode === 'signup';
  const name = root.querySelector('#amName').value.trim();
  if (signupMode && !name) { fieldErr('amNameF', amT('Tell us what to call you.', 'Dinos cómo llamarte.')); root.querySelector('#amName').focus(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldErr('amEmailF', amT('That doesn’t look like an email address.', 'Eso no parece un correo electrónico.')); root.querySelector('#amEmail').focus(); return; }
  if (signupMode ? pwv.length < 8 : !pwv) { fieldErr('amPwF', signupMode ? amT('Use at least 8 characters.', 'Usa al menos 8 caracteres.') : amT('Enter your password.', 'Escribe tu contraseña.')); root.querySelector('#amPw').focus(); return; }

  go.disabled = true; go.textContent = signupMode ? amT('Creating your account…', 'Creando tu cuenta…') : amT('Signing you in…', 'Iniciando sesión…');
  let res;
  if (signupMode) {
    const first = name.split(' ')[0];
    const cased = first.charAt(0).toUpperCase() + first.slice(1);
    res = await signUp({ name: cased, email, password: pwv });
    if (res.ok) { try { setProfile({ name: cased }); } catch (err) {} }
  } else {
    res = await signIn({ email, password: pwv });
    if (res.ok) {
      try {
        const { currentUser } = await import('./auth-store.js');
        const u = currentUser();
        if (u && u.firstName && !getProfile().name) setProfile({ name: u.firstName });
      } catch (err) {}
    }
  }
  go.disabled = false; go.textContent = amT('Continue', 'Continuar');
  if (!res.ok) { fieldErr('amPwF', res.error); return; }
  if (res.needsConfirm) {
    root.querySelector('#amInboxT').innerHTML = amT('Check your inbox. We sent a confirmation link to <b></b>. Tap it to confirm, then sign in.', 'Revisa tu correo. Enviamos un enlace de confirmación a <b></b>. Tócalo para confirmar y luego inicia sesión.');
    root.querySelector('#amInboxT b').textContent = email;
    root.querySelector('.am-card').classList.add('sent');
    setMode('signin'); // their next visit to the form is a sign-in
    root.querySelector('.am-card').classList.add('sent');
    return;
  }
  closeAuthModal();
  // A brand-new account goes straight into /today to start declaring.
  if (signupMode) { window.location.href = '/today'; return; }
  const cb = state.onSuccess;
  if (cb) { try { cb(); } catch (err) {} }
}

export function openAuthModal(opts) {
  opts = opts || {};
  const mode = ['signin', 'signup', 'forgot', 'reset'].includes(opts.mode) ? opts.mode : 'signup';
  if (!isConfigured()) return;
  // 'reset' runs ON a recovery session, so being "signed in" is expected there;
  // for every other mode, an existing session means there's nothing to do.
  if (mode !== 'reset' && isSignedIn()) { if (opts.onSuccess) opts.onSuccess(); return; }
  mount();
  state = { mode, message: opts.message || '', onSuccess: opts.onSuccess || null, returnTo: opts.returnTo || '' };
  setMode(mode);
  root.querySelector('#amName').value = ''; root.querySelector('#amPw').value = '';
  root.classList.add('open');
  setTimeout(() => {
    try { root.querySelector(mode === 'signup' ? '#amName' : (mode === 'reset' ? '#amPw' : '#amEmail')).focus({ preventScroll: true }); } catch (e) {}
  }, 380);
}

export function closeAuthModal() {
  if (root) root.classList.remove('open');
}
