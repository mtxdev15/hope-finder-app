/* Declare & Believe — authenticated Convex data client (vault + userData sync).

   Talks to the Convex DATA endpoint (PUBLIC_CONVEX_URL, the .convex.cloud URL,
   distinct from the .site auth URL). The auth token is minted from the Better
   Auth session via ac().convex.token().

   IMPORTANT: the heavy Convex client (`convex/browser`) and the generated `api`
   are LAZY-loaded — only when a real query/mutation runs. This keeps the Convex
   client OUT of the static import graph of the auth modal / profile-store / the
   sign-in path (importing it there once hung sign-in on mobile).

   Every call fails SOFT: if data isn't configured, the user isn't signed in, or
   the network hiccups, these return null and the caller stays on localStorage. */

import { getAuthClient, isConfigured } from './auth-store.js';

const URL = import.meta.env.PUBLIC_CONVEX_URL || '';

let http = null;
let apiRef = null;

/* Lightweight, synchronous — safe to call from anywhere without loading anything. */
export function dataConfigured() {
  return !!URL && isConfigured();
}

/* Lazy-load the client + api on first real use. Returns false if not configured. */
async function ensure() {
  if (!URL) return false;
  try {
    if (!http) {
      const { ConvexHttpClient } = await import('convex/browser');
      http = new ConvexHttpClient(URL);
    }
    if (!apiRef) {
      apiRef = (await import('../../../convex/_generated/api')).api;
    }
    return true;
  } catch (e) { return false; }
}

async function freshToken() {
  try {
    const ac = getAuthClient();
    if (!ac || !ac.convex) return null;
    const res = await ac.convex.token({ fetchOptions: { throw: false } });
    return (res && res.data && res.data.token) || null;
  } catch (e) { return null; }
}

async function authed() {
  if (!(await ensure())) return null;
  const t = await freshToken();
  if (!t) return null;
  http.setAuth(t);
  return http;
}

async function runQuery(fn, args) {
  try { const c = await authed(); return c ? await c.query(fn, args || {}) : null; }
  catch (e) { return null; }
}
async function runMutation(fn, args) {
  try { const c = await authed(); return c ? await c.mutation(fn, args || {}) : null; }
  catch (e) { return null; }
}

/* ── Vault ── */
export async function vaultList() { return (await ensure()) ? runQuery(apiRef.vault.list, {}) : null; }
export async function vaultSave(payload) { return (await ensure()) ? runMutation(apiRef.vault.save, payload) : null; }
export async function vaultRemove(clientId) { return (await ensure()) ? runMutation(apiRef.vault.remove, { clientId }) : null; }
export async function collList() { return (await ensure()) ? runQuery(apiRef.vault.listCollections, {}) : null; }
export async function collAdd(name, kind, ts) { return (await ensure()) ? runMutation(apiRef.vault.addCollection, { name, kind: kind ?? null, ts }) : null; }
export async function collRemove(name) { return (await ensure()) ? runMutation(apiRef.vault.removeCollection, { name }) : null; }

/* ── generic per-user key/value blobs (profile, journey, …) ── */
export async function udGetAll() { return (await ensure()) ? runQuery(apiRef.userdata.getAll, {}) : null; }
export async function udSet(key, value) { return (await ensure()) ? runMutation(apiRef.userdata.set, { key, value }) : null; }
