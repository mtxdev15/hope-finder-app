/* Declare & Believe — Rate & Review behavior (presentational + analytics only).
   Drives the toast + multi-step sheet rendered by src/components/RateReview.astro.

   Contract:
     initRateReview({ isEligible, onDismiss, onSubmit }) -> { open(source) }

   - isEligible(): host-owned business gate for the AUTO toast (signed in, >=3
     Words, not submitted, under the dismissal cap, past cooldown). The toast's
     own "once per session" guard + IntersectionObserver lifecycle live HERE.
   - onDismiss(): host bumps the dismissal count + 30-day cooldown.
   - onSubmit({ scoreMetYou, scoreTheWord, scoreComingBack, testimonial, isPublic }):
     host writes to Convex + marks submitted. May be async; we don't block the
     close screen on it.
   - open(source): explicit entry points (profile/footer/menu) — no gate.

   Analytics goes through the fail-closed track() in analytics.js. Only the
   allowlisted props are ever forwarded; the testimonial text is never passed. */

import { track } from './analytics.js';

const SESSION_SHOWN_KEY = 'declare-rate-session-shown';
const ADVANCE_MS = 620; // let the star fill + glow land before the step springs away

export function initRateReview(opts) {
  const o = opts || {};
  const isEligible = typeof o.isEligible === 'function' ? o.isEligible : () => false;
  const onDismiss = typeof o.onDismiss === 'function' ? o.onDismiss : () => {};
  const onSubmit = typeof o.onSubmit === 'function' ? o.onSubmit : () => {};

  const $ = (id) => document.getElementById(id);
  const toast = $('rrToast');
  const sheet = $('rrSheet');
  const scrim = $('rrScrim');
  if (!toast || !sheet || !scrim) return { open() {} }; // component not on this page

  // Idempotent: never wire the same DOM twice.
  if (sheet.dataset.rrInit === '1') return window.__declareRate || { open() {} };
  sheet.dataset.rrInit = '1';

  const progress = $('rrProgress');
  const note = $('rrNote');
  const privateBox = $('rrPrivate');
  const notice = $('rrNotice');
  const steps = Array.from(sheet.querySelectorAll('.rr-step'));
  const starGroups = Array.from(sheet.querySelectorAll('.rr-stars'));

  const scores = { met: 0, word: 0, back: 0 };

  /* ---------- stars ---------- */
  function paint(group) {
    const val = scores[group.dataset.stars] || 0;
    group.querySelectorAll('.rr-star').forEach((s) => {
      const on = Number(s.dataset.val) <= val;
      s.classList.toggle('on', on);
      s.setAttribute('aria-checked', Number(s.dataset.val) === val ? 'true' : 'false');
    });
  }
  starGroups.forEach((group) => {
    group.addEventListener('click', (e) => {
      const star = e.target.closest('.rr-star');
      if (!star) return;
      scores[group.dataset.stars] = Number(star.dataset.val);
      paint(group);
      // tap a star to advance (Airbnb flow): met -> word -> back -> write
      const order = { met: '2', word: '3', back: '4' };
      const next = order[group.dataset.stars];
      if (next) setTimeout(() => showStep(next), ADVANCE_MS);
    });
  });

  /* ---------- steps + progress ---------- */
  function showStep(step) {
    steps.forEach((s) => {
      const active = s.dataset.step === step;
      s.hidden = !active;
      s.classList.toggle('rr-in', active);
      if (active) {
        const g = s.querySelector('.rr-stars');
        if (g) { g.classList.remove('revealed'); void g.offsetWidth; g.classList.add('revealed'); }
      }
    });
    if (progress) {
      const n = ({ '1': 25, '2': 50, '3': 75, '4': 100 })[step];
      if (n) progress.style.width = n + '%';
    }
    if (step === '4' && note) setTimeout(() => { try { note.focus(); } catch (e) {} }, 360);
  }

  function reset() {
    scores.met = scores.word = scores.back = 0;
    starGroups.forEach(paint);
    if (note) note.value = '';
    if (privateBox) privateBox.checked = false;
    syncNotice();
    if (progress) progress.style.width = '25%';
    showStep('1');
  }

  /* ---------- private toggle notice ---------- */
  function syncNotice() {
    if (!notice) return;
    const t = (k, fb) => { try { return window.I18N ? window.I18N.t(k, fb) : fb; } catch (e) { return fb; } };
    const priv = !!(privateBox && privateBox.checked);
    notice.textContent = priv
      ? t('rr.noticePrivate', notice.dataset.private || '')
      : t('rr.noticePublic', notice.dataset.public || '');
  }
  if (privateBox) privateBox.addEventListener('change', syncNotice);

  /* ---------- sheet open/close ---------- */
  let scrollY = 0;
  let opener = null; // the control that opened the sheet — focus returns here on close
  function lockScroll(on) {
    try {
      if (on) { document.body.style.overflow = 'hidden'; }
      else { document.body.style.overflow = ''; }
    } catch (e) {}
  }
  // Focusable, currently-visible elements inside the sheet — used both to focus
  // the first real control on open and to trap Tab while open. Hidden steps
  // ([hidden]) are already excluded from the tab order by the browser, so
  // filtering on offsetParent (null for anything not rendered) is sufficient.
  function focusableInSheet() {
    const all = sheet.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(all).filter((el) => el.offsetParent !== null);
  }
  function trapFocus(e) {
    if (e.key !== 'Tab' || !sheet.classList.contains('open')) return;
    const list = focusableInSheet();
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function open(source) {
    opener = document.activeElement;
    reset();
    scrim.classList.add('open'); scrim.setAttribute('aria-hidden', 'false');
    sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
    sheet.inert = false;
    lockScroll(true);
    track('rate_started', { source: source }); // source bounded by callers
    // Focus the first star of the now-active step 1 — the dialog's actual
    // content, not the close button (which is also focusable but would put a
    // dismiss action ahead of the thing the dialog is actually asking for).
    // Falls back to the first focusable element if that step ever renders
    // without a star group.
    const firstStar = sheet.querySelector('.rr-step:not([hidden]) .rr-star');
    const first = firstStar || focusableInSheet()[0];
    try { first && first.focus({ preventScroll: true }); } catch (e) {}
  }
  function close() {
    scrim.classList.remove('open'); scrim.setAttribute('aria-hidden', 'true');
    sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    sheet.inert = true;
    lockScroll(false);
    try { opener && typeof opener.focus === 'function' && opener.focus(); } catch (e) {}
    opener = null;
  }
  $('rrClose') && $('rrClose').addEventListener('click', close);
  scrim.addEventListener('click', close);
  $('rrDone') && $('rrDone').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) { close(); return; }
    trapFocus(e);
  });

  /* ---------- submit ---------- */
  $('rrSubmit') && $('rrSubmit').addEventListener('click', () => {
    const payload = {
      scoreMetYou: scores.met,
      scoreTheWord: scores.word,
      scoreComingBack: scores.back,
      testimonial: (note && note.value.trim()) || '',
      isPublic: !(privateBox && privateBox.checked),
    };
    // analytics: overall rating only + shared flag. Testimonial NEVER sent.
    const overall = Math.round((payload.scoreMetYou + payload.scoreTheWord + payload.scoreComingBack) / 3);
    track('rate_submitted', { rating: overall, shared: payload.isPublic });
    try { onSubmit(payload); } catch (e) {} // host handles Convex + submitted flag (fail-soft)
    showStep('close'); // "Blessing to you"
  });

  /* ---------- toast (auto, gated) ---------- */
  function showToast() {
    toast.hidden = false;
    void toast.offsetWidth;
    toast.classList.add('show');
    try { sessionStorage.setItem(SESSION_SHOWN_KEY, '1'); } catch (e) {}
    track('rate_prompt_shown');
  }
  function hideToast() {
    toast.classList.remove('show');
    setTimeout(() => { toast.hidden = true; }, 500);
  }
  $('rrToastShare') && $('rrToastShare').addEventListener('click', () => { hideToast(); open('toast'); });
  $('rrToastNot') && $('rrToastNot').addEventListener('click', () => {
    hideToast();
    track('rate_dismissed');
    try { onDismiss(); } catch (e) {}
  });

  // IntersectionObserver on the results-bottom sentinel. Shows the toast at most
  // once per session, only when the host gate passes. Disconnects after firing.
  function shownThisSession() {
    try { return sessionStorage.getItem(SESSION_SHOWN_KEY) === '1'; } catch (e) { return false; }
  }
  const sentinel = document.getElementById('rrSentinel');
  if (sentinel && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (shownThisSession()) { io.disconnect(); return; }
        let eligible = false;
        try { eligible = !!isEligible(); } catch (e) { eligible = false; }
        if (eligible) { showToast(); io.disconnect(); return; }
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    io.observe(sentinel);
  }

  const api = { open };
  window.__declareRate = api;
  return api;
}
