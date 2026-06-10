/* ============================================================
   Declare — DeclareWaitlist
   "Coming soon" iOS app waitlist, one entry point:

     DeclareWaitlist.open({ source, email, signedIn })
     DeclareWaitlist.hasJoined()
     DeclareWaitlist.reset()

   Adapts to who's asking:
     • Signed in (we know their email)  -> one-tap join, no form.
     • Not signed in                    -> short email field + a
                                           "have an account? sign in" link.
   Stores to localStorage['declare-ios-waitlist'] (mock backend).
   Load after declare.css + waitlist.css:
     <link rel="stylesheet" href="waitlist.css" />
     <script src="waitlist.js"></script>
   ============================================================ */
(function(){
  if(window.DeclareWaitlist) return;
  var KEY='declare-ios-waitlist';

  var ICON={
    apple:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.5 2.2 2.6 2.1 1-.04 1.4-.67 2.7-.67 1.2 0 1.6.67 2.7.65 1.1-.02 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4-.02-.01-2.1-.81-2.1-3.2zM14.3 6.3c.6-.7 1-1.7.9-2.7-.9.04-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .08 1.9-.5 2.5-1.2z"/></svg>',
    mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="M3 7l9 6 9-6"/></svg>',
    bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
  };

  function read(){ try{ return JSON.parse(localStorage.getItem(KEY)||'null'); }catch(e){ return null; } }
  function hasJoined(){ return !!read(); }
  function save(email){ try{ localStorage.setItem(KEY, JSON.stringify({ email:email||'', ts:Date.now() })); }catch(e){} markRows(); }
  function reset(){ try{ localStorage.removeItem(KEY); }catch(e){} }
  function autoEmail(){ try{ return localStorage.getItem('declare-email')||''; }catch(e){ return ''; } }
  function autoSignedIn(){ try{ return !!(localStorage.getItem('declare-email')||localStorage.getItem('declare-firstname')||localStorage.getItem('declare-haspw')); }catch(e){ return false; } }
  function validEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||''); }

  var scrim, sheet, state;
  function mount(){
    scrim=document.createElement('div'); scrim.className='dw-scrim';
    scrim.innerHTML='<div class="dw-bd" data-close></div>'+
      '<div class="dw-sheet" role="dialog" aria-modal="true" aria-label="Declare for iPhone">'+
        '<div class="dw-grab"></div>'+
        '<button class="dw-close" data-close aria-label="Close">'+ICON.x+'</button>'+
        '<div class="dw-body" id="dwBody"></div>'+
      '</div>';
    document.body.appendChild(scrim);
    sheet=scrim.querySelector('.dw-sheet');
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
    function start(e){ if(sheet.scrollTop>2) return; if(e.target.closest('a,button,input')&&!e.target.closest('.dw-grab')) return;
      dragging=true; sy=(e.touches?e.touches[0].clientY:e.clientY); dy=0; sheet.style.transition='none'; }
    function move(e){ if(!dragging) return; var y=(e.touches?e.touches[0].clientY:e.clientY); dy=y-sy; if(dy<0) dy*=.3; sheet.style.transform='translateY('+dy+'px)'; if(dy>4&&e.cancelable) e.preventDefault(); }
    function end(){ if(!dragging) return; dragging=false; sheet.style.transition=''; if(dy>120) close(); else sheet.style.transform=''; dy=0; }
    sheet.addEventListener('mousedown',start); sheet.addEventListener('touchstart',start,{passive:true});
    window.addEventListener('mousemove',move); window.addEventListener('touchmove',move,{passive:false});
    window.addEventListener('mouseup',end); window.addEventListener('touchend',end);
  }
  function body(){ return document.getElementById('dwBody'); }

  function open(opts){
    opts=opts||{};
    state={ source:opts.source||'unknown',
            signedIn: opts.signedIn!=null ? opts.signedIn : autoSignedIn(),
            email: opts.email || autoEmail() };
    if(!scrim) mount();
    if(hasJoined()){ var r=read(); stepDone(r&&r.email); return; }
    stepInvite();
  }

  function header(){
    return '<div class="dw-tile">'+ICON.apple+'</div>'+
      '<div class="dw-eyebrow">Coming soon</div>'+
      '<h3 class="dw-h">Declare for iPhone</h3>'+
      '<p class="dw-sub">A native app is on the way \u2014 the daily Word, your journeys, and reminders, right on your home screen. Be the first to know when it lands.</p>';
  }

  function stepInvite(){
    var b=body(); b.innerHTML='';
    var w=document.createElement('div'); w.className='dw-step';
    if(state.signedIn && validEmail(state.email)){
      // ---- one-tap join: we already know them ----
      w.innerHTML=header()+
        '<div class="dw-at"><span class="ai">'+ICON.mail+'</span><span class="am"><span class="al">We\u2019ll let you know at</span><span class="ae">'+esc(state.email)+'</span></span></div>'+
        '<div class="dw-actions"><button class="dw-btn primary" id="dwJoin">'+ICON.bell+'Join the waitlist</button></div>'+
        '<button class="dw-altlink" id="dwAlt">Use a different email</button>';
      b.appendChild(w);
      document.getElementById('dwJoin').onclick=function(){ save(state.email); stepDone(state.email); };
      document.getElementById('dwAlt').onclick=function(){ state.signedIn=false; stepInvite(); var i=document.getElementById('dwEmail'); if(i){ i.value=state.email; i.focus(); } };
    } else {
      // ---- email capture: not signed in ----
      w.innerHTML=header()+
        '<input class="dw-input" id="dwEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" value="'+esc(state.email||'')+'" />'+
        '<div class="dw-actions"><button class="dw-btn primary" id="dwJoin">'+ICON.bell+'Notify me when it\u2019s ready</button></div>'+
        '<button class="dw-altlink" id="dwSignin">Have an account? Sign in to join faster</button>'+
        '<div class="dw-fine">We\u2019ll only email you about the iOS launch.</div>';
      b.appendChild(w);
      var inp=document.getElementById('dwEmail');
      document.getElementById('dwJoin').onclick=function(){
        var v=(inp.value||'').trim();
        if(!validEmail(v)){ inp.style.borderColor='var(--danger,#c4503a)'; inp.focus(); return; }
        save(v); stepDone(v);
      };
      document.getElementById('dwSignin').onclick=function(){ location.href='Signin.html'; };
      setTimeout(function(){ try{ inp.focus(); }catch(e){} }, 140);
    }
  }

  function stepDone(email){
    var b=body(); b.innerHTML='';
    var w=document.createElement('div'); w.className='dw-step dw-done';
    w.innerHTML='<div class="dw-mark">'+ICON.check+'</div>'+
      '<h3 class="dw-h">You\u2019re on the list</h3>'+
      '<p class="dw-sub">'+(email?('We\u2019ll email <b>'+esc(email)+'</b> the moment Declare for iPhone is live.'):'We\u2019ll let you know the moment Declare for iPhone is live.')+'</p>'+
      '<div class="dw-actions"><button class="dw-btn primary" data-close type="button">Amen</button></div>';
    b.appendChild(w);
    w.querySelector('[data-close]').addEventListener('click', close);
  }

  function esc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // any [data-dw-row] reflects joined state (badge -> "On the list")
  function markRows(){
    if(!hasJoined()) return;
    [].forEach.call(document.querySelectorAll('[data-dw-row] .badge'), function(b){ b.textContent='On the list'; });
  }
  if(document.readyState!=='loading') markRows(); else document.addEventListener('DOMContentLoaded', markRows);

  window.DeclareWaitlist={ open:open, hasJoined:hasJoined, reset:reset };
})();
