/* Explore-zone nav: a signed-in visitor must never be told to "Sign in".
   The give pages are static HTML with a hardcoded "Sign in" link, so this reads
   the Better Auth session straight from localStorage (no SDK, no network) and,
   when a session exists, turns that link into a link to the person's account.
   Signed-out visitors are untouched. */
(function () {
  try {
    var raw = localStorage.getItem('better-auth_session_data');
    if (!raw) return;
    var u = (JSON.parse(raw) || {}).user;
    if (!u) return;
    var es = !!document.querySelector('[data-lang="es"]') ||
             (document.documentElement.lang || '').slice(0, 2) === 'es';
    var label = ((u.name || '').trim().split(/\s+/)[0]) || (es ? 'Cuenta' : 'Account');
    var links = document.querySelectorAll('a.signin');
    for (var i = 0; i < links.length; i++) {
      links[i].textContent = label;
      links[i].setAttribute('href', '/you');
    }
  } catch (e) {}
})();
