import { api } from '../core/api.js';
import { IMG } from '../core/config.js';
import { drop, put, rateToast, refreshView, toast } from '../core/library.js';
import { ITEMS, S, save } from '../core/state.js';
import { $, $$, esc, key } from '../core/utils.js';
import { paintActions } from '../pages/title.js';
import { route } from '../router.js';

export const tvInfo = id => api(`/tv/${id}`);

export const seasonsOf = d => (d.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0);

export function trkPct(e, d) {
  if (e.type === 'movie') return e.prog?.pct || 0;
  if (!d) return 0; const ss = seasonsOf(d), tot = ss.reduce((a, s) => a + s.episode_count, 0); if (!tot) return 0;
  const s = e.prog?.s || 1, before = ss.filter(x => x.season_number < s).reduce((a, x) => a + x.episode_count, 0);
  return Math.min(100, Math.round((before + (e.prog?.e || 0)) / tot * 100));
}

export function trkHtml(e, idle = false) {
  const k = key(e), p = e.prog || {};
  const ctl = e.type === 'tv'
    ? `<button data-ep="-1" title="Back one episode">−</button><button class="primary" data-ep="1">+1 episode</button>`
    : `<input type="range" min="0" max="100" value="${p.pct || 0}" data-pct aria-label="Progress">`;
  return `<div class="trk${idle ? ' idle' : ''}" data-k="${k}"><img class="tp" data-open="${k}" loading="lazy" src="${e.poster ? IMG + 'w185' + e.poster : ''}" alt="">
    <div class="tb"><div class="tt" data-open="${k}">${esc(e.title)}</div><div class="ts" data-lab>${e.type === 'tv' ? `Season ${p.s || 1}, episode ${p.e || 0}` : (p.pct || 0) + '% watched'}</div>
    <div class="pbar"><i data-bar style="width:${e.type === 'movie' ? (p.pct || 0) : 0}%"></i></div><div class="tn sub" data-next></div>
    <div class="tc">${ctl}<button data-done>Finished</button><button data-stop title="Stop tracking">✕</button></div></div></div>`;
}

export async function enrichTrk(root) {
  for (const el of $$('.trk', root)) {
    const e = S.lib[el.dataset.k] || ITEMS.get(el.dataset.k); if (!e || e.type !== 'tv') continue;
    try {
      const d = await tvInfo(e.id); if (!el.isConnected) continue;
      $('[data-bar]', el).style.width = trkPct(e, d) + '%';
      const n = d.next_episode_to_air; $('[data-next]', el).textContent = n ? `Next episode airs ${new Date(n.air_date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}` : (d.status === 'Ended' ? 'Series has ended' : '');
    } catch {}
  }
}

export async function stepEp(k, delta) {
  // Ticking an episode on a title you are not tracking yet starts tracking it, so there is no separate button.
  let started = false;
  if (!S.lib[k] || !['watching', 'watched'].includes(S.lib[k].status)) { if (S.lib[k]?.status === 'hidden') return; const old = S.lib[k]?.prog; put(k, 'watching'); if (old && S.lib[k]) S.lib[k].prog = old; started = !!S.lib[k]; }
  const e = S.lib[k]; if (!e) return;
  const d = await tvInfo(e.id), ss = seasonsOf(d), cnt = n => ss.find(x => x.season_number === n)?.episode_count || 0;
  let s = e.prog?.s || 1, ep = (e.prog?.e || 0) + delta;
  if (delta > 0 && ep > cnt(s)) { const nx = ss.find(x => x.season_number > s); if (nx) { s = nx.season_number; ep = 1; } else return finishTrk(k); }
  if (delta < 0 && ep < 0) { const pv = [...ss].reverse().find(x => x.season_number < s); if (pv) { s = pv.season_number; ep = pv.episode_count; } else ep = 0; }
  e.prog = { s, e: ep }; e.ts = Date.now(); save();
  if (started && location.hash.startsWith('#/t/')) { paintActions(); toast('Added to Watching'); return; }
  const el = $(`.trk[data-k="${k}"]`); if (el) { $('[data-lab]', el).textContent = `Season ${s}, episode ${ep}`; $('[data-bar]', el).style.width = trkPct(e, d) + '%'; }
}

export function finishTrk(k) { const e = S.lib[k]; if (!e) return; put(k, 'watched'); rateToast(k); if (location.hash.startsWith('#/list/') || location.hash === '#/' || location.hash === '#/foryou') route(true); else refreshView(k); }

document.addEventListener('click', ev => {
  const t = ev.target, trk = t.closest('.trk'); if (!trk) return; const k = trk.dataset.k;
  let n;
  if ((n = t.closest('[data-ep]'))) stepEp(k, +n.dataset.ep).catch(() => toast('Could not update the episode. Check your connection.'));
  else if (t.closest('[data-done]')) finishTrk(k);
  else if (t.closest('[data-stop]')) { drop(k); trk.remove(); if (location.hash.startsWith('#/t/')) paintActions(); }
});

document.addEventListener('input', ev => { if (ev.target.matches?.('[data-pct]')) { const trk = ev.target.closest('.trk'), v = +ev.target.value; $('[data-lab]', trk).textContent = v + '% watched'; $('[data-bar]', trk).style.width = v + '%'; } });

document.addEventListener('change', ev => { if (ev.target.matches?.('[data-pct]')) { const k = ev.target.closest('.trk').dataset.k, e = S.lib[k]; if (e) { e.prog = { pct: +ev.target.value }; e.ts = Date.now(); save(); } } });
