/* Explore-zone nav: a signed-in visitor must never be told to "Sign in", and
   should have a clear way to their account. The explore pages are static HTML,
   so this reads the Better Auth session straight from localStorage (no SDK, no
   network) and, when a session exists:
     1. turns every "Sign in" link (top bar + menu) into a link to the account,
        labelled with the person's first name, and
     2. adds a "You" link to the top of the slide-out menu's Explore list.
   Signed-out visitors are left exactly as they were. */
(function () {
  try {
    var raw = localStorage.getItem('better-auth_session_data');
    if (!raw) return;
    var u = (JSON.parse(raw) || {}).user;
    if (!u) return;

    var es = !!document.querySelector('[data-lang="es"]') ||
             (document.documentElement.lang || '').slice(0, 2) === 'es';
    var name = ((u.name || '').trim().split(/\s+/)[0]) || (es ? 'Cuenta' : 'Account');

    // 1) "Sign in" → the person's account
    var links = document.querySelectorAll('a.signin');
    for (var i = 0; i < links.length; i++) {
      links[i].textContent = name;
      links[i].setAttribute('href', '/you');
    }

    // 2) a clear "You" link at the top of the menu's Explore list
    var sec = document.querySelector('.menupanel .menusec');
    if (sec && !sec.querySelector('a[href="/you"]')) {
      var a = document.createElement('a');
      a.className = 'ms-link';
      a.setAttribute('href', '/you');
      a.innerHTML = '<span class="msw">' + (es ? 'Tu cuenta' : 'You') + '</span>';
      var lbl = sec.querySelector('.ms-lbl');
      if (lbl && lbl.nextSibling) sec.insertBefore(a, lbl.nextSibling);
      else sec.appendChild(a);
    }
  } catch (e) {}
})();
