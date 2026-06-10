/* ============================================================
   Declare — DeclareRate
   One warm entry point for ratings + testimony.

     DeclareRate.open({ stars, source })   // open the sheet (stars optional pre-fill)
     DeclareRate.hasRated()                 // true once they've left a rating
     DeclareRate.reset()                    // clear (demo/testing)

   The funnel, framed gently:
     • 4–5★  → thank them, invite them to share on the App Store
     • 1–3★  → thank them, route to PRIVATE feedback (never the store)
   Feedback collected: stars + improvement chips + an optional note,
   stashed in localStorage (mock backend) under 'declare-rating'.

   Also auto-wires any inline prompt on the page:
     <div class="dr-jprompt" data-dr-prompt data-dr-source="...">
   …hiding it once a rating exists.

   Load after declare.css / rate.css:
     <link rel="stylesheet" href="rate.css" />
     <script src="rate.js"></script>
   ============================================================ */
(function(){
  // --- store links (TODO dev: drop in the real App Store ID + Play package) ---
  var STORE = {
    ios:     'https://apps.apple.com/app/id0000000000',
    android: 'https://play.google.com/store/apps/details?id=com.declareandbelieve.app',
    web:     'https://declareandbelieve.com/'
  };
  var STORE_KEY = 'declare-rating';
  var SNOOZE_KEY = 'declare-rating-snooze';

  var ICON = {
    star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.85 6.06 6.65.83-4.9 4.54 1.27 6.57L12 17.9l-5.87 3.3 1.27-6.57-4.9-4.54 6.65-.83z"/></svg>',
    starO:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2.6l2.85 6.06 6.65.83-4.9 4.54 1.27 6.57L12 17.9l-5.87 3.3 1.27-6.57-4.9-4.54 6.65-.83z"/></svg>',
    heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.2l-1.7-1.6a5 5 0 0 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z"/></svg>',
    apple:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.5 2.2 2.6 2.1 1-.04 1.4-.67 2.7-.67 1.2 0 1.6.67 2.7.65 1.1-.02 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4-.02-.01-2.1-.81-2.1-3.2zM14.3 6.3c.6-.7 1-1.7.9-2.7-.9.04-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .08 1.9-.5 2.5-1.2z"/></svg>',
    play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.6 2.4l11.6 9.6L3.6 21.6c-.4-.2-.6-.6-.6-1.1V3.5c0-.5.2-.9.6-1.1zm12.9 8.5l2.7-2.2 2.4 1.4c.7.4.7 1.4 0 1.8l-2.4 1.4-2.7-2.4zm-1.3 1.1l-9.9 8.2 9.3-5.4 2-1.7-1.4-1.1zm0-1.9l1.4-1.2-2-1.6-9.3-5.4 9.9 8.2z"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
  };

  // improvement / love chips (one set, reframed by score)
  var CHIPS = ['The daily Word','Journeys','Declarations','Finding a church','Reminders','Speed & reliability','The design & feel'];

  // a tender verse for the private (low-score) thank-you; a glad one for high
  var VERSE_HIGH = { t:'Let the redeemed of the Lord say so.', r:'Psalm 107:2' };
  var VERSE_LOW  = { t:'He is near to the brokenhearted.',      r:'Psalm 34:18' };

  function esc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function platform(){
    var ua=navigator.userAgent||'';
    if(/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if(/Android/i.test(ua)) return 'android';
    return 'web';
  }
  function storeUrl(){ var p=platform(); return STORE[p]||STORE.web; }
  function storeName(){ var p=platform(); return p==='android'?'Google Play':'the App Store'; }

  function hasRated(){ try{ return !!localStorage.getItem(STORE_KEY); }catch(e){ return false; } }
  function save(data){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(data)); }catch(e){} hidePrompts(); }
  function reset(){ try{ localStorage.removeItem(STORE_KEY); localStorage.removeItem(SNOOZE_KEY); }catch(e){} }

  // "Not yet" / "Maybe later" — defer without recording a rating. Quiets the inline
  // prompts for a while; the Account row stays available so they can rate whenever.
  var SNOOZE_DAYS = 7;
  function snooze(){ try{ localStorage.setItem(SNOOZE_KEY, String(Date.now())); }catch(e){} hidePrompts(); }
  function snoozed(){ try{ var t=+localStorage.getItem(SNOOZE_KEY)||0; return !!t && (Date.now()-t) < SNOOZE_DAYS*864e5; }catch(e){ return false; } }

  // ---------- sheet shell ----------
  var scrim, sheet, host, state;
  // Pin to the viewport at body level (the phone .screen is a tall scroll
  // container, so an absolute sheet would land below the fold). Matches DeclareShare.
  function host_(){ return document.body; }

  function mount(){
    host = host_();
    scrim = document.createElement('div');
    scrim.className = 'dr-scrim';
    scrim.innerHTML =
      '<div class="dr-bd" data-close></div>'+
      '<div class="dr-sheet" role="dialog" aria-modal="true" aria-label="Rate Declare">'+
        '<div class="dr-grab"></div>'+
        '<button class="dr-close" data-close aria-label="Close">'+ICON.x+'</button>'+
        '<div class="dr-body" id="drBody"></div>'+
      '</div>';
    host.appendChild(scrim);
    sheet = scrim.querySelector('.dr-sheet');
    scrim.addEventListener('click', function(e){ if(e.target.closest('[data-close]')) close(); });
    enableDrag();
  }
  function close(){
    if(!scrim) return;
    sheet.style.transition='transform .3s ease'; sheet.style.transform='translateY(100%)';
    var s=scrim; scrim=null; sheet=null;
    setTimeout(function(){ if(s&&s.parentNode) s.parentNode.removeChild(s); }, 300);
  }
  function enableDrag(){
    var dragging=false, sy=0, dy=0;
    function start(e){
      var body=document.getElementById('drBody');
      if(sheet.scrollTop>2) return;
      if(e.target.closest('a,button,textarea,input') && !e.target.closest('.dr-grab')) return;
      dragging=true; sy=(e.touches?e.touches[0].clientY:e.clientY); dy=0; sheet.style.transition='none';
    }
    function move(e){
      if(!dragging) return;
      var y=(e.touches?e.touches[0].clientY:e.clientY); dy=y-sy;
      if(dy<0) dy*=0.3;
      sheet.style.transform='translateY('+dy+'px)';
      if(dy>4 && e.cancelable) e.preventDefault();
    }
    function end(){ if(!dragging) return; dragging=false; sheet.style.transition=''; if(dy>120) close(); else sheet.style.transform=''; dy=0; }
    sheet.addEventListener('mousedown',start); sheet.addEventListener('touchstart',start,{passive:true});
    window.addEventListener('mousemove',move); window.addEventListener('touchmove',move,{passive:false});
    window.addEventListener('mouseup',end); window.addEventListener('touchend',end);
  }
  function body(){ return document.getElementById('drBody'); }

  // ---------- star row ----------
  function starRow(current, onPick){
    var wrap=document.createElement('div'); wrap.className='dr-stars'; wrap.setAttribute('role','radiogroup');
    for(var i=1;i<=5;i++){ (function(n){
      var b=document.createElement('button'); b.className='dr-star'+(n<=current?' lit':''); b.type='button';
      b.setAttribute('aria-label', n+' star'+(n>1?'s':''));
      b.innerHTML = n<=current ? ICON.star : ICON.starO;
      b.addEventListener('mouseenter', function(){ paint(wrap, n); });
      b.addEventListener('mouseleave', function(){ paint(wrap, current); });
      b.addEventListener('click', function(){ current=n; paint(wrap, n); b.classList.add('pop'); onPick(n); });
      wrap.appendChild(b);
    })(i); }
    return wrap;
  }
  function paint(wrap, n){
    [].forEach.call(wrap.children, function(b,idx){
      var lit=(idx+1)<=n; b.classList.toggle('lit', lit); b.innerHTML = lit?ICON.star:ICON.starO;
    });
  }

  // ---------- steps ----------
  function open(opts){
    opts=opts||{}; state={ stars:opts.stars||0, source:opts.source||'unknown', chips:[], note:'' };
    if(!scrim) mount();
    if(state.stars){ stepDetail(); } else { stepStars(); }
  }

  function stepStars(){
    var b=body(); b.innerHTML='';
    var w=document.createElement('div'); w.className='dr-step';
    w.innerHTML =
      '<div class="dr-eyebrow">Your testimony</div>'+
      '<h3 class="dr-h">How has Declare met you?</h3>'+
      '<p class="dr-sub">However you answer, it helps us serve you and others better.</p>';
    var sr=starRow(state.stars, function(n){ state.stars=n; setTimeout(stepDetail, 340); });
    w.appendChild(sr);
    var sc=document.createElement('div'); sc.className='dr-scale'; sc.innerHTML='<span>Not yet</span><span>Deeply</span>';
    w.appendChild(sc);
    var later=document.createElement('button'); later.className='dr-btn ghost'; later.type='button'; later.style.marginTop='20px';
    later.textContent='Not yet';
    later.addEventListener('click', function(){ snooze(); close(); });
    w.appendChild(later);
    b.appendChild(w);
  }

  function stepDetail(){
    var glad = state.stars>=4;
    var b=body(); b.innerHTML='';
    var w=document.createElement('div'); w.className='dr-step';
    w.innerHTML =
      '<div class="dr-eyebrow">'+(glad?'That\u2019s a gift to hear':'Thank you for your honesty')+'</div>'+
      '<h3 class="dr-h">'+(glad?'What has meant the most?':'What would help most?')+'</h3>';
    // mini star recap (tappable to change)
    var sr=starRow(state.stars, function(n){ state.stars=n; refreshDetailTone(); });
    sr.style.margin='16px 0 2px'; w.appendChild(sr);

    var lbl=document.createElement('div'); lbl.className='dr-lbl'; lbl.id='drDetailLbl';
    lbl.textContent = glad?'What\u2019s blessed you' : 'Where we can grow';
    w.appendChild(lbl);

    var chips=document.createElement('div'); chips.className='dr-chips';
    CHIPS.forEach(function(c){
      var bn=document.createElement('button'); bn.type='button'; bn.className='dr-chip'+(state.chips.indexOf(c)>-1?' on':''); bn.textContent=c;
      bn.addEventListener('click', function(){
        var i=state.chips.indexOf(c);
        if(i>-1){ state.chips.splice(i,1); bn.classList.remove('on'); }
        else { state.chips.push(c); bn.classList.add('on'); }
      });
      chips.appendChild(bn);
    });
    w.appendChild(chips);

    var note=document.createElement('textarea'); note.className='dr-note'; note.id='drNote';
    note.placeholder = glad ? 'Share what God has done… (optional)' : 'Tell us what you hoped for… (optional)';
    note.value=state.note;
    note.addEventListener('input', function(){ state.note=note.value; });
    w.appendChild(note);

    var actions=document.createElement('div'); actions.className='dr-actions'; actions.id='drActions';
    actions.appendChild(primaryFor(glad));
    var skip=document.createElement('button'); skip.className='dr-btn ghost'; skip.type='button';
    skip.textContent = glad ? 'Maybe later' : 'Done';
    skip.addEventListener('click', function(){ if(glad){ commit(false); close(); } else { commit(false); stepThanks(); } });
    actions.appendChild(skip);
    w.appendChild(actions);
    b.appendChild(w);
  }

  function refreshDetailTone(){
    // re-render detail if the score crossed the glad/tender line
    stepDetail();
  }

  function primaryFor(glad){
    var btn=document.createElement('button'); btn.className='dr-btn primary'; btn.type='button';
    if(glad){
      var ic = platform()==='android'?ICON.play:ICON.apple;
      btn.innerHTML = ic + 'Share on '+storeName();
      btn.addEventListener('click', function(){ commit(true); openStore(); stepThanks(); });
    } else {
      btn.innerHTML = ICON.heart + 'Send privately';
      btn.addEventListener('click', function(){ commit(false); stepThanks(); });
    }
    return btn;
  }

  function commit(routedToStore){
    save({ stars:state.stars, chips:state.chips, note:state.note, source:state.source, routedToStore:!!routedToStore, ts:Date.now() });
  }
  function openStore(){ try{ window.open(storeUrl(), '_blank', 'noopener'); }catch(e){} }

  function stepThanks(){
    var glad=state.stars>=4;
    var v = glad?VERSE_HIGH:VERSE_LOW;
    var b=body(); b.innerHTML='';
    var w=document.createElement('div'); w.className='dr-step dr-done';
    w.innerHTML =
      '<div class="dr-mark">'+(glad?ICON.heart:ICON.check)+'</div>'+
      '<h3 class="dr-h">'+(glad?'Thank you':'We\u2019re listening')+'</h3>'+
      '<p class="dr-sub">'+(glad
        ? 'Your testimony helps someone else find Him. '+(state.source!=='account'?'Walk on \u2014 He\u2019s with you.':'')
        : 'Thank you for trusting us with this. We read every word, and we\u2019ll keep growing.')+'</p>'+
      '<div class="dr-vref">\u201C'+esc(v.t)+'\u201D<span class="ref">'+esc(v.r)+'</span></div>'+
      '<div class="dr-actions"><button class="dr-btn primary" data-close type="button">Amen</button></div>';
    w.querySelector('[data-close]').addEventListener('click', close);
    b.appendChild(w);
  }

  // ---------- inline prompts (e.g. Journey complete) ----------
  function wirePrompts(){
    var nodes=document.querySelectorAll('[data-dr-prompt]');
    [].forEach.call(nodes, function(node){
      if(hasRated() || snoozed()){ node.style.display='none'; return; }
      if(node.dataset.drWired) return; node.dataset.drWired='1';
      var src=node.getAttribute('data-dr-source')||'prompt';
      var mountPt=node.querySelector('[data-dr-stars]')||node;
      var row=starRow(0, function(n){ open({ stars:n, source:src }); });
      mountPt.appendChild(row);
      var later=document.createElement('button'); later.type='button'; later.className='jp-later';
      later.textContent='Maybe later';
      later.addEventListener('click', function(){ snooze(); node.style.display='none'; });
      mountPt.appendChild(later);
    });
  }
  function hidePrompts(){ var n=document.querySelectorAll('[data-dr-prompt]'); [].forEach.call(n,function(x){ x.style.display='none'; }); }

  if(document.readyState!=='loading') wirePrompts();
  else document.addEventListener('DOMContentLoaded', wirePrompts);

  window.DeclareRate = { open:open, hasRated:hasRated, reset:reset };
})();
