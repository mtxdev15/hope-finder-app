/* menu.js — wires the canonical slide-out menu + scrolled-nav state.
   Mirrors the inline open/close logic from public/about.html so the shared
   chrome behaves identically wherever /declare/chrome.css is included.
   Self-initializing IIFE, guarded so it is safe on pages without these nodes. */
(function(){
  function init(){
    // nav goes to its floating-pill state after a little scroll (same as about.html)
    var nav = document.querySelector('.nav');
    if (nav){
      var onScroll = function(){ nav.classList.toggle('scrolled', window.scrollY > 40); };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive:true });
    }

    var scrim = document.getElementById('menuScrim');
    var panel = document.getElementById('menuPanel');
    var openBtn = document.getElementById('menuOpen');
    var closeBtn = document.getElementById('menuClose');
    // nothing to wire if the menu chrome is absent on this page
    if (!scrim || !panel) return;

    function openMenu(){
      scrim.classList.add('open');
      panel.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeMenu(){
      scrim.classList.remove('open');
      panel.classList.remove('open');
      document.body.style.overflow = '';
    }

    if (openBtn) openBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    scrim.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeMenu(); });
    // close when any menu link is tapped (so navigation feels clean on mobile)
    panel.addEventListener('click', function(e){ if (e.target.closest('a')) closeMenu(); });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
