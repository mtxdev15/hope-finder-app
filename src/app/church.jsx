/* Declare & Believe — Find / Add Your Church
   GPS "near me" + name search + EN/Español filter, and a full info card with
   schedule, contact, and a Watch Live (YouTube) link. Self-contained. */
import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import ShareSheet from './ShareSheet.jsx';
import { DB_CHURCHES } from '../data/churches.js';

  const MY_KEY = 'db_my_church';
  const LOC_KEY = 'db_user_loc';

  function haversine(a, b) {
    const R = 3958.8, toR = (d) => d * Math.PI / 180;
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  const monogram = (name) => name.replace(/^(Iglesia|Casa de|The)\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  /* ---- church detail card ---- */
  function ChurchDetail({ church, dist, isMine, onSet, onUnset, onChange, onBack }) {
    const [shareOpen, setShareOpen] = useState(false);
    const es = church.lang === 'es';
    const t = es
      ? { mychurch: 'Mi Iglesia', set: 'Establecer como Mi Iglesia', remove: 'Quitar como Mi Iglesia', pastor: 'Pastor Principal', address: 'Dirección', schedule: 'Horario', details: 'Detalles', watch: 'Ver en Vivo', lang: 'Español', change: 'Cambiar', shared: '¡Copiado!' }
      : { mychurch: 'My Church', set: 'Set as My Church', remove: 'Remove as My Church', pastor: 'Lead Pastor', address: 'Address', schedule: 'Schedule', details: 'Details', watch: 'Watch Live', lang: 'English', change: 'Change', shared: 'Copied!' };
    const maps = 'https://maps.google.com/?q=' + encodeURIComponent(church.address);
    const shareData = () => {
      const url = church.website || maps;
      const lines = [church.name, church.about, 'Pastor: ' + church.pastor, church.address, church.website];
      if (church.youtube) lines.push('Live: ' + church.youtube);
      return {
        title: es ? 'Compartir esta iglesia' : 'Share this church',
        subtitle: church.name,
        monogram: monogram(church.name),
        text: lines.filter(Boolean).join('\n'),
        blurb: church.name + (church.about ? ' — ' + church.about : ''),
        subject: church.name,
        url };
    };

    return (
      <div className="ch-detail">
        <div className="ch-dtop">
          <button className="ch-back" onClick={onBack}><Icon name="arrow" size={18} /></button>
          <div className="ch-dtop-r">
            {onChange && <button className="ch-change" onClick={onChange}>{t.change}</button>}
            <button className="ch-sharebtn" onClick={() => setShareOpen(true)} aria-label="Share">
              <Icon name="share" size={17} />
            </button>
          </div>
        </div>

        <div className="ch-hero">
          <div className="ch-logo lg">{monogram(church.name)}</div>
          <h1 className="ch-name">{church.name}</h1>
          <div className="ch-herometa">
            <span className={'ch-lang ' + church.lang}>{t.lang}</span>
            {dist != null && <span className="ch-dist"><Icon name="pin" size={12} /> {dist < 1 ? '<1' : Math.round(dist)} mi</span>}
          </div>
          {isMine
            ? <span className="ch-mybtn on static"><Icon name="check" size={15} /> {t.mychurch}</span>
            : <button className="ch-mybtn" onClick={() => onSet(church)}><Icon name="plus" size={15} /> {t.set}</button>}
        </div>

        <p className="ch-about">{church.about}</p>

        <div className="ch-field"><span className="ch-flabel">{t.pastor}</span><span className="ch-fval">{church.pastor}</span></div>

        <div className="ch-field">
          <span className="ch-flabel">{t.address}</span>
          <a className="ch-addr" href={maps} target="_blank" rel="noopener">
            <span>{church.address}</span><span className="ch-pin"><Icon name="pin" size={16} /></span>
          </a>
        </div>

        {church.youtube &&
          <a className="ch-watch" href={church.youtube} target="_blank" rel="noopener">
            <span className="ch-watch-l"><span className="ch-yt"><Icon name="play" size={15} /></span>
              <span><span className="ch-watch-t">{t.watch}</span><span className="ch-watch-s">YouTube</span></span></span>
            <Icon name="arrow" size={16} />
          </a>}

        <div className="ch-seclabel">{t.schedule}</div>
        <div className="ch-sched">
          {church.schedule.map((d) => (
            <div className="ch-day" key={d.day}>
              <div className="ch-dayname">{d.day}</div>
              {d.items.map(([time, label], i) => (
                <div className="ch-slot" key={i}><span className="ch-time">{time}</span><span className="ch-svc">{label}</span></div>
              ))}
            </div>
          ))}
        </div>

        <div className="ch-seclabel">{t.details}</div>
        <div className="ch-links">
          <a className="ch-link" href={church.website} target="_blank" rel="noopener"><Icon name="globe" size={17} /> <span>{church.website.replace(/^https?:\/\//, '')}</span></a>
          <a className="ch-link" href={'mailto:' + church.email}><Icon name="mail" size={17} /> <span>{church.email}</span></a>
          <a className="ch-link" href={'tel:' + church.phone.replace(/[^0-9+]/g, '')}><Icon name="phone" size={17} /> <span>{church.phone}</span></a>
        </div>

        {isMine && <button className="ch-removebtn" onClick={onUnset}>{t.remove}</button>}

        {shareOpen && <ShareSheet es={es} onClose={() => setShareOpen(false)} payload={shareData()} />}
      </div>
    );
  }

  /* ---- find / search screen ---- */
  function ChurchScreen({ myChurch, account, onSet, onUnset, onBack }) {
    const [query, setQuery] = useState('');
    const [lang, setLang] = useState('all');
    const [loc, setLoc] = useState(() => { try { return JSON.parse(localStorage.getItem(LOC_KEY) || 'null'); } catch (e) { return null; } });
    const [geoState, setGeoState] = useState(loc ? 'on' : 'idle'); // idle | asking | on | denied
    const [mode, setMode] = useState(myChurch ? 'mychurch' : 'list'); // mychurch | list | browse
    const [open, setOpen] = useState(null); // church being browsed from the list

    const askLocation = () => {
      if (!navigator.geolocation) { setGeoState('denied'); return; }
      setGeoState('asking');
      navigator.geolocation.getCurrentPosition(
        (pos) => { const l = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setLoc(l); localStorage.setItem(LOC_KEY, JSON.stringify(l)); setGeoState('on'); },
        () => setGeoState('denied'),
        { timeout: 8000 }
      );
    };

    const withDist = DB_CHURCHES.map((c) => ({ ...c, _d: loc ? haversine(loc, c) : null }));
    let list = withDist
      .filter((c) => lang === 'all' || c.lang === lang)
      .filter((c) => { const q = query.trim().toLowerCase(); return !q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q); });
    list.sort((a, b) => (loc ? (a._d - b._d) : a.name.localeCompare(b.name)));

    // My Church info screen (first stop when a church is already set) — back goes
    // to the profile; "Change" jumps to the find/search screen.
    if (mode === 'mychurch' && myChurch) {
      const dist = loc ? haversine(loc, myChurch) : null;
      return (
        <div className="church">
          <ChurchDetail church={myChurch} dist={dist} isMine={true}
            onChange={() => { setOpen(null); setMode('list'); }}
            onUnset={() => { onUnset(); setMode('list'); }} onBack={onBack} />
        </div>
      );
    }

    // Browsing a church opened from the list
    if (mode === 'browse' && open) {
      const dist = loc ? haversine(loc, open) : null;
      return (
        <div className="church">
          <ChurchDetail church={open} dist={dist} isMine={myChurch && myChurch.id === open.id}
            onSet={(c) => { onSet(c); if (account && account.verified) { setOpen(null); setMode('mychurch'); } }}
            onUnset={() => { onUnset(); setMode('list'); }}
            onBack={() => { setOpen(null); setMode('list'); }} />
        </div>
      );
    }

    return (
      <div className="church">
        <div className="ch-top">
          <button className="ch-back" onClick={myChurch ? () => setMode('mychurch') : onBack}><Icon name="arrow" size={18} /></button>
          <div className="ch-toptitle">{myChurch ? 'Change Church' : 'Churches'}</div>
          <div style={{ width: 42 }} />
        </div>

        <div className="ch-search">
          <Icon name="search" size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or city…" />
          {query && <button className="ch-clear" onClick={() => setQuery('')}><Icon name="close" size={15} /></button>}
        </div>

        <div className="ch-langseg">
          {[['all', 'All'], ['en', 'English'], ['es', 'Español']].map(([id, lbl]) => (
            <button key={id} className={'ch-langbtn' + (lang === id ? ' on' : '')} onClick={() => setLang(id)}>{lbl}</button>
          ))}
        </div>

        {geoState !== 'on' &&
          <div className="ch-geo">
            <span className="ch-geoic"><Icon name="people" size={22} /></span>
            <div className="ch-geotext">
              <div className="ch-geotitle">Find churches near you</div>
              <div className="ch-geosub">{geoState === 'denied' ? 'Location is off — showing all churches A–Z. Enable location to sort by distance.' : 'Share your location to see the closest congregations first.'}</div>
            </div>
            <button className="ch-geobtn" onClick={askLocation}>{geoState === 'asking' ? <span className="vspin dark" /> : geoState === 'denied' ? 'Retry' : 'Use my location'}</button>
          </div>}

        {myChurch && !query.trim() &&
          <>
            <div className="ch-seclabel">Your Church</div>
            <button className="ch-card mine" onClick={() => { setOpen(myChurch); setMode('browse'); }}>
              <span className="ch-logo">{monogram(myChurch.name)}</span>
              <span className="ch-cmain">
                <span className="ch-cname">{myChurch.name}<span className="ch-badge"><Icon name="check" size={10} /> My Church</span></span>
                <span className="ch-cmeta">{myChurch.city}{loc ? ' · ' + (haversine(loc, myChurch) < 1 ? '<1' : Math.round(haversine(loc, myChurch))) + ' mi' : ''}</span>
              </span>
              <span className={'ch-lang ' + myChurch.lang}>{myChurch.lang === 'es' ? 'ES' : 'EN'}</span>
              <span className="ch-chev"><Icon name="arrow" size={16} /></span>
            </button>
          </>}

        <div className="ch-seclabel">{loc ? 'Churches near me' : 'All churches'}</div>
        <div className="ch-list">
          {list.filter((c) => !(myChurch && c.id === myChurch.id)).length === 0 && <div className="ch-empty"><Icon name="building" size={22} /><p>No churches match your search.</p></div>}
          {list.filter((c) => !(myChurch && c.id === myChurch.id)).map((c) => {
            return (
              <button className="ch-card" key={c.id} onClick={() => { setOpen(c); setMode('browse'); }}>
                <span className="ch-logo">{monogram(c.name)}</span>
                <span className="ch-cmain">
                  <span className="ch-cname">{c.name}</span>
                  <span className="ch-cmeta">{c.city}{c._d != null ? ' · ' + (c._d < 1 ? '<1' : Math.round(c._d)) + ' mi' : ''}</span>
                </span>
                <span className={'ch-lang ' + c.lang}>{c.lang === 'es' ? 'ES' : 'EN'}</span>
                <span className="ch-chev"><Icon name="arrow" size={16} /></span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

export default ChurchScreen;
