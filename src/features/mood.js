import { api, norm } from '../core/api.js';
import { toast } from '../core/library.js';
import { prefLang, recent, remember, taste } from '../core/rec.js';
import { S } from '../core/state.js';
import { $, $$, esc, key, rand, shuffle } from '../core/utils.js';
import { openAssistant } from './aibubble.js';
import { roulette } from '../ui/components.js';

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
];

export const MOOD = { sel: [], time: 'any', fresh: 'any', gem: false, kind: null };

export async function moodPool(type) {
  const defs = (MOOD.sel.length ? MOOD.sel : [MOODS[rand(MOODS.length)].id]).map(id => MOODS.find(x => x.id === id));
  const ids = [...new Set(defs.flatMap(d => d[type === 'movie' ? 'm' : 't']))], gem = MOOD.gem, yr = new Date().getFullYear();
  const base = { sort_by: gem ? 'vote_average.desc' : 'popularity.desc', 'vote_count.gte': gem ? 150 : 250, 'vote_count.lte': gem ? 3500 : '', 'vote_average.gte': gem ? 7.1 : 6.4, with_genres: ids.join('|') };
  const dk = type === 'movie' ? 'primary_release_date' : 'first_air_date', era = defs.find(d => d.before);
  if (MOOD.fresh === 'new') base[dk + '.gte'] = (yr - 3) + '-01-01'; if (MOOD.fresh === 'classic') base[dk + '.lte'] = '2000-12-31'; if (era) base[dk + '.lte'] = era.before + '-12-31';
  if (type === 'movie') { if (MOOD.time === 'short') base['with_runtime.lte'] = 95; if (MOOD.time === 'mid') { base['with_runtime.gte'] = 95; base['with_runtime.lte'] = 125; } if (MOOD.time === 'long') base['with_runtime.gte'] = 125; }
  const get = async lang => (await Promise.all(shuffle([1, 2, 3, 4, 5]).slice(0, 3).map(pg => api(`/discover/${type}`, { ...base, with_original_language: lang, page: pg }).catch(() => ({ results: [] }))))).flatMap(r => r.results);
  let raw = await get(prefLang()); if (raw.length < 8) raw = await get('');
  const aff = taste(type), shown = recent(), seen = new Set(), pool = [];
  for (const x of raw) {
    const it = norm(x, type), k = key(it); if (seen.has(k) || !it.poster || ['watched', 'hidden'].includes(S.lib[k]?.status)) continue; seen.add(k);
    let sc = Math.random() * 1.2 + it.rating / 5 + it.genres.filter(g => ids.includes(g)).length * .6; for (const g of it.genres) sc += (aff[g] || 0) * .12; if (shown.has(k)) sc -= 2;
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
    remember([win]); roulette(pool.slice(0, 14), { win, why: 'Picked for: ' + bits.join(' · '), again: moodSuggest });
  } catch (e) { toast(esc(e.message)); } finally { if (btn) btn.disabled = false; }
}

export function pageMood(m, tok, pre) {
  if (pre && MOODS.find(x => x.id === pre)) MOOD.sel = [pre];
  MOOD.kind = MOOD.kind || S.cfg.type; const kind = MOOD.kind, word = kind === 'tv' ? 'show' : kind === 'either' ? 'title' : 'movie';
  const seg = (grp, opts) => `<div class="seg2" role="group">${opts.map(([v, n]) => `<button class="${MOOD[grp] === v ? 'on' : ''}" data-g="${grp}" data-v="${v}">${n}</button>`).join('')}</div>`;
  const groups = ['Feel', 'Thrill', 'Think', 'Escape'];
  m.innerHTML = `<div class="page-title"><h1>What are you in the mood for?</h1><p class="mut">Pick up to two. You get one suggestion, not a list.</p></div>
    <div class="mood-wrap">${groups.map(g => `<section class="mgroup"><h3>${g}</h3><div class="moods">${MOODS.filter(x => x.g === g).map(x => `<button class="mood ${MOOD.sel.includes(x.id) ? 'on' : ''}" data-mood="${x.id}" style="--h:${x.h}"><b>${x.n}</b><span>${x.d}</span></button>`).join('')}</div></section>`).join('')}</div>
    <div class="mood-bar"><div class="mopts">
      <label>Looking for ${seg('kind', [['movie', 'Movie'], ['tv', 'Show'], ['either', 'Either']])}</label>
      <label>Time ${seg('time', [['any', 'Any'], ['short', 'Under 95 min'], ['mid', 'About 2 hours'], ['long', 'Long']])}</label>
      <label>Era ${seg('fresh', [['any', 'Any'], ['new', 'Recent'], ['classic', 'Classics']])}</label>
      <label class="chk2"><input type="checkbox" id="mGem" ${MOOD.gem ? 'checked' : ''}> Hidden gems only</label></div>
      <div class="mgo"><button class="primary big" id="suggest">Suggest a ${word}</button></div></div>
    <div class="askline"><input id="moodTxt" placeholder="Or describe it: a slow, beautiful film for a rainy night"><button id="moodAsk">Ask AI</button></div>`;
  $$('[data-mood]', m).forEach(b => b.onclick = () => { const id = b.dataset.mood; MOOD.sel = MOOD.sel.includes(id) ? MOOD.sel.filter(x => x !== id) : [...MOOD.sel, id].slice(-2); $$('[data-mood]', m).forEach(x => x.classList.toggle('on', MOOD.sel.includes(x.dataset.mood))); });
  $$('[data-g]', m).forEach(b => b.onclick = () => { MOOD[b.dataset.g] = b.dataset.v; pageMood(m, tok); });
  $('#mGem').onchange = e => MOOD.gem = e.target.checked;
  $('#suggest').onclick = moodSuggest;
  const ask = () => { const v = $('#moodTxt').value.trim(); if (!v) return; openAssistant(v); };
  $('#moodAsk').onclick = ask; $('#moodTxt').onkeydown = e => { if (e.key === 'Enter') ask(); };
}
