/* =========================================================================
   THE VINE / TREE OF LIFE  —  John 15:5. A death-to-life living tree.
   Three real garden frames (dead -> budding -> alive) crossfade as the user
   completes each day; fruit ignite one per completed day, gold sparks rise,
   the old struggle label fades and the new identity brightens. Reuses the
   give-page "fill with light" feel. One immersive scene that works in light
   and dark theme (the frame/page chrome adapts; the scene stays the same).

   Same public API as before so journey.astro is unchanged:
     window.TheVine.build(mount, cfg)
       cfg = { total, falseLabel, trueLabel, fruitNames, fruitTruths, fruitColors }
       -> { svg:null, setProgress(completed,total), showCap(i), fruitEls, stop }
   ========================================================================= */
(function () {
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // fruit anchor points over the alive-tree canopy (% of the card)
  var FRUIT = [
    { l: 30, t: 52 }, { l: 62, t: 50 }, { l: 24, t: 40 }, { l: 74, t: 42 }, { l: 50, t: 28 }
  ];
  // glowing fruit colours (inner / mid / outer of a radial gradient)
  var COLORS = {
    gold:  ['rgba(255,247,216,.98)', 'rgba(233,201,112,.62)', 'rgba(216,184,95,0)'],
    green: ['rgba(234,250,212,.98)', 'rgba(130,186,106,.62)', 'rgba(96,150,72,0)'],
    red:   ['rgba(255,224,214,.98)', 'rgba(222,98,82,.62)',   'rgba(196,64,52,0)']
  };

  // asset version — bump on every art change so phones fetch fresh, never a cached old frame
  var ASSET_V = '?v=3.12.1';  // the JPEG assets themselves are unchanged — keep their cache key stable
  // preload the three frames so crossfades are instant after first build
  // Lazy warm-up: ~1MB of JPEG. Only fetch when a tree is actually about to
  // mount (first build() call) — zero-state visitors with no journey never pay it.
  var framesWarmed = false;
  function warmFrames() {
    if (framesWarmed) return; framesWarmed = true;
    ['tree-dead', 'tree-budding', 'tree-alive'].forEach(function (n) { var i = new Image(); i.src = '/declare/' + n + '.jpg' + ASSET_V; });
  }

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function frameImg(name, over) {
    var im = document.createElement('img');
    im.src = '/declare/' + name + '.jpg' + ASSET_V; im.alt = ''; im.setAttribute('aria-hidden', 'true'); im.decoding = 'async';
    if (over) { im.className = 'tl-over'; im.style.opacity = '0'; } else { im.style.opacity = '1'; }
    return im;
  }

  function build(mount, cfg) {
    warmFrames();
    cfg = cfg || {};
    var total = cfg.total || 5;

    // cancel a prior instance still animating on this same mount (home card re-renders)
    if (mount._treeStop) { try { mount._treeStop(); } catch (e) {} }
    mount.innerHTML = '';
    mount.classList.add('tree-live');
    mount.style.position = 'relative';
    mount.setAttribute('role', 'img');

    // three crossfading frames: dead in flow (defines height), budding + alive over it
    var dead = frameImg('tree-dead', false);
    var bud = frameImg('tree-budding', true);
    var alive = frameImg('tree-alive', true);
    mount.appendChild(dead); mount.appendChild(bud); mount.appendChild(alive);

    // canvas for rising gold sparks (give-page feel)
    var cvs = document.createElement('canvas'); mount.appendChild(cvs);
    var ctx = cvs.getContext('2d');

    // glowing fruit, one per day, igniting as days complete
    var PAL = cfg.fruitColors || ['gold', 'green', 'gold', 'red', 'gold'];
    var fruitEls = [];
    for (var i = 1; i <= total; i++) {
      var pos = FRUIT[(i - 1) % FRUIT.length];
      var col = COLORS[PAL[(i - 1) % PAL.length]] || COLORS.gold;
      var d = document.createElement('div'); d.className = 'tl-fruit';
      d.style.left = pos.l + '%'; d.style.top = pos.t + '%';
      d.style.background = 'radial-gradient(circle, ' + col[0] + ', ' + col[1] + ' 36%, ' + col[2] + ' 70%)';
      d.dataset.i = i;
      (function (idx, el) { el.addEventListener('click', function () { if (el.classList.contains('on')) showCap(idx); }); })(i, d);
      mount.appendChild(d); fruitEls.push({ el: d, i: i, pos: pos });
    }

    // labels + root caption + fruit caption (HTML overlay; reuses existing .vine-* CSS)
    var lab = document.createElement('div'); lab.style.cssText = 'position:absolute;inset:0;pointer-events:none'; mount.appendChild(lab);
    function mkLabel(cls, text) {
      var n = document.createElement('div'); n.className = 'vine-lab ' + cls;
      if (cls === 'false') { n.style.left = '17%'; n.style.top = '80%'; n.style.transform = 'translate(-50%,-50%)'; }
      else { n.style.right = '13%'; n.style.top = '16%'; n.style.transform = 'translateY(-50%)'; }
      n.style.transition = 'opacity .9s ease'; n.textContent = text; lab.appendChild(n); return n;
    }
    var falseLab = cfg.falseLabel ? mkLabel('false', cfg.falseLabel) : null;
    var trueLab = cfg.trueLabel ? mkLabel('true', cfg.trueLabel) : null;
    var root = document.createElement('div'); root.className = 'vine-root'; root.innerHTML = 'Jesus, the Vine <span>John 15:5</span>'; mount.appendChild(root);
    var cap = document.createElement('div'); cap.className = 'vine-cap'; mount.appendChild(cap); var capT;
    function showCap(i) {
      var nm = (cfg.fruitNames || [])[i - 1] || ('Day ' + i + ' fruit'), trh = (cfg.fruitTruths || [])[i - 1] || '';
      cap.innerHTML = '<span class="cn">' + esc(nm) + '</span>' + (trh ? '<span class="ct">' + esc(trh) + '</span>' : '');
      cap.classList.add('show'); clearTimeout(capT); capT = setTimeout(function () { cap.classList.remove('show'); }, 2800);
    }

    // ---- state + animation ----
    var level = 0, target = 0, completed = 0, running = true, raf = 0, last = 0;
    var sparks = [], spawnAcc = 0, cw = 10, ch = 10;

    function applyLayers() {
      var seg = level * 2;
      dead.style.opacity = clamp(1 - seg).toFixed(3);
      bud.style.opacity = (level <= 0.5 ? clamp(seg) : clamp(2 - seg)).toFixed(3);
      alive.style.opacity = clamp(seg - 1).toFixed(3);
    }
    function setAria() {
      mount.setAttribute('aria-label',
        completed <= 0
          ? 'The tree of life stands bare and lifeless in ' + ((cfg.falseLabel || 'the struggle').toLowerCase()) + '.'
          : completed >= total
            ? 'The tree of life in full leaf, alight with ' + total + ' fruit — alive in ' + ((cfg.trueLabel || 'Christ').toLowerCase()) + '.'
            : 'Day ' + completed + ' of ' + total + '. The tree is coming back to life and bears ' + completed + ' fruit.');
    }
    function setProgress(c, tot) {
      tot = tot || total; completed = Math.max(0, Math.min(tot, c | 0));
      var reveal = tot ? completed / tot : 0; target = reveal;
      fruitEls.forEach(function (f) { f.el.classList.toggle('on', f.i <= completed); });
      if (falseLab) falseLab.style.opacity = (reveal >= 1 ? 0.16 : 0.6 * (1 - 0.8 * reveal)).toFixed(2);
      if (trueLab) trueLab.style.opacity = (0.3 + 0.65 * reveal).toFixed(2);
      setAria();
      if (RM) { level = target; applyLayers(); }
    }
    function ensureSize() {
      var w = mount.clientWidth, h = mount.clientHeight;
      if (w && h && (w !== cw || h !== ch)) {
        cw = w; ch = h; var dpr = Math.min(2, window.devicePixelRatio || 1);
        cvs.width = w * dpr; cvs.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    function loop(ts) {
      if (!running || !mount.isConnected) { running = false; return; }
      if (!last) last = ts; var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      level += (target - level) * Math.min(1, dt * 2.6); applyLayers(); ensureSize();
      var lit = fruitEls.filter(function (f) { return f.i <= completed; });
      if (lit.length) {
        spawnAcc += dt * (0.5 + 3.0 * level);
        while (spawnAcc > 1) {
          spawnAcc -= 1; var p = lit[(Math.random() * lit.length) | 0].pos;
          sparks.push({ x: p.l / 100 * cw + (Math.random() * 16 - 8), y: p.t / 100 * ch, vy: -(10 + Math.random() * 16), life: 0, max: 1.4 + Math.random() * 1.2, r: 1 + Math.random() * 1.8, drift: Math.random() * 10 - 5 });
        }
      }
      ctx.clearRect(0, 0, cw, ch);
      for (var k = sparks.length - 1; k >= 0; k--) {
        var s = sparks[k]; s.life += dt; if (s.life >= s.max) { sparks.splice(k, 1); continue; }
        var u = s.life / s.max, a = Math.sin(u * Math.PI) * 0.65, x = s.x + s.drift * u, y = s.y + s.vy * s.life;
        var g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 4);
        g.addColorStop(0, 'rgba(245,225,150,' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(216,184,95,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s.r * 4, 0, 6.2832); ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); }
    mount._treeStop = stop;

    if (RM) { applyLayers(); } else { raf = requestAnimationFrame(loop); }

    return { svg: null, setProgress: setProgress, showCap: showCap, fruitEls: fruitEls, stop: stop };
  }

  window.TheVine = { build: build };
})();
