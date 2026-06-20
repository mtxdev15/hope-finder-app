/* Declare & Believe — testimonial wall loader.
   Fetches APPROVED + PUBLIC reviews from Convex (anonymous public query, so it
   works for signed-out visitors) and renders them into [data-testimonials].
   Self-hides when there are no approved reviews yet — an empty wall never ships.
   No PII beyond what the user chose to make public (first name + their words). */
(function () {
  var CONVEX = 'https://keen-hamster-650.convex.cloud';
  var STAR = 'M12 17.3l-5.6 3 1.1-6.3L3 9.6l6.3-.9L12 3l2.7 5.7 6.3.9-4.5 4.4 1.1 6.3z';

  var mount = document.querySelector('[data-testimonials]');
  if (!mount) return;

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function overall(r) { return Math.round((r.score_met_you + r.score_the_word + r.score_coming_back) / 3); }
  function dimAvg(list, key) { var s = 0; for (var i = 0; i < list.length; i++) s += list[i][key]; return s / list.length; }
  function dimRow(label, v) {
    return '<div class="tw-dim"><span class="tw-dim-lbl">' + label + '</span>'
      + '<span class="tw-dim-bar"><span class="tw-dim-fill" style="width:' + (v / 5 * 100).toFixed(0) + '%"></span></span>'
      + '<span class="tw-dim-num">' + v.toFixed(1) + '</span></div>';
  }
  function stars(n) {
    var s = '';
    for (var i = 1; i <= 5; i++) {
      s += '<svg class="tw-star' + (i <= n ? ' on' : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR + '"></path></svg>';
    }
    return s;
  }
  function when(ts) {
    try { return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  function render(list) {
    var sum = 0;
    for (var i = 0; i < list.length; i++) sum += (list[i].score_met_you + list[i].score_the_word + list[i].score_coming_back) / 3;
    var avg = sum / list.length;

    // Marquee cards from testimonial-bearing reviews (oevra "words of affirmation").
    var cardArr = list.filter(function (r) { return r.testimonial && r.testimonial.trim(); });
    function oneCard(r) {
      var name = (r.firstName || 'Friend').trim() || 'Friend';
      return '<figure class="tw-card">'
        + '<span class="tw-mark" aria-hidden="true"></span>'
        + '<blockquote class="tw-quote">' + esc(r.testimonial) + '</blockquote>'
        + '<svg class="tw-div" width="28" height="2" viewBox="0 0 28 2" fill="none" aria-hidden="true"><path d="M0 1L28 1" stroke="var(--gold)" stroke-width="2" stroke-dasharray="4 4 10 6"></path></svg>'
        + '<figcaption class="tw-name">' + esc(name) + '</figcaption>'
        + '</figure>';
    }
    var marquee = '';
    if (cardArr.length) {
      var cardsHtml = cardArr.map(oneCard).join('');
      // Repeat so one "set" comfortably exceeds the viewport, then duplicate for the -50% loop.
      var reps = Math.max(2, Math.ceil(8 / cardArr.length));
      var base = '';
      for (var k = 0; k < reps; k++) base += cardsHtml;
      var dur = cardArr.length * reps * 6; // seconds; even pace as the count grows
      marquee = '<div class="tw-marquee"><div class="tw-track" style="--tw-dur:' + dur + 's">' + base
        + '<span style="display:contents" aria-hidden="true">' + base + '</span></div></div>';
    }

    mount.innerHTML = '<div class="tw">'
      + '<div class="tw-head">'
      + '<h2 class="tw-h serif">How the Word has met people</h2>'
      + '<div class="tw-avg">'
      + '<span class="tw-avgnum serif">' + avg.toFixed(1) + '</span><span class="tw-avgof">of 5</span>'
      + '<span class="tw-avgstars" aria-hidden="true">' + stars(Math.round(avg)) + '</span>'
      + '<span class="tw-count">' + list.length + (list.length === 1 ? ' testimony' : ' testimonies') + '</span>'
      + '</div>'
      + '<div class="tw-dims">'
      + dimRow('Met you', dimAvg(list, 'score_met_you'))
      + dimRow('The Word', dimAvg(list, 'score_the_word'))
      + dimRow('Coming back', dimAvg(list, 'score_coming_back'))
      + '</div>'
      + '</div>'
      + marquee
      + '</div>';
    mount.removeAttribute('hidden');

    // Arrived via "See what others are saying" (#testimonials)? Land on the section.
    if (location.hash === '#testimonials') {
      var sec = document.getElementById('testimonials') || mount;
      setTimeout(function () { try { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 90);
    }
  }

  try {
    fetch(CONVEX + '/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'reviews:listApprovedPublic', args: {}, format: 'json' }),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var list = (res && res.status === 'success' && Array.isArray(res.value)) ? res.value : [];
        if (list.length) render(list); // else: stays hidden
      })
      .catch(function () { /* network/Convex down: leave the section hidden */ });
  } catch (e) { /* leave hidden */ }
})();
