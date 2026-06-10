/* =========================================================================
   BREATH RING  —  Open-style breathwork for Declare's Journey.
   A soft circle with a gold glow on a dark field. Inhale expands and the glow
   swells, hold rests, exhale contracts and the glow settles. A countdown sits
   in the center. Animates transform + opacity only. Reduced-motion shows a
   static ring that still guides with text + countdown. Always skippable.

   window.BreathRing.mount(container, {
     seq:   [{label, secs, scale, glow}],   // phases; default = arrive (4-4-4)
     caption,                               // small line under the ring
     loop,                                  // repeat seq forever until skipped
     autostart,                             // begin immediately (default true)
     skipLabel,                             // text on the skip control
     onDone, onSkip
   }) -> { start, stop, destroy }
   ========================================================================= */
(function(){
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // inject styles once
  if(!document.getElementById('breath-ring-css')){
    var s=document.createElement('style'); s.id='breath-ring-css';
    s.textContent = [
      '.breath{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;width:100%;}',
      '.breath-cap{font-family:"Cormorant Garamond",serif;font-size:20px;font-style:italic;color:var(--text2,#C7D6CD);text-align:center;max-width:24ch;line-height:1.4;min-height:1.4em;}',
      '.breath-stage{position:relative;width:240px;height:240px;display:flex;align-items:center;justify-content:center;}',
      '.breath-glow{position:absolute;width:100%;height:100%;border-radius:50%;opacity:.4;',
      '  background:radial-gradient(circle,rgba(232,201,122,.55),rgba(216,184,95,.14) 55%,transparent 72%);',
      '  transition:transform 4s cubic-bezier(.4,0,.4,1),opacity 4s ease;will-change:transform,opacity;}',
      '.breath-ring{position:relative;width:150px;height:150px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
      '  border:1.5px solid rgba(232,201,122,.55);box-shadow:0 0 40px -6px rgba(216,184,95,.4),inset 0 0 30px -8px rgba(216,184,95,.3);',
      '  background:radial-gradient(circle at 50% 42%,rgba(232,201,122,.12),transparent 70%);',
      '  transition:transform 4s cubic-bezier(.4,0,.4,1);will-change:transform;transform:scale(.62);}',
      '.breath-count{font-family:"DM Sans",sans-serif;font-size:34px;font-weight:300;color:var(--text,#F3EFE6);font-variant-numeric:tabular-nums;}',
      '.breath-label{font-family:"DM Sans",sans-serif;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--goldd,#E2C572);font-weight:500;min-height:1em;transition:opacity .5s ease;}',
      '.breath-skip{margin-top:4px;background:none;border:0;color:var(--soft,rgba(244,240,231,.6));font-family:"DM Sans",sans-serif;font-size:12.5px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:8px;}',
      '.breath-skip:hover{color:var(--muted,#92A89E);}',
      '@media (prefers-reduced-motion:reduce){.breath-glow,.breath-ring{transition:none!important;}}'
    ].join('');
    document.head.appendChild(s);
  }

  var ARRIVE = [
    {label:'Breathe in', secs:4, scale:1.0,  glow:.95},
    {label:'Hold',       secs:4, scale:1.0,  glow:.95},
    {label:'Breathe out',secs:4, scale:.62,  glow:.4}
  ];

  function mount(container, opts){
    opts = opts || {};
    var seq = opts.seq || ARRIVE;
    var loop = !!opts.loop;
    var auto = opts.autostart !== false;

    container.innerHTML='';
    var root=document.createElement('div'); root.className='breath';
    var cap=document.createElement('div'); cap.className='breath-cap'; cap.textContent=opts.caption||'';
    var stage=document.createElement('div'); stage.className='breath-stage';
    var glow=document.createElement('div'); glow.className='breath-glow';
    var ring=document.createElement('div'); ring.className='breath-ring';
    var count=document.createElement('span'); count.className='breath-count';
    var label=document.createElement('div'); label.className='breath-label';
    var skip=document.createElement('button'); skip.className='breath-skip'; skip.type='button'; skip.textContent=opts.skipLabel||'Skip';

    ring.appendChild(count); stage.appendChild(glow); stage.appendChild(ring);
    root.appendChild(cap); root.appendChild(stage); root.appendChild(label); root.appendChild(skip);
    if(!opts.caption) cap.style.display='none';
    container.appendChild(root);

    var i=0, ptimer=null, ctimer=null, dead=false, started=false;

    function clearTimers(){ clearTimeout(ptimer); clearInterval(ctimer); }
    function setDur(secs){ var d=RM?'0s':secs+'s'; ring.style.transitionDuration=d; glow.style.transitionDuration=d; }

    function phase(){
      if(dead) return;
      if(i>=seq.length){
        if(loop){ i=0; } else { done(); return; }
      }
      var p=seq[i++];
      if(opts.onPhase) opts.onPhase(i-1, p, seq.length);
      label.textContent=p.label;
      setDur(p.secs);
      // force a frame so the transition picks up the new duration
      requestAnimationFrame(function(){
        ring.style.transform='scale('+(p.scale)+')';
        glow.style.opacity=(p.glow);
        glow.style.transform='scale('+(0.7+0.3*p.scale)+')';
      });
      var n=p.secs; count.textContent=n;
      clearInterval(ctimer);
      ctimer=setInterval(function(){ n--; if(n>=1) count.textContent=n; }, 1000);
      ptimer=setTimeout(phase, p.secs*1000);
    }
    function done(){ clearTimers(); label.textContent='Amen'; if(opts.onDone) opts.onDone(); }
    function start(){ if(started) return; started=true; i=0; phase(); }
    function stop(){ dead=true; clearTimers(); }
    skip.addEventListener('click', function(){ stop(); if(opts.onSkip) opts.onSkip(); });

    if(auto){ if(RM){ // reduced motion: still guide, but no growth animation
        start();
      } else { requestAnimationFrame(start); } }

    return { start:start, stop:stop, destroy:function(){ stop(); container.innerHTML=''; } };
  }

  window.BreathRing = { mount:mount, ARRIVE:ARRIVE };
})();
