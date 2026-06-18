/* Declare & Believe — authenticated Convex data client (vault sync).

   Talks to the Convex DATA endpoint (the .convex.cloud URL in PUBLIC_CONVEX_URL,
   distinct from the .site auth URL). Auth token is minted from the existing
   Better Auth session via ac().convex.token() — the same mechanism the
   @convex-dev/better-auth React provider uses internally, here in vanilla JS.

   Every call fails SOFT: if data isn't configured, the user isn't signed in, or
   the network hiccups, these return null and the caller falls back to localStorage. */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import { getAuthClient, isConfigured } from './auth-store.js';

const URL = import.meta.env.PUBLIC_CONVEX_URL || '';

let http = null;
function client() {
  if (!http && URL) http = new ConvexHttpClient(URL);
  return http;
}

/* Data sync is available only when both the data URL and auth are configured. */
export function dataConfigured() {
  return !!URL && isConfigured();
}

async function freshToken() {
  try {
    const ac = getAuthClient();
    if (!ac || !ac.convex) return null;
    const res = await ac.convex.token({ fetchOptions: { throw: false } });
    return (res && res.data && res.data.token) || null;
  } catch (e) { return null; }
}

/* Get a client with a fresh auth token attached, or null if we can't authenticate. */
async function authed() {
  const c = client();
  if (!c) return null;
  const t = await freshToken();
  if (!t) return null;
  c.setAuth(t);
  return c;
}

async function runQuery(fn, args) {
  try { const c = await authed(); return c ? await c.query(fn, args || {}) : null; }
  catch (e) { return null; }
}
async function runMutation(fn, args) {
  try { const c = await authed(); return c ? await c.mutation(fn, args || {}) : null; }
  catch (e) { return null; }
}

/* ── Vault operations (return null on any failure; caller stays on localStorage) ── */
export function vaultList() { return runQuery(api.vault.list, {}); }
export function vaultSave(payload) { return runMutation(api.vault.save, payload); }
export function vaultRemove(clientId) { return runMutation(api.vault.remove, { clientId }); }
export function collList() { return runQuery(api.vault.listCollections, {}); }
export function collAdd(name, kind, ts) { return runMutation(api.vault.addCollection, { name, kind: kind ?? null, ts }); }
export function collRemove(name) { return runMutation(api.vault.removeCollection, { name }); }

/* ── generic per-user key/value blobs (profile, journey, …) ── */
export function udGetAll() { return runQuery(api.userdata.getAll, {}); }
export function udSet(key, value) { return runMutation(api.userdata.set, { key, value }); }
