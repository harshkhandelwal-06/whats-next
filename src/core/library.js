import { RATES } from './config.js';
import { ITEMS, S, save } from './state.js';
import { $, $$, esc } from './utils.js';
import { paintActions } from '../pages/title.js';
import { route } from '../router.js';
import { card } from '../ui/components.js';
import { vanish } from '../ui/motion.js';

/** Your watchlists. The first is always "Next to watch". */
export const lists = () => { const l = S.cfg.lists; if (!Array.isArray(l) || !l.length || l[0].id !== 'next') S.cfg.lists = [{ id: 'next', name: 'Next to watch' }, ...(Array.isArray(l) ? l.filter(x => x.id !== 'next') : [])]; return S.cfg.lists; };
export const listOf = e => (lists().some(l => l.id === (e?.wl || 'next')) ? (e?.wl || 'next') : 'next');
export const listName = id => lists().find(l => l.id === id)?.name || 'Next to watch';
export function newList(name) { const n = String(name || '').trim().slice(0, 28); if (!n) return null; const ex = lists().find(l => l.name.toLowerCase() === n.toLowerCase()); if (ex) return ex.id; const id = 'l' + Date.now().toString(36); S.cfg.lists = [...lists(), { id, name: n }]; save(); return id; }
export function renameList(id, name) { const n = String(name || '').trim().slice(0, 28); if (!n || id === 'next') return; S.cfg.lists = lists().map(l => (l.id === id ? { ...l, name: n } : l)); save(); }
export function deleteList(id) { if (id === 'next') return; S.cfg.lists = lists().filter(l => l.id !== id); for (const e of Object.values(S.lib)) if (e.wl === id) { delete e.wl; e.ts = Date.now(); } save(); }

export function put(k, status, my, wl) {
  const it = ITEMS.get(k); if (!it) return;
  const old = S.lib[k];
  S.lib[k] = { id: it.id, type: it.type, title: it.title, year: it.year, poster: it.poster, genres: it.genres, lang: it.lang,
    vote: it.rating, status, my: my ?? (old && old.status === status ? old.my : undefined),
    wl: status === 'watchlist' || status === 'watching' ? (wl || old?.wl) : undefined,
    prog: status === 'watching' ? (old?.prog || (it.type === 'tv' ? { s: 1, e: 0 } : { pct: 0 })) : undefined, ts: Date.now() };
  delete S.del[k]; save();
}

export function drop(k) { delete S.lib[k]; S.del[k] = Date.now(); save(); }

export function toggle(k, status) {
  const cur = S.lib[k];
  if (cur && cur.status === status) drop(k); else put(k, status);
  refreshView(k);
}

export function refreshView(k) {
  setTimeout(() => document.dispatchEvent(new Event('wn:lib')), 0);
  const it = ITEMS.get(k);
  const gone = ['watched', 'hidden'].includes(S.lib[k]?.status) && (location.hash.replace(/^#\/?/, '') === '' || location.hash.startsWith('#/foryou') || S.cfg.hideSeen);
  if (it) $$(`.card[data-open="${k}"]`).forEach(c => {
    if (c.closest('.list-page') || c.closest('#wlpg')) return;
    // Seen titles slide out of rows and grids; the rest of the list closes the gap. (Not on a title's own page.)
    if (gone && !location.hash.startsWith('#/t/') && !location.hash.startsWith('#/p/') && !location.hash.startsWith('#/search') && !location.hash.startsWith('#/list')) vanish(c.parentElement?.classList.contains('rk') ? c.parentElement : c); else c.outerHTML = card(it);
  });
  $$(`.slide .acts [data-k="${k}"]`).forEach(b => { const on = S.lib[k]?.status === b.dataset.act; b.classList.toggle('on', on); b.textContent = { watchlist: on ? 'On watchlist' : 'Add to watchlist', watched: on ? 'Watched' : 'Mark as watched' }[b.dataset.act] || b.textContent; });
  if (location.hash.startsWith('#/list/')) route(true);
  if (location.hash.startsWith('#/t/')) paintActions();
}

export function toast(html, ms = 5000) {
  $('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; document.body.appendChild(t);
  clearTimeout(toast.t); toast.t = setTimeout(() => t.remove(), ms);
}

export function rateToast(k) {
  const it = ITEMS.get(k);
  toast(`<span>How was <b>${esc(it?.title)}</b>?</span>` + RATES.map(([v, e, n]) => `<button data-rate="${v}" data-k="${k}" title="${n}">${e}</button>`).join(''), 6000);
}
