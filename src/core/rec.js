import { api, norm } from './api.js';
import { GN, ITEMS, S, save } from './state.js';
import { key, rand, shuffle } from './utils.js';
import { isSafeFor } from './safety.js';
import { blocked, lean } from './taste.js';

// Only titles you have actually watched and rated count strongly. Saving something is a weak hint, not a like.
export const Wt = e => e.status === 'watched' ? (e.my ? (e.my - 5) / 4 : 0) : e.status === 'watching' ? 0.25 : e.status === 'watchlist' ? 0.12 : e.status === 'hidden' ? -0.7 : 0;

export function taste(type, lib = S.lib) {
  const g = {};
  for (const e of Object.values(lib)) { if (type && e.type !== type) continue; const w = Wt(e); for (const id of e.genres || []) g[id] = (g[id] || 0) + w; }
  return g;
}

export function topGenres(type, n = 3) {
  return Object.entries(taste(type)).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => +id);
}

export const likedOf = (type, lib = S.lib) => Object.values(lib).filter(e => e.type === type && e.status === 'watched' && e.my >= 7);

export const dislikedOf = (type, lib = S.lib) => Object.values(lib).filter(e => e.type === type && ((e.status === 'watched' && e.my && e.my <= 4) || e.status === 'hidden'));

export function prefLang() { return S.cfg.langs.length ? S.cfg.langs[rand(S.cfg.langs.length)] : ''; }

export const joinNames = a => a.length <= 1 ? a[0] || '' : a.length === 2 ? a.join(' and ') : a.slice(0, 2).join(', ') + ' and more';

export const recent = () => new Set(S.cfg.shown || []);

export function remember(list) { S.cfg.shown = [...new Set([...list.map(key), ...(S.cfg.shown || [])])].slice(0, 400); save(false); }


export async function recommend(type, exclude = ['watched', 'hidden']) {
  const aff = taste(type), seeds = shuffle(likedOf(type)).slice(0, 7), neg = shuffle(dislikedOf(type)).slice(0, 3), tops = topGenres(type, 3), shown = recent();
  const pj = seeds.map(s => api(`/${type}/${s.id}/recommendations`).then(r => r.results.map(x => ({ x, why: s.title }))).catch(() => []));
  const nj = neg.map(s => api(`/${type}/${s.id}/recommendations`).then(r => r.results).catch(() => []));
  const gj = tops.length ? [api(`/discover/${type}`, { with_genres: shuffle(tops).slice(0, 2).join(','), sort_by: 'popularity.desc', 'vote_count.gte': 200, 'vote_average.gte': 6.3, page: 1 + rand(4), with_original_language: prefLang() })
    .then(r => r.results.map(x => ({ x }))).catch(() => [])] : [];
  const [pos, ng, gen] = await Promise.all([Promise.all(pj), Promise.all(nj), Promise.all(gj)]);
  const bad = new Set(ng.flat().map(x => x.id)), m = new Map();
  for (const o of [...pos.flat(), ...gen.flat()]) {
    const it = norm(o.x, type), k = key(it);
    if (!isSafeFor(S.cfg.kids, it) || blocked(it)) continue;
    if (exclude.includes(S.lib[k]?.status)) continue;
    let e = m.get(k);
    if (!e) {
      e = { it, sc: Math.random() * 0.6 + it.rating / 10 + lean(it), why: [] };
      for (const gid of it.genres) e.sc += (aff[gid] || 0) * 0.15;
      if (S.cfg.langs.includes(it.lang)) e.sc += 0.3;
      if (bad.has(it.id)) e.sc -= 1.2;
      if (shown.has(k)) e.sc -= 1.5;
      m.set(k, e);
    }
    if (o.why) { e.why.push(o.why); e.sc += 1; } else e.sc += 0.3;
  }
  return [...m.values()].sort((a, b) => b.sc - a.sc).map(e => {
    const gn = e.it.genres.filter(g => tops.includes(g)).map(g => GN[g]).filter(Boolean);
    const why = e.why.length || gn.length ? 'Based on your watch history' : '';
    const out = { ...e.it, why }; ITEMS.set(key(out), out); return out;
  });
}
