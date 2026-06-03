/* Declare & Believe — Scripture (the Bible: 66 books, read & study)
   Self-contained feature. Reads real chapter text from bible-api.com
   (public-domain KJV / WEB), caches it locally for re-reads & offline. */
import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import ShareSheet from './ShareSheet.jsx';
import { DB_BIBLE, DB_BIBLE_TRANSLATIONS } from '../data/bible.js';

  const POS_KEY = 'db_bible_pos';
  const TRANS_KEY = 'db_bible_trans';
  const SIZE_KEY = 'db_bible_size';
  const HL_KEY = 'db_bible_highlights';
  /* highlight palette — `sw` is the solid swatch shown in the picker; the
     applied verse tint is a softer, theme-aware wash defined in CSS (.hl-<id>). */
  const HL_COLORS = [
    { id: 'gold', label: 'Gold', sw: '#D9B45A' },
    { id: 'olive', label: 'Olive', sw: '#5E8A74' },
    { id: 'rose', label: 'Rose', sw: '#C9695C' },
    { id: 'sky', label: 'Sky', sw: '#6F9FCF' }];
  const cacheLS = (k) => {try {return JSON.parse(localStorage.getItem('db_bible_cache_' + k) || 'null');} catch (e) {return null;}};
  const cacheSet = (k, v) => {try {localStorage.setItem('db_bible_cache_' + k, JSON.stringify(v));} catch (e) {}};

  /* ---- book list (testament toggle + categories) ---- */
  function BookList({ onOpenBook, savedByBook, resume, onResume, query, setQuery, testament, setTestament }) {
    const data = DB_BIBLE[testament];
    const q = query.trim().toLowerCase();

    const groups = data.groups.
    map((g) => ({ ...g, books: g.books.filter((b) => !q || b.name.toLowerCase().includes(q)) })).
    filter((g) => g.books.length);

    return (
      <div className="sc-list">
        <div className="sc-search">
          <Icon name="scripture" size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a book…" />
          {query && <button className="sc-clear" onClick={() => setQuery('')} aria-label="Clear"><Icon name="close" size={15} /></button>}
        </div>

        <div className="sc-seg" role="tablist">
          {['OT', 'NT'].map((t) =>
          <button key={t} className={'sc-segbtn' + (testament === t ? ' on' : '')} onClick={() => setTestament(t)}>
              {DB_BIBLE[t].label}
            </button>
          )}
        </div>

        {!q && resume &&
        <button className="sc-resume" onClick={onResume}>
            <span className="sc-resume-l">
              <span className="sc-resume-cap">Continue reading</span>
              <span className="sc-resume-ref">{resume.book} {resume.chapter}</span>
            </span>
            <Icon name="play" size={16} />
          </button>
        }

        {!q && <p className="sc-blurb">{data.blurb}</p>}

        {groups.map((g) =>
        <section className="sc-group" key={g.title}>
            <div className="sc-grouphead">
              <span className="sc-grouptitle">{g.title}</span>
              <span className="sc-groupsub">{g.sub}</span>
            </div>
            {!q && g.note && <p className="sc-groupnote">{g.note}</p>}
            <div className="sc-books">
              {g.books.map((b) => {
              const saved = savedByBook[b.name] || 0;
              return (
                <button className="sc-book" key={b.name} onClick={() => onOpenBook(b)}>
                    <span className="sc-bookmain">
                      <span className="sc-bookname">{b.name}</span>
                      <span className="sc-bookmeta">{b.tag}</span>
                      <span className="sc-bookchapters">{b.chapters + (b.chapters > 1 ? ' chapters' : ' chapter')}</span>
                    </span>
                    {saved > 0 && <span className="sc-booksaved"><Icon name="bookmarkfill" size={12} /> {saved}</span>}
                    <span className="sc-bookchev"><Icon name="arrow" size={16} /></span>
                  </button>);

            })}
            </div>
          </section>
        )}
      </div>);

  }

  /* ---- chapter picker ---- */
  function ChapterPicker({ book, onPick, onBack }) {
    return (
      <div className="sc-chapters">
        <div className="sc-subhead">
          <button className="sc-back" onClick={onBack}><Icon name="arrow" size={18} /></button>
          <div className="sc-subtitle">
            <span className="sc-subname">{book.name}</span>
            <span className="sc-subnote">Choose a chapter</span>
          </div>
        </div>
        <div className="sc-chapgrid">
          {Array.from({ length: book.chapters }, (_, i) => i + 1).map((n) =>
          <button className="sc-chap" key={n} onClick={() => onPick(n)}>{n}</button>
          )}
        </div>
      </div>);

  }

  /* ---- verse picker (explicit "Select a verse" step after a chapter) ---- */
  function VersePicker({ book, chapter, selected, savedVerses, onPickVerse, onReadAll, onBack }) {
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
      let alive = true;
      setLoading(true); setError('');
      const id = selected[0];
      const t = DB_BIBLE_TRANSLATIONS.find((x) => x.id === id);
      const api = (t && t.api) || 'kjv';
      const ref = book.name + ' ' + chapter;
      const ck = (ref + ' ' + api).replace(/\s+/g, '_').toLowerCase();
      const cached = cacheLS(ck);
      if (cached) { setCount(cached.length); setLoading(false); return; }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      fetch('https://bible-api.com/' + encodeURIComponent(ref) + '?translation=' + api, { signal: ctrl.signal }).
        then((r) => r.ok ? r.json() : Promise.reject(r.status)).
        then((d) => { if (!alive) return; const vs = (d.verses || []).map((v) => ({ n: v.verse, t: (v.text || '').replace(/\s+/g, ' ').trim() })); if (vs.length) cacheSet(ck, vs); setCount(vs.length); setLoading(false); }).
        catch(() => { if (alive) { setError('net'); setLoading(false); } }).
        finally(() => clearTimeout(timer));
      window.scrollTo({ top: 0, behavior: 'instant' });
      return () => { alive = false; };
    }, [book, chapter, selected[0]]);

    const isSaved = (n) => savedVerses.some((v) => v.ref === book.name + ' ' + chapter + ':' + n);

    return (
      <div className="sc-verses-pick">
        <div className="sc-subhead">
          <button className="sc-back" onClick={onBack}><Icon name="arrow" size={18} /></button>
          <div className="sc-subtitle">
            <span className="sc-subname">{book.name} {chapter}</span>
            <span className="sc-subnote">Select a verse</span>
          </div>
        </div>

        {loading &&
        <div className="sc-loading"><div className="sc-spinner" /><p>Loading {book.name} {chapter}…</p></div>}

        {!loading && error &&
        <div className="sc-error">
          <p>Couldn’t load this chapter. Check your connection.</p>
          <button className="sc-retry" onClick={() => { setError(''); setLoading(true); setCount(0); /* re-trigger */ setTimeout(() => setCount((c) => c), 0); }}>Try again</button>
          <button className="sc-readall ghost" onClick={onReadAll}>Read the whole chapter instead</button>
        </div>}

        {!loading && !error &&
        <>
          <button className="sc-readall" onClick={onReadAll}>
            <Icon name="book" size={17} /> Read the whole chapter
          </button>
          <div className="sc-vplabel">Or jump to a verse</div>
          <div className="sc-vpgrid">
            {Array.from({ length: count }, (_, i) => i + 1).map((n) =>
            <button key={n} className={'scv-cell' + (isSaved(n) ? ' saved' : '')} onClick={() => onPickVerse(n)}>{n}</button>
            )}
          </div>
        </>}
      </div>);

  }

  /* ---- translation picker sheet (multi-select) ---- */
  function TranslationSheet({ selected, onToggle, onClose }) {
    const list = DB_BIBLE_TRANSLATIONS;
    return (
      <div className="sc-sheet-scrim" onClick={onClose}>
        <div className="sc-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sc-sheet-head">
            <div>
              <div className="sc-sheet-title">Translations</div>
              <div className="sc-sheet-sub">Pick one — or several to read side by side.</div>
            </div>
            <button className="modal-x" onClick={onClose}><Icon name="close" size={18} /></button>
          </div>
          <div className="sc-sheet-body">
            {list.map((t, i) => {
              const on = selected.includes(t.id);
              return (
                <button key={t.id} className={'sc-trow' + (on ? ' on' : '')}
                  onClick={() => onToggle(t.id)}>
                  <span className={'sc-trow-check' + (on ? ' on' : '')}>
                    {on ? <Icon name="check" size={14} /> : null}
                  </span>
                  <span className="sc-trow-main">
                    <span className="sc-trow-top">
                      <span className="sc-trow-label">{t.label}</span>
                      <span className="sc-trow-type">{t.type}</span>

                    </span>
                    <span className="sc-trow-name">{t.name}</span>
                    <span className="sc-trow-why">{t.why}</span>
                  </span>
                </button>
              );
            })}

          </div>
        </div>
      </div>
    );
  }

  /* ---- verse action popup (save · highlight · copy · share) ---- */
  function VerseActionSheet({ active, saved, highlight, onSave, onHighlight, onClose }) {
    const [copied, setCopied] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [dragY, setDragY] = useState(0);
    const drag = useRef({ startY: 0, on: false });
    const quote = '\u201C' + active.t + '\u201D \u2014 ' + active.ref + ' (' + active.translation + ')';
    const copy = () => {
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(quote);
      } catch (e) {}
      setCopied(true);setTimeout(() => setCopied(false), 1600);
    };
    const sharePayload = () => ({
      title: 'Share this verse',
      subtitle: active.ref + ' \u00b7 ' + active.translation,
      glyph: <Icon name="scripture" size={20} />,
      text: quote,
      blurb: quote,
      subject: active.ref,
      url: 'https://www.biblegateway.com/passage/?search=' + encodeURIComponent(active.ref) });
    // pull-down-to-dismiss on the grip handle (iOS-style)
    const onStart = (e) => {drag.current = { startY: e.touches[0].clientY, on: true };};
    const onMove = (e) => {
      if (!drag.current.on) return;
      const dy = Math.max(0, e.touches[0].clientY - drag.current.startY);
      setDragY(dy);
    };
    const onEnd = () => {
      if (!drag.current.on) return;
      drag.current.on = false;
      if (dragY > 90) {onClose();} else {setDragY(0);}
    };
    return (
      <div className="sc-sheet-scrim" onClick={onClose}>
        <div className="vsheet" onClick={(e) => e.stopPropagation()}
          style={{ transform: dragY ? 'translateY(' + dragY + 'px)' : '', transition: drag.current.on ? 'none' : 'transform .28s cubic-bezier(.2,.8,.2,1)' }}>
          <div className="vsheet-handle" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}>
            <div className="vsheet-grip" />
          </div>
          <button className="vsheet-close" onClick={onClose} aria-label="Close"><Icon name="close" size={17} /></button>
          <div className="vsheet-ref">
            <span className="vsheet-refname">{active.ref}</span>
            <span className="vsheet-reftrans">{active.translation}</span>
          </div>
          <p className="vsheet-text">{active.t}</p>

          <div className="vsheet-hllabel"><Icon name="highlighter" size={14} /> Highlight</div>
          <div className="vsheet-hls">
            {HL_COLORS.map((c) =>
            <button key={c.id} className={'vsheet-hl' + (highlight === c.id ? ' on' : '')}
              style={{ background: c.sw }} onClick={() => onHighlight(highlight === c.id ? null : c.id)}
              aria-label={c.label} title={c.label}>
                {highlight === c.id && <Icon name="check" size={17} />}
              </button>
            )}
            <button className={'vsheet-hl none' + (!highlight ? ' on' : '')} onClick={() => onHighlight(null)}
              aria-label="No highlight" title="No highlight"><Icon name="close" size={15} /></button>
          </div>

          <div className="vsheet-actions">
            <button className={'vsheet-act' + (saved ? ' on' : '')} onClick={onSave}>
              <Icon name={saved ? 'bookmarkfill' : 'bookmark'} size={19} />
              <span>{saved ? 'Saved' : 'Save'}</span>
            </button>
            <button className="vsheet-act" onClick={copy}>
              <Icon name={copied ? 'check' : 'copy'} size={19} />
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button className="vsheet-act" onClick={() => setShareOpen(true)}>
              <Icon name="share" size={19} />
              <span>Share</span>
            </button>
          </div>
        </div>
        {shareOpen && ShareSheet && <ShareSheet payload={sharePayload()} onClose={() => setShareOpen(false)} />}
      </div>);

  }

  /* ---- reader (single or parallel compare) ---- */
  function Reader({ book, chapter, setChapter, selected, freeTrans, onManage, savedVerses, onToggleVerse, onBack, display, onOpenSettings, highlights, onHighlight, gotoVerse, onGotoDone }) {
    const [data, setData] = useState({}); // { transId: [{n,t}] }
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [active, setActive] = useState(null); // verse tapped → action popup
    const [jumpOpen, setJumpOpen] = useState(false); // verse-picker sheet
    const [pulseN, setPulseN] = useState(0); // verse momentarily emphasized after a jump
    const selKey = selected.join(',');

    useEffect(() => {
      let alive = true;
      setError(''); setLoading(true);
      const ref = book.name + ' ' + chapter;
      const transById = (id) => DB_BIBLE_TRANSLATIONS.find((x) => x.id === id);
      Promise.all(selected.map((id) => {
        const t = transById(id); const api = (t && t.api) || 'kjv';
        const ck = (ref + ' ' + api).replace(/\s+/g, '_').toLowerCase();
        const cached = cacheLS(ck);
        if (cached) return Promise.resolve([id, cached]);
        // abort a stalled request so the reader never hangs (e.g. weak sermon wifi)
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 9000);
        return fetch('https://bible-api.com/' + encodeURIComponent(ref) + '?translation=' + api, { signal: ctrl.signal }).
          then((r) => r.ok ? r.json() : Promise.reject(r.status)).
          then((d) => { const vs = (d.verses || []).map((v) => ({ n: v.verse, t: (v.text || '').replace(/\s+/g, ' ').trim() })); if (vs.length) cacheSet(ck, vs); return [id, vs]; }).
          catch(() => [id, null]).
          finally(() => clearTimeout(timer));
      })).then((pairs) => {
        if (!alive) return;
        const obj = {}; let any = false;
        pairs.forEach(([id, vs]) => { obj[id] = vs; if (vs && vs.length) any = true; });
        setData(obj); setError(any ? '' : 'net'); setLoading(false);
      });
      window.scrollTo({ top: 0, behavior: 'instant' });
      return () => { alive = false; };
    }, [book, chapter, selKey]);

    const labelOf = (id) => { const t = DB_BIBLE_TRANSLATIONS.find((x) => x.id === id); return t ? t.label : id.toUpperCase(); };
    const base = data[selected[0]];
    const refOf = (n) => book.name + ' ' + chapter + ':' + n;
    const isSaved = (n) => savedVerses.some((v) => v.ref === refOf(n));
    const openVerse = (v, id) => setActive({ n: v.n, t: v.t, ref: refOf(v.n), translation: labelOf(id || selected[0]) });
    const compare = selected.length > 1;
    const topLabel = compare ? selected.length + ' versions' : labelOf(selected[0]);

    // smooth-scroll to a verse and briefly emphasize it (used by the verse
    // picker and by deep-links from saved verses). Avoids scrollIntoView.
    const jumpTo = (n) => {
      setJumpOpen(false);
      requestAnimationFrame(() => {
        const el = document.getElementById('scv-' + n);
        if (!el) return;
        const desktop = window.matchMedia('(min-width:1000px)').matches;
        const offset = desktop ? 104 : 16;
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        setPulseN(n);
        setTimeout(() => setPulseN(0), 1800);
      });
    };

    // deep-link: once the chapter text is loaded, scroll to the requested verse
    useEffect(() => {
      if (!gotoVerse || !base) return;
      const t = setTimeout(() => { jumpTo(gotoVerse); if (onGotoDone) onGotoDone(); }, 450);
      return () => clearTimeout(t);
    }, [gotoVerse, base]);

    const verseCount = base ? base.length : 0;

    return (
      <div className={'sc-reader size-' + display.size + ' font-' + display.font}>
        <div className="sc-readerbar">
          <button className="sc-back" onClick={onBack}><Icon name="arrow" size={18} /></button>
          <div className="sc-readertitle">{book.name.toUpperCase()} {chapter} &middot; {topLabel.toUpperCase()}</div>
          <button className="sc-iconbtn" onClick={() => setJumpOpen(true)} aria-label="Jump to a verse" disabled={!base} title="Jump to a verse">
            <Icon name="list" size={19} />
          </button>
          <button className="sc-size" onClick={onOpenSettings} aria-label="Display settings">
            <span className="sc-size-a" style={{ fontSize: 13 }}>A</span><span className="sc-size-a" style={{ fontSize: 18 }}>A</span>
          </button>
        </div>

        <div className="sc-transrow">
          {freeTrans.map((t) => (
            <button key={t.id} className={'sc-tpill' + (selected.includes(t.id) ? ' on' : '')}
              onClick={() => onManage('toggle', t.id)} title={t.name}>{t.label}</button>
          ))}
          <button className="sc-tpill more" onClick={() => onManage('open')}>All translations</button>
        </div>

        <h1 className="sc-readerh">{book.name} {chapter}</h1>

        {loading && !base && <div className="sc-loading"><span className="vspin" /> Loading the Word…</div>}

        {error && !base &&
          <div className="sc-error">
            <Icon name="scripture" size={22} />
            <p>{error === 'net' ? 'Couldn’t reach the scripture library. Check your connection and try again.' : 'This chapter isn’t available right now.'}</p>
            <button className="sc-retry" onClick={() => setChapter(chapter)}>Try again</button>
          </div>
        }

        {base && !compare &&
          <div className="sc-text">
            <p className="sc-verses">
              {base.map((v) =>
                <span key={v.n} id={'scv-' + v.n} className={'sc-v' + (isSaved(v.n) ? ' saved' : '') + (highlights[refOf(v.n)] ? ' hl hl-' + highlights[refOf(v.n)] : '') + (pulseN === v.n ? ' pulse' : '')}
                  onClick={() => openVerse(v)}
                  title="Verse tools — save, highlight, copy">
                  <span className="sc-vn">{v.n}</span>{v.t}{' '}
                </span>
              )}
            </p>
            <p className="sc-hint">Tap any verse to save, highlight, or share it.</p>
          </div>
        }

        {base && compare &&
          <div className="sc-compare">
            {base.map((v) => (
              <div key={v.n} id={'scv-' + v.n} className={'sc-cmp' + (highlights[refOf(v.n)] ? ' hl hl-' + highlights[refOf(v.n)] : '') + (pulseN === v.n ? ' pulse' : '')}>
                <div className="sc-cmp-n">{v.n}</div>
                <div className="sc-cmp-cols">
                  {selected.map((id, ci) => {
                    const arr = data[id]; const vt = arr && arr.find((x) => x.n === v.n);
                    return (
                      <button key={id} className={'sc-cmp-line v' + ci + (isSaved(v.n) ? ' saved' : '')}
                        onClick={() => vt && openVerse(vt, id)}>
                        <span className={'sc-cmp-label v' + ci}>{labelOf(id)}</span>
                        <span className="sc-cmp-text">{vt ? vt.t : '—'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="sc-hint">Tap a verse in any version to save, highlight, or share it.</p>
          </div>
        }

        <div className="sc-readernav">
          <button className="sc-navbtn" disabled={chapter <= 1} onClick={() => setChapter(chapter - 1)}>
            <Icon name="arrow" size={16} /> Previous
          </button>
          <span className="sc-navpos">{chapter} / {book.chapters}</span>
          <button className="sc-navbtn" disabled={chapter >= book.chapters} onClick={() => setChapter(chapter + 1)}>
            Next <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}><Icon name="arrow" size={16} /></span>
          </button>
        </div>

        {active &&
          <VerseActionSheet
            active={active}
            saved={savedVerses.some((v) => v.ref === active.ref)}
            highlight={highlights[active.ref]}
            onSave={() => onToggleVerse({ ref: active.ref, text: active.t, translation: active.translation, struggle: '' })}
            onHighlight={(c) => onHighlight(active.ref, c)}
            onClose={() => setActive(null)} />
        }

        {jumpOpen && verseCount > 0 &&
          <div className="sc-sheet-scrim" onClick={() => setJumpOpen(false)}>
            <div className="sc-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sc-sheet-head">
                <div>
                  <div className="sc-sheet-title">Jump to a verse</div>
                  <div className="sc-sheet-sub">{book.name} {chapter} &middot; {verseCount} verses</div>
                </div>
                <button className="modal-x" onClick={() => setJumpOpen(false)}><Icon name="close" size={18} /></button>
              </div>
              <div className="sc-sheet-body">
                <div className="scv-grid">
                  {base.map((v) =>
                    <button key={v.n} className={'scv-cell' + (isSaved(v.n) ? ' saved' : '')} onClick={() => jumpTo(v.n)}>{v.n}</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        }
      </div>);

  }

  /* ---- reading display settings (brightness, size, font, night mode) ---- */
  function ReaderSettings({ display, onChange, theme, setTheme, brightness, setBrightness, onClose }) {
    const sizes = [{ s: 0, px: 18 }, { s: 1, px: 25 }, { s: 2, px: 32 }];
    const fonts = [['classic', 'Classic'], ['stylish', 'Stylish'], ['modern', 'Modern']];
    return (
      <div className="modal-scrim" onClick={onClose}>
        <div className="modal sc-settings" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <div>
              <div className="modal-title">Display</div>
              <div className="modal-sub">Comfort &amp; appearance for the whole app.</div>
            </div>
            <button className="modal-x" onClick={onClose}><Icon name="close" size={18} /></button>
          </div>
          <div className="modal-body">
            <div className="rs-label">Appearance</div>
            <div className="rs-themes">
              <button className={'rs-theme' + (theme === 'light' ? ' on' : '')} onClick={() => setTheme('light')}>
                <span className="rs-theme-sw light"><Icon name="sun" size={16} /></span>
                <span className="rs-theme-name">Light</span>
              </button>
              <button className={'rs-theme' + (theme === 'dark' ? ' on' : '')} onClick={() => setTheme('dark')}>
                <span className="rs-theme-sw dark"><Icon name="moon" size={15} /></span>
                <span className="rs-theme-name">Dark</span>
              </button>
            </div>

            <div className="rs-label">Brightness</div>
            <div className="rs-bright">
              <Icon name="moon" size={16} />
              <input type="range" min="60" max="140" step="1" value={brightness}
                onChange={(e) => setBrightness(+e.target.value)} className="rs-slider"
                style={{ '--pct': (brightness - 60) / 80 * 100 + '%' }} />
              <Icon name="sun" size={20} />
            </div>
            <div className="rs-brightnote">{brightness === 100 ? 'Default' : brightness > 100 ? 'Brighter +' + (brightness - 100) + '%' : 'Dimmer \u2212' + (100 - brightness) + '%'}</div>

            <div className="rs-divide"><span>Reading</span></div>

            <div className="rs-label">Text size</div>
            <div className="rs-sizes">
              {sizes.map(({ s, px }) => (
                <button key={s} className={'rs-size' + (display.size === s ? ' on' : '')} onClick={() => onChange({ size: s })}>
                  <span style={{ fontSize: px }}>A</span>
                </button>
              ))}
            </div>

            <div className="rs-label">Typeface</div>
            <div className="rs-fonts">
              {fonts.map(([id, lbl]) => (
                <button key={id} className={'rs-font font-' + id + (display.font === id ? ' on' : '')} onClick={() => onChange({ font: id })}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---- feature root: owns view + position ---- */
  function ScriptureScreen({ savedVerses, onToggleVerse, onBack, theme, setTheme, brightness, setBrightness, openTarget, onTargetConsumed }) {
    const startPos = (() => {try {return JSON.parse(localStorage.getItem(POS_KEY) || 'null');} catch (e) {return null;}})();
    const freeTrans = DB_BIBLE_TRANSLATIONS.filter((t) => t.free);
    const loadSel = () => {
      try {
        const raw = localStorage.getItem(TRANS_KEY);
        if (!raw) return ['kjv'];
        if (raw[0] === '[') { const a = JSON.parse(raw).filter((id) => DB_BIBLE_TRANSLATIONS.some((t) => t.id === id)); return a.length ? a : ['kjv']; }
        return DB_BIBLE_TRANSLATIONS.some((t) => t.id === raw) ? [raw] : ['kjv']; // migrate old single value
      } catch (e) { return ['kjv']; }
    };
    const [view, setView] = useState('books'); // books | chapters | reader
    const [testament, setTestament] = useState(startPos && startPos.testament || 'OT');
    const [query, setQuery] = useState('');
    const [book, setBook] = useState(null);
    const [chapter, setChapter] = useState(1);
    const [selected, setSelectedRaw] = useState(loadSel);
    const [sheet, setSheet] = useState(false);
    const [settings, setSettings] = useState(false);
    const [gotoVerse, setGotoVerse] = useState(0); // verse to auto-scroll to after a deep-link
    const loadDisplay = () => {
      const base = { font: 'classic', size: 1 };
      try { return Object.assign(base, JSON.parse(localStorage.getItem('db_bible_display') || '{}')); } catch (e) { return base; }
    };
    const [display, setDisplayRaw] = useState(loadDisplay);
    const setDisplay = (patch) => { const next = { ...display, ...patch }; setDisplayRaw(next); localStorage.setItem('db_bible_display', JSON.stringify(next)); };

    const loadHl = () => {try {return JSON.parse(localStorage.getItem(HL_KEY) || '{}');} catch (e) {return {};}};
    const [highlights, setHighlightsRaw] = useState(loadHl);
    const setHighlight = (ref, color) => {
      setHighlightsRaw((prev) => {
        const next = { ...prev };
        if (color) next[ref] = color;else delete next[ref];
        try {localStorage.setItem(HL_KEY, JSON.stringify(next));} catch (e) {}
        return next;
      });
    };

    const setSelected = (arr) => { const a = arr.length ? arr : ['kjv']; setSelectedRaw(a); localStorage.setItem(TRANS_KEY, JSON.stringify(a)); };
    const toggleTrans = (id) => { setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]); };
    const onManage = (action, id) => { if (action === 'open') setSheet(true); else if (action === 'toggle') toggleTrans(id); };

    // order selected to match the canonical translation order
    const orderedSel = DB_BIBLE_TRANSLATIONS.filter((t) => selected.includes(t.id)).map((t) => t.id);

    // tally saved verses per book for the list badges
    const savedByBook = {};
    savedVerses.forEach((v) => {
      const m = (v.ref || '').match(/^(.*)\s\d+:\d+$/);
      if (m) savedByBook[m[1]] = (savedByBook[m[1]] || 0) + 1;
    });

    const openBook = (b) => {setBook(b);setView('chapters');window.scrollTo({ top: 0, behavior: 'instant' });};
    const openChapter = (b, n, t) => {
      setBook(b);setChapter(n);setView('reader');
      localStorage.setItem(POS_KEY, JSON.stringify({ book: b.name, chapter: n, testament: t || testament }));
    };
    // chapter tap → explicit "Select a verse" step
    const pickChapter = (n) => {setChapter(n);setView('verses');window.scrollTo({ top: 0, behavior: 'instant' });};
    // verse picker → open the reader (optionally jumped to a verse)
    const openReaderAt = (n) => {
      setView('reader');setGotoVerse(n || 0);
      localStorage.setItem(POS_KEY, JSON.stringify({ book: book.name, chapter, testament }));
    };

    useEffect(() => {
      if (view === 'reader' && book) localStorage.setItem(POS_KEY, JSON.stringify({ book: book.name, chapter, testament }));
    }, [view, book, chapter, testament]);

    const resume = startPos && startPos.book ? startPos : null;
    const doResume = () => {
      const t = resume.testament || 'OT';
      const grp = DB_BIBLE[t].groups.find((g) => g.books.some((b) => b.name === resume.book));
      const b = grp && grp.books.find((x) => x.name === resume.book);
      if (b) {setTestament(t);openChapter(b, resume.chapter, t);}
    };

    // deep-link: open the reader straight to a saved verse's book + chapter
    useEffect(() => {
      if (!openTarget || !openTarget.book) return;
      const bookMatch = (a, b) => { const al = a.toLowerCase(), bl = b.toLowerCase(); return al === bl || al.startsWith(bl) || bl.startsWith(al); };
      for (const t of ['OT', 'NT']) {
        const grp = DB_BIBLE[t].groups.find((g) => g.books.some((b) => bookMatch(b.name, openTarget.book)));
        const b = grp && grp.books.find((x) => bookMatch(x.name, openTarget.book));
        if (b) {setTestament(t);openChapter(b, openTarget.chapter || 1, t);setGotoVerse(openTarget.verse || 0);break;}
      }
      if (onTargetConsumed) onTargetConsumed();
    }, [openTarget]);

    const topLabel = orderedSel.length > 1 ? orderedSel.length + ' versions' : (DB_BIBLE_TRANSLATIONS.find((t) => t.id === orderedSel[0]) || {}).label;

    return (
      <div className="scripture">
        {view === 'books' &&
        <div className="sc-top">
          <button className="sc-back" onClick={onBack}>
            <Icon name="arrow" size={18} />
          </button>
          <div className="sc-toptitle">Bible</div>
          <button className="sc-topright" onClick={() => setSheet(true)}>{topLabel}</button>
        </div>}

        {view === 'books' &&
        <BookList
          testament={testament} setTestament={setTestament}
          query={query} setQuery={setQuery}
          savedByBook={savedByBook} resume={resume} onResume={doResume}
          onOpenBook={openBook} />
        }
        {view === 'chapters' && book &&
        <ChapterPicker book={book} onPick={pickChapter} onBack={() => setView('books')} />
        }
        {view === 'verses' && book &&
        <VersePicker book={book} chapter={chapter} selected={orderedSel} savedVerses={savedVerses}
        onPickVerse={openReaderAt} onReadAll={() => openReaderAt(0)} onBack={() => setView('chapters')} />
        }
        {view === 'reader' && book &&
        <Reader book={book} chapter={chapter} setChapter={setChapter}
        selected={orderedSel} freeTrans={freeTrans} onManage={onManage}
        display={display} onOpenSettings={() => setSettings(true)}
        savedVerses={savedVerses} onToggleVerse={onToggleVerse}
        highlights={highlights} onHighlight={setHighlight}
        gotoVerse={gotoVerse} onGotoDone={() => setGotoVerse(0)}
        onBack={() => setView('verses')} />
        }

        {sheet && <TranslationSheet selected={selected} onToggle={toggleTrans} onClose={() => setSheet(false)} />}
        {settings && <ReaderSettings display={display} onChange={setDisplay} theme={theme} setTheme={setTheme} brightness={brightness} setBrightness={setBrightness} onClose={() => setSettings(false)} />}
      </div>);

  }

export default ScriptureScreen;