/* ============================================================
   Declare — CardStudio  (window.CardStudio)
   Compose a shareable card for a verse / declaration / journey.
     CardStudio.open({ type, text, reference, attribution, onShare })
   Exports a real PNG (html-to-image) sized to the chosen format.
   ============================================================ */
(function(){
  /* ---- formats: where it's going + true pixel size ---- */
  var FORMATS = [
    { id:'square',  w:1080, h:1080, l:'Square',    d:'Instagram & Facebook post · Threads' },
    { id:'story',   w:1080, h:1920, l:'Story',     d:'IG / FB Story · TikTok · Reels' },
    { id:'land',    w:1600, h:900,  l:'Landscape', d:'X (Twitter) · header' }
  ];

  /* ---- cinematic backgrounds (brand atmospheres) ---- */
  var BG = [
    { id:'dawn',   css:'linear-gradient(165deg,#2c4b3b 0%,#16271d 55%,#0c130f 100%)' },
    { id:'ember',  css:'linear-gradient(165deg,#3b3018 0%,#241a0c 60%,#100b05 100%)' },
    { id:'night',  css:'linear-gradient(165deg,#1c2a3a 0%,#111b27 55%,#080d13 100%)' },
    { id:'rose',   css:'linear-gradient(165deg,#3d2630 0%,#241420 58%,#120a10 100%)' },
    { id:'olive',  css:'linear-gradient(165deg,#33402a 0%,#1c2417 56%,#0c1009 100%)' },
    { id:'royal',  css:'linear-gradient(165deg,#2c2547 0%,#191430 56%,#0c0a18 100%)' },
    { id:'gold',   css:'linear-gradient(165deg,#7a6224 0%,#3f3115 55%,#191205 100%)' },
    { id:'slate',  css:'linear-gradient(165deg,#33373b 0%,#1d2023 56%,#0c0e0f 100%)' }
  ];

  /* ---- six on-brand fonts ---- */
  var FONTS = [
    { id:'cormorant', fam:"'Cormorant Garamond', serif", w:600, l:'Cormorant', samp:'Aa' },
    { id:'playfair',  fam:"'Playfair Display', serif",   w:600, l:'Playfair',  samp:'Aa' },
    { id:'spectral',  fam:"'Spectral', serif",           w:500, l:'Spectral',  samp:'Aa' },
    { id:'dmsans',    fam:"'DM Sans', sans-serif",       w:600, l:'DM Sans',   samp:'Aa' },
    { id:'oswald',    fam:"'Oswald', sans-serif",        w:600, l:'Oswald',    samp:'Aa' },
    { id:'caveat',    fam:"'Caveat', cursive",           w:600, l:'Caveat',    samp:'Aa' }
  ];

  var TONES = [
    { id:'light', q:'#ffffff', r:'rgba(255,255,255,.86)' },
    { id:'gold',  q:'#F4E2B0', r:'rgba(244,226,176,.85)' }
  ];

  /* ---- fallback content libraries (used by "Surprise / AI") ---- */
  var VERSES = [
    { text:'Be still, and know that I am God.', ref:'Psalm 46:10' },
    { text:'The Lord is my light and my salvation; whom shall I fear?', ref:'Psalm 27:1' },
    { text:'I can do all things through Christ who strengthens me.', ref:'Philippians 4:13' },
    { text:'Weeping may endure for a night, but joy comes in the morning.', ref:'Psalm 30:5' },
    { text:'Cast all your anxiety on Him, because He cares for you.', ref:'1 Peter 5:7' }
  ];
  var DECLS = [
    'I am fearfully and wonderfully made, and deeply loved by God.',
    'I am not anxious, for the peace of God guards my heart and mind.',
    'I am chosen, redeemed, and called by name.',
    'I walk in strength today, for the joy of the Lord is my strength.',
    'I am a new creation; the old has gone and the new has come.'
  ];

  var ICONS = {
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    shuffle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7M21 16v5h-5M15 15l6 6M3 3l6 6"/></svg>',
    spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
    upload:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>',
    dl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>',
    share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 3v13M8 7l4-4 4 4"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    aL:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h13"/></svg>',
    aC:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h16M7 12h10M5 18h14"/></svg>'
  };
  var SOCIAL = [
    { id:'instagram', l:'Instagram', fmt:'story', ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4a3.7 3.7 0 0 1-1.4-.9 3.7 3.7 0 0 1-.9-1.4c-.2-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1a3.5 3.5 0 0 0-.8-1.3 3.5 3.5 0 0 0-1.3-.8c-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 8a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm6.3-8.2a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0z"/></svg>' },
    { id:'tiktok', l:'TikTok', fmt:'story', ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.3 2.1 1.5 3.5 3.5 3.7v2.4c-1.2.1-2.3-.3-3.5-1v6.2c0 3.6-2.6 5.7-5.6 5.7-2.9 0-5-2-5-4.9 0-3 2.3-5 5.4-4.7v2.5c-.4-.1-.9-.2-1.3-.1-1.1.2-1.9 1-1.8 2.3.1 1.2 1 2 2.2 2 1.3 0 2.1-1 2.1-2.6V3h3.5z"/></svg>' },
    { id:'x', l:'X', fmt:'land', ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2H21l-6.4 7.3L22 22h-6.8l-4.7-6.2L4.9 22H2l7-7.9L2 2h6.9l4.3 5.7L18.2 2z"/></svg>' },
    { id:'facebook', l:'Facebook', fmt:'square', ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>' },
    { id:'threads', l:'Threads', fmt:'square', ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.7 11.2c-.1 0-.2-.1-.2-.1-.2-2.6-1.6-4.1-4-4.1-1.4 0-2.6.6-3.3 1.7l1.3.9c.5-.8 1.3-1 2-1 .9 0 1.5.3 1.9.8.3.4.5.9.5 1.5-.7-.1-1.4-.2-2.2-.1-2.2.1-3.6 1.4-3.5 3.1.1 1.7 1.6 2.6 3.2 2.5 1.4-.1 2.4-.7 3-1.7.4.6.6 1.4.6 2.3 0 .1 0 .2 0 .2 0 2.1-1.7 3.8-4.3 3.8-2.9 0-4.7-2-4.7-5.6 0-3.7 1.9-5.8 4.8-5.8 2.4 0 4 1.2 4.6 3.1l1.7-.5c-.8-2.6-3-4.3-6.3-4.3-4 0-6.6 2.9-6.6 7.5s2.6 7.4 6.5 7.4c3.6 0 6.1-2.5 6.1-5.6 0-1.8-.7-3.2-1.6-4zm-4.3 4c-.9.1-1.5-.3-1.6-1-.1-.8.7-1.3 1.8-1.4.6 0 1.2 0 1.8.1-.2 1.5-1 2.2-2 2.3z"/></svg>' }
  ];

  CardStudio_init({ FORMATS:FORMATS, BG:BG, FONTS:FONTS, TONES:TONES, VERSES:VERSES, DECLS:DECLS, ICONS:ICONS, SOCIAL:SOCIAL });
})();
