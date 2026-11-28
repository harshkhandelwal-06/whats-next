import { api, norm } from '../core/api.js';
import { toast } from '../core/library.js';
import { prefLang, recent, remember, taste } from '../core/rec.js';
import { S } from '../core/state.js';
import { blocked, lean } from '../core/taste.js';
import { isSafeFor } from '../core/safety.js';
import { save } from '../core/state.js';
import { $, $$, esc, key, rand, shuffle } from '../core/utils.js';
import { openAssistant } from './aibubble.js';
import { moodReveal } from '../ui/moodreveal.js';

/* g = group, d = one-line description, h = hue for the tile edge */
export const MOODS = [
  { id: 'cozy', g: 'Feel', n: 'Cozy', d: 'Warm, gentle, safe', h: 28, m: [35, 10749, 16, 10751], t: [35, 10751, 16] },
  { id: 'feelgood', g: 'Feel', n: 'Feel-good', d: 'Leave smiling', h: 48, m: [35, 10751, 10749, 10402], t: [35, 10751] },
  { id: 'laugh', g: 'Feel', n: 'Make me laugh', d: 'Proper comedy', h: 58, m: [35], t: [35] },
  { id: 'cry', g: 'Feel', n: 'A good cry', d: 'Big feelings', h: 215, m: [18, 10749], t: [18] },
  { id: 'romantic', g: 'Feel', n: 'Romantic', d: 'Falling for someone', h: 340, m: [10749], t: [18, 35] },
  { id: 'date', g: 'Feel', n: 'Date night', d: 'Easy to share', h: 330, m: [10749, 35, 18], t: [35, 18] },
  { id: 'coming', g: 'Feel', n: 'Coming of age', d: 'Growing up, badly', h: 160, m: [18, 35, 10749], t: [18, 35] },
  { id: 'inspired', g: 'Feel', n: 'Inspired', d: 'Real people, real grit', h: 80, m: [18, 36, 10402], t: [18, 99] },
  { id: 'underdog', g: 'Feel', n: 'Underdog story', d: 'Against the odds', h: 100, m: [18, 10751, 36, 35], t: [18] },
  { id: 'hyped', g: 'Thrill', n: 'Hyped', d: 'Action, no brakes', h: 12, m: [28, 12, 878], t: [10759, 10765] },
  { id: 'tense', g: 'Thrill', n: 'Edge of my seat', d: 'Can\'t look away', h: 5, m: [53, 80, 9648], t: [80, 9648] },
  { id: 'scared', g: 'Thrill', n: 'Scare me', d: 'Lights on, probably', h: 350, m: [27, 53], t: [9648, 80] },
  { id: 'heist', g: 'Thrill', n: 'Heists and capers', d: 'Clever crews', h: 40, m: [80, 28, 35], t: [80, 10759] },
  { id: 'gritty', g: 'Thrill', n: 'Dark and gritty', d: 'Crime and consequence', h: 0, m: [80, 18, 53], t: [80, 18] },
  { id: 'whodunit', g: 'Thrill', n: 'Whodunit', d: 'Solve it with them', h: 25, m: [9648, 80], t: [9648, 80] },
  { id: 'mind', g: 'Think', n: 'Mind-bending', d: 'Rewire your head', h: 270, m: [878, 9648, 53], t: [10765, 9648] },
  { id: 'slow', g: 'Think', n: 'Slow burn', d: 'Patient and rewarding', h: 200, m: [18, 9648], t: [18, 9648] },
  { id: 'real', g: 'Think', n: 'Something real', d: 'Documentaries', h: 150, m: [99, 36], t: [99, 10768] },
  { id: 'truecrime', g: 'Think', n: 'True crime', d: 'Fact, not fiction', h: 10, m: [99, 80], t: [99, 80] },
  { id: 'history', g: 'Think', n: 'History and war', d: 'Then, up close', h: 35, m: [36, 10752, 18], t: [10768, 18] },
  { id: 'weird', g: 'Think', n: 'Weird and wonderful', d: 'Nothing like it', h: 300, m: [14, 878, 35, 27], t: [10765, 35] },
  { id: 'epic', g: 'Escape', n: 'Epic escape', d: 'Whole other worlds', h: 250, m: [14, 12, 878, 10752], t: [10765, 10759] },
  { id: 'adventure', g: 'Escape', n: 'Adventure', d: 'Go somewhere', h: 120, m: [12, 28, 14], t: [10759] },
  { id: 'space', g: 'Escape', n: 'Space and sci-fi', d: 'Out there', h: 230, m: [878, 12], t: [10765] },
  { id: 'magic', g: 'Escape', n: 'Magic and myth', d: 'Spells and sagas', h: 285, m: [14, 12, 16], t: [10765] },
  { id: 'western', g: 'Escape', n: 'Westerns', d: 'Dust and duels', h: 30, m: [37, 28], t: [37, 10759] },
  { id: 'toon', g: 'Escape', n: 'Adult animation', d: 'Not just for kids', h: 175, m: [16, 18, 878], t: [16, 18] },
  { id: 'family', g: 'Escape', n: 'Family night', d: 'Everyone is in', h: 90, m: [10751, 16, 12], t: [10751, 16, 10762] },
  { id: 'music', g: 'Escape', n: 'Music and dance', d: 'Turn it up', h: 310, m: [10402, 18, 99], t: [99, 18] },
  { id: 'nostalgic', g: 'Escape', n: 'Nostalgic', d: 'Before 2005', h: 45, m: [], t: [], before: 2005 },
  { id: 'chill', g: 'Feel', n: 'Chill and easy', d: 'No stress at all', h: 190, m: [35, 10749, 10751], t: [35, 10751] },
  { id: 'quirky', g: 'Feel', n: 'Quirky and charming', d: 'Offbeat and warm', h: 65, m: [35, 18, 14], t: [35, 18] },
  { id: 'buddy', g: 'Feel', n: 'Buddy trips', d: 'Friends, fights, laughs', h: 20, m: [35, 12, 28], t: [35, 10759] },
  { id: 'spy', g: 'Thrill', n: 'Spies and secrets', d: 'Trust no one', h: 215, m: [28, 53, 12], t: [10759, 80, 10765] },
  { id: 'psych', g: 'Thrill', n: 'Psychological', d: 'Inside someone\'s head', h: 285, m: [53, 9648, 18], t: [9648, 18] },
  { id: 'revenge', g: 'Thrill', n: 'Revenge', d: 'Settle the score', h: 8, m: [28, 53, 80], t: [80, 10759] },
  { id: 'survival', g: 'Thrill', n: 'Survival', d: 'Against nature', h: 135, m: [12, 53, 28], t: [10759, 18] },
  { id: 'zombie', g: 'Thrill', n: 'Zombies and doom', d: 'The world ends badly', h: 100, m: [27, 878, 28], t: [10765, 18] },
  { id: 'noir', g: 'Think', n: 'Neo-noir', d: 'Rain, smoke, secrets', h: 240, m: [80, 9648, 53, 18], t: [80, 9648, 18] },
  { id: 'court', g: 'Think', n: 'Courtroom and power', d: 'Law and politics', h: 45, m: [18, 80, 36], t: [18, 10768] },
  { id: 'dystopia', g: 'Think', n: 'Dystopian futures', d: 'What could go wrong', h: 175, m: [878, 53], t: [10765] },
  { id: 'biopic', g: 'Think', n: 'True stories', d: 'Based on real lives', h: 70, m: [36, 18, 99], t: [18, 99] },
  { id: 'satire', g: 'Think', n: 'Dark comedy', d: 'Funny, but not nice', h: 330, m: [35, 80, 18], t: [35, 80, 18] },
  { id: 'hero', g: 'Escape', n: 'Superheroes', d: 'Capes and consequences', h: 355, m: [28, 878, 12, 14], t: [10759, 10765] },
  { id: 'anime', g: 'Escape', n: 'Anime', d: 'Straight from Japan', h: 320, m: [16, 14, 12, 878], t: [16, 10765, 10759], lang: 'ja' },
  { id: 'bolly', g: 'Escape', n: 'Bollywood', d: 'Song, drama, masala', h: 25, m: [18, 10749, 35, 28, 10402], t: [18, 35, 10749], lang: 'hi' },
  { id: 'kdrama', g: 'Escape', n: 'Korean picks', d: 'Seoul, with feeling', h: 205, m: [18, 53, 35, 10749], t: [18, 35, 9648], lang: 'ko' },
  { id: 'kids', g: 'Escape', n: 'Kids\' picks', d: 'Safe and silly', h: 110, m: [16, 10751, 12, 35], t: [10762, 16, 10751] },
  { id: 'road', g: 'Escape', n: 'Road trip', d: 'Windows down', h: 38, m: [12, 35, 18], t: [10759, 35, 18] },
];

/* Genres a person can pick to shape a mood. m / t = TMDB ids for movies / TV. */
export const GEN = [['Action', [28], [10759]], ['Adventure', [12], [10759]], ['Animation', [16], [16]], ['Comedy', [35], [35]], ['Crime', [80], [80]], ['Documentary', [99], [99]], ['Drama', [18], [18]], ['Family', [10751], [10751]], ['Fantasy', [14], [10765]], ['History', [36], [10768]], ['Horror', [27], [9648]], ['Music', [10402], [99]], ['Mystery', [9648], [9648]], ['Romance', [10749], [18, 35]], ['Sci-fi', [878], [10765]], ['Thriller', [53], [80, 9648]], ['War', [10752], [10768]], ['Western', [37], [37]]];
const gmap = (names, type) => [...new Set(names.flatMap(n => GEN.find(g => g[0] === n)?.[type === 'movie' ? 1 : 2] || []))];
export const allMoods = () => [...MOODS, ...(S.cfg.myMoods || [])];

export const MOOD = { sel: [], time: 'any', fresh: 'any', gem: false, kind: null, gx: {}, open: null };

export async function moodPool(type) {
  const all = allMoods(), defs = (MOOD.sel.length ? MOOD.sel : [MOODS[rand(MOODS.length)].id]).map(id => all.find(x => x.id === id)).filter(Boolean);
  const ids = [...new Set(defs.flatMap(d => MOOD.gx[d.id]?.length ? gmap(MOOD.gx[d.id], type) : d[type === 'movie' ? 'm' : 't']))], gem = MOOD.gem, yr = new Date().getFullYear();
  const base = { sort_by: gem ? 'vote_average.desc' : 'popularity.desc', 'vote_count.gte': gem ? 150 : 250, 'vote_count.lte': gem ? 3500 : '', 'vote_average.gte': gem ? 7.1 : 6.4, with_genres: ids.join('|') };
  const dk = type === 'movie' ? 'primary_release_date' : 'first_air_date', era = defs.find(d => d.before);
  if (MOOD.fresh === 'new') base[dk + '.gte'] = (yr - 3) + '-01-01'; if (MOOD.fresh === 'classic') base[dk + '.lte'] = '2000-12-31'; if (era) base[dk + '.lte'] = era.before + '-12-31';
  if (type === 'movie') { if (MOOD.time === 'short') base['with_runtime.lte'] = 95; if (MOOD.time === 'mid') { base['with_runtime.gte'] = 95; base['with_runtime.lte'] = 125; } if (MOOD.time === 'long') base['with_runtime.gte'] = 125; }
  const get = async lang => (await Promise.all(shuffle([1, 2, 3, 4, 5]).slice(0, 4).map(pg => api(`/discover/${type}`, { ...base, with_original_language: lang, page: pg }).catch(() => ({ results: [] }))))).flatMap(r => r.results);
  const own = defs.find(d => d.lang)?.lang; let raw = await get(own || prefLang()); if (raw.length < 8) raw = await get('');
  const aff = taste(type), shown = recent(), seen = new Set(), pool = [];
  for (const x of raw) {
    const it = norm(x, type), k = key(it); if (seen.has(k) || !it.poster || ['watched', 'hidden'].includes(S.lib[k]?.status) || blocked(it) || !isSafeFor(S.cfg.kids, it)) continue; seen.add(k);
    let sc = Math.random() * 1.2 + lean(it) + it.rating / 5 + it.genres.filter(g => ids.includes(g)).length * .6; for (const g of it.genres) sc += (aff[g] || 0) * .12; if (shown.has(k)) sc -= 2;
    pool.push({ it, sc });
  }
  return { pool: pool.sort((a, b) => b.sc - a.sc).map(p => p.it), defs };
}

export async function moodSuggest() {
  const btn = $('#suggest'); if (btn) btn.disabled = true;
  try {
    const kind = MOOD.kind || S.cfg.type, type = kind === 'either' ? (Math.random() < .5 ? 'movie' : 'tv') : kind;
    const { pool, defs } = await moodPool(type);
    if (!pool.length) return toast('Nothing matched. Loosen a filter and try again.', 2600);
    const win = pool[rand(Math.min(4, pool.length))];
    const bits = [defs.map(d => d.n).join(' + ')]; if (MOOD.time !== 'any' && type === 'movie') bits.push({ short: 'under 95 min', mid: 'about two hours', long: 'long and epic' }[MOOD.time]); if (MOOD.gem) bits.push('hidden gem');
    remember([win, ...pool.slice(0, 12)]); moodReveal(pool, { win, defs, why: 'Picked for: ' + bits.join(' · '), again: moodSuggest });
  } catch (e) { toast(esc(e.message)); } finally { if (btn) btn.disabled = false; }
}

const HUES = [12, 28, 48, 100, 160, 190, 215, 250, 285, 310, 340];
export function pageMood(m, tok, pre) {
  if (pre && allMoods().find(x => x.id === pre)) MOOD.sel = [pre];
  MOOD.kind = MOOD.kind || S.cfg.type; const kind = MOOD.kind, word = kind === 'tv' ? 'show' : kind === 'either' ? 'title' : 'movie';
  const seg = (grp, opts) => `<div class="seg2" role="group">${opts.map(([v, n]) => `<button class="${MOOD[grp] === v ? 'on' : ''}" data-g="${grp}" data-v="${v}">${n}</button>`).join('')}</div>`;
  const groups = ['Feel', 'Thrill', 'Think', 'Escape'];
  const chips = (picked, attr) => GEN.map(([n]) => `<button type="button" class="gchip ${picked.includes(n) ? 'on' : ''}" ${attr}="${esc(n)}">${esc(n)}</button>`).join('');
  const cell = x => { const g = MOOD.gx[x.id] || [], open = MOOD.open === x.id;
    return `<div class="mood-cell${open ? ' open' : ''}" style="--h:${x.h}"><button class="mood ${MOOD.sel.includes(x.id) ? 'on' : ''}" data-mood="${x.id}" style="--h:${x.h}"><b>${esc(x.n)}</b><span>${g.length ? esc(g.join(' + ')) : esc(x.d)}</span></button>
      <button class="mx" data-x="${x.id}" aria-expanded="${open}" aria-label="Choose genres for ${esc(x.n)}" title="Choose genres">${g.length ? g.length : '＋'}</button>${x.custom ? `<button class="mdel" data-del="${x.id}" aria-label="Delete ${esc(x.n)}" title="Delete this mood">✕</button>` : ''}</div>
      ${open ? `<div class="mgen"><p><b>${esc(x.n)}</b>: pick the kinds of ${kind === 'tv' ? 'shows' : 'films'} you want in this mood.</p><div class="gchips">${chips(g, 'data-gx')}</div>${g.length ? '<button type="button" class="linkb" data-gx-reset>Back to the default mix</button>' : ''}</div>` : ''}`; };
  const addCell = g => `<button class="mood add${MOOD.open === 'new:' + g ? ' on' : ''}" data-new="${g}" aria-expanded="${MOOD.open === 'new:' + g}"><b>＋ Your own</b><span>Make a ${g.toLowerCase()} mood</span></button>${MOOD.open === 'new:' + g ? `<div class="mgen"><p><b>New ${g.toLowerCase()} mood</b>: name it, then pick its genres.</p><div class="noterow"><input id="nmName" maxlength="28" placeholder="Name, e.g. Sunday slow"><button class="primary" id="nmSave" data-grp="${g}">Add mood</button></div><div class="gchips">${chips(MOOD.draft || [], 'data-nm')}</div></div>` : ''}`;
  const draw = () => { $('#moodWrap', m).innerHTML = groups.map(g => `<section class="mgroup"><h3>${g}</h3><div class="moods">${allMoods().filter(x => x.g === g).map(cell).join('')}${addCell(g)}</div></section>`).join(''); pick(); };
  const pick = () => { const b = $('#pickbar', m); if (!b) return; const names = MOOD.sel.map(id => allMoods().find(x => x.id === id)?.n).filter(Boolean); b.classList.toggle('on', names.length > 0); $('#pbTxt', m).textContent = names.join(' + '); };
  m.innerHTML = `<div class="page-title"><h1>What are you in the mood for?</h1><p class="mut">Pick up to two. You get a top pick, plus a whole hand of more. Tap the + on a mood to choose its genres.</p></div>
    <div class="mood-top"><div class="mopts">
      <label>Looking for ${seg('kind', [['movie', 'Movie'], ['tv', 'Show'], ['either', 'Either']])}</label>
      <label>Time ${seg('time', [['any', 'Any'], ['short', 'Under 95 min'], ['mid', 'About 2 hours'], ['long', 'Long']])}</label>
      <label>Era ${seg('fresh', [['any', 'Any'], ['new', 'Recent'], ['classic', 'Classics']])}</label>
      <label class="chk2"><input type="checkbox" id="mGem" ${MOOD.gem ? 'checked' : ''}> Hidden gems only</label></div>
      <div class="askline"><input id="moodTxt" placeholder="Or describe it: a slow, beautiful film for a rainy night"><button id="moodAsk">Ask AI</button></div></div>
    <div class="mood-wrap" id="moodWrap"></div>
    <div class="pickbar" id="pickbar"><span class="pb-l">Your mood</span><b id="pbTxt"></b><button class="primary big" id="suggest">Suggest a ${word}</button></div>`;
  draw();
  $('#moodWrap', m).addEventListener('click', e => {
    const t = e.target, q = sel => t.closest(sel);
    let b;
    if ((b = q('[data-mood]'))) { const id = b.dataset.mood; MOOD.sel = MOOD.sel.includes(id) ? MOOD.sel.filter(x => x !== id) : [...MOOD.sel, id].slice(-2); $$('[data-mood]', m).forEach(x => x.classList.toggle('on', MOOD.sel.includes(x.dataset.mood))); pick(); }
    else if ((b = q('[data-x]'))) { MOOD.open = MOOD.open === b.dataset.x ? null : b.dataset.x; draw(); }
    else if ((b = q('[data-new]'))) { const k = 'new:' + b.dataset.new; MOOD.open = MOOD.open === k ? null : k; MOOD.draft = []; draw(); $('#nmName', m)?.focus(); }
    else if ((b = q('[data-gx]'))) { const id = MOOD.open, n = b.dataset.gx, cur = MOOD.gx[id] || []; MOOD.gx[id] = cur.includes(n) ? cur.filter(x => x !== n) : [...cur, n]; if (!MOOD.gx[id].length) delete MOOD.gx[id]; draw(); }
    else if (q('[data-gx-reset]')) { delete MOOD.gx[MOOD.open]; draw(); }
    else if ((b = q('[data-nm]'))) { const n = b.dataset.nm; MOOD.draft = (MOOD.draft || []).includes(n) ? MOOD.draft.filter(x => x !== n) : [...(MOOD.draft || []), n]; const keep = $('#nmName', m)?.value; draw(); if ($('#nmName', m)) { $('#nmName', m).value = keep || ''; } }
    else if ((b = q('#nmSave'))) {
      const name = $('#nmName', m).value.trim(), gn = MOOD.draft || [];
      if (!name) return toast('Give your mood a name.', 1800); if (!gn.length) return toast('Pick at least one genre.', 1800);
      const id = 'u' + Date.now().toString(36); (S.cfg.myMoods = S.cfg.myMoods || []).push({ id, g: b.dataset.grp, n: name, d: gn.slice(0, 3).join(', '), h: HUES[rand(HUES.length)], m: gmap(gn, 'movie'), t: gmap(gn, 'tv'), custom: true });
      MOOD.gx[id] = gn; MOOD.open = null; MOOD.draft = []; save(); toast(`Added <b>${esc(name)}</b>`, 1800); draw();
    }
    else if ((b = q('[data-del]'))) { const id = b.dataset.del; S.cfg.myMoods = (S.cfg.myMoods || []).filter(x => x.id !== id); MOOD.sel = MOOD.sel.filter(x => x !== id); delete MOOD.gx[id]; save(); draw(); }
  });
  $$('[data-g]', m).forEach(b => b.onclick = () => { MOOD[b.dataset.g] = b.dataset.v; $$(`[data-g="${b.dataset.g}"]`, m).forEach(x => x.classList.toggle('on', x === b)); if (b.dataset.g === 'kind') $('#suggest', m).textContent = 'Suggest a ' + (MOOD.kind === 'tv' ? 'show' : MOOD.kind === 'either' ? 'title' : 'movie'); });
  $('#mGem').onchange = e => MOOD.gem = e.target.checked;
  $('#suggest').onclick = moodSuggest;
  const ask = () => { const v = $('#moodTxt').value.trim(); if (!v) return; openAssistant(v); };
  $('#moodAsk').onclick = ask; $('#moodTxt').onkeydown = e => { if (e.key === 'Enter') ask(); };
}
