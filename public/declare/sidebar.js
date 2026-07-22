/* Desktop sidebar collapse toggle (>=1024px only — see sidebar.css).
   Initial state is resolved synchronously in DeclareLayout's <head> (mirrors
   the theme resolver) so there is no load-time flash; this file only wires
   the click handler and persists the choice. */
(function () {
  var KEY = 'declare-sidebar-collapsed';
  function isCollapsed() {
    return document.documentElement.getAttribute('data-sidebar') === 'collapsed';
  }
  function apply(collapsed) {
    document.documentElement.setAttribute('data-sidebar', collapsed ? 'collapsed' : 'expanded');
    try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch (e) {}
  }
  function wire() {
    var btn = document.getElementById('sbCollapse');
    if (!btn) return;
    btn.setAttribute('aria-pressed', isCollapsed() ? 'true' : 'false');
    btn.addEventListener('click', function () {
      var next = !isCollapsed();
      apply(next);
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
