/* Declare i18n engine — runtime, cookie-driven, default English.
   The static SEO pages (welcome, struggles, struggle pages, give) have their own
   /es/* twins; THIS powers the interactive Astro app (/, today, journey, word,
   you, vault, signin). It swaps any element tagged data-i18n / data-i18n-ph /
   data-i18n-aria / data-i18n-title, and exposes window.I18N for JS-built strings.

   Layer 5 (navigator.language auto-detect) lives in lang-banner.js, which offers a
   gentle banner to Spanish-browser users who have not yet chosen; it never switches
   silently. Until a user chooses Spanish (banner or menu toggle), everything stays
   English. Load order:
   <script src="/declare/i18n-strings.js"></script> then <script src="/declare/i18n.js"></script>. */
(function () {
  var COOKIE = 'declare-lang';
  function readCookie() {
    try { var m = document.cookie.match(/(?:^|;\s*)declare-lang=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch (e) { return ''; }
  }
  function writeCookie(v) {
    try { document.cookie = 'declare-lang=' + encodeURIComponent(v) + ';path=/;max-age=31536000;samesite=lax'; } catch (e) {}
    try { localStorage.setItem('declare-lang', v); } catch (e) {}
    // Mark that the user has made an explicit language choice — the auto-detect
    // banner (lang-banner.js) checks this so it never nags after a real choice.
    try { localStorage.setItem('declare-lang-set', '1'); } catch (e) {}
  }
  function currentLang() {
    var c = readCookie(); if (c === 'es' || c === 'en') return c;
    try { var l = localStorage.getItem('declare-lang'); if (l === 'es' || l === 'en') return l; } catch (e) {}
    return 'en';
  }
  function dict() { return (window.__I18N_STRINGS || {}); }
  function tr(key, lang) {
    lang = lang || currentLang();
    var d = dict();
    if (lang === 'es' && d.es && d.es[key] != null) return d.es[key];
    return null; // null => use the original English in the DOM
  }
  function swapText(el, lang) {
    var key = el.getAttribute('data-i18n');
    if (el.__en == null) el.__en = el.textContent;
    var s = tr(key, lang);
    el.textContent = (s != null) ? s : el.__en;
  }
  function swapAttr(el, dataAttr, targetAttr, lang) {
    var key = el.getAttribute(dataAttr);
    var stash = '__i18n_' + targetAttr;
    if (el[stash] == null) el[stash] = el.getAttribute(targetAttr) || '';
    var s = tr(key, lang);
    el.setAttribute(targetAttr, (s != null) ? s : el[stash]);
  }
  function apply(lang) {
    lang = lang || currentLang();
    document.documentElement.setAttribute('data-lang', lang);
    try { document.documentElement.setAttribute('lang', lang === 'es' ? 'es' : 'en'); } catch (e) {}
    try {
      var i, nodes = document.querySelectorAll('[data-i18n]');
      for (i = 0; i < nodes.length; i++) swapText(nodes[i], lang);
      var ph = document.querySelectorAll('[data-i18n-ph]'); for (i = 0; i < ph.length; i++) swapAttr(ph[i], 'data-i18n-ph', 'placeholder', lang);
      var ar = document.querySelectorAll('[data-i18n-aria]'); for (i = 0; i < ar.length; i++) swapAttr(ar[i], 'data-i18n-aria', 'aria-label', lang);
      var ti = document.querySelectorAll('[data-i18n-title]'); for (i = 0; i < ti.length; i++) swapAttr(ti[i], 'data-i18n-title', 'title', lang);
      // href swap: data-i18n-href holds the SPANISH href; English href stays in the attr.
      var hr = document.querySelectorAll('[data-i18n-href]');
      for (i = 0; i < hr.length; i++) {
        var el = hr[i];
        if (el.__enHref == null) el.__enHref = el.getAttribute('href') || '';
        el.setAttribute('href', (lang === 'es') ? el.getAttribute('data-i18n-href') : el.__enHref);
      }
    } catch (e) {}
  }
  function setLang(l) {
    l = (l === 'es') ? 'es' : 'en';
    writeCookie(l);
    apply(l);
    try { document.dispatchEvent(new CustomEvent('declare-lang', { detail: { lang: l } })); } catch (e) {}
  }
  window.I18N = {
    lang: currentLang,
    t: function (k, fb) { var s = tr(k); return s != null ? s : (fb != null ? fb : k); },
    setLang: setLang,
    toggle: function () { setLang(currentLang() === 'es' ? 'en' : 'es'); },
    apply: apply
  };
  // ?lang=es|en in the URL wins ONCE and persists — lets the Spanish static pages
  // (/es/*) hand a visitor into the app (/word, /today, /journey) already in Spanish.
  // The param is then STRIPPED from the URL: if it stayed, the in-app toggle could
  // never switch back (every reload would re-apply ?lang=es over the new choice).
  try {
    var qp = new URLSearchParams(location.search).get('lang');
    if (qp === 'es' || qp === 'en') {
      writeCookie(qp);
      // Mark the choice as pending-push (account-sync's flag): without this, a
      // signed-in visitor arriving via ?lang=es gets the URL choice silently
      // pulled back over by the account's stored language on the next sync.
      try { localStorage.setItem('declare-lang-push', '1'); } catch (eF) {}
      try {
        var u = new URL(location.href);
        u.searchParams.delete('lang');
        history.replaceState(history.state, '', u.pathname + u.search + u.hash);
      } catch (e2) {}
    }
  } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(); });
  else apply();
})();
