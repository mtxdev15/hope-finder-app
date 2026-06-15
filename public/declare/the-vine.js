/* =========================================================================
   THE VINE  —  John 15:5. One central vine (Jesus, constant). An old branch
   (the lie) that dims and recedes. A branch of truth that grows and bears one
   named gold light-bud of fruit per completed day. No apples, no meter.
   build(mount, cfg) -> { svg, setProgress(completed,total), showCap(i) }
   ========================================================================= */
(function(){
  var NS='http://www.w3.org/2000/svg', GID=0;
  function E(n,a){ var e=document.createElementNS(NS,n); if(a) for(var k in a) e.setAttribute(k,a[k]); return e; }
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tr(v){ return RM?'none':v; }

  var VINE ='M140 322 C138 304 149 288 145 262 C140 224 133 206 140 168 C146 136 153 116 150 80';
  // old branch (the lie): a stub that stays on the vine + a falling segment that severs
  var OLD_STUB ='M141 250 C131 254 120 258 110 262';
  var OLD_FALL ='M110 262 C98 267 88 272 80 278 C68 286 60 295 52 306';
  var TRUTH='M146 234 C167 224 184 214 198 197 C214 178 224 158 232 136 C238 120 241 106 243 90';
  // fruit colour palette — gold (growing/light), plus ripe red and green
  var FRUITPAL={
    gold:{grad:'fG', core:'rgb(247,236,196)'},
    red :{grad:'fR', core:'rgb(250,208,200)'},
    green:{grad:'fE', core:'rgb(226,243,202)'}
  };
  // leaves that sprout along the truth branch and its offshoots as it grows (a full canopy by day 5)
  var LEAVES=[
    // early — low on the branch (days 1–2)
    {x:158,y:236,rot:150,th:0.16},{x:172,y:220,rot:-34,th:0.24},
    {x:138,y:208,rot:150,th:0.32},{x:190,y:206,rot:165,th:0.40},
    {x:242,y:191,rot:30,th:0.42},
    // mid (day 3)
    {x:160,y:168,rot:-46,th:0.48},{x:200,y:188,rot:-30,th:0.50},
    {x:187,y:148,rot:160,th:0.54},{x:182,y:160,rot:150,th:0.56},
    {x:253,y:158,rot:84,th:0.52},{x:258,y:132,rot:60,th:0.60},
    {x:214,y:170,rot:-54,th:0.58},
    // upper (day 4)
    {x:226,y:146,rot:-34,th:0.62},{x:145,y:148,rot:-60,th:0.66},
    {x:217,y:103,rot:-18,th:0.70},{x:266,y:107,rot:56,th:0.72},
    {x:270,y:142,rot:70,th:0.76},{x:214,y:92,rot:160,th:0.78},
    {x:236,y:122,rot:-34,th:0.74},
    // crown (day 5)
    {x:205,y:82,rot:160,th:0.84},{x:263,y:84,rot:48,th:0.86},
    {x:236,y:64,rot:-62,th:0.92},{x:254,y:62,rot:50,th:0.96},
    {x:248,y:104,rot:-20,th:0.88}
  ];
  // secondary + tertiary branches that fork off the truth branch — a full tree of life that grows each day
  var SUBS=[
    // day 2 — first forks appear, both sides
    {d:'M172 221 C160 218 148 216 138 208', th:0.28, w:1.9},
    {d:'M188 208 C175 197 165 184 160 168', th:0.32, w:2.0},
    {d:'M198 197 C214 195 228 193 242 190', th:0.38, w:1.8},
    // day 3 — the canopy widens
    {d:'M199 190 C190 176 186 162 187 148', th:0.44, w:1.8},
    {d:'M211 175 C226 168 241 165 253 158', th:0.48, w:2.0},
    {d:'M214 178 C202 172 192 166 182 160', th:0.54, w:1.6},
    {d:'M226 146 C238 141 248 138 258 132', th:0.58, w:1.5},
    {d:'M160 168 C152 161 148 155 145 148', th:0.60, w:1.2},
    // day 4 — upper branches climb
    {d:'M224 150 C217 133 215 119 217 103', th:0.64, w:1.8},
    {d:'M233 130 C247 124 257 118 266 107', th:0.68, w:1.7},
    {d:'M236 120 C226 110 218 102 214 92', th:0.74, w:1.5},
    {d:'M253 158 C261 153 265 148 270 142', th:0.76, w:1.1},
    // day 5 — the crown fills in
    {d:'M241 104 C250 98 257 92 263 84', th:0.82, w:1.4},
    {d:'M243 92 C239 82 236 74 236 64', th:0.88, w:1.4},
    {d:'M243 90 C249 80 252 72 254 62', th:0.94, w:1.3},
    {d:'M217 103 C210 96 207 90 205 82', th:0.86, w:1.1}
  ];

  function build(mount, cfg){
    cfg=cfg||{}; var total=cfg.total||7, gid='vg'+(++GID);
    mount.innerHTML=''; mount.style.position='relative';
    var svg=E('svg',{viewBox:'0 0 280 380', role:'img'});
    var defs=E('defs');
    defs.innerHTML=
      '<radialGradient id="'+gid+'l" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(232,201,122,.5)"/><stop offset="55%" stop-color="rgba(216,184,95,.12)"/><stop offset="100%" stop-color="rgba(216,184,95,0)"/></radialGradient>'
      +'<radialGradient id="'+gid+'fG" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(247,236,196,.96)"/><stop offset="42%" stop-color="rgba(232,201,122,.82)"/><stop offset="100%" stop-color="rgba(216,184,95,0)"/></radialGradient>'
      +'<radialGradient id="'+gid+'fR" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,216,206,.96)"/><stop offset="42%" stop-color="rgba(214,86,72,.82)"/><stop offset="100%" stop-color="rgba(196,64,52,0)"/></radialGradient>'
      +'<radialGradient id="'+gid+'fE" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(228,245,206,.96)"/><stop offset="42%" stop-color="rgba(120,176,96,.82)"/><stop offset="100%" stop-color="rgba(96,150,72,0)"/></radialGradient>';
    svg.appendChild(defs);

    var light=E('ellipse',{cx:238,cy:78,rx:124,ry:124,fill:'url(#'+gid+'l)',opacity:0.4}); light.style.transition=tr('opacity 1s ease'); svg.appendChild(light);
    svg.appendChild(E('ellipse',{cx:140,cy:330,rx:48,ry:7,fill:'rgba(0,0,0,.22)'}));

    // central vine (Jesus) — constant
    svg.appendChild(E('path',{d:VINE, fill:'none', stroke:'rgb(45,74,62)','stroke-width':8.5,'stroke-linecap':'round'}));
    var vineLit=E('path',{d:VINE, fill:'none', stroke:'rgba(232,201,122,.42)','stroke-width':2.4,'stroke-linecap':'round'}); vineLit.style.transition=tr('stroke .9s ease'); svg.appendChild(vineLit);
    [[145,300,-1],[140,170,1]].forEach(function(p){ svg.appendChild(E('path',{d:'M'+p[0]+' '+p[1]+' q'+(p[2]*13)+' -6 '+(p[2]*4)+' -15 q-'+(p[2]*9)+' 6 -'+(p[2]*4)+' 15 z', fill:'rgb(61,99,86)'})); });

    // old branch (the lie): stub stays, fall-group cracks then severs to the ground
    var oldStub=E('path',{d:OLD_STUB, fill:'none', stroke:'rgb(92,104,96)','stroke-width':3.4,'stroke-linecap':'round'}); oldStub.style.transition=tr('opacity .9s ease, stroke .9s ease'); svg.appendChild(oldStub);
    var fallG=E('g'); fallG.style.transformOrigin='110px 262px'; fallG.style.transformBox='view-box';
    fallG.style.transition=tr('transform 1.2s cubic-bezier(.4,0,.45,1), opacity 1s ease');
    fallG.appendChild(E('path',{d:OLD_FALL, fill:'none', stroke:'rgb(92,104,96)','stroke-width':3.4,'stroke-linecap':'round'}));
    fallG.appendChild(E('path',{d:'M52 306 q-12 2 -16 12 q12 0 18 -8 z', fill:'rgb(86,96,88)'}));
    fallG.appendChild(E('path',{d:'M80 278 q-9 0 -13 8 q9 1 14 -5 z', fill:'rgb(82,92,84)'}));
    svg.appendChild(fallG);
    // crack splinters at the break point — fade in as it cracks, gone once severed
    var crackG=E('g',{opacity:0}); crackG.style.transition=tr('opacity .6s ease');
    crackG.appendChild(E('path',{d:'M110 262 l-5 -3 l4 -2 l-5 -3', fill:'none', stroke:'rgba(170,150,120,.85)','stroke-width':1.1,'stroke-linecap':'round','stroke-linejoin':'round'}));
    crackG.appendChild(E('path',{d:'M110 263 l-4 4 l3 1', fill:'none', stroke:'rgba(150,132,104,.7)','stroke-width':1,'stroke-linecap':'round','stroke-linejoin':'round'}));
    svg.appendChild(crackG);

    // branch of truth — grows + thickens
    var truth=E('path',{d:TRUTH, fill:'none', stroke:'rgb(61,99,86)','stroke-width':3,'stroke-linecap':'round', pathLength:1});
    truth.setAttribute('stroke-dasharray','1'); truth.setAttribute('stroke-dashoffset','1');
    truth.style.transition=tr('stroke-dashoffset 1s cubic-bezier(.22,1,.36,1), stroke-width .9s ease, stroke .9s ease');
    svg.appendChild(truth);
    // secondary branches (grow in across days 3–5 for a fuller tree of life)
    var subEls=SUBS.map(function(S){
      var p=E('path',{d:S.d, fill:'none', stroke:'rgb(78,120,86)','stroke-width':S.w,'stroke-linecap':'round', pathLength:1});
      p.setAttribute('stroke-dasharray','1'); p.setAttribute('stroke-dashoffset','1');
      p.style.transition=tr('stroke-dashoffset .9s cubic-bezier(.22,1,.36,1), stroke-width .9s ease, stroke .9s ease');
      svg.appendChild(p); return {el:p, def:S};
    });
    mount.appendChild(svg);

    // leaves on the truth branch (sprout progressively)
    var leafEls=LEAVES.map(function(L){
      var outer=E('g'); outer.style.transformOrigin=L.x+'px '+L.y+'px'; outer.style.transformBox='view-box';
      outer.style.transition=tr('opacity .8s ease, transform .8s cubic-bezier(.34,1.56,.64,1)');
      outer.setAttribute('opacity',0); outer.style.transform='scale(.1)';
      var inner=E('g',{transform:'rotate('+L.rot+' '+L.x+' '+L.y+')'});
      var leaf=E('path',{d:'M'+L.x+' '+L.y+' q 7 -3 9 -13 q -8 2 -9 13 z', fill:'rgb(96,150,96)'});
      inner.appendChild(leaf); outer.appendChild(inner); svg.appendChild(outer);
      return {outer:outer, leaf:leaf, def:L};
    });

    // fruit along the truth branch (gold / red / green)
    var PAL = cfg.fruitColors || ['gold','green','red','gold','green','red','gold'];
    var len=200; try{ len=truth.getTotalLength()||200; }catch(e){}
    var fruitEls=[];
    for(var i=1;i<=total;i++){
      var frac=(i-0.45)/total, pt;
      try{ pt=truth.getPointAtLength(len*frac); }catch(e){ pt={x:146+90*frac, y:234-144*frac}; }
      var col=FRUITPAL[PAL[(i-1)%PAL.length]]||FRUITPAL.gold;
      var g=E('g'); g.style.transformOrigin=pt.x+'px '+pt.y+'px'; g.style.transformBox='view-box';
      g.style.transition=tr('opacity .7s ease, transform .7s cubic-bezier(.34,1.56,.64,1)');
      g.setAttribute('opacity',0); g.style.transform='scale(.2)'; g.style.cursor='pointer'; g.dataset.i=i;
      g.appendChild(E('circle',{cx:pt.x,cy:pt.y,r:12,fill:'url(#'+gid+col.grad+')'}));
      g.appendChild(E('circle',{cx:pt.x,cy:pt.y,r:4.4,fill:col.core}));
      g.appendChild(E('circle',{cx:pt.x-1.3,cy:pt.y-1.5,r:1.3,fill:'rgba(255,255,255,.9)'}));
      svg.appendChild(g); fruitEls.push({g:g, i:i});
    }

    // labels + root caption + fruit caption (HTML overlay)
    var lab=document.createElement('div'); lab.style.cssText='position:absolute;inset:0;pointer-events:none'; mount.appendChild(lab);
    function mkLabel(x,y,text,cls,align){ var d=document.createElement('div'); d.className='vine-lab '+cls;
      d.style.left=(x/280*100)+'%'; d.style.top=(y/380*100)+'%';
      d.style.transform = align==='r'?'translate(-100%,-50%)':align==='l'?'translateY(-50%)':'translate(-50%,-50%)';
      d.style.transition='opacity .9s ease, top .9s ease, left .9s ease';
      d.textContent=text; lab.appendChild(d); return d; }
    var falseLab=cfg.falseLabel ? mkLabel(86,300,cfg.falseLabel,'false','c') : null;
    var trueLab =cfg.trueLabel  ? mkLabel(238,80,cfg.trueLabel,'true','r') : null;
    var root=document.createElement('div'); root.className='vine-root'; root.innerHTML='Jesus, the Vine <span>John 15:5</span>'; mount.appendChild(root);
    var cap=document.createElement('div'); cap.className='vine-cap'; mount.appendChild(cap); var capT;
    function showCap(i){ var nm=(cfg.fruitNames||[])[i-1]||('Day '+i+' fruit'), trh=(cfg.fruitTruths||[])[i-1]||'';
      cap.innerHTML='<span class="cn">'+nm+'</span>'+(trh?'<span class="ct">'+trh+'</span>':''); cap.classList.add('show');
      clearTimeout(capT); capT=setTimeout(function(){ cap.classList.remove('show'); },2800); }
    fruitEls.forEach(function(f){ f.g.addEventListener('click', function(){ if(f.g.getAttribute('opacity')==='1') showCap(f.i); }); });

    function mix(a,b,t){ return 'rgb('+Math.round(a[0]+(b[0]-a[0])*t)+','+Math.round(a[1]+(b[1]-a[1])*t)+','+Math.round(a[2]+(b[2]-a[2])*t)+')'; }
    function setProgress(completed, tot){ tot=tot||total; completed=Math.max(0,Math.min(tot,completed));
      var reveal=completed/tot;
      truth.setAttribute('stroke-dashoffset',(1-reveal).toFixed(3));
      truth.setAttribute('stroke-width',(3+2.4*reveal).toFixed(2));
      truth.setAttribute('stroke', mix([61,99,86],[150,176,120],reveal));

      // ----- the old branch: dim → crack (day 3–4) → sever & fall (day 5) -----
      var dim=1-0.7*reveal;
      oldStub.setAttribute('opacity',dim.toFixed(2));
      var crack = reveal>=0.4 ? Math.min(1,(reveal-0.4)/0.22) : 0;       // crack appears ~day 3
      crackG.setAttribute('opacity', (reveal>=0.92 ? 0 : crack).toFixed(2));
      if(reveal>=0.92){                                                  // severed — fallen to the ground
        fallG.style.transform='translate(-26px,96px) rotate(60deg)'; fallG.style.opacity='0.18';
        oldStub.setAttribute('stroke','rgb(78,86,76)');
      } else if(reveal>=0.4){                                            // cracking — the branch sags
        var s=(reveal-0.4)/0.52; fallG.style.transform='rotate('+(s*16).toFixed(1)+'deg) translateY('+(s*3).toFixed(1)+'px)'; fallG.style.opacity=(dim*0.92).toFixed(2);
      } else { fallG.style.transform='none'; fallG.style.opacity=(dim*0.92).toFixed(2); }

      // ----- secondary branches grow in (fuller tree, days 3–5) -----
      subEls.forEach(function(sb){ var a=Math.max(0,Math.min(1,(reveal-sb.def.th)/0.16));
        sb.el.setAttribute('stroke-dashoffset',(1-a).toFixed(3));
        sb.el.setAttribute('stroke', mix([78,120,86],[150,176,120], Math.max(0,(reveal-0.6)/0.4)));
        sb.el.setAttribute('stroke-width',(sb.def.w+0.8*a).toFixed(2));
      });
      // ----- leaves sprout as the branch grows -----
      leafEls.forEach(function(le){ var on=reveal>=le.def.th;
        le.outer.setAttribute('opacity', on?'1':'0'); le.outer.style.transform=on?'scale(1)':'scale(.1)';
        le.leaf.setAttribute('fill', mix([96,150,96],[150,176,110], Math.max(0,(reveal-0.6)/0.4)));
      });

      if(falseLab){ falseLab.style.opacity=(reveal>=0.92?0.22:0.5*dim).toFixed(2);
        if(reveal>=0.92){ falseLab.style.top='86%'; falseLab.style.left='26%'; } else { falseLab.style.top=(300/380*100)+'%'; falseLab.style.left=(86/280*100)+'%'; } }
      if(trueLab) trueLab.style.opacity=(0.4+0.6*reveal).toFixed(2);
      light.setAttribute('opacity',(0.4+0.5*reveal).toFixed(2));
      vineLit.setAttribute('stroke','rgba(232,201,122,'+(0.42+0.3*reveal).toFixed(2)+')');
      fruitEls.forEach(function(f){ var on=f.i<=completed; f.g.setAttribute('opacity',on?'1':'0'); f.g.style.transform=on?'scale(1)':'scale(.2)'; });
      svg.setAttribute('aria-label',
        completed<=0 ? 'The Vine, with Jesus as the root. The old branch of '+((cfg.falseLabel||'the lie').toLowerCase())+' still hangs heavy, and the branch of truth has not yet grown.'
        : completed>=tot ? 'The Vine in full leaf and fruit. The old branch of '+((cfg.falseLabel||'the lie').toLowerCase())+' has cracked, severed, and fallen to the ground, while the branch of truth bears '+tot+' fruit \u2014 the true identity '+((cfg.trueLabel||'').toLowerCase())+'.'
        : 'Day '+completed+' of '+tot+'. The old branch is '+(reveal>=0.4?'cracking and beginning to break away':'losing its hold')+', while the branch of truth grows fuller with leaves and bears '+completed+' fruit.');
    }
    return { svg:svg, setProgress:setProgress, showCap:showCap, fruitEls:fruitEls };
  }
  window.TheVine={ build:build };
})();
