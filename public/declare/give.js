/* ============================================================
   DECLARE — Give logic (give.js)  ·  bilingual (en / es)
   Story scroll reveals · live amount + impact · the globe ·
   currency / frequency / process-date / payment sheets ·
   the Wellspring (recurring) · confirmation.
   Language comes from data-lang="es" on .give-page (default en).
   (Design-time Tweaks panel removed for production.)
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var page = $('.give-page');

  /* ---------- impact math ---------- */
  var PER_PERSON = 1.25;   // $1.25 reaches one person (doubled: each dollar now reaches ~2x people)
  var peopleOf = function (a) { return Math.max(1, Math.round(a / PER_PERSON)); };
  var levelOf = function (ppl) { return Math.min(1, Math.sqrt(ppl / 240)); };   // globe fills ~2x faster per dollar

  /* ---------- language ---------- */
  var ES = !!(page && page.getAttribute('data-lang') === 'es');

  /* ---------- live giving counter (public Convex read) ---------- */
  var CONVEX_URL = 'https://keen-hamster-650.convex.cloud';
  var cumulativeIdle = 0.04; // globe idle level, raised gently by total giving

  // the signed-in user's id (if any), so a gift links to their account for history.
  // The Better Auth + Convex adapter uses the Convex document id as the user id, and
  // the server scopes giving history by safeGetAuthUser()._id — read both field names
  // (_id or id) so we always send the value that matches, whatever the client stored.
  function getGiverId() {
    try {
      var d = localStorage.getItem('better-auth_session_data');
      if (!d) return null;
      var u = (JSON.parse(d) || {}).user;
      return (u && (u._id || u.id)) || null;
    } catch (e) { return null; }
  }

  /* ---------- localized data ---------- */
  var CUR_SYM = { USD: '$', EUR: '€', GBP: '£', CAD: '$', AUD: '$', NGN: '₦', INR: '₹', BRL: 'R$', KES: 'KSh', PHP: '₱' };
  var CUR_NAMES = ES ? {
    USD: 'Dólar estadounidense', EUR: 'Euro', GBP: 'Libra esterlina', CAD: 'Dólar canadiense',
    AUD: 'Dólar australiano', NGN: 'Naira nigeriano', INR: 'Rupia india', BRL: 'Real brasileño',
    KES: 'Chelín keniano', PHP: 'Peso filipino'
  } : {
    USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar', NGN: 'Nigerian Naira', INR: 'Indian Rupee', BRL: 'Brazilian Real',
    KES: 'Kenyan Shilling', PHP: 'Philippine Peso'
  };
  var CUR = {};
  Object.keys(CUR_SYM).forEach(function (k) { CUR[k] = { sym: CUR_SYM[k], name: CUR_NAMES[k] }; });

  var FREQ = ES ? [
    { k: 'semimonthly', label: 'Dos veces al mes', word: 'Dos Veces al Mes', per: '/mes', every: 'cycle' },
    { k: 'monthly', label: 'Mensual', word: 'Mensual', per: '/mes', every: 'mes' }
  ] : [
    { k: 'semimonthly', label: 'Twice a month', word: 'Twice a Month', per: '/mo', every: 'cycle' },
    { k: 'monthly', label: 'Monthly', word: 'Monthly', per: '/mo', every: 'month' }
  ];
  var freqOf = function (k) { for (var i = 0; i < FREQ.length; i++) if (FREQ[i].k === k) return FREQ[i]; return FREQ[FREQ.length - 1]; };

  var PAY = ES ? [
    { k: 'apple', name: 'Apple Pay', sub: 'Predeterminado · Face ID', icon: 'apple' },
    { k: 'google', name: 'Google Pay', sub: 'Vinculado a tu cuenta', icon: 'google' },
    { k: 'card', name: 'Tarjeta', sub: 'Visa ···· 4242', icon: 'card' }
  ] : [
    { k: 'apple', name: 'Apple Pay', sub: 'Default · Face ID', icon: 'apple' },
    { k: 'google', name: 'Google Pay', sub: 'Linked to your account', icon: 'google' },
    { k: 'card', name: 'Card', sub: 'Visa ···· 4242', icon: 'card' }
  ];
  var payOf = function (k) { for (var i = 0; i < PAY.length; i++) if (PAY[i].k === k) return PAY[i]; return PAY[0]; };

  // simple, non-trademarked monochrome glyphs (label names the brand)
  var ICON = {
    apple: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M9.5 18.5h5"/><path d="M8.5 6h7"/></svg>',
    google: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12.5" rx="3"/><path d="M2.5 10h19"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 9.5h19"/><path d="M6 14.5h4"/></svg>',
    add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* ---------- localized strings ---------- */
  var T = ES ? {
    addPay: 'Agregar método de pago', opening: 'Abriendo formulario seguro…',
    months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    dow: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    today: 'Hoy', processDate: 'Fecha de proceso:',
    person: 'persona', people: 'personas', mostGiven: 'Más dado',
    chooseAmount: 'Elige una cantidad',
    giveNow: function (a) { return 'Dar ' + a + ' ahora'; },
    giveEvery: function (a, w) { return 'Dar ' + a + ' ' + w; },
    chooseSow: 'Elige cómo sembrarás hoy.',
    twiceMonth: 'dos veces al mes', everyPhrase: function (e) { return 'cada ' + e; },
    impPlainOnce: function (n, noun) { return 'Ayuda a <b class="ic">' + n + '</b> ' + noun + ' a encontrar la Biblia en Declare.'; },
    impPlainRecur: function (n, noun, pp) { return 'Alcanza a <b class="ic">' + n + '</b> ' + noun + ' con la Biblia ' + pp + '.'; },
    impPoetOnce: function (n, noun) { return 'Se convierte en agua viva para <b class="ic">' + n + '</b> ' + noun + ' que encuentran la Palabra.'; },
    impPoetRecur: function (n, noun, pp) { return 'Agua viva para <b class="ic">' + n + '</b> ' + noun + ', ' + pp + '.'; },
    confPlain: function (n, noun) { return 'Tu ofrenda ayuda a <b>' + n + '</b> ' + noun + ' a encontrar la Biblia en Declare.'; },
    confPoet: function (n, noun, head, tail) { return head + 'Tu ofrenda se convierte en agua viva para <b>' + n + '</b> ' + noun + ' que encontrarán la Palabra' + tail + '.'; },
    confWell: 'Te has unido al <b>Manantial</b>. ',
    shareGaveTitle: 'Acabo de ofrendar a Declare', shareSub: 'Mantén la Palabra fluyendo, gratis para todos.',
    sharePageTitle: 'Ofrenda a Declare',
    shareGiftText: 'Acabo de sembrar una semilla en Declare para que la Palabra de Dios siga fluyendo gratis para todos. Únete:',
    shareHelpText: 'Ayuda a que la Palabra de Dios siga fluyendo gratis para todos en Declare. Da aquí:',
    totalLine: function (n, one) { return '<b class="gt-n">' + n + '</b> ' + (one ? 'persona liberada' : 'personas liberadas') + ' por la Palabra de Dios'; },
    processing: 'Redirigiendo…', payErr: 'Algo salió mal al iniciar tu ofrenda. Inténtalo de nuevo.'
  } : {
    addPay: 'Add new payment method', opening: 'Opening secure form…',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    today: 'Today', processDate: 'Process Date:',
    person: 'person', people: 'people', mostGiven: 'Most given',
    chooseAmount: 'Choose an amount',
    giveNow: function (a) { return 'Give ' + a + ' Now'; },
    giveEvery: function (a, w) { return 'Give ' + a + ' ' + w; },
    chooseSow: 'Choose how you’ll sow today.',
    twiceMonth: 'twice a month', everyPhrase: function (e) { return 'every ' + e; },
    impPlainOnce: function (n, noun) { return 'Helps <b class="ic">' + n + '</b> ' + noun + ' encounter the Bible through Declare.'; },
    impPlainRecur: function (n, noun, pp) { return 'Reaches <b class="ic">' + n + '</b> ' + noun + ' with the Bible ' + pp + '.'; },
    impPoetOnce: function (n, noun) { return 'Becomes living water for <b class="ic">' + n + '</b> ' + noun + ' meeting the Word.'; },
    impPoetRecur: function (n, noun, pp) { return 'Living water for <b class="ic">' + n + '</b> ' + noun + ' — ' + pp + '.'; },
    confPlain: function (n, noun) { return 'Your gift helps <b>' + n + '</b> ' + noun + ' encounter the Bible through Declare.'; },
    confPoet: function (n, noun, head, tail) { return head + 'Your gift becomes living water for <b>' + n + '</b> ' + noun + ' who’ll meet the Word' + tail + '.'; },
    confWell: 'You’ve joined the <b>Wellspring</b>. ',
    shareGaveTitle: 'I just gave to Declare', shareSub: 'Keep the Word flowing — free for all.',
    sharePageTitle: 'Give to Declare',
    shareGiftText: 'I just sowed a seed into Declare to keep God’s Word flowing free for everyone. Join me:',
    shareHelpText: 'Help keep God’s Word flowing free for everyone on Declare. Give here:',
    totalLine: function (n, one) { return '<b class="gt-n">' + n + '</b> ' + (one ? 'person' : 'people') + ' set free by the Word of God'; },
    processing: 'Redirecting…', payErr: 'Something went wrong starting your gift. Please try again.'
  };

  /* ---------- state ---------- */
  var S = {
    amount: 100, custom: false,
    recurring: false, freq: 'monthly',
    currency: 'USD', pay: 'apple',
    processDay: 25, processMonth: 5, processYear: 2026, processToday: true,
    tone: 'poetic'
  };
  var TODAY = { d: 25, m: 5, y: 2026 }; // June 25, 2026

  /* ============================================================
     DEFAULTS — applied from window.GIVE_DEFAULTS
     ============================================================ */
  var defaults = (window.GIVE_DEFAULTS || {});
  var tweaks = {
    storyIntensity: defaults.storyIntensity != null ? defaults.storyIntensity : 70,
    accent: defaults.accent || 'gold',
    amountLayout: defaults.amountLayout || 'cards',
    copyTone: defaults.copyTone || 'poetic',
    globe: defaults.globe != null ? defaults.globe : true,
    defaultFrequency: defaults.defaultFrequency || 'once'
  };

  function applyTweaks(initial) {
    page.style.setProperty('--story', (tweaks.storyIntensity / 100).toFixed(3));
    page.setAttribute('data-acc', tweaks.accent === 'water' ? 'water' : 'gold');
    page.setAttribute('data-layout', tweaks.amountLayout === 'bignum' ? 'bignum' : 'cards');
    page.setAttribute('data-globe', tweaks.globe ? 'on' : 'off');
    S.tone = tweaks.copyTone === 'plain' ? 'plain' : 'poetic';
    page.setAttribute('data-tone', S.tone);
    swapTone();
    if (initial) {
      S.recurring = tweaks.defaultFrequency === 'monthly';
      if (S.recurring) S.freq = 'monthly';
    }
    if (globe) globe.refresh();
  }

  function swapTone() {
    $$('[data-poetic]').forEach(function (el) {
      var v = el.getAttribute(S.tone === 'plain' ? 'data-plain' : 'data-poetic');
      if (v != null) el.textContent = v;
    });
  }

  /* ============================================================
     GLOBE
     ============================================================ */
  var globe = null, globeCanvas = $('#globe');
  if (globeCanvas && window.GiveGlobe) globe = window.GiveGlobe.mount(globeCanvas, page);

  /* ============================================================
     AMOUNT CARDS
     ============================================================ */
  var PRESETS = [25, 50, 75, 100, 250, 500, 1000];
  var amtsEl = $('#amts'), customInput = $('#customAmt');

  function curSym() { return CUR[S.currency].sym; }
  function commas(n) { return Math.round(n).toLocaleString('en-US'); }

  function buildCards() {
    var html = '';
    PRESETS.forEach(function (a) {
      var ppl = peopleOf(a), feat = a === 250;
      html += '<button class="acard' + (feat ? ' feat' : '') + '" data-a="' + a + '" aria-label="' + a + '">' +
        (feat ? '<span class="badge">' + T.mostGiven + '</span>' : '') +
        '<span class="seed">' + sprout() + '</span>' +
        '<span class="av"><span class="cs"></span>' + commas(a) + '</span>' +
        '<span class="ai"><b>' + commas(ppl) + '</b> ' + (ppl === 1 ? T.person : T.people) + '</span>' +
        '</button>';
    });
    amtsEl.insertAdjacentHTML('afterbegin', html);
    $$('.acard[data-a]', amtsEl).forEach(function (b) {
      b.addEventListener('click', function () { selectAmount(+b.dataset.a, false); customInput.value = ''; });
    });
  }
  function sprout() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-7"/><path d="M12 14c0-3 2-5 6-5 0 3-2 5-6 5z"/><path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/></svg>'; }

  function selectAmount(a, isCustom) {
    S.amount = a; S.custom = isCustom;
    $$('.acard[data-a]', amtsEl).forEach(function (b) { b.classList.toggle('on', !isCustom && +b.dataset.a === a); });
    $('#customCard').classList.toggle('on', isCustom && a > 0);
    render();
  }

  /* ============================================================
     RENDER — amount, impact, globe, button
     ============================================================ */
  var bigVal = $('#bigVal'), impactEl = $('#impact'), bigPer = $('#bigPer'), btnLabels = $$('[data-give-label]');
  var lastShown = { val: 0, ppl: 0 };

  function periodPhrase() {
    if (!S.recurring) return '';
    var f = freqOf(S.freq);
    return f.every === 'cycle' ? T.twiceMonth : T.everyPhrase(f.every);
  }

  function impactHTML(ppl) {
    var noun = ppl === 1 ? T.person : T.people, n = commas(ppl), pp = periodPhrase();
    if (S.tone === 'plain') return S.recurring ? T.impPlainRecur(n, noun, pp) : T.impPlainOnce(n, noun);
    return S.recurring ? T.impPoetRecur(n, noun, pp) : T.impPoetOnce(n, noun);
  }

  function render() {
    var a = S.amount || 0, ppl = a > 0 ? peopleOf(a) : 0;
    // currency symbols
    $$('.amt-cur', page).forEach(function (e) { e.textContent = curSym(); });
    $$('.acard .av .cs', amtsEl).forEach(function (e) { e.textContent = curSym(); });
    $('#customCur').textContent = curSym();
    $('#curCode').textContent = S.currency;

    // big number + impact (count up)
    tween(lastShown.val, a, 520, function (v) { bigVal.textContent = commas(v); }, function () { lastShown.val = a; });
    bigPer.textContent = S.recurring ? freqOf(S.freq).per : '';
    bigPer.style.display = S.recurring ? '' : 'none';

    impactEl.innerHTML = a > 0 ? impactHTML(ppl) : '<span style="opacity:.7">' + T.chooseSow + '</span>';
    var icb = $('.ic', impactEl);
    if (icb && a > 0) { tween(lastShown.ppl, ppl, 620, function (v) { icb.textContent = commas(v); }); }
    lastShown.ppl = ppl;

    if (globe) globe.setLevel(a > 0 ? levelOf(ppl) : cumulativeIdle);

    // button(s)
    var amtStr = curSym() + commas(a);
    var lbl = a <= 0 ? T.chooseAmount : (S.recurring ? T.giveEvery(amtStr, freqOf(S.freq).word) : T.giveNow(amtStr));
    btnLabels.forEach(function (e) { e.textContent = lbl; });

    // recurring rows
    $('#freqVal').firstChild && ($('#freqVal').firstChild.textContent = freqOf(S.freq).word + ' ');
    $('#dateVal').firstChild && ($('#dateVal').firstChild.textContent = dateLabel() + ' ');
  }

  // number tween
  function tween(from, to, dur, step, done) {
    if (REDUCED || from === to) { step(to); done && done(); return; }
    var t0 = performance.now();
    function fr(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      step(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(fr); else { done && done(); }
    }
    requestAnimationFrame(fr);
  }

  /* ============================================================
     CUSTOM INPUT
     ============================================================ */
  customInput.addEventListener('input', function () {
    var raw = this.value.replace(/[^0-9.]/g, '');
    var fd = raw.indexOf('.'); if (fd >= 0) raw = raw.slice(0, fd + 1) + raw.slice(fd + 1).replace(/\./g, '');
    var parts = raw.split('.');
    var intp = parts[0].replace(/^0+(?=\d)/, '');
    this.value = (intp ? parseInt(intp, 10).toLocaleString('en-US') : '') + (parts.length > 1 ? '.' + parts[1].slice(0, 2) : '');
    var v = parseFloat(raw);
    if (raw && !isNaN(v)) { selectAmount(v, true); }
    else { selectAmount(0, true); }
  });
  $('#customCard').addEventListener('click', function (e) { if (e.target !== customInput) customInput.focus(); });

  /* ============================================================
     RECURRING (the Wellspring)
     ============================================================ */
  var optRecur = $('#optRecur'), swRecur = $('#swRecur');
  function setRecurring(on) {
    S.recurring = !!on;
    if (on && S.freq === 'once') S.freq = 'monthly';
    swRecur.setAttribute('data-on', on ? '1' : '0');
    optRecur.classList.toggle('open', !!on);
    render();
  }
  swRecur.addEventListener('click', function () { setRecurring(!S.recurring); });

  /* ============================================================
     SHEETS — generic open/close
     ============================================================ */
  var scrim = $('#gscrim'); var openSheet = null;
  function sheetOpen(id) {
    var s = $('#' + id); if (!s) return;
    if (openSheet && openSheet !== s) openSheet.classList.remove('open');
    s.classList.add('open'); scrim.classList.add('open'); openSheet = s;
  }
  function sheetClose() { if (openSheet) openSheet.classList.remove('open'); openSheet = null; scrim.classList.remove('open'); }
  scrim.addEventListener('click', sheetClose);
  $$('[data-sheet-done]').forEach(function (b) { b.addEventListener('click', sheetClose); });
  $$('[data-open-sheet]').forEach(function (b) { b.addEventListener('click', function () { sheetOpen(b.dataset.openSheet); }); });

  /* ---- currency sheet ---- */
  (function () {
    var body = $('#curBody'), html = '';
    Object.keys(CUR).forEach(function (k) {
      html += '<div class="opt' + (k === S.currency ? ' sel' : '') + '" data-cur="' + k + '">' +
        '<span class="sym">' + CUR[k].sym + '</span>' +
        '<span class="ot"><span class="o1">' + CUR[k].name + '</span></span>' +
        '<span class="code">' + k + '</span>' +
        '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5"/></svg>' +
        '</div>';
    });
    body.innerHTML = html;
    body.addEventListener('click', function (e) {
      var o = e.target.closest('.opt[data-cur]'); if (!o) return;
      S.currency = o.dataset.cur;
      $$('.opt', body).forEach(function (x) { x.classList.toggle('sel', x === o); });
      render(); setTimeout(sheetClose, 180);
    });
  })();

  /* ---- frequency sheet ---- */
  (function () {
    var body = $('#freqBody'), html = '';
    FREQ.forEach(function (f) {
      html += '<div class="opt' + (f.k === S.freq ? ' sel' : '') + '" data-freq="' + f.k + '">' +
        '<span class="ot"><span class="o1">' + f.label + '</span></span>' +
        '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5"/></svg>' +
        '</div>';
    });
    body.innerHTML = html;
    body.addEventListener('click', function (e) {
      var o = e.target.closest('.opt[data-freq]'); if (!o) return;
      S.freq = o.dataset.freq;
      $$('.opt', body).forEach(function (x) { x.classList.toggle('sel', x === o); });
      render(); setTimeout(sheetClose, 180);
    });
  })();

  /* ---- payment sheet ---- */
  function paymentMarkup() {
    var html = '';
    PAY.forEach(function (p) {
      html += '<div class="opt' + (p.k === S.pay ? ' sel' : '') + '" data-pay="' + p.k + '">' +
        '<span class="pm-logo">' + ICON[p.icon] + '</span>' +
        '<span class="ot"><span class="o1">' + p.name + '</span><span class="o2">' + p.sub + '</span></span>' +
        '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5"/></svg>' +
        '</div>';
    });
    html += '<div class="opt add" id="addPay"><span class="sym">' + ICON.add + '</span><span class="ot"><span class="o1">' + T.addPay + '</span></span></div>';
    return html;
  }
  (function () {
    var body = $('#payBody'); body.innerHTML = paymentMarkup();
    body.addEventListener('click', function (e) {
      var add = e.target.closest('#addPay');
      if (add) { add.querySelector('.o1').textContent = T.opening; setTimeout(function () { add.querySelector('.o1').textContent = T.addPay; }, 1400); return; }
      var o = e.target.closest('.opt[data-pay]'); if (!o) return;
      S.pay = o.dataset.pay;
      $$('.opt[data-pay]', body).forEach(function (x) { x.classList.toggle('sel', x === o); });
      paintPayRow(); setTimeout(sheetClose, 180);
    });
  })();
  function paintPayRow() {
    var p = payOf(S.pay);
    $('#payLogo').innerHTML = ICON[p.icon];
    $('#payName').textContent = p.name;
    $('#paySub').textContent = p.sub;
  }

  /* ---- process date (calendar) ---- */
  var MONTHS = T.months;
  function dateLabel() {
    if (S.processToday) return T.today;
    return MONTHS[S.processMonth].slice(0, 3) + ' ' + S.processDay;
  }
  function buildCal() {
    var y = S.processYear, m = S.processMonth;
    $('#calMonth').textContent = MONTHS[m] + ' ' + y;
    var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    var grid = $('#calGrid'), html = '';
    T.dow.forEach(function (d) { html += '<div class="dow">' + d + '</div>'; });
    for (var i = 0; i < first; i++) html += '<div></div>';
    for (var d = 1; d <= days; d++) {
      var isPast = (y < TODAY.y) || (y === TODAY.y && (m < TODAY.m || (m === TODAY.m && d < TODAY.d)));
      var isToday = (y === TODAY.y && m === TODAY.m && d === TODAY.d);
      var isSel = (!S.processToday && y === S.processYear && m === S.processMonth && d === S.processDay) || (S.processToday && isToday);
      html += '<div class="day' + (isPast ? ' muted' : '') + (isToday ? ' today' : '') + (isSel ? ' sel' : '') + '" data-d="' + d + '">' + d + '</div>';
    }
    grid.innerHTML = html;
    $('#calFoot').innerHTML = T.processDate + ' <b>' + dateLabel() + '</b>';
  }
  $('#calPrev').addEventListener('click', function () {
    if (S.processYear === TODAY.y && S.processMonth === TODAY.m) return; // don't go before this month
    S.processMonth--; if (S.processMonth < 0) { S.processMonth = 11; S.processYear--; } buildCal();
  });
  $('#calNext').addEventListener('click', function () { S.processMonth++; if (S.processMonth > 11) { S.processMonth = 0; S.processYear++; } buildCal(); });
  $('#calGrid').addEventListener('click', function (e) {
    var d = e.target.closest('.day[data-d]'); if (!d || d.classList.contains('muted')) return;
    S.processDay = +d.dataset.d;
    S.processToday = (S.processYear === TODAY.y && S.processMonth === TODAY.m && S.processDay === TODAY.d);
    buildCal(); render();
  });

  /* ============================================================
     DOCK CTA + GIVE → confirmation
     ============================================================ */
  var dock = $('#dock'), inlineBtn = $('.give-btn-inline');
  if ('IntersectionObserver' in window && inlineBtn) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { dock.classList.toggle('show', !x.isIntersecting); });
    }, { threshold: 0 });
    io.observe(inlineBtn);
  } else dock.classList.add('show');

  var confirm = $('#confirm');
  var WORKER = 'https://hope-finder-worker.thinktoro.workers.dev';
  // Stripe Customer Portal login link (Stripe → Settings → Billing → Customer portal).
  // Empty = the "Manage your giving" link stays hidden on the thank-you screen.
  var PORTAL_URL = '';
  var giveBtns = $$('[data-give-btn]');

  // show the Thank-you screen for a gift (used on the success return from Stripe)
  function showConfirm(amt, recurring, freqKey) {
    var ppl = peopleOf(amt), noun = ppl === 1 ? T.person : T.people, n = commas(ppl);
    var f = freqOf(freqKey);
    var amtStr = curSym() + commas(amt);
    $('#cAmt').textContent = amtStr + (recurring ? ' · ' + f.word : '');
    if (S.tone === 'plain') {
      $('#cSum').innerHTML = T.confPlain(n, noun);
    } else {
      var head = recurring ? T.confWell : '';
      var pp = f.every === 'cycle' ? T.twiceMonth : T.everyPhrase(f.every);
      var tail = recurring ? ', ' + pp : '';
      $('#cSum').innerHTML = T.confPoet(n, noun, head, tail);
    }
    // Soft account nudge for guests only; manage-link for recurring gifts (when a portal is set).
    var ca = $('#cAccount'); if (ca) ca.hidden = !!getGiverId();
    var cm = $('#cManage'); if (cm) { if (recurring && PORTAL_URL) { cm.setAttribute('href', PORTAL_URL); cm.hidden = false; } else cm.hidden = true; }
    confirm.classList.add('show'); dock.classList.remove('show');
    if (globe) globe.setLevel(Math.min(1, levelOf(ppl) + 0.12));
  }

  function setGiveBusy(on) {
    giveBtns.forEach(function (b) { b.disabled = !!on; b.classList.toggle('busy', !!on); });
    if (on) { btnLabels.forEach(function (e) { e.textContent = T.processing; }); }
    else { render(); }
  }

  // tapping Give → ask the Worker for a Stripe Checkout link, then redirect to it
  function doGive() {
    if (!S.amount || S.amount <= 0) { sheetClose(); customInput.focus(); return; }
    setGiveBusy(true);
    var payload = { amount: S.amount, currency: S.currency, recurring: S.recurring, frequency: S.freq, path: location.pathname };
    var uid = getGiverId(); if (uid) payload.userId = uid;
    fetch(WORKER + '/give/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.url) { window.location.href = d.url; }
      else { setGiveBusy(false); alert((d && d.error) || T.payErr); }
    }).catch(function () { setGiveBusy(false); alert(T.payErr); });
  }
  giveBtns.forEach(function (b) { b.addEventListener('click', doGive); });
  $('#cDone').addEventListener('click', function () {
    confirm.classList.remove('show');
    var r = inlineBtn && inlineBtn.getBoundingClientRect();
    if (r && (r.bottom < 0 || r.top > window.innerHeight)) dock.classList.add('show');
    if (globe) globe.setLevel(levelOf(peopleOf(S.amount)));
  });
  $('#cShare').addEventListener('click', function () {
    if (window.DeclareShare) DeclareShare.open({ type: 'page', title: T.shareGaveTitle, subtitle: T.shareSub, text: T.shareGiftText, url: location.origin + location.pathname, embed: false });
  });

  /* ============================================================
     SCROLL REVEALS + river node
     ============================================================ */
  // scroll-linked reveal: --p (0→1) tracks each .rv element entering the viewport
  (function () {
    var rvEls = $$('.rv'); if (!rvEls.length) return;
    if (REDUCED) { rvEls.forEach(function (el) { el.style.setProperty('--p', '1'); }); return; }
    var stags = rvEls.map(function (el) { return (parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0) / 1000; });
    var ticking = false;
    function upd() {
      ticking = false; var vh = window.innerHeight || 1;
      var doc = document.documentElement;
      var maxScroll = Math.max(0, (doc.scrollHeight || 0) - vh);
      var remaining = maxScroll - (window.scrollY || window.pageYOffset || 0);
      rvEls.forEach(function (el, i) {
        var top = el.getBoundingClientRect().top;
        var p = (vh - top) / (vh * 0.45) - stags[i];
        // bottom-safe: force completion as the page runs out of scroll room
        if (remaining < vh * 0.55) p = Math.max(p, 1 - remaining / (vh * 0.55));
        el.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(3));
      });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    upd();
  })();

  // "Give now" link in the why-section jumps back up to the form
  $$('[data-give-jump]').forEach(function (b) { b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); }); });

  /* ---- header share ---- */
  $('#pageShare') && $('#pageShare').addEventListener('click', function () {
    if (window.DeclareShare) DeclareShare.open({ type: 'page', title: T.sharePageTitle, subtitle: T.shareSub, text: T.shareHelpText, url: location.origin + location.pathname, embed: false });
  });

  // re-read globe colors when the theme flips
  document.addEventListener('click', function (e) { if (e.target.closest('.themectl button')) setTimeout(function () { globe && globe.refresh(); }, 60); });

  /* ============================================================
     LIVE GIVING COUNTER — public, unauthenticated read of the running total.
     ============================================================ */
  function renderTotal(people) {
    var el = $('#giveTotal');
    if (!el) return;
    if (!(people > 0)) { el.hidden = true; return; }
    el.innerHTML = T.totalLine(commas(people), people === 1);
    el.hidden = false;
    var n = el.querySelector('.gt-n');
    if (n) tween(0, people, 1100, function (v) { n.textContent = commas(v); });
    // a gentle baseline glow on the globe that grows with total giving
    cumulativeIdle = Math.min(0.45, 0.1 + Math.sqrt(people) / 220);
    if (globe && (!S.amount || S.amount <= 0)) globe.setLevel(cumulativeIdle);
  }
  function loadTotal() {
    fetch(CONVEX_URL + '/api/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'gifts:getTotal', args: {} }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.status === 'success' && d.value) renderTotal(d.value.people || 0);
    }).catch(function () {});
  }

  /* ============================================================
     BOOT
     ============================================================ */
  buildCards();
  paintPayRow();
  applyTweaks(true);
  if (S.recurring) { swRecur.setAttribute('data-on', '1'); optRecur.classList.add('open'); }
  selectAmount(S.amount, false);
  buildCal();
  render();
  loadTotal();

  // returning from Stripe (success) → show the Thank-you screen
  (function () {
    var q = new URLSearchParams(location.search);
    if (q.get('status') === 'success') {
      var amt = parseFloat(q.get('amt')); if (!isFinite(amt) || amt <= 0) amt = S.amount;
      showConfirm(amt, q.get('rec') === '1', q.get('freq') || 'monthly');
      try { history.replaceState({}, '', location.pathname); } catch (e) {}
    }
  })();
})();
