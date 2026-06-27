const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// CORS for the /bible route only — advertises GET here, leaving the Anthropic
// proxy's CORS_HEADERS 100% unchanged.
const BIBLE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Bible reader ─────────────────────────────────────────────────────────────
// API.Bible is the single source; the key is a server-side secret (env.BIBLE_API_KEY),
// never in the browser. WEB is public-domain → cached in KV (14-day TTL), no FUMS, no
// copyright line. NLT/NKJV/NIV are copyrighted → fetched LIVE every time (never cached),
// each returned with a FUMS token (the browser fires the view ping) plus its publisher's
// copyright line.
const WEB_BIBLE_ID = '9879dbb7cfe39e4d-01';
const KJV_BIBLE_ID = 'de4e12af7f28f599-01';
const ASV_BIBLE_ID = '06125adad2d5898a-01';
const NLT_BIBLE_ID = 'd6e14a625393b4da-01';
const NKJV_BIBLE_ID = '63097d2a0a2f7db3-01';
const NIV_BIBLE_ID = '78a9f6124f344018-01';

// Public-domain translations: cached in KV (14-day TTL), no FUMS, no copyright line.
// Keyed by request param; cache key uses the label so they never collide (verse:KJV:v2:…).
const PUBLIC_DOMAIN = {
  web: { id: WEB_BIBLE_ID, label: 'WEB' },
  kjv: { id: KJV_BIBLE_ID, label: 'KJV' },
  asv: { id: ASV_BIBLE_ID, label: 'ASV' },
};

// Required publisher credit lines, shown wherever each copyrighted translation appears.
// Hardcoded (not pulled from API.Bible) so each is the full legal credit and renders even
// if a fetch fails. Verbatim — the ® marks, years, and "worldwide" are required.
const NLT_COPYRIGHT =
  'Scripture quotations are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.';
const NKJV_COPYRIGHT =
  'Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.';
const NIV_COPYRIGHT =
  'Scripture quotations taken from The Holy Bible, New International Version® NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by permission. All rights reserved worldwide.';

// The copyrighted translations, keyed by request param. WEB is handled separately (cached).
const COPYRIGHTED = {
  nlt: { id: NLT_BIBLE_ID, label: 'NLT', copyright: NLT_COPYRIGHT },
  nkjv: { id: NKJV_BIBLE_ID, label: 'NKJV', copyright: NKJV_COPYRIGHT },
  niv: { id: NIV_BIBLE_ID, label: 'NIV', copyright: NIV_COPYRIGHT },
};

function jsonResponse(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...BIBLE_CORS_HEADERS, ...extraHeaders },
  });
}

// Flatten API.Bible's structured chapter JSON (content-type=json) into [{ n, t }].
// A `verse` tag opens a verse (its number is attrs.number; its own children are just
// the number marker, so we skip them); subsequent text nodes are that verse's text.
// Poetry splits a verse across multiple paragraph/line nodes (e.g. Psalms), so a
// `para`/`break` boundary inserts a separating space — otherwise lines join without
// one ("shepherd;I shall…", "me"+"in" -> "mein").
function normalizeChapter(content) {
  const verses = [];
  let cur = null;
  (function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type === 'tag' && node.name === 'verse') {
      const n = node.attrs && node.attrs.number;
      if (n != null) { cur = { n: String(n), t: '' }; verses.push(cur); }
      return; // skip the verse tag's own children (the number marker)
    }
    if (node.type === 'text') {
      if (cur) cur.t += node.text || '';
      return;
    }
    if (node.type === 'tag' && (node.name === 'para' || node.name === 'break')) {
      if (cur && cur.t && !/\s$/.test(cur.t)) cur.t += ' '; // line/paragraph break -> space
      if (node.items) walk(node.items);
      return;
    }
    if (node.items) walk(node.items);
  })(content);
  // Strip API.Bible paragraph markers (¶, e.g. KJV paragraph-opening verses), THEN collapse
  // whitespace + trim — so "¶ For God…" becomes "For God…". No-op for text without a ¶.
  verses.forEach((v) => { v.t = v.t.replace(/¶/g, '').replace(/\s+/g, ' ').trim(); });
  return verses.filter((v) => v.t);
}

async function handleBible(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: BIBLE_CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  const url = new URL(request.url);
  const translation = (url.searchParams.get('translation') || '').toLowerCase();
  const book = (url.searchParams.get('book') || '').toUpperCase();
  const chapter = parseInt(url.searchParams.get('chapter') || '', 10);

  if (!PUBLIC_DOMAIN[translation] && !COPYRIGHTED[translation]) {
    return jsonResponse({ error: 'Only the WEB, KJV, ASV, NLT, NKJV, and NIV translations are available right now.' }, 400);
  }
  if (!/^[0-9A-Z]{3}$/.test(book)) {
    return jsonResponse({ error: 'Invalid book code.' }, 400);
  }
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 150) {
    return jsonResponse({ error: 'Invalid chapter.' }, 400);
  }

  const ref = `${book}.${chapter}`;

  // ===== PUBLIC DOMAIN (WEB/KJV/ASV): KV-cached, no FUMS, no copyright =====
  if (PUBLIC_DOMAIN[translation]) {
    const cfg = PUBLIC_DOMAIN[translation];
    // NORM is the normalizer version — bump it whenever normalizeChapter changes so
    // already-cached chapters are re-fetched and re-normalized instead of served stale.
    const NORM = 'v3';
    const cacheKey = `verse:${cfg.label}:${NORM}:${ref}`;
    // 14 days — API.Bible requires cached content be refreshed at least every 14 days.
    const longCache = { 'Cache-Control': 'public, max-age=1209600' };

    // Public-domain: a KV hit serves instantly with zero API calls.
    if (env.BIBLE_KV) {
      const cached = await env.BIBLE_KV.get(cacheKey, 'json');
      if (cached) return jsonResponse(cached, 200, longCache);
    }

    const apiUrl = `https://api.scripture.api.bible/v1/bibles/${cfg.id}/chapters/${ref}` +
      '?content-type=json&include-verse-numbers=true&include-titles=false&include-notes=false&include-chapter-numbers=false';
    const apiRes = await fetch(apiUrl, {
      headers: { 'api-key': env.BIBLE_API_KEY, 'accept': 'application/json' },
    });
    if (!apiRes.ok) {
      return jsonResponse({ error: 'Could not load this chapter.' }, 502);
    }
    const data = await apiRes.json();
    const verses = normalizeChapter(data && data.data && data.data.content);
    if (!verses.length) {
      return jsonResponse({ error: 'No verses found for this chapter.' }, 502);
    }

    const payload = {
      reference: (data.data && data.data.reference) || ref,
      translation: cfg.label,
      book,
      chapter,
      verses,
    };
    // Cache with a 14-day TTL (API.Bible terms: refresh cached content at least every 14 days).
    if (env.BIBLE_KV) await env.BIBLE_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 1209600 });
    return jsonResponse(payload, 200, longCache);
  }

  // ===== COPYRIGHTED (NLT/NKJV/NIV): LIVE every time, NEVER cached, returns FUMS token + copyright =====
  // No KV access at all. Cache-Control: no-store so every display is a fresh, FUMS-trackable view.
  const cfg = COPYRIGHTED[translation];
  const apiUrl = `https://api.scripture.api.bible/v1/bibles/${cfg.id}/chapters/${ref}` +
    '?content-type=json&include-verse-numbers=true&include-titles=false&include-notes=false&include-chapter-numbers=false';
  const apiRes = await fetch(apiUrl, {
    headers: { 'api-key': env.BIBLE_API_KEY, 'accept': 'application/json' },
  });
  if (!apiRes.ok) {
    return jsonResponse({ error: 'Could not load this chapter.' }, 502);
  }
  const data = await apiRes.json();
  const verses = normalizeChapter(data && data.data && data.data.content);
  if (!verses.length) {
    return jsonResponse({ error: 'No verses found for this chapter.' }, 502);
  }
  // API.Bible returns the FUMS token in meta.fumsToken (confirmed against a live
  // response). The browser fires fums('trackView', token) when the text displays.
  return jsonResponse({
    reference: (data.data && data.data.reference) || ref,
    translation: cfg.label,
    book,
    chapter,
    verses,
    fumsToken: (data.meta && data.meta.fumsToken) || null,
    copyright: cfg.copyright,
  }, 200, { 'Cache-Control': 'no-store' });
}

const requestCounts = new Map();
const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now >= entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT) {
    return true;
  }

  entry.count++;
  return false;
}

// ── Bible search ─────────────────────────────────────────────────────────────
// GET /bible/search?translation=kjv&q=water into wine — proxies API.Bible's
// /search endpoint (key stays server-side). Copyrighted result snippets are a
// licensed display: never cached (no-store) and returned with the FUMS token
// (the browser fires the view ping) plus the publisher's copyright line.
// Public-domain results may be browser-cached briefly. No KV is used here.
async function handleBibleSearch(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: BIBLE_CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }
  const url = new URL(request.url);
  const translation = (url.searchParams.get('translation') || '').toLowerCase();
  const q = (url.searchParams.get('q') || '').trim();
  const cfg = PUBLIC_DOMAIN[translation] || COPYRIGHTED[translation];
  if (!cfg) {
    return jsonResponse({ error: 'Only the WEB, KJV, ASV, NLT, NKJV, and NIV translations are available right now.' }, 400);
  }
  if (q.length < 2 || q.length > 80) {
    return jsonResponse({ error: 'Search needs between 2 and 80 characters.' }, 400);
  }
  const apiUrl = `https://api.scripture.api.bible/v1/bibles/${cfg.id}/search` +
    `?query=${encodeURIComponent(q)}&limit=12&sort=relevance&fuzziness=AUTO`;
  const apiRes = await fetch(apiUrl, {
    headers: { 'api-key': env.BIBLE_API_KEY, 'accept': 'application/json' },
  });
  if (!apiRes.ok) {
    return jsonResponse({ error: 'Search is unavailable right now.' }, 502);
  }
  const data = await apiRes.json();
  const verses = (data && data.data && data.data.verses) || [];
  let results = verses.map((v) => {
    const m = (v.reference || '').match(/^(.+?)\s+(\d+):(\d+)/);
    return {
      ref: v.reference,
      text: (v.text || '').replace(/\s+/g, ' ').trim(),
      book: m ? m[1] : null,
      chapter: m ? parseInt(m[2], 10) : null,
      verse: m ? parseInt(m[3], 10) : null,
    };
  }).filter((r) => r.book);
  // Reference-style queries ("Psalms 21", "John 3:16-18") come back as passages,
  // not verses — map those too so a typed reference always resolves.
  if (!results.length && data && data.data && Array.isArray(data.data.passages)) {
    results = data.data.passages.map((p) => {
      const m = (p.reference || '').match(/^(.+?)\s+(\d+)(?::(\d+))?/);
      const text = (p.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return {
        ref: p.reference,
        text: text.slice(0, 160),
        book: m ? m[1] : null,
        chapter: m ? parseInt(m[2], 10) : null,
        verse: m && m[3] ? parseInt(m[3], 10) : null,
      };
    }).filter((r) => r.book);
  }
  const copyrighted = !!COPYRIGHTED[translation];
  return jsonResponse({
    query: q,
    translation: cfg.label,
    results,
    fumsToken: (data.meta && data.meta.fumsToken) || null,
    copyright: copyrighted ? COPYRIGHTED[translation].copyright : undefined,
  }, 200, copyrighted ? { 'Cache-Control': 'no-store' } : { 'Cache-Control': 'public, max-age=3600' });
}

// ── Unsplash (Card Studio image search) ──────────────────────────────────────
// GET /unsplash/search?q=… — proxies api.unsplash.com/search/photos; the access
// key lives ONLY here (env.UNSPLASH_ACCESS_KEY). Returns a trimmed result list.
// GET /unsplash/track?d=… — server-side ping of a photo's download_location,
// required by Unsplash API guidelines when a photo is actually used on a card.
async function handleUnsplash(request, env, pathname) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: BIBLE_CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }
  if (!env.UNSPLASH_ACCESS_KEY) {
    return jsonResponse({ error: 'Image search is not configured yet.' }, 503);
  }
  const url = new URL(request.url);
  if (pathname === '/unsplash/track') {
    const d = url.searchParams.get('d') || '';
    if (!/^https:\/\/api\.unsplash\.com\//.test(d)) {
      return jsonResponse({ error: 'Invalid download location.' }, 400);
    }
    await fetch(d, { headers: { Authorization: 'Client-ID ' + env.UNSPLASH_ACCESS_KEY } });
    return jsonResponse({ ok: true }, 200, { 'Cache-Control': 'no-store' });
  }
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2 || q.length > 60) {
    return jsonResponse({ error: 'Search needs between 2 and 60 characters.' }, 400);
  }
  const apiRes = await fetch(
    'https://api.unsplash.com/search/photos?query=' + encodeURIComponent(q) + '&per_page=18&content_filter=high',
    { headers: { Authorization: 'Client-ID ' + env.UNSPLASH_ACCESS_KEY, 'Accept-Version': 'v1' } }
  );
  if (!apiRes.ok) {
    return jsonResponse({ error: 'Image search is unavailable right now.' }, 502);
  }
  const data = await apiRes.json();
  const results = (data.results || []).map((p) => ({
    thumb: p.urls && p.urls.small,
    full: (p.urls && p.urls.regular) || (p.urls && p.urls.full),
    name: p.user && p.user.name,
    link: p.user && p.user.links && p.user.links.html,
    download_location: p.links && p.links.download_location,
  })).filter((r) => r.thumb && r.full);
  return jsonResponse({ query: q, results }, 200, { 'Cache-Control': 'public, max-age=300' });
}

/* ===== Stripe Checkout — the Give flow ============================================
   POST /give/checkout  { amount, currency, recurring, frequency, path }
   Creates a Stripe Checkout Session and returns { url } for the browser to redirect to.
   The secret key lives in env.STRIPE_SECRET_KEY (test now, live later); the browser never
   sees it. Apple Pay / Google Pay / card all appear automatically on Stripe's hosted page.
   ================================================================================= */
const FREQ_INTERVAL = {
  semimonthly: { interval: 'week',  interval_count: 2 }, // "twice a month" → every 2 weeks (Stripe has no 1st-&-15th)
  monthly:     { interval: 'month', interval_count: 1 },
};

async function handleCheckout(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (checkRateLimit(ip)) {
    return jsonResponse({ error: 'Too many requests. Please wait a moment and try again.' }, 429, CORS_HEADERS);
  }
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'Giving is not configured yet.' }, 500, CORS_HEADERS);
  }

  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'Bad request.' }, 400, CORS_HEADERS); }

  const amount = Number(body && body.amount);
  if (!isFinite(amount) || amount < 1 || amount > 100000) {
    return jsonResponse({ error: 'Please choose an amount between $1 and $100,000.' }, 400, CORS_HEADERS);
  }
  const recurring = !!(body && body.recurring);
  const freqKey = String((body && body.frequency) || 'monthly');
  const unitAmount = Math.round(amount * 100); // cents, USD for v1

  // Build return URLs from an allowlisted origin so /es/dar comes back to /es/dar, etc.
  const origin = request.headers.get('Origin') || '';
  const okOrigin =
    /^https:\/\/([a-z0-9-]+\.)*declareandbelieve\.com$/i.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)+pages\.dev$/i.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/i.test(origin);
  const base = okOrigin ? origin : 'https://declareandbelieve.com';
  const rawPath = String((body && body.path) || '/give');
  const path = /^\/[a-z0-9/_.-]*$/i.test(rawPath) ? rawPath : '/give';
  const successQ = 'status=success&amt=' + encodeURIComponent(amount) + (recurring ? '&rec=1&freq=' + encodeURIComponent(freqKey) : '');
  const successUrl = base + path + '?' + successQ;
  const cancelUrl = base + path + '?status=cancel';

  const p = new URLSearchParams();
  p.set('mode', recurring ? 'subscription' : 'payment');
  p.set('success_url', successUrl);
  p.set('cancel_url', cancelUrl);
  p.set('line_items[0][quantity]', '1');
  p.set('line_items[0][price_data][currency]', 'usd');
  p.set('line_items[0][price_data][unit_amount]', String(unitAmount));
  p.set('line_items[0][price_data][product_data][name]', recurring ? 'Recurring gift — Declare & Believe' : 'Gift — Declare & Believe');
  if (recurring) {
    const iv = FREQ_INTERVAL[freqKey] || FREQ_INTERVAL.monthly;
    p.set('line_items[0][price_data][recurring][interval]', iv.interval);
    p.set('line_items[0][price_data][recurring][interval_count]', String(iv.interval_count));
  } else {
    p.set('submit_type', 'donate');
  }

  let res, data;
  try {
    res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: p.toString(),
    });
    data = await res.json();
  } catch (e) {
    return jsonResponse({ error: 'Could not reach the payment processor.' }, 502, CORS_HEADERS);
  }
  if (!res.ok || !data || !data.url) {
    const msg = (data && data.error && data.error.message) || 'Payment processor error.';
    return jsonResponse({ error: msg }, 502, CORS_HEADERS);
  }
  return jsonResponse({ url: data.url }, 200, CORS_HEADERS);
}

export default {
  async fetch(request, env) {
    // Bible reader + studio routes — additive; the Anthropic proxy below is unchanged.
    const pathname = new URL(request.url).pathname;
    if (pathname === '/unsplash/search' || pathname === '/unsplash/track') {
      return handleUnsplash(request, env, pathname);
    }
    if (pathname === '/bible/search') {
      return handleBibleSearch(request, env);
    }
    if (pathname === '/bible') {
      return handleBible(request, env);
    }
    if (pathname === '/give/checkout') {
      return handleCheckout(request, env);
    }

    // ===== existing Anthropic proxy (root path) — untouched =====
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';

    if (checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: 'You have reached the request limit. Please wait a moment before trying again.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    const body = await request.text();

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body,
    });

    return new Response(anthropicRes.body, {
      status: anthropicRes.status,
      headers: {
        'Content-Type': anthropicRes.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-cache',
        ...CORS_HEADERS,
      },
    });
  },
};
