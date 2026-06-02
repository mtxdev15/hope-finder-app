import React from 'react';
import Icon from './Icon.jsx';

function ShareSheet({ payload, es, onClose }) {
  const { useState } = React;
  const [copied, setCopied] = useState(false);
  const [canNative] = useState(() => typeof navigator !== 'undefined' && !!navigator.share);
  const tx = es
    ? { copy: 'Copiar', copied: '¡Copiado!', email: 'Correo', sms: 'Mensaje', more: 'Más', cancel: 'Cancelar' }
    : { copy: 'Copy', copied: 'Copied!', email: 'Email', sms: 'Message', more: 'More', cancel: 'Cancel' };

  const url = payload.url || '';
  const blurb = payload.blurb || payload.text || '';
  const fullText = payload.text || blurb;
  const subject = payload.subject || payload.title || '';
  const shareUrlSuffix = url ? ' ' + url : '';
  const enc = encodeURIComponent;

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(fullText + shareUrlSuffix); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const nativeShare = async () => {
    try { await navigator.share({ title: payload.title, text: blurb, url: url || undefined }); onClose(); } catch (e) {}
  };

  const targets = [
    { id: 'copy', label: copied ? tx.copied : tx.copy, onClick: copyAll, bg: 'var(--forest)', glyph:
      copied
        ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10" /></svg>
        : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 14.5l5-5M8 12l-2.2 2.2a3.1 3.1 0 0 0 4.4 4.4L12.5 16M16 12l2.2-2.2a3.1 3.1 0 0 0-4.4-4.4L11.5 8" /></svg> },
    { id: 'email', label: tx.email, href: 'mailto:?subject=' + enc(subject) + '&body=' + enc(fullText + shareUrlSuffix), bg: '#C9A84C', glyph:
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg> },
    { id: 'sms', label: tx.sms, href: 'sms:?&body=' + enc(blurb + shareUrlSuffix), bg: '#34C759', glyph:
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-4 3.5V5Z" /></svg> },
    { id: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/?text=' + enc(blurb + shareUrlSuffix), bg: '#25D366', glyph:
      <svg width="23" height="23" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.6 14.1c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3.4-.9-2.9-1.2-4.7-4.2-4.8-4.4-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.8-1c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z" /></svg> },
    { id: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url || 'https://www.biblegateway.com'), bg: '#1877F2', glyph:
      <svg width="23" height="23" viewBox="0 0 24 24" fill="#fff"><path d="M14 9V7.2c0-.8.2-1.2 1.3-1.2H17V3h-2.4C11.7 3 10.5 4.5 10.5 7v2H8.5v3h2v9h3.5v-9h2.4l.4-3H14Z" /></svg> },
    { id: 'x', label: 'X', href: 'https://twitter.com/intent/tweet?text=' + enc(blurb) + (url ? '&url=' + enc(url) : ''), bg: '#000', glyph:
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M18.2 3h3.3l-7.2 8.3L23 21h-6.6l-5.2-6.8L5.3 21H2l7.7-8.8L2 3h6.8l4.7 6.2L18.2 3Zm-1.2 16h1.8L7.1 4.9H5.2L17 19Z" /></svg> },
  ];
  if (canNative) targets.push({ id: 'more', label: tx.more, onClick: nativeShare, bg: 'var(--gold-pale)', glyph:
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dark)" strokeWidth="1.9"><circle cx="6" cy="12" r="1.6" fill="var(--gold-dark)" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="var(--gold-dark)" stroke="none" /><circle cx="18" cy="12" r="1.6" fill="var(--gold-dark)" stroke="none" /></svg> });

  return (
    <div className="sh-scrim" onClick={onClose}>
      <div className="sh-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={payload.title}>
        <div className="sh-grip" />
        <button className="sh-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        <div className="sh-head">
          <div className="sh-logo">{payload.monogram || payload.glyph || <Icon name="share" size={20} />}</div>
          <div className="sh-headtx">
            <div className="sh-title">{payload.title}</div>
            {payload.subtitle && <div className="sh-sub">{payload.subtitle}</div>}
          </div>
        </div>
        <div className="sh-grid">
          {targets.map((tg) => {
            const inner = <><span className="sh-tile" style={{ background: tg.bg }}>{tg.glyph}</span><span className="sh-tlabel">{tg.label}</span></>;
            return tg.href
              ? <a key={tg.id} className="sh-opt" href={tg.href} target="_blank" rel="noopener" onClick={() => setTimeout(onClose, 60)}>{inner}</a>
              : <button key={tg.id} className="sh-opt" onClick={tg.onClick}>{inner}</button>;
          })}
        </div>
        <button className="sh-cancel" onClick={onClose}>{tx.cancel}</button>
      </div>
    </div>);

}

export default ShareSheet;
