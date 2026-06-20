/* ============================================================
   DECLARE — Motion engine (motion.js)
   Thin, dependency-free. Reveals .m-rise/.m-fade/.m-scale/.m-veil
   on scroll via IntersectionObserver, auto-staggers groups, and
   fully stands down under prefers-reduced-motion.
   ============================================================ */
(function(){
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function markIn(el){ el.classList.add('m-in'); }

  function autoStagger(scope){
    // any element with [data-m-stagger] sequences its reveal children
    (scope||document).querySelectorAll('[data-m-stagger]').forEach(function(group){
      var kids = group.querySelectorAll(':scope > .m-rise, :scope > .m-fade, :scope > .m-scale, :scope > .m-veil, :scope > .rv');
      kids.forEach(function(k,i){ if(getcomputed(k)) k.style.setProperty('--i', i); });
    });
  }
  function getcomputed(k){ return !k.style.getPropertyValue('--i'); }

  function init(){
    var targets = document.querySelectorAll('.m-rise, .m-fade, .m-scale, .m-veil, .rv');
    autoStagger(document);

    if(REDUCED || !('IntersectionObserver' in window)){
      targets.forEach(markIn);           // show everything immediately
      return;
    }

    // Fire when the element reaches the MIDDLE of the viewport (like oevra's
    // data-scroll-start="top +=50%"), so the reveal happens in central vision —
    // not at the bottom edge where it finishes before you're looking at it.
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ markIn(e.target); io.unobserve(e.target); }
      });
    }, { rootMargin:'0px 0px -42% 0px', threshold:0 });

    targets.forEach(function(el){
      // already-visible-on-load elements reveal right away (above the fold)
      var r = el.getBoundingClientRect();
      if(r.top < (window.innerHeight||0) * 0.92 && r.bottom > 0){
        // tiny delay lets first paint settle, preserving the rise
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ markIn(el); }); });
      } else {
        io.observe(el);
      }
    });
  }

  // public: re-scan after injecting new DOM (e.g. results cascade)
  window.DeclareMotion = {
    reveal: function(scope, opts){
      opts = opts || {};
      var els = (scope||document).querySelectorAll('.m-rise, .m-fade, .m-scale, .m-veil, .rv');
      autoStagger(scope||document);
      if(REDUCED){ els.forEach(markIn); return; }
      var base = opts.delay || 0, step = opts.stagger || 90;
      els.forEach(function(el,i){
        if(el.classList.contains('m-in')) return;
        setTimeout(function(){ markIn(el); }, base + i*step);
      });
    },
    reduced: REDUCED
  };

  if(document.readyState!=='loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
