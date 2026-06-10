/* ============================================================
   DECLARE — Bottom tab bar  (declare-tabbar.js)
   <declare-tabbar active="declare"></declare-tabbar>
   Five tabs: Word · Journey · ⊕ Declare (raised gold) · Vault · You
   Self-contained web component (shadow DOM). Honors reduce-motion.
   Uses cross-document View Transitions when available (no white flash).
   ============================================================ */
(function(){
  var TABS = [
    { key:'word',    label:'Word',    href:'TheWord.html',
      icon:'<path d="M4 5.4A1.4 1.4 0 0 1 5.4 4H11v15.2H5.4A1.4 1.4 0 0 0 4 20.6z"/><path d="M20 5.4A1.4 1.4 0 0 0 18.6 4H13v15.2h5.6A1.4 1.4 0 0 1 20 20.6z"/>' },
    { key:'journey', label:'Journey', href:'Journey.html',
      icon:'<path d="M5 19c4-1 5-5 9-6"/><path d="M5 19c1-7 7-9 14-9"/><circle cx="19" cy="10" r="1.6"/><circle cx="5" cy="19" r="1.4"/>' },
    { key:'declare', label:'Declare', href:'Today.html', center:true,
      icon:'<path d="M12 3v18M5 8l7-5 7 5M7 21h10"/>' },
    { key:'vault',   label:'Vault',   href:'Vault.html',
      icon:'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="3.2"/><path d="M12 4v3M12 17v3"/>' },
    { key:'you',     label:'You',     href:'Account-A.html',
      icon:'<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>' }
  ];

  var CSS = `
  :host{ position:fixed; left:0; right:0; bottom:0; z-index:90; display:block; font-family:'DM Sans',system-ui,sans-serif;
    --gold:#D8B85F; --goldd:#E2C572; }
  .bar{ position:relative; display:grid; grid-template-columns:repeat(5,1fr); align-items:end;
    padding:10px 8px calc(9px + env(safe-area-inset-bottom));
    background:color-mix(in srgb, var(--tb-bg,#101a14) 86%, transparent);
    border-top:1px solid var(--tb-line, rgba(244,239,230,.09));
    backdrop-filter:blur(20px) saturate(1.15); -webkit-backdrop-filter:blur(20px) saturate(1.15);
    box-shadow:0 -14px 40px -22px rgba(0,0,0,.7); }
  .tab{ position:relative; display:flex; flex-direction:column; align-items:center; gap:5px;
    background:none; border:0; cursor:pointer; text-decoration:none; padding:5px 2px;
    color:var(--tb-muted, #8a9a90); font-family:inherit;
    transition:color .3s cubic-bezier(.2,.7,.2,1), transform .15s cubic-bezier(.2,.7,.2,1); }
  .tab:active{ transform:scale(.92); }
  .tab svg{ width:23px; height:23px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round;
    transition:transform .3s cubic-bezier(.2,.7,.2,1); }
  .tab .lbl{ font-size:10.5px; font-weight:500; letter-spacing:.01em; }
  .tab .dot{ position:absolute; top:-3px; width:5px; height:5px; border-radius:50%; background:var(--gold);
    opacity:0; transform:scale(0); transition:opacity .3s ease, transform .3s cubic-bezier(.3,1.5,.5,1);
    box-shadow:0 0 10px rgba(216,184,95,.8); }
  .tab.on{ color:var(--tb-on, #F3EFE6); }
  .tab.on svg{ transform:translateY(-1px); }
  .tab.on .dot{ opacity:1; transform:scale(1); }

  /* raised gold center — Declare */
  .center{ align-self:start; transform:translateY(-18px); }
  .center .orb{ width:58px; height:58px; border-radius:50%;
    background:linear-gradient(155deg, #F0DDA0, var(--gold));
    display:flex; align-items:center; justify-content:center; color:#15241B;
    box-shadow:0 10px 26px -6px rgba(216,184,95,.6), 0 0 0 6px color-mix(in srgb, var(--tb-bg,#101a14) 86%, transparent);
    transition:transform .3s cubic-bezier(.3,1.4,.5,1), box-shadow .4s ease; }
  .center .orb svg{ width:26px; height:26px; stroke:#15241B; stroke-width:1.8; }
  .center .lbl{ color:var(--tb-on,#F3EFE6); margin-top:3px; }
  .center:active .orb{ transform:scale(.93); }
  @media (hover:hover){ .center:hover .orb{ transform:translateY(-2px); box-shadow:0 16px 34px -8px rgba(216,184,95,.7), 0 0 0 6px color-mix(in srgb, var(--tb-bg,#101a14) 86%, transparent); } }

  @media (prefers-reduced-motion: no-preference){
    @keyframes orbBreath{ 0%,100%{ box-shadow:0 10px 26px -6px rgba(216,184,95,.5), 0 0 0 6px color-mix(in srgb, var(--tb-bg,#101a14) 86%, transparent); }
      50%{ box-shadow:0 12px 30px -6px rgba(216,184,95,.7), 0 0 26px -4px rgba(216,184,95,.5), 0 0 0 6px color-mix(in srgb, var(--tb-bg,#101a14) 86%, transparent); } }
    .center .orb{ animation:orbBreath 5s cubic-bezier(.4,0,.2,1) infinite; }
    /* entrance: rise from below on mount */
    @keyframes barIn{ from{ transform:translateY(100%); } to{ transform:none; } }
    .bar{ animation:barIn .6s cubic-bezier(.2,.7,.2,1) both; }
  }
  `;

  function svg(p){ return '<svg viewBox="0 0 24 24" aria-hidden="true">'+p+'</svg>'; }

  function supportsVT(){ return !!document.startViewTransition; }

  class DeclareTabbar extends HTMLElement{
    connectedCallback(){
      var active = this.getAttribute('active') || '';
      var root = this.attachShadow({mode:'open'});
      var bar = document.createElement('div'); bar.className='bar';
      var html = '<style>'+CSS+'</style>';
      bar.innerHTML = TABS.map(function(t){
        var on = t.key===active ? ' on' : '';
        if(t.center){
          return '<a class="tab center'+on+'" href="'+t.href+'" data-key="'+t.key+'" aria-label="Declare">'+
            '<span class="orb">'+svg(t.icon)+'</span><span class="lbl">'+t.label+'</span></a>';
        }
        return '<a class="tab'+on+'" href="'+t.href+'" data-key="'+t.key+'"><span class="dot"></span>'+
          svg(t.icon)+'<span class="lbl">'+t.label+'</span></a>';
      }).join('');
      root.innerHTML = html;
      root.appendChild(bar);

      // calm cross-document transition (no white flash) when supported
      bar.querySelectorAll('a.tab').forEach(function(a){
        a.addEventListener('click', function(e){
          if(a.getAttribute('data-key')===active){ e.preventDefault(); return; }
          // let native VT scaffold handle it if the browser supports cross-doc VT;
          // otherwise normal navigation. No JS needed for same-origin doc VT.
        });
      });
    }
  }
  if(!customElements.get('declare-tabbar')) customElements.define('declare-tabbar', DeclareTabbar);
})();
