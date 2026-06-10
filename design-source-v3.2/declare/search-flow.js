/* ============================================================
   Declare — Find a Church · Airbnb-style flow controller
   Talks ONLY to window.ChurchAPI (see church-api.js) so the
   UI is provider-agnostic: mock today, Google Places when a
   key is configured. No events (out of scope by design).
   Requires: church-shared.js, church-api.js, Leaflet, search.css
   ============================================================ */
(function(){
  var U = window.ChurchUtils, API = window.ChurchAPI;
  var esc = U.esc;

  /* ---------- assets ---------- */
  var PALETTE = [
    'linear-gradient(155deg,#2c4b3b,#13251c)','linear-gradient(155deg,#3b3421,#1a160c)',
    'linear-gradient(155deg,#2a404b,#121e24)','linear-gradient(155deg,#44302a,#1f1512)',
    'linear-gradient(155deg,#352a45,#171221)','linear-gradient(155deg,#2f4636,#14211a)',
    'linear-gradient(155deg,#3d3a4d,#15151f)'
  ];
  var CROSS = '<svg class="cr-cross" viewBox="0 0 120 220" fill="none" stroke="#FFF7E6" stroke-linecap="round"><path d="M60 12V208" stroke-width="2.8"/><path d="M28 72H92" stroke-width="2.8"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24"><path class="fillpath strokepath" d="M12 20.5S3.5 15.2 3.5 9.2C3.5 6.3 5.7 4.5 8 4.5c1.7 0 3.1 1 4 2.3.9-1.3 2.3-2.3 4-2.3 2.3 0 4.5 1.8 4.5 4.7 0 6-8.5 11.3-8.5 11.3z" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
  var PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var LIVEDOT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>';

  function hash(s){ var h=0; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return Math.abs(h); }
  function grad(c){ return PALETTE[hash(c.id)%PALETTE.length]; }
  function byId(id){ return API.get(id); }

  /* ---------- state ---------- */
  var S = { cat:'near', where:'nearby', when:'Any time', lang:'Any' };
  var PLACES = window.DECLARE_PLACES;
  var wish = (function(){ try{ return new Set(JSON.parse(localStorage.getItem('declare-wishlist')||'[]')); }catch(e){ return new Set(); } })();
  function saveWish(){ try{ localStorage.setItem('declare-wishlist', JSON.stringify(Array.from(wish))); }catch(e){} }

  /* ---------- helpers tolerant of partial (live) data ---------- */
  function serviceLine(c){
    var s=U.serviceSummary(c);
    if(s) return s;
    if(c.site) return 'Service times on their site';
    return 'Tap to view details';
  }
  function metaLine(c, withMembers){
    var bits=[];
    if(c.lang) bits.push(esc(c.lang));
    if(c.style) bits.push('<b>'+esc(c.style)+'</b>');
    if(withMembers && c.members) bits.push(c.members.toLocaleString()+' members');
    return bits.join(' &middot; ');
  }
  function distStr(c){ if(c._mi>=999) return ''; return U.fmtDist(c._mi); }

  /* ---------- card builders ---------- */
  function heart(c){ return '<button class="heart'+(wish.has(c.id)?' on':'')+'" data-heart="'+c.id+'" aria-label="Save church">'+HEART+'</button>'; }
  function crest(c){
    var mine = U.getMine()===c.id;
    var badge = mine ? '<span class="cr-badge home">Home church</span>' : (c.tag?'<span class="cr-badge">'+esc(c.tag)+'</span>':'');
    return '<div class="crest" style="background:'+grad(c)+'">'+
      '<span class="cr-atmo"></span><span class="cr-rays"></span><span class="cr-halo"></span>'+CROSS+
      '<span class="cr-vig"></span><span class="cr-grain"></span>'+
      '<span class="cr-mono">'+esc(c.mono)+'</span>'+(c.city?'<span class="cr-city">'+esc(c.city)+'</span>':'')+badge+heart(c)+'</div>';
  }
  function railCard(c){
    var meta=metaLine(c,false);
    return '<div class="lcard stag" role="button" tabindex="0" data-open="'+c.id+'">'+crest(c)+
      '<div class="lc-body"><div class="lc-top"><span class="lc-name">'+esc(c.name)+'</span><span class="lc-dist">'+distStr(c)+'</span></div>'+
      '<div class="lc-svc">'+esc(serviceLine(c))+'</div>'+
      (meta?'<div class="lc-meta">'+meta+'</div>':'')+'</div></div>';
  }
  function wideCard(c, i){
    var meta=metaLine(c,true);
    return '<div class="lcard wide stag" role="button" tabindex="0" style="animation-delay:'+(i*55)+'ms" data-open="'+c.id+'">'+crest(c)+
      '<div class="lc-body"><div class="lc-top"><span class="lc-name">'+esc(c.name)+'</span><span class="lc-dist">'+distStr(c)+'</span></div>'+
      '<div class="lc-svc">'+esc(serviceLine(c))+'</div>'+
      (meta?'<div class="lc-meta">'+meta+'</div>':'')+'</div></div>';
  }

  /* ---------- EXPLORE ---------- */
  function renderCats(){ var el=document.getElementById('cats'); if(el) el.style.display='none'; }
  function row(title, list){
    if(!list.length) return '';
    return '<div class="row"><div class="row-head"><div class="rh-t">'+esc(title)+'<span class="chev">'+CHEV+'</span></div></div>'+
      '<div class="rail">'+list.slice(0,8).map(railCard).join('')+'</div></div>';
  }
  function exploreSkeleton(){
    var rail='<div class="rail">'+Array(3).join('x').split('x').map(function(){return '<div class="lcard"><div class="skel img" style="aspect-ratio:1/1;width:100%"></div><div class="skel l1" style="margin-top:11px"></div><div class="skel l2" style="margin-top:7px"></div></div>';}).join('')+'</div>';
    document.getElementById('exRows').innerHTML =
      '<div class="row"><div class="row-head"><div class="rh-t">Churches near you</div></div>'+rail+'</div>'+
      '<div class="row"><div class="row-head"><div class="rh-t">Worship in Espa\u00f1ol</div></div>'+rail+'</div>';
  }
  var exploreCache=null;
  function renderExplore(force){
    if(exploreCache && !force){ paintExplore(exploreCache); return; }
    exploreSkeleton();
    API.search({ lat:API._places.nearby.lat, lng:API._places.nearby.lng, maxMi:80 })
      .then(function(list){ exploreCache=list; paintExplore(list); })
      .catch(function(){ document.getElementById('exRows').innerHTML='<div style="padding:30px 20px;text-align:center;color:var(--muted);font-size:13.5px">Couldn\u2019t load churches. Pull to retry.</div>'; });
  }
  function paintExplore(list){
    var near = list.slice().sort(function(a,b){return a._mi-b._mi;});
    var es = list.filter(function(c){return c.lang==='Spanish';});
    document.getElementById('exRows').innerHTML = row('Churches near you', near) + row('Worship in Espa\u00f1ol', es);
  }

  /* ---------- SEARCH SHEET ---------- */
  var activeSec='where';
  function summaryLine(){
    var w = S.where==='nearby'?'Nearby':S.where;
    var bits=[w]; if(S.when!=='Any time') bits.push(S.when); if(S.lang!=='Any') bits.push(S.lang==='Spanish'?'Espa\u00f1ol':S.lang);
    return bits.join(' \u00b7 ');
  }
  function whereLabel(){ return S.where==='nearby'?'Nearby':S.where; }
  function sugIcon(kind){
    if(kind==='near') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
    if(kind==='online') return LIVEDOT;
    return PIN;
  }
  function renderSheet(){
    var sc=document.getElementById('ssScroll');
    var sugs = PLACES.map(function(p){
      return '<button class="sug'+(S.where===p.id?' sel':'')+'" data-where="'+p.id+'"><span class="su-ic">'+sugIcon(p.icon)+'</span>'+
        '<span class="su-l"><span class="su-t">'+esc(p.label)+'</span><span class="su-s">'+esc(p.sub)+'</span></span>'+
        '<span class="su-ck">'+CHECK+'</span></button>';
    }).join('');
    var whereCard='<div class="ss-card'+(activeSec==='where'?' active':' collapsed')+'" data-sec="where">'+
      '<div class="ss-collapsed-row"><span class="sc-k">Where</span><span class="sc-v">'+esc(whereLabel())+'</span></div>'+
      '<div class="ss-open"><div class="so-title">Where to gather?</div>'+
        '<div class="where-input"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>'+
          '<input id="whereInput" placeholder="Search city or zip code" /></div>'+
        '<div class="sugs" id="sugs">'+sugs+'</div></div></div>';

    var days=['Any time','Sunday morning','Sunday evening','Midweek'];
    var whenCard='<div class="ss-card'+(activeSec==='when'?' active':' collapsed')+'" data-sec="when">'+
      '<div class="ss-collapsed-row"><span class="sc-k">Service time</span><span class="sc-v">'+esc(S.when)+'</span></div>'+
      '<div class="ss-open"><div class="so-title">When can you go?</div>'+
        '<div class="chiprow">'+days.map(function(d){return '<button class="dchip'+(S.when===d?' on':'')+'" data-when="'+esc(d)+'">'+d+'</button>';}).join('')+'</div></div></div>';

    var langs=[['Any','Any'],['English','English'],['Spanish','Espa\u00f1ol']];
    var whoCard='<div class="ss-card'+(activeSec==='who'?' active':' collapsed')+'" data-sec="who">'+
      '<div class="ss-collapsed-row"><span class="sc-k">Language</span><span class="sc-v">'+esc(whoSummary())+'</span></div>'+
      '<div class="ss-open"><div class="so-title">What language?</div>'+
        '<div class="langseg">'+langs.map(function(l){return '<button class="'+(S.lang===l[0]?'on':'')+'" data-lang="'+l[0]+'">'+l[1]+'</button>';}).join('')+'</div>'+
      '</div></div>';

    sc.innerHTML = whereCard + whenCard + whoCard;
    if(activeSec==='where'){ var wi=document.getElementById('whereInput'); if(wi) setTimeout(function(){try{wi.focus();}catch(e){}},150); }
  }
  function whoSummary(){
    return S.lang!=='Any' ? (S.lang==='Spanish'?'Espa\u00f1ol':S.lang) : 'Any language';
  }
  function togRow(key,t,d){
    return '<div class="togrow"><div class="tg-l"><div class="tg-t">'+t+'</div><div class="tg-d">'+d+'</div></div>'+
      '<button class="tgl'+(S[key]?' on':'')+'" data-tog="'+key+'" aria-label="'+t+'"></button></div>';
  }
  function openSearch(){ renderSheet(); scr('scrSearch','in'); }
  function closeSearch(){ scr('scrSearch','out'); }

  /* ---------- RESULTS (async, real fetch path) ---------- */
  function runSearch(){
    closeSearch(); openResults(); showSkeleton();
    var where=S.where;
    var named = (where!=='nearby');
    var geoP = named ? API.geocode(where) : Promise.resolve(API._places.nearby);
    geoP.then(function(o){
      curOrigin=o;
      return API.search({
        lat:o&&o.lat, lng:o&&o.lng,
        query: '',
        lang: S.lang,
        when: S.when,
        maxMi: named?70:80
      });
    }).then(function(list){
      renderResults(list);
    }).catch(function(err){
      showError((navigator.onLine===false)?'offline':'500');
    });
  }
  function showSkeleton(){
    hideState('emptyState'); hideState('errorState');
    var html=''; for(var i=0;i<4;i++){ html+='<div class="skel-card"><div class="skel img"></div><div class="skel l1"></div><div class="skel l2"></div><div class="skel l3"></div></div>'; }
    document.getElementById('rsList').innerHTML=html;
    document.getElementById('rsCount').textContent='Searching\u2026';
    document.getElementById('fab').style.display='none';
  }
  function renderResults(list, titleMain, titleSub){
    document.getElementById('rsSummaryMain').textContent = titleMain || summaryLine();
    document.getElementById('rsSummarySub').textContent = titleSub || (list.length+' '+(list.length===1?'church':'churches'));
    if(!list.length){ document.getElementById('rsList').innerHTML=''; document.getElementById('rsCount').textContent=''; document.getElementById('fab').style.display='none'; showState('emptyState'); lastList=[]; return; }
    hideState('emptyState');
    document.getElementById('rsCount').textContent = list.length+' '+(list.length===1?'church':'churches')+' found';
    document.getElementById('rsList').innerHTML = list.map(wideCard).join('');
    document.getElementById('fab').style.display='flex';
    lastList=list;
    // Desktop two-pane: build the persistent map automatically (no FAB tap).
    if(window.matchMedia('(min-width:1060px)').matches){
      try{ buildMap(); }catch(e){}
      setTimeout(function(){ try{ window.dispatchEvent(new Event('resize')); }catch(e){} }, 480);
    }
  }
  var lastList=[], curOrigin=null, curDetailId=null;

  function shareCurrent(){
    var c=byId(curDetailId); if(!c || !window.DeclareShare) return;
    var sub=[c.city, U.serviceSummary(c)].filter(Boolean).join(' \u00b7 ');
    DeclareShare.open({
      type:'church', id:c.id, title:c.name, subtitle:sub,
      monogram:c.mono, gradient:grad(c),
      meta:(c.lang?c.lang:'')+(c.style?' \u00b7 '+c.style:''),
      url:'https://declareandbelieve.com/church/'+c.id
    });
  }

  function openResults(){ document.getElementById('scrExplore').classList.add('behind'); scr('scrResults','in'); }
  function closeResults(){ scr('scrResults','out'); document.getElementById('scrExplore').classList.remove('behind'); mapMode(false); }

  /* ---------- MAP ---------- */
  var rmap=null, rmarkers={}, mapReady=false;
  function ensureMap(){
    if(mapReady) return;
    var dark=document.documentElement.getAttribute('data-theme')!=='light';
    var c=curOrigin||API._places.nearby;
    rmap=L.map('rmap',{zoomControl:false,attributionControl:true}).setView([c.lat,c.lng],10);
    L.tileLayer(dark?'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png':'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {subdomains:'abcd',maxZoom:19,attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(rmap);
    mapReady=true;
  }
  function markerIcon(c,active){
    var mine=U.getMine()===c.id, cls='cmark'+(active?' is-active':'')+(mine?' is-mine':'');
    return L.divIcon({className:'',html:'<div class="'+cls+'"><span class="pinbody"></span><span class="pinlabel">'+esc(c.mono)+'</span></div>',iconSize:[34,34],iconAnchor:[17,31]});
  }
  function buildMap(){
    ensureMap();
    Object.keys(rmarkers).forEach(function(k){ rmap.removeLayer(rmarkers[k]); }); rmarkers={};
    var list=lastList.filter(function(c){ return c.lat!=null && c._mi<999; });
    var pts=[];
    list.forEach(function(c){
      var m=L.marker([c.lat,c.lng],{icon:markerIcon(c,false)}).addTo(rmap);
      m.on('click',function(){ selectMap(c.id); });
      rmarkers[c.id]=m; pts.push([c.lat,c.lng]);
    });
    if(pts.length){ try{ rmap.fitBounds(pts,{padding:[60,60],maxZoom:12}); }catch(e){} }
    document.getElementById('mapCarousel').innerHTML = list.map(function(c){
      return '<div class="mc-card" data-mcid="'+c.id+'"><div class="mc-crest" style="background:'+grad(c)+'"><span class="cr-mono">'+esc(c.mono)+'</span></div>'+
        '<div class="mc-mid"><div class="mc-name">'+esc(c.name)+'</div><div class="mc-svc">'+esc(serviceLine(c))+'</div><div class="mc-dist">'+distStr(c)+'</div></div></div>';
    }).join('');
    setTimeout(function(){ rmap.invalidateSize(); },200);
  }
  var activeMap=null;
  function selectMap(id){
    if(activeMap&&rmarkers[activeMap]) rmarkers[activeMap].setIcon(markerIcon(byId(activeMap),false));
    activeMap=id; if(rmarkers[id]) rmarkers[id].setIcon(markerIcon(byId(id),true));
    var c=byId(id); rmap.panTo([c.lat,c.lng],{animate:true});
    var card=document.querySelector('.mc-card[data-mcid="'+id+'"]'); if(card) card.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
  }
  function mapMode(on){
    var mp=document.getElementById('rsMap'), fab=document.getElementById('fab');
    if(on){ buildMap(); mp.classList.add('show'); fab.innerHTML=LIST_IC+'List'; }
    else { mp.classList.remove('show'); fab.innerHTML=MAP_IC+'Map'; }
  }
  var MAP_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>';
  var LIST_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>';

  /* ---------- DETAIL ---------- */
  function openDetail(id){
    var c=byId(id); if(!c) return;
    curDetailId=id;
    var mine=U.getMine()===id;
    document.getElementById('dScroll').innerHTML = U.detailHTML(c, mine);
    document.getElementById('dScroll').scrollTop=0;
    wireWatch();
    renderReserveBar(id);
    scr('scrDetail','in');
    // pull enrichment (live: service times / online); harmless in mock
    API.details(id).then(function(full){
      if(!full) return;
      if(document.getElementById('scrDetail').classList.contains('in')){
        document.getElementById('dScroll').innerHTML=U.detailHTML(full, U.getMine()===id);
        wireWatch(); renderReserveBar(id);
      }
    }).catch(function(){});
  }
  function wireWatch(){ var wl=document.getElementById('watchLive'); if(wl) wl.addEventListener('click',function(){ toast('Opening livestream\u2026'); }); }
  function closeDetail(){ scr('scrDetail','out'); }
  function renderReserveBar(id){
    var c=byId(id), mine=U.getMine()===id;
    document.getElementById('reserveBar').innerHTML =
      '<div class="rb-l"><div class="rb-t">'+esc(serviceLine(c))+'</div><div class="rb-s">'+esc(c.city||'')+'</div></div>'+
      '<button class="rb-cta'+(mine?' ismine':'')+'" id="rbCta">'+(mine?CHECK+' My Church':'Set as My Church')+'</button>';
    document.getElementById('rbCta').addEventListener('click',function(){
      if(U.getMine()===id){ U.setMine(null); renderReserveBar(id); refreshDetailInline(id); toast('Removed as your home church'); syncMineEverywhere(); }
      else openConfirm(id);
    });
  }
  function refreshDetailInline(id){
    var c=byId(id), mine=U.getMine()===id;
    document.getElementById('dScroll').innerHTML=U.detailHTML(c,mine); wireWatch();
  }

  /* ---------- CONFIRM + SUCCESS ---------- */
  function openConfirm(id){
    var c=byId(id);
    var sc=document.getElementById('confirmScrim');
    sc.innerHTML='<div class="cf-bd" data-cfclose></div><div class="cf-sheet">'+
      '<div class="cf-grab"></div>'+
      '<div class="cf-row"><div class="cf-crest" style="background:'+grad(c)+'"><span class="cr-mono">'+esc(c.mono)+'</span></div>'+
        '<div><div class="cf-n">'+esc(c.name)+'</div><div class="cf-c">'+esc(c.city||'')+(c.city?' \u00b7 ':'')+esc(serviceLine(c))+'</div></div></div>'+
      '<div class="cf-q">Make this your home church?</div>'+
      '<div class="cf-sub">We\u2019ll surface its service times, livestream and giving across Declare \u2014 and keep you connected.</div>'+
      '<button class="cf-confirm" data-cfset="'+id+'">'+CHECK+' Confirm home church</button>'+
      '<button class="cf-cancel" data-cfclose>Not now</button></div>';
    sc.classList.add('show');
  }
  function closeConfirm(){ document.getElementById('confirmScrim').classList.remove('show'); }
  function doSet(id){ closeConfirm(); U.setMine(id); syncMineEverywhere(); showSuccess(id); }
  function showSuccess(id){
    var c=byId(id);
    var sparks=''; for(var i=0;i<10;i++){ var a=(i/10)*Math.PI*2, r=60+Math.random()*26; sparks+='<span class="spark" style="--sx:'+(Math.cos(a)*r-3.5)+'px;--sy:'+(Math.sin(a)*r-3.5)+'px;animation-delay:'+(120+i*18)+'ms"></span>'; }
    var sd=document.getElementById('successScr');
    sd.innerHTML='<div class="suc-burst">'+sparks+'<div class="suc-ring"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></div></div>'+
      '<div class="suc-k">Welcome home</div>'+
      '<div class="suc-t">'+esc(c.name)+'<br>is now your church</div>'+
      '<div class="suc-d">You\u2019ll find it any time under your account, with service times and livestream a tap away.</div>'+
      '<div class="suc-btns"><button class="suc-primary" id="sucView">View church</button>'+
      '<button class="suc-ghost" id="sucDone">Back to Declare</button></div>';
    sd.classList.add('show');
    document.getElementById('sucView').addEventListener('click',function(){ sd.classList.remove('show'); refreshDetailInline(id); renderReserveBar(id); });
    document.getElementById('sucDone').addEventListener('click',function(){ sd.classList.remove('show'); closeDetail(); closeResults(); });
  }

  /* ---------- STATES ---------- */
  function showState(id){ document.getElementById(id).classList.add('show'); }
  function hideState(id){ document.getElementById(id).classList.remove('show'); }
  function showError(kind){
    document.getElementById('rsList').innerHTML=''; document.getElementById('rsCount').textContent=''; document.getElementById('fab').style.display='none';
    var e=document.getElementById('errorState');
    var cfg = kind==='offline'
      ? { ic:'<path d="M1 1l22 22M16.7 11.1A11 11 0 0 0 22 12M2 12a11 11 0 0 1 4.3-4.2M5 15a7 7 0 0 1 2-1.5M9 18a3 3 0 0 1 4 0M12 21h.01"/>', t:'You\u2019re offline', d:'We can\u2019t reach the church directory right now. Check your connection and try again.', code:'No connection' }
      : { ic:'<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>', t:'Something went wrong', d:'Our directory had trouble loading churches. It\u2019s on us \u2014 give it another try.', code:'Error 500' };
    e.innerHTML='<div class="st-emblem warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+cfg.ic+'</svg></div>'+
      '<div class="st-t">'+cfg.t+'</div><div class="st-d">'+cfg.d+'</div><div class="st-code">'+cfg.code+'</div>'+
      '<button class="st-btn" id="errRetry"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/></svg> Try again</button>'+
      '<button class="st-btn ghost" id="errBack">Back to explore</button>';
    e.classList.add('show');
    document.getElementById('errRetry').addEventListener('click',function(){ e.classList.remove('show'); runSearch(); });
    document.getElementById('errBack').addEventListener('click',function(){ e.classList.remove('show'); closeResults(); });
  }

  /* ---------- toast ---------- */
  var tT, CHECK_GOLD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  function toast(msg){ var t=document.getElementById('toast'); t.innerHTML=CHECK_GOLD+esc(msg); t.classList.add('show'); clearTimeout(tT); tT=setTimeout(function(){t.classList.remove('show');},2200); }

  function syncMineEverywhere(){ renderExplore(true); if(document.getElementById('scrResults').classList.contains('in')&&lastList.length) renderResults(lastList, document.getElementById('rsSummaryMain').textContent, document.getElementById('rsSummarySub').textContent); }

  /* ---------- router ---------- */
  function scr(id, dir){ var el=document.getElementById(id); if(dir==='in') el.classList.add('in'); else el.classList.remove('in'); }

  /* ---------- wiring ---------- */
  function wire(){
    renderCats(); renderExplore();
    try{ var fn=localStorage.getItem('declare-firstname'); if(fn){ document.getElementById('egName').textContent=fn; document.getElementById('avInit').textContent=(fn[0]||'J').toUpperCase(); } }catch(e){}

    document.getElementById('openSearch').addEventListener('click', openSearch);
    document.getElementById('cats').addEventListener('click', function(e){ var b=e.target.closest('[data-cat]'); if(!b) return; S.cat=b.getAttribute('data-cat'); renderCats(); paintExplore(exploreCache||[]); if(!exploreCache) renderExplore(); });

    document.querySelector('.app').addEventListener('click', function(e){
      var h=e.target.closest('[data-heart]'); if(h){ e.stopPropagation(); toggleWish(h.getAttribute('data-heart'), h); return; }
      var o=e.target.closest('[data-open]'); if(o){ openDetail(o.getAttribute('data-open')); return; }
      var mc=e.target.closest('[data-mcid]'); if(mc){ openDetail(mc.getAttribute('data-mcid')); return; }
      var cf=e.target.closest('[data-cfset]'); if(cf){ doSet(cf.getAttribute('data-cfset')); return; }
      if(e.target.closest('[data-cfclose]')){ closeConfirm(); return; }
    });

    document.getElementById('ssClose').addEventListener('click', closeSearch);
    document.getElementById('ssScroll').addEventListener('click', function(e){
      var card=e.target.closest('.ss-card.collapsed'); if(card){ activeSec=card.getAttribute('data-sec'); renderSheet(); return; }
      var w=e.target.closest('[data-where]'); if(w){ S.where=w.getAttribute('data-where'); activeSec='when'; renderSheet(); return; }
      var d=e.target.closest('[data-when]'); if(d){ S.when=d.getAttribute('data-when'); activeSec='who'; renderSheet(); return; }
      var l=e.target.closest('[data-lang]'); if(l){ S.lang=l.getAttribute('data-lang'); renderSheet(); return; }
      var t=e.target.closest('[data-tog]'); if(t){ var k=t.getAttribute('data-tog'); S[k]=!S[k]; renderSheet(); return; }
    });
    document.getElementById('ssScroll').addEventListener('input', function(e){ if(e.target.id==='whereInput'){ filterSugs(e.target.value.trim()); } });
    document.getElementById('ssClear').addEventListener('click', function(){ S.where='nearby'; S.when='Any time'; S.lang='Any'; activeSec='where'; renderSheet(); });
    document.getElementById('ssGo').addEventListener('click', runSearch);

    document.getElementById('rsBack').addEventListener('click', closeResults);
    document.getElementById('rsSummary').addEventListener('click', function(){ activeSec='where'; openSearch(); });
    document.getElementById('fab').addEventListener('click', function(){ mapMode(!document.getElementById('rsMap').classList.contains('show')); });
    document.getElementById('emptyReset').addEventListener('click', function(){ hideState('emptyState'); S.where='nearby'; S.when='Any time'; S.lang='Any'; runSearch(); });

    document.getElementById('dBack').addEventListener('click', closeDetail);
    document.getElementById('dShare').addEventListener('click', shareCurrent);

    document.getElementById('bnav').addEventListener('click', function(e){ var b=e.target.closest('[data-nav]'); if(!b) return;
      var n=b.getAttribute('data-nav');
      document.querySelectorAll('.bn').forEach(function(x){x.classList.toggle('on',x===b);});
      if(n==='saved'){ openSavedSearch(); } else if(n==='mine'){ var m=U.getMine(); if(m){ openResults(); var c=byId(m); renderResults(c?[c]:[], 'My church', ''); openDetail(m); } else { toast('No home church set yet'); } }
    });

    document.getElementById('demoEmpty').addEventListener('click', function(){ S.where='Jersey City'; S.lang='Spanish'; runSearch(); });
    document.getElementById('demo500').addEventListener('click', function(){ openResults(); showSkeleton(); setTimeout(function(){ showError('500'); },900); });
    document.getElementById('demoOffline').addEventListener('click', function(){ openResults(); showSkeleton(); setTimeout(function(){ showError('offline'); },700); });

    try{ var p=new URLSearchParams(location.search).get('church'); if(p){ openResults(); var c=byId(p); if(c){ renderResults([c],'Your church',''); openDetail(p); } else { API.details(p).then(function(full){ if(full){ renderResults([full],'Your church',''); openDetail(p); } }); } } }catch(e){}
  }
  function openSavedSearch(){
    if(!wish.size){ toast('Tap the heart on a church to save it'); document.querySelector('.bn[data-nav="explore"]').classList.add('on'); document.querySelector('.bn[data-nav="saved"]').classList.remove('on'); return; }
    openResults();
    var list=Array.from(wish).map(byId).filter(Boolean);
    renderResults(list, 'Saved churches', list.length+' saved');
    document.getElementById('rsCount').textContent='Your wishlist';
  }
  function filterSugs(q){
    var box=document.getElementById('sugs'); if(!box) return;
    var items=PLACES.filter(function(p){ return !q || p.label.toLowerCase().indexOf(q.toLowerCase())>-1; });
    if(!items.length){ box.innerHTML='<div style="padding:18px 4px;color:var(--muted);font-size:13.5px">Press Search to look up \u201C'+esc(q)+'\u201D.</div>'; return; }
    box.innerHTML=items.map(function(p){
      return '<button class="sug'+(S.where===p.id?' sel':'')+'" data-where="'+p.id+'"><span class="su-ic">'+sugIcon(p.icon)+'</span>'+
        '<span class="su-l"><span class="su-t">'+esc(p.label)+'</span><span class="su-s">'+esc(p.sub)+'</span></span><span class="su-ck">'+CHECK+'</span></button>';
    }).join('');
  }
  function toggleWish(id, btn){
    if(wish.has(id)) wish.delete(id); else { wish.add(id); btn.classList.add('pop'); setTimeout(function(){btn.classList.remove('pop');},450); }
    btn.classList.toggle('on', wish.has(id)); saveWish();
    toast(wish.has(id)?'Saved to your churches':'Removed from saved');
  }

  if(document.readyState!=='loading') wire(); else document.addEventListener('DOMContentLoaded', wire);
})();
