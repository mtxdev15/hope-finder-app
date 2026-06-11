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
// never in the browser. WEB is public-domain → cached forever in KV, no FUMS, no
// copyright line. NLT is copyrighted → fetched LIVE every time (never cached), and
// returned with a FUMS token (the browser fires the view ping) plus the Tyndale
// copyright line. NKJV/NIV are intentionally still rejected (a later slice).
const WEB_BIBLE_ID = '9879dbb7cfe39e4d-01';
const NLT_BIBLE_ID = 'd6e14a625393b4da-01';

// The required Tyndale credit line, shown wherever NLT text appears. Hardcoded (not
// pulled from API.Bible) so it's the full legal credit and renders even if a fetch fails.
const NLT_COPYRIGHT =
  'Scripture quotations are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.';

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
  verses.forEach((v) => { v.t = v.t.replace(/\s+/g, ' ').trim(); });
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

  if (translation !== 'web' && translation !== 'nlt') {
    return jsonResponse({ error: 'Only the WEB and NLT translations are available right now.' }, 400);
  }
  if (!/^[0-9A-Z]{3}$/.test(book)) {
    return jsonResponse({ error: 'Invalid book code.' }, 400);
  }
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 150) {
    return jsonResponse({ error: 'Invalid chapter.' }, 400);
  }

  const ref = `${book}.${chapter}`;

  // ===== WEB (public domain): permanent KV cache, no FUMS, no copyright =====
  if (translation === 'web') {
    // NORM is the normalizer version — bump it whenever normalizeChapter changes so
    // already-cached chapters are re-fetched and re-normalized instead of served stale.
    const NORM = 'v2';
    const cacheKey = `verse:WEB:${NORM}:${ref}`;
    // 14 days — API.Bible requires cached content be refreshed at least every 14 days.
    const longCache = { 'Cache-Control': 'public, max-age=1209600' };

    // Public-domain: a permanent KV hit serves instantly with zero API calls.
    if (env.BIBLE_KV) {
      const cached = await env.BIBLE_KV.get(cacheKey, 'json');
      if (cached) return jsonResponse(cached, 200, longCache);
    }

    const apiUrl = `https://api.scripture.api.bible/v1/bibles/${WEB_BIBLE_ID}/chapters/${ref}` +
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
      translation: 'WEB',
      book,
      chapter,
      verses,
    };
    // Cache with a 14-day TTL (API.Bible terms: refresh cached content at least every 14 days).
    if (env.BIBLE_KV) await env.BIBLE_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 1209600 });
    return jsonResponse(payload, 200, longCache);
  }

  // ===== NLT (copyrighted): LIVE every time, NEVER cached, returns FUMS token + copyright =====
  // No KV access at all. Cache-Control: no-store so every display is a fresh, FUMS-trackable view.
  const apiUrl = `https://api.scripture.api.bible/v1/bibles/${NLT_BIBLE_ID}/chapters/${ref}` +
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
    translation: 'NLT',
    book,
    chapter,
    verses,
    fumsToken: (data.meta && data.meta.fumsToken) || null,
    copyright: NLT_COPYRIGHT,
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

export default {
  async fetch(request, env) {
    // Bible reader route — additive; the Anthropic proxy below is unchanged.
    if (new URL(request.url).pathname === '/bible') {
      return handleBible(request, env);
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
