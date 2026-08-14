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
// Reina-Valera 1909 — Spanish, public domain (free on api.bible, no FUMS/copyright line).
// CONFIRM this id against `GET /v1/bibles?language=spa` with your key before deploying.
const RVR1909_BIBLE_ID = '592420522e16049f-01';

// Public-domain translations: cached in KV (14-day TTL), no FUMS, no copyright line.
// Keyed by request param; cache key uses the label so they never collide (verse:KJV:v2:…).
const PUBLIC_DOMAIN = {
  web: { id: WEB_BIBLE_ID, label: 'WEB' },
  kjv: { id: KJV_BIBLE_ID, label: 'KJV' },
  asv: { id: ASV_BIBLE_ID, label: 'ASV' },
  rvr1909: { id: RVR1909_BIBLE_ID, label: 'RVR1909' },
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
    return jsonResponse({ error: 'Only the WEB, KJV, ASV, NLT, NKJV, NIV, and RVR1909 translations are available right now.' }, 400);
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
    return jsonResponse({ error: 'Only the WEB, KJV, ASV, NLT, NKJV, NIV, and RVR1909 translations are available right now.' }, 400);
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
  if (pathname === '/unsplash/photo') {
    // Single-photo metadata by API photo id — used to capture/refresh curated photos
    // (attribution + download_location). Heavily cached: photo metadata is static.
    const id = (url.searchParams.get('id') || '').trim();
    if (!/^[A-Za-z0-9_-]{5,40}$/.test(id)) {
      return jsonResponse({ error: 'Invalid photo id.' }, 400);
    }
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
    const photoRes = await fetch(
      'https://api.unsplash.com/photos/' + id,
      { headers: { Authorization: 'Client-ID ' + env.UNSPLASH_ACCESS_KEY, 'Accept-Version': 'v1' } }
    );
    if (!photoRes.ok) {
      return jsonResponse({ error: 'Photo unavailable.' }, 502);
    }
    const p = await photoRes.json();
    const out = {
      id: p.id,
      thumb: p.urls && p.urls.small,
      full: (p.urls && p.urls.regular) || (p.urls && p.urls.full),
      name: p.user && p.user.name,
      link: p.user && p.user.links && p.user.links.html,
      download_location: p.links && p.links.download_location,
    };
    const resp = jsonResponse(out, 200, { 'Cache-Control': 'public, max-age=86400' });
    await cache.put(cacheKey, resp.clone());
    return resp;
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
    id: p.id,
    thumb: p.urls && p.urls.small,
    full: (p.urls && p.urls.regular) || (p.urls && p.urls.full),
    name: p.user && p.user.name,
    link: p.user && p.user.links && p.user.links.html,
    download_location: p.links && p.links.download_location,
  })).filter((r) => r.thumb && r.full);
  return jsonResponse({ query: q, results }, 200, { 'Cache-Control': 'public, max-age=300' });
}

/* The donation Checkout, Subscription-status, Billing-Portal AND gift-webhook
   handlers were all REMOVED here, not merely unrouted. The first three trusted
   browser-supplied identity (body.userId, an email searched against Stripe
   customers, and an unowned subscriptionId); leaving that code in the file
   would leave a working IDOR one route line from reachable again.

   The gift webhook went with them once the giving product was retired:
   production giftHistory held ZERO rows, so no user was ever linked to a gift
   and there is nothing left to record. Retirement criteria and the one
   outstanding item are in
   docs/architecture/release-c1-legacy-giving-retention.md.

   What is RETAINED below is the shared Stripe signature verification
   (timingSafeEqualHex + verifyStripeSignature): HMAC-SHA256, constant-time
   compare, 5-minute replay window. The Plus SUBSCRIPTION webhook depends on it. */

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  let t = '';
  const v1 = [];
  sigHeader.split(',').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i), val = part.slice(i + 1);
    if (k === 't') t = val;
    else if (k === 'v1') v1.push(val);
  });
  if (!t || !v1.length) return false;
  // replay protection: reject events older than 5 minutes
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(t + '.' + payload));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return v1.some((sig) => timingSafeEqualHex(sig, expected));
}

/* ===== Plus subscription webhook (Release C1 Phase 3) ==============================
   POST /billing/webhook

   Deliberately SEPARATE from /give/webhook. Donations and Plus subscriptions are
   different products with different Stripe endpoints, different signing secrets and
   different Convex tables. Sharing one handler would mean a change to either product
   risks the other, and one leaked signing secret would compromise both.

   This handler verifies the Stripe signature (reusing verifyStripeSignature above:
   HMAC-SHA256, constant-time compare, 5-minute replay window), extracts only the
   subscription fields Convex needs, and forwards them over a shared secret. It
   deliberately does NOT decide anything about entitlement — idempotency, ordering
   and account resolution all live in the Convex mutation, which is the only place
   that can see existing state.
   ================================================================================= */

// Events that carry subscription lifecycle. Anything else is acknowledged and
// ignored, so Stripe stops retrying without us acting on noise.
const BILLING_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'checkout.session.expired',
]);

async function fetchStripeSubscription(subId, env) {
  try {
    const r = await fetch('https://api.stripe.com/v1/subscriptions/' + subId, {
      headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY },
    });
    return r.ok ? await r.json() : null;
  } catch (e) {
    return null;
  }
}

async function handleBillingWebhook(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  if (!env.STRIPE_BILLING_WEBHOOK_SECRET || !env.CONVEX_SITE_URL || !env.BILLING_WEBHOOK_SECRET) {
    return new Response('Webhook not configured', { status: 500 });
  }

  const payload = await request.text();
  const ok = await verifyStripeSignature(
    payload,
    request.headers.get('Stripe-Signature'),
    env.STRIPE_BILLING_WEBHOOK_SECRET,
  );
  if (!ok) return new Response('Invalid signature', { status: 400 });

  let event;
  try { event = JSON.parse(payload); } catch (e) { return new Response('Bad payload', { status: 400 }); }

  const type = event && event.type;
  // Acknowledge anything we do not act on. Returning 200 here is correct: the
  // event was received and verified, we simply have no state change to make.
  if (!BILLING_EVENTS.has(type)) return new Response('ok', { status: 200 });

  const obj = (event.data && event.data.object) || {};
  let sub = null;
  let customerId = null;
  let subscriptionId = null;

  if (type.startsWith('customer.subscription.')) {
    sub = obj;
    subscriptionId = obj.id || null;
    customerId = typeof obj.customer === 'string' ? obj.customer : (obj.customer && obj.customer.id) || null;
  } else if (type.startsWith('checkout.session.')) {
    // Only subscription-mode sessions matter here. A donation session (mode
    // 'payment', or a recurring GIFT) must never be treated as a Plus purchase.
    if (obj.mode !== 'subscription') return new Response('ok', { status: 200 });
    subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : null;
    customerId = typeof obj.customer === 'string' ? obj.customer : null;
    // The session alone does not carry period/status, so read the subscription.
    if (subscriptionId) sub = await fetchStripeSubscription(subscriptionId, env);
  } else if (type.startsWith('invoice.')) {
    subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : null;
    customerId = typeof obj.customer === 'string' ? obj.customer : null;
    if (!subscriptionId) return new Response('ok', { status: 200 });
    sub = await fetchStripeSubscription(subscriptionId, env);
  }

  if (!sub || !subscriptionId || !customerId) {
    // Nothing actionable (e.g. an expired session that never became a
    // subscription). Acknowledge so Stripe stops retrying.
    return new Response('ok', { status: 200 });
  }

  const item = (sub.items && sub.items.data && sub.items.data[0]) || null;
  const price = item && item.price;

  const body = {
    eventId: event.id,
    eventType: type,
    eventCreated: event.created,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    status: sub.status,
    stripePriceId: (price && price.id) || undefined,
    billingInterval: (price && price.recurring && price.recurring.interval) || undefined,
    currentPeriodStart: sub.current_period_start,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    canceledAt: sub.canceled_at || undefined,
    trialEnd: sub.trial_end || undefined,
    latestInvoiceId: typeof sub.latest_invoice === 'string' ? sub.latest_invoice : undefined,
    // Only the value WE set at Checkout for an authenticated user. Never a
    // browser-supplied id.
    metadataUserId: (sub.metadata && sub.metadata.userId) || (obj.metadata && obj.metadata.userId) || undefined,
  };

  try {
    const r = await fetch(env.CONVEX_SITE_URL + '/billing/subscription-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-billing-secret': env.BILLING_WEBHOOK_SECRET },
      body: JSON.stringify(body),
    });
    // Log status only — never the payload. It carries customer and subscription
    // ids that have no business sitting in logs.
    console.log('[billing/webhook] type=' + type + ' convex=' + r.status);
    if (!r.ok) return new Response('Downstream error', { status: 500 }); // let Stripe retry
  } catch (e) {
    return new Response('Downstream error', { status: 500 });
  }
  return new Response('ok', { status: 200 });
}

/* ── Journey prose translation (INTERNAL) ──────────────────────────────────
 * POST /internal/journey/translate
 *
 * Translates JOURNEY-AUTHORED copy of a completed day into Spanish. Called only
 * by the authenticated Convex action, which has already established identity
 * and reserved a quota slot. This route knows nothing about accounts and must
 * never be given a user identifier.
 *
 * SEPARATE FROM /today ON PURPOSE. Different secret, different quota owner,
 * different failure surface. A translation must never consume the Gentle
 * Guidance allowance or be blocked by the /today IP rate limit, and vice versa.
 *
 * THIS IS THE SECOND VALIDATION BOUNDARY. The Convex action already validated
 * the payload; it is validated again here, independently. One shared check
 * would be one point of failure.
 */
const JT_ALLOWED_FIELDS = ['title', 'encouragement', 'commentary', 'prayer', 'declaration', 'reflectionPrompt'];
const JT_FORBIDDEN_KEYS = new Set([
  'reflection', 'reflectiontext', 'userprayer', 'usertext', 'usernote',
  'vault', 'vaultitems', 'crisis', 'supportdisclosure',
  'userid', 'accountid', 'email', 'sub', 'identity',
  'verse', 'versetext', 'scripture', 'prompt', 'systemprompt', 'instructions', 'messages',
]);
const JT_MAX_FIELD_CHARS = 4000;
const JT_MAX_TOTAL_CHARS = 12000;
/* Hard ceiling on the RAW provider response before parsing. A translation of a
 * 12k-char payload cannot legitimately exceed this; anything larger is a
 * runaway generation and is refused rather than parsed. */
const JT_MAX_RESPONSE_CHARS = 64000;
/* The Convex action holds a reservation for the duration of this call, so it
 * must not hang. Without a timeout a stalled provider would pin an account's
 * single concurrent slot until the 2-minute reservation TTL reclaimed it. */
const JT_TIMEOUT_MS = 45000;

function jtValidateFields(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'fields-not-object' };
  const out = {};
  let total = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (JT_FORBIDDEN_KEYS.has(key.toLowerCase())) return { ok: false, reason: 'forbidden-field' };
    if (!JT_ALLOWED_FIELDS.includes(key)) return { ok: false, reason: 'unknown-field' };
    if (typeof value !== 'string') return { ok: false, reason: 'field-not-string' };
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (trimmed.length > JT_MAX_FIELD_CHARS) return { ok: false, reason: 'field-too-long' };
    total += trimmed.length;
    out[key] = trimmed;
  }
  if (!total) return { ok: false, reason: 'empty-request' };
  if (total > JT_MAX_TOTAL_CHARS) return { ok: false, reason: 'payload-too-long' };
  return { ok: true, fields: out };
}

/* Faithful transformation, not generation. The model is given ONLY the authored
 * fields and is told, explicitly, that it may not add theology or pastoral
 * advice, may not remove support language, and may not produce Scripture. */
const JT_SYSTEM = [
  'You translate devotional copy from English to Latin American Spanish (es-LA), using informal "tú".',
  'This is a FAITHFUL TRANSLATION, not a rewrite and not new writing.',
  'Rules, all mandatory:',
  '- Preserve the meaning of every field exactly.',
  '- Preserve paragraph and section boundaries within a field.',
  '- Do NOT add pastoral advice, theology, encouragement or commentary that is not in the source.',
  '- Do NOT remove or soften any warning, caution or support language.',
  '- Do NOT include any Bible quotation. If the source names a Scripture reference, keep the reference as-is and translate nothing of the quoted text.',
  '- Do NOT address the reader by name or invent details.',
  '- Never speak as God or as Jesus.',
  'Return ONLY a JSON object whose keys are exactly the keys you were given, each mapped to its Spanish translation. No prose outside the JSON.',
].join('\n');

async function handleJourneyTranslate(request, env) {
  // No CORS preflight support: this route is not for browsers.
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, reason: 'method-not-allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }
  const expected = env.JOURNEY_TRANSLATE_SECRET || '';
  const provided = request.headers.get('X-Declare-Internal') || '';
  // Constant-time compare, and refuse when unconfigured rather than allowing all.
  if (!expected || !timingSafeEqualHex(provided, expected)) {
    return new Response(JSON.stringify({ ok: false, reason: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ ok: false, reason: 'not-configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, reason: 'bad-json' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (body && ('userId' in body || 'accountId' in body || 'email' in body)) {
    return new Response(JSON.stringify({ ok: false, reason: 'identity-not-accepted' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!body || body.sourceLocale !== 'en' || body.displayLocale !== 'es') {
    return new Response(JSON.stringify({ ok: false, reason: 'unsupported-locale-pair' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  const validated = jtValidateFields(body.fields);
  if (!validated.ok) {
    return new Response(JSON.stringify({ ok: false, reason: validated.reason }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const model = 'claude-sonnet-4-6';
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(JT_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        // Low variance: this is a translation, not a creative act.
        temperature: 0.2,
        system: JT_SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(validated.fields) }],
      }),
    });
  } catch (e) {
    // Reason codes only. No provider body, no prompt, no stack trace.
    const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return new Response(JSON.stringify({ ok: false, reason: timedOut ? 'provider-timeout' : 'provider-unreachable' }), {
      status: timedOut ? 504 : 502, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!res.ok) {
    // Status is echoed so the caller can tell rate limiting from a hard failure,
    // but no provider body is forwarded.
    return new Response(JSON.stringify({ ok: false, reason: 'provider-failure' }), {
      status: res.status === 429 ? 429 : 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  let out;
  try {
    const raw = await res.text();
    if (raw.length > JT_MAX_RESPONSE_CHARS) throw new Error('response-too-large');
    const json = JSON.parse(raw);
    const text = (json.content || []).map((b) => (b && b.type === 'text' ? b.text : '')).join('');
    const sliced = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    out = JSON.parse(sliced);
  } catch {
    return new Response(JSON.stringify({ ok: false, reason: 'unparseable-model-output' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate the model's output with the same allowlist, then confirm it did not
  // invent a section that was never sent.
  const checked = jtValidateFields(out);
  if (!checked.ok) {
    return new Response(JSON.stringify({ ok: false, reason: 'malformed-model-output' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }
  for (const key of Object.keys(checked.fields)) {
    if (!(key in validated.fields)) {
      return new Response(JSON.stringify({ ok: false, reason: 'model-added-field' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Privacy-safe log: counts and identifiers of SHAPE only. No content, no
  // account, no reference — nothing that could reconstruct what was translated.
  console.log(JSON.stringify({
    evt: 'journey_translate',
    fields: Object.keys(checked.fields).length,
    chars: Object.values(checked.fields).reduce((n, v) => n + v.length, 0),
    model,
  }));

  return new Response(JSON.stringify({ ok: true, fields: checked.fields, model }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    // Bible reader + studio routes — additive; the Anthropic proxy below is unchanged.
    const pathname = new URL(request.url).pathname;
    if (pathname === '/unsplash/search' || pathname === '/unsplash/track' || pathname === '/unsplash/photo') {
      return handleUnsplash(request, env, pathname);
    }
    if (pathname === '/bible/search') {
      return handleBibleSearch(request, env);
    }
    if (pathname === '/bible') {
      return handleBible(request, env);
    }
    /* ===== Donation endpoints: fully retired =======================================
       All FOUR /give/* routes are permanently gone.

         /give/checkout      took body.userId as the gift's owner -> a gift could be
                             attributed to another account.
         /give/portal        took body.userId AND fell back to searching Stripe by a
                             SUBMITTED EMAIL -> submitting anyone's address opened
                             their billing portal. Full IDOR.
         /give/subscription  took body.subscriptionId with no ownership check -> any
                             sub_... id disclosed its status and period end.
         /give/webhook       retired with the product itself. Production giftHistory
                             held ZERO rows, so no user was ever linked to a gift and
                             there is nothing left to record. Retiring it does NOT
                             stop a Stripe charge — only cancelling in Stripe does.

       The first three trusted the browser for identity, which this Worker cannot
       verify, so they were retired rather than patched: there is no safe version of
       "tell me who you are" available at this layer. Their handlers are deleted, not
       merely unrouted.

       Nothing replaces them. The giving product is gone: no acknowledgement route,
       no Giving History, no recurring-gift management.

       410 Gone rather than 404: these endpoints existed and are permanently retired,
       so a caller should not retry. Stripe treats 4xx as delivered-and-rejected and
       stops retrying. The body carries a stable code, not English prose, so the
       client localizes it.

       RETAINED above: timingSafeEqualHex + verifyStripeSignature, which the Plus
       subscription webhook depends on. ============================================ */
    if (
      pathname === '/give/checkout' ||
      pathname === '/give/portal' ||
      pathname === '/give/subscription' ||
      pathname === '/give/webhook'
    ) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      return jsonResponse({ error: 'donations-retired' }, 410, CORS_HEADERS);
    }
    // Plus subscriptions. Separate route, separate signing secret, separate
    // Convex tables — the donation routes above are untouched by it.
    if (pathname === '/billing/webhook') {
      return handleBillingWebhook(request, env);
    }

    // Journey prose translation. INTERNAL ONLY: called server-to-server by the
    // authenticated Convex action, never by a browser. No CORS headers are
    // emitted on this route on purpose — a browser must not be able to read a
    // response from it even if it somehow guessed the secret.
    if (pathname === '/internal/journey/translate') {
      return handleJourneyTranslate(request, env);
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
