/* Declare & Believe — production dashboard
   Warm-neumorphic faith declaration app. React + persisted state. */
import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import ShareSheet from './ShareSheet.jsx';
import ScriptureScreen from './scripture.jsx';
import ChurchScreen from './church.jsx';
import { DB_CATEGORIES, DB_CONTENT, DB_DEFAULT, DB_CRISIS } from '../data/content.js';
import { DB_BACKGROUNDS } from '../data/backgrounds.js';

/* ---------- component styles (warm neumorphic skin) ---------- */
const DB_CSS = `
.app{
  max-width:760px; margin:0 auto; min-height:100vh;
  padding:0 20px calc(120px + env(safe-area-inset-bottom,0)) 20px;
  display:flex; flex-direction:column;
}
@media (min-width:520px){ .app{ padding-left:32px; padding-right:32px; } }

/* ---- brand header ---- */
.brand{ text-align:center; padding:22px 0 18px; }
.brand .eyebrow{
  font-size:clamp(11px,3vw,12.5px); color:var(--muted); letter-spacing:.06em;
  margin-bottom:12px; line-height:1.4;
}
.brand .eyebrow .ref{ color:var(--gold-dark); font-weight:600; }
.brandmark{
  width:64px; height:64px; border-radius:19px; display:block; margin:0 auto 14px;
  box-shadow:var(--raise-sm); cursor:pointer; -webkit-user-select:none; user-select:none;
  transition:transform .14s ease, box-shadow .16s ease;
}
.brandmark:active{ transform:scale(.96); box-shadow:var(--raise-xs); }
.wm{
  font-family:'Cormorant Garamond', serif; font-weight:600;
  font-size:clamp(34px,9vw,52px); line-height:1; color:var(--text); letter-spacing:.005em;
}
.wm em{ color:var(--gold-dark); font-style:italic; }
.brand .tagline{
  font-size:clamp(10.5px,2.8vw,12px); font-weight:700; letter-spacing:.2em; text-transform:uppercase;
  color:var(--gold-dark); margin-top:11px; line-height:1.4;
}

/* ---- stat zone (mode C) ---- */
.statzone{ margin:32px 0 8px; }
.statzone h2{
  font-family:'Cormorant Garamond', serif; font-weight:600; font-style:italic; font-size:clamp(20px,5.4vw,25px);
  color:var(--forest); text-align:center; margin:0 0 16px; letter-spacing:.005em; line-height:1.28; text-wrap:balance;
}
.statzone-ref{
  display:block; margin-top:9px; font-style:normal; font-family:'DM Sans', sans-serif;
  font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--gold-dark);
}
.stattiles{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.stattile{
  border-radius:22px; background:var(--bg); box-shadow:var(--inset); padding:20px 16px; text-align:center;
}
.stattile .num{
  font-family:'Cormorant Garamond', serif; font-weight:600; font-size:clamp(30px,8vw,40px);
  line-height:1; color:var(--gold-dark);
}
.stattile.f .num{ color:var(--forest); }
.stattile .cap{ font-size:12.5px; color:var(--muted); margin-top:7px; line-height:1.35; }

/* ---- entry card (hero) ---- */
.card{ border-radius:26px; background:var(--surface); box-shadow:var(--raise); padding:26px 22px; }
@media (max-width:400px){ .card{ padding:22px 17px; } }
.entry{ }
.entry h1{
  font-family:'Cormorant Garamond', serif; font-weight:600;
  font-size:clamp(26px,7.2vw,36px); line-height:1.08; color:var(--text); margin:0 0 6px; letter-spacing:.005em;
  text-wrap:balance;
}
.entry .subh{ font-size:14.5px; color:var(--muted); margin:0 0 22px; line-height:1.4; }

.catgroup{ margin-bottom:20px; }
.catlabel{
  display:flex; align-items:center; gap:12px; font-size:11px; font-weight:600; letter-spacing:.13em;
  text-transform:uppercase; color:var(--gold-dark); margin-bottom:13px;
}
.catlabel::after{ content:''; flex:1; height:1px; background:linear-gradient(90deg, rgba(155,122,46,.28), rgba(155,122,46,0)); }
.chips{ display:flex; flex-wrap:wrap; gap:9px; }
.chip{
  display:inline-flex; align-items:center; gap:8px; min-height:44px;
  font-size:14px; font-weight:500; color:var(--text); padding:10px 16px;
  border-radius:999px; background:var(--surface); box-shadow:var(--raise-xs);
  transition:box-shadow .18s ease, background .18s ease, color .18s ease, transform .12s ease;
}
.chip .dot{ width:6px; height:6px; border-radius:50%; background:var(--gold); opacity:.75; flex:0 0 6px; transition:background .18s; }
.chip:hover{ transform:translateY(-1px); }
.chip:active{ box-shadow:var(--inset-sm); transform:translateY(0); }
.chip.sel{ background:var(--forest); color:#FAF7F2; box-shadow:var(--forest-press); font-weight:600; }
.chip.sel .dot{ background:var(--gold-light); opacity:.95; }

/* ---- free-text well ---- */
.well{ position:relative; margin:6px 0 20px; }
.well textarea{
  width:100%; min-height:84px; resize:vertical; border:none; outline:none;
  border-radius:18px; background:var(--bg); box-shadow:var(--inset);
  padding:16px 18px; font-family:'DM Sans',sans-serif; font-size:14.5px; color:var(--text); line-height:1.5;
}
.well textarea::placeholder{ color:var(--light); font-style:italic; }

/* ---- translation toggle ---- */
.transrow{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
.translabel{ font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--light); font-weight:600; }
.tpills{ display:flex; gap:8px; }
.tpill{
  font-size:12.5px; font-weight:600; letter-spacing:.04em; color:var(--muted); padding:8px 15px; min-height:38px;
  border-radius:999px; background:var(--surface); box-shadow:var(--raise-xs); transition:box-shadow .18s, color .18s, background .18s;
}
.tpill.on{ background:var(--gold); color:#3a2e10; box-shadow:var(--gold-press); }

/* ---- primary CTA ---- */
.cta{
  width:100%; min-height:56px; border-radius:18px; background:var(--forest); color:#FAF7F2;
  font-size:16.5px; font-weight:600; letter-spacing:.01em; box-shadow:var(--raise-sm);
  transition:box-shadow .14s ease, transform .12s ease; display:flex; align-items:center; justify-content:center; gap:9px;
}
.cta:hover{ transform:translateY(-1px); }
.cta:active{ box-shadow:var(--forest-press); transform:translateY(0); }
.cta.disabled{ opacity:.55; }
.cta.shake{ animation:db-shake .4s ease; }
@keyframes db-shake{ 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-6px);} 40%,80%{transform:translateX(6px);} }
.hint{ text-align:center; font-size:12.5px; color:var(--gold-dark); margin:12px 0 0; min-height:16px; animation:db-fade .3s; }

/* ---- "what you'll receive" promise strip (above the CTA) ---- */
.receive{
  margin:4px 0 18px; padding:16px 16px 14px; border-radius:18px;
  background:var(--bg); box-shadow:var(--inset-sm);
}
.receive-lead{
  font-size:11px; font-weight:600; letter-spacing:.13em; text-transform:uppercase;
  color:var(--gold-dark); text-align:center; margin-bottom:14px;
}
.receive-items{ display:grid; grid-template-columns:1fr 1fr; gap:14px 10px; }
.receive-item{ display:flex; align-items:center; gap:10px; min-width:0; }
.receive-ic{
  flex:0 0 auto; width:36px; height:36px; border-radius:11px;
  background:var(--surface); box-shadow:var(--raise-xs);
  display:flex; align-items:center; justify-content:center; color:var(--forest);
}
.receive-lb{ font-size:13px; font-weight:600; color:var(--text); line-height:1.25; text-wrap:balance; }
@media (min-width:620px){
  .receive-items{ grid-template-columns:repeat(4,1fr); gap:12px 8px; }
  .receive-item{ flex-direction:column; text-align:center; gap:8px; }
  .receive-lb{ font-size:12px; }
}

/* ---- quiet persistent crisis entry ---- */
.notalone{
  display:flex; align-items:center; justify-content:center; gap:9px; width:100%;
  margin:20px auto 0; padding:13px; font-size:13px; color:var(--muted); border-radius:16px;
  background:transparent; transition:box-shadow .2s, background .2s;
}
.notalone:hover{ background:var(--surface); box-shadow:var(--raise-xs); }
.notalone .heart{ width:9px; height:9px; border-radius:50%; background:var(--forest-light); flex:0 0 9px; }
.notalone b{ color:var(--forest); font-weight:600; }

/* ---- footer (links to standalone info pages + copyright) ---- */
.dbfoot{ margin:34px auto 4px; padding-top:24px; border-top:1px solid rgba(155,144,128,.22); text-align:center; }
.dbfoot-links{ display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px 0; margin-bottom:16px; }
.dbfoot-links a{ font-size:13px; font-weight:600; color:var(--forest); padding:6px 15px; position:relative; transition:color .15s; }
.dbfoot-links a:not(:last-child)::after{ content:''; position:absolute; right:0; top:50%; transform:translateY(-50%); width:1px; height:12px; background:rgba(155,144,128,.4); }
.dbfoot-links a:hover{ color:var(--gold-dark); }
.dbfoot-copy{ font-size:12.5px; color:var(--light); letter-spacing:.01em; }
.dbfoot-copy b{ color:var(--muted); font-weight:600; }
@media (min-width:1000px){ .dbfoot{ margin-top:46px; } }

/* ---- bottom nav ---- */
.nav{
  position:fixed; left:0; right:0; bottom:0; z-index:30;
  display:flex; justify-content:center;
  padding:0 16px calc(14px + env(safe-area-inset-bottom,0));
  pointer-events:none;
}
.navinner{
  pointer-events:auto; width:100%; max-width:440px;
  display:grid; grid-template-columns:repeat(4,1fr); align-items:end;
  background:var(--surface); border-radius:26px;
  box-shadow:0 -2px 22px rgba(180,165,140,.4), var(--raise);
  padding:12px 12px 11px; margin:0 auto;
}
.navitem{ display:flex; flex-direction:column; align-items:center; gap:5px; padding:8px 0 4px; color:var(--light); transition:color .2s; }
.navitem .ic{ width:23px; height:23px; display:block; }
.navitem .nlabel{ font-size:10.5px; letter-spacing:.02em; font-weight:500; }
.navitem.active{ color:var(--forest); }
.navitem.active .nlabel{ font-weight:600; }

/* ===== responsive nav =====
   Phones + tablets (touch): floating bottom pill (thumb-reachable, above).
   Desktop (≥1000px, mouse): a top navigation bar — a bottom-center bar is an
   awkward target with a cursor on a wide screen, so the menu moves up top and
   the items lay out horizontally (icon + label) like a proper app bar. */
@media (min-width:1000px){
  .nav{ top:0; bottom:auto; padding:20px 28px 0; transition:transform .38s cubic-bezier(.2,.8,.2,1), opacity .3s ease; }
  body.nav-down .nav{ transform:translateY(-135%); opacity:0; }
  .navinner{
    max-width:620px; align-items:center; grid-template-columns:repeat(4,1fr);
    padding:9px; border-radius:22px;
    box-shadow:0 8px 30px rgba(120,100,60,.16), var(--raise);
  }
  .navitem{ flex-direction:row; justify-content:center; gap:10px; padding:12px 10px; border-radius:15px; transition:color .2s, background .2s, box-shadow .2s; }
  .navitem .ic{ width:20px; height:20px; }
  .navitem .nlabel{ font-size:13.5px; letter-spacing:.01em; }
  .navitem:hover{ color:var(--forest); }
  .navitem.active{ background:var(--bg); box-shadow:var(--inset-sm); }
  /* clear the fixed top bar; drop the tall bottom gutter the mobile bar needed */
  .app{ padding-top:92px; padding-bottom:56px; }
}
@media (min-width:1000px){
  html.theme-dark .navinner{ box-shadow:0 8px 30px rgba(0,0,0,0.5), var(--raise); }
  html.theme-dark .navitem.active{ background:#17150F; box-shadow:var(--inset-sm); color:var(--forest-read); }
}

/* ---- results screen ---- */
.results{ padding-top:8px; }
.back{
  display:inline-flex; align-items:center; gap:9px; min-height:44px; font-size:14px; color:var(--muted);
  padding:8px 16px 8px 13px; border-radius:999px; background:var(--surface); box-shadow:var(--raise-xs);
  margin:8px 0 18px; transition:box-shadow .15s, transform .12s;
}
.back:hover{ transform:translateX(-2px); }
.back:active{ box-shadow:var(--inset-sm); }
.res-head{
  font-family:'Cormorant Garamond', serif; font-weight:600; font-style:normal;
  font-size:clamp(28px,8vw,40px); line-height:1.1; color:var(--gold-dark); margin:0 0 24px; letter-spacing:.005em;
  text-wrap:balance;
}
.seclabel{ font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin:0 0 11px; display:flex; align-items:center; gap:11px; }
.seclabel::after{ content:''; flex:1; height:1px; background:linear-gradient(90deg, rgba(107,99,85,.22), transparent); }
.section{ margin-bottom:26px; }
.scripstack{ display:flex; flex-direction:column; gap:14px; }
.scripcard{
  position:relative;
  border-radius:24px; background:linear-gradient(160deg, var(--gold-pale), var(--cream));
  box-shadow:var(--raise); padding:58px 26px 28px; text-align:center;
}
.verse{ font-family:'Cormorant Garamond', serif; font-weight:500; font-size:clamp(21px,5.6vw,27px); line-height:1.34; color:var(--text); letter-spacing:.004em; }
.vref{ font-size:12px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--gold-dark); margin-top:18px; }
.vref::before{ content:''; display:block; width:30px; height:1px; background:var(--gold); margin:0 auto 12px; opacity:.6; }
/* clickable verse reference → opens the Bible reader at that verse */
.vref-link{ display:inline-flex; align-items:center; gap:7px; padding:7px 14px 7px 15px; border-radius:999px;
  background:var(--cream); box-shadow:var(--raise-xs); transition:box-shadow .14s, transform .12s, color .14s; cursor:pointer; }
.vref-link::before{ display:none; }
.vref-link:hover{ transform:translateY(-1px); color:var(--forest); }
.vref-link:active{ box-shadow:var(--inset-sm); transform:translateY(0); }
.vref-go{ display:inline-flex; opacity:.75; }
.mindcard{ position:relative; border-radius:22px; background:var(--forest-pale); box-shadow:var(--raise-sm); padding:20px 22px; }
.mindcard p{ margin:0; font-size:15px; line-height:1.6; color:var(--forest); padding-right:34px; }
.savebtn.onlight.onforest{ background:rgba(255,255,255,.55); }
.decl{
  display:flex; align-items:stretch; gap:8px; width:100%;
  border-radius:18px; background:var(--surface); box-shadow:var(--raise-sm); padding:6px 8px 6px 6px; margin-bottom:11px;
  transition:box-shadow .15s ease, transform .12s ease;
}
.decl:hover{ transform:translateY(-1px); }
.decl.speaking{ box-shadow:var(--inset), 0 0 0 2px rgba(201,168,76,.4); }
.decl-play{ flex:1; display:flex; align-items:center; gap:14px; text-align:left; padding:11px 6px 11px 12px; border-radius:14px; transition:background .15s; }
.decl-play:active{ background:rgba(180,165,140,.12); }
.decl .dtxt{ font-family:'Cormorant Garamond', serif; font-weight:500; font-size:clamp(17px,4.6vw,20px); line-height:1.32; color:var(--text); flex:1; }
.decl .spk{
  flex:0 0 38px; width:38px; height:38px; border-radius:50%; background:var(--bg); box-shadow:var(--inset-sm);
  display:flex; align-items:center; justify-content:center; color:var(--forest);
}
.decl.speaking .spk{ color:var(--gold-dark); box-shadow:var(--raise-xs); }
/* bookmark / save button */
.savebtn{
  flex:0 0 42px; width:42px; align-self:center; height:42px; border-radius:13px; background:var(--bg); box-shadow:var(--inset-sm);
  display:flex; align-items:center; justify-content:center; color:var(--light); transition:color .15s, box-shadow .15s, transform .12s;
}
.savebtn:hover{ color:var(--gold-dark); }
.savebtn:active{ transform:scale(.94); }
.savebtn.on{ color:#FAF7F2; box-shadow:var(--forest-press); background:var(--forest); }
.savebtn.onlight{ position:absolute; top:14px; right:14px; flex:0 0 40px; width:40px; height:40px; background:var(--surface); box-shadow:var(--raise-xs); color:var(--gold-dark); }
.savebtn.onlight.on{ background:var(--forest); color:#FAF7F2; box-shadow:var(--forest-press); }
.prayer{ position:relative; border-radius:22px; background:var(--cream); box-shadow:var(--raise-sm); padding:22px; }
.prayer p{ margin:0; font-size:15px; line-height:1.68; color:var(--text); }
.prayer > p{ padding-right:34px; }
.prayer .amen{ display:block; margin-top:14px; font-family:'Cormorant Garamond',serif; font-style:italic; font-size:18px; color:var(--gold-dark); }

/* ===== V3 — guided spiritual journey ===== */
.res-intro{ margin:2px 0 28px; }
.res-eyebrow{ font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--gold-dark); margin-bottom:11px; }
.res-sub{ font-size:14.5px; color:var(--muted); line-height:1.55; margin:12px 0 0; max-width:44ch; text-wrap:pretty; }

.journey{ position:relative; }
.station{ position:relative; padding-left:60px; padding-bottom:34px; animation:db-fade-up .5s ease backwards; }
.station:nth-child(2){ animation-delay:.05s; }
.station:nth-child(3){ animation-delay:.1s; }
.station:nth-child(4){ animation-delay:.15s; }
.station:nth-child(5){ animation-delay:.2s; }
.station:last-child{ padding-bottom:0; }
/* the connecting spine threads every station into one journey */
.station::before{
  content:''; position:absolute; left:20px; top:0; bottom:0; width:2px;
  background:linear-gradient(to bottom, var(--gold-light), var(--gold) 60%, rgba(201,168,76,.25));
  opacity:.55;
}
.station:first-child::before{ top:26px; }
.station:last-child::before{ bottom:auto; height:26px; }
/* station node sits on the spine */
.st-node{
  position:absolute; left:0; top:2px; width:42px; height:42px; border-radius:50%;
  background:var(--surface); box-shadow:var(--raise-sm);
  display:flex; align-items:center; justify-content:center; color:var(--forest); z-index:2;
}
.st-scripture .st-node{ background:var(--gold); color:#3a2e10; box-shadow:var(--gold-raise); }
.st-prayer .st-node{ background:var(--forest); color:var(--gold-light); box-shadow:var(--forest-press); }
.st-label{
  display:flex; align-items:center; gap:11px; min-height:46px; margin-bottom:14px;
  font-size:11px; font-weight:700; letter-spacing:.15em; text-transform:uppercase; color:var(--muted);
}
.st-label.withtag{ flex-wrap:wrap; }

/* 1 · Scripture — the primary visual focus */
.st-scripture .scripstack{ display:flex; flex-direction:column; gap:14px; }
.st-scripture .scripcard:first-child{ padding:64px 28px 30px; }
.st-scripture .scripcard:first-child .verse{ font-size:clamp(23px,6.2vw,30px); }

/* first-class "read the full chapter" transition */
.readchapter{
  display:flex; align-items:center; gap:14px; width:100%; margin-top:16px; padding:15px 18px;
  border-radius:18px; background:var(--forest); color:#FAF7F2; box-shadow:var(--raise-sm); text-align:left;
  transition:box-shadow .14s ease, transform .12s ease;
}
.readchapter:hover{ transform:translateY(-1px); }
.readchapter:active{ box-shadow:var(--forest-press); transform:translateY(0); }
.readchapter .rc-ic{ flex:0 0 42px; width:42px; height:42px; border-radius:13px; background:rgba(255,255,255,.13); display:flex; align-items:center; justify-content:center; color:var(--gold-light); }
.readchapter .rc-tx{ flex:1; min-width:0; }
.readchapter .rc-tx b{ display:block; font-size:15.5px; font-weight:600; letter-spacing:.005em; }
.readchapter .rc-tx span{ display:block; font-size:12.5px; color:rgba(245,239,228,.78); margin-top:2px; line-height:1.3; }
.readchapter .rc-go{ flex:0 0 auto; opacity:.8; display:flex; }
.readchapter .rc-go svg{ transform:rotate(180deg); }

/* 2 · Mindset — interpretation / reflection (quiet, contemplative) */
.st-mind .mindcard{ background:var(--forest-pale); box-shadow:var(--raise-sm); padding:24px 24px 22px; position:relative; }
.st-mind .mindcard::before{
  content:'\\201C'; position:absolute; top:6px; left:16px; font-family:'Cormorant Garamond',serif;
  font-size:64px; line-height:1; color:var(--forest); opacity:.12;
}
.st-mind .mindcard p{ position:relative; font-size:15.5px; line-height:1.68; color:var(--forest); padding-right:30px; }

/* 3 · Speak — actionable / empowering */
.st-speak .decl:last-child{ margin-bottom:0; }

/* 4 · Prayer — intimate / personal (a quiet, enclosed moment) */
.st-prayer .prayer{
  background:radial-gradient(120% 100% at 50% 0%, var(--cream), var(--cream-dark));
  box-shadow:var(--raise-sm), var(--inset-sm); padding:30px 26px; text-align:center;
}
.st-prayer .prayer > p{ padding-right:0; }
.st-prayer .prayer p{
  font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:500;
  font-size:clamp(18px,4.9vw,22px); line-height:1.5; color:var(--forest);
}
.st-prayer .prayer .amen{ font-size:20px; margin-top:12px; }
.st-prayer .savebtn.onlight{ top:16px; right:16px; }

/* 5 · Continue in the Word — the bridge to deeper engagement */
.continue{ display:flex; flex-direction:column; gap:11px; }
.cont-primary{
  display:flex; align-items:center; gap:14px; width:100%; padding:17px 18px;
  border-radius:18px; background:linear-gradient(160deg, var(--gold-pale), var(--cream));
  box-shadow:var(--raise-sm); text-align:left; transition:box-shadow .14s ease, transform .12s ease;
}
.cont-primary:hover{ transform:translateY(-1px); }
.cont-primary:active{ box-shadow:var(--inset-sm); transform:translateY(0); }
.cont-primary .rc-ic{ flex:0 0 44px; width:44px; height:44px; border-radius:14px; background:var(--forest); color:var(--gold-light); display:flex; align-items:center; justify-content:center; box-shadow:var(--raise-xs); }
.cont-primary .rc-tx{ flex:1; min-width:0; }
.cont-primary .rc-tx b{ display:block; font-size:16px; font-weight:600; color:var(--text); }
.cont-primary .rc-tx span{ display:block; font-size:12.5px; color:var(--muted); margin-top:2px; }
.cont-primary .rc-go{ flex:0 0 auto; color:var(--gold-dark); display:flex; }
.cont-primary .rc-go svg{ transform:rotate(180deg); }
.cont-row{ display:grid; grid-template-columns:1fr 1fr; gap:11px; }
.cont-2{
  display:flex; align-items:center; justify-content:center; gap:10px; min-height:54px; padding:0 14px;
  border-radius:16px; background:var(--surface); box-shadow:var(--raise-sm); color:var(--forest);
  font-size:14.5px; font-weight:600; transition:box-shadow .14s ease, transform .12s ease;
}
.cont-2:hover{ transform:translateY(-1px); }
.cont-2:active{ box-shadow:var(--inset-sm); transform:translateY(0); }
.cont-2 .c2-ic{ display:flex; color:var(--gold-dark); }

/* ---- crisis screen ---- */
.crisis{ padding-top:8px; }
.crisis .lead{
  font-family:'Cormorant Garamond', serif; font-weight:600; font-size:clamp(28px,8vw,40px);
  color:var(--forest); margin:6px 0 8px; line-height:1.1;
}
.crisis .leadsub{ font-size:15px; color:var(--muted); line-height:1.5; margin:0 0 26px; max-width:46ch; }
.crisrow{
  display:flex; align-items:center; gap:16px; width:100%; text-align:left; text-decoration:none;
  border-radius:22px; background:var(--surface); box-shadow:var(--raise-sm); padding:20px; margin-bottom:14px;
  transition:box-shadow .15s, transform .12s;
}
.crisrow:hover{ transform:translateY(-1px); }
.crisrow:active{ box-shadow:var(--inset-sm); }
.crisrow .cic{ flex:0 0 46px; width:46px; height:46px; border-radius:16px; background:var(--forest-pale); box-shadow:var(--raise-xs); display:flex; align-items:center; justify-content:center; color:var(--forest); }
.crisrow .cname{ font-size:15.5px; font-weight:600; color:var(--text); }
.crisrow .ccontact{ font-size:14px; color:var(--gold-dark); font-weight:600; margin-top:2px; }
.crisrow .cnote{ font-size:12.5px; color:var(--muted); margin-top:3px; }

/* shared spacing */
.toppad{ height:6px; }

/* ---- studio voice tag + spinner ---- */
.voicetag{
  margin-left:auto; display:inline-flex; align-items:center; gap:6px; text-transform:none; letter-spacing:0;
  font-size:11.5px; font-weight:600; color:var(--gold-dark); padding:6px 12px; min-height:32px;
  border-radius:999px; background:var(--surface); box-shadow:var(--raise-xs); transition:box-shadow .15s, transform .12s;
}
.voicetag:hover{ transform:translateY(-1px); }
.voicetag:active{ box-shadow:var(--inset-sm); }
.seclabel.withtag::after{ display:none; }
.vspin{ width:16px; height:16px; border-radius:50%; border:2px solid rgba(155,122,46,.25); border-top-color:var(--gold-dark); animation:db-spin .7s linear infinite; display:inline-block; }
.vspin.dark{ border-color:rgba(45,74,62,.25); border-top-color:var(--forest); }
@keyframes db-spin{ to{ transform:rotate(360deg); } }

/* ---- modal ---- */
.modal-scrim{
  position:fixed; inset:0; z-index:80; background:rgba(40,34,24,.34); backdrop-filter:blur(3px);
  display:flex; align-items:flex-end; justify-content:center; padding:0;
}
@media (min-width:560px){ .modal-scrim{ align-items:center; padding:24px; } }
.modal{
  width:100%; max-width:480px; max-height:92vh; overflow-y:auto;
  background:var(--bg); border-radius:28px 28px 0 0; box-shadow:0 -10px 40px rgba(40,34,24,.3);
}
@media (min-width:560px){ .modal{ border-radius:28px; } }
@keyframes db-sheet{ from{ transform:translateY(40px); opacity:.4; } to{ transform:translateY(0); opacity:1; } }
.modal-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:24px 24px 16px; }
.modal-title{ font-family:'Cormorant Garamond',serif; font-weight:600; font-size:27px; line-height:1; color:var(--forest); }
.modal-eyebrow{ display:inline-flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--gold-dark); margin-bottom:9px; }
.modal-sub{ font-size:13px; color:var(--muted); margin-top:5px; }
.modal-x{ flex:0 0 38px; width:38px; height:38px; border-radius:50%; background:var(--surface); box-shadow:var(--raise-xs); display:flex; align-items:center; justify-content:center; color:var(--muted); }
.modal-x:active{ box-shadow:var(--inset-sm); }
.modal-body{ padding:0 24px calc(26px + env(safe-area-inset-bottom,0)); }
.modal-note{ font-size:13px; color:var(--muted); line-height:1.55; margin:0 0 20px; }
.modal-note a{ color:var(--gold-dark); font-weight:600; text-decoration:none; border-bottom:1px solid rgba(155,122,46,.4); }
.fld-label{ display:block; font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--light); margin-bottom:9px; }
.fld{
  width:100%; border:none; outline:none; border-radius:15px; background:var(--bg); box-shadow:var(--inset);
  padding:15px 16px; font-family:'DM Sans',sans-serif; font-size:15px; color:var(--text); letter-spacing:.03em;
}
.fld::placeholder{ color:var(--light); }
.voicelist{ display:flex; flex-direction:column; gap:9px; }
.voiceopt{
  display:flex; align-items:center; gap:13px; width:100%; text-align:left; padding:14px 15px;
  border-radius:16px; background:var(--surface); box-shadow:var(--raise-xs); transition:box-shadow .15s;
}
.voiceopt.on{ box-shadow:var(--inset-sm); background:var(--gold-pale); }
.vradio{ flex:0 0 22px; width:22px; height:22px; border-radius:50%; background:var(--bg); box-shadow:var(--inset-sm); display:flex; align-items:center; justify-content:center; color:var(--gold-dark); }
.voiceopt.on .vradio{ background:var(--gold); color:#3a2c0c; box-shadow:none; }
.vname{ display:block; font-size:15px; font-weight:600; color:var(--text); }
.vnote{ display:block; font-size:12.5px; color:var(--muted); margin-top:1px; }
.modal-err{ font-size:13px; color:var(--error); margin:14px 0 0; }
.modal-ok{ display:flex; align-items:center; gap:7px; font-size:13px; color:var(--success); font-weight:600; margin:14px 0 0; }
.modal-actions{ display:flex; gap:11px; margin-top:22px; }
.mbtn{
  flex:1; min-height:52px; border-radius:16px; font-size:15px; font-weight:600;
  display:flex; align-items:center; justify-content:center; gap:9px; transition:box-shadow .14s, transform .12s;
}
.mbtn.ghost{ background:var(--surface); color:var(--forest); box-shadow:var(--raise-sm); }
.mbtn.gold{ background:var(--gold); color:#3a2c0c; box-shadow:var(--gold-raise); }
.mbtn.ghost:active{ box-shadow:var(--inset-sm); }
.mbtn.gold:active{ box-shadow:var(--gold-press); }
.mbtn:disabled{ opacity:.5; }
.mbtn-remove{ display:block; width:100%; text-align:center; margin-top:14px; font-size:13px; color:var(--muted); padding:10px; }
.mbtn-remove:hover{ color:var(--error); }
.mbtn.full{ flex:1 1 100%; }

/* sign-in (auth) modal */
.auth-note{ font-size:12.5px; color:var(--muted); line-height:1.5; margin:14px 0 4px; }
.code-fld{ text-align:center; font-size:24px; font-weight:700; letter-spacing:.5em; padding-left:.5em; }
.auth-demo{ display:flex; align-items:center; gap:7px; font-size:12px; color:var(--gold-dark); background:var(--gold-pale); padding:9px 12px; border-radius:11px; margin-top:14px; }
.auth-demo b{ letter-spacing:.08em; }

/* admin enable toggle */
.admin-toggle{ display:flex; align-items:center; gap:14px; width:100%; text-align:left; margin-top:18px; padding:14px 15px; border-radius:16px; background:var(--surface); box-shadow:var(--raise-xs); transition:box-shadow .15s; }
.admin-toggle-track{ flex:0 0 46px; width:46px; height:28px; border-radius:999px; background:var(--bg); box-shadow:var(--inset-sm); position:relative; transition:background .2s; }
.admin-toggle-knob{ position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:50%; background:var(--light); box-shadow:var(--raise-xs); transition:transform .2s, background .2s; }
.admin-toggle.on .admin-toggle-track{ background:var(--forest); box-shadow:var(--forest-press); }
.admin-toggle.on .admin-toggle-knob{ transform:translateX(18px); background:var(--gold-light); }
.admin-toggle-title{ display:block; font-size:14px; font-weight:600; color:var(--text); }
.admin-toggle-note{ display:block; font-size:12px; color:var(--muted); margin-top:2px; }

/* member voice picker — preview button per row */
.voiceopt-pick{ flex:1; display:flex; align-items:center; gap:13px; text-align:left; }
.voiceopt-prev{ flex:0 0 38px; width:38px; height:38px; border-radius:50%; background:var(--bg); box-shadow:var(--inset-sm); display:flex; align-items:center; justify-content:center; color:var(--forest); transition:box-shadow .14s, transform .12s; }
.voiceopt-prev:active{ box-shadow:var(--raise-xs); transform:scale(.95); }
`;

/* ---------- tiny line icons (soft, minimal) ---------- */

/* ---------- shared Share sheet (used by every share button in the app) ----------
   One standardized component so verses, churches, and anything else share the
   same options + responsive behavior: bottom sheet on phone, centered dialog on
   tablet/desktop, with a native "More…" tile where the OS supports it.
   payload: { title, subtitle, monogram?, glyph?, text, blurb, url?, subject? } */

/* ---------- persistence ---------- */
const LS = 'db_state_v1';
function loadState() {
  try {return JSON.parse(localStorage.getItem(LS)) || {};} catch (e) {return {};}
}

/* ---------- brand header ---------- */
function BrandHeader({ minimal, onAdmin }) {
  const tapsRef = useRef({ n: 0, t: 0 });
  const secretTap = () => {
    if (!onAdmin) return;
    const now = Date.now();
    const s = tapsRef.current;
    s.n = now - s.t < 600 ? s.n + 1 : 1;
    s.t = now;
    if (s.n >= 5) {s.n = 0;onAdmin();}
  };
  return (
    <header className="brand">
      {!minimal &&
      <div className="eyebrow">
          <span className="ref">Proverbs 18:21</span> &mdash; Death and life are in the power of the tongue
        </div>
      }
      <div className="wm">Declare <em>&amp; Believe</em></div>
      <div className="tagline">Scripture to renew your mind</div>
    </header>);

}

/* ---------- footer (info pages + copyright) ---------- */
function Footer() {
  return (
    <footer className="dbfoot">
      <nav className="dbfoot-links">
        <a href="pages/privacy.html">Privacy</a>
        <a href="pages/terms.html">Terms &amp; Conditions</a>
        <a href="pages/contact.html">Contact</a>
        <a href="pages/about.html">About Us</a>
      </nav>
      <p className="dbfoot-copy">&copy; 2026 &middot; powered by <b>JC Kingdom Ventures</b></p>
    </footer>);

}

/* ---------- stat zone (mode C) ---------- */
function StatZone({ declaringToday, versesForMind }) {
  return (
    <section className="statzone">
      <h2>&ldquo;Death and life are in the power of the tongue.&rdquo;<span className="statzone-ref">Proverbs 18:21</span></h2>
      <div className="stattiles">
        <div className="stattile">
          <div className="num">{declaringToday.toLocaleString()}</div>
          <div className="cap">declaring truth today</div>
        </div>
        <div className="stattile f">
          <div className="num">{versesForMind}+</div>
          <div className="cap">verses for the battle of the mind</div>
        </div>
      </div>
    </section>);

}

/* ---------- entry card ---------- */
function EntryCard({ selected, onSelect, custom, onCustom, translation, onTranslation, onSubmit }) {
  const [shake, setShake] = useState(false);
  const [hint, setHint] = useState('');
  const valid = selected || custom.trim();

  const submit = () => {
    if (!valid) {
      setShake(true);setHint('Choose what fits, or write it in your own words.');
      setTimeout(() => setShake(false), 420);
      return;
    }
    onSubmit();
  };

  return (
    <section className="card entry">
      <h1>What are you struggling with today?</h1>
      <p className="subh">Choose what fits &mdash; or write it in your own words.</p>

      {DB_CATEGORIES.map((g) =>
      <div className="catgroup" key={g.cat}>
          <div className="catlabel">{g.cat}</div>
          <div className="chips">
            {g.items.map((it) =>
          <button
            key={it}
            className={'chip' + (selected === it ? ' sel' : '')}
            onClick={() => onSelect(selected === it ? null : it)}
            aria-pressed={selected === it}>
            
                <span className="dot" />{it}
              </button>
          )}
          </div>
        </div>
      )}

      <div className="well">
        <textarea
          value={custom}
          onChange={(e) => {onCustom(e.target.value);if (hint) setHint('');}}
          placeholder="Or describe what&rsquo;s on your heart&hellip;" />
        
      </div>

      <div className="transrow">
        <span className="translabel">Translation</span>
        <div className="tpills">
          {['NKJV', 'NLT', 'NIV'].map((t) =>
          <button key={t} className={'tpill' + (translation === t ? ' on' : '')} onClick={() => onTranslation(t)}>{t}</button>
          )}
        </div>
      </div>

      <div className="receive">
        <div className="receive-lead">Whatever you name, you&rsquo;ll receive</div>
        <div className="receive-items">
          <div className="receive-item">
            <span className="receive-ic"><Icon name="scripture" size={18} /></span>
            <span className="receive-lb">Scripture</span>
          </div>
          <div className="receive-item">
            <span className="receive-ic"><Icon name="flame" size={18} /></span>
            <span className="receive-lb">A mindset to overcome it</span>
          </div>
          <div className="receive-item">
            <span className="receive-ic"><Icon name="wave" size={18} /></span>
            <span className="receive-lb">&ldquo;I am&rdquo; declarations</span>
          </div>
          <div className="receive-item">
            <span className="receive-ic"><Icon name="pray" size={18} /></span>
            <span className="receive-lb">A personal prayer</span>
          </div>
        </div>
      </div>

      <button className={'cta' + (!valid ? ' disabled' : '') + (shake ? ' shake' : '')} onClick={submit}>
        <Icon name="cross" size={19} /> Receive the Word for this
      </button>
      {hint && <p className="hint">{hint}</p>}
    </section>);

}

/* ---------- bottom nav ---------- */
function BottomNav({ active, onHome, onScripture, onProfile, onJournal }) {
  return (
    <nav className="nav">
      <div className="navinner">
        <button className={'navitem' + (active === 'home' ? ' active' : '')} onClick={onHome}>
          <span className="ic"><Icon name="home" /></span><span className="nlabel">Home</span>
        </button>
        <button className={'navitem' + (active === 'scripture' ? ' active' : '')} onClick={onScripture}>
          <span className="ic"><Icon name="scripture" /></span><span className="nlabel">Bible</span>
        </button>
        <button className={'navitem' + (active === 'journal' ? ' active' : '')} onClick={onJournal}>
          <span className="ic"><Icon name="journal" /></span><span className="nlabel">Journal</span>
        </button>
        <button className={'navitem' + (active === 'profile' ? ' active' : '')} onClick={onProfile}>
          <span className="ic"><Icon name="profile" /></span><span className="nlabel">Profile</span>
        </button>
      </div>
    </nav>);

}

/* ---------- shared speaker hook (device + ElevenLabs cloud) ---------- */
function useSpeaker(voiceCfg) {
  const [speaking, setSpeaking] = useState(-1);
  const [loading, setLoading] = useState(-1);
  const supportsTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const voiceRef = useRef(null);
  const audioRef = useRef(null);
  const cacheRef = useRef({}); // { 'voiceId|text': objectURL }
  const cloudOn = !!(voiceCfg && voiceCfg.apiKey && voiceCfg.voiceId);

  // pick the warmest, most natural *device* voice (fallback engine)
  useEffect(() => {
    if (!supportsTTS) return;
    const PREFERRED = [
    'samantha', 'ava', 'allison', 'serena', 'zoe', 'nicky', // Apple enhanced/premium
    'aria', 'jenny', 'sonia', 'natural', // Microsoft natural
    'google us english', 'google uk english female', 'google', // Google
    'karen', 'moira', 'tessa', 'fiona' // other soft Apple voices
    ];
    const score = (v) => {
      const n = (v.name || '').toLowerCase();
      if (!/^en/i.test(v.lang)) return -1;
      let s = 0;
      if (/premium|enhanced|natural|neural/.test(n)) s += 40;
      PREFERRED.forEach((p, i) => {if (n.includes(p)) s += (PREFERRED.length - i) * 4;});
      if (v.localService === false) s += 6;
      return s;
    };
    const choose = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      // honor an explicit member choice if present, else auto-pick the warmest
      const wanted = voiceCfg && voiceCfg.deviceVoiceURI;
      if (wanted) {
        const match = voices.find((v) => v.voiceURI === wanted);
        if (match) {voiceRef.current = match;return;}
      }
      voiceRef.current = voices.slice().sort((a, b) => score(b) - score(a))[0];
    };
    choose();
    window.speechSynthesis.onvoiceschanged = choose;
    return () => {window.speechSynthesis.onvoiceschanged = null;};
  }, [supportsTTS, voiceCfg && voiceCfg.deviceVoiceURI]);

  const stopAll = () => {
    if (supportsTTS) window.speechSynthesis.cancel();
    if (audioRef.current) {audioRef.current.pause();audioRef.current = null;}
  };
  useEffect(() => () => stopAll(), []);

  const speakDevice = (i, text) => {
    if (!supportsTTS) return;
    window.speechSynthesis.cancel();
    const phrased = text.replace(/ — /g, '… ').replace(/, /g, ',  ');
    const u = new SpeechSynthesisUtterance(phrased);
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = 0.82;u.pitch = 1.02;u.volume = 1;
    u.onend = () => setSpeaking(-1);
    u.onerror = () => setSpeaking(-1);
    setSpeaking(i);window.speechSynthesis.speak(u);
  };

  const speakCloud = async (i, text) => {
    const key = voiceCfg.voiceId + '|' + text;
    try {
      let url = cacheRef.current[key];
      if (!url) {
        setLoading(i);
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceCfg.voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': voiceCfg.apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0.12, use_speaker_boost: true }
          })
        });
        if (!res.ok) throw new Error(res.status === 401 ? 'Invalid API key' : 'Voice error ' + res.status);
        url = URL.createObjectURL(await res.blob());
        cacheRef.current[key] = url;
      }
      setLoading(-1);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(-1);
      setSpeaking(i);
      await audio.play();
    } catch (e) {
      setLoading(-1);
      speakDevice(i, text); // graceful fallback to the device voice
    }
  };

  const speak = (i, text) => {
    if (speaking === i || loading === i) {stopAll();setSpeaking(-1);setLoading(-1);return;}
    stopAll();setSpeaking(-1);
    if (cloudOn) speakCloud(i, text);else
    speakDevice(i, text);
  };

  return { speak, speaking, loading, cloudOn };
}

/* ---------- results ---------- */
function Results({ struggle, content, translation, onBack, onNew, voiceCfg, studioActive, onOpenVoice, saved, onToggleVerse, onToggleDecl, onToggleMind, onTogglePrayer, onOpenVerse, onOpenBible, onOpenJournal }) {
  const { speak, speaking, loading, cloudOn } = useSpeaker(voiceCfg);
  // each struggle now carries three verses; fall back to the legacy single shape
  const verses = content.verses && content.verses.length ? content.verses : [{ ref: content.ref, ...(content.verse || {}) }];
  const mindSaved = saved.mindsets.some((m) => m.text === content.mindset);
  const prayerSaved = saved.prayers.some((p) => p.text === content.prayer);
  const isDeclSaved = (d) => saved.declarations.some((x) => x.text === d);
  // the primary verse anchors the "read the full chapter" transition
  const primary = verses[0] || {};
  const chapterLabel = (primary.ref || '').replace(/:.*$/, '');
  const readChapter = () => onOpenVerse && onOpenVerse({ ref: primary.ref, text: primary[translation] || primary.NKJV, translation, struggle });

  return (
    <div className="results">
      <button className="back" onClick={onBack}><Icon name="arrow" size={18} /> Back</button>

      <div className="res-intro">
        <div className="res-eyebrow">A word for you</div>
        <h1 className="res-head">Verses for {struggle}</h1>
        <p className="res-sub">Walk through this slowly &mdash; let the Scripture settle, sit with the reflection, speak the words aloud, then pray.</p>
      </div>

      <div className="journey">

        {/* 1 · Scripture — the anchor */}
        <section className="station st-scripture">
          <span className="st-node"><Icon name="scripture" size={20} /></span>
          <div className="st-label">Scripture for this</div>
          <div className="scripstack">
            {verses.map((vrs, i) => {
              const text = vrs[translation] || vrs.NKJV;
              const vSaved = saved.verses.some((v) => v.ref === vrs.ref && v.struggle === struggle);
              return (
                <div className="scripcard" key={vrs.ref + '-' + i}>
                  <button className={'savebtn onlight' + (vSaved ? ' on' : '')} onClick={() => onToggleVerse({ ref: vrs.ref, text, translation, struggle })} aria-label={vSaved ? 'Saved' : 'Save verse'} title={vSaved ? 'Saved' : 'Save verse'} {...i === 0 ? { 'data-comment-anchor': '00b9aacd1f-button-568-11' } : {}}>
                    <Icon name={vSaved ? 'bookmarkfill' : 'bookmark'} size={17} />
                  </button>
                  <div className="verse">&ldquo;{text}&rdquo;</div>
                  <button className="vref vref-link" onClick={() => onOpenVerse && onOpenVerse({ ref: vrs.ref, text, translation, struggle })} title="Read this in the Bible">
                    {vrs.ref} &middot; {translation}
                    <span className="vref-go"><Icon name="book" size={14} /></span>
                  </button>
                </div>);

            })}
          </div>
          {primary.ref &&
          <button className="readchapter" onClick={readChapter}>
              <span className="rc-ic"><Icon name="book" size={20} /></span>
              <span className="rc-tx">
                <b>Read the full chapter</b>
                <span>{chapterLabel} &mdash; see this verse in its full context</span>
              </span>
              <span className="rc-go"><Icon name="arrow" size={18} /></span>
            </button>
          }
        </section>

        {/* 2 · Mindset — reflection */}
        <section className="station st-mind">
          <span className="st-node"><Icon name="flame" size={19} /></span>
          <div className="st-label">Overcome This Mindset</div>
          <div className="mindcard">
            <button className={'savebtn onlight' + (mindSaved ? ' on' : '')} onClick={() => onToggleMind({ text: content.mindset, ref: content.ref, struggle })} aria-label={mindSaved ? 'Saved' : 'Save this mindset'} title={mindSaved ? 'Saved' : 'Save this mindset'}>
              <Icon name={mindSaved ? 'bookmarkfill' : 'bookmark'} size={16} />
            </button>
            <p>{content.mindset}</p>
          </div>
        </section>

        {/* 3 · Speak — empowering action */}
        <section className="station st-speak">
          <span className="st-node"><Icon name="wave" size={19} /></span>
          <div className="st-label withtag">
            Speak This Aloud
            <button className="voicetag" onClick={onOpenVoice}>
              <Icon name="wave" size={14} />
              {voiceCfg.voiceName}
            </button>
          </div>
          {content.declarations.map((d, i) => {
            const ds = isDeclSaved(d);
            return (
              <div key={i} className={'decl' + (speaking === i ? ' speaking' : '')}>
                <button className="decl-play" onClick={() => speak(i, d)} aria-label="Read aloud">
                  <span className="dtxt">{d}</span>
                  <span className="spk">
                    {loading === i ? <span className="vspin" /> : <Icon name={speaking === i ? 'pause' : 'play'} size={16} />}
                  </span>
                </button>
                <button className={'savebtn' + (ds ? ' on' : '')} onClick={() => onToggleDecl(d)} aria-label={ds ? 'Saved' : 'Save declaration'} title={ds ? 'Saved' : 'Save declaration'}>
                  <Icon name={ds ? 'bookmarkfill' : 'bookmark'} size={16} />
                </button>
              </div>);

          })}
        </section>

        {/* 4 · Prayer — intimate */}
        <section className="station st-prayer">
          <span className="st-node"><Icon name="pray" size={19} /></span>
          <div className="st-label">Your Prayer</div>
          <div className="prayer">
            <button className={'savebtn onlight' + (prayerSaved ? ' on' : '')} onClick={() => onTogglePrayer({ text: content.prayer, ref: content.ref, struggle })} aria-label={prayerSaved ? 'Saved' : 'Save this prayer'} title={prayerSaved ? 'Saved' : 'Save this prayer'}>
              <Icon name={prayerSaved ? 'bookmarkfill' : 'bookmark'} size={16} />
            </button>
            <p>{content.prayer.replace(/\sAmen\.$/, '')}<span className="amen">Amen.</span></p>
          </div>
        </section>

        {/* 5 · Continue in the Word — the bridge into deeper reading */}
        <section className="station st-continue">
          <span className="st-node"><Icon name="book" size={19} /></span>
          <div className="st-label">Continue in the Word</div>
          <div className="continue">
            <button className="cont-primary" onClick={readChapter}>
              <span className="rc-ic"><Icon name="book" size={20} /></span>
              <span className="rc-tx">
                <b>Read the Full Chapter</b>
                <span>{chapterLabel ? chapterLabel + ' — keep reading where this lives' : 'Open this passage in context'}</span>
              </span>
              <span className="rc-go"><Icon name="arrow" size={18} /></span>
            </button>
            <div className="cont-row">
              <button className="cont-2" onClick={onOpenBible}><span className="c2-ic"><Icon name="scripture" size={18} /></span>Open Bible</button>
              <button className="cont-2" onClick={onOpenJournal}><span className="c2-ic"><Icon name="journal" size={18} /></span>Open Journal</button>
            </div>
          </div>
        </section>

      </div>

      <button className="cta" onClick={onNew} style={{ marginTop: '30px' }}>
        <Icon name="arrow" size={18} style={{ transform: 'rotate(0)' }} /> Speak to a New Struggle
      </button>
    </div>);

}

/* ---------- crisis screen ---------- */
function CrisisScreen({ onBack }) {
  return (
    <div className="crisis">
      <button className="back" onClick={onBack}><Icon name="arrow" size={18} /> Back</button>
      <h1 className="lead">You Are Not Alone</h1>
      <p className="leadsub">If today feels like too much, please reach out. Someone is ready to listen &mdash; any hour, with no judgment.</p>
      {DB_CRISIS.map((c) =>
      <a className="crisrow" key={c.name} href={c.href}>
          <span className="cic"><Icon name="phone" size={22} /></span>
          <span>
            <span className="cname">{c.name}</span>
            <span className="ccontact" style={{ display: 'block' }}>{c.contact}</span>
            <span className="cnote" style={{ display: 'block' }}>{c.note}</span>
          </span>
        </a>
      )}
    </div>);

}

/* ---------- profile ---------- */
const DB_COUNTRIES = [
'🇺🇸 United States', '🇨🇦 Canada', '🇬🇧 United Kingdom', '🇦🇺 Australia',
'🇳🇬 Nigeria', '🇰🇪 Kenya', '🇿🇦 South Africa', '🇬🇭 Ghana',
'🇵🇭 Philippines', '🇮🇳 India', '🇯🇲 Jamaica', '🇹🇹 Trinidad & Tobago',
'🇧🇷 Brazil', '🇲🇽 Mexico', '🇩🇪 Germany', '🇫🇷 France', '🇳🇿 New Zealand', '🌍 Other'];


function Field({ label, children, note }) {
  return (
    <div className="pf-field">
      <div className="pf-flabel">{label}</div>
      <div className="pf-fbody">{children}{note && <div className="pf-fnote">{note}</div>}</div>
    </div>);

}

/* ---------- Unsplash banner background picker ---------- */
function UnsplashPicker({ current, onPick, onClose }) {
  const cats = DB_BACKGROUNDS || [];
  const [cat, setCat] = useState(cats[0] ? cats[0].cat : '');
  const active = cats.find((c) => c.cat === cat) || cats[0] || { photos: [] };
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal bg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Choose a background</div>
            <div className="modal-sub">Free photos from Unsplash.</div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="bg-cats">
            {cats.map((c) =>
            <button key={c.cat} className={'bg-cat' + (cat === c.cat ? ' on' : '')} onClick={() => setCat(c.cat)}>{c.cat}</button>
            )}
          </div>
          <div className="bg-grid">
            {active.photos.map((p) =>
            <button key={p.id} className={'bg-thumb' + (current === p.full ? ' on' : '')} onClick={() => onPick(p.full)} title={'Photo: ' + p.by}>
                <img src={p.thumb} alt="" loading="lazy" />
                {current === p.full && <span className="bg-check"><Icon name="check" size={16} /></span>}
              </button>
            )}
          </div>
          {current && <button className="mbtn-remove" onClick={() => onPick('')}>Remove background</button>}
          <p className="bg-foot">Photos provided by <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a>.</p>
        </div>
      </div>
    </div>);

}

function ProfileScreen({ profile, onSave, saved, onRemoveVerse, onRemoveDecl, onRemoveMind, onOpenVerse, account, studioActive, voiceName, onOpenVoice, theme, setTheme, myChurch, onOpenChurch, onBack }) {
  const [draft, setDraft] = useState(profile);
  const [tab, setTab] = useState('verses');
  // the email is "verified" only when it matches the signed-in, verified account
  const emailVerified = !!(account && account.verified && account.email && draft.email &&
  account.email.trim().toLowerCase() === draft.email.trim().toLowerCase());
  const [bannerUrl, setBannerUrl] = useState(() => localStorage.getItem('db_banner_url') || '');
  const [bgPicker, setBgPicker] = useState(false);
  const pickBanner = (url) => {setBannerUrl(url);if (url) localStorage.setItem('db_banner_url', url);else localStorage.removeItem('db_banner_url');setBgPicker(false);};
  const [toast, setToast] = useState(false);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  const counts = { verses: saved.verses.length, mindsets: saved.mindsets.length, declarations: saved.declarations.length };
  const fullName = [draft.firstName, draft.lastName].filter(Boolean).join(' ') || 'Your Name';

  const save = () => {onSave(draft);setToast(true);setTimeout(() => setToast(false), 2200);};
  const cancel = () => setDraft(profile);

  return (
    <div className="profile">
      {/* banner — user-customizable */}
      <div className="pf-banner">
        {bannerUrl ?
        <img className="pf-bannerimg" src={bannerUrl} alt="" /> :
        <div className="pf-bannerslot" />}
        <button className="pf-back" onClick={onBack} aria-label="Back"><Icon name="arrow" size={20} /></button>
        <button className="pf-bgbtn" onClick={() => setBgPicker(true)}><Icon name="camera" size={15} /> Background</button>
      </div>
      {bgPicker && <UnsplashPicker current={bannerUrl} onPick={pickBanner} onClose={() => setBgPicker(false)} />}

      {/* identity card */}
      <div className="pf-card">
        <div className="pf-toprow">
          <div className="pf-avatarwrap">
            <div className="pf-avatarslot" />
            {emailVerified && <span className="pf-verified" title="Verified"><Icon name="check" size={13} /></span>}
          </div>
        </div>

        <div className="pf-name">
          {fullName}
          <span className="pf-status"><span className="pf-dot" /> Declaring daily</span>
        </div>
        <div className="pf-email">{draft.email || 'you@email.com'}</div>

        <div className="pf-stats">
          <button className={'pf-stat' + (tab === 'verses' ? ' on' : '')} onClick={() => setTab('verses')}>
            <span className="pf-snum">{counts.verses}</span><span className="pf-scap">Verses</span>
          </button>
          <button className={'pf-stat' + (tab === 'mindsets' ? ' on' : '')} onClick={() => setTab('mindsets')}>
            <span className="pf-snum">{counts.mindsets}</span><span className="pf-scap">Mindsets</span>
          </button>
          <button className={'pf-stat' + (tab === 'declarations' ? ' on' : '')} onClick={() => setTab('declarations')}>
            <span className="pf-snum">{counts.declarations}</span><span className="pf-scap">Declarations</span>
          </button>
        </div>
      </div>

      {/* editable details */}
      <div className="pf-section-label">Your details</div>
      <div className="pf-fields">
        <Field label="Name">
          <div className="pf-namegrid">
            <input className="pf-input" value={draft.firstName} placeholder="First" onChange={(e) => set('firstName', e.target.value)} />
            <input className="pf-input" value={draft.lastName} placeholder="Last" onChange={(e) => set('lastName', e.target.value)} />
          </div>
        </Field>
        <Field label="Email address" note={emailVerified ? <span className="pf-verifrow"><Icon name="check" size={13} /> Verified</span> : null}>
          <input className="pf-input" type="email" value={draft.email} placeholder="you@email.com" onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Country">
          <div className="pf-selectwrap">
            <select className="pf-input pf-select" value={draft.country} onChange={(e) => set('country', e.target.value)}>
              {DB_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="pf-chev"><Icon name="arrow" size={16} /></span>
          </div>
        </Field>
        <Field label="YouVersion username" note="Connect with others on the YouVersion Bible App.">
          <div className="pf-username">
            <span className="pf-prefix">bible.com/</span>
            <input className="pf-input pf-uinput" value={draft.youversion} placeholder="username" onChange={(e) => set('youversion', e.target.value.replace(/\s/g, ''))} />
            {draft.youversion && <span className="pf-uverif"><Icon name="check" size={13} /></span>}
          </div>
        </Field>
      </div>

      {/* preferences */}
      <div className="pf-section-label">Preferences</div>
      <div className="pf-fields">
        <Field label="Read-aloud voice" note={studioActive ? 'A studio-quality narrator reads your verses, declarations, and prayers.' : 'Pick from the voices available on your device.'}>
          <button className="pf-voicerow" onClick={onOpenVoice}>
            <span className="pf-voicerow-l"><span className="pf-voiceic"><Icon name="wave" size={16} /></span><span className="pf-voicename">{voiceName}</span></span>
            <span className="pf-voicerow-change">Change</span>
          </button>
        </Field>
        <Field label="Appearance" note="Choose a light or dark look for the whole app.">
          <div className="pf-appearance">
            <button className={'pf-appbtn' + (theme === 'light' ? ' on' : '')} onClick={() => setTheme('light')}>
              <Icon name="sun" size={16} /> Light
            </button>
            <button className={'pf-appbtn' + (theme === 'dark' ? ' on' : '')} onClick={() => setTheme('dark')}>
              <Icon name="moon" size={15} /> Dark
            </button>
          </div>
        </Field>
        <Field label="My Church" note="Find a church near you and set it as your home church.">
          {myChurch ?
          <button className="pf-churchrow" onClick={onOpenChurch}>
                <span className="pf-churchic"><Icon name="building" size={17} /></span>
                <span className="pf-mychurch">
                  <span className="pf-mychurch-name">{myChurch.name}<span className="ch-badge"><Icon name="check" size={10} /> My Church</span></span>
                  <span className="pf-mychurch-city">{myChurch.city}</span>
                </span>
                <span className="pf-churchrow-change">Change</span>
              </button> :
          <button className="pf-churchrow" onClick={onOpenChurch}>
                <span className="pf-churchic"><Icon name="building" size={17} /></span>
                <span className="pf-churchadd">Add Your Church</span>
                <span className="pf-churchrow-change">Find</span>
              </button>}
        </Field>
      </div>

      {/* saved collections */}
      <div className="pf-section-label">
        {tab === 'verses' ? 'Saved verses' : tab === 'mindsets' ? 'Saved mindsets' : 'Saved declarations'}
      </div>

      {tab === 'verses' &&
      <div className="pf-list">
          {saved.verses.length === 0 && <div className="pf-empty"><Icon name="bookmark" size={20} /><p>No saved verses yet. Tap the bookmark on any scripture to keep it here.</p></div>}
          {saved.verses.map((v, i) =>
        <div className="pf-vcard" key={i}>
              <div className="pf-vtext">&ldquo;{v.text}&rdquo;</div>
              <div className="pf-vfoot">
                <button className="pf-vref pf-vref-link" onClick={() => onOpenVerse(v)} title="Open in the Bible reader">
                  {v.ref} &middot; {v.translation}
                  <span className="pf-vref-go"><Icon name="arrow" size={13} /></span>
                </button>
                <button className="pf-rm" onClick={() => onRemoveVerse(i)} aria-label="Remove"><Icon name="trash" size={16} /></button>
              </div>
            </div>
        )}
        </div>
      }

      {tab === 'mindsets' &&
      <div className="pf-list">
          {saved.mindsets.length === 0 && <div className="pf-empty"><Icon name="bookmark" size={20} /><p>No saved mindsets yet. Keep the truths that help you overcome a struggle.</p></div>}
          {saved.mindsets.map((m, i) =>
        <div className="pf-mcard" key={i}>
              <p className="pf-mtext">{m.text}</p>
              <div className="pf-mfoot">
                <span className="pf-mref">{m.struggle || m.ref}</span>
                <button className="pf-rm" onClick={() => onRemoveMind(i)} aria-label="Remove"><Icon name="trash" size={16} /></button>
              </div>
            </div>
        )}
        </div>
      }

      {tab === 'declarations' &&
      <div className="pf-list">
          {saved.declarations.length === 0 && <div className="pf-empty"><Icon name="bookmark" size={20} /><p>No saved declarations yet. Save the truths you want to speak over yourself.</p></div>}
          {saved.declarations.map((d, i) =>
        <div className={'pf-dcard' + (speaking === i ? ' speaking' : '')} key={i}>
              <button className="pf-dplay" onClick={() => speak(i, d.text)} aria-label="Read aloud">
                <span className="pf-dtxt">{d.text}</span>
                <span className="pf-spk">{loading === i ? <span className="vspin" /> : <Icon name={speaking === i ? 'pause' : 'play'} size={16} />}</span>
              </button>
              <button className="pf-rm" onClick={() => onRemoveDecl(i)} aria-label="Remove"><Icon name="trash" size={16} /></button>
            </div>
        )}
        </div>
      }

      {/* save / cancel */}
      <div className="pf-footer">
        {toast && <span className="pf-toast"><Icon name="check" size={14} /> Changes saved</span>}
        <button className="pf-btn ghost" onClick={cancel} disabled={!dirty}>Cancel</button>
        <button className="pf-btn gold" onClick={save} disabled={!dirty}>Save changes</button>
      </div>
    </div>);

}

/* ---------- journal ---------- */
function JournalScreen({ recent, journal, onAdd, onRemove, onEdit, prayers, onRemovePrayer, voiceCfg, onBack, canSave }) {
  const [view, setView] = useState('reflect');
  const [text, setText] = useState('');
  const [promptLabel, setPromptLabel] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const taRef = useRef(null);
  const { speak, speaking, loading } = useSpeaker(voiceCfg);

  const startEdit = (j) => {setEditingId(j.id);setEditText(j.text);};
  const cancelEdit = () => {setEditingId(null);setEditText('');};
  const saveEdit = (id) => {const t = editText.trim();if (!t) return;onEdit(id, t);setEditingId(null);setEditText('');};

  const ctx = recent && recent.content;
  const prompts = ctx ? [
  { label: 'The verse', seed: `Reading ${ctx.ref}, what stands out to me is ` },
  { label: 'The mindset', seed: 'The truth I most need to take in right now is ' },
  { label: 'A declaration', seed: 'The declaration I want to believe over myself today is ' },
  { label: 'The prayer', seed: 'After praying this, what I want to say back to God is ' },
  { label: 'Free write', seed: '' }] :
  [
  { label: 'On my heart', seed: 'What is on my heart today is ' },
  { label: 'Gratitude', seed: 'Something I am thankful for right now is ' },
  { label: 'A prayer', seed: 'God, today I am asking You for ' },
  { label: 'Free write', seed: '' }];


  const pick = (p) => {
    setPromptLabel(p.label === 'Free write' ? '' : p.label);
    setText(p.seed);
    requestAnimationFrame(() => {const ta = taRef.current;if (ta) {ta.focus();ta.setSelectionRange(ta.value.length, ta.value.length);}});
  };

  const add = () => {
    const t = text.trim();if (!t) return;
    // onAdd returns false when a sign-in is required — keep the draft in that case
    const ok = onAdd(t, { promptLabel, struggle: recent ? recent.struggle : '' });
    if (ok !== false) {setText('');setPromptLabel('');}
  };

  return (
    <div className="journal">
      <div className="jr-head">
        <h1 className="jr-title">Journal</h1>
        <p className="jr-sub">A quiet place to reflect and to return to prayer.</p>
      </div>

      <div className="jr-seg" role="tablist">
        <button className={'jr-segbtn' + (view === 'reflect' ? ' on' : '')} onClick={() => setView('reflect')}>Reflections</button>
        <button className={'jr-segbtn' + (view === 'prayers' ? ' on' : '')} onClick={() => setView('prayers')}>
          Prayers{prayers.length ? <span className="jr-segcount">{prayers.length}</span> : null}
        </button>
      </div>

      {view === 'reflect' && <>
      <div className="jr-compose">
        {recent &&
          <div className="jr-context">
            <span className="jr-ctxlabel">Reflecting on</span>
            <span className="jr-ctxname">{recent.struggle}</span>
          </div>}
        <div className="jr-promptlabel">What would you like to write about?</div>
        <div className="jr-prompts">
          {prompts.map((p) =>
            <button key={p.label} className={'jr-chip' + (promptLabel === p.label ? ' on' : '')} onClick={() => pick(p)}>{p.label}</button>
            )}
        </div>
        <textarea ref={taRef} className="jr-text" value={text}
          placeholder="Write freely — there are no wrong words here…"
          onChange={(e) => setText(e.target.value)} />
        <button className={'jr-add' + (text.trim() ? '' : ' off')} onClick={add}><Icon name={canSave ? 'plus' : 'lock'} size={17} /> {canSave ? 'Save entry' : 'Sign in to save'}</button>
        {!canSave &&
          <p className="jr-savehint"><Icon name="lock" size={12} /> Your reflections stay private &mdash; sign in to keep them safely on your profile.</p>}
      </div>

      <div className="jr-listlabel">{journal.length ? 'Past reflections' : ''}</div>
      <div className="jr-list">
        {journal.length === 0 &&
          <div className="pf-empty"><Icon name="journal" size={22} /><p>Your reflections will gather here. Start with a prompt above, or just write what&rsquo;s on your heart.</p></div>}
        {journal.map((j) =>
          <div className="jr-card" key={j.id}>
            <div className="jr-cardtop">
              <span className="jr-date">{j.date}</span>
              {(j.promptLabel || j.struggle) &&
              <span className="jr-tag">{[j.struggle, j.promptLabel].filter(Boolean).join(' · ')}</span>}
              {j.edited && <span className="jr-edited">edited</span>}
            </div>
            {editingId === j.id ?
            <div className="jr-edit">
                <textarea className="jr-text jr-edittext" value={editText} autoFocus
              onChange={(e) => setEditText(e.target.value)} />
                <div className="jr-editactions">
                  <button className="jr-editbtn ghost" onClick={cancelEdit}>Cancel</button>
                  <button className="jr-editbtn gold" onClick={() => saveEdit(j.id)} disabled={!editText.trim()}>
                    <Icon name="check" size={15} /> Save changes
                  </button>
                </div>
              </div> :
            <>
                <p className="jr-body">{j.text}</p>
                <div className="jr-cardactions">
                  {canSave &&
                <button className="jr-icbtn jr-editbtn-ic" onClick={() => startEdit(j)} aria-label="Edit entry"><Icon name="pencil" size={15} /></button>}
                  <button className="jr-icbtn jr-rm" onClick={() => onRemove(j.id)} aria-label="Remove"><Icon name="trash" size={16} /></button>
                </div>
              </>}
          </div>
          )}
      </div>
      </>}

      {view === 'prayers' && <>
      <div className="jr-listlabel">Prayers to return to</div>
      <div className="jr-list">
        {prayers.length === 0 &&
          <div className="pf-empty"><Icon name="bookmark" size={22} /><p>No saved prayers yet. On any results screen, tap the bookmark on the prayer to keep it here and pray it again.</p></div>}
        {prayers.map((p, i) =>
          <div className={'pf-pcard' + (speaking === 5000 + i ? ' speaking' : '')} key={i}>
            <div className="pf-pref">{p.struggle || p.ref}</div>
            <p className="pf-ptext">{p.text.replace(/\sAmen\.$/, '')}<span className="pf-amen">Amen.</span></p>
            <div className="pf-pfoot">
              <button className="pf-pplay" onClick={() => speak(5000 + i, p.text)} aria-label="Pray aloud">
                {loading === 5000 + i ? <span className="vspin" /> : <Icon name={speaking === 5000 + i ? 'pause' : 'play'} size={15} />}
                {speaking === 5000 + i ? 'Stop' : 'Pray aloud'}
              </button>
              <button className="pf-rm" onClick={() => onRemovePrayer(i)} aria-label="Remove"><Icon name="trash" size={16} /></button>
            </div>
          </div>
          )}
      </div>
      </>}
    </div>);
}

/* ---------- studio voice settings ---------- */
const DB_VOICES = [
{ id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', note: 'Soft, gentle — soothing and calm' },
{ id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', note: 'Warm, reassuring — like a friend' },
{ id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', note: 'Tender, unhurried — prayerful' },
{ id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', note: 'Calm, grounded — steady and clear' },
{ id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', note: 'Warm, mature — pastoral presence' }];


/* shared preview helper */
async function previewVoice(apiKey, voiceId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({ text: 'I am held, today and in all that is ahead.', model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0.12, use_speaker_boost: true } })
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'That key was not accepted.' : 'Error ' + res.status);
  const audio = new Audio(URL.createObjectURL(await res.blob()));
  await audio.play();
}

/* ADMIN-ONLY — configure the ElevenLabs key + default narrator for everyone.
   Reached via a hidden gesture (5 taps on the wordmark) or ?admin in the URL. */
function AdminVoiceModal({ cfg, onSave, onClose }) {
  const [key, setKey] = useState(cfg.apiKey || '');
  const [voiceId, setVoiceId] = useState(cfg.voiceId || DB_VOICES[0].id);
  const [enabled, setEnabled] = useState(cfg.enabled !== false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');

  const test = async () => {
    if (!key.trim()) {setStatus('Enter the API key first.');return;}
    setTesting(true);setStatus('');
    try {await previewVoice(key.trim(), voiceId);setStatus('ok');}
    catch (e) {setStatus(e.message || 'Could not reach the voice service.');}
    setTesting(false);
  };

  const save = () => {
    const v = DB_VOICES.find((x) => x.id === voiceId);
    onSave({ apiKey: key.trim(), voiceId, voiceName: v ? v.name : 'Studio voice', enabled });
  };
  const remove = () => onSave({ apiKey: '', voiceId: '', voiceName: '', enabled: false });

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow"><Icon name="lock" size={12} /> Admin only</div>
            <div className="modal-title">Studio voice setup</div>
            <div className="modal-sub">Configure the narrator everyone hears. This panel is not shown to members.</div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>

        <div className="modal-body">
          <p className="modal-note">
            Add your <a href="https://elevenlabs.io" target="_blank" rel="noopener">ElevenLabs</a> API key to give every
            member a studio-quality read-aloud voice. The key bills to your account &mdash; keep it private.
            It is stored on this device only and never shown to members.
          </p>

          <label className="fld-label">ElevenLabs API key</label>
          <input className="fld" type="password" value={key} placeholder="sk_&hellip;"
          onChange={(e) => {setKey(e.target.value);if (status) setStatus('');}} autoComplete="off" spellCheck="false" />

          <label className="fld-label" style={{ marginTop: '16px' }}>Default narrator</label>
          <div className="voicelist">
            {DB_VOICES.map((v) =>
            <button key={v.id} className={'voiceopt' + (voiceId === v.id ? ' on' : '')} onClick={() => setVoiceId(v.id)}>
                <span className="vradio">{voiceId === v.id && <Icon name="check" size={13} />}</span>
                <span><span className="vname">{v.name}</span><span className="vnote">{v.note}</span></span>
              </button>
            )}
          </div>

          <button className={'admin-toggle' + (enabled ? ' on' : '')} onClick={() => setEnabled((e) => !e)}>
            <span className="admin-toggle-track"><span className="admin-toggle-knob" /></span>
            <span>
              <span className="admin-toggle-title">Studio voice enabled for members</span>
              <span className="admin-toggle-note">{enabled ? 'Members hear the studio narrator.' : 'Members fall back to their device voice.'}</span>
            </span>
          </button>

          {status && status !== 'ok' && <p className="modal-err">{status}</p>}
          {status === 'ok' && <p className="modal-ok"><Icon name="check" size={14} /> Sounds good &mdash; that voice is ready.</p>}

          <div className="modal-actions">
            <button className="mbtn ghost" onClick={test} disabled={testing}>
              {testing ? <span className="vspin dark" /> : <Icon name="wave" size={16} />} Preview
            </button>
            <button className="mbtn gold" onClick={save} disabled={!key.trim()}>Save</button>
          </div>
          {cfg.apiKey && <button className="mbtn-remove" onClick={remove}>Remove key &amp; turn off studio voice</button>}
        </div>
      </div>
    </div>);

}

/* MEMBER-FACING — choose a preferred voice (no key, no billing).
   When studio voice is on, members pick from the curated narrators.
   When it's off, they pick from the voices their own device offers. */
function VoicePrefModal({ studioActive, adminVoice, pref, onSave, onClose }) {
  // device voices (only relevant when studio is off)
  const [deviceVoices, setDeviceVoices] = useState([]);
  useEffect(() => {
    if (studioActive || !('speechSynthesis' in window)) return;
    // classic novelty / robotic voices to hide — they undermine a reverent read-aloud
    const NOVELTY = ['albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester', 'organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'junior', 'princess', 'deranged', 'hysterical', 'pipe organ', 'ralph', 'fred', 'kathy', 'agnes', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley', 'eddy'];
    const PREFERRED = ['samantha', 'ava', 'allison', 'serena', 'zoe', 'nicky', 'aria', 'jenny', 'sonia', 'natural', 'google', 'karen', 'moira', 'tessa', 'fiona', 'daniel'];
    const score = (v) => {
      const n = (v.name || '').toLowerCase();
      let s = 0;
      if (/premium|enhanced|natural|neural/.test(n)) s += 40;
      PREFERRED.forEach((p, i) => {if (n.includes(p)) s += (PREFERRED.length - i) * 4;});
      if (v.localService === false) s += 6;
      return s;
    };
    const load = () => {
      const seen = new Set();
      const list = window.speechSynthesis.getVoices().
      filter((v) => /^en/i.test(v.lang)).
      filter((v) => !NOVELTY.some((bad) => (v.name || '').toLowerCase().includes(bad))).
      filter((v) => {const k = cleanVoiceName(v.name) + v.lang;if (seen.has(k)) return false;seen.add(k);return true;}).
      sort((a, b) => score(b) - score(a));
      setDeviceVoices(list);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {window.speechSynthesis.onvoiceschanged = null;};
  }, [studioActive]);

  const [voiceId, setVoiceId] = useState(pref.studioVoiceId || adminVoice.voiceId || DB_VOICES[0].id);
  const [deviceURI, setDeviceURI] = useState(pref.deviceVoiceURI || '');
  const [testing, setTesting] = useState('');

  const testStudio = async (id) => {
    setTesting(id);
    try {await previewVoice(adminVoice.apiKey, id);} catch (e) {/* silent for members */}
    setTesting('');
  };
  const testDevice = (v) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('I am held, today and in all that is ahead.');
    u.voice = v;u.rate = 0.82;u.pitch = 1.02;
    window.speechSynthesis.speak(u);
  };

  const save = () => {
    if (studioActive) {
      const v = DB_VOICES.find((x) => x.id === voiceId);
      onSave({ studioVoiceId: voiceId, studioVoiceName: v ? v.name : 'Studio voice' });
    } else {
      const v = deviceVoices.find((x) => x.voiceURI === deviceURI);
      onSave({ deviceVoiceURI: deviceURI, deviceVoiceName: v ? cleanVoiceName(v.name) : 'Device voice' });
    }
  };
  const canSave = studioActive ? !!voiceId : !!deviceURI;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Read-aloud voice</div>
            <div className="modal-sub">Choose the voice that reads your verses, declarations, and prayers.</div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>

        <div className="modal-body">
          {studioActive ?
          <div className="voicelist">
            {DB_VOICES.map((v) =>
            <div key={v.id} className={'voiceopt' + (voiceId === v.id ? ' on' : '')}>
                <button className="voiceopt-pick" onClick={() => setVoiceId(v.id)}>
                  <span className="vradio">{voiceId === v.id && <Icon name="check" size={13} />}</span>
                  <span><span className="vname">{v.name}</span><span className="vnote">{v.note}</span></span>
                </button>
                <button className="voiceopt-prev" onClick={() => testStudio(v.id)} aria-label={'Preview ' + v.name}>
                  {testing === v.id ? <span className="vspin dark" /> : <Icon name="play" size={15} />}
                </button>
              </div>
            )}
          </div> :
          <>
            {deviceVoices.length === 0 ?
            <div className="pf-empty"><Icon name="wave" size={20} /><p>Your device didn&rsquo;t report any voices. Read-aloud will still use its default voice.</p></div> :
            <div className="voicelist">
              {deviceVoices.map((v) =>
              <div key={v.voiceURI} className={'voiceopt' + (deviceURI === v.voiceURI ? ' on' : '')}>
                  <button className="voiceopt-pick" onClick={() => setDeviceURI(v.voiceURI)}>
                    <span className="vradio">{deviceURI === v.voiceURI && <Icon name="check" size={13} />}</span>
                    <span><span className="vname">{cleanVoiceName(v.name)}</span><span className="vnote">{voiceRegion(v.lang)}</span></span>
                  </button>
                  <button className="voiceopt-prev" onClick={() => testDevice(v)} aria-label={'Preview ' + v.name}>
                    <Icon name="play" size={15} />
                  </button>
                </div>
              )}
            </div>}
          </>}

          <div className="modal-actions">
            <button className="mbtn gold full" onClick={save} disabled={!canSave}>Use this voice</button>
          </div>
        </div>
      </div>
    </div>);

}

/* tidy up device-voice labels like "Microsoft Aria Online (Natural) - English (United States)" */
function cleanVoiceName(n) {
  return (n || 'Voice').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*-\s*English.*/i, '').replace(/^(Microsoft|Google|Apple)\s+/i, '').trim() || n;
}
function voiceRegion(lang) {
  const map = { 'en-us': 'American English', 'en-gb': 'British English', 'en-au': 'Australian English', 'en-in': 'Indian English', 'en-ca': 'Canadian English', 'en-ie': 'Irish English', 'en-za': 'South African English', 'en-nz': 'New Zealand English' };
  return map[(lang || '').toLowerCase()] || 'English';
}

/* ---------- sign-in (magic link / code) — required to save a church ---------- */
function AuthModal({ church, purpose, onVerified, onClose }) {
  const [step, setStep] = useState('email'); // email | code
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState('');
  const [entered, setEntered] = useState('');
  const [err, setErr] = useState('');
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  // copy adapts to what the member is trying to save
  const emailSub = purpose ? purpose.sub :
  <>To save {church ? <b>{church.name}</b> : 'a church'} as yours, verify your email.</>;
  const note = purpose ? purpose.note :
  'Saving your church keeps it on your profile and lets friends find where you worship. We’ll only use your email to sign you in.';

  const send = () => {
    if (!valid) {setErr('Enter a valid email address.');return;}
    const c = String(Math.floor(100000 + Math.random() * 900000));
    setSent(c);setStep('code');setErr('');
  };
  const verify = () => {
    if (entered.replace(/\s/g, '') === sent) {onVerified(email.trim());} else
    {setErr('That code didn’t match. Try again.');}
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{step === 'email' ? 'Create your account' : 'Check your email'}</div>
            <div className="modal-sub">{step === 'email' ?
              emailSub :
              <>We sent a 6-digit code and a magic link to <b>{email}</b>.</>}</div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>

        <div className="modal-body">
          {step === 'email' && <>
            <label className="fld-label">Email address</label>
            <input className="fld" type="email" value={email} placeholder="you@email.com" autoComplete="email"
            onChange={(e) => {setEmail(e.target.value);if (err) setErr('');}} onKeyDown={(e) => e.key === 'Enter' && send()} />
            {err && <p className="modal-err">{err}</p>}
            <p className="auth-note">{note}</p>
            <div className="modal-actions">
              <button className="mbtn gold full" onClick={send} disabled={!valid}>Send my code</button>
            </div>
          </>}

          {step === 'code' && <>
            <label className="fld-label">Enter the 6-digit code</label>
            <input className="fld code-fld" inputMode="numeric" maxLength="6" value={entered} placeholder="••••••"
            onChange={(e) => {setEntered(e.target.value.replace(/[^0-9]/g, ''));if (err) setErr('');}} onKeyDown={(e) => e.key === 'Enter' && verify()} autoFocus />
            {err && <p className="modal-err">{err}</p>}
            <div className="auth-demo"><Icon name="lock" size={13} /> Demo: no real email is sent. Your code is <b>{sent}</b>.</div>
            <div className="modal-actions">
              <button className="mbtn ghost" onClick={() => onVerified(email.trim())}>Use magic link</button>
              <button className="mbtn gold" onClick={verify} disabled={entered.length < 6}>Verify</button>
            </div>
            <button className="mbtn-remove" onClick={() => setStep('email')}>Use a different email</button>
          </>}
        </div>
      </div>
    </div>);

}

/* ---------- app ---------- */
function App() {
  const saved = loadState();
  const [screen, setScreen] = useState(saved.screen === 'results' && saved.activeStruggle ? 'results' : 'dashboard');
  const [selected, setSelected] = useState(saved.selected || null);
  const [custom, setCustom] = useState(saved.custom || '');
  const [translation, setTranslation] = useState(saved.translation || 'NKJV');
  const [active, setActive] = useState(saved.activeStruggle || null);

  // app-wide appearance: light/dark theme + reading brightness
  const [theme, setThemeRaw] = useState(() => localStorage.getItem('db_theme') || 'light');
  const [brightness, setBrightnessRaw] = useState(() => parseInt(localStorage.getItem('db_brightness') || '100', 10));
  const setTheme = (t) => {setThemeRaw(t);localStorage.setItem('db_theme', t);};
  const setBrightness = (b) => {setBrightnessRaw(b);localStorage.setItem('db_brightness', String(b));};

  const [myChurch, setMyChurchRaw] = useState(() => {try {return JSON.parse(localStorage.getItem('db_my_church') || 'null');} catch (e) {return null;}});
  const persistMyChurch = (c) => {setMyChurchRaw(c);if (c) localStorage.setItem('db_my_church', JSON.stringify(c));else localStorage.removeItem('db_my_church');};
  const [account, setAccountRaw] = useState(() => {try {return JSON.parse(localStorage.getItem('db_account') || 'null');} catch (e) {return null;}});
  const isAuthed = !!(account && account.verified);
  // generic sign-in request: { church?, purpose?, after?: ()=>void }
  const [authReq, setAuthReq] = useState(null);
  const [journalNonce, setJournalNonce] = useState(0); // remount Journal compose after a gated save
  // saving a church requires a verified account; otherwise open the sign-in flow
  const setMyChurch = (c) => {
    if (!c) {persistMyChurch(null);return;}
    if (isAuthed) {persistMyChurch(c);} else
    {setAuthReq({ church: c, after: () => persistMyChurch(c) });}
  };
  // gated journal save — returns false (so the compose keeps its draft) when
  // the member needs to sign in first; the entry is saved on verification.
  const JOURNAL_PURPOSE = {
    sub: <>Your reflections are private. Verify your email to save them to your profile.</>,
    note: 'Your journal stays private to you. We only use your email to sign you in and keep your reflections synced.' };
  const requestJournalSave = (text, meta) => {
    if (isAuthed) {addJournal(text, meta);return true;}
    setAuthReq({ purpose: JOURNAL_PURPOSE, after: () => {addJournal(text, meta);setJournalNonce((n) => n + 1);} });
    return false;
  };
  const onVerified = (email) => {
    const acct = { email, verified: true };
    setAccountRaw(acct);localStorage.setItem('db_account', JSON.stringify(acct));
    // reflect the verified email on the profile (only fill if not already set)
    setProfile((p) => {const next = { ...p, email: p.email && p.email.trim() ? p.email : email };localStorage.setItem('db_profile', JSON.stringify(next));return next;});
    if (authReq && authReq.after) {authReq.after();}
    setAuthReq(null);
  };
  const goChurch = () => {setScreen('church');window.scrollTo({ top: 0, behavior: 'instant' });};
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('theme-dark');else root.classList.remove('theme-dark');
  }, [theme]);
  // Brightness: a single fixed, non-interactive overlay that both dims (alpha
  // over black) and brightens (screen-blend a warm light). Sits above all
  // content/modals so the whole UI responds. Avoids CSS filter on an ancestor,
  // which would break the fixed bottom nav & modal positioning.
  useEffect(() => {
    let el = document.getElementById('db-dim');
    if (brightness === 100) {if (el) el.remove();return;}
    if (!el) {
      el = document.createElement('div');el.id = 'db-dim';
      el.style.cssText = 'position:fixed;inset:0;z-index:9000;pointer-events:none;transition:opacity .15s, background .15s;';
      document.body.appendChild(el);
    }
    if (brightness < 100) {
      el.style.mixBlendMode = 'normal';
      el.style.background = '#0c0a06';
      el.style.opacity = String((100 - brightness) / 100 * 0.85);
    } else {
      el.style.mixBlendMode = 'screen';
      el.style.background = '#6f6346';
      el.style.opacity = String((brightness - 100) / 40 * 0.6);
    }
    return () => {};
  }, [brightness]);

  // Desktop top-nav auto-hide: fade the bar up/out while scrolling down,
  // bring it back on scroll-up or near the top. Toggles a body class so the
  // CSS effect can be gated to desktop only (bottom nav on touch stays put).
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const apply = () => {
      const y = window.scrollY;
      let hide;
      if (y < 70) hide = false; // near top → always show
      else if (y > last + 5) hide = true; // scrolling down
      else if (y < last - 5) hide = false; // scrolling up
      else hide = document.body.classList.contains('nav-down');
      document.body.classList.toggle('nav-down', hide);
      last = y;
      ticking = false;
    };
    const onScroll = () => {if (!ticking) {ticking = true;requestAnimationFrame(apply);}};
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // any screen change resets to top → make sure the bar is visible again
  useEffect(() => {document.body.classList.remove('nav-down');}, [screen]);

  // ADMIN config (key + default narrator), migrated from the old single key store
  const [adminVoice, setAdminVoice] = useState(() => {
    try {
      const a = JSON.parse(localStorage.getItem('db_admin_voice') || 'null');
      if (a) return a;
      const legacy = JSON.parse(localStorage.getItem('db_voice') || 'null');
      if (legacy && legacy.apiKey) return { ...legacy, enabled: true };
    } catch (e) {}
    return { apiKey: '', voiceId: '', voiceName: '', enabled: false };
  });
  // MEMBER preference — which narrator they like (no key)
  const [voicePref, setVoicePref] = useState(() => {
    try {return JSON.parse(localStorage.getItem('db_voice_pref') || '{}');} catch (e) {return {};}
  });
  const [showAdmin, setShowAdmin] = useState(false);
  const [showVoicePref, setShowVoicePref] = useState(false);

  // effective config handed to the speaker: studio only if admin enabled + key present
  const studioActive = !!(adminVoice.enabled && adminVoice.apiKey);
  const voiceCfg = studioActive ?
  {
    apiKey: adminVoice.apiKey,
    voiceId: voicePref.studioVoiceId || adminVoice.voiceId,
    voiceName: voicePref.studioVoiceName || adminVoice.voiceName || 'Studio voice'
  } :
  {
    apiKey: '',
    deviceVoiceURI: voicePref.deviceVoiceURI || '',
    voiceName: voicePref.deviceVoiceName || 'Device voice'
  };

  const [profile, setProfile] = useState(() => {
    const base = { firstName: '', lastName: '', email: '', country: '🇺🇸 United States', youversion: '' };
    try {return Object.assign(base, JSON.parse(localStorage.getItem('db_profile') || '{}'));} catch (e) {return base;}
  });
  const [savedItems, setSavedItems] = useState(() => {
    const base = { verses: [], mindsets: [], declarations: [], prayers: [], journal: [] };
    try {return Object.assign(base, JSON.parse(localStorage.getItem('db_saved') || '{}'));} catch (e) {return base;}
  });
  const persistSaved = (next) => {setSavedItems(next);localStorage.setItem('db_saved', JSON.stringify(next));};
  const saveProfile = (p) => {setProfile(p);localStorage.setItem('db_profile', JSON.stringify(p));};

  const toggleVerse = (v) => {
    const exists = savedItems.verses.some((x) => x.ref === v.ref && x.struggle === v.struggle);
    const verses = exists ? savedItems.verses.filter((x) => !(x.ref === v.ref && x.struggle === v.struggle)) : [v, ...savedItems.verses];
    persistSaved({ ...savedItems, verses });
  };
  const toggleDecl = (text) => {
    const exists = savedItems.declarations.some((x) => x.text === text);
    const declarations = exists ? savedItems.declarations.filter((x) => x.text !== text) : [{ text }, ...savedItems.declarations];
    persistSaved({ ...savedItems, declarations });
  };
  const toggleMind = (m) => {
    const exists = savedItems.mindsets.some((x) => x.text === m.text);
    const mindsets = exists ? savedItems.mindsets.filter((x) => x.text !== m.text) : [m, ...savedItems.mindsets];
    persistSaved({ ...savedItems, mindsets });
  };
  const togglePrayer = (p) => {
    const exists = savedItems.prayers.some((x) => x.text === p.text);
    const prayers = exists ? savedItems.prayers.filter((x) => x.text !== p.text) : [p, ...savedItems.prayers];
    persistSaved({ ...savedItems, prayers });
  };
  const removeVerse = (i) => persistSaved({ ...savedItems, verses: savedItems.verses.filter((_, j) => j !== i) });
  const removeMind = (i) => persistSaved({ ...savedItems, mindsets: savedItems.mindsets.filter((_, j) => j !== i) });
  const removePrayer = (i) => persistSaved({ ...savedItems, prayers: savedItems.prayers.filter((_, j) => j !== i) });
  const removeDecl = (i) => persistSaved({ ...savedItems, declarations: savedItems.declarations.filter((_, j) => j !== i) });
  const addJournal = (text, meta) => {
    const entry = { id: Date.now(), date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), text, ...(meta || {}) };
    persistSaved({ ...savedItems, journal: [entry, ...savedItems.journal] });
  };
  const removeJournal = (id) => persistSaved({ ...savedItems, journal: savedItems.journal.filter((j) => j.id !== id) });
  const editJournal = (id, text) => persistSaved({ ...savedItems, journal: savedItems.journal.map((j) => j.id === id ? { ...j, text, edited: true } : j) });

  const goJournal = () => {setScreen('journal');window.scrollTo({ top: 0, behavior: 'instant' });};

  const goProfile = () => {setScreen('profile');window.scrollTo({ top: 0, behavior: 'instant' });};

  const goScripture = () => {setScreen('scripture');window.scrollTo({ top: 0, behavior: 'instant' });};

  // deep-link a saved verse into the Bible reader at its book + chapter
  const [scriptureTarget, setScriptureTarget] = useState(null);
  const goScriptureVerse = (v) => {
    const m = (v.ref || '').match(/^(.*)\s(\d+):(\d+)$/);
    if (m) setScriptureTarget({ book: m[1], chapter: parseInt(m[2], 10), verse: parseInt(m[3], 10) });
    setScreen('scripture');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const saveAdminVoice = (cfg) => {
    setAdminVoice(cfg);
    localStorage.setItem('db_admin_voice', JSON.stringify(cfg));
    setShowAdmin(false);
  };
  const saveVoicePref = (partial) => {
    const next = { ...voicePref, ...partial };
    setVoicePref(next);
    localStorage.setItem('db_voice_pref', JSON.stringify(next));
    setShowVoicePref(false);
  };

  // hidden admin access: ?admin in URL, or 5 taps on the wordmark
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.has('admin')) setShowAdmin(true);
    } catch (e) {}
  }, []);

  // dynamic stat placeholders (gently animate up on mount)
  const [declaringToday, setDeclaringToday] = useState(12408);
  const versesForMind = 340;
  useEffect(() => {
    const target = 12408 + Math.floor(Math.random() * 600);
    let n = 12180;const id = setInterval(() => {
      n += Math.ceil((target - n) / 8);
      if (n >= target) {n = target;clearInterval(id);}
      setDeclaringToday(n);
    }, 60);
    return () => clearInterval(id);
  }, []);

  // persist
  useEffect(() => {
    localStorage.setItem(LS, JSON.stringify({ screen, selected, custom, translation, activeStruggle: active }));
  }, [screen, selected, custom, translation, active]);

  // inject styles once
  useEffect(() => {
    if (document.getElementById('db-css')) return;
    const el = document.createElement('style');el.id = 'db-css';el.textContent = DB_CSS;
    document.head.appendChild(el);
  }, []);

  const goResults = () => {
    const struggle = custom.trim() ? custom.trim() : selected;
    setActive(struggle);
    setScreen('results');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const resetToEntry = () => {
    setSelected(null);setCustom('');
    setActive(null);setScreen('dashboard');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const backToDash = () => {setScreen('dashboard');window.scrollTo({ top: 0, behavior: 'instant' });};

  // resolve content for the active struggle
  const content = active ? DB_CONTENT[active] || DB_DEFAULT : DB_DEFAULT;

  const openVoicePref = () => setShowVoicePref(true);
  const voiceModals =
  <>
      {showAdmin && <AdminVoiceModal cfg={adminVoice} onSave={saveAdminVoice} onClose={() => setShowAdmin(false)} />}
      {showVoicePref && <VoicePrefModal studioActive={studioActive} adminVoice={adminVoice} pref={voicePref} onSave={saveVoicePref} onClose={() => setShowVoicePref(false)} />}
    </>;

  const authModal = authReq &&
  <AuthModal church={authReq.church} purpose={authReq.purpose} onVerified={onVerified} onClose={() => setAuthReq(null)} />;


  if (screen === 'results') {
    return (
      <div className="app">
        <Results struggle={active} content={content} translation={translation} onBack={backToDash} onNew={resetToEntry}
        voiceCfg={voiceCfg} studioActive={studioActive} onOpenVoice={openVoicePref}
        saved={savedItems} onToggleVerse={toggleVerse} onToggleDecl={toggleDecl} onToggleMind={toggleMind} onTogglePrayer={togglePrayer}
        onOpenVerse={goScriptureVerse} onOpenBible={goScripture} onOpenJournal={goJournal} />
        <BottomNav active="home" onHome={resetToEntry} onScripture={goScripture} onProfile={goProfile} onJournal={goJournal} />
        {voiceModals}
      </div>);

  }

  if (screen === 'scripture') {
    return (
      <div className="app">
        <ScriptureScreen savedVerses={savedItems.verses} onToggleVerse={toggleVerse} onBack={backToDash}
        theme={theme} setTheme={setTheme} brightness={brightness} setBrightness={setBrightness}
        openTarget={scriptureTarget} onTargetConsumed={() => setScriptureTarget(null)} />
        <BottomNav active="scripture" onHome={backToDash} onScripture={goScripture} onProfile={goProfile} onJournal={goJournal} />
        {voiceModals}
      </div>);

  }

  if (screen === 'journal') {
    return (
      <div className="app">
        <JournalScreen
          key={'jr' + journalNonce}
          recent={active ? { struggle: active, content } : null}
          journal={savedItems.journal} onAdd={requestJournalSave} onRemove={removeJournal} onEdit={editJournal}
          prayers={savedItems.prayers} onRemovePrayer={removePrayer} voiceCfg={voiceCfg} onBack={backToDash}
          canSave={isAuthed} />
        <BottomNav active="journal" onHome={backToDash} onScripture={goScripture} onProfile={goProfile} onJournal={goJournal} />
        {voiceModals}
        {authModal}
      </div>);

  }

  if (screen === 'church') {
    return (
      <div className="app">
        <ChurchScreen myChurch={myChurch} account={account} onSet={setMyChurch} onUnset={() => setMyChurch(null)} onBack={goProfile} />
        <BottomNav active="profile" onHome={backToDash} onScripture={goScripture} onProfile={goProfile} onJournal={goJournal} />
        {voiceModals}
        {authModal}
      </div>);

  }

  if (screen === 'profile') {
    return (
      <div className="app">
        <ProfileScreen
          profile={profile} onSave={saveProfile} saved={savedItems} account={account}
          onRemoveVerse={removeVerse} onRemoveDecl={removeDecl} onRemoveMind={removeMind} onOpenVerse={goScriptureVerse}
          studioActive={studioActive} voiceName={voiceCfg.voiceName} onOpenVoice={openVoicePref} theme={theme} setTheme={setTheme}
          myChurch={myChurch} onOpenChurch={goChurch} onBack={backToDash} />
        <BottomNav active="profile" onHome={backToDash} onScripture={goScripture} onProfile={goProfile} onJournal={goJournal} />
        {voiceModals}
      </div>);

  }

  if (screen === 'crisis') {
    return (
      <div className="app">
        <CrisisScreen onBack={backToDash} />
        <BottomNav active="profile" onHome={backToDash} onScripture={goScripture} onProfile={goProfile} onJournal={goJournal} />
        {voiceModals}
      </div>);

  }

  // dashboard
  return (
    <div className="app">
      <BrandHeader minimal={true} onAdmin={() => setShowAdmin(true)} />

      <EntryCard
        selected={selected} onSelect={setSelected}
        custom={custom} onCustom={setCustom}
        translation={translation} onTranslation={setTranslation}
        onSubmit={goResults} />

      <StatZone declaringToday={declaringToday} versesForMind={versesForMind} />

      <button className="notalone" onClick={() => setScreen('crisis')}>
        <span className="heart" /> In crisis? <b>You are not alone</b> &mdash; find support
      </button>

      <Footer />

      <BottomNav active="home" onHome={backToDash} onScripture={goScripture} onProfile={goProfile} onJournal={goJournal} />
      {voiceModals}
    </div>);

}

export default App;