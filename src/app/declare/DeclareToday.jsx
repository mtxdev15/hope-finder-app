/* Declare /today — the hero island.
   Ports the proven v1 Declare flow (src/app/app.jsx) into the v3.2 dark-cinematic
   design: name a struggle -> call the Worker (declare-api) -> receive 3 verses,
   a reflection, declarations, and a prayer. State-driven, swap-in-place; no
   account gate before results. Crisis is a user-tapped in-island view. */
import React, { useState } from 'react';
import { generateContent, isCompleteResult } from './declare-api.js';
import { DB_CATEGORIES, DB_CRISIS } from '../../data/content.js';
import './declare-today.css';

const TRANSLATIONS = ['NKJV', 'NLT', 'NIV'];

/* ---------- tiny inline icons (match the v3.2 stroke style) ---------- */
const I = {
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>,
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.4A1.4 1.4 0 0 1 5.4 4H11v15.2H5.4A1.4 1.4 0 0 0 4 20.6z" /><path d="M20 5.4A1.4 1.4 0 0 0 18.6 4H13v15.2h5.6A1.4 1.4 0 0 1 20 20.6z" /></svg>,
  bulb: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.2 1 2.5h6c0-1.3.3-1.8 1-2.5A6 6 0 0 0 12 3z" /></svg>,
  mic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></svg>,
  hands: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-1-4-4-5-5-7-1.5-3 1-5 2.5-2.5L12 14l2.5-2.5C16 9 18.5 11 17 14c-1 2-4 3-5 7z" /></svg>,
  play: <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 4.5v15l13-7.5z" /></svg>,
  pause: <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></svg>,
  crisis: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.4" /><line x1="5.6" y1="5.6" x2="9.6" y2="9.6" /><line x1="14.4" y1="14.4" x2="18.4" y2="18.4" /><line x1="18.4" y1="5.6" x2="14.4" y2="9.6" /><line x1="9.6" y1="14.4" x2="5.6" y2="18.4" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  life: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.6" /><path d="M4.9 4.9l3.6 3.6M15.5 15.5l3.6 3.6M19.1 4.9l-3.6 3.6M8.5 15.5l-3.6 3.6" /></svg>,
};

/* split a prayer so the trailing "Amen." can be emphasized like the design */
function splitPrayer(prayer) {
  const m = (prayer || '').match(/^([\s\S]*?)(\bamen\.?)\s*$/i);
  if (m) return { body: m[1].trim(), amen: m[2].replace(/\.?$/, '.') };
  return { body: (prayer || '').trim(), amen: '' };
}

export default function DeclareToday() {
  const [view, setView] = useState('entry'); // 'entry' | 'results' | 'crisis'
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState('');
  const [translation, setTranslation] = useState('NKJV');
  const [active, setActive] = useState('');
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [usedRefs, setUsedRefs] = useState([]);
  const [speakingIdx, setSpeakingIdx] = useState(-1);
  const [hint, setHint] = useState('');

  const struggle = (custom.trim() || selected || '').trim();

  async function runGen(s) {
    setLoading(true);
    setError(false);
    setContent(null);
    if (typeof window !== 'undefined' && window.RouteLoader) window.RouteLoader.show();
    try {
      const ai = await generateContent(s, translation, usedRefs, { temperature: 0.9 });
      if (!isCompleteResult(ai)) throw new Error('incomplete result');
      setContent(ai);
      setUsedRefs((prev) => [...prev, ...ai.verses.map((v) => v.ref)]);
    } catch (e) {
      console.error('[DeclareToday] generation failed:', e);
      setError(true);
    } finally {
      setLoading(false);
      if (typeof window !== 'undefined' && window.RouteLoader) window.RouteLoader.hide();
    }
  }

  function submit() {
    if (!struggle) {
      setHint('Choose what fits, or write it in your own words.');
      return;
    }
    setHint('');
    setActive(struggle);
    setView('results');
    runGen(struggle);
  }

  function reset() {
    stopSpeak();
    setView('entry');
    setContent(null);
    setError(false);
  }

  function stopSpeak() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeakingIdx(-1);
  }

  function speak(i, text) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingIdx === i) { stopSpeak(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.86; u.pitch = 1.02;
    u.onend = () => setSpeakingIdx(-1);
    u.onerror = () => setSpeakingIdx(-1);
    setSpeakingIdx(i);
    window.speechSynthesis.speak(u);
  }

  /* ---------- CRISIS VIEW ---------- */
  if (view === 'crisis') {
    return (
      <div className="dt">
        <div className="dt-topglow" aria-hidden="true" />
        <div className="dt-col">
          <div className="dt-head">
            <button className="iconbtn" onClick={() => setView('entry')} aria-label="Back">{I.back}</button>
            <span className="mid">You are not alone</span>
          </div>
          <div className="dt-crisis-view">
            <h1>Help is available right now.</h1>
            <p className="lead">If you are in crisis or thinking about ending your life, please reach out immediately. These lines are free, confidential, and open 24/7.</p>
            {DB_CRISIS.map((c) => (
              <a className="dt-crisrow" key={c.name} href={c.href}>
                <span className="cic">{I.life}</span>
                <span>
                  <span className="cname">{c.name}</span>
                  <span className="ccontact">{c.contact}</span>
                  <span className="cnote">{c.note}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- RESULTS VIEW (loading / error / content) ---------- */
  if (view === 'results') {
    return (
      <div className="dt">
        <div className="dt-topglow" aria-hidden="true" />
        <div className="dt-col">
          <div className="dt-head">
            <button className="iconbtn" onClick={reset} aria-label="Back">{I.back}</button>
            <span className="mid">For {active}</span>
          </div>

          {loading && (
            <div className="dt-loading">
              <div className="dt-spin" />
              <p>Receiving the Word for you…</p>
            </div>
          )}

          {!loading && error && (
            <div className="dt-error">
              <p>Something interrupted this. The Word is still here — let’s try again.</p>
              <div className="dt-error-actions">
                <button className="btn btn-primary" onClick={() => runGen(active)}>Try again</button>
                <button className="btn btn-ghost" onClick={reset}>Go back</button>
              </div>
            </div>
          )}

          {!loading && !error && content && (
            <>
              <div className="intro"><div className="serif">Walk through this slowly.</div></div>

              <div className="journey">
                {/* Scripture — all three verses */}
                <div className="stn">
                  <span className="node" aria-hidden="true">{I.book}</span>
                  <div className="stnhead"><span className="lbl">Scripture</span></div>
                  {content.verses.map((v, i) => (
                    <div className="dt-verse" key={v.ref + '-' + i}>
                      <div className="verse">“{v.text}”</div>
                      <div className="ref">{v.ref} · {translation}</div>
                    </div>
                  ))}
                </div>

                {/* Reflection */}
                <div className="stn">
                  <span className="node" aria-hidden="true">{I.bulb}</span>
                  <div className="stnhead"><span className="lbl">Reflect</span></div>
                  <p className="body">{content.explanation}</p>
                </div>

                {/* Declarations — speak aloud */}
                <div className="stn">
                  <span className="node" aria-hidden="true">{I.mic}</span>
                  <div className="stnhead"><span className="lbl">Speak it aloud</span></div>
                  <div className="speak">
                    {content.declarations.map((d, i) => (
                      <div className={'card srow' + (speakingIdx === i ? ' speaking' : '')} key={i}>
                        <button className="play" onClick={() => speak(i, d)} aria-label={speakingIdx === i ? 'Stop' : 'Speak'}>
                          {speakingIdx === i ? I.pause : I.play}
                        </button>
                        <span className="dec">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prayer */}
                <div className="stn">
                  <span className="node" aria-hidden="true">{I.hands}</span>
                  <div className="stnhead"><span className="lbl">Prayer</span></div>
                  <div className="praywrap">
                    <div className="prayglow" aria-hidden="true" />
                    <div className="pray">
                      <p className="ptext">{splitPrayer(content.prayer).body}</p>
                      {splitPrayer(content.prayer).amen && (
                        <div className="amen">{splitPrayer(content.prayer).amen}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="dt-foot">
                <button className="again" onClick={reset}>Speak a different word</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---------- ENTRY VIEW ---------- */
  return (
    <div className="dt">
      <div className="dt-topglow" aria-hidden="true" />
      <div className="dt-col">
        <div className="entryhero">
          <div className="heading">What’s weighing on your heart?</div>
          <div className="sub">Name it, and receive His Word for this moment.</div>
        </div>

        <div className="dt-well">
          <textarea
            value={custom}
            onChange={(e) => { setCustom(e.target.value); if (hint) setHint(''); }}
            placeholder="Write what’s on your heart…"
            aria-label="Write what's on your heart"
          />
        </div>

        <div className="dt-divider"><span>or choose what fits</span></div>

        {DB_CATEGORIES.map((g) => (
          <div className="dt-cat" key={g.cat}>
            <span className="lbl">{g.cat}</span>
            <div className="dt-chips">
              {g.items.map((it) => (
                <button
                  key={it}
                  className={'chip' + (selected === it ? ' on' : '')}
                  aria-pressed={selected === it}
                  onClick={() => setSelected(selected === it ? null : it)}
                >
                  {it}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="dt-trans">
          <span className="tlabel">Translation</span>
          <div className="dt-pills">
            {TRANSLATIONS.map((t) => (
              <button
                key={t}
                className={'chip' + (translation === t ? ' on' : '')}
                onClick={() => setTranslation(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="dt-cta">
          <button className="btn btn-primary btn-full" onClick={submit}>Receive the Word</button>
          {hint && <p className="ref" style={{ textAlign: 'center', marginTop: 12 }}>{hint}</p>}
        </div>

        <button className="dt-crisis" onClick={() => setView('crisis')}>
          <span className="cx">{I.crisis}</span>
          <span>In crisis? Find help now</span>
          {I.arrow}
        </button>
      </div>
    </div>
  );
}
