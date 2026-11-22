import { BASE } from './config.js';
import { ITEMS, S } from './state.js';
import { key } from './utils.js';
import { isSafeFor } from './safety.js';
import { cget, cset } from './store.js';

export const cache = new Map();
const inflight = new Map();
// How long a saved answer counts as fresh. Lists change daily; details barely change.
const ttl = path => /^\/(trending|movie\/(now_playing|upcoming)|tv\/(on_the_air|airing_today))/.test(path) ? 2 * 36e5 : /^\/(movie|tv|person)\/\d+$/.test(path) ? 24 * 36e5 : 8 * 36e5;

// At most 8 requests at once, so a busy page does not stall behind its own traffic.
let active = 0; const waiting = [];
const slot = () => new Promise(r => { if (active < 8) { active++; r(); } else waiting.push(r); });
const free = () => { const n = waiting.shift(); if (n) n(); else active--; };

/* Titles that have not come out yet are hidden everywhere except search, people, the release radar and Browse with its toggle on. */
const today = () => new Date().toISOString().slice(0, 10);
const keepable = x => { const d = x.release_date || x.first_air_date; return !d || d <= today(); };
export async function api(path, params = {}) {
  const { unreleased, ...rest } = params;
  const j = await rawApi(path, rest);
  if (unreleased || !j || !Array.isArray(j.results) || /^\/(search|person|collection|genre|watch)/.test(path)) return j;
  return { ...j, results: j.results.filter(keepable) };
}

async function rawApi(path, params = {}) {
  const k = S.cfg.key.trim(), headers = {};
  const u = new URL(BASE + path);
  if (k.length > 40) headers.Authorization = 'Bearer ' + k; else u.searchParams.set('api_key', k);
  for (const [a, b] of Object.entries(params)) if (b !== '' && b != null) u.searchParams.set(a, b);
  u.searchParams.set('language', 'en-US');
  if (S.cfg.kids) u.searchParams.set('include_adult', 'false');
  const ck = path + '?' + [...u.searchParams].filter(([a]) => a !== 'api_key').sort().map(([a, b]) => a + '=' + b).join('&');
  if (cache.has(ck)) return cache.get(ck);
  if (inflight.has(ck)) return inflight.get(ck);
  const run = (async () => {
    const saved = await cget(ck);
    if (saved && Date.now() - saved.t < ttl(path)) { cache.set(ck, saved.v); return saved.v; }
    await slot();
    try {
      let r, last;
      for (const ms of [8000, 12000]) {           // a hung request must never hold a slot forever
        const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
        try { r = await fetch(u, { headers, signal: ac.signal }); clearTimeout(t); if (r.status < 500 && r.status !== 429) break; last = new Error('TMDB error ' + r.status); last.status = r.status; r = null; }
        catch (e) { clearTimeout(t); last = e.name === 'AbortError' ? Object.assign(new Error('TMDB is responding slowly. Your network may be throttling it; try a different DNS such as 1.1.1.1, or a VPN'), { status: 0 }) : e; }
      }
      if (!r) throw last;
      if (!r.ok) { const e = new Error('TMDB error ' + r.status); e.status = r.status; throw e; }
      const j = await r.json(); cache.set(ck, j); cset(ck, j); return j;
    } catch (e) { if (saved && e.status !== 401) { cache.set(ck, saved.v); return saved.v; } throw e; }
    finally { free(); }
  })();
  inflight.set(ck, run); run.finally(() => inflight.delete(ck)).catch(() => {});
  return run;
}

export function norm(x, type) {
  const t = x.media_type || type || (x.first_air_date !== undefined ? 'tv' : 'movie');
  if (t === 'person') {
    const p = { id: x.id, type: 'person', title: x.name, poster: x.profile_path, sub: x.known_for_department || '' };
    return p;
  }
  const it = { id: x.id, type: t, title: x.title || x.name || '', year: (x.release_date || x.first_air_date || '').slice(0, 4),
    poster: x.poster_path || null, backdrop: x.backdrop_path || null, rating: x.vote_average || 0,
    date: x.release_date || x.first_air_date || '', genres: x.genre_ids || (x.genres || []).map(g => g.id), overview: x.overview || '', lang: x.original_language || '' };
  ITEMS.set(key(it), it);
  return it;
}

/** Watched or hidden titles stay off the home screen (Browse has its own Hide seen toggle). */
export const isSeen = it => ['watched', 'hidden'].includes(S.lib[key(it)]?.status);
export const L = (path, params, type) => async page => {
  const r = await api(path, { ...params, page });
  return { results: (r.results || []).map(x => norm(x, type)).filter(it => isSafeFor(S.cfg.kids, it)), total_pages: Math.min(r.total_pages || 1, 500) };
};
