// Several watchlists: pick where a title goes, and create, rename or delete lists.
import { drop, listName, listOf, lists, newList, deleteList, put, refreshView, renameList, toast } from '../core/library.js';
import { ITEMS, S } from '../core/state.js';
import { $, esc } from '../core/utils.js';
import { burst } from '../ui/components.js';
import { route } from '../router.js';
import { closeRow, openPanel } from '../ui/rowsheet.js';
import { card, roulette } from '../ui/components.js';
import { key } from '../core/utils.js';

const wrap = () => $('#lpick');
export const closePicker = () => wrap()?.remove();
const sheet = html => {
  closePicker();
  const d = document.createElement('div'); d.id = 'lpick'; d.className = 'modal lpm';
  d.innerHTML = `<div class="sheet lps" role="dialog" aria-modal="true">${html}</div>`;
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-lclose]')) closePicker(); });
  document.body.appendChild(d); return d;
};
const keyEsc = e => { if (e.key === 'Escape' && wrap()) { e.stopPropagation(); closePicker(); } };
document.addEventListener('keydown', keyEsc, true);

/** "Save to…" for one title. */
export function openListPicker(k, anchor) {
  const it = ITEMS.get(k) || S.lib[k]; if (!it) return;
  const cur = S.lib[k], onList = cur && (cur.status === 'watchlist' || cur.status === 'watching'), now = onList ? listOf(cur) : null;
  const d = sheet(`<h2>Save to a watchlist</h2><p class="mut">${esc(it.title || '')}</p>
    <div class="lp-list">${lists().map(l => `<button class="lp-item ${l.id === now ? 'on' : ''}" data-l="${l.id}"><span>${esc(l.name)}</span><i>${l.id === now ? '✓' : ''}</i></button>`).join('')}</div>
    <div class="lp-new"><input id="lpName" maxlength="28" placeholder="New list, e.g. Weekend films" autocomplete="off"><button class="btn" id="lpAdd">Create and save</button></div>
    <div class="pk-foot">${onList ? '<button class="btn ghost" data-lrm>Remove from watchlist</button>' : ''}<button class="btn ghost" data-lclose>Cancel</button></div>`);
  const save = (id, rect) => {
    ITEMS.set(k, ITEMS.get(k) || it); put(k, 'watchlist', undefined, id); closePicker(); refreshView(k);
    burst({ getBoundingClientRect: () => rect }, ['✨', '＋', '📌'], 12);
    toast(`Saved to <b>${esc(listName(id))}</b>`, 1800);
  };
  const rect = anchor?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  d.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { if (b.dataset.l === now) return closePicker(); const r = b.getBoundingClientRect(); save(b.dataset.l, r); });
  const add = () => { const v = $('#lpName', d).value; const id = newList(v); if (!id) return; save(id, $('#lpAdd', d).getBoundingClientRect()); };
  $('#lpAdd', d).onclick = add; $('#lpName', d).addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  d.querySelector('[data-lrm]')?.addEventListener('click', () => { drop(k); closePicker(); refreshView(k); });
}

/** Name a new list, or rename / delete an existing one. */
export function openListEditor(id) {
  const cur = id ? lists().find(l => l.id === id) : null;
  const d = sheet(`<h2>${cur ? 'Edit list' : 'New watchlist'}</h2>
    <input id="leName" maxlength="28" placeholder="Name, e.g. Weekend films" value="${esc(cur?.name || '')}" autocomplete="off"><div class="err" id="leErr"></div>
    <div class="pk-foot"><button class="btn" id="leSave">${cur ? 'Save' : 'Create list'}</button>${cur ? '<button class="btn danger" id="leDel">Delete list</button>' : ''}<button class="btn ghost" data-lclose>Cancel</button></div>`);
  const inp = $('#leName', d); inp.focus(); inp.select();
  const go = () => {
    const v = inp.value.trim(); if (!v) return ($('#leErr', d).textContent = 'Give the list a name.');
    let nid = null; if (cur) renameList(cur.id, v); else nid = newList(v);
    closePicker(); closeRow(true); route(true);
    if (nid) setTimeout(() => openWatchlist(nid), 350);
  };
  $('#leSave', d).onclick = go; inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  $('#leDel', d)?.addEventListener('click', () => { if (!confirm(`Delete "${cur.name}"? Its titles move to Next to watch.`)) return; deleteList(cur.id); closePicker(); closeRow(true); route(true); });
}

/** The titles on one watchlist, as plain items. */
export const itemsOn = id => Object.values(S.lib)
  .filter(e => (e.status === 'watchlist' || e.status === 'watching') && listOf(e) === id)
  .sort((a, b) => b.ts - a.ts)
  .map(e => { const it = { ...e, rating: e.vote }; ITEMS.set(key(it), it); return it; });

/** Opens a watchlist full-page, growing out of its box on the Library page. Movies and shows share a list; a toggle picks which to show. */
let TSEL = 'all';
export function openWatchlist(id) {
  const l = lists().find(x => x.id === id); if (!l) return;
  const shown = () => itemsOn(id).filter(x => TSEL === 'all' || x.type === TSEL);
  const paint = () => {
    const all = itemsOn(id), its = shown(), g = $('#wlpg');
    if (!g) return;
    const mv = all.filter(x => x.type === 'movie').length, tv = all.length - mv;
    $('#wlseg').innerHTML = [['all', 'All', all.length], ['movie', 'Movies', mv], ['tv', 'TV shows', tv]].map(([v, n, c]) => `<button data-t="${v}" class="${TSEL === v ? 'on' : ''}">${n}<b>${c}</b></button>`).join('');
    g.innerHTML = its.length ? its.map((x, i) => card(x, i)).join('') : `<div class="empty">${all.length ? `No ${TSEL === 'tv' ? 'TV shows' : 'movies'} on this list yet.` : `${esc(l.name)} is empty. Tap the ＋ on any poster and choose this list.`}</div>`;
    $('.rs-t p').textContent = `${all.length} ${all.length === 1 ? 'title' : 'titles'}`;
    const p = $('#wlRand'); if (p) p.disabled = !its.length;
  };
  const el = openPanel({ title: l.name, sub: '', src: `[data-wlbox="${id}"]`,
    tools: `<button class="btn" id="wlRand">🎲 Pick one for me</button>${id !== 'next' ? '<button class="btn ghost" id="wlEdit">Edit list</button>' : ''}`,
    body: '<div class="seg4 wlseg" id="wlseg" role="tablist"></div><div class="grid" id="wlpg"></div>' });
  if (!el) return;
  TSEL = 'all'; paint();
  $('#wlseg', el).addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; TSEL = b.dataset.t; paint(); });
  $('#wlRand', el).onclick = () => roulette(shown());
  $('#wlEdit', el)?.addEventListener('click', () => openListEditor(id));
  const live = () => { if ($('#wlpg')) paint(); else document.removeEventListener('wn:lib', live); };
  document.addEventListener('wn:lib', live);
}

/** One place to rename, add and delete every list. */
export function openListManager() {
  const draw = () => lists().map(l => `<div class="lm-row" data-id="${l.id}"><input class="lm-in" value="${esc(l.name)}" maxlength="28" ${l.id === 'next' ? 'disabled' : ''} aria-label="List name"><span class="mut lm-n">${itemsOn(l.id).length}</span>${l.id === 'next' ? '<span class="lm-lock mut">Default</span>' : `<button class="btn ghost lm-del" data-del="${l.id}">Delete</button>`}</div>`).join('');
  const d = sheet(`<h2>Edit lists</h2><p class="mut">Rename or delete your watchlists. Deleting one moves its titles to Next to watch.</p><div class="lm" id="lmList">${draw()}</div>
    <div class="lp-new"><input id="lmNew" maxlength="28" placeholder="New list name" autocomplete="off"><button class="btn" id="lmAdd">Add</button></div>
    <div class="pk-foot"><button class="btn" id="lmDone">Done</button></div>`);
  const refresh = () => { $('#lmList', d).innerHTML = draw(); };
  d.addEventListener('change', e => { const r = e.target.closest('.lm-row'); if (r && e.target.classList.contains('lm-in')) { renameList(r.dataset.id, e.target.value); refresh(); } });
  d.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; const l = lists().find(x => x.id === b.dataset.del); if (l && confirm(`Delete "${l.name}"? Its titles move to Next to watch.`)) { deleteList(l.id); refresh(); } });
  const add = () => { const i = $('#lmNew', d); if (newList(i.value)) { i.value = ''; refresh(); } };
  $('#lmAdd', d).onclick = add; $('#lmNew', d).addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  $('#lmDone', d).onclick = () => { closePicker(); route(true); };
}
