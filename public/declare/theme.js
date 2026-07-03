/* Declare — shared theme controller.
   Modes: System / Light / Dark / Auto(by time). Default System.
   Persisted in localStorage('declare-theme') so the choice carries across
   every screen. Applies data-theme="light|dark" on <html> (matches tokens). */
(function () {
  var STORE = 'declare-theme';
  var root = document.documentElement;

  function sysDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function night() { var h = new Date().getHours(); return h < 6 || h >= 18; }
  function resolve(mode) {
    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    if (mode === 'auto') return night() ? 'dark' : 'light';
    return sysDark() ? 'dark' : 'light'; // system
  }
  function apply(mode) {
    var t = resolve(mode);
    root.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0c130f' : '#FAF7F2');
    document.querySelectorAll('.themectl button').forEach(function (b) {
      if (b.dataset.mode) b.classList.toggle('on', b.dataset.mode === mode);
    });
  }
  var VALID = ['light', 'dark', 'auto', 'system'];
  var mode = localStorage.getItem(STORE) || 'dark';
  // Self-heal: anything invalid (e.g. a stray "undefined" written by a bug) is
  // reset to dark and rewritten, so a corrupted device recovers on next load.
  if (VALID.indexOf(mode) < 0) { mode = 'dark'; try { localStorage.setItem(STORE, mode); } catch (e) {} }
  apply(mode);

  window.DeclareTheme = {
    get: function () { return mode; },
    set: function (m) { if (VALID.indexOf(m) < 0) return; mode = m; localStorage.setItem(STORE, m); apply(m); }
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.themectl button');
    // Only buttons that actually carry a theme mode belong to this engine —
    // other segmented controls sharing the look must never reach it.
    if (b && b.dataset.mode) window.DeclareTheme.set(b.dataset.mode);
  });
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (mode === 'system') apply('system');
      });
    } catch (e) {}
  }
})();

/* NOTE: the legacy "exit veil" page transition that used to live here was removed.
   It fired on EVERY internal link with a forced 340ms delay (no threshold), which
   caused a visible flash on every navigation. Page transitions are now handled by
   the single, threshold-gated route-loader.js (shows only if a load exceeds ~200ms). */
