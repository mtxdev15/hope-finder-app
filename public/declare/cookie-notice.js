/* Declare — cookie notice. A small, calm bottom bar shown once until accepted.
   Stores the acceptance in localStorage('declare-cookies-ok') + a cookie (so both
   storage styles carry it). Bilingual via the html lang / I18N language. Links to
   /cookies (or /es/cookies). Self-contained: own CSS + DOM, no dependencies. */
(function () {
  var KEY = 'declare-cookies-ok';
  function accepted() {
    try { if (localStorage.getItem(KEY) === '1') return true; } catch (e) {}
    try { if (/(?:^|;\s*)declare-cookies-ok=1/.test(document.cookie)) return true; } catch (e) {}
    return false;
  }
  function markAccepted() {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    try { document.cookie = 'declare-cookies-ok=1;path=/;max-age=31536000;samesite=lax'; } catch (e) {}
  }
  function isES() {
    try {
      if (window.I18N && window.I18N.lang && window.I18N.lang() === 'es') return true;
      if ((document.documentElement.getAttribute('lang') || '') === 'es') return true;
      if (/^\/es(\/|$)/.test(location.pathname)) return true;
    } catch (e) {}
    return false;
  }

  function show() {
    var es = isES();
    var css =
      '.cookie-note{position:fixed;left:0;right:0;bottom:0;z-index:1190;display:flex;justify-content:center;' +
      'padding:0 12px calc(10px + env(safe-area-inset-bottom,0px));pointer-events:none;}' +
      '.cookie-note .cn-card{pointer-events:auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap;' +
      'width:100%;max-width:560px;background:#22382E;color:#F3EFE6;border:1px solid rgba(201,168,76,.3);' +
      'border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.3);padding:12px 14px;' +
      'font-family:"DM Sans",system-ui,sans-serif;font-size:12.5px;line-height:1.45;' +
      'transform:translateY(130%);opacity:0;transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .35s ease;}' +
      '.cookie-note.in .cn-card{transform:translateY(0);opacity:1;}' +
      '.cookie-note .cn-tx{flex:1;min-width:200px;color:rgba(243,239,230,.85);}' +
      '.cookie-note .cn-tx a{color:#C9A84C;text-decoration:underline;text-underline-offset:2px;}' +
      '.cookie-note .cn-ok{flex:0 0 auto;font:inherit;font-weight:600;font-size:13px;color:#243b31;' +
      'background:#C9A84C;border:0;border-radius:10px;padding:9px 18px;cursor:pointer;}' +
      '.cookie-note .cn-ok:hover{filter:brightness(1.06);}' +
      '@media (prefers-reduced-motion: reduce){.cookie-note .cn-card{transition:opacity .3s ease;transform:none;}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    var wrap = document.createElement('div');
    wrap.className = 'cookie-note';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', es ? 'Aviso de cookies' : 'Cookie notice');
    var policyHref = es ? '/es/cookies' : '/cookies';
    wrap.innerHTML =
      '<div class="cn-card">' +
        '<span class="cn-tx">' + (es
          ? 'Declare usa cookies para recordar tus preferencias y entender cómo se usa el sitio. Mira nuestra <a href="' + policyHref + '">Política de cookies</a>.'
          : 'Declare uses cookies to remember your preferences and understand how the site is used. See our <a href="' + policyHref + '">Cookie Policy</a>.') +
        '</span>' +
        '<button type="button" class="cn-ok">' + (es ? 'Aceptar' : 'Accept') + '</button>' +
      '</div>';
    document.body.appendChild(wrap);
    requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('in'); }); });
    wrap.querySelector('.cn-ok').addEventListener('click', function () {
      markAccepted();
      wrap.classList.remove('in');
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 520);
    });
  }

  function maybe() { if (!accepted()) setTimeout(show, 600); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybe);
  else maybe();
})();
