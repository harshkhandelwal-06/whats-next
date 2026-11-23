// Email + password accounts and per-account storage, on a free Supabase project. Plain fetch, no SDK.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';

const SK = 'wn:supa', SESS = 'wn:sess';
const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/** The server address and public key: built in (config.js / env) or typed once on the sign-in screen. */
export function server() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return { url: SUPABASE_URL.replace(/\/+$/, ''), key: SUPABASE_ANON_KEY, fixed: true };
  const v = read(SK); return v?.url && v?.key ? { url: String(v.url).replace(/\/+$/, ''), key: v.key, fixed: false } : null;
}
export const hasServer = () => !!server();
export function setServer(url, key) {
  url = String(url || '').trim().replace(/\/+$/, ''); key = String(key || '').trim();
  if (!/^https:\/\/[\w-]+\.supabase\.(co|in)$/.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) throw new Error('That does not look like a Supabase project URL. It looks like https://abcd1234.supabase.co');
  if (key.length < 30) throw new Error('That does not look like the anon public key. It is a long text that starts with sb_publishable_ (or eyJ for older projects).');
  write(SK, { url, key });
}
export const clearServer = () => write(SK, null);

const nice = (r, d) => {
  const raw = String(d?.msg || d?.error_description || d?.message || d?.error || '').trim(), m = raw.toLowerCase();
  if (/invalid login/.test(m)) return 'Wrong email or password.';
  if (/already registered|already been registered|user_already_exists/.test(m)) return 'That email already has an account. Sign in instead.';
  if (/email not confirmed/.test(m)) return 'Confirm your email first. Open the message we sent you, then sign in.';
  if (/password should be|weak_password/.test(m)) return 'Choose a stronger password (at least 8 characters).';
  if (/rate limit|too many|over_email_send_rate/.test(m) || r.status === 429) return 'Too many tries. Wait a minute and try again.';
  if (/signups? not allowed|signup_disabled/.test(m)) return 'New sign-ups are turned off for this app.';
  if (/valid email|invalid email|email_address_invalid/.test(m)) return 'That email address does not look right.';
  return raw || 'Something went wrong (' + r.status + ').';
};
async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  const s = server(); if (!s) throw new Error('This app is not connected to a server yet.');
  let r; try { r = await fetch(s.url + path, { method, headers: { apikey: s.key, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Could not reach the server. Check your connection.'); }
  const txt = await r.text(); let d = null; try { d = txt ? JSON.parse(txt) : null; } catch {}
  if (!r.ok) { const e = new Error(nice(r, d)); e.status = r.status; e.code = d?.code || d?.error_code || ''; throw e; }
  return d;
}

/* ---------- session ---------- */
let sess = read(SESS), timer = 0;
const keep = v => { sess = v; write(SESS, v); };
function adopt(d) {
  const u = d.user || sess?.user || {};
  keep({ at: d.access_token, rt: d.refresh_token, exp: Date.now() + (d.expires_in || 3600) * 1000, user: { id: u.id, email: u.email, name: u.user_metadata?.name || '' } });
  later(); return sess.user;
}
function later() { clearTimeout(timer); if (!sess) return; timer = setTimeout(() => { token().catch(() => {}); }, Math.max(15000, sess.exp - Date.now() - 120000)); }
export const user = () => sess?.user || null;
export const signedIn = () => !!sess?.rt;

/** A valid access token, renewed with the refresh token when it is about to lapse. Throws 'auth' only when the login really ended. */
let renewing = null;
export async function token() {
  if (!sess) throw new Error('auth');
  if (sess.exp > Date.now() + 60000) return sess.at;
  if (!renewing) renewing = (async () => {
    try { adopt(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.rt } })); }
    catch (e) { if (e.status === 400 || e.status === 401 || e.status === 403) { keep(null); throw new Error('auth'); } throw e; }
    finally { renewing = null; }
  })();
  await renewing; return sess.at;
}

export async function signUp(email, password, name) {
  const d = await call('/auth/v1/signup', { method: 'POST', body: { email, password, data: { name: String(name || '').trim().slice(0, 40) } } });
  if (d?.access_token) return { user: adopt(d), confirm: false };
  return { user: null, confirm: true };      // the project asks new users to confirm by email first
}
export async function signIn(email, password) { return adopt(await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })); }
/** retain=true leaves the login valid on the server, for devices where fingerprint/face unlock will bring it back. */
export async function signOutRemote(retain = false) { const t = sess?.at; write(SESS, null); sess = null; clearTimeout(timer); if (t && !retain) { try { await call('/auth/v1/logout', { method: 'POST', token: t, body: {} }); } catch {} } }
export const refreshToken = () => sess?.rt || '';
/** Pick a saved login back up from its refresh token (used after a fingerprint/face check). */
export async function resume(rt) { keep({ at: '', rt, exp: 0, user: { id: '', email: '', name: '' } }); await token(); return whoAmI(); }
export const sendReset = email => call('/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', body: { email } }).then(() => true);
export async function changePassword(password) { const t = await token(); await call('/auth/v1/user', { method: 'PUT', token: t, body: { password } }); return true; }

/** When a reset link brings the user back, the address carries a short-lived login. Take it, and tell the caller to ask for a new password. */
export function takeRecovery() {
  const h = new URLSearchParams(String(location.hash || '').replace(/^#\/?/, '')); if (h.get('type') !== 'recovery' || !h.get('access_token')) return false;
  keep({ at: h.get('access_token'), rt: h.get('refresh_token') || '', exp: Date.now() + (+h.get('expires_in') || 3600) * 1000, user: { id: '', email: '', name: '' } });
  history.replaceState(null, '', location.pathname + location.search); return true;
}
export async function whoAmI() { const t = await token(); const u = await call('/auth/v1/user', { token: t }); sess.user = { id: u.id, email: u.email, name: u.user_metadata?.name || '' }; write(SESS, sess); return sess.user; }

/* ---------- data (row rules make every row private to its owner) ---------- */
export async function rest(path, opt = {}) { return call('/rest/v1/' + path, { ...opt, token: await token() }); }
export const rpc = (fn, args, authed = true) => authed ? rest('rpc/' + fn, { method: 'POST', body: args }) : call('/rest/v1/rpc/' + fn, { method: 'POST', body: args });
