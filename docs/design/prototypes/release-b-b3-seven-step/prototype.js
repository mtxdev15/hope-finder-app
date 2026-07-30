/* B3.1 / B3.1A seven-step Journey — design-only prototype state machine.
   In-memory only. Nothing here reads or writes localStorage/sessionStorage
   or any real Journey state, Vault, or AI Worker. window.__proto is
   intentionally exposed for scripted, reproducible screenshotting and for
   interactive click-through review — see README.md. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var TOTAL_STEPS = 7;

  var STEP_META = {
    1: { title: 'Receive', primary: 'I Receive This Truth', gated: false },
    2: { title: 'Pray', primary: 'Continue', gated: false },
    3: { title: 'Cast Off the Lie', primary: 'Continue', gated: true, gateKey: 'cast' },
    4: { title: 'Repent & Breathe', primary: 'Continue', gated: true, gateKey: 'breathe' },
    5: { title: 'Declare the Truth Aloud', primary: 'Continue', gated: true, gateKey: 'declare' },
    6: { title: 'Reflect', primary: 'Save Reflection', gated: false },
    7: { title: 'Take It Into Your Day', primary: 'Complete Day 1', gated: false }
  };

  var state = {
    day: 1,
    step: 1,
    reviewing: false,
    reviewStep: null,
    gates: { cast: false, breathe: false, declare: false },
    breathPhase: null, // null | 'ready' | 'inhale' | 'hold' | 'exhale' | 'complete' | 'reducedmotion'
    // reflectState — the approved Step 6 product model (design-only simulation):
    // empty | typing | restored | saving | saved | ai-consent | ai-loading |
    // ai-response | ai-error-unavailable | ai-error-connection | crisis
    reflectState: 'empty',
    reducedMotion: false,
    largerText: false,
    theme: 'dark',
    // top-label experiment (design review, not yet decided): 'full' = current
    // "Day N of 5 · Step S of 7"; 'dots-only' = drop the step-count text and
    // let the dot rail alone carry step position; 'contextual' = "Day N of 5"
    // normally, with a quiet "Almost there" appended only on the last two steps.
    topLabelStyle: 'dots-only'
  };

  function renderProgress() {
    var box = $('rProg'), html = '';
    for (var i = 1; i <= TOTAL_STEPS; i++) {
      var cls = i < state.step ? 'done' : (i === state.step ? 'cur' : '');
      html += '<i class="' + cls + '"></i>';
    }
    box.innerHTML = html;
  }

  function currentStep() { return state.reviewing ? state.reviewStep : state.step; }

  function renderTop() {
    var s = currentStep();
    var dayText = 'Day ' + state.day + ' of 5';
    var label = dayText; // 'dots-only' — the default as of this review; the dot
    // rail carries visible step position, the number is no longer spelled out
    // in text for sighted users (see spec.md "Progress treatment" correction).
    if (state.topLabelStyle === 'full') {
      label = dayText + ' · Step ' + s + ' of 7';
    } else if (state.topLabelStyle === 'contextual') {
      label = s >= 6 ? dayText + ' · Almost there' : dayText;
    }
    $('rTopCtx').textContent = label;
    // Screen readers always get full step orientation regardless of the
    // visible style — the dots are aria-hidden, so this sr-only span is the
    // one accessible source of truth for position, matching the original
    // "text is the accessible source of truth" rule even after the visible
    // text was simplified.
    $('rTopCtxSR').textContent = dayText + ', Step ' + s + ' of 7';
  }

  function renderStepBody() {
    var s = currentStep();
    document.querySelectorAll('.step-body').forEach(function (el) {
      el.classList.toggle('active', String(s) === el.getAttribute('data-step'));
    });
  }

  // ---- Step 6 footer is state-dependent (Approved Button Model) — every
  // other step keeps the simple STEP_META primary/gate behavior. ----
  var REFLECT_WRITING_STATES = { empty: 1, typing: 1, restored: 1 };
  var REFLECT_SAVED_FAMILY = { saved: 1, 'ai-response': 1, 'ai-error-unavailable': 1, 'ai-error-connection': 1, crisis: 1 };

  function renderFooter() {
    var s = currentStep();
    var meta = STEP_META[s];
    var primaryBtn = $('rPrimaryBtn');
    var secondaryBtn = $('rSecondaryBtn');
    var backLink = $('rBackLink');
    var reviewBadge = $('reviewBadge');
    var reviewBackBtn = $('rReviewBackBtn');

    document.body.classList.toggle('rt-review', state.reviewing);
    reviewBadge.style.display = state.reviewing ? 'inline-flex' : 'none';

    if (state.reviewing) {
      primaryBtn.style.display = 'none';
      secondaryBtn.style.display = 'none';
      reviewBackBtn.style.display = 'block';
      backLink.style.display = 'none';
      return;
    }
    reviewBackBtn.style.display = 'none';
    primaryBtn.style.display = 'block';
    backLink.style.display = s > 1 ? 'block' : 'none';
    secondaryBtn.style.display = 'none';
    primaryBtn.disabled = false;

    if (s === 6) {
      renderReflectFooter(primaryBtn, secondaryBtn, backLink);
      return;
    }

    primaryBtn.textContent = meta.primary;
    if (meta.gated) primaryBtn.disabled = !state.gates[meta.gateKey];
  }

  function renderReflectFooter(primaryBtn, secondaryBtn, backLink) {
    var rs = state.reflectState;
    if (REFLECT_WRITING_STATES[rs]) {
      primaryBtn.textContent = 'Save Reflection';
      primaryBtn.disabled = false;
      return;
    }
    if (rs === 'saving') {
      primaryBtn.textContent = 'Saving...';
      primaryBtn.disabled = true;
      return;
    }
    if (rs === 'saved') {
      primaryBtn.textContent = 'Continue';
      secondaryBtn.style.display = 'block';
      secondaryBtn.textContent = 'Receive Guidance';
      secondaryBtn.className = 'rbtn-secondary';
      return;
    }
    if (rs === 'ai-loading') {
      primaryBtn.textContent = 'Preparing guidance...';
      primaryBtn.disabled = true;
      backLink.style.display = 'none';
      return;
    }
    if (rs === 'ai-response') {
      primaryBtn.textContent = 'Continue';
      secondaryBtn.style.display = 'block';
      secondaryBtn.textContent = 'Reflect More';
      secondaryBtn.className = 'rbtn-secondary';
      return;
    }
    if (rs === 'ai-error-unavailable' || rs === 'ai-error-connection') {
      primaryBtn.textContent = 'Continue';
      secondaryBtn.style.display = 'block';
      secondaryBtn.textContent = 'Try Again';
      secondaryBtn.className = 'rbtn-secondary';
      return;
    }
    if (rs === 'crisis') {
      primaryBtn.textContent = 'Continue';
      return;
    }
  }

  function renderAll() {
    renderProgress();
    renderTop();
    renderStepBody();
    renderFooter();
    renderDayBackground();
  }

  // ---- step navigation ----
  function goToStep(n) {
    n = Math.max(1, Math.min(TOTAL_STEPS, n));
    state.reviewing = false;
    state.step = n;
    renderAll();
  }
  function nextStep() { if (state.step < TOTAL_STEPS) goToStep(state.step + 1); else completeDay(); }
  function prevStep() { if (state.step > 1) goToStep(state.step - 1); }
  function completeDay() { /* design-only: no real completion screen wired here */ alert('[SIMULATED] Day complete. The real app opens the existing Day Complete screen, unmodified by B3.'); }

  // Personalized per-day backgrounds — only the full `shame` 5-day set is
  // generated in this pass (see spec doc for the full ~150-image plan
  // covering every struggle). Falls back to the real, already-committed
  // dayopen-bg.jpg (set as --day-bg's default in styles.css) for any day
  // without a dedicated generated image yet. Same photo is reused for BOTH
  // themes — only the CSS scrim (--day-scrim, per-theme) changes; see
  // spec.md "Light and Dark Theme System" for why a second image set is
  // deliberately NOT generated for the light theme.
  var DAY_BACKGROUNDS = {
    1: "url('assets/backgrounds/shame-day1.jpg')",
    2: "url('assets/backgrounds/shame-day2.jpg')",
    3: "url('assets/backgrounds/shame-day3.jpg')",
    4: "url('assets/backgrounds/shame-day4.jpg')",
    5: "url('assets/backgrounds/shame-day5.jpg')"
  };
  function renderDayBackground() {
    var url = DAY_BACKGROUNDS[state.day];
    $('shell').style.setProperty('--day-bg', url || "url('../../../../public/declare/dayopen-bg.jpg')");
  }
  function setDay(n) { state.day = Math.max(1, Math.min(5, n)); renderTop(); renderDayBackground(); }

  // ---- theme (design-only preview control — NOT wired to window.DeclareTheme
  // or localStorage['declare-theme']; see README "Theme-switching prototype
  // behavior"). Switching theme intentionally touches ONLY the data-theme
  // attribute — it never resets step, gates, breath, reflect, or overlay state. ----
  function setTheme(mode) {
    mode = mode === 'light' ? 'light' : 'dark';
    state.theme = mode;
    document.documentElement.setAttribute('data-theme', mode);
    document.querySelectorAll('.theme-preview-ctl button[data-mode]').forEach(function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  document.querySelectorAll('.theme-preview-ctl button[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { setTheme(b.getAttribute('data-mode')); });
  });

  // ---- top-label style experiment (design review only, see state.topLabelStyle) ----
  function setTopLabelStyle(mode) {
    state.topLabelStyle = mode === 'dots-only' || mode === 'contextual' ? mode : 'full';
    renderTop();
  }

  // ---- gates ----
  function setGate(key, val) {
    state.gates[key] = val;
    renderFooter();
  }

  // Step 3 — cast off
  $('castCheck').addEventListener('click', function () {
    var on = !this.classList.contains('on');
    this.classList.toggle('on', on);
    $('castCheckLbl').textContent = on ? 'Cast off. It has no hold on you.' : 'Cast it off';
    setGate('cast', on);
  });

  // Step 5 — declare
  $('declareCheck').addEventListener('click', function () {
    if (this.classList.contains('on')) return; // one-way, matches real markSpoken()
    this.classList.add('on');
    $('declareCheckLbl').textContent = 'Declared aloud';
    $('declareHint').textContent = 'Amen. You declared it.';
    setGate('declare', true);
  });

  // Step 7 — act (optional, non-gating — matches real refreshGate())
  $('actCheck').addEventListener('click', function () {
    var on = !this.classList.contains('on');
    this.classList.toggle('on', on);
    $('actCheckLbl').textContent = on ? 'I did this' : 'I’ll carry this today';
  });

  // ---- breath (step 4) — real 4s/2s/6s asymmetric sequence, see audit doc.
  // PROPOSED CHANGE (Jeff, live during B3.1 review): 1 round instead of the
  // real production BREATH_ROUNDS=3. Reflected here in the prototype only —
  // journey.astro's actual constant is untouched; this is a decision for the
  // eventual B3 production implementation, not applied to production now. ----
  var BREATH_SEQ = [
    { label: 'Breathe in mercy', secs: 4 },
    { label: 'Hold', secs: 2 },
    { label: 'Release the old', secs: 6 }
  ];
  var BREATH_ROUNDS = 1;
  var breathTimer = null, breathRound = 1, breathIdx = 0;

  function setBreathPhase(phase) {
    var root = $('breathPhaseRoot');
    root.className = 'breath-wrap';
    clearInterval(breathTimer);
    var idle = $('breathIdleUI'), stage = $('breathStageWrap'), done = $('breathDoneUI');
    idle.style.display = 'none'; stage.style.display = 'none'; done.style.display = 'none';

    if (phase === 'ready' || !phase) {
      state.breathPhase = 'ready';
      idle.style.display = 'flex';
      document.body.classList.remove('rt-breathing');
      return;
    }
    if (phase === 'complete') {
      state.breathPhase = 'complete';
      done.style.display = 'flex';
      $('breathDoneText').textContent = 'Amen. You breathed out the old.';
      setGate('breathe', true);
      document.body.classList.remove('rt-breathing');
      return;
    }
    if (phase === 'skipped') {
      state.breathPhase = 'complete';
      done.style.display = 'flex';
      $('breathDoneText').textContent = 'Held for today. The Spirit meets you here.';
      setGate('breathe', true);
      document.body.classList.remove('rt-breathing');
      return;
    }
    // inhale|hold|exhale — the chrome quiets while the breath is actually
    // active, restoring at ready/complete (see styles.css .rt-breathing)
    var map = { inhale: 0, hold: 1, exhale: 2 };
    state.breathPhase = phase;
    stage.style.display = 'flex';
    document.body.classList.add('rt-breathing');
    root.classList.add('breath-phase-' + phase);
    var idx = map[phase];
    var p = BREATH_SEQ[idx];
    $('breathLabel').textContent = p.label;
    $('breathCount').textContent = p.secs;
    // With 1 round the counter is redundant (nothing to count) — only show
    // it when more than one round is configured.
    $('breathRoundLbl').style.display = BREATH_ROUNDS > 1 ? '' : 'none';
    $('breathRoundLbl').textContent = 'Breath ' + breathRound + ' of ' + BREATH_ROUNDS;
  }

  $('breathStartBtn').addEventListener('click', function () { runBreathSequence(); });
  $('breathSkipBtn').addEventListener('click', function () { setBreathPhase('skipped'); });

  function runBreathSequence() {
    breathRound = 1; breathIdx = 0;
    playPhase();
  }
  function playPhase() {
    var names = ['inhale', 'hold', 'exhale'];
    if (breathIdx >= names.length) {
      breathIdx = 0; breathRound++;
      if (breathRound > BREATH_ROUNDS) { setBreathPhase('complete'); return; }
    }
    setBreathPhase(names[breathIdx]);
    var secs = BREATH_SEQ[breathIdx].secs;
    var n = secs;
    clearInterval(breathTimer);
    breathTimer = setInterval(function () {
      n--; if (n >= 0) $('breathCount').textContent = n;
      if (n <= 0) { clearInterval(breathTimer); breathIdx++; playPhase(); }
    }, state.reducedMotion ? 80 : 1000); // sped up under reduced-motion just for demo scrubbing; real app keeps real timing regardless of motion pref (see audit §4)
  }

  // ==========================================================================
  // ---- reflect (step 6) — Approved Step 6 Product Model (B3.1A correction) ----
  // Three distinct concepts, never conflated:
  //  1. Temporary draft  — "Draft saved" — protects against loss while typing.
  //  2. Intentional Vault save — "Saved to Vault" — durable, deliberate.
  //  3. Optional AI guidance — user-initiated only, never automatic.
  // All persistence, saving, and AI calls below are SIMULATED (in-memory
  // timers only) — see README "Simulated state" for exactly what's real.
  // ==========================================================================
  var reflectInput = $('reflectInput');
  var reflectViews = ['Writing', 'Saving', 'Saved', 'AILoading', 'AIResponse', 'AIError', 'Crisis'];
  function showReflectView(name) {
    reflectViews.forEach(function (v) {
      var el = $('reflectView' + v);
      if (el) el.style.display = v === name ? 'block' : 'none';
    });
  }

  reflectInput.addEventListener('input', function () {
    var len = this.value.length;
    $('reflectCount').textContent = len + '/500';
    if (len === 0) { setReflectState('empty'); return; }
    setReflectState('typing');
  });

  var reflectSaveTimer = null;
  function setReflectState(s) {
    state.reflectState = s;
    document.body.classList.remove('rt-reflect-restored');
    clearTimeout(reflectSaveTimer);

    if (s === 'empty') {
      showReflectView('Writing');
      reflectInput.value = '';
      $('reflectCount').textContent = '0/500';
      $('reflectStatusText').textContent = 'We’re keeping your reflection safe while you write.';
      $('reflectStatus').className = 'reflect-status';
    } else if (s === 'typing') {
      showReflectView('Writing');
      if (!reflectInput.value) reflectInput.value = 'You are fearfully and wonderfully made';
      $('reflectCount').textContent = reflectInput.value.length + '/500';
      $('reflectStatusText').textContent = 'We’re keeping your reflection safe while you write.';
      $('reflectStatus').className = 'reflect-status rs-pending';
      reflectSaveTimer = setTimeout(function () {
        $('reflectStatusText').textContent = 'Draft saved';
        $('reflectStatus').className = 'reflect-status rs-draft';
      }, 700);
    } else if (s === 'restored') {
      showReflectView('Writing');
      reflectInput.value = 'I felt peace when I reminded myself that I am chosen by God, not defined by what I’ve done.';
      $('reflectCount').textContent = reflectInput.value.length + '/500';
      $('reflectStatusText').textContent = 'Draft restored';
      $('reflectStatus').className = 'reflect-status rs-draft';
      document.body.classList.add('rt-reflect-restored');
      $('reflectRestoredText').textContent = 'We restored what you were writing.';
    } else if (s === 'longcontent') {
      showReflectView('Writing');
      reflectInput.value = 'This memory keeps coming back to me, especially at night when it is quiet and I cannot distract myself from it anymore. I know in my head that grace covers this, but my heart still keeps score sometimes, and I find myself replaying the same regret over and over, wondering if I am actually forgiven or if I just say the words. Writing it out here, slowly, feels like the first honest place I have put it down instead of carrying it silently. I want to actually believe Romans 8:1 instead of just reciting it.';
      $('reflectCount').textContent = reflectInput.value.length + '/500';
      $('reflectStatusText').textContent = 'Draft saved';
      $('reflectStatus').className = 'reflect-status rs-draft';
    } else if (s === 'saving') {
      showReflectView('Saving');
    } else if (s === 'saved') {
      if (!reflectInput.value) reflectInput.value = 'I felt peace when I reminded myself that I am chosen by God, not defined by what I’ve done.';
      $('vaultSavedText').textContent = reflectInput.value;
      showReflectView('Saved');
    } else if (s === 'ai-loading') {
      showReflectView('AILoading');
    } else if (s === 'ai-response') {
      showReflectView('AIResponse');
    } else if (s === 'ai-error-unavailable') {
      $('aiErrorHeading').textContent = 'Guidance isn’t available right now.';
      $('aiErrorBody').textContent = 'Your reflection is safely saved in Vault.';
      showReflectView('AIError');
    } else if (s === 'ai-error-connection') {
      $('aiErrorHeading').textContent = 'We couldn’t connect.';
      $('aiErrorBody').textContent = 'Your reflection is still saved in Vault.';
      showReflectView('AIError');
    } else if (s === 'crisis') {
      if (!reflectInput.value) reflectInput.value = 'I don’t know how much longer I can keep pretending I’m okay.';
      $('vaultSavedText').textContent = reflectInput.value;
      showReflectView('Crisis');
      setTimeout(function () { openSupport('open'); }, 550);
    }
    renderFooter();
  }
  $('reflectViewRestored').addEventListener('click', function () { document.body.classList.remove('rt-reflect-restored'); reflectInput.focus(); });

  // ---- Save Reflection → Vault (simulated async save) ----
  function saveReflection() {
    setReflectState('saving');
    setTimeout(function () { setReflectState('saved'); }, 900);
  }

  // ---- Optional AI guidance: consent → loading → response/error ----
  var aiReturnFocus = null;
  function openAIConsent() {
    aiReturnFocus = document.activeElement;
    $('aiConsentScrim').classList.add('open');
    $('aiConsentSheet').classList.add('open');
    setTimeout(function () { $('aiConsentYesBtn').focus(); }, 60);
  }
  function closeAIConsent() {
    $('aiConsentScrim').classList.remove('open');
    $('aiConsentSheet').classList.remove('open');
    if (aiReturnFocus) { try { aiReturnFocus.focus(); } catch (e) {} }
  }
  var aiLoadingTimer = null;
  function startAIGuidance() {
    closeAIConsent();
    setReflectState('ai-loading');
    clearTimeout(aiLoadingTimer);
    aiLoadingTimer = setTimeout(function () { setReflectState('ai-response'); }, 1600);
  }
  function cancelAIRequest() {
    clearTimeout(aiLoadingTimer);
    setReflectState('saved'); // Request Cancelled → back to saved-to-Vault state, reflection untouched
  }
  function reflectMore() {
    setReflectState('saved'); // returns to the existing saved reflection — never deletes/overwrites it
  }
  function retryAIRequest() {
    setReflectState('ai-loading');
    clearTimeout(aiLoadingTimer);
    aiLoadingTimer = setTimeout(function () { setReflectState('ai-response'); }, 1600);
  }

  $('aiConsentYesBtn').addEventListener('click', startAIGuidance);
  $('aiConsentCancelBtn').addEventListener('click', closeAIConsent); // Cancel returns to saved-to-Vault state (sheet closes, underlying view is already 'saved')
  $('aiConsentScrim').addEventListener('click', closeAIConsent);
  $('aiLoadingCancelBtn').addEventListener('click', cancelAIRequest);

  // ---- Draft/Vault conflict recovery overlay ----
  function showDraftConflict() { $('draftConflictDemo').classList.add('open'); }
  function hideDraftConflict() { $('draftConflictDemo').classList.remove('open'); }
  $('conflictKeepSavedBtn').addEventListener('click', hideDraftConflict);
  $('conflictReviewDraftBtn').addEventListener('click', hideDraftConflict);

  // ---- footer secondary button dispatch (Receive Guidance / Reflect More / Try Again) ----
  $('rSecondaryBtn').addEventListener('click', function () {
    var rs = state.reflectState;
    if (rs === 'saved') { openAIConsent(); return; }
    if (rs === 'ai-response') { reflectMore(); return; }
    if (rs === 'ai-error-unavailable' || rs === 'ai-error-connection') { retryAIRequest(); return; }
  });

  // ---- support drawer ----
  var supportReturnFocus = null;
  function openSupport(uiState) {
    uiState = uiState || 'open';
    var scrim = $('supportScrim'), sheet = $('supportSheet'), helpBtn = $('rHelpBtn');
    helpBtn.classList.remove('focused');
    if (uiState === 'resting') { scrim.classList.remove('open'); sheet.classList.remove('open'); return; }
    if (uiState === 'focused') { helpBtn.classList.add('focused'); scrim.classList.remove('open'); sheet.classList.remove('open'); return; }
    supportReturnFocus = document.activeElement;
    scrim.classList.add('open'); sheet.classList.add('open');
    setTimeout(function () { $('supportCloseBtn').focus(); }, 60);
  }
  function closeSupport() {
    $('supportScrim').classList.remove('open');
    $('supportSheet').classList.remove('open');
    $('rHelpBtn').classList.remove('focused');
    if (supportReturnFocus) { try { supportReturnFocus.focus(); } catch (e) {} }
  }
  $('rHelpBtn').addEventListener('click', function () { openSupport('open'); });
  $('supportCloseBtn').addEventListener('click', closeSupport);
  $('supportScrim').addEventListener('click', closeSupport);

  // ---- close / primary / back ----
  $('rCloseBtn').addEventListener('click', function () { alert('[SIMULATED] Close returns to the real Journey home. Unchanged existing behavior (dfBack).'); });
  $('rPrimaryBtn').addEventListener('click', function () {
    if (currentStep() === 6) {
      var rs = state.reflectState;
      if (REFLECT_WRITING_STATES[rs]) { saveReflection(); return; }
      if (REFLECT_SAVED_FAMILY[rs]) { nextStep(); return; }
      return; // saving / ai-loading — primary is disabled
    }
    nextStep();
  });
  $('rBackLink').addEventListener('click', prevStep);
  $('rReviewBackBtn').addEventListener('click', function () { closeReview(); });

  // ---- review mode ----
  function openReview(step) {
    state.reviewing = true;
    state.reviewStep = step || 1;
    renderAll();
  }
  function closeReview() {
    state.reviewing = false;
    renderAll();
  }

  // ---- resume / day-opening demo overlays ----
  function showResume() { $('resumeDemo').classList.add('open'); }
  function hideResume() { $('resumeDemo').classList.remove('open'); }
  $('resumeCloseBtn').addEventListener('click', hideResume);
  $('resumeBtn').addEventListener('click', hideResume);

  function showDayOpeningTransition() { $('dayOpenDemo').classList.add('open'); }
  function hideDayOpeningTransition() { $('dayOpenDemo').classList.remove('open'); }
  $('dayOpenBeginBtn').addEventListener('click', function () { hideDayOpeningTransition(); goToStep(1); });

  // ---- Scripture follow-through: reader deep-link + dashboard resume card.
  // Representative recreations, not rebuilds of word.astro or the real
  // Journey Dashboard. See README and spec.md "Scripture Follow-Through". ----
  function showScriptureReader() { $('scriptureReaderDemo').classList.add('open'); }
  function hideScriptureReader() { $('scriptureReaderDemo').classList.remove('open'); }
  $('aiNextScriptureLink').addEventListener('click', showScriptureReader);
  $('readerBackBtn').addEventListener('click', hideScriptureReader);

  function showDashboardResume() { $('dashboardResumeDemo').classList.add('open'); }
  function hideDashboardResume() { $('dashboardResumeDemo').classList.remove('open'); }
  $('dashboardResumeDismissBtn').addEventListener('click', hideDashboardResume);
  $('dashboardResumeOpenBtn').addEventListener('click', function () { hideDashboardResume(); showScriptureReader(); });

  // ---- Vault destination demo (separate app surface — reuses existing
  // Vault structure/navigation conceptually; NOT real vault.astro markup,
  // NOT wired to convex/vault.ts or vault-store.js. See README. ----
  var vaultViews = ['List', 'Detail', 'Private'];
  function showVault(view) {
    view = view || 'List';
    $('vaultDemo').classList.add('open');
    vaultViews.forEach(function (v) {
      var el = $('vd' + v);
      if (el) el.style.display = v === view ? 'block' : 'none';
    });
  }
  function hideVault() { $('vaultDemo').classList.remove('open'); }
  $('vaultCloseBtn').addEventListener('click', hideVault);
  $('vdCardReflection').addEventListener('click', function () { showVault('Detail'); });
  $('vdDetailBack').addEventListener('click', function () { showVault('List'); });
  $('vdPrivateBack').addEventListener('click', function () { showVault('List'); });
  $('reflectVaultLink').addEventListener('click', function () { showVault('List'); });

  // ---- accessibility toggles ----
  function setReducedMotion(on) {
    state.reducedMotion = !!on;
    document.body.classList.toggle('rt-reduced-motion', state.reducedMotion);
  }
  function setLargerText(on) {
    state.largerText = !!on;
    document.body.classList.toggle('rt-larger-text', state.largerText);
  }
  function setZoom(pct) {
    document.body.classList.toggle('zoom-200', pct >= 200);
  }
  function hideSimBadge() { $('simBadge').style.display = 'none'; document.body.setAttribute('data-hide-badge', ''); }
  function showSimBadge() { $('simBadge').style.display = ''; document.body.removeAttribute('data-hide-badge'); }

  // ---- keyboard: Escape closes the topmost open overlay ----
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('supportSheet').classList.contains('open')) { closeSupport(); return; }
    if ($('aiConsentSheet').classList.contains('open')) { closeAIConsent(); return; }
    if ($('vaultDemo').classList.contains('open')) { hideVault(); return; }
    if ($('scriptureReaderDemo').classList.contains('open')) { hideScriptureReader(); return; }
    if ($('dashboardResumeDemo').classList.contains('open')) { hideDashboardResume(); return; }
  });

  renderAll();
  hideSimBadge(); // hidden by default so it never overlaps the shell's own top bar in screenshots; call window.__proto.showSimBadge() for the one explicit disclaimer reference shot

  window.__proto = {
    goToStep: goToStep, nextStep: nextStep, prevStep: prevStep, setDay: setDay,
    setGate: setGate, setBreathPhase: setBreathPhase, runBreathSequence: runBreathSequence,
    setReflectState: setReflectState, saveReflection: saveReflection,
    openAIConsent: openAIConsent, closeAIConsent: closeAIConsent, startAIGuidance: startAIGuidance,
    cancelAIRequest: cancelAIRequest, reflectMore: reflectMore, retryAIRequest: retryAIRequest,
    showDraftConflict: showDraftConflict, hideDraftConflict: hideDraftConflict,
    showVault: showVault, hideVault: hideVault,
    showScriptureReader: showScriptureReader, hideScriptureReader: hideScriptureReader,
    showDashboardResume: showDashboardResume, hideDashboardResume: hideDashboardResume,
    openSupport: openSupport, closeSupport: closeSupport,
    openReview: openReview, closeReview: closeReview,
    showResume: showResume, hideResume: hideResume,
    showDayOpeningTransition: showDayOpeningTransition, hideDayOpeningTransition: hideDayOpeningTransition,
    setReducedMotion: setReducedMotion, setLargerText: setLargerText, setZoom: setZoom,
    setTheme: setTheme, setTopLabelStyle: setTopLabelStyle,
    hideSimBadge: hideSimBadge, showSimBadge: showSimBadge,
    state: state
  };
})();
