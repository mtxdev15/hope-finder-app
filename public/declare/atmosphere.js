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

  // ---- Optional bounded parallax on [data-parallax] layers ----
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var layers = document.querySelectorAll('[data-parallax]');
  if (REDUCED || !layers.length) return;
  var small = window.matchMedia && matchMedia('(max-width:480px)').matches;

  function apply(scroll){
    for (var i=0;i<layers.length;i++){
      var el = layers[i];
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.12;
      if (small) speed *= 0.5;
      var y = Math.max(-40, Math.min(40, scroll * speed));
      el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    }
  }
  function onScroll(e){
    var s = (e && (e.animatedScroll != null ? e.animatedScroll : e.scroll));
    if (s == null) s = window.scrollY || window.pageYOffset || 0;
    apply(s);
  }
  function attach(){
    if (window.__declareLenis && window.__declareLenis.on){
      window.__declareLenis.on('scroll', onScroll);
    }
  }
  if (window.__declareLenis) attach();
  else window.addEventListener('load', attach); // smoothscroll may init a tick later
})();
