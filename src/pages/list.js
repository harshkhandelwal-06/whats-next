import { RATES } from '../core/config.js';
import { GN, ITEMS, S, save } from '../core/state.js';
import { $, $$, esc, key } from '../core/utils.js';
import { IMG } from '../core/config.js';
import { enrichTrk, trkHtml } from '../features/tracker.js';
import { lists, listName, listOf } from '../core/library.js';
import { itemsOn, openListEditor, openListManager, openWatchlist } from '../features/lists.js';
import { route } from '../router.js';
import { card, roulette } from '../ui/components.js';
import { exportData } from '../ui/settings.js';

/* Library: your five lists in one place, with search, filters, sorting and a grid or list view. */
const TABS = [['watchlist', 'Watchlist'], ['watched', 'Watched'], ['hidden', 'Hidden']];
const RATE_F = [['all', 'Any rating'], ['10', 'Loved it'], ['8', 'Liked it'], ['5', 'Meh'], ['2', 'Disliked'], ['0', 'Not rated']];
const REWATCH = ['rewatch', 'Rewatch'];
let Q = '';

export function pageList(m, tok, which = 'watchlist') {
  if (which === 'watching') which = 'watchlist'; // old links; shows in progress now sit at the top of the Watchlist
  const c = S.cfg, typeF = c.listType || 'all', sort = c.listSort || 'recent', view = c.listView || 'grid', genreF = c.listGenre || 'all', rateF = c.listRate || 'all';
  const all = Object.values(S.lib);
  const inList = (e, k) => e.status === k || (k === 'rewatch' && e.status === 'watched') || (k === 'watchlist' && e.status === 'watching');
  const counts = Object.fromEntries([...TABS, REWATCH].map(([k]) => [k, all.filter(e => inList(e, k)).length]));
  const sel = 'all';
  const wlCount = id => all.filter(e => inList(e, 'watchlist') && (id === 'all' || listOf(e) === id)).length;
  const inTab = all.filter(e => inList(e, which) && (typeF === 'all' || e.type === typeF) && (which !== 'watchlist' || sel === 'all' || listOf(e) === sel));
  const genres = [...new Set(inTab.flatMap(e => e.genres || []))].filter(g => GN[g]).sort((a, b) => GN[a].localeCompare(GN[b]));
  const q = Q.trim().toLowerCase();
  let items = inTab.filter(e => (genreF === 'all' || (e.genres || []).includes(+genreF)) && (!q || e.title.toLowerCase().includes(q))
    && (!['watched', 'rewatch'].includes(which) || rateF === 'all' || (rateF === '0' ? !e.my : e.my === +rateF)));
  items.sort({ recent: (a, b) => b.ts - a.ts, title: (a, b) => a.title.localeCompare(b.title), mine: (a, b) => (b.my || 0) - (a.my || 0), year: (a, b) => (b.year || '').localeCompare(a.year || '') }[sort]);
  const prog = which === 'watchlist' ? items.filter(e => e.status === 'watching') : [];
  if (prog.length) items = items.filter(e => e.status !== 'watching');
  const its = items.map(e => { const it = { ...e, rating: e.vote, sub: e.status === 'watched' && e.my ? RATES.find(r => r[0] === e.my)?.[1] : '' }; ITEMS.set(key(it), it); return it; });
  const empty = inTab.length ? 'Nothing matches these filters.' : sel !== 'all' ? `${esc(listName(sel))} is empty. Tap the + on any poster and choose this list.` : `${which === 'rewatch' ? 'Nothing to rewatch yet. Mark movies as watched and they will show up here.' : 'Nothing here yet. Use the + or ✓ buttons on any poster, or try <a href="#/swipe">Swipe</a>.'}`;
  const row = x => { const k = key(x), g = (x.genres || []).slice(0, 3).map(i => GN[i]).filter(Boolean).join(', ');
    return `<div class="lrow" data-open="${k}"><img loading="lazy" src="${x.poster ? IMG + 'w92' + x.poster : ''}" alt=""><div class="lt"><b>${esc(x.title)}</b><span class="mut">${esc(x.year || '')}${x.type === 'tv' ? ' · TV' : ''}${g ? ' · ' + esc(g) : ''}${which === 'watchlist' && lists().length > 1 ? ' · ' + esc(listName(listOf(x))) : ''}</span></div>
      <div class="lr">${x.my ? `<span title="${RATES.find(r => r[0] === x.my)?.[2]}">${RATES.find(r => r[0] === x.my)?.[1]}</span>` : ''}
      <select class="mv" data-k="${k}" aria-label="Move to">${TABS.map(([s, n]) => `<option value="${s}" ${s === (x.status === 'watching' ? 'watchlist' : x.status) ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>`; };
  const strip = prog.length ? `<h3 class="inprog">In progress</h3><div class="trks" id="trk">${prog.map(trkHtml).join('')}</div>${its.length && which !== 'watchlist' ? '<h3 class="inprog">Saved for later</h3>' : ''}` : '';
  const body = strip + (!its.length ? (prog.length ? '' : `<div class="empty">${empty}</div>`)
    : view === 'list' ? `<div class="llist">${its.map(row).join('')}</div>` : `<div class="grid">${its.map((x, i) => card(x, i)).join('')}</div>`);
  const RW = which === 'rewatch';
  m.innerHTML = `<div class="page-title"><h1>${RW ? 'Rewatch' : 'Library'}</h1><p class="mut">${RW ? `${counts.rewatch} ${counts.rewatch === 1 ? 'title' : 'titles'} you have already watched.` : `${all.filter(e => TABS.some(([k]) => k === e.status)).length} titles saved${counts.watched ? `, ${counts.watched} watched` : ''}.`}</p></div>
    ${RW ? '' : `<div class="seg4" role="tablist">${TABS.map(([k, n]) => `<button class="${k === which ? 'on' : ''}" data-l="${k}" role="tab">${n}<b>${counts[k]}</b></button>`).join('')}</div>`}
    ${which === 'watchlist' ? `<div class="wlhead"><span class="mut">Your lists</span><span class="grow"></span><button class="btn ghost" id="wlManage">Edit lists</button></div><div class="wltiles">${lists().map(l => { const its2 = itemsOn(l.id), n = its2.length, mv = its2.filter(x => x.type === 'movie').length, tv = n - mv, ps = its2.filter(x => x.poster).slice(0, 3);
      return `<div class="wlbox" role="button" tabindex="0" data-wlbox="${l.id}" data-wlopen="${l.id}" aria-label="Open ${esc(l.name)}">${ps[0] ? `<span class="wlbg" style="background-image:url(${IMG}w185${ps[0].poster})"></span>` : ''}
        <span class="wlact">${l.id !== 'next' ? `<button class="wlb" data-wl-edit="${l.id}" title="Edit list" aria-label="Edit ${esc(l.name)}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>` : '<span></span>'}<button class="wlb" data-wl-rand="${l.id}" title="Pick a random title" aria-label="Random pick from ${esc(l.name)}" ${n ? '' : 'disabled'}>🎲</button></span>
        <span class="wlc">${ps.length ? [...ps].reverse().map((x, i) => `<img src="${IMG}w185${x.poster}" alt="" loading="lazy" style="--i:${ps.length - 1 - i};--n:${ps.length}">`).join('') : '<i class="wle">＋</i>'}</span>
        <span class="wln">${esc(l.name)}</span><span class="wlm">${n ? [mv ? `${mv} ${mv === 1 ? 'movie' : 'movies'}` : '', tv ? `${tv} ${tv === 1 ? 'show' : 'shows'}` : ''].filter(Boolean).join(' · ') : 'Empty'}</span></div>`; }).join('')}<button class="wlbox new" data-wl-new><span class="wlc"><i class="wle">＋</i></span><span class="wln">New list</span><span class="wlm">Movies and shows, together</span></button></div>` : ''}
    ${which === 'rewatch' ? `<div class="rw-intro"><p class="mut">Pick something you've already seen and loved. Choose a genre, or let us surprise you.</p><button id="rwRand" class="primary" ${its.length ? '' : 'disabled'}>🎲 Surprise me</button></div>
      <div class="wlists rwg"><button class="chip ${genreF === 'all' ? 'on' : ''}" data-rg="all">All genres <b>${inTab.length}</b></button>${genres.map(g => `<button class="chip ${String(g) === String(genreF) ? 'on' : ''}" data-rg="${g}">${esc(GN[g])} <b>${inTab.filter(e => (e.genres || []).includes(g)).length}</b></button>`).join('')}</div>` : ''}
    ${which === 'watchlist' ? '' : `<div class="ltools"><label class="lsearch"><input id="lq" type="search" placeholder="Search this list" value="${esc(Q)}"></label>
      <select id="lt"><option value="all">Movies and TV</option><option value="movie">Movies</option><option value="tv">TV shows</option></select>
      ${genres.length && which !== 'rewatch' ? `<select id="lg"><option value="all">All genres</option>${genres.map(g => `<option value="${g}" ${String(g) === String(genreF) ? 'selected' : ''}>${esc(GN[g])}</option>`).join('')}</select>` : ''}
      ${which === 'watched' || which === 'rewatch' ? `<select id="lr">${RATE_F.map(([v, n]) => `<option value="${v}" ${v === rateF ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}
      <select id="ls"><option value="recent">Recently added</option><option value="title">Title A to Z</option><option value="mine">My rating</option><option value="year">Newest release</option></select>
      <span class="grow"></span>
      ${`<div class="seg2"><button data-v="grid" class="${view === 'grid' ? 'on' : ''}">Grid</button><button data-v="list" class="${view === 'list' ? 'on' : ''}">List</button></div>`}
      ${which === 'watchlist' && its.length ? '<button id="pick" class="primary">Pick one for me</button>' : ''}<button id="expo" class="btn ghost">Export</button></div>`}
    <div id="lbody">${which === 'watchlist' ? strip : body}</div>`;
  if ($('#lt')) { $('#lt').value = typeF; $('#ls').value = sort; }
  const set = (k, v) => { c[k] = v; save(false); route(true); };
  $$('[data-l]', m).forEach(b => b.onclick = () => location.hash = '#/list/' + b.dataset.l);
  $$('[data-wlopen]', m).forEach(b => { b.onclick = e => { if (!e.target.closest('[data-wl-rand],[data-wl-edit]')) openWatchlist(b.dataset.wlopen); }; b.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === b) { e.preventDefault(); openWatchlist(b.dataset.wlopen); } }; });
  $$('[data-wl-rand]', m).forEach(b => b.onclick = e => { e.stopPropagation(); const its3 = itemsOn(b.dataset.wlRand); if (its3.length) roulette(its3); });
  $$('[data-wl-edit]', m).forEach(b => b.onclick = e => { e.stopPropagation(); openListEditor(b.dataset.wlEdit); });
  $('#wlManage', m)?.addEventListener('click', openListManager);
  $('[data-wl-new]', m)?.addEventListener('click', () => openListEditor(null));
  if ($('#lt')) $('#lt').onchange = e => set('listType', e.target.value);
  if ($('#ls')) $('#ls').onchange = e => set('listSort', e.target.value);
  $('#lg')?.addEventListener('change', e => set('listGenre', e.target.value));
  $('#lr')?.addEventListener('change', e => set('listRate', e.target.value));
  $$('.seg2 [data-v]', m).forEach(b => b.onclick = () => set('listView', b.dataset.v));
  if ($('#lq')) $('#lq').oninput = e => { Q = e.target.value; clearTimeout(pageList.t); pageList.t = setTimeout(() => { route(true); const i = $('#lq'); if (i) { i.focus(); i.setSelectionRange(Q.length, Q.length); } }, 250); };
  $$('.mv', m).forEach(s => { s.onclick = e => e.stopPropagation(); s.onchange = e => { const k = s.dataset.k; if (S.lib[k]) { S.lib[k].status = s.value; S.lib[k].ts = Date.now(); save(); route(true); } }; });
  $$('[data-rg]', m).forEach(b => b.onclick = () => set('listGenre', b.dataset.rg));
  $('#rwRand')?.addEventListener('click', () => roulette(its));
  $('#pick')?.addEventListener('click', () => roulette(its));
  if ($('#expo')) $('#expo').onclick = exportData;
  if (prog.length) enrichTrk(m);
}
