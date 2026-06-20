/* ============================================================
   DECLARE — Scroll atmosphere engine  (atmosphere.js)
   Writes the active narrative zone to <html data-atmos>; atmosphere.css
   morphs a fixed wash/glow between zones. The work per scroll is a
   handful of IntersectionObserver callbacks (once per zone crossing),
   never per-frame math — calm on a phone, kind to the battery.

   Optional: any element with a [data-parallax="0.12"] attribute drifts
   gently with the shared smooth-scroll loop (bounded, transform-only,
   desktop + non-reduced-motion only). No [data-parallax] → no-op.

   Load AFTER smoothscroll.js so window.__declareLenis exists.
   ============================================================ */
(function(){
  var sections = document.querySelectorAll('[data-atmos]');
  if (!sections.length) return;

  // Inject the single fixed atmosphere layer (zero per-page markup needed).
  if (!document.getElementById('db-atmos')) {
    var layer = document.createElement('div');
    layer.id = 'db-atmos';
    layer.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(layer, document.body.firstChild);
  }

  var root = document.documentElement;
  // Seed the first zone so there is no transparent flash on load.
  root.dataset.atmos = sections[0].getAttribute('data-atmos');

  // Active zone = the section crossing a thin band at the viewport middle.
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (e.isIntersecting){
        var z = e.target.getAttribute('data-atmos');
        if (z && root.dataset.atmos !== z) root.dataset.atmos = z;
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  sections.forEach(function(s){ io.observe(s); });

  // ---- Continuous viewport-relative parallax on [data-parallax] layers ----
  // Each element drifts based on where it sits in the viewport (oevra's
  // data-scroll="parallax" / data-scroll-y). It is ALWAYS moving as you scroll —
  // 0 drift at viewport centre, easing up/down toward the edges. Bound, GPU-only.
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var layers = document.querySelectorAll('[data-parallax]');
  if (REDUCED || !layers.length) return;
  var scale = (window.matchMedia && matchMedia('(max-width:480px)').matches) ? 0.55 : 1;
  var queued = false;

  function apply(){
    queued = false;
    var vh = window.innerHeight || 800;
    for (var i=0;i<layers.length;i++){
      var el = layers[i];
      var speed = (parseFloat(el.getAttribute('data-parallax')) || 0.1) * scale;
      var r = el.getBoundingClientRect();
      var fromCentre = (r.top + r.height/2) - vh/2;   // +below centre, -above
      var y = -fromCentre * speed;                    // drift opposite → parallax
      el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    }
  }
  function onScroll(){ if(!queued){ queued = true; requestAnimationFrame(apply); } }

  if (window.__declareLenis && window.__declareLenis.on) window.__declareLenis.on('scroll', onScroll);
  window.addEventListener('scroll', onScroll, { passive:true });   // native / mobile
  window.addEventListener('resize', onScroll, { passive:true });
  apply();
})();
