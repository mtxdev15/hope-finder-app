/* Declare & Believe — real accounts (Supabase Auth).
   Single source of truth for sign-up / sign-in / session state, same
   one-module pattern as vault-store and profile-store.

   The anon key is public-class (like the Maps key): it only allows what
   Supabase's row-level security allows, and we store no user data server-side
   yet — the account simply gates actions. Keys live in the gitignored .env:
     PUBLIC_SUPABASE_URL=...
     PUBLIC_SUPABASE_ANON_KEY=...

   UNCONFIGURED (keys missing): isConfigured() is false and every gate fails
   OPEN — the app keeps working ungated rather than breaking. /signin shows
   its "Almost ready" panel. */

import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.PUBLIC_SUPABASE_URL || '';
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

let client = null;
let session = null;
let inited = null;
const subs = [];

export function isConfigured() {
  return !!(URL && KEY);
}

function sb() {
  if (!client && isConfigured()) client = createClient(URL, KEY);
  return client;
}

/* Resolve the persisted session once per page load; after this resolves,
   isSignedIn()/currentUser() are synchronous. */
export function initAuth() {
  if (inited) return inited;
  if (!isConfigured()) {
    console.warn('[auth] PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY not set — sign-in gates are open.');
    inited = Promise.resolve(null);
    return inited;
  }
  inited = sb().auth.getSession()
    .then(({ data }) => { session = data.session || null; return session; })
    .catch(() => { session = null; return null; });
  sb().auth.onAuthStateChange((_event, s) => { session = s || null; subs.forEach((cb) => { try { cb(); } catch (e) {} }); });
  return inited;
}

/* pages that display session state (e.g. /you) re-render on change */
export function onAuthChange(cb) { subs.push(cb); }

export function isSignedIn() {
  return !!session;
}

export function currentUser() {
  if (!session || !session.user) return null;
  const u = session.user;
  return {
    email: u.email || '',
    firstName: (u.user_metadata && u.user_metadata.first_name) || '',
  };
}

/* All three return { ok, error } — error is a human sentence, never a code. */
function nice(err) {
  const m = (err && err.message) || '';
  if (/invalid login credentials/i.test(m)) return 'That email and password don’t match. Try again?';
  if (/already registered/i.test(m)) return 'That email already has an account — sign in instead.';
  if (/rate limit/i.test(m)) return 'Too many tries — wait a moment and try again.';
  if (/valid email/i.test(m)) return 'That doesn’t look like an email address.';
  if (/password should be at least/i.test(m)) return 'Use at least 8 characters for your password.';
  if (/failed to fetch|network|load failed/i.test(m)) return 'Can’t reach the server — check your connection and try again.';
  if (/provider is not enabled|not enabled/i.test(m)) return 'That sign-in option isn’t turned on yet.';
  if (/same.*password|should be different/i.test(m)) return 'Choose a password different from your old one.';
  if (/session.*missing|auth session|expired|invalid|otp/i.test(m)) return 'This reset link has expired — request a new one.';
  if (/for security purposes|only request this after|rate/i.test(m)) return 'Just sent one — give it a minute before trying again.';
  return m || 'Something went wrong — please try again.';
}

export async function signUp({ name, email, password }) {
  if (!isConfigured()) return { ok: false, error: 'Accounts aren’t set up yet.' };
  const { data, error } = await sb().auth.signUp({
    email, password,
    options: { data: { first_name: name || '' } },
  });
  if (error) return { ok: false, error: nice(error) };
  session = data.session || session;
  // "Confirm email" ON in Supabase => no session until they click the email
  if (!data.session) return { ok: true, needsConfirm: true };
  return { ok: true };
}

export async function signIn({ email, password }) {
  if (!isConfigured()) return { ok: false, error: 'Accounts aren’t set up yet.' };
  const { data, error } = await sb().auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: nice(error) };
  session = data.session || null;
  return { ok: true };
}

/* Forgot password — sends an email with a recovery link to `redirectTo`
   (which must be in Supabase's redirect allow-list). The link lands on
   /reset-password, where the recovery session lets updatePassword() run. */
export async function resetPassword(email, redirectTo) {
  if (!isConfigured()) return { ok: false, error: 'Accounts aren’t set up yet.' };
  const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { ok: false, error: nice(error) };
  return { ok: true };
}

/* Set a new password — only works while a recovery (or normal) session is
   active, i.e. after the user has followed the reset link. */
export async function updatePassword(password) {
  if (!isConfigured()) return { ok: false, error: 'Accounts aren’t set up yet.' };
  const { error } = await sb().auth.updateUser({ password });
  if (error) return { ok: false, error: nice(error) };
  return { ok: true };
}

/* OAuth (Google / Apple / Facebook). This LEAVES the page: the browser
   redirects to the provider and returns to `redirectTo`, where the client
   re-establishes the session from the URL automatically (detectSessionInUrl).
   `redirectTo` must be listed in Supabase → Authentication → URL Configuration. */
export async function signInWithProvider(provider, redirectTo) {
  if (!isConfigured()) return { ok: false, error: 'Accounts aren’t set up yet.' };
  const { error } = await sb().auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) return { ok: false, error: nice(error) };
  return { ok: true }; // success = the browser is now navigating away
}

export async function signOut() {
  if (!isConfigured()) return;
  try { await sb().auth.signOut(); } catch (e) {}
  session = null;
}
