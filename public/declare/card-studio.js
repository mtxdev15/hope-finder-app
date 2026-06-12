/* ============================================================
   Declare — DeclareStudio
   Cinematic card designer. One call:
     DeclareStudio.open({ type, text, ref, url, accent })
   type: 'verse' | 'declaration' | 'reading' | 'journey'
   Renders to <canvas>, exports real PNG at platform size,
   opens native share. Backgrounds: cinematic moods (procedural),
   uploaded photo, gradient presets, solid color. 6 fonts.
   ============================================================ */
(function(){
  /* ---------- formats ---------- */
  var FORMATS = {
    post:    { w:1080, h:1080, label:'Post',     plat:'IG · FB',  bw:18, bh:18 },
    portrait:{ w:1080, h:1350, label:'Portrait', plat:'Instagram', bw:16, bh:20 },
    story:   { w:1080, h:1920, label:'Story',    plat:'Stories',  bw:13, bh:23 },
    wide:    { w:1600, h:900,  label:'Wide',     plat:'X · Web',  bw:24, bh:13.5 }
  };

  /* ---------- Unsplash library: curated themes (no key) + live search (Worker) ---------- */
  var WORKER='https://hope-finder-worker.thinktoro.workers.dev';
  var THEMES=[
    { key:'mountains', name:'Mountains', ids:['1506905925346-21bda4d32df4','1464822759023-fed622ff2c3b','1519681393784-d120267933ba','1486870591958-9b9d0d1dda99','1454496522488-7a8e488e8606','1426604966848-d7adac402bff'] },
    { key:'ocean',     name:'Ocean',     ids:['1439853949127-fa647821eba0','1507525428034-b723cf961d3e','1505142468610-359e7d316be0','1476673160081-cf065607f449','1447752875215-b2761acb3c5d'] },
    { key:'sky',       name:'Sky',       ids:['1444703686981-a3abbc4d4fe3','1419242902214-272b3f66ee7a','1517685352821-92cf88aee5a5','1494500764479-0c8f2919a3d8','1475924156734-496f6cac6ec1'] },
    { key:'forest',    name:'Forest',    ids:['1441974231531-c6227db76b6e','1470071459604-3b5ec3a7fe05','1502082553048-f009c37129b9','1505765050516-f72dcac9c60e','1500530855697-b586d89ba3ee','1441260038675-7329ab4cc264'] },
    { key:'light',     name:'Light',     ids:['1472214103451-9374bd1c798e','1518837695005-2083093ee35b','1469474968028-56623f02e42e','1495616811223-4d98c6e9c869','1507400492013-162706c8c05e'] },
    { key:'fields',    name:'Fields',    ids:['1490750967868-88aa4486c946','1465056836041-7f43ac27dcb5','1416169607655-0c2b3ce2e1cc','1490682143684-14369e18dce8','1519046904884-53103b34b206','1501785888041-af3ef285b470'] }
  ];
  var US={ theme:'mountains', q:'', results:null, attr:null, req:0, timer:null };
  function photoURL(id, full){ return 'https://images.unsplash.com/photo-'+id+(full?'?w=1200&q=80&auto=format&fit=crop':'?w=200&h=200&q=55&auto=format&fit=crop'); }

  /* ---------- fonts ---------- */
  var FONTS = [
    { key:'cormorant', label:'Cormorant', fam:"'Cormorant Garamond', serif", w:600, k:'serif', scale:1.0 },
    { key:'playfair',  label:'Playfair',  fam:"'Playfair Display', serif",  w:600, k:'serif', scale:0.92 },
    { key:'spectral',  label:'Spectral',  fam:"'Spectral', serif",          w:500, k:'serif', scale:0.94 },
    { key:'dmsans',    label:'DM Sans',   fam:"'DM Sans', sans-serif",      w:600, k:'sans',  scale:0.86 },
    { key:'caveat',    label:'Caveat',    fam:"'Caveat', cursive",          w:600, k:'hand',  scale:1.18 },
    { key:'bebas',     label:'Bebas',     fam:"'Bebas Neue', sans-serif",   w:400, k:'disp',  scale:1.12 }
  ];
  var FB = {}; FONTS.forEach(function(f){ FB[f.key]=f; });

  /* ---------- moods (procedural cinematic) ---------- */
  var MOODS = [
    { key:'dawn',   name:'Dawn',   top:'#243a4a', bot:'#0b141b', light:'rgba(255,224,180,0.55)', text:'light' },
    { key:'gold',   name:'Gold',   top:'#3a2f17', bot:'#130c05', light:'rgba(255,214,140,0.6)',  text:'light' },
    { key:'forest', name:'Forest', top:'#26402f', bot:'#0a1410', light:'rgba(206,240,196,0.42)', text:'light' },
    { key:'dusk',   name:'Dusk',   top:'#3a2a47', bot:'#120d1d', light:'rgba(255,188,212,0.45)', text:'light' },
    { key:'ember',  name:'Ember',  top:'#481f19', bot:'#150706', light:'rgba(255,168,118,0.55)', text:'light' },
    { key:'deep',   name:'Deep',   top:'#1d2b3a', bot:'#070c12', light:'rgba(150,200,255,0.42)', text:'light' },
    { key:'night',  name:'Night',  top:'#14201a', bot:'#04070a', light:'rgba(216,184,95,0.45)',  text:'light' },
    { key:'mist',   name:'Mist',   top:'#ece5d6', bot:'#cabda6', light:'rgba(255,255,255,0.65)', text:'dark' }
  ];
  var GRADS = [
    ['#2c4b3b','#13251c'], ['#3b3421','#1a160c'], ['#2a404b','#121e24'],
    ['#44302a','#1f1512'], ['#352a45','#171221'], ['#1d3a32','#0a1714']
  ];
  var SOLIDS = ['#13211A','#22382E','#3A2F17','#2A404B','#451F19','#0c130f','#FAF7F2','#D8B85F'];

  /* ---------- icons ---------- */
  var I = {
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    dl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>',
    spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
    share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 3v13M8 7l4-4 4 4"/></svg>',
    up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 16l-5-5L5 21"/></svg>',
    pick:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1 .8-1.5 1.5-1.5h1.5A4 4 0 0 0 21 13c0-5-4-10-9-10z"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
  };
  var PLAT = {
    instagram:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3"/></svg>',
    tiktok:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2.3 1.8 3.9 4 4.2v2.7c-1.4 0-2.8-.4-4-1.1v5.7a5.8 5.8 0 1 1-5-5.7v2.9a2.9 2.9 0 1 0 2 2.8V3h3z"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2H21l-6.4 7.3L22 22h-6.8l-4.7-6.2L4.9 22H2l7-7.9L2 2h6.9l4.3 5.7L18.2 2z"/></svg>',
    facebook:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>',
    threads:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 11.6c.7 3-1 5.4-4.3 5.4-2.4 0-4-1.4-4.1-3.4 0-1.7 1.4-2.8 3.4-2.8.8 0 1.5.1 2.1.4 0-1.3-.7-2-2-2-.9 0-1.5.3-2 .9l-1.4-1A3.7 3.7 0 0 1 11.6 8c2.3 0 3.6 1.4 3.7 3.8l1.2-.2zm-4.4 3.2c1.3 0 2.2-.9 2.1-2.4-.5-.3-1.1-.4-1.8-.4-1 0-1.7.5-1.7 1.3 0 .9.6 1.5 1.4 1.5z" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    story:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="4"/></svg>',
    download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>',
    more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
  };
  var PLAT_BG = { instagram:'linear-gradient(135deg,#F9CE34,#EE2A7B,#6228D7)', tiktok:'#111', x:'#111', facebook:'#1877F2', threads:'#111', story:'linear-gradient(135deg,#F9CE34,#EE2A7B,#6228D7)', download:'#3A6B52', more:'#444' };

  /* ---------- helpers ---------- */
  function esc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function hexToRgb(h){ h=h.replace('#',''); if(h.length===3) h=h.split('').map(function(c){return c+c;}).join(''); var n=parseInt(h,16); return [n>>16&255,n>>8&255,n&255]; }
  function rgbToHex(r,g,b){ return '#'+[r,g,b].map(function(v){ v=Math.max(0,Math.min(255,Math.round(v))); return ('0'+v.toString(16)).slice(-2); }).join(''); }
  function rotateHue(hex, deg){
    var c=hexToRgb(hex), r=c[0]/255,g=c[1]/255,b=c[2]/255;
    var mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2, h,s,d=mx-mn;
    if(!d){ h=s=0; } else { s=l>0.5?d/(2-mx-mn):d/(mx+mn);
      h = mx===r ? (g-b)/d+(g<b?6:0) : mx===g ? (b-r)/d+2 : (r-g)/d+4; h/=6; }
    h=(h*360+deg)%360; if(h<0)h+=360; h/=360;
    function t(p,q,t){ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; }
    var q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
    return rgbToHex(t(p,q,h+1/3)*255, t(p,q,h)*255, t(p,q,h-1/3)*255);
  }

  /* ---------- rendering ---------- */
  function paintBackground(ctx, W, H, d){
    var bg=d.bg;
    if(bg.kind==='photo' && bg.img){
      var iw=bg.img.width, ih=bg.img.height, ir=iw/ih, fr=W/H, dw,dh,dx,dy;
      if(ir>fr){ dh=H; dw=H*ir; } else { dw=W; dh=W/ir; }
      var blur = (D&&D.blur)||0, infl=blur*2.4;
      dw+=infl*2; dh+=infl*2; dx=(W-dw)/2; dy=(H-dh)/2;
      if(blur){ ctx.save(); ctx.filter='blur('+blur+'px)'; ctx.drawImage(bg.img,dx,dy,dw,dh); ctx.restore(); }
      else { ctx.drawImage(bg.img,dx,dy,dw,dh); }
      var dk = (D&&D.dark!=null)?D.dark:0.28;
      if(dk){ ctx.fillStyle='rgba(0,0,0,'+dk+')'; ctx.fillRect(0,0,W,H); }
      var sc=ctx.createLinearGradient(0,0,0,H);
      sc.addColorStop(0,'rgba(0,0,0,0.26)'); sc.addColorStop(0.42,'rgba(0,0,0,0.05)'); sc.addColorStop(1,'rgba(0,0,0,0.5)');
      ctx.fillStyle=sc; ctx.fillRect(0,0,W,H);
      vignette(ctx,W,H,0.32); grain(ctx,W,H,0.035); return;
    }
    if(bg.kind==='solid'){ ctx.fillStyle=bg.value; ctx.fillRect(0,0,W,H); grain(ctx,W,H,0.03); return; }
    if(bg.kind==='gradient'){
      var g=ctx.createLinearGradient(0,0,W*0.3,H); g.addColorStop(0,bg.value[0]); g.addColorStop(1,bg.value[1]);
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H); vignette(ctx,W,H,0.34); grain(ctx,W,H,0.04); return;
    }
    paintMood(ctx,W,H,bg.value,bg.seed||0);
  }

  function paintMood(ctx,W,H,m,seed){
    var top = seed?rotateHue(m.top,seed):m.top, bot = seed?rotateHue(m.bot,seed):m.bot;
    var g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,top); g.addColorStop(1,bot);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // warm top light
    ctx.globalCompositeOperation='screen';
    var r=ctx.createRadialGradient(W*0.5,-H*0.06,0, W*0.5,-H*0.06,H*0.72);
    r.addColorStop(0,m.light); r.addColorStop(0.5,m.light.replace(/[\d.]+\)$/,'0.12)')); r.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=r; ctx.fillRect(0,0,W,H);
    // god rays
    ctx.save();
    var apexX=W*0.5, apexY=-H*0.04, rays=20, spread=Math.PI*0.9;
    for(var i=0;i<rays;i++){
      var base=(-spread/2)+(i/(rays-1))*spread + (seed*0.0009);
      var jitter=((i*53+seed)%17)/17;
      var a1=base-0.006-jitter*0.004, a2=base+0.006+jitter*0.004, len=H*1.25;
      ctx.beginPath(); ctx.moveTo(apexX,apexY);
      ctx.lineTo(apexX+Math.sin(a1)*len, apexY+Math.cos(a1)*len);
      ctx.lineTo(apexX+Math.sin(a2)*len, apexY+Math.cos(a2)*len); ctx.closePath();
      ctx.fillStyle = m.light.replace(/[\d.]+\)$/,(0.05+jitter*0.05).toFixed(3)+')');
      ctx.fill();
    }
    ctx.restore();
    ctx.globalCompositeOperation='source-over';
    vignette(ctx,W,H,0.4);
    grain(ctx,W,H,0.05);
  }
  function vignette(ctx,W,H,amt){
    var v=ctx.createRadialGradient(W*0.5,H*0.42,Math.min(W,H)*0.18, W*0.5,H*0.52,Math.max(W,H)*0.72);
    v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,'+amt+')');
    ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
  }
  var grainCanvas=null;
  function grain(ctx,W,H,alpha){
    if(!grainCanvas){ grainCanvas=document.createElement('canvas'); grainCanvas.width=grainCanvas.height=140;
      var g=grainCanvas.getContext('2d'), id=g.createImageData(140,140);
      for(var i=0;i<id.data.length;i+=4){ var v=Math.random()*255; id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=255; }
      g.putImageData(id,0,0);
    }
    ctx.save(); ctx.globalAlpha=alpha; ctx.globalCompositeOperation='overlay';
    var p=ctx.createPattern(grainCanvas,'repeat'); ctx.fillStyle=p; ctx.fillRect(0,0,W,H); ctx.restore();
  }

  function wrapLines(ctx,text,maxW){
    var paras=String(text).split('\n'), out=[];
    paras.forEach(function(para){
      var words=para.split(/\s+/).filter(Boolean), line='';
      if(!words.length){ out.push(''); return; }
      for(var i=0;i<words.length;i++){ var t=line?line+' '+words[i]:words[i];
        if(ctx.measureText(t).width>maxW && line){ out.push(line); line=words[i]; } else line=t; }
      if(line) out.push(line);
    });
    return out;
  }

  function drawText(ctx,W,H,d){
    var f=FB[d.font], dark=d.color==='dark';
    var col = dark? '#191512' : '#FCF8EE';
    var pad=W*0.115, maxW=W-pad*2;
    var sizeMul = d.size||1;
    var base = W*0.082*f.scale*sizeMul;
    function setF(sz){ ctx.font = f.w+' '+sz+'px '+f.fam; }
    setF(base);
    var lines=wrapLines(ctx,d.text,maxW), guard=0;
    while(lines.length>(d.type==='declaration'?7:6) && base>W*0.044 && guard++<14){ base*=0.93; setF(base); lines=wrapLines(ctx,d.text,maxW); }
    var lh=base*(f.k==='hand'?1.12:1.26);
    var hasRef=!!d.ref;
    var refSize=W*0.03, refGap=W*0.06;
    var blockH=lines.length*lh + (hasRef?refGap+refSize:0);
    var cy=H*0.5 - blockH/2 + base*0.82;
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.shadowColor='rgba(0,0,0,'+(dark?0.14:0.45)+')'; ctx.shadowBlur=W*0.022; ctx.shadowOffsetY=W*0.004;
    ctx.fillStyle=col; setF(base);
    lines.forEach(function(ln,i){ ctx.fillText(ln, W/2, cy+i*lh); });
    ctx.shadowColor='transparent';
    if(hasRef){
      var ry=cy+(lines.length-1)*lh+refGap+refSize*0.4;
      ctx.font='600 '+refSize+'px '+FB.dmsans.fam;
      try{ ctx.letterSpacing=(refSize*0.22)+'px'; }catch(e){}
      ctx.fillStyle = dark? 'rgba(25,21,18,0.72)' : 'rgba(255,240,205,0.92)';
      ctx.fillText(String(d.ref).toUpperCase(), W/2, ry);
      try{ ctx.letterSpacing='0px'; }catch(e){}
    }
  }

  function drawWordmark(ctx,W,H,d){
    var dark=d.color==='dark';
    var y=H - H*(d.format==='wide'?0.10:0.066);
    var s=W*0.026;
    ctx.globalAlpha=dark?0.55:0.72;
    // small cross
    ctx.strokeStyle=dark?'#191512':'#FCF8EE'; ctx.lineWidth=W*0.004; ctx.lineCap='round';
    var cx=W/2 - W*0.082, cyy=y - s*0.36;
    ctx.beginPath(); ctx.moveTo(cx, cyy-s*0.6); ctx.lineTo(cx, cyy+s*0.6); ctx.moveTo(cx-s*0.36, cyy-s*0.12); ctx.lineTo(cx+s*0.36, cyy-s*0.12); ctx.stroke();
    ctx.font='600 '+s+'px '+FB.dmsans.fam; ctx.textAlign='left'; ctx.fillStyle=dark?'#191512':'#FCF8EE';
    try{ ctx.letterSpacing=(s*0.34)+'px'; }catch(e){}
    ctx.fillText('DECLARE', cx+s*0.62, y);
    try{ ctx.letterSpacing='0px'; }catch(e){}
    ctx.globalAlpha=1;
  }

  function renderTo(canvas, d){
    var F=FORMATS[d.format], W=F.w, H=F.h, ctx=canvas.getContext('2d');
    var s=canvas.width/W;
    ctx.save(); ctx.scale(s,s);
    ctx.clearRect(0,0,W,H);
    paintBackground(ctx,W,H,d);
    drawText(ctx,W,H,d);
    drawWordmark(ctx,W,H,d);
    ctx.restore();
  }

  /* ---------- font loading ---------- */
  var fontsInjected=false, fontsReady=null;
  function ensureFonts(){
    if(fontsInjected) return fontsReady;
    fontsInjected=true;
    var l=document.createElement('link'); l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@500;600;700&family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Playfair+Display:wght@500;600;700&family=Spectral:wght@400;500;600&display=swap';
    document.head.appendChild(l);
    var probes=FONTS.map(function(f){ try{ return document.fonts.load(f.w+' 64px '+f.fam); }catch(e){ return Promise.resolve(); } });
    fontsReady = (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){ return Promise.all(probes); });
    return fontsReady;
  }

  /* ---------- state + UI ---------- */
  var root, scrim, D, dpr=Math.min(window.devicePixelRatio||1, 2.5);
  var P = {};

  function defaults(p){
    var moodByType = { verse:'dawn', declaration:'gold', reading:'deep', journey:'forest' };
    var m = MOODS.filter(function(x){return x.key===(moodByType[p.type]||'dawn');})[0]||MOODS[0];
    return {
      type:p.type, text:p.text||'', ref:p.ref||'', url:p.url||location.href,
      format:'post', font:'cormorant', color:m.text, size:1,
      bg:{ kind:'mood', value:m, seed:0 }, blur:0, dark:0.28, _tool:'image'
    };
  }

  function ensure(){
    if(scrim) return;
    root=document.querySelector('.screen')||document.querySelector('.app')||document.body;
    scrim=document.createElement('div');
    scrim.className='cst-scrim'+(root===document.body?' fixed':'');
    scrim.innerHTML=
      '<div class="cst">'+
        '<div class="cst-top"><button class="cst-ib" data-x>'+I.x+'</button><div class="cst-title" id="cstTitle">Design your card</div><button class="cst-go" data-share>'+I.share+'Share</button></div>'+
        '<div class="cst-stage"><canvas class="cst-canvas" id="cstCanvas"></canvas></div>'+
        '<div class="cst-dock">'+
          '<div class="cst-tool-panel" id="cstBody"></div>'+
          '<div class="cst-toolbar" id="cstToolbar"></div>'+
        '</div>'+
        '<div class="cst-sub" id="cstSub"></div>'+
        '<div class="cst-toast" id="cstToast"></div>'+
      '</div>'+
      '<input type="file" accept="image/*" id="cstFile" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none">';
    root.appendChild(scrim);

    scrim.querySelector('[data-x]').addEventListener('click', close);
    scrim.querySelector('[data-share]').addEventListener('click', openShareSheet);
    scrim.querySelector('#cstFile').addEventListener('change', onFile);
    window.addEventListener('resize', fitCanvas);
  }

  /* ----- canvas sizing & paint ----- */
  function fitCanvas(){
    if(!scrim||!scrim.classList.contains('open')) return;
    var stage=scrim.querySelector('.cst-stage'), cv=scrim.querySelector('#cstCanvas');
    var F=FORMATS[D.format], ar=F.w/F.h;
    var availW=stage.clientWidth-4, availH=stage.clientHeight-4;
    var w=availW, h=w/ar; if(h>availH){ h=availH; w=h*ar; }
    cv.style.width=w+'px'; cv.style.height=h+'px';
    cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
    paint();
  }
  function paint(){ var cv=scrim.querySelector('#cstCanvas'); renderTo(cv, D); }
  function repaintSoft(){ var cv=scrim.querySelector('#cstCanvas'); cv.classList.add('swap'); requestAnimationFrame(function(){ paint(); requestAnimationFrame(function(){ cv.classList.remove('swap'); }); }); }

  /* ----- bottom toolbar: one focused tool at a time (YouVersion model) ----- */
  var TOOLS = [
    { key:'image',  label:'Image',  ic:I.up },
    { key:'font',   label:'Font',   ic:'<span class="ti-txt serifish">Tt</span>' },
    { key:'text',   label:'Text',   ic:'<span class="ti-txt">AA</span>' },
    { key:'tone',   label:'Tone',   ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor" stroke="none"/></svg>' },
    { key:'format', label:'Format', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="3.5" width="13" height="17" rx="2.5"/><path d="M20 8v8"/></svg>' }
  ];
  function renderToolbar(){
    var el=scrim.querySelector('#cstToolbar');
    el.innerHTML = TOOLS.map(function(t){
      return '<button class="cst-tbtn'+(D._tool===t.key?' on':'')+'" data-tool="'+t.key+'"><span class="ti">'+t.ic+'</span><span class="tl">'+t.label+'</span></button>';
    }).join('') + '<button class="cst-tbtn cst-tsurprise" data-surprise><span class="ti">'+I.spark+'</span><span class="tl">Surprise</span></button>';
    el.querySelectorAll('[data-tool]').forEach(function(b){
      b.addEventListener('click', function(){
        var k=b.getAttribute('data-tool');
        D._tool = (D._tool===k) ? null : k;  // tap the active tool again -> full preview
        renderToolbar(); renderControls(); fitCanvas();
      });
    });
    el.querySelector('[data-surprise]').addEventListener('click', surprise);
  }

  /* ----- controls (active tool panel) ----- */
  function thumb(d2){
    var c=document.createElement('canvas'); c.width=120; c.height=120; renderToThumb(c,d2); return c.outerHTML? c : c;
  }
  function renderToThumb(canvas,bg){
    var ctx=canvas.getContext('2d'), W=120,H=120;
    paintBackground(ctx,W,H,{bg:bg});
  }
  function renderControls(){
    var body=scrim.querySelector('#cstBody');
    if(!D._tool){ body.classList.remove('open'); body.innerHTML=''; return; }
    body.classList.add('open');
    body.innerHTML =
      D._tool==='image'  ? imageTool()  :
      D._tool==='font'   ? fontTool()   :
      D._tool==='text'   ? textTool()   :
      D._tool==='tone'   ? toneTool()   : formatTool();
    body.scrollTop=0;
    wireBody(body);
    if(D._tool==='image') paintUsArea(body);
    body.querySelectorAll('canvas[data-thumb]').forEach(function(c){
      var kind=c.getAttribute('data-thumb'), idx=+c.getAttribute('data-i');
      var bg = kind==='mood' ? {kind:'mood',value:MOODS[idx],seed:0} : {kind:'gradient',value:GRADS[idx]};
      c.width=120; c.height=120; renderToThumb(c,bg);
    });
  }

  /* IMAGE \u2014 one scrolling panel: upload \u00b7 cinematic \u00b7 photos \u00b7 gradients \u00b7 colors */
  function imageTool(){
    var html='', isPhoto=D.bg.kind==='photo';
    if(isPhoto && D.bg.img){
      html+='<div class="cst-photowrap" style="margin-bottom:14px"><img class="pth" src="'+D.bg.src+'" alt=""><div class="pbtns"><button class="cst-mini" data-upload>Replace</button><button class="cst-mini danger" data-rmphoto>Remove</button></div></div>';
      html+=sliderHTML('blur','Blur',0,60,D.blur||0,1);
      html+=sliderHTML('dark','Darken',0,0.65,(D.dark==null?0.28:D.dark),0.01);
    } else {
      html+='<button class="cst-drop slim" data-upload>'+I.up+'<span class="dt">Upload your photo</span></button>';
    }
    html+='<div class="cst-lbl" style="margin-top:14px">Cinematic <button class="cst-gen" data-gen>'+I.spark+'Generate</button></div>';
    html+='<div class="cst-grid">'+MOODS.map(function(m,i){
      var on=D.bg.kind==='mood'&&D.bg.value.key===m.key;
      return '<button class="cst-thumb'+(on?' on':'')+'" data-mood="'+i+'"><canvas data-thumb="mood" data-i="'+i+'"></canvas><span class="tn">'+m.name+'</span></button>';
    }).join('')+'</div>';
    html+='<div class="cst-lbl" style="margin-top:14px">Photos <span class="cst-by">Unsplash</span></div>';
    html+='<div class="cst-ussearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg><input data-ussearch placeholder="Search Unsplash\u2026" value="'+esc(US.q)+'"></div>';
    html+='<div class="cst-attr" id="usAttr"></div>';
    html+='<div class="cst-chiprow" id="usThemes"></div>';
    html+='<div class="cst-grid cst-gal" id="usGrid"></div>';
    html+='<div class="cst-lbl" style="margin-top:14px">Gradients</div>';
    html+='<div class="cst-grid">'+GRADS.map(function(g,i){
      var on=D.bg.kind==='gradient'&&D.bg.value[0]===g[0];
      return '<button class="cst-thumb'+(on?' on':'')+'" data-grad="'+i+'"><canvas data-thumb="gradient" data-i="'+i+'"></canvas></button>';
    }).join('')+'</div>';
    html+='<div class="cst-lbl" style="margin-top:14px">Colors</div>';
    html+='<div class="cst-colors">'+SOLIDS.map(function(c){
      var on=D.bg.kind==='solid'&&D.bg.value.toLowerCase()===c.toLowerCase();
      return '<button class="cst-sw'+(on?' on':'')+'" data-solid="'+c+'" style="background:'+c+'"></button>';
    }).join('')+'<label class="cst-sw pick">'+I.pick+'<input type="color" data-customcolor value="'+(D.bg.kind==='solid'?D.bg.value:'#22382E')+'"></label></div>';
    return html;
  }

  /* FONT \u2014 live list rows, each name set in its own face (YouVersion pattern) */
  function fontTool(){
    return '<div class="cst-frows">'+FONTS.map(function(f){
      var on=D.font===f.key;
      return '<button class="cst-frow'+(on?' on':'')+'" data-font="'+f.key+'">'
        +'<span class="fname" style="font-family:'+f.fam.replace(/"/g,'&quot;')+';font-weight:'+f.w+'">'+f.label+'</span>'
        +'<span class="fck">'+I.check+'</span></button>';
    }).join('')+'</div>';
  }

  /* TEXT \u2014 words, reference, live size slider */
  function textTool(){
    var html='<textarea class="cst-field" rows="3" data-text placeholder="Your words\u2026">'+esc(D.text)+'</textarea>';
    if(D.type==='verse'||D.type==='reading'||D.type==='declaration')
      html+='<input class="cst-field" data-ref placeholder="Reference (optional)" value="'+esc(D.ref)+'">';
    html+=sliderHTML('size','Text size',0.75,1.3,D.size||1,0.01);
    return html;
  }

  /* TONE \u2014 light / dark rows */
  function toneTool(){
    return '<div class="cst-frows">'
      +'<button class="cst-frow'+(D.color==='light'?' on':'')+'" data-color="light"><span class="fname">Light text</span><span class="fck">'+I.check+'</span></button>'
      +'<button class="cst-frow'+(D.color==='dark'?' on':'')+'" data-color="dark"><span class="fname" style="opacity:.75">Dark text</span><span class="fck">'+I.check+'</span></button></div>';
  }

  /* FORMAT \u2014 the four platform sizes */
  function formatTool(){
    return '<div class="cst-fmtgrid">'+Object.keys(FORMATS).map(function(k){
      var F=FORMATS[k];
      return '<button class="cst-fmt'+(D.format===k?' on':'')+'" data-fmt="'+k+'"><span class="fg" style="width:'+F.bw+'px;height:'+F.bh+'px"></span>'+
        '<span class="fcol"><span class="ft">'+F.label+'</span><span class="fp">'+F.plat+'</span></span></button>';
    }).join('')+'</div>';
  }

  function sliderHTML(key,label,min,max,val,step){
    return '<div class="cst-slider"><div class="cst-srow"><span>'+label+'</span><span class="cst-sval" data-sval="'+key+'">'+sliderDisp(key,val)+'</span></div>'+
      '<input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'" data-slider="'+key+'"></div>';
  }
  function sliderDisp(key,val){ return key==='dark'? Math.round(val*100)+'%' : key==='size'? Math.round(val*100)+'%' : Math.round(val)+'px'; }
  function loadPhoto(url, meta){
    var img=new Image(); img.crossOrigin='anonymous';
    img.onload=function(){
      D.bg={kind:'photo',img:img,src:url}; D.color='light';
      US.attr = meta ? { name:meta.name, link:meta.link } : null;
      if(meta && meta.track){ try{ fetch(WORKER+'/unsplash/track?d='+encodeURIComponent(meta.track)); }catch(e){} }
      renderControls(); repaintSoft();
    };
    img.onerror=function(){ toast('Couldn\u2019t load that image'); };
    img.src=url;
  }
  /* ----- Unsplash area: theme chips · grid (curated or search results) · attribution ----- */
  function paintUsArea(body){
    var chips=body.querySelector('#usThemes'), grid=body.querySelector('#usGrid'), attr=body.querySelector('#usAttr');
    if(!chips||!grid) return;
    chips.innerHTML=THEMES.map(function(t){
      return '<button class="cst-chip'+(!US.results&&US.theme===t.key?' on':'')+'" data-ustheme="'+t.key+'">'+t.name+'</button>';
    }).join('');
    if(US.results==='loading'){
      grid.innerHTML='<div class="cst-usnote">Searching Unsplash\u2026</div>';
    } else if(US.results==='error'){
      grid.innerHTML='<div class="cst-usnote">Search is unavailable right now \u2014 the themed gallery still works.</div>';
    } else if(US.results){
      grid.innerHTML=US.results.length?US.results.map(function(r){
        return '<button class="cst-thumb" data-photo="'+esc(r.full)+'" data-name="'+esc(r.name||'')+'" data-link="'+esc(r.link||'')+'" data-track="'+esc(r.download_location||'')+'"><img src="'+esc(r.thumb)+'" loading="lazy" alt=""></button>';
      }).join(''):'<div class="cst-usnote">Nothing found for \u201c'+esc(US.q)+'\u201d.</div>';
    } else {
      var t=THEMES.filter(function(x){return x.key===US.theme;})[0]||THEMES[0];
      grid.innerHTML=t.ids.map(function(id){
        var on=D.bg.kind==='photo' && D.bg.src && D.bg.src.indexOf(id)>-1;
        return '<button class="cst-thumb'+(on?' on':'')+'" data-photo="'+photoURL(id,true)+'"><img src="'+photoURL(id,false)+'" loading="lazy" alt=""></button>';
      }).join('');
    }
    if(attr){
      attr.innerHTML = US.attr ? 'Photo by <a href="'+esc(US.attr.link)+'?utm_source=declare&utm_medium=referral" target="_blank" rel="noopener">'+esc(US.attr.name)+'</a> on <a href="https://unsplash.com/?utm_source=declare&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a>' : '';
      attr.style.display = US.attr ? '' : 'none';
    }
    // grid + chips wiring (delegated, containers are stable within the panel)
    chips.onclick=function(e){ var b=e.target.closest('[data-ustheme]'); if(!b) return; US.theme=b.getAttribute('data-ustheme'); US.results=null; US.q=''; var si=body.querySelector('[data-ussearch]'); if(si) si.value=''; paintUsArea(body); };
    grid.onclick=function(e){
      var b=e.target.closest('[data-photo]'); if(!b) return;
      b.classList.add('loading');
      var meta = b.getAttribute('data-name') ? { name:b.getAttribute('data-name'), link:b.getAttribute('data-link'), track:b.getAttribute('data-track') } : null;
      loadPhoto(b.getAttribute('data-photo'), meta);
    };
    var si=body.querySelector('[data-ussearch]');
    if(si && !si._wired){ si._wired=true;
      si.addEventListener('input', function(){
        US.q=this.value.trim();
        clearTimeout(US.timer);
        if(US.q.length<3){ US.results=null; paintUsArea(body); return; }
        US.timer=setTimeout(function(){ runUsSearch(body); }, 350);
      });
    }
  }
  function runUsSearch(body){
    var myReq=++US.req;
    US.results='loading'; paintUsArea(body);
    fetch(WORKER+'/unsplash/search?q='+encodeURIComponent(US.q))
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(j){ if(myReq!==US.req) return; US.results=(j&&j.results)?j.results:'error'; paintUsArea(body); })
      .catch(function(){ if(myReq===US.req){ US.results='error'; paintUsArea(body); } });
  }

  function wireBody(body){
    body.querySelectorAll('[data-fmt]').forEach(function(b){ b.addEventListener('click', function(){ D.format=b.getAttribute('data-fmt'); renderControls(); fitCanvas(); }); });
    body.querySelectorAll('[data-mood]').forEach(function(b){ b.addEventListener('click', function(){ var m=MOODS[+b.getAttribute('data-mood')]; D.bg={kind:'mood',value:m,seed:0}; D.color=m.text; renderControls(); repaintSoft(); }); });
    body.querySelectorAll('[data-grad]').forEach(function(b){ b.addEventListener('click', function(){ D.bg={kind:'gradient',value:GRADS[+b.getAttribute('data-grad')]}; D.color='light'; renderControls(); repaintSoft(); }); });
    body.querySelectorAll('[data-solid]').forEach(function(b){ b.addEventListener('click', function(){ var c=b.getAttribute('data-solid'); D.bg={kind:'solid',value:c}; D.color = isLight(c)?'dark':'light'; renderControls(); repaintSoft(); }); });
    var cc=body.querySelector('[data-customcolor]'); if(cc) cc.addEventListener('input', function(){ D.bg={kind:'solid',value:cc.value}; D.color=isLight(cc.value)?'dark':'light'; paint(); });
    var gen=body.querySelector('[data-gen]'); if(gen) gen.addEventListener('click', function(){ var m=MOODS[Math.floor(Math.random()*7)]; D.bg={kind:'mood',value:m,seed:Math.floor(Math.random()*360)}; D.color=m.text; repaintSoft(); });
    body.querySelectorAll('[data-upload]').forEach(function(b){ b.addEventListener('click', function(){ scrim.querySelector('#cstFile').click(); }); });
    body.querySelectorAll('[data-slider]').forEach(function(r){ r.addEventListener('input', function(){ var k=r.getAttribute('data-slider'); D[k]=parseFloat(r.value); var dv=body.querySelector('[data-sval="'+k+'"]'); if(dv) dv.textContent=sliderDisp(k,D[k]); paint(); }); });
    var rm=body.querySelector('[data-rmphoto]'); if(rm) rm.addEventListener('click', function(){ D.bg={kind:'mood',value:MOODS[0],seed:0}; D.color='light'; US.attr=null; renderControls(); repaintSoft(); });
    var ta=body.querySelector('[data-text]'); if(ta) ta.addEventListener('input', function(){ D.text=ta.value; paint(); });
    var rf=body.querySelector('[data-ref]'); if(rf) rf.addEventListener('input', function(){ D.ref=rf.value; paint(); });
    body.querySelectorAll('[data-font]').forEach(function(b){ b.addEventListener('click', function(){ D.font=b.getAttribute('data-font'); ensureFonts().then(paint); renderControls(); paint(); }); });
    body.querySelectorAll('[data-color]').forEach(function(b){ b.addEventListener('click', function(){ D.color=b.getAttribute('data-color'); renderControls(); paint(); }); });
  }
  function isLight(hex){ var c=hexToRgb(hex); return (0.299*c[0]+0.587*c[1]+0.114*c[2])>150; }

  function onFile(e){
    var file=e.target.files&&e.target.files[0]; if(!file) return;
    var rd=new FileReader();
    rd.onload=function(){ var img=new Image(); img.onload=function(){ D.bg={kind:'photo',img:img,src:rd.result}; D.color='light'; D._tool='image'; renderToolbar(); renderControls(); repaintSoft(); }; img.src=rd.result; };
    rd.readAsDataURL(file); e.target.value='';
  }

  /* ----- surprise ----- */
  function surprise(){
    var m=MOODS[Math.floor(Math.random()*7)];
    var fonts=FONTS.filter(function(f){return f.key!=='bebas'||D.type==='declaration';});
    D.bg={kind:'mood',value:m,seed:Math.random()<0.5?0:Math.floor(Math.random()*360)};
    D.color=m.text;
    D.font=fonts[Math.floor(Math.random()*fonts.length)].key;
    D.size=[0.85,1,1,1.18][Math.floor(Math.random()*4)];
    ensureFonts().then(function(){ renderControls(); repaintSoft(); });
    renderControls(); repaintSoft();
  }

  /* ----- export + share ----- */
  function exportBlob(){
    return new Promise(function(res){
      ensureFonts().then(function(){
        var F=FORMATS[D.format], c=document.createElement('canvas'); c.width=F.w; c.height=F.h;
        renderTo(c, D);
        if(c.toBlob) c.toBlob(function(b){ res(b); }, 'image/png', 0.95);
        else { var u=c.toDataURL('image/png'); fetch(u).then(function(r){return r.blob();}).then(res); }
      });
    });
  }
  /* Copy the rendered PNG to the clipboard so it can be pasted straight into a
     composer. Resolves true only when the copy actually landed. */
  function copyImage(blob){
    try{
      if(navigator.clipboard && window.ClipboardItem){
        return navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(function(){ return true; }, function(){ return false; });
      }
    }catch(e){}
    return Promise.resolve(false);
  }
  function downloadBlob(blob, fname){
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);
  }
  function exportShare(mode, platform){
    toast('Rendering\u2026');
    exportBlob().then(function(blob){
      var fname='declare-'+(D.type||'card')+'.png';
      var file=new File([blob],fname,{type:'image/png'});
      var txt = D.type==='verse' ? (D.ref?D.ref+' \u2014 ':'')+'shared from Declare' : 'Shared from Declare';
      // Mobile: the OS share sheet drops the card DIRECTLY into the chosen app's
      // composer \u2014 the truest one-tap path. Desktop platform tiles skip this
      // (desktop "share" sheets are weak) and use clipboard + create-surface below.
      var mobileLike = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
      if(mode==='native' || (mode==='platform' && mobileLike)){
        if(navigator.canShare && navigator.canShare({files:[file]})){
          navigator.share({ files:[file], text:txt, title:'Declare' }).then(function(){ closeShareSheet(); }).catch(function(){});
          return;
        }
      }
      if(mode==='download' || !platform){
        downloadBlob(blob, fname);
        toast('Card saved to your device');
        return;
      }
      // Desktop platform path: copy the card to the clipboard, then open that
      // platform's create surface in a new tab \u2014 the user's existing browser
      // session keeps them signed in; they paste and post. Falls back to a
      // download when the clipboard is unavailable. X/Threads prefill the caption.
      copyImage(blob).then(function(copied){
        if(!copied) downloadBlob(blob, fname);
        var cap=encodeURIComponent(txt+(D.url?' '+D.url:''));
        var dest={
          instagram:'https://www.instagram.com/',
          story:'https://www.instagram.com/',
          tiktok:'https://www.tiktok.com/upload',
          facebook:'https://www.facebook.com/',
          x:'https://twitter.com/intent/tweet?text='+cap,
          threads:'https://www.threads.net/intent/post?text='+cap
        }[platform];
        if(dest) window.open(dest,'_blank','noopener');
        toast(copied ? 'Card copied \u2014 paste it into your '+platCap(platform)+' post' : 'Card saved \u2014 attach it in '+platCap(platform));
        closeShareSheet();
      });
    });
  }
  function platCap(p){ return ({instagram:'Instagram',tiktok:'TikTok',x:'X',facebook:'Facebook',threads:'Threads',story:'Stories'})[p]||p; }

  function openShareSheet(){
    var sub=scrim.querySelector('#cstSub');
    var plats=[
      {k:'instagram',l:'Instagram',f:'post'},{k:'story',l:'Story',s:'9:16',f:'story'},
      {k:'tiktok',l:'TikTok',f:'story'},{k:'x',l:'X',f:'wide'},
      {k:'facebook',l:'Facebook',f:'post'},{k:'threads',l:'Threads',f:'portrait'},
      {k:'download',l:'Download'},{k:'more',l:'More'}
    ];
    sub.innerHTML='<div class="sb-bd" data-subclose></div><div class="sb-sheet">'+
      '<div class="cst-grab"></div><div class="cst-sh-h">Share your card</div><div class="cst-sh-s">We\u2019ll size it for where it\u2019s going</div>'+
      '<div class="cst-plats">'+plats.map(function(p,i){
        return '<button class="cst-plat" data-plat="'+p.k+'"'+(p.f?' data-pfmt="'+p.f+'"':'')+' style="animation-delay:'+(50+i*40)+'ms"><span class="pi" style="background:'+(PLAT_BG[p.k]||'#444')+'">'+PLAT[p.k]+'</span><span class="pl">'+p.l+(p.s?'<small>'+p.s+'</small>':'')+'</span></button>';
      }).join('')+'</div></div>';
    sub.classList.add('open'); void sub.offsetWidth; sub.classList.add('cst-on');
    sub.querySelector('[data-subclose]').addEventListener('click', closeShareSheet);
    sub.querySelectorAll('[data-plat]').forEach(function(b){ b.addEventListener('click', function(){
      var k=b.getAttribute('data-plat'), pf=b.getAttribute('data-pfmt');
      if(k==='download'){ exportShare('download'); return; }
      if(k==='more'){ exportShare('native'); return; }
      if(pf && pf!==D.format){ D.format=pf; renderControls(); fitCanvas(); }
      exportShare('platform', k);
    }); });
  }
  function closeShareSheet(){ var sub=scrim.querySelector('#cstSub'); sub.classList.remove('cst-on'); setTimeout(function(){ sub.classList.remove('open'); },360); }

  /* ----- toast ----- */
  var tT; function toast(msg){ var t=scrim.querySelector('#cstToast'); t.innerHTML='<span class="tk">'+I.check+'</span>'+esc(msg); t.classList.add('show'); clearTimeout(tT); tT=setTimeout(function(){ t.classList.remove('show'); },2200); }

  /* ----- open/close ----- */
  function titleFor(t){ return t==='declaration'?'Design your declaration':t==='journey'?'Design your card':t==='reading'?'Design your reading':'Design your verse'; }
  function open(payload){
    ensure(); ensureFonts();
    P=payload||{}; D=defaults(P);
    scrim.querySelector('#cstTitle').textContent=titleFor(D.type);
    renderToolbar(); renderControls();
    scrim.classList.add('open'); void scrim.offsetWidth; scrim.classList.add('cst-on');
    document.addEventListener('keydown', onKey);
    ensureFonts().then(function(){ fitCanvas(); });
    requestAnimationFrame(function(){ setTimeout(fitCanvas, 60); });
  }
  function close(){ if(!scrim) return; scrim.classList.remove('cst-on'); document.removeEventListener('keydown', onKey); setTimeout(function(){ scrim.classList.remove('open'); },480); }
  function onKey(e){ if(e.key==='Escape'){ var sub=scrim.querySelector('#cstSub'); if(sub.classList.contains('open')) closeShareSheet(); else close(); } }

  window.DeclareStudio = { open:open, close:close };
})();
