/* Declare & Believe — branded loader overlay + API.
   The flipping-Bible "Searching the Word" overlay. By default it is NOT shown on
   ordinary link navigation (that only flashes on instant local loads); navigation
   smoothness is handled by native View Transitions + a solid document background
   in declare.css. Use window.RouteLoader.show()/.hide()/.go(url) to surface it
   around genuinely slow work, or set window.__rlAutoNav = true to auto-show on nav.
   Load in <head> (after declare.css):
     <link rel="stylesheet" href="route-loader.css" />
     <script src="route-loader.js" defer></script>
*/
(function () {
  if (window.__declareRouteLoader) return;
  window.__declareRouteLoader = true;

  var cs = document.currentScript;
  var BASE = cs && cs.src ? cs.src.replace(/[^/]*$/, '') : '';
  // Only reveal the loader if the next page hasn't taken over within this window.
  // Navigations faster than this show NOTHING (no flash); only genuinely slow
  // requests cross the threshold and get the flipping-Bible overlay.
  // 200ms is the UX sweet spot (Nielsen response-time limits / Google RAIL):
  // <100ms feels instant, <1s keeps flow; <150ms a flashed loader hurts, >300ms feels laggy.
  var SHOW_DELAY = 200;    // ms to wait before showing the loader during a navigation
  var SAFETY = 12000;      // ms hard cap so a stalled nav never traps the loader up
  var REFS = ['Psalm 34:18','Isaiah 41:10','Matthew 11:28','Philippians 4:6–7',
              'Psalm 46:1','2 Corinthians 12:9','Lamentations 3:22–23','John 14:27'];

  function lightTheme(){ return document.documentElement.getAttribute('data-theme') === 'light'; }
  function logoSrc(){ return BASE + (lightTheme() ? 'brand/logo-light-tight.png' : 'brand/logo-dark-tight.png'); }

  var leaves = '';
  for (var n = 0; n < 5; n++) leaves += '<div class="rl-leaf"><div class="rl-face f"></div><div class="rl-face b"></div><div class="rl-shade"></div></div>';

  var overlay = document.createElement('div');
  overlay.className = 'rl-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-label', 'Searching the Word');
  overlay.innerHTML =
    '<div class="rl-mark"><img alt="" src="' + logoSrc() + '" /></div>' +
    '<div class="rl-book" aria-hidden="true"><div class="rl-shadow"></div>' +
      '<div class="rl-scene">' +
        '<div class="rl-stack l"><span class="rl-lines"></span></div>' +
        '<div class="rl-stack r"><span class="rl-lines"></span></div>' +
        '<div class="rl-spine"></div>' + leaves +
      '</div></div>' +
    '<div class="rl-copy"><h1>Searching the Word<i>.</i><i>.</i><i>.</i></h1>' +
      '<div class="rl-verse"></div></div>' +
    '<div class="rl-seek" aria-hidden="true"></div>';

  function mount(){
    if (!overlay.isConnected) document.body.appendChild(overlay);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  // keep the mark in the correct theme
  new MutationObserver(function(){
    var img = overlay.querySelector('.rl-mark img');
    if (img) img.src = logoSrc();
  }).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });

  // verse cycling — only while visible
  var vEl = overlay.querySelector('.rl-verse'), vi = 0, vCur = null, vTimer = null;
  function nextVerse(){
    if (vCur) vCur.remove();
    var s = document.createElement('span');
    s.textContent = REFS[vi % REFS.length];
    s.className = 'on';
    vEl.appendChild(s); vCur = s; vi++;
  }
  function startVerses(){ vi = 0; if (vEl) { vEl.innerHTML=''; vCur=null; nextVerse(); } vTimer = setInterval(nextVerse, 2900); }
  function stopVerses(){ if (vTimer) clearInterval(vTimer); vTimer = null; }

  var navTimer = null, safetyTimer = null;
  function show(){
    mount();
    if (overlay.classList.contains('rl-show')) return;
    // restart the flip cleanly so it always plays from the top
    overlay.querySelector('.rl-book').style.animation = 'none';
    void overlay.offsetWidth;
    overlay.querySelector('.rl-book').style.animation = '';
    overlay.classList.add('rl-show');
    startVerses();
  }
  function hide(){
    overlay.classList.remove('rl-show');
    stopVerses();
    if (navTimer) { clearTimeout(navTimer); navTimer = null; }
    if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
  }

  // Navigate immediately and only reveal the loader if the new page is slow to arrive.
  // The current page stays visible during the request; if the next document commits
  // before SHOW_DELAY, this page (and the pending timer) is discarded => no flash.
  function go(url){
    if (navTimer) clearTimeout(navTimer);
    navTimer = setTimeout(show, SHOW_DELAY);
    safetyTimer = setTimeout(hide, SAFETY);
    window.location.href = url;
  }

  // NOTE: the loader is intentionally NOT wired to ordinary link navigations.
  // On this prototype every page is local and loads instantly, so auto-showing
  // a loader on each click only produces a flash. Native View Transitions +
  // the solid document background (declare.css) make navigation smooth on their
  // own. The overlay stays available for genuinely slow work via the API below
  // (e.g. window.RouteLoader.go(url) before a known-slow fetch, or .show()/.hide()
  // around an async action). To re-enable auto-nav, set window.__rlAutoNav = true.
  if (window.__rlAutoNav) {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      if (a.dataset.noLoader != null) return;
      if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return;
      if (a.origin && a.origin !== window.location.origin) return;
      var path = (a.pathname || '');
      if (!/\.html?$/i.test(path)) return;
      if (a.href === window.location.href) return;
      e.preventDefault();
      go(a.href);
    }, true);
  }

  // arriving (incl. bfcache restore) — make sure the overlay is down and timers cleared
  window.addEventListener('pageshow', hide);
  window.addEventListener('load', hide);
  // if the page is being torn down for the next document, cancel a pending reveal so
  // it can never flash in the final moments before the new page commits
  window.addEventListener('pagehide', function(){ if (navTimer) { clearTimeout(navTimer); navTimer = null; } });

  // expose a tiny API for programmatic navigations
  window.RouteLoader = { show: show, hide: hide, go: go };

  // Swallow the benign "Transition was skipped" rejection that the native
  // cross-document View Transition (@view-transition: navigation) throws when a
  // transition is interrupted/skipped (fast nav, reload, bfcache). It has no
  // user impact but otherwise surfaces as an unhandled console error.
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    var msg = (r && (r.message || r.name)) || (typeof r === 'string' ? r : '');
    if (/transition was skipped/i.test(msg)) e.preventDefault();
  });
})();