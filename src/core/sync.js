import { toast } from './library.js';
import { ACTIVE, PROFILES, S, activeData, createProfile, getAccount, leaveProfile, loadProfileData, save, saveMeta, writeProfileData } from './state.js';
import { mergeData, mergeProfiles } from './merge.js';
import { $, esc } from './utils.js';
import { route } from '../router.js';
import { openSettings } from '../ui/settings.js';
import { hasServer, rest, signedIn, token, user } from './supa.js';

export { hasServer, signedIn };
let gTimer = null, gBusy = false, gLast = 0;

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
  const b = $('#sync'); if (!b) return; b.className = 'mi ' + state;
  const t = $('#syncTxt'); if (t) t.textContent = { ok: 'On', busy: 'Syncing…', off: !hasServer() ? 'Set up' : 'Sign in', err: 'Problem' }[state];
  b.title = { ok: 'Saved to your account. Click to sync now.', busy: 'Syncing…', off: !hasServer() ? 'This app has no server set up yet' : 'Sign in again to sync', err: 'Sync problem: ' + (msg || '') }[state];
  const w = $('#who'); if (w) { w.dataset.sync = state; }
}

const TABLE = 'wn_data';
const readRemote = async uid => (await rest(`${TABLE}?select=data&user_id=eq.${encodeURIComponent(uid)}`))?.[0]?.data || null;
const writeRemote = (uid, data) => rest(`${TABLE}?on_conflict=user_id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { user_id: uid, data, updated_at: new Date().toISOString() } });

/** Merge what is saved in the account with this device, then save the merged result back. Safe to run from any device at any time. */
export async function syncNow(interactive = false) {
  if (!hasServer()) { if (interactive) openSettings(); return; }
  const u = user(), cur = getAccount();
  if (!u || !cur || !signedIn()) { setSync('off'); return; }
  if (gBusy) return; gBusy = true; setSync('busy');
  try {
    await token();
    if (cur.sub !== u.id) throw new Error('This device is signed in as someone else. Sign out and sign in again.');
    S.cfg.gSync = true; save(false);
    const changed = mergeIn(await readRemote(u.id));
    save(false); await writeRemote(u.id, snapshot()); gLast = Date.now(); setSync('ok');
    if (changed) { toast('Loaded your saved lists', 2600); route(true); }
    else if (interactive) toast('Everything is synced', 1800);
  } catch (e) {
    if (e.message === 'auth') { setSync('off'); document.dispatchEvent(new CustomEvent('wn:authlost')); }
    else if (/Could not reach/.test(e.message)) setSync('err', e.message);
    else { const m = /relation|wn_data|42P01|PGRST205|404/.test(e.message + (e.code || '')) ? 'The database is not set up yet. Run supabase/setup.sql in your Supabase project.' : e.message; setSync('err', m); if (interactive) toast(esc(m), 6000); }
  } finally { gBusy = false; }
}

export const resumeSync = () => { if (hasServer() && signedIn() && getAccount()) syncNow(false); };

export function scheduleSync() { if (!getAccount() || !hasServer() || !signedIn()) return; clearTimeout(gTimer); gTimer = setTimeout(() => syncNow(false), 2500); }

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && signedIn() && Date.now() - gLast > 60000) syncNow(false); });
addEventListener('online', () => { if (signedIn()) syncNow(false); });
