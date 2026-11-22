// Movie night friends, by share code. No server, no requests.
// "Share my taste" saves a small public-link file in YOUR Google Drive (only the titles you watched or saved, with your ratings)
// and gives you a code. A friend pastes the code into Movie night. Turn the code off and the file is deleted, so it stops working.
import { GOOGLE_API_KEY } from './config.js';
import { getAccount, S, save } from './state.js';
import { gClient, loadGIS } from './sync.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';   // only files this app creates
const DRV = 'https://www.googleapis.com/drive/v3', UPL = 'https://www.googleapis.com/upload/drive/v3';
let FT = null, FEXP = 0;

const sub = () => String(getAccount()?.sub || '').replace(/[^\w-]/g, '');
const tkey = () => 'wn:ftok:' + sub();
function restore() { try { const v = JSON.parse(localStorage.getItem(tkey()) || 'null'); if (v?.t && v.exp > Date.now() + 60000) { FT = v.t; FEXP = v.exp; } } catch {} }
export const hasShareAccess = () => { if (!FT) restore(); return !!FT && Date.now() < FEXP - 60000; };
export const apiKey = () => GOOGLE_API_KEY || (S.cfg.gApiKey || '').trim();

/** Google token for "files this app creates". `interactive` opens Google's permission window (needed once). */
export async function shareToken(interactive) {
  if (hasShareAccess()) return FT;
  if (!gClient()) throw new Error('Add your Google Client ID in Settings first.');
  await loadGIS();
  return new Promise((res, rej) => {
    const c = google.accounts.oauth2.initTokenClient({ client_id: gClient(), scope: 'openid email profile ' + SCOPE,
      callback: r => { if (r.error) return rej(new Error(r.error)); FT = r.access_token; FEXP = Date.now() + (r.expires_in || 3600) * 1000; try { localStorage.setItem(tkey(), JSON.stringify({ t: FT, exp: FEXP })); } catch {} res(FT); },
      error_callback: e => rej(new Error(e?.type || 'popup_closed')) });
    c.requestAccessToken({ prompt: interactive ? '' : 'none', hint: getAccount()?.email || undefined });
  });
}
async function df(url, opt = {}, interactive = true) {
  const t = await shareToken(interactive), r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + t, ...(opt.headers || {}) } });
  if (r.status === 401) { FT = null; try { localStorage.removeItem(tkey()); } catch {} throw new Error('auth'); }
  if (r.status === 403) throw new Error('Google refused. Make sure the Google Drive API is enabled for your project.');
  if (!r.ok) throw new Error('Drive error ' + r.status);
  return r;
}

export const codeOf = id => 'wn-' + id;
export const idOf = c => (String(c || '').trim().match(/^wn-([\w-]{10,80})$/) || [])[1] || '';
export const myCode = () => (S.cfg.myShare?.id ? codeOf(S.cfg.myShare.id) : '');

/** What a code reveals: titles you watched or saved, with your rating. Never keys, settings or other profiles. */
export function snapshot() {
  const lib = {};
  for (const [k, e] of Object.entries(S.lib)) if (['watched', 'watchlist', 'watching'].includes(e.status)) lib[k] = { i: e.id, t: e.type, n: e.title, y: e.year, p: e.poster, g: e.genres, s: e.status === 'watched' ? 'w' : 'l', m: e.my };
  const a = getAccount() || {};
  return { v: 1, kind: 'wn-share', ts: Date.now(), name: a.name || (a.email || '').split('@')[0] || 'Friend', lib };
}

export async function createShare() {
  if (S.cfg.myShare?.id) return myCode();
  const b = 'wn' + Date.now();
  const mp = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: 'whatsnext-share.json' })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(snapshot())}\r\n--${b}--`;
  const f = await (await df(`${UPL}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: mp })).json();
  try { await df(`${DRV}/files/${f.id}/permissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone' }) }); }
  catch (e) { await df(`${DRV}/files/${f.id}`, { method: 'DELETE' }).catch(() => {}); throw e; }
  S.cfg.myShare = { id: f.id, ts: Date.now() }; save(); return myCode();
}
export async function updateShare(interactive = false) {
  if (!S.cfg.myShare?.id) return;
  await df(`${UPL}/files/${S.cfg.myShare.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot()) }, interactive);
  S.cfg.myShare = { ...S.cfg.myShare, ts: Date.now() }; save(false);
}
/** Turn the code off. The file is deleted, so every friend's copy of the code stops working. */
export async function stopShare() {
  const id = S.cfg.myShare?.id; if (!id) return;
  try { await df(`${DRV}/files/${id}`, { method: 'DELETE' }); } catch (e) { if (!/404/.test(e.message)) throw e; }
  S.cfg.myShare = null; save();
}

/** Read a friend's shared taste. Throws a friendly error if the code is wrong or was turned off. */
export async function fetchFriend(id) {
  const k = apiKey(); if (!k) throw new Error('Add a Google API key in Settings to use friend codes.');
  let r; try { r = await fetch(`${DRV}/files/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(k)}`); } catch { throw new Error('Could not reach Google. Check your connection.'); }
  if (r.status === 404 || r.status === 403 || r.status === 400) throw new Error('This code is not active. Ask your friend for a new one.');
  if (!r.ok) throw new Error('Could not load that code (' + r.status + ').');
  const d = await r.json(); if (d?.kind !== 'wn-share') throw new Error('That is not a What\'s Next code.');
  return d;
}
/** A friend's shared titles, shaped like a library so the same taste maths works on it. */
export function friendLib(d) {
  const lib = {};
  for (const [k, e] of Object.entries(d?.lib || {})) lib[k] = { id: e.i, type: e.t, title: e.n, year: e.y, poster: e.p, genres: e.g || [], status: e.s === 'w' ? 'watched' : 'watchlist', my: e.m };
  return lib;
}

export const friends = () => (Array.isArray(S.cfg.friends) ? S.cfg.friends : (S.cfg.friends = []));
export function addFriend(code, name) {
  const id = idOf(code); if (!id) throw new Error('That does not look like a What\'s Next code. It starts with wn-.');
  if (id === S.cfg.myShare?.id) throw new Error('That is your own code.');
  if (friends().some(f => f.id === id)) throw new Error('You already added that code.');
  S.cfg.friends = [...friends(), { id, name: String(name || '').trim().slice(0, 24) || 'Friend', ts: Date.now() }]; save(); return id;
}
export function removeFriend(id) { S.cfg.friends = friends().filter(f => f.id !== id); save(); }
export function renameFriend(id, name) { S.cfg.friends = friends().map(f => (f.id === id ? { ...f, name } : f)); save(false); }

let timer = 0;
/** Keep your shared copy fresh a little after you change your library (only if Google is already connected). */
export function schedulePublish() {
  clearTimeout(timer);
  if (!S.cfg.myShare?.id || !hasShareAccess()) return;
  timer = setTimeout(() => updateShare(false).catch(() => {}), 15000);
}
document.addEventListener('wn:lib', schedulePublish);
