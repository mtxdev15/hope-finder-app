/* ============================================================
   DECLARE — Give globe (give-globe.js)
   A dotted sphere of the world that lights up as the gift grows.
   Each lit point = lives the Word reaches; occasional rising
   "pulses" = someone meeting it for the first time. Accent + theme
   aware, dependency-free, and calmed under reduced-motion.
   window.GiveGlobe.mount(canvas, accentEl) → { setLevel, refresh, stop }
   ============================================================ */
(function () {
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GA = Math.PI * (3 - Math.sqrt(5)); // golden angle

  // normalize any CSS color string → [r,g,b]
  var _probe = document.createElement('canvas').getContext('2d');
  function rgbOf(str) {
    try { _probe.fillStyle = '#000'; _probe.fillStyle = str; } catch (e) { return [216, 184, 95]; }
    var v = _probe.fillStyle;
    if (v[0] === '#') {
      var h = v.slice(1);
      if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var m = v.match(/rgba?\(([^)]+)\)/);
    if (m) { var p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2]]; }
    return [216, 184, 95];
  }

  function mount(canvas, accentEl) {
    var ctx = canvas.getContext('2d');
    var N = 540, pts = [];
    for (var i = 0; i < N; i++) {
      var t = (i + 0.5) / N, y = 1 - 2 * t, r = Math.sqrt(Math.max(0, 1 - y * y)), phi = i * GA;
      // deterministic "fill order" so points illuminate organically, not top-down
      var rank = (Math.sin(i * 12.9898 + 1.13) * 43758.5453) % 1; rank = rank < 0 ? rank + 1 : rank;
      pts.push({ x: Math.cos(phi) * r, y: y, z: Math.sin(phi) * r, rank: rank });
    }

    var acc = [216, 184, 95], dim = acc, isLight = false;
    function refresh() {
      var cs = getComputedStyle(accentEl || document.documentElement);
      acc = rgbOf(cs.getPropertyValue('--acc').trim() || '#D8B85F');
      isLight = document.documentElement.getAttribute('data-theme') !== 'dark';
      dim = acc;
    }
    refresh();

    var dpr = Math.min(2.5, window.devicePixelRatio || 1), W = 0, H = 0;
    function size() {
      var b = canvas.getBoundingClientRect();
      W = Math.max(1, b.width); H = Math.max(1, b.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    size();
    if (window.ResizeObserver) { var ro = new ResizeObserver(size); ro.observe(canvas); }
    else window.addEventListener('resize', size);

    var level = 0, target = 0, rot = -0.5, pulses = [], last = 0, raf = 0, running = true;

    function spawnPulse() {
      // pick a lit, front-ish point at the current rotation
      var tries = 0;
      while (tries++ < 24) {
        var p = pts[(Math.random() * N) | 0];
        if (p.rank > level) continue;
        var rz = p.x * Math.sin(rot) + p.z * Math.cos(rot);
        if (rz < 0.05) continue;
        var rx = p.x * Math.cos(rot) - p.z * Math.sin(rot);
        pulses.push({ rx: rx, ry: p.y, rz: rz, age: 0 });
        if (pulses.length > 14) pulses.shift();
        return;
      }
    }

    function draw(ts) {
      if (!running) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
      level += (target - level) * Math.min(1, dt * 4);

      if (!REDUCED) rot += dt * 0.16;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46, focal = 2.45;
      var cs = Math.cos(rot), sn = Math.sin(rot);

      // rotate + project, collect, sort back→front
      var arr = [];
      for (var i = 0; i < N; i++) {
        var p = pts[i];
        var rx = p.x * cs - p.z * sn, rz = p.x * sn + p.z * cs, ry = p.y;
        var persp = focal / (focal - rz);
        arr.push({ sx: cx + rx * R * persp, sy: cy + ry * R * persp, rz: rz, persp: persp, lit: p.rank < level });
      }
      arr.sort(function (a, b) { return a.rz - b.rz; });

      for (var k = 0; k < arr.length; k++) {
        var a = arr[k], d = (a.rz + 1) / 2; // 0 back .. 1 front
        var sz = (a.lit ? 1.7 : 1.25) * a.persp * (0.55 + 0.55 * d) * (Math.min(W, H) / 300);
        if (a.lit) {
          var la = isLight ? (0.55 + 0.45 * d) : (0.6 + 0.4 * d);
          // soft glow
          var g = ctx.createRadialGradient(a.sx, a.sy, 0, a.sx, a.sy, sz * 4.2);
          g.addColorStop(0, 'rgba(' + acc[0] + ',' + acc[1] + ',' + acc[2] + ',' + (0.5 * d) + ')');
          g.addColorStop(1, 'rgba(' + acc[0] + ',' + acc[1] + ',' + acc[2] + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(a.sx, a.sy, sz * 4.2, 0, 6.2832); ctx.fill();
          ctx.fillStyle = 'rgba(' + acc[0] + ',' + acc[1] + ',' + acc[2] + ',' + la + ')';
        } else {
          var ua = isLight ? (0.16 + 0.28 * d) : (0.10 + 0.26 * d);
          ctx.fillStyle = 'rgba(' + dim[0] + ',' + dim[1] + ',' + dim[2] + ',' + ua + ')';
        }
        ctx.beginPath(); ctx.arc(a.sx, a.sy, Math.max(0.4, sz), 0, 6.2832); ctx.fill();
      }

      // rising pulses
      if (!REDUCED && level > 0.001 && Math.random() < dt * (1.1 + level * 4.5)) spawnPulse();
      for (var j = pulses.length - 1; j >= 0; j--) {
        var pu = pulses[j]; pu.age += dt;
        if (pu.age > 1.6 || pu.rz < 0) { pulses.splice(j, 1); continue; }
        var pp = focal / (focal - pu.rz), px = cx + pu.rx * R * pp, py = cy + pu.ry * R * pp;
        var prog = pu.age / 1.6, rad = (3 + prog * 20) * (Math.min(W, H) / 300);
        ctx.strokeStyle = 'rgba(' + acc[0] + ',' + acc[1] + ',' + acc[2] + ',' + (0.55 * (1 - prog)) + ')';
        ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(px, py, rad, 0, 6.2832); ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return {
      setLevel: function (v) { target = Math.max(0, Math.min(1, v)); },
      refresh: refresh,
      stop: function () { running = false; cancelAnimationFrame(raf); }
    };
  }

  window.GiveGlobe = { mount: mount };
})();
