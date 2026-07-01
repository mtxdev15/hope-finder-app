/* commentary.js — opens the "Break this down" verse commentary in a sheet.
   Content lives in hidden .vcomm-src blocks in the page (so it stays crawlable);
   a button with data-comm="<id>" reveals it. Single sheet, injected once.
   Vanilla JS so it works on the static /public/*.html struggle pages. */
(function () {
  if (window.__declCommentary) return;
  window.__declCommentary = true;

  var scrim, sheet, refEl, titleEl, bodyEl, readEl, closeBtn, lastFocus;

  var CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ARROW_SVG = '<svg viewBox="0 0 40 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M0 6h37"/><path d="M31 1l6 5-6 5"/></svg>';

  function build() {
    scrim = document.createElement('div');
    scrim.className = 'cmt-scrim';

    sheet = document.createElement('div');
    sheet.className = 'cmt-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Verse commentary');
    sheet.innerHTML =
      '<div class="cmt-grab" aria-hidden="true"></div>' +
      '<button class="cmt-close" type="button" aria-label="Close">' + CLOSE_SVG + '</button>' +
      '<div class="cmt-kicker">Break this down</div>' +
      '<div class="cmt-ref"></div>' +
      '<h2 class="cmt-title"></h2>' +
      '<div class="cmt-body"></div>' +
      '<a class="cmt-read" href="#">Read it in the Word ' + ARROW_SVG + '</a>';

    document.body.appendChild(scrim);
    document.body.appendChild(sheet);

    refEl = sheet.querySelector('.cmt-ref');
    titleEl = sheet.querySelector('.cmt-title');
    bodyEl = sheet.querySelector('.cmt-body');
    readEl = sheet.querySelector('.cmt-read');
    closeBtn = sheet.querySelector('.cmt-close');

    closeBtn.addEventListener('click', close);
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('open')) close();
    });
  }

  function open(srcId, btn) {
    var src = document.getElementById(srcId);
    if (!src) return;
    if (!scrim) build();

    var ref = src.getAttribute('data-ref') || '';
    var title = src.getAttribute('data-title') || '';
    var read = src.getAttribute('data-read') || '';

    refEl.textContent = ref;
    refEl.style.display = ref ? '' : 'none';
    titleEl.textContent = title;
    titleEl.style.display = title ? '' : 'none';
    bodyEl.innerHTML = src.innerHTML;
    if (read) { readEl.href = read; readEl.style.display = ''; }
    else { readEl.style.display = 'none'; }

    lastFocus = btn || document.activeElement;
    scrim.classList.add('open');
    sheet.classList.add('open');
    sheet.scrollTop = 0;
    document.documentElement.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    if (!sheet) return;
    scrim.classList.remove('open');
    sheet.classList.remove('open');
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-comm]');
    if (!btn) return;
    e.preventDefault();
    open(btn.getAttribute('data-comm'), btn);
  });
})();
