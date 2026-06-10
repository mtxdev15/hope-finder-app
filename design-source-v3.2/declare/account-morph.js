/* ============================================================
   DECLARE — Avatar → Account shared-element morph (account-morph.js)
   ------------------------------------------------------------
   Gives the "You" avatar / tab a single, intentional motion: when you
   tap it, the little avatar FLIES and GROWS into the big gold hero
   avatar on the Account page (Account-A.html) — and reverses on the way
   back. Everywhere else, navigation stays exactly as it was (instant).

   How it stays scoped (this is the important part):
   A cross-document View Transition pairs two elements only when BOTH
   pages expose the SAME `view-transition-name` at swap time. We never
   bake that name into the markup — instead we assign it on the fly, and
   ONLY when one side of the navigation is the Account page. So tapping
   "Vault" or "Word" never drags the avatar across the screen; the morph
   is reserved for going to / from You.

   Detection is origin-independent (works even where the Navigation API's
   activation info isn't exposed): the forward leg keys off the tapped
   link, and a sessionStorage flag carries the intent across the swap so
   the arriving page knows to pair too.

   Each page marks its morph element with `data-you-morph`:
     • source pages → the avatar / "You" tab icon
     • Account-A    → the hero avatar (.aavatar)

   Load in <head> (after declare.css), deferred:
     <script src="account-morph.js" defer></script>
   ============================================================ */
(function () {
  if (window.__declareAccountMorph) return;
  window.__declareAccountMorph = true;

  var ACCOUNT = 'Account-A.html';
  var NAME = 'db-you-av';   // shared view-transition-name (assigned only during account navs)
  var TYPE = 'to-account';  // view-transition-type that unlocks the root focus-pull in CSS
  var FLAG = '__dbMorphNav';
  var FROM = '__dbAccountFrom'; // the page You was opened from, so Back returns there

  function file(url) {
    try { return new URL(url, location.href).pathname.split('/').pop(); }
    catch (e) { return ''; }
  }

  function isAccount(url) {
    if (!url) return false;
    try { return new URL(url, location.href).pathname.split('/').pop() === ACCOUNT; }
    catch (e) { return url.indexOf(ACCOUNT) !== -1; }
  }
  function onAccount() { return isAccount(location.href); }

  // The element this page contributes to the morph. A page may carry more than
  // one candidate (e.g. two stacked screens); pick the first actually rendered
  // so a display:none copy is never chosen (it would have no snapshot to pair).
  function morphEl() {
    var els = document.querySelectorAll('[data-you-morph]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].getClientRects().length) return els[i];
    }
    return els[0] || null;
  }
  function visible(el) { return el && el.isConnected && el.getClientRects().length; }
  // Prefer the precise morph node inside whatever was tapped: a tab's <a> wraps
  // the icon + "You" label, but we want just the round icon to grow into the hero.
  function resolve(a) {
    if (!a) return null;
    if (a.matches && a.matches('[data-you-morph]')) return a;
    var inner = a.querySelector && a.querySelector('[data-you-morph]');
    return inner || a;
  }

  // Remember the actual control tapped to reach Account, so the morph flies FROM
  // that element (a header avatar, or the "You" tab) rather than a fixed one.
  var trigger = null;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && isAccount(a.href)) trigger = a;
  }, true);

  function setFlag(v) { try { v ? sessionStorage.setItem(FLAG, '1') : sessionStorage.removeItem(FLAG); } catch (e) {} }
  function getFlag() { try { return sessionStorage.getItem(FLAG) === '1'; } catch (e) { return false; } }

  function arm(vt, el) {
    if (el) {
      el.style.viewTransitionName = NAME;
      var release = function () { el.style.viewTransitionName = ''; };
      if (vt && vt.finished && vt.finished.finally) vt.finished.finally(release);
      else setTimeout(release, 1200);
    }
    if (vt && vt.types && vt.types.add) { try { vt.types.add(TYPE); } catch (e) {} }
  }

  // OUTGOING — leaving toward Account (forward) or leaving Account (back).
  addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    var goingToAccount = !!(trigger && isAccount(trigger.href));
    var leavingAccount = onAccount();
    if (goingToAccount || leavingAccount) {
      // remember where You was opened from, so its Back returns to that exact page
      // (and the morph reverses into the very element that was tapped).
      if (goingToAccount) { try { sessionStorage.setItem(FROM, file(location.href)); } catch (e) {} }
      setFlag(true); // hand the intent to the page we're about to land on
      arm(e.viewTransition, leavingAccount ? morphEl() : (visible(trigger) ? resolve(trigger) : morphEl()));
    }
    trigger = null;
  });

  // INCOMING — pair the morph if we just arrived on Account, or the flag says we
  // came from it. Clearing the flag keeps the effect from leaking to later navs.
  addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var expect = getFlag();
    if (onAccount() || expect) {
      setFlag(false);
      arm(e.viewTransition, morphEl());
    }
  });

  // On the Account page, point Back at wherever You was opened from (falling back
  // to the markup's default). This makes the return trip reverse the morph into
  // the same control the user tapped, instead of always dumping them on Today.
  function retargetBack() {
    if (!onAccount()) return;
    var from; try { from = sessionStorage.getItem(FROM); } catch (e) {}
    if (!from || isAccount(from)) return;
    var back = document.querySelector('[data-account-back]') || document.querySelector('.backlink');
    if (back && back.tagName === 'A') back.setAttribute('href', from);
  }
  if (document.readyState !== 'loading') retargetBack();
  else document.addEventListener('DOMContentLoaded', retargetBack);
})();
