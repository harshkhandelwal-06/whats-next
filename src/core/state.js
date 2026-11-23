import { DEF, DEF_COLOR, DEVICE_KEYS } from './defaults.js';
import { scheduleSync } from './sync.js';
export { DEF };

/* ---------- storage layout ----------
   Everything is private to the signed-in account. Keys are namespaced by its id:
   wn:acct         the signed-in account on this browser (none = signed out, nothing is shown)
   wn:<id>:device  that account's API keys and sync flags
   wn:<id>:meta    { list: profiles, del: tombstones, last }
   wn:<id>:p:<pid> one profile's library, prefs, notes and cached metadata */
let NS = '', ACCT = null;
const LS = { acct: 'wn:acct', gdev: 'wn:device', legacy: 'watchnext', session: 'wn:session', unlocked: id => 'wn:unlocked:' + id,
  meta: () => `wn:${NS}:meta`, device: () => NS ? `wn:${NS}:device` : 'wn:device', prof: id => `wn:${NS}:p:${id}` };
const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const clone = o => JSON.parse(JSON.stringify(o));
const splitCfg = cfg => { const dev = {}, prof = {}; for (const k in cfg) (DEVICE_KEYS.includes(k) ? dev : prof)[k] = cfg[k]; return [dev, prof]; };
export const pinHash = p => { let h = 5381; for (const c of 'wn:' + p) h = ((h << 5) + h) ^ c.charCodeAt(0); return (h >>> 0).toString(36); };

export const PROFILES = { list: [], del: {}, last: null };
export const ACTIVE = { id: null };
export const getAccount = () => ACCT;
let DEVICE = { ...splitCfg(clone(DEF.cfg))[0] };
function loadDevice() {
  const base = splitCfg(clone(DEF.cfg))[0];
  DEVICE = { ...base, ...(NS ? read(LS.device()) || {} : {}) };
  DEVICE.gUser = ACCT ? { name: ACCT.name, email: ACCT.email, picture: ACCT.picture } : null; DEVICE.gSync = !!ACCT;
}
const writeDevice = () => { if (NS) write(LS.device(), DEVICE); };

export const blank = () => ({ cfg: { ...clone(DEF.cfg), ...DEVICE }, lib: {}, del: {}, meta: {}, sum: {} });
export let S = blank();

export const ITEMS = new Map();
export const GENRES = { movie: [], tv: [] };
export const GN = {};
export let PROVIDERS = null;

export function saveMeta(sync = true) { write(LS.meta(), { list: PROFILES.list, del: PROFILES.del, last: PROFILES.last }); if (sync && ACCT && typeof scheduleSync === 'function') scheduleSync(); }
export function loadProfileData(id) {
  const d = read(LS.prof(id)) || {};
  return { cfg: { ...splitCfg(clone(DEF.cfg))[1], ...(d.cfg || {}) }, lib: d.lib || {}, del: d.del || {}, meta: d.meta || {}, sum: d.sum || {} };
}
export const writeProfileData = (id, d) => write(LS.prof(id), { cfg: splitCfg(d.cfg || {})[1], lib: d.lib, del: d.del, meta: d.meta, sum: d.sum });
/** The active profile's data in the same shape loadProfileData returns. */
export const activeData = () => ({ cfg: splitCfg(S.cfg)[1], lib: S.lib, del: S.del, meta: S.meta, sum: S.sum });

export function save(sync = true) {
  DEVICE = { ...DEVICE, ...splitCfg(S.cfg)[0] }; writeDevice();
  if (ACTIVE.id && ACCT) writeProfileData(ACTIVE.id, S);
  if (sync && ACCT && typeof scheduleSync === 'function') scheduleSync();
}
export const deviceCfg = () => DEVICE;

/* ---------- theme ---------- */
export function applyTheme() {
  const rec = PROFILES.list.find(p => p.id === ACTIVE.id), c = rec?.color || DEF_COLOR, st = document.documentElement.style;
  if (!c) { ['--acr', '--ac', '--onac'].forEach(k => st.removeProperty(k)); return; }
  const [r, g, b] = c.split(',').map(Number); st.setProperty('--acr', c); st.setProperty('--ac', `rgb(${c})`);
  st.setProperty('--onac', (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#111' : '#fff');
}

/* ---------- profiles ---------- */
export function activate(id) {
  const rec = PROFILES.list.find(p => p.id === id); if (!rec) return false;
  const d = loadProfileData(id);
  S = { cfg: { ...clone(DEF.cfg), ...DEVICE, ...d.cfg, kids: !!rec.kids }, lib: d.lib, del: d.del, meta: d.meta, sum: d.sum };
  S.cfg.f = { ...DEF.cfg.f, ...(S.cfg.f || {}) };
  ACTIVE.id = id; PROFILES.last = id; saveMeta(false);
  try { sessionStorage.setItem(LS.session, id); } catch {}
  applyTheme(); return true;
}
export function leaveProfile() {
  if (ACTIVE.id && ACCT) save(false);
  S = blank(); ACTIVE.id = null;
  try { sessionStorage.removeItem(LS.session); } catch {}
  applyTheme();
}
export function createProfile({ name, emoji = '🎬', color = DEF_COLOR, kids = false, pin = '', bio = false }) {
  const rec = { id: newId(), name: (name || 'Me').trim().slice(0, 18), emoji, color, kids: !!kids, pin: pin ? pinHash(pin) : '', ...(bio ? { bio: true } : {}), ts: Date.now() };
  PROFILES.list.push(rec); writeProfileData(rec.id, { cfg: {}, lib: {}, del: {}, meta: {}, sum: {} }); saveMeta(); return rec;
}
export function updateProfile(id, patch) {
  const rec = PROFILES.list.find(p => p.id === id); if (!rec) return null;
  const { pin, ...rest } = patch; Object.assign(rec, rest); if (pin !== undefined) rec.pin = pin ? pinHash(pin) : '';
  rec.ts = Date.now(); if (id === ACTIVE.id) { S.cfg.kids = !!rec.kids; applyTheme(); } saveMeta(); return rec;
}
export function deleteProfile(id) {
  PROFILES.list = PROFILES.list.filter(p => p.id !== id); PROFILES.del[id] = Date.now();
  try { localStorage.removeItem(LS.prof(id)); } catch {}
  if (ACTIVE.id === id) { S = blank(); ACTIVE.id = null; try { sessionStorage.removeItem(LS.session); } catch {} applyTheme(); }
  saveMeta();
}
export const isUnlocked = id => { try { return sessionStorage.getItem(LS.unlocked(id)) === '1'; } catch { return false; } };
/** A profile asks to be unlocked when it has a PIN, or a fingerprint/face lock and this device has fingerprint/face set up. */
export const isLocked = p => !!p && !isUnlocked(p.id) && (!!p.pin || (!!p.bio && !!read(`wn:${NS}:bio`)?.cred));
export const unlock = id => { try { sessionStorage.setItem(LS.unlocked(id), '1'); } catch {} };

/** Move data saved before accounts existed into the first Google account that signs in on this browser. */
function claimLegacy() {
  if (read(LS.meta())) return;
  const old = read('wn:meta');
  if (old) {
    write(LS.meta(), old);
    for (const p of old.list || []) { try { const raw = localStorage.getItem('wn:p:' + p.id); if (raw != null) localStorage.setItem(LS.prof(p.id), raw); localStorage.removeItem('wn:p:' + p.id); } catch {} }
    try { localStorage.removeItem('wn:meta'); } catch {}
  }
  const gd = read(LS.gdev);
  if (gd && !read(LS.device())) { const { gClient, gUser, gSync, ...rest } = gd; if (Object.keys(rest).length) write(LS.device(), rest); }
}

function loadAccountProfiles() {
  PROFILES.list = []; PROFILES.del = {}; PROFILES.last = null;
  const meta = read(LS.meta());
  if (meta) { PROFILES.list = meta.list || []; PROFILES.del = meta.del || {}; PROFILES.last = meta.last || null; }
  const legacy = read(LS.legacy);
  if (legacy && !PROFILES.list.length) {
    const [dev, prof] = splitCfg({ ...clone(DEF.cfg), ...(legacy.cfg || {}) });
    DEVICE = { ...DEVICE, ...dev, gUser: DEVICE.gUser, gSync: DEVICE.gSync }; writeDevice();
    const rec = { id: newId(), name: 'Me', emoji: '🎬', color: DEF_COLOR, kids: false, pin: '', ts: Date.now() };
    PROFILES.list.push(rec); PROFILES.last = rec.id;
    writeProfileData(rec.id, { cfg: prof, lib: legacy.lib || {}, del: legacy.del || {}, meta: legacy.meta || {}, sum: legacy.sum || {} });
    try { localStorage.setItem('watchnext.bak', localStorage.getItem(LS.legacy)); localStorage.removeItem(LS.legacy); } catch {}
    saveMeta(false);
  }
}

/** Sign an account in on this browser and open its private space. Nothing from another account is loaded. */
export function setAccount(u) {
  if (ACTIVE.id && ACCT) save(false);
  const sub = String(u.sub || u.email || '');
  ACCT = { sub, email: u.email || '', name: u.name || '', picture: u.picture || '' };
  NS = sub.replace(/[^\w-]/g, ''); write(LS.acct, ACCT); rememberNS();
  try { sessionStorage.removeItem(LS.session); } catch {}
  claimLegacy(); loadDevice(); loadAccountProfiles(); writeDevice();
  S = blank(); ACTIVE.id = null; applyTheme();
}
/** Saved spaces on this browser left by an older login (the Google one used before email sign-in). Offered once, to the first email account only,
    so one person's data is never offered to another account on a shared device. */
export function oldSpaces() {
  const out = []; if (read('wn:oldoffer') || !NS) return out;
  const known = read('wn:known') || [];
  try { for (let i = 0; i < localStorage.length; i++) { const m = /^wn:([\w-]+):meta$/.exec(localStorage.key(i) || ''); if (!m || m[1] === NS || known.includes(m[1])) continue; const v = read(localStorage.key(i)); const n = (v?.list || []).length; if (n) out.push({ ns: m[1], profiles: n }); } } catch {}
  return out;
}
export const markOldOffered = () => write('wn:oldoffer', 1);
const rememberNS = () => { const k = read('wn:known') || []; if (NS && !k.includes(NS)) write('wn:known', [...k, NS]); };
/** Copy an older space on this browser into the account that is signed in now. Nothing is removed from the old one. */
export function adoptSpace(ns) {
  if (!NS || !ns || ns === NS) return false;
  try {
    const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(`wn:${ns}:`)) keys.push(k); }
    for (const k of keys) localStorage.setItem(`wn:${NS}:` + k.slice(`wn:${ns}:`.length), localStorage.getItem(k));
  } catch { return false; }
  loadDevice(); loadAccountProfiles(); writeDevice(); return true;
}
/** Sign out: forget the account on this browser. Its data stays in its own namespace and can't be reached without signing in again. */
export function clearAccount() {
  if (ACTIVE.id && ACCT) save(false);
  ACCT = null; NS = ''; try { localStorage.removeItem(LS.acct); sessionStorage.removeItem(LS.session); } catch {}
  PROFILES.list = []; PROFILES.del = {}; PROFILES.last = null; loadDevice();
  S = blank(); ACTIVE.id = null; applyTheme();
}

/** On page load: restore the signed-in account (if any) and its profiles, and auto-enter when there's an obvious choice. */
export function bootProfiles() {
  const a = read(LS.acct);
  if (a && a.sub) { ACCT = a; NS = String(a.sub).replace(/[^\w-]/g, ''); rememberNS(); claimLegacy(); }
  loadDevice(); S = blank();
  if (!ACCT) { applyTheme(); return; }
  loadAccountProfiles();
  let sess = null; try { sess = sessionStorage.getItem(LS.session); } catch {}
  const cand = PROFILES.list.find(p => p.id === sess) || (PROFILES.list.length === 1 ? PROFILES.list[0] : null);
  if (cand && !isLocked(cand)) activate(cand.id); else applyTheme();
}
