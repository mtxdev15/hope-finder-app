/* Declare — Layer 5: gentle Spanish auto-detect banner.
   Shows ONCE to visitors whose browser prefers Spanish and who have not yet made a
   language choice. It never switches silently — the user taps to accept. Choosing
   either option (here or via the menu toggle) sets 'declare-lang-set' so this never
   nags again. Load AFTER i18n.js in DeclareLayout. Self-contained (own CSS + DOM). */
(function () {
  function hasChosen() {
    try { if (localStorage.getItem('declare-lang-set') === '1') return true; } catch (e) {}
    // A stored language (from any prior real choice) also counts as chosen.
    try { var l = localStorage.getItem('declare-lang'); if (l === 'es' || l === 'en') return true; } catch (e) {}
    return false;
  }
  function prefersSpanish() {
    try {
      var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
      for (var i = 0; i < langs.length; i++) { if (/^es\b/i.test(langs[i] || '')) return true; }
    } catch (e) {}
    return false;
  }
  function curLang() { try { return (window.I18N && window.I18N.lang && window.I18N.lang()) || 'en'; } catch (e) { return 'en'; } }

  function inject() {
    if (document.getElementById('langBannerStyle')) return;
    var css =
      '.lang-banner{position:fixed;left:0;right:0;bottom:0;z-index:1200;display:flex;justify-content:center;' +
      'padding:0 14px calc(14px + env(safe-area-inset-bottom,0px));pointer-events:none;}' +
      '.lang-banner .lb-card{pointer-events:auto;width:100%;max-width:440px;background:#2D4A3E;color:#F3EFE6;' +
      'border:1px solid rgba(201,168,76,.42);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.34);' +
      'padding:15px 16px 14px;transform:translateY(140%);opacity:0;transition:transform .58s cubic-bezier(.16,1,.3,1),opacity .4s ease;}' +
      '.lang-banner.in .lb-card{transform:translateY(0);opacity:1;}' +
      '.lang-banner .lb-top{display:flex;align-items:flex-start;gap:11px;}' +
      '.lang-banner .lb-globe{flex:0 0 auto;width:24px;height:24px;color:#C9A84C;margin-top:1px;}' +
      '.lang-banner .lb-globe svg{width:24px;height:24px;}' +
      '.lang-banner .lb-tx{flex:1;min-width:0;}' +
      '.lang-banner .lb-h{font-family:"Cormorant Garamond",Georgia,serif;font-size:19px;font-weight:600;line-height:1.15;}' +
      '.lang-banner .lb-s{font-family:"DM Sans",system-ui,sans-serif;font-size:12.5px;line-height:1.4;color:rgba(243,239,230,.72);margin-top:2px;}' +
      '.lang-banner .lb-x{flex:0 0 auto;background:none;border:0;color:rgba(243,239,230,.55);cursor:pointer;padding:2px;line-height:0;margin:-2px -2px 0 0;}' +
      '.lang-banner .lb-x svg{width:18px;height:18px;}' +
      '.lang-banner .lb-actions{display:flex;gap:9px;margin-top:12px;}' +
      '.lang-banner .lb-btn{flex:1;font-family:"DM Sans",system-ui,sans-serif;font-size:14px;font-weight:600;' +
      'padding:11px 12px;border-radius:11px;cursor:pointer;border:1px solid transparent;transition:filter .15s ease,background .15s ease;}' +
      '.lang-banner .lb-yes{background:#C9A84C;color:#243b31;}' +
      '.lang-banner .lb-yes:hover{filter:brightness(1.06);}' +
      '.lang-banner .lb-no{background:transparent;color:#F3EFE6;border-color:rgba(243,239,230,.28);}' +
      '.lang-banner .lb-no:hover{background:rgba(243,239,230,.08);}' +
      '@media (prefers-reduced-motion: reduce){.lang-banner .lb-card{transition:opacity .3s ease;transform:none;}}';
    var st = document.createElement('style'); st.id = 'langBannerStyle'; st.textContent = css;
    document.head.appendChild(st);
  }

  function dismiss(el) {
    el.classList.remove('in');
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 600);
  }

  function show() {
    inject();
    var wrap = document.createElement('div');
    wrap.className = 'lang-banner';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', '¿Ver en español?');
    wrap.innerHTML =
      '<div class="lb-card">' +
        '<div class="lb-top">' +
          '<span class="lb-globe" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/></svg></span>' +
          '<div class="lb-tx">' +
            '<div class="lb-h">Declare está disponible en español</div>' +
            '<div class="lb-s">Escritura, declaraciones y oración en tu idioma.</div>' +
          '</div>' +
          '<button class="lb-x" data-lb="no" aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</div>' +
        '<div class="lb-actions">' +
          '<button class="lb-btn lb-yes" data-lb="yes">Ver en español</button>' +
          '<button class="lb-btn lb-no" data-lb="no">Keep English</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    // next frame: slide in
    requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('in'); }); });

    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lb]'); if (!b) return;
      var choice = b.getAttribute('data-lb');
      if (choice === 'yes') {
        try { window.I18N.setLang('es'); } catch (err) {}
        // Reload so JS-rendered dynamic strings re-render in Spanish (not just tagged nodes).
        try { location.reload(); } catch (err) { dismiss(wrap); }
      } else {
        try { window.I18N.setLang('en'); } catch (err) {}  // marks the choice; no visual change
        dismiss(wrap);
      }
    });
  }

  function maybeShow() {
    if (hasChosen()) return;
    if (!prefersSpanish()) return;
    if (curLang() === 'es') return;   // already Spanish somehow — nothing to offer
    if (!window.I18N || !window.I18N.setLang) return;
    // small delay so it arrives gently after the page settles
    setTimeout(show, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeShow);
  else maybeShow();
})();
