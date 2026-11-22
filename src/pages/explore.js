import { L, api, norm } from '../core/api.js';
import { ERAS, LANGS } from '../core/config.js';
import { isSafeFor } from '../core/safety.js';
import { prefLang, topGenres } from '../core/rec.js';
import { DEF, GENRES, S, save } from '../core/state.js';
import { $, $$, esc, key, rand } from '../core/utils.js';
import { RT } from '../router.js';
import { card, mountGrid } from '../ui/components.js';
import { openSettings } from '../ui/settings.js';

/* One page for everything you can browse: the lists, the filters and the release calendar. */
export const LISTS = [
  { id: 'td', label: 'Trending today', p: t => `/trending/${t}/day`, sort: 'popularity.desc' },
  { id: 'tw', label: 'This week', p: t => `/trending/${t}/week`, sort: 'popularity.desc' },
  { id: 'pop', label: 'Popular', p: t => `/${t}/popular`, sort: 'popularity.desc' },
  { id: 'top', label: 'Top rated', p: t => `/${t}/top_rated`, sort: 'vote_average.desc', votes: 300 },
  { id: 'gems', label: 'Hidden gems', gems: true },
  { id: 'now', label: t => (t === 'movie' ? 'In theatres' : 'On the air'), p: t => (t === 'movie' ? '/movie/now_playing' : '/tv/on_the_air'), sort: 'popularity.desc', recent: true },
  { id: 'soon', label: 'Coming soon', soon: true },
];
export const RAD = { win: 30, fit: false, sort: 'pop', lang: 'mine', genres: [] };
const unrel = () => !!S.cfg.showUnreleased;
export let sel = 'td', panel = false;

const iso = d => d.toISOString().slice(0, 10);
const fmtDay = s => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
export const SORTS = [['', 'List default'], ['popularity.desc', 'Most popular'], ['vote_average.desc', 'Highest rated'], ['vote_count.desc', 'Most voted'], ['date.desc', 'Newest first'], ['date.asc', 'Oldest first'], ['revenue.desc', 'Box office', 'movie']];
const filtered = f => !!(f.genres.length || f.lang || f.era || f.min || f.myOnly || f.mood || f.under || f.sort || f.yFrom || f.yTo || f.cert || f.pop);
const count = f => (f.genres.length ? 1 : 0) + (f.lang ? 1 : 0) + (f.era ? 1 : 0) + (f.min ? 1 : 0) + (f.myOnly ? 1 : 0) + (f.mood ? 1 : 0) + (f.under ? 1 : 0) + (f.sort ? 1 : 0) + (f.yFrom || f.yTo ? 1 : 0) + (f.cert ? 1 : 0) + (f.pop ? 1 : 0);

/* Quick pills. Genres are OR-ed, so picking Horror and Thriller shows either. */
const GPILLS = { movie: [['Action', 28], ['Adventure', 12], ['Animation', 16], ['Anime', 'anime'], ['Comedy', 35], ['Crime', 80], ['Documentary', 99], ['Drama', 18], ['Family', 10751], ['Fantasy', 14], ['History', 36], ['Horror', 27], ['Music', 10402], ['Mystery', 9648], ['Romance', 10749], ['Sci-Fi', 878], ['Thriller', 53], ['War', 10752], ['Western', 37]], tv: [['Action & Adventure', 10759], ['Animation', 16], ['Anime', 'anime'], ['Comedy', 35], ['Crime', 80], ['Documentary', 99], ['Drama', 18], ['Family', 10751], ['Kids', 10762], ['Mystery', 9648], ['Sci-Fi & Fantasy', 10765], ['War & Politics', 10768], ['Western', 37]] };
export const MOOD_PILLS = [
  ['mind', 'Mind-bending', { movie: '878|9648|53', tv: '10765|9648' }, 7],
  ['edge', 'Edge-of-your-seat', { movie: '53|28|27', tv: '10759|80|9648' }, 6.5],
  ['feel', 'Feel-good', { movie: '35|10749|10751', tv: '35|10751' }, 6.5],
  ['dark', 'Dark & gritty', { movie: '80|53|18|27', tv: '80|18|9648' }, 7],
  ['chill', 'Late-night chill', { movie: '18|10749|35|16', tv: '18|35|16' }, 7],
  ['laugh', 'Laugh out loud', { movie: '35', tv: '35' }, 6.8],
  ['cry', 'A good cry', { movie: '18|10749', tv: '18' }, 7.4],
  ['date', 'Date night', { movie: '10749|35', tv: '10749|35' }, 6.8],
  ['family', 'Family night', { movie: '10751|16|12', tv: '10751|16' }, 6.8],
  ['twist', 'Twisty mysteries', { movie: '9648|53|80', tv: '9648|80' }, 7],
  ['epic', 'Epic adventures', { movie: '12|14|878|28', tv: '10759|10765' }, 7],
  ['true', 'True stories', { movie: '36|99|18', tv: '99|18' }, 7.2],
  ['spooky', 'Spooky season', { movie: '27|9648', tv: '9648|10765' }, 6.2],
  ['action', 'Pure adrenaline', { movie: '28|12|53', tv: '10759' }, 6.5],
  ['wow', 'Visual spectacle', { movie: '878|14|12|16', tv: '10765|16' }, 7],
];

export const gemFetcher = t => L(`/discover/${t}`, { sort_by: 'vote_average.desc', 'vote_count.gte': 150, 'vote_count.lte': 3500, 'vote_average.gte': 7.1, with_genres: topGenres(t, 3).join('|'), with_original_language: prefLang() }, t);

const moodQ = (f, t) => { const m = MOOD_PILLS.find(x => x[0] === f.mood); return m ? { g: m[2][t], min: m[3] } : { g: '', min: '' }; };
function discoverParams(l, f, t) {
  const dk = t === 'movie' ? 'primary_release_date' : 'first_air_date', today = new Date();
  const p = { unreleased: unrel() || l.soon, sort_by: l.gems ? 'vote_average.desc' : l.sort || 'popularity.desc', with_genres: f.genres.length ? f.genres.join('|') : moodQ(f, t).g, with_original_language: f.lang, 'vote_average.gte': f.min || moodQ(f, t).min || (l.gems ? 7.1 : ''), 'vote_count.gte': l.gems ? 150 : l.votes || 20, watch_region: S.cfg.region };
  if (l.gems) p['vote_count.lte'] = 3500;
  if (f.under && t === 'movie') p['with_runtime.lte'] = 120;
  if (f.sort) { p.sort_by = f.sort.startsWith('date.') ? dk + f.sort.slice(4) : f.sort; if (/vote_average/.test(p.sort_by)) p['vote_count.gte'] = Math.max(+p['vote_count.gte'] || 0, 200); }
  if (f.cert && t === 'movie') { p.certification_country = 'US'; p['certification.lte'] = f.cert; }
  if (f.pop === 'well') p['vote_count.gte'] = t === 'movie' ? 5000 : 1500;
  if (f.pop === 'radar') { p['vote_count.gte'] = 100; p['vote_count.lte'] = 1500; }
  if (f.era) { const [a, b] = f.era.split('-'); p[dk + '.gte'] = a + '-01-01'; p[dk + '.lte'] = b + '-12-31'; }
  if (f.yFrom) p[dk + '.gte'] = f.yFrom + '-01-01';
  if (f.yTo) p[dk + '.lte'] = f.yTo + '-12-31';
  if (l.soon) { p[dk + '.gte'] = iso(new Date(Date.now() + 864e5)); p.sort_by = 'popularity.desc'; delete p['vote_count.gte']; }
  if (l.recent) { p[dk + '.gte'] = iso(new Date(today - 60 * 864e5)); p[dk + '.lte'] = iso(today); }
  if (f.myOnly && S.cfg.providers.length) { p.with_watch_providers = S.cfg.providers.join('|'); p.with_watch_monetization_types = 'flatrate'; }
  return p;
}

const fmtShort = s => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
/** Which original languages to show: the ones picked in Settings by default, everything, or one chosen here. */
const radarLangs = () => RAD.lang === 'mine' ? (S.cfg.langs || []) : RAD.lang ? [RAD.lang] : [];

async function calendar(el, tok, t) {
  const from = new Date(), to = new Date(Date.now() + RAD.win * 864e5), tops = topGenres(t, 3), dk = t === 'movie' ? 'primary_release_date' : 'first_air_date';
  const base = { [dk + '.gte']: iso(from), [dk + '.lte']: iso(to), sort_by: 'popularity.desc', 'vote_count.gte': 0, unreleased: true };
  if (RAD.genres.length) base.with_genres = RAD.genres.join('|');
  const langs = radarLangs(), pages = langs.length ? 3 : 5;
  el.innerHTML = '<p class="mut pad">Loading releases…</p>';
  try {
    // TMDB takes one language per request, so ask once per language and merge, most anticipated first
    const jobs = (langs.length ? langs : ['']).flatMap(l => Array.from({ length: pages }, (_, i) => api(`/discover/${t}`, { ...base, with_original_language: l, page: i + 1 }).catch(() => ({ results: [] }))));
    const got = await Promise.all(jobs);
    if (tok !== RT) return;
    const seen = new Set();
    let items = got.flatMap(r => r.results || []).map(x => ({ ...norm(x, t), date: x.release_date || x.first_air_date, hype: x.popularity || 0 }))
      .filter(it => { const k = key(it); if (seen.has(k) || !it.date || !it.poster || !isSafeFor(S.cfg.kids, it)) return false; seen.add(k); return true; });
    items = items.map(it => ({ ...it, fit: it.genres.some(g => tops.includes(g)) }));
    if (RAD.fit) items = items.filter(it => it.fit);
    if (S.cfg.hideSeen) items = items.filter(it => !['watched', 'hidden'].includes(S.lib[key(it)]?.status));
    if (!items.length) { el.innerHTML = `<div class="empty">Nothing announced for this window${langs.length ? ' in your languages' : ''}. Try a longer window or ${langs.length ? 'pick "Any language"' : 'clear a filter'}.</div>`; return; }
    const show = list => `<div class="grid">${list.map((it, i) => card({ ...it, year: fmtShort(it.date) }, i)).join('')}</div>`;
    if (RAD.sort === 'pop') {
      items.sort((a, b) => b.hype - a.hype);
      const top = items.slice(0, 12), rest = items.slice(12);
      el.innerHTML = `<h3 class="rh">Most anticipated</h3>${show(top)}${rest.length ? `<h3 class="rh">Also coming</h3>${show(rest)}` : ''}`;
      return;
    }
    const by = new Map(); for (const it of items) (by.get(it.date) || by.set(it.date, []).get(it.date)).push(it);
    el.innerHTML = [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([d, list]) => `<section class="day"><h3>${esc(fmtDay(d))}</h3><div class="grid">${list.sort((a, b) => b.hype - a.hype).map((it, i) => card(it, i)).join('')}</div></section>`).join('');
  } catch { el.innerHTML = '<div class="empty">Could not load releases. Check your TMDB key in settings.</div>'; }
}

export function pageExplore(m, tok, arg) {
  const t = S.cfg.type, f = S.cfg.f; if (f.sort === 'pop') f.sort = '';
  if (arg && LISTS.some(l => l.id === arg)) sel = arg;
  const cur = LISTS.find(l => l.id === sel) || LISTS[0], name = l => (typeof l.label === 'function' ? l.label(t) : l.label);
  const n = count(f);
  const opt = (v, cur2, id, label) => `<option value="${v}" ${String(cur2) === String(v) ? 'selected' : ''}>${label}</option>`;
  m.innerHTML = `<div class="page-title"><h1>Explore</h1></div>
  <div class="pillbar"><div class="pills" id="pills" role="toolbar" aria-label="Quick filters">
    ${LISTS.map(l => `<button class="chip ${l.id === cur.id ? 'on' : ''}" data-l="${l.id}">${esc(name(l))}</button>`).join('')}<i class="sep brk"></i>
    <button class="chip ${!f.mood && !f.under && f.min !== '8' ? 'on' : ''}" data-gall>All vibes</button>    ${MOOD_PILLS.map(([id, nm]) => `<button class="chip ${f.mood === id ? 'on' : ''}" data-m="${id}">${nm}</button>`).join('')}<i class="sep"></i>
    ${t === 'movie' ? `<button class="chip ${f.under ? 'on' : ''}" data-q="under">Under 2 hours</button>` : ''}<button class="chip ${f.min === '8' ? 'on' : ''}" data-q="r8">Rated 8+</button></div>
    <div class="fscrim" id="fScrim" ${panel ? '' : 'hidden'}></div><div class="fwrap"><button class="fbtn ${panel ? 'on' : ''}" id="fToggle" aria-expanded="${panel}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filters${n ? `<b>${n}</b>` : ''}</button>
  <div class="fpanel" id="fp" ${panel ? '' : 'hidden'}>
    <div class="fgrid">
      <label>Sort by<select id="fSort">${SORTS.filter(x => !x[2] || x[2] === t).map(([v, nm]) => opt(v, f.sort || '', 0, nm)).join('')}</select></label>
      <label>Language<select id="fLang">${LANGS.map(([c, nm]) => opt(c, f.lang, 0, nm)).join('')}</select></label>
      <label>Released from<input id="fYf" type="number" inputmode="numeric" min="1900" max="2100" placeholder="Any year" value="${esc(f.yFrom || '')}"></label>
      <label>Released to<input id="fYt" type="number" inputmode="numeric" min="1900" max="2100" placeholder="Any year" value="${esc(f.yTo || '')}"></label>
      ${t === 'movie' ? `<label>Age rating, up to<select id="fCert">${[['', 'Any'], ['G', 'G'], ['PG', 'PG'], ['PG-13', 'PG-13'], ['R', 'R']].map(([v, nm]) => opt(v, f.cert || '', 0, nm)).join('')}</select></label>` : ''}
      <label>How well known<select id="fPop">${[['', 'Any'], ['well', 'Well known'], ['radar', 'Under the radar']].map(([v, nm]) => opt(v, f.pop || '', 0, nm)).join('')}</select></label>
    </div>
    <div class="fx"><span class="lbl">Genres <em class="sub">(pick any; shows titles in at least one. Replaces the vibe above)</em></span><div class="chips wrap" id="xChips">${GPILLS[t].map(([nm, id]) => `<button class="chip ${id === 'anime' ? (f.lang === 'ja' && f.genres.includes(16) ? 'on' : '') : f.genres.includes(id) ? 'on' : ''}" data-g="${id}">${nm}</button>`).join('')}</div></div>
    <div class="frow">
      <label class="chk2"><input type="checkbox" id="fUn" ${unrel() ? 'checked' : ''}> Show unreleased</label>
      <label class="chk2"><input type="checkbox" id="fHide" ${S.cfg.hideSeen ? 'checked' : ''}> Hide seen</label>
      <label class="chk2"><input type="checkbox" id="fMy" ${f.myOnly ? 'checked' : ''}> My services only</label>
      <span class="grow"></span><button class="btn ghost" id="fRand">Surprise me</button><button class="btn ghost" id="fReset">Reset</button>
    </div></div></div></div>
  ${cur.gems ? '<p class="mut note">Highly rated films that fewer people have seen, leaning on your taste.</p>' : ''}
  <div id="g"></div>`;
  const body = $('#g', m);
  const mount = (start = 1) => {
    let fetcher;
    if (cur.soon) fetcher = L(`/discover/${t}`, discoverParams(cur, f, t), t);
    else if (cur.gems && !filtered(f) && !unrel()) fetcher = gemFetcher(t);
    else if (filtered(f) || cur.gems) fetcher = L(`/discover/${t}`, discoverParams(cur, f, t), t);
    else fetcher = L(cur.p(t), { region: S.cfg.region, unreleased: unrel() }, t);
    mountGrid(body, fetcher, { start });
  };
  const upd = (redraw) => { save(); redraw ? (panel = true, pageExplore(m, tok)) : mount(); };
  $$('[data-l]', m).forEach(b => b.onclick = () => { sel = b.dataset.l; pageExplore(m, tok); });
  const showP = v => { panel = v; $('#fp').hidden = !v; $('#fScrim').hidden = !v; $('#fToggle').classList.toggle('on', v); $('#fToggle').setAttribute('aria-expanded', v); };
  $('#fToggle').onclick = e => { e.stopPropagation(); showP(!panel); };
  $('#fScrim').onclick = () => showP(false);
  const out = e => { if (!$('#fp') || $('#fp').hidden || e.target.closest?.('.fwrap')) return; showP(false); };
  document.addEventListener('click', out, { once: false, capture: false });
  (pageExplore.off || (() => {}))(); pageExplore.off = () => document.removeEventListener('click', out);
  addEventListener('keydown', function esc2(e) { if (e.key === 'Escape' && $('#fp') && !$('#fp').hidden) showP(false); if (!$('#fp')) removeEventListener('keydown', esc2); });
  $$('[data-m]', m).forEach(b => b.onclick = () => { f.mood = f.mood === b.dataset.m ? '' : b.dataset.m; if (f.mood) { f.genres = []; if (f.lang === 'ja') f.lang = ''; } panel = false; save(); pageExplore(m, tok); });
  $$('[data-q]', m).forEach(b => b.onclick = () => { if (b.dataset.q === 'under') f.under = !f.under; else f.min = f.min === '8' ? '' : '8'; panel = false; save(); pageExplore(m, tok); });
  $('[data-gall]', m).onclick = () => { f.genres = []; f.mood = ''; if (f.lang === 'ja') f.lang = ''; panel = false; save(); pageExplore(m, tok); };
  $$('[data-g]', m).forEach(b => b.onclick = () => {
    if (b.dataset.g === 'anime') { const isOn = f.lang === 'ja' && f.genres.includes(16); f.genres = isOn ? f.genres.filter(x => x !== 16) : [...new Set([...f.genres, 16])]; f.lang = isOn ? '' : 'ja'; }
    else { const id = +b.dataset.g; f.genres = f.genres.includes(id) ? f.genres.filter(x => x !== id) : [...f.genres, id]; }
    if (f.genres.length) f.mood = '';
    panel = true; save(); pageExplore(m, tok);
  });
  const on = (id, fn) => { const e = $(id, m); if (e) e.onchange = fn; };
  on('#fLang', e => { f.lang = e.target.value; upd(true); });
  on('#fSort', e => { f.sort = e.target.value; upd(true); });
  on('#fCert', e => { f.cert = e.target.value; upd(true); });
  on('#fPop', e => { f.pop = e.target.value; upd(true); });
  const yr = v => { const n = Math.round(+v); return n >= 1900 && n <= 2100 ? String(n) : ''; };
  on('#fYf', e => { f.yFrom = yr(e.target.value); if (f.yFrom && f.yTo && f.yFrom > f.yTo) f.yTo = f.yFrom; upd(true); });
  on('#fYt', e => { f.yTo = yr(e.target.value); if (f.yFrom && f.yTo && f.yFrom > f.yTo) f.yFrom = f.yTo; upd(true); });
  on('#fUn', e => { S.cfg.showUnreleased = e.target.checked; upd(false); });
  on('#fHide', e => { S.cfg.hideSeen = e.target.checked; upd(true); });
  on('#fMy', e => { f.myOnly = e.target.checked; if (f.myOnly && !S.cfg.providers.length) openSettings(); upd(true); });
  $('#fRand').onclick = () => mount(1 + rand(12));
  $('#fReset').onclick = () => { S.cfg.f = Object.assign({}, DEF.cfg.f, { genres: [], mood: '', under: false, sort: '', yFrom: '', yTo: '', cert: '', pop: '' }); save(); pageExplore(m, tok); };
  mount();
}

/* Release radar: what is coming, the most anticipated first, with its own options. */
export function pageRadar(m, tok) {
  const t = S.cfg.type, names = (S.cfg.langs || []).map(c => (LANGS.find(l => l[0] === c) || [0, c])[1]).join(', ');
  const opt = (v, c, n) => `<option value="${v}" ${String(c) === String(v) ? 'selected' : ''}>${esc(n)}</option>`;
  const WINS = [[7, 'This week'], [30, 'This month'], [90, '3 months'], [180, '6 months']];
  m.innerHTML = `<div class="page-title"><h1>Release radar</h1><p class="mut">What is coming ${t === 'movie' ? 'to cinemas' : 'to TV'}, the most anticipated first. Titles that fit your taste are marked.</p></div>
  <div class="toolbar"><div class="chips" id="rWinC">${WINS.map(([v, n]) => `<button class="chip ${RAD.win === v ? 'on' : ''}" data-w="${v}">${n}</button>`).join('')}</div>
  <div class="rctl"><select id="rSort">${opt('pop', RAD.sort, 'Most anticipated')}${opt('date', RAD.sort, 'By release date')}</select>
  <select id="rLang">${opt('mine', RAD.lang, names ? 'My languages: ' + names : 'All languages')}${LANGS.map(([c, n]) => opt(c, RAD.lang, c ? n : 'Any language')).join('')}</select>
  <label class="chk2"><input type="checkbox" id="rFit" ${RAD.fit ? 'checked' : ''}> Only my taste</label></div></div>
  <div class="chips wrap rgen" id="gChips">${GENRES[t].map(g => `<button class="chip ${RAD.genres.includes(g.id) ? 'on' : ''}" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div>
  <div id="g"></div>`;
  const go = () => calendar($('#g', m), tok, t);
  $$('[data-w]', m).forEach(b => b.onclick = () => { RAD.win = +b.dataset.w; $$('[data-w]', m).forEach(x => x.classList.toggle('on', x === b)); go(); });
  $$('[data-g]', m).forEach(b => b.onclick = () => { const id = +b.dataset.g; RAD.genres = RAD.genres.includes(id) ? RAD.genres.filter(x => x !== id) : [...RAD.genres, id]; b.classList.toggle('on'); go(); });
  $('#rSort').onchange = e => { RAD.sort = e.target.value; go(); };
  $('#rLang').onchange = e => { RAD.lang = e.target.value; go(); };
  $('#rFit').onchange = e => { RAD.fit = e.target.checked; go(); };
  go();
}
