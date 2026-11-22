import { api, norm } from './api.js';
import { aiTaste } from './ai.js';
import { GN, ITEMS, S } from './state.js';
import { dislikedOf, likedOf, prefLang, recent, remember, taste, topGenres } from './rec.js';
import { isSafeFor } from './safety.js';
import { key, rand, shuffle } from './utils.js';

/**
 * An endless, personalised feed. Each call returns the next ~20 titles, drawing from several sources in rotation
 * so it never runs dry and never repeats: recommendations from titles you liked, discovery by your favourite genres,
 * trending, and finally broad top-rated pages. Page n+1 is always different from pages 1..n.
 */
export function makeFeed(type, { bank = null, mark = true } = {}) {
  const aff = taste(type), seeds = shuffle(likedOf(type)), neg = new Set(), seen = new Set(), shown = recent();
  const tops = topGenres(type, 4), lang = prefLang();
  let seedAt = 0, seedPage = 1, dPage = 0, tPage = 0, rPage = 0, calls = 0, dry = 0;
  const negJobs = Promise.all(shuffle(dislikedOf(type)).slice(0, 3).map(s => api(`/${type}/${s.id}/recommendations`).then(r => r.results.forEach(x => neg.add(x.id))).catch(() => {})));

  const combo = () => { const pool = tops.length ? tops : []; if (!pool.length) return ''; const n = Math.min(pool.length, 1 + rand(2)); return shuffle(pool).slice(0, n).join(rand(2) ? ',' : '|'); };

  const aiB = aiTaste(type); let aiGiven = false;
  const sources = {
    ai: async () => { if (!aiB?.ready || aiGiven) return []; aiGiven = true; return aiB.items.map(x => ({ x, w: 1.1, ai: true })); },
    recs: async () => {
      const take = seeds.slice(seedAt, seedAt + 3); seedAt += 3; if (seedAt >= seeds.length) { seedAt = 0; seedPage++; }
      const out = await Promise.all(take.map(s => api(`/${type}/${s.id}/recommendations`, { page: seedPage }).then(r => r.results.map(x => ({ x, why: s.title, w: 1 }))).catch(() => [])));
      return out.flat();
    },
    genre: async () => {
      dPage++;
      const sort = dPage % 3 === 0 ? 'vote_average.desc' : 'popularity.desc';
      const q = { with_genres: combo(), sort_by: sort, 'vote_count.gte': sort === 'vote_average.desc' ? 400 : 150, 'vote_average.gte': 6.2, page: dPage };
      const withLang = dPage < 6 ? lang : '';
      let r = await api(`/discover/${type}`, { ...q, with_original_language: withLang }).catch(() => ({ results: [] }));
      if (!r.results.length && withLang) r = await api(`/discover/${type}`, q).catch(() => ({ results: [] }));
      return r.results.map(x => ({ x, w: .3 }));
    },
    trend: async () => { tPage++; const r = await api(`/trending/${type}/week`, { page: tPage }).catch(() => ({ results: [] })); return r.results.map(x => ({ x, w: .1 })); },
    broad: async () => { rPage++; const r = await api(`/${type}/${rPage % 2 ? 'top_rated' : 'popular'}`, { page: Math.ceil(rPage / 2) }).catch(() => ({ results: [] })); return r.results.map(x => ({ x, w: 0 })); },
  };
  const plan = () => { const p = []; if (seeds.length) p.push('recs'); if (tops.length) p.push('genre'); if (aiB?.ready && !aiGiven && aiB.items.length) p.push('ai'); p.push('trend'); if (calls > 3 || !seeds.length) p.push('broad'); return p; };

  return async function next(page = 1) {
    calls++;
    if (page === 1 && bank?.length) { bank.forEach(x => { seen.add(key(x)); ITEMS.set(key(x), x); }); if (mark) remember(bank.slice(0, 24)); return { results: bank, total_pages: page + 50 }; }
    const out = new Map();
    // Run two or three sources at a time; stop as soon as there are enough fresh titles.
    for (let attempt = 0; attempt < 3 && out.size < 16; attempt++) {
      const p = plan(), pick = shuffle(p).slice(0, Math.min(p.length, 3)); if (p.includes('ai') && !pick.includes('ai')) pick[0] = 'ai';
      const got = (await Promise.all(pick.map(n => sources[n]()))).flat().sort((a, b) => !!b.why - !!a.why);  // titles with a personal reason win duplicates
      for (const o of got) {
        const it = norm(o.x, type), k = key(it);
        if (seen.has(k) || !it.poster || !isSafeFor(S.cfg.kids, it) || ['watched', 'hidden'].includes(S.lib[k]?.status)) continue;
        seen.add(k);
        let sc = Math.random() * .6 + it.rating / 10 + (o.w || 0);
        for (const g of it.genres) sc += (aff[g] || 0) * .15;
        if (S.cfg.langs.includes(it.lang)) sc += .3; if (neg.has(it.id)) sc -= 1.2; if (shown.has(k)) sc -= 1.2;
        const gn = it.genres.filter(g => tops.includes(g)).map(g => GN[g]).filter(Boolean);
        const why = o.ai ? 'Picked by AI for your taste' : seeds.length && (o.why || gn.length) ? 'Based on your watch history' : '';
        out.set(k, { ...it, why, sc });
      }
    }
    const list = [...out.values()].sort((a, b) => b.sc - a.sc);
    dry = list.length ? 0 : dry + 1;
    if (page === 1 && mark) remember(list.slice(0, 24));
    return { results: list, total_pages: dry >= 2 ? page : page + 50 };
  };
}
