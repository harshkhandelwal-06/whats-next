// Movie night friends, by share code. No requests to accept.
// "Share my taste" saves a small copy of your watched and saved titles (with your ratings) under a random code in your account's database.
// A friend pastes the code into Movie night. Turn the code off and the copy is deleted, so it stops working.
import { getAccount, S, save } from './state.js';
import { hasServer, rest, rpc, signedIn, user } from './supa.js';

export const canShare = () => hasServer() && signedIn() && !!user();
const rand = n => { const a = new Uint8Array(n); (globalThis.crypto || window.crypto).getRandomValues(a); return Array.from(a, v => 'abcdefghijkmnpqrstuvwxyz23456789'[v % 32]).join(''); };

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
  if (!canShare()) throw new Error('Sign in first.');
  const id = rand(22);
  try { await rest('wn_shares', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { code: id, owner: user().id, data: snapshot(), updated_at: new Date().toISOString() } }); }
  catch (e) { throw new Error(/wn_shares|relation|42P01|PGRST205/.test(e.message + (e.code || '')) ? 'The database is not set up for sharing yet. Run supabase/setup.sql in your Supabase project.' : e.message); }
  S.cfg.myShare = { id, ts: Date.now() }; save(); return myCode();
}
export async function updateShare() {
  if (!S.cfg.myShare?.id || !canShare()) return;
  await rest(`wn_shares?code=eq.${encodeURIComponent(S.cfg.myShare.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { data: snapshot(), updated_at: new Date().toISOString() } });
  S.cfg.myShare = { ...S.cfg.myShare, ts: Date.now() }; save(false);
}
/** Turn the code off. The copy is deleted, so every friend's copy of the code stops working. */
export async function stopShare() {
  const id = S.cfg.myShare?.id; if (!id) return;
  await rest(`wn_shares?code=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  S.cfg.myShare = null; save();
}

/** Read a friend's shared taste. Throws a friendly error if the code is wrong or was turned off. */
export async function fetchFriend(id) {
  if (!canShare()) throw new Error('Sign in to use friend codes.');
  let d; try { d = await rpc('wn_get_share', { p_code: id }); } catch (e) { throw new Error(/Could not reach/.test(e.message) ? e.message : 'Could not load that code. ' + e.message); }
  if (!d) throw new Error('This code is not active. Ask your friend for a new one.');
  if (d?.kind !== 'wn-share') throw new Error('That is not a What\'s Next code.');
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
/** Keep your shared copy fresh a little after you change your library. */
export function schedulePublish() {
  clearTimeout(timer);
  if (!S.cfg.myShare?.id || !canShare()) return;
  timer = setTimeout(() => updateShare(false).catch(() => {}), 15000);
}
document.addEventListener('wn:lib', schedulePublish);
