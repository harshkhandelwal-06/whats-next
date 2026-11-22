import { GOOGLE_CLIENT_ID } from './config.js';
import { toast } from './library.js';
import { ACTIVE, PROFILES, S, activeData, createProfile, getAccount, leaveProfile, loadProfileData, save, saveMeta, setAccount, writeProfileData } from './state.js';
import { mergeData, mergeProfiles } from './merge.js';
import { $, esc, key } from './utils.js';
import { route } from '../router.js';
import { openSettings } from '../ui/settings.js';

export let GTOK = null, GEXP = 0, gTimer = null, rTimer = null, gBusy = false, gLast = 0;

export const gClient = () => GOOGLE_CLIENT_ID || S.cfg.gClient;

export function loadGIS() { return new Promise((res, rej) => { if (window.google?.accounts?.oauth2) return res(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => rej(new Error('Could not load Google sign-in. Check your connection.')); document.head.appendChild(s); }); }

// Google access tokens last about an hour. Keep the current one across refreshes so a reload doesn't ask you to reconnect.
const tokKey = () => { const a = getAccount(); return a ? 'wn:gtok:' + String(a.sub).replace(/[^\w-]/g, '') : ''; };
function restoreTok() { try { const k = tokKey(), v = k && JSON.parse(localStorage.getItem(k) || 'null'); if (v && v.t && v.exp > Date.now() + 60000) { GTOK = v.t; GEXP = v.exp; renewLater(); } } catch {} }
function storeTok() { try { const k = tokKey(); if (k) localStorage.setItem(k, JSON.stringify({ t: GTOK, exp: GEXP })); } catch {} }
export const hasToken = () => { if (!GTOK) restoreTok(); return !!GTOK && Date.now() < GEXP - 60000; };

export async function gToken(interactive) {
  if (hasToken()) return GTOK;
  await loadGIS();
  return new Promise((res, rej) => {
    const c = google.accounts.oauth2.initTokenClient({ client_id: gClient(), scope: 'https://www.googleapis.com/auth/drive.appdata openid email profile',
      callback: r => { if (r.error) return rej(new Error(r.error)); GTOK = r.access_token; GEXP = Date.now() + (r.expires_in || 3600) * 1000; storeTok(); renewLater(); res(GTOK); },
      error_callback: e => rej(new Error(e?.type || 'popup_closed')) });
    c.requestAccessToken({ prompt: interactive ? '' : 'none', hint: getAccount()?.email || undefined });
  });
}

/** Quietly get a fresh Google token a few minutes before the old one runs out, so you are never asked to reconnect. */
function renewLater() {
  clearTimeout(rTimer);
  if (!getAccount() || !S.cfg.gSync) return;
  rTimer = setTimeout(() => { if (document.visibilityState === 'visible') { GTOK = null; syncNow(false); } else renewLater(); }, Math.max(20000, GEXP - Date.now() - 5 * 60000));
}

export const DRV = 'https://www.googleapis.com/drive/v3', UPL = 'https://www.googleapis.com/upload/drive/v3';

export async function gfetch(url, opt = {}) {
  const t = await gToken(false), r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + t, ...(opt.headers || {}) } });
  if (r.status === 401) { GTOK = null; throw new Error('auth'); }
  if (!r.ok) throw new Error('Drive error ' + r.status);
  return r;
}

export const driveFind = async () => (await (await gfetch(`${DRV}/files?spaces=appDataFolder&q=${encodeURIComponent("name='watchnext.json'")}&fields=files(id,modifiedTime)&pageSize=1`)).json()).files?.[0] || null;

export const driveRead = async id => (await gfetch(`${DRV}/files/${id}?alt=media`)).json();

export async function driveWrite(id, data) {
  const body = JSON.stringify(data);
  if (id) return gfetch(`${UPL}/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  const b = 'wn' + Date.now();
  const mp = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: 'watchnext.json', parents: ['appDataFolder'] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
  return gfetch(`${UPL}/files?uploadType=multipart`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: mp });
}

export function snapshot() {
  if (getAccount()) save(false);
  const data = {};
  for (const p of PROFILES.list) { const d = p.id === ACTIVE.id ? activeData() : loadProfileData(p.id); data[p.id] = { lib: d.lib, del: d.del, meta: d.meta, cfg: d.cfg }; }
  const out = { v: 2, ts: Date.now(), profiles: { list: PROFILES.list, del: PROFILES.del }, data };
  if (S.cfg.gSyncKeys) out.keys = { key: S.cfg.key, geminiKey: S.cfg.geminiKey, omdbKey: S.cfg.omdbKey };
  return out;
}

/** Merge a remote snapshot (v2, or the old single-profile v1) into local storage. Returns true if anything changed. */
export function mergeIn(r) {
  if (!r) return false;
  let changed = false;
  if (!r.v || r.v < 2) {
    // v1: one library. Fold it into the active profile, or the first profile.
    if (!PROFILES.list.length) createProfile({ name: 'Me' });
    const id = ACTIVE.id ? ACTIVE.id : PROFILES.list[0].id;
    if (id === ACTIVE.id) { changed = mergeData(S, r, { keys: S.cfg.gSyncKeys }); }
    else { const d = loadProfileData(id); if (mergeData(d, r)) { writeProfileData(id, d); changed = true; } }
    return changed;
  }
  const m = mergeProfiles(PROFILES.list, PROFILES.del, r.profiles?.list || [], r.profiles?.del || {});
  if (m.added.length || m.removed.length || JSON.stringify(m.list) !== JSON.stringify(PROFILES.list)) { PROFILES.list = m.list; PROFILES.del = m.del; saveMeta(false); changed = true; }
  for (const id of m.removed) { try { localStorage.removeItem('wn:p:' + id); } catch {} }
  for (const p of PROFILES.list) {
    const rd = r.data?.[p.id]; if (!rd) continue;
    if (p.id === ACTIVE.id) { if (mergeData(S, rd)) changed = true; }
    else { const d = loadProfileData(p.id); if (mergeData(d, rd)) { writeProfileData(p.id, d); changed = true; } }
  }
  if (S.cfg.gSyncKeys && r.keys) for (const k of ['key', 'geminiKey', 'omdbKey']) if (!S.cfg[k] && r.keys[k]) { S.cfg[k] = r.keys[k]; changed = true; }
  if (ACTIVE.id && !PROFILES.list.some(p => p.id === ACTIVE.id) ) leaveProfile();
  return changed;
}

export function setSync(state, msg) {
  const b = $('#sync'); if (!b) return; b.className = 'mi ' + state; const u = S.cfg.gUser;
  const t = $('#syncTxt'); if (t) t.textContent = { ok: 'On', busy: 'Syncing…', off: !gClient() ? 'Set up' : getAccount() ? 'Reconnect' : 'Sign in', err: 'Problem' }[state];
  b.title = { ok: 'Synced with Google. Click to sync now.', busy: 'Syncing…', off: !gClient() ? 'Set up Google sync' : 'Google needs you to reconnect. Click to sync now.', err: 'Sync problem: ' + (msg || '') }[state];
  const w = $('#who'); if (w) { w.dataset.sync = state; }
}

export async function syncNow(interactive = false) {
  if (!gClient()) { if (interactive) openSettings(); return; }
  if (gBusy) return; gBusy = true; setSync('busy');
  try {
    await gToken(interactive);
    let u = null; try { u = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + GTOK } })).json(); } catch {}
    if (!u?.email) throw new Error('Google did not share your email. Sign in again and allow every permission it asks for.');
    const user = { sub: u.sub || u.email, name: u.name, email: u.email, picture: u.picture }, cur = getAccount();
    if (!cur) setAccount(user);
    else if (cur.sub !== user.sub) throw new Error('That is a different Google account from the one signed in here. Sign out first to switch.');
    else S.cfg.gUser = { name: user.name, email: user.email, picture: user.picture };
    S.cfg.gSync = true; save(false); storeTok();
    try {
      const f = await driveFind(), remote = f ? await driveRead(f.id) : null, changed = mergeIn(remote);
      save(false); await driveWrite(f?.id, snapshot()); gLast = Date.now(); setSync('ok');
      if (changed) { toast('Restored from your Google account', 2600); route(true); }
      else if (interactive) toast('Everything is synced', 1800);
    } catch (e) {
      const m = /403/.test(e.message) ? 'Signed in, but Google Drive refused access. Enable the Google Drive API for your project, and tick the Drive permission on the consent screen. Your lists stay on this device until then.' : 'Signed in, but syncing failed: ' + e.message;
      // a lapsed Google session is not an error: it just needs one click to reconnect
      if (/^auth$|401/.test(e.message)) { GTOK = null; try { localStorage.removeItem(tokKey()); } catch {} setSync('off'); if (interactive) toast('Google asked you to sign in again. Click sync once more.', 4000); return; }
      setSync('err', m); if (interactive) toast(esc(m), 7000);
    }
  } catch (e) {
    // background syncs can't open a Google window, so any failure there just means "reconnect", never "problem"
    const quiet = !interactive || /auth|popup|interaction|access_denied|immediate|login_required|consent/i.test(e.message);
    setSync(quiet ? 'off' : 'err', e.message); if (interactive && !quiet) toast('Google sign-in failed: ' + esc(e.message), 6000);
  } finally { gBusy = false; }
}

export const resumeSync = () => { if (S.cfg.gSync && gClient() && getAccount()) { if (hasToken()) renewLater(); syncNow(false); } };

export function scheduleSync() { if (!getAccount() || !S.cfg.gSync || !gClient()) return; clearTimeout(gTimer); gTimer = setTimeout(() => syncNow(false), 2500); }

export function gSignOut() { try { if (GTOK) google.accounts.oauth2.revoke(GTOK, () => {}); } catch {} try { const k = tokKey(); if (k) localStorage.removeItem(k); } catch {} GTOK = null; setSync('off'); }

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.cfg.gSync && (!hasToken() || Date.now() - gLast > 60000)) syncNow(false); });
addEventListener('online', () => { if (S.cfg.gSync && !hasToken()) syncNow(false); });
