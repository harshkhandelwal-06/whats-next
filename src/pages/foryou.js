import { api, norm, isSeen } from '../core/api.js';
import { likedOf, prefLang, recent, recommend, remember, topGenres } from '../core/rec.js';
import { ACTIVE, GN, S, save } from '../core/state.js';
import { $, esc, key, rand, shuffle } from '../core/utils.js';
import { MOODS } from '../features/mood.js';
import { enrichTrk, trkHtml } from '../features/tracker.js';
import { RT, route } from '../router.js';
import { blocked, note, setNote, summary } from '../core/taste.js';
import { toast } from '../core/library.js';
import { makeFeed } from '../core/feed.js';
import { L } from '../core/api.js';
import { gemFetcher } from './explore.js';
import { registerRows } from '../ui/rowsheet.js';
import { bento, card, errHtml, fillLane, laneShell, mountGrid, skel, spotlight } from '../ui/components.js';

export const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Late-night picks' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Tonight'; };

const ids = { movie: [[27, 'Horror and midnight chills'], [878, 'Sci-fi and cyberpunk'], [35, 'Sharp comedies'], [80, 'Crime and mystery'], [16, 'Animation'], [18, 'Acclaimed drama']], tv: [[10765, 'Sci-fi and fantasy'], [35, 'Comedies'], [80, 'Crime'], [9648, 'Mysteries'], [18, 'Drama'], [16, 'Animation']] };
const yearsAgo = n => new Date(Date.now() - n * 365 * 864e5).toISOString().slice(0, 10);

/** A different handful of moods each session, steady while you move around within it. */
function sessionMoods() {
  let ids = null; try { ids = JSON.parse(sessionStorage.getItem('wn:moodset') || 'null'); } catch {}
  let list = Array.isArray(ids) ? ids.map(id => MOODS.find(x => x.id === id)).filter(Boolean) : [];
  if (list.length < 10) { list = [...MOODS].sort(() => Math.random() - 0.5).slice(0, 10); try { sessionStorage.setItem('wn:moodset', JSON.stringify(list.map(x => x.id))); } catch {} }
  return list;
}

/** "Your mood, in your words": a note that lives with the profile and keeps shaping Home until it is changed or cleared. */
const sumHtml = t => { const s = summary(note(t)); return note(t) ? `<span class="ns-ok">Saved. It stays until you change or clear it.</span>${s.skip.length ? `<span class="ns-chip no">Skipping ${s.skip.map(esc).join(', ')}</span>` : ''}${s.lean.length ? `<span class="ns-chip yes">Leaning towards ${s.lean.map(esc).join(', ')}</span>` : ''}` : '<span class="mut">Say what you are, or are not, in the mood for. It sticks around, and it shapes your Home picks.</span>'; };
const noteBox = t =>  `<form class="notebox${note(t) ? ' has' : ''}" id="noteForm" autocomplete="off"><label for="noteTxt">Your ${t === 'tv' ? 'TV' : 'movie'} mood, in your words</label>
  <div class="noterow"><input id="noteTxt" maxlength="400" value="${esc(note(t))}" placeholder="${t === 'tv' ? 'No reality shows. Something I can binge.' : 'Not in the mood for superheroes. More slow, cosy stories.'}"><button class="primary" id="noteSave" type="submit">Save</button><button type="button" id="noteClear" ${note(t) ? '' : 'hidden'}>Clear</button></div><div class="nsum" id="nSum">${sumHtml(t)}</div></form>`;
function wireNote(m, NK, t) {
  const f = $('#noteForm', m); if (!f) return;
  const apply = v => { setNote(v, t); save(); try { const k = NK(); if (k) localStorage.removeItem(k); } catch {} toast(v ? 'Mood saved. Refreshing your picks…' : 'Mood cleared. Back to normal picks.', 2200); route(); };
  f.onsubmit = e => { e.preventDefault(); const v = $('#noteTxt', m).value.trim(); if (v !== note(t)) apply(v); else toast('Already saved.', 1400); };
  $('#noteClear', m).onclick = () => apply('');
  $('#noteTxt', m).oninput = e => { $('#noteSave', m).classList.toggle('dirty', e.target.value.trim() !== note(t)); };
}

export async function pageForYou(m, tok) {
  const t = S.cfg.type, liked = likedOf(t), names = topGenres(t, 3).map(id => GN[id]).filter(Boolean);
  const watching = Object.values(S.lib).filter(e => e.status === 'watching').sort((a, b) => b.ts - a.ts);
  const NK = () => !ACTIVE.id ? null : `wn:next:${ACTIVE.id}:${t}`;
  const takeBank = () => { const k = NK(); if (!k) return null; try { const b = JSON.parse(localStorage.getItem(k) || 'null'); localStorage.removeItem(k); if (b?.items?.length && Date.now() - b.t < 36 * 36e5) return b.items.filter(x => !blocked(x)); } catch {} return null; };
  const fillBank = () => { const k = NK(); if (!k) return; setTimeout(() => { if (tok !== RT) return; makeFeed(t, { mark: false })(1).then(r => { if (r.results.length) try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), items: r.results.slice(0, 24).map(({ sc, ...x }) => x) })); } catch {} }).catch(() => {}); }, 2500); };
  let feed = makeFeed(t, { bank: takeBank() });
  const genreLanes = (names.length ? topGenres(t, 3).map(id => [id, GN[id]]) : []).concat(ids[t]).filter((g, i, a) => g[1] && a.findIndex(x => x[0] === g[0]) === i).slice(0, 4);
  const got = {};
  const lane = (id, title, f0, extra = {}) => { const fetch = async page => { const r = await f0(page); return { ...r, results: (r.results || []).filter(x => !isSeen(x) && !blocked(x)) }; }; return ({ id, title, fetch, load: () => fetch(1), first: () => got[id], ...extra }); };
  const lanes = [
    lane('top', t === 'movie' ? 'Top 10 movies this week' : 'Top 10 shows this week', L(`/trending/${t}/week`, {}, t), { rank: true, sub: 'Trending this week.' }),
    lane('pick', 'Picked for you', async page => { const r = await feed(page); if (page === 1 && tok === RT && r.results.length) { spotlight($('#spot'), r.results.slice(0, 8)); fillBank(); } return r; }, { sub: liked.length ? 'Based on your watch history.' : 'Popular right now. Rate a few titles and this row starts to fit you.' }),
    lane('now', t === 'movie' ? 'In cinemas now' : 'On the air', L(t === 'movie' ? '/movie/now_playing' : '/tv/on_the_air', { region: S.cfg.region }, t)),
    ...genreLanes.map(([g, n]) => lane('g' + g, n, L(`/discover/${t}`, { with_genres: g, sort_by: 'popularity.desc', 'vote_count.gte': 300, 'vote_average.gte': 6.2 }, t))),
    lane('gems', 'Hidden gems', gemFetcher(t), { sub: 'Highly rated, lightly watched.' }),
    lane('short', t === 'movie' ? 'Under 100 minutes' : 'Short bingeable series', L(`/discover/${t}`, t === 'movie' ? { 'with_runtime.lte': 100, 'with_runtime.gte': 60, sort_by: 'vote_average.desc', 'vote_count.gte': 800 } : { sort_by: 'vote_average.desc', 'vote_count.gte': 500, with_genres: '35|16' }, t)),
  ];
  registerRows(lanes);
  m.innerHTML = `<div id="spot"></div><div class="home">
    ${watching.length ? `<section class="shelf"><div class="shead"><h2>Continue watching</h2><a href="#/list/watchlist">See all</a></div><div class="trks" id="trk">${watching.slice(0, 4).map(trkHtml).join('')}</div></section>` : ''}
    <div class="moodrow"><span class="mut">In the mood for</span><div class="chips">${sessionMoods().map(x => `<a class="chip" href="#/mood/${x.id}">${x.n}</a>`).join('')}<a class="chip more" href="#/mood">All moods</a></div></div>
    ${noteBox(t)}
    ${lanes.map(l => laneShell(l.id, l.title)).join('')}
    <div id="bentoSlot"></div>
</div>`;
    enrichTrk(m); wireNote(m, NK, t);
  $('#lane-top .refresh')?.remove();
  // Refresh: swap a row for different picks (a brand-new personalised feed for "Picked for you", another page for the rest).
  $('.home', m)?.addEventListener('click', e => {
    const b = e.target.closest?.('[data-refresh]'); if (!b) return;
    const l = lanes.find(x => x.id === b.dataset.refresh); if (!l || b.classList.contains('busy')) return;
    b.classList.add('busy'); const tr = $(`#lane-${l.id} .track`); if (tr) tr.style.opacity = .35;
    if (l.id === 'pick') feed = makeFeed(t);
    const page = l.id === 'pick' ? 1 : 2 + rand(4);
    l.fetch(page).then(r => (r.results || []).length ? r : l.fetch(1)).then(r => { if (tok !== RT) return; const list = shuffle((r.results || []).filter(x => x.poster)); got[l.id] = list; fillLane(l.id, list, { more: l.fetch });
      if (l.id === 'pick' && list.length) spotlight($('#spot'), list.slice(0, 8)); if (tr) { tr.scrollLeft = 0; } }).catch(() => {})
      .finally(() => { b.classList.remove('busy'); if (tr) tr.style.opacity = ''; });
  });
  lanes.forEach(l => l.load().then(r => { if (tok !== RT) return; got[l.id] = r.results; fillLane(l.id, r.results, { rank: l.rank, more: l.fetch }); }).catch(() => { if (tok === RT) document.querySelector(`#lane-${l.id}`)?.remove(); }));
  // Editorial grid: four different angles on what to watch tonight.
  Promise.all([
    gemFetcher(t)(1 + 0).catch(() => ({ results: [] })),
    L(`/discover/${t}`, { sort_by: 'vote_average.desc', 'vote_count.gte': 2000, [t === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte']: '2004-12-31' }, t)(1).catch(() => ({ results: [] })),
    L(`/trending/${t}/day`, {}, t)(1).catch(() => ({ results: [] })),
    L(`/${t}/top_rated`, {}, t)(2).catch(() => ({ results: [] })),
  ]).then(([g, c, tr, tp]) => {
    if (tok !== RT || !$('#bentoSlot')) return;
    const pick = (r, n = 0) => r.results.filter(x => x.backdrop && !blocked(x))[n];
    $('#bentoSlot').innerHTML = bento([{ it: pick(g), tag: 'Hidden gem of the week' }, { it: pick(c, rand(3)), tag: "Critics' cult classic" }, { it: pick(tr), tag: 'Trending today' }, { it: pick(tp, rand(5)), tag: 'All-time favourite' }]);
  });
}
