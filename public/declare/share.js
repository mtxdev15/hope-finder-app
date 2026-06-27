/* ============================================================
   Declare — DeclareShare
   Reusable, brand-cinematic Share + Embed sheet.

     DeclareShare.open({
       type:'church'|'verse'|'reading'|'page',
       id, title, subtitle,
       monogram,          // crest letters (church). omit -> Declare mark
       gradient,          // crest bg. omit -> default
       url,               // canonical link (defaults to current page)
       flag,              // embed preview tag (e.g. 'PREVIEW')
       meta,              // small line under embed name
       embed:true         // show Embed option (default true)
     })

   Mounts once into the nearest .app phone frame (else <body>).
   Adapts every label/preview/snippet to `type`.
   ============================================================ */
(function(){
  var CROSS = '<svg class="dc-cross" viewBox="0 0 120 220" fill="none" stroke="#FFF7E6" stroke-linecap="round"><path d="M60 12V208" stroke-width="3"/><path d="M28 72H92" stroke-width="3"/></svg>';
  var GRAD_FALLBACK = 'linear-gradient(155deg,#2c4b3b,#13251c)';

  var ICON = {
    copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.4"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="M3 7l9 6 9-6"/></svg>',
    sms:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>',
    whatsapp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.6-3-1.3-5-4.4-5.1-4.6-.2-.2-1.3-1.7-1.3-3.2s.8-2.3 1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l.8-1c.2-.2.4-.2.6-.1l2 1c.3.1.5.2.5.4.1.2.1.9-.2 1.6z"/></svg>',
    messenger:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.3 2 2 6.2 2 11.7c0 3.1 1.4 5.8 3.6 7.6V23l3.3-1.8c.9.2 1.8.4 2.8.4 5.7 0 10-4.2 10-9.7S17.7 2 12 2zm1 13.1l-2.6-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.3 5.7z"/></svg>',
    facebook:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>',
    twitter:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2H21l-6.4 7.3L22 22h-6.8l-4.7-6.2L4.9 22H2l7-7.9L2 2h6.9l4.3 5.7L18.2 2zm-2.4 18h1.5L8.3 3.6H6.7L15.8 20z"/></svg>',
    embed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 5l-2 14"/></svg>',
    more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
  };

  function esc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function slug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

  /* per-type copy */
  function noun(t){ return t==='church'?'church':t==='verse'?'verse':t==='reading'?'reading':'page'; }
  function shareTitle(t){ return t==='church'?'Share this church':t==='verse'?'Share this verse':t==='reading'?'Share this reading':'Share'; }
  function shareSub(t){ return t==='church'?'Invite someone to come and see':t==='verse'?'Pass along a word of life':t==='reading'?'Share today\u2019s reading':'Send this to a friend'; }
  function shareText(p){
    if(p.text) return p.text;            // caller-supplied full message (already branded; no append)
    if(p.type==='church') return 'Come worship with me at '+p.title+' \u2014 on Declare.';
    if(p.type==='verse')  return '\u201C'+p.title+'\u201D \u2014 shared from Declare.';
    if(p.type==='reading')return p.title+' \u2014 today\u2019s reading on Declare.';
    return p.title+' \u2014 on Declare.';
  }
  function embedToggles(t){
    if(t==='church') return [['times','Hide service times'],['nofollow','Create \u201Cno follow\u201D links']];
    if(t==='verse')  return [['ref','Reference only (hide text)'],['nofollow','Create \u201Cno follow\u201D links']];
    return [['compact','Compact card'],['nofollow','Create \u201Cno follow\u201D links']];
  }

  var root, scrim, state={};

  function ensure(){
    if(scrim) return;
    root = document.querySelector('.app') || document.body;
    scrim = document.createElement('div');
    scrim.className = 'dsh-scrim' + (root===document.body?' fixed':'');
    scrim.innerHTML =
      '<div class="dsh-bd" data-close></div>'+
      '<div class="dsh-sheet" role="dialog" aria-modal="true">'+
        '<div class="dsh-grab"></div>'+
        '<button class="dsh-close" data-close aria-label="Close">'+ICON.x+'</button>'+
        '<div class="dsh-track" id="dshTrack">'+
          '<div class="dsh-panel" id="dshShare"></div>'+
          '<div class="dsh-panel" id="dshEmbed"></div>'+
        '</div>'+
      '</div>'+
      '<div class="dsh-toast" id="dshToast"></div>';
    root.appendChild(scrim);
    scrim.addEventListener('click', function(e){ if(e.target.closest('[data-close]')) close(); });
    enableDrag();
  }

  /* pull-down-to-dismiss from the top of the sheet */
  function enableDrag(){
    var sheet=scrim.querySelector('.dsh-sheet');
    var dragging=false, sy=0, dy=0, active=null;
    function start(e){
      var track=document.getElementById('dshTrack');
      active = track.classList.contains('embed') ? document.getElementById('dshEmbed') : document.getElementById('dshShare');
      if(active && active.scrollTop>2) return;          // let the panel scroll instead
      if(e.target.closest('a,button,input,textarea,.dsh-code')) { /* still allow drag from grab */ if(!e.target.closest('.dsh-grab')) return; }
      dragging=true; sy=(e.touches?e.touches[0].clientY:e.clientY); dy=0; sheet.style.transition='none';
    }
    function move(e){
      if(!dragging) return;
      var y=(e.touches?e.touches[0].clientY:e.clientY); dy=y-sy;
      if(dy<0) dy=dy*0.3;                                // resist upward
      sheet.style.transform='translateY('+dy+'px)';
      if(dy>4 && e.cancelable) e.preventDefault();
    }
    function end(){
      if(!dragging) return; dragging=false; sheet.style.transition='';
      if(dy>120){ close(); } else { sheet.style.transform=''; }
      dy=0;
    }
    sheet.addEventListener('mousedown', start); sheet.addEventListener('touchstart', start, {passive:true});
    window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, {passive:false});
    window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
  }

  function crestHTML(p, big){
    var g = p.gradient || GRAD_FALLBACK;
    var inner = p.monogram
      ? '<span class="dc-rays"></span>'+CROSS+'<span class="dc-mono">'+esc(p.monogram)+'</span>'
      : '<span class="dc-rays"></span>'+CROSS;
    return '<div class="'+(big?'dsh-ep-crest':'dsh-crest')+'" style="background:'+g+'">'+inner+'</div>';
  }

  function renderShare(p){
    var sh=document.getElementById('dshShare');
    var opts=[
      {k:'copy',  l:'Copy link'},
      {k:'mail',  l:'Email'},
      {k:'sms',   l:'Messages'},
      {k:'whatsapp', l:'WhatsApp'},
      {k:'messenger', l:'Messenger'},
      {k:'facebook', l:'Facebook'},
      {k:'twitter', l:'X'}
    ];
    if(p.embed!==false) opts.push({k:'embed', l:'Embed'});
    var url=p.url, txt=shareText(p);
    function chHref(k){
      if(k==='mail') return 'mailto:?subject='+encodeURIComponent(p.title)+'&body='+encodeURIComponent(txt+'\n\n'+url);
      if(k==='sms') return 'sms:&body='+encodeURIComponent(txt+' '+url);
      if(k==='whatsapp') return 'https://wa.me/?text='+encodeURIComponent(txt+' '+url);
      if(k==='messenger') return 'https://www.facebook.com/dialog/send?link='+encodeURIComponent(url)+'&redirect_uri='+encodeURIComponent(url);
      if(k==='facebook') return 'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);
      if(k==='twitter') return 'https://twitter.com/intent/tweet?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(txt);
      return '';
    }
    var grid = opts.map(function(o,i){
      var st=' style="animation-delay:'+(60+i*42)+'ms"';
      var ic='<span class="oi">'+ICON[o.k]+'</span><span class="ol">'+o.l+'</span>';
      if(o.k==='copy'||o.k==='embed') return '<button class="dsh-opt" data-ch="'+o.k+'"'+st+'>'+ic+'</button>';
      // real links so the OS hands off to the native app (default mail client, etc.)
      var ext=(o.k==='mail'||o.k==='sms')?'':' target="_blank" rel="noopener"';
      return '<a class="dsh-opt" data-link="'+o.k+'" href="'+chHref(o.k)+'"'+ext+st+'>'+ic+'</a>';
    }).join('');
    grid += '<button class="dsh-opt full" data-ch="more" style="animation-delay:'+(60+opts.length*42)+'ms"><span class="oi">'+ICON.more+'</span><span class="ol">More options</span></button>';

    sh.innerHTML =
      '<h3 class="dsh-h">'+esc(shareTitle(p.type))+'</h3>'+
      '<p class="dsh-sub">'+esc(shareSub(p.type))+'</p>'+
      '<div class="dsh-preview">'+crestHTML(p,false)+
        '<div class="dsh-pv-txt"><div class="dsh-pv-t">'+esc(p.title)+'</div>'+(p.subtitle?'<div class="dsh-pv-s">'+esc(p.subtitle)+'</div>':'')+'</div></div>'+
      '<div class="dsh-grid">'+grid+'</div>';

    sh.querySelectorAll('[data-ch]').forEach(function(b){ b.addEventListener('click', function(e){ channel(b.getAttribute('data-ch'), p, e); }); });
    sh.querySelectorAll('[data-link]').forEach(function(a){ a.addEventListener('click', function(){ var k=a.getAttribute('data-link'); toast('Opening '+(k==='twitter'?'X':k==='sms'?'Messages':k==='mail'?'Email':k.charAt(0).toUpperCase()+k.slice(1))+'\u2026'); }); });
  }

  function buildEmbedCode(p){
    var attrs=' data-id="'+esc(p.id)+'" data-type="'+esc(p.type)+'"';
    if(state.tg.times || state.tg.ref || state.tg.compact) attrs+=' data-compact="true"';
    var rel = state.tg.nofollow ? ' rel="nofollow noopener"' : ' rel="noopener"';
    return '<div class="declare-embed"'+attrs+' style="width:340px;height:auto;margin:auto"></div>\n'+
      '<a href="'+esc(p.url)+'"'+rel+'>View on Declare</a>\n'+
      '<script async src="https://declareandbelieve.com/embed.js"><\/script>';
  }
  function renderEmbed(p){
    var em=document.getElementById('dshEmbed');
    state.tg = state.tg || {};
    var toggles = embedToggles(p.type).map(function(t){
      return '<button class="dsh-toggle'+(state.tg[t[0]]?' on':'')+'" data-tg="'+t[0]+'"><span class="dsh-box">'+ICON.check+'</span><span class="tt">'+t[1]+'</span></button>';
    }).join('');
    var hideMeta = (p.type==='church' && state.tg.times);
    em.innerHTML =
      '<button class="dsh-back" data-back>'+ICON.back+' Back to share</button>'+
      '<h3 class="dsh-h" style="margin-top:4px">Embed this '+esc(noun(p.type))+'</h3>'+
      '<div class="dsh-lbl">Customize your code</div>'+ toggles +
      '<div class="dsh-embedprev">'+crestHTML(p,true).replace('dsh-crest','dsh-ep-crest')+
        ((p.flag)?'<span class="dsh-ep-flag">'+esc(p.flag)+'</span>':'<span class="dsh-ep-flag">Preview</span>')+
        '<div class="dsh-ep-body"><div class="dsh-ep-name">'+esc(p.title)+'</div>'+
          (hideMeta?'':'<div class="dsh-ep-meta">'+esc(p.subtitle||p.meta||'')+'</div>')+'</div>'+
        '<div class="dsh-ep-foot"><span class="vl">View on Declare</span><span class="dot"></span></div></div>'+
      '<div class="dsh-lbl">Paste this into your site</div>'+
      '<div class="dsh-code"><code id="dshCode"></code></div>'+
      '<button class="dsh-copy" data-copyhtml>'+ICON.copy+' Copy HTML</button>';
    document.getElementById('dshCode').textContent = buildEmbedCode(p);
    em.querySelector('[data-back]').addEventListener('click', function(){ document.getElementById('dshTrack').classList.remove('embed'); });
    em.querySelectorAll('[data-tg]').forEach(function(b){ b.addEventListener('click', function(){ var k=b.getAttribute('data-tg'); state.tg[k]=!state.tg[k]; renderEmbed(p); }); });
    em.querySelector('[data-copyhtml]').addEventListener('click', function(){ copyText(buildEmbedCode(p), 'Embed code copied'); });
  }

  function channel(k, p, e){
    var url=p.url, txt=shareText(p);
    if(k==='copy'){ copyText(url, 'Link copied'); return; }
    if(k==='embed'){ renderEmbed(p); document.getElementById('dshTrack').classList.add('embed'); document.getElementById('dshEmbed').scrollTop=0; return; }
    if(k==='more'){
      // hand to the device's native share sheet when available
      if(navigator.share){ navigator.share({title:p.title, text:txt, url:url}).catch(function(){}); }
      else { copyText(url, 'Link copied — paste it anywhere'); }
      return;
    }
  }

  function copyText(t, msg){
    var done=function(){ toast(msg||'Copied'); };
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(done, fallback); }
      else fallback();
    }catch(e){ fallback(); }
    function fallback(){
      try{ var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; root.appendChild(ta); ta.select(); document.execCommand('copy'); root.removeChild(ta); }catch(e){}
      done();
    }
  }

  var tT;
  function toast(msg){
    var t=document.getElementById('dshToast');
    t.innerHTML='<span class="tk">'+ICON.check+'</span>'+esc(msg);
    t.classList.add('show'); clearTimeout(tT); tT=setTimeout(function(){ t.classList.remove('show'); }, 2200);
  }

  function open(payload){
    var p = Object.assign({ type:'page', url:(location.href), embed:true }, payload||{});
    p.id = p.id || slug(p.title);
    // content types compose a shareable card in the Studio
    if(window.DeclareStudio && (p.type==='verse' || p.type==='reading' || p.type==='declaration' || p.type==='journey')){
      window.DeclareStudio.open(p); return;
    }
    ensure();
    state = { tg:{} };
    document.getElementById('dshTrack').classList.remove('embed');
    renderShare(p); renderEmbed(p);
    scrim.classList.add('open');
    void scrim.offsetWidth; scrim.classList.add('dsh-on');
    document.addEventListener('keydown', onKey);
  }
  function close(){
    if(!scrim) return;
    var sheet=scrim.querySelector('.dsh-sheet'); if(sheet) sheet.style.transform='';
    scrim.classList.remove('dsh-on');
    document.removeEventListener('keydown', onKey);
    setTimeout(function(){ scrim.classList.remove('open'); }, 440);
  }
  function onKey(e){ if(e.key==='Escape') close(); }

  window.DeclareShare = { open:open, close:close };
})();
