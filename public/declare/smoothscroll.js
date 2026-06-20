/* ============================================================
   DECLARE — Smooth scroll  (smoothscroll.js)
   One Lenis instance per page, exposed as window.__declareLenis so
   atmosphere/parallax can read the SAME scroll loop (never a second
   instance). Desktop wheel smoothing; native mobile momentum is kept
   (Lenis default smoothTouch:false). Stands down fully under
   prefers-reduced-motion. Uses the vendored Lenis (no CDN, no IP leak).

   Load order on a page:
     <script defer src="/declare/vendor/lenis.min.js"></script>
     <script defer src="/declare/smoothscroll.js"></script>
   ============================================================ */
(function(){
  if (window.__declareLenis) return;                 // double-init guard
  try {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof Lenis === 'undefined') return;         // vendored lib not loaded
    var lenis = new Lenis({ smoothWheel: true });     // smoothTouch:false (default) → native mobile feel
    window.__declareLenis = lenis;
    function raf(t){ lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  } catch (e) {}
})();
