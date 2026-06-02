import React from 'react';

function Icon({ name, size = 23 }) {
  const s = { width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home: <><path d="M3 10.5 12 4l9 6.5" /><path d="M5 9.5V20h14V9.5" /></>,
    scripture: <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2V4Z" /><path d="M18 20a2 2 0 0 1 2-2V4" opacity=".5" /><path d="M9 8h6M9 11h5" /></>,
    journal: <><path d="M6 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2Z" opacity="0" /><path d="M7 4h9a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="M9 9h6M9 13h6M9 17h3" /></>,
    profile: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
    flame: <><path d="M12 3c1 3 4 4.2 4 8a4 4 0 1 1-8 0c0-1.6.8-2.6 1.5-3.4C10.5 9 11 7 12 3Z" /></>,
    phone: <><path d="M6 3h3l1.5 4.5L8 9a11 11 0 0 0 6 6l1.5-2.5L20 14v3a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2Z" /></>,
    play: <><path d="M8 5.5v13l11-6.5-11-6.5Z" /></>,
    pause: <><rect x="7" y="6" width="3.4" height="12" rx="1" /><rect x="13.6" y="6" width="3.4" height="12" rx="1" /></>,
    heart: <><path d="M12 20s-7-4.6-9.2-8.4C1 8.3 2.5 5 6 5c2 0 3 1.2 3.8 2.3C10.6 6.2 11.6 5 13.7 5c3.5 0 5 3.3 3.2 6.6C18.7 15.4 12 20 12 20Z" /></>,
    pray: <><path d="M10.5 5C9.3 7.2 8.3 10 7.9 13 7.4 15.6 7.7 18.2 9 19.8L11.7 19.8 11.7 6.5Z" /><path d="M13.5 5C14.7 7.2 15.7 10 16.1 13 16.6 15.6 16.3 18.2 15 19.8L12.3 19.8 12.3 6.5Z" /><path d="M10 14C9.2 14.8 9 16.2 9.4 17.4" /><path d="M14 14C14.8 14.8 15 16.2 14.6 17.4" /></>,
    cross: <><path d="M12 4v16M7.5 9h9" /></>,
    arrow: <><path d="M14 6l-6 6 6 6" /></>,
    wave: <><path d="M3 12h2M19 12h2M7.5 8v8M12 5v14M16.5 8v8" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    check: <><path d="M5 12.5 10 17l9-10" /></>,
    bookmark: <><path d="M6 4h12v16l-6-4-6 4V4Z" /></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h12" /></>,
    bookmarkfill: <><path d="M6 4h12v16l-6-4-6 4V4Z" fill="currentColor" stroke="currentColor" /></>,
    camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" /><circle cx="12" cy="13" r="3.2" /></>,
    globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.3 2.4 14.7 0 17M12 3.5c-2.4 2.3-2.4 14.7 0 17" /></>,
    trash: <><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    pencil: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="M14 6l4 4" /></>,
    lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
    sun: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" /></>,
    moon: <><path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" /></>,
    building: <><path d="M12 3 5 7v13h14V7l-7-4Z" /><path d="M12 3v17M9 11h0M15 11h0M9 15h0M15 15h0" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 6.5a3 3 0 0 1 0 5.5M21 19a5.5 5.5 0 0 0-4-5.3" opacity=".6" /></>,
    pin: <><path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z" /><circle cx="12" cy="11" r="2.2" /></>,
    share: <><path d="M12 3v13M12 3 8 7M12 3l4 4" /><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></>,
    copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></>,
    highlighter: <><path d="M5 19h5l9.2-9.2a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L6 14.8V19Z" /><path d="M13.5 6.5l4 4" /></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none" /></>
  };
  return <svg viewBox="0 0 24 24" style={s}>{paths[name]}</svg>;
}

export default Icon;
