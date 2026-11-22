import { ai, dedupePicks, jparse, resolvePick, seenList } from '../core/ai.js';
import { api } from '../core/api.js';
import { IMG } from '../core/config.js';
import { GN, S, save } from '../core/state.js';
import { $, $$, esc, key } from '../core/utils.js';
import { RT } from '../router.js';
import { card } from '../ui/components.js';

export function countUp(root = document) { $$('[data-count]', root).forEach(el => { const to = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now(); const f = t => { const p = Math.min((t - t0) / 1100, 1); el.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(dec); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }); }

export async function ensureMeta(ents, onProg) {
  const need = ents.filter(e => !S.meta[key(e)]); let done = 0, i = 0; onProg(0, need.length);
  const one = async e => {
    try {
      const d = await api(`/${e.type}/${e.id}`, { append_to_response: 'credits,keywords' });
      const kw = (e.type === 'movie' ? d.keywords?.keywords : d.keywords?.results) || [];
      S.meta[key(e)] = { rt: e.type === 'movie' ? d.runtime || 0 : (d.episode_run_time?.[0] || d.last_episode_to_air?.runtime || 0), ep: d.number_of_episodes || 0,
        dir: (e.type === 'movie' ? (d.credits?.crew || []).filter(c => c.job === 'Director') : (d.created_by || [])).slice(0, 2).map(p => [p.id, p.name, p.profile_path || '']),
        cast: (d.credits?.cast || []).slice(0, 3).map(p => [p.id, p.name, p.profile_path || '']), kw: kw.slice(0, 12).map(k => k.name), vc: d.vote_count || 0,
        yr: (d.release_date || d.first_air_date || '').slice(0, 4), lang: d.original_language || '' };
    } catch {}
    onProg(++done, need.length);
  };
  await Promise.all(Array.from({ length: 6 }, async () => { while (i < need.length) await one(need[i++]); }));
  if (need.length) save();
}

export const ARCH = { 28: 'The Adrenaline Chaser', 10759: 'The Adrenaline Chaser', 12: 'The Explorer', 16: 'The Eternal Kid', 35: 'The Comedy Connoisseur', 80: 'The Armchair Detective', 99: 'The Truth Seeker', 18: 'The Feeler', 10751: 'The Comfort Watcher', 14: 'The Dreamer', 10765: 'The Dreamer', 36: 'The History Buff', 27: 'The Fearless One', 10402: 'The Soundtrack Soul', 9648: 'The Puzzle Solver', 10749: 'The Hopeless Romantic', 878: 'The Mind-Bender', 53: 'The Edge-Sitter', 10752: 'The Strategist', 10768: 'The Strategist', 37: 'The Frontier Fan' };

export const BORING = new Set(['sequel', 'woman director', 'duringcreditsstinger', 'aftercreditsstinger', 'based on novel or book', 'based on comic', 'remake', '3d', 'ensemble cast']);

export function computeDNA(ents) {
  const g = {}, dir = {}, act = {}, dec = {}, kw = {}, lang = {}, avoid = {}; let rtM = 0, nM = 0, rtT = 0, nT = 0, vc = 0, nV = 0, mins = 0, rs = 0, rn = 0, liked = 0;
  for (const e of ents) {
    const my = e.my || 7, w = Math.max(0.15, (my - 3) / 7), me = S.meta[key(e)] || {};
    if (my <= 4) { for (const id of e.genres || []) avoid[id] = (avoid[id] || 0) + 1; continue; }
    liked++; rs += my; rn++;
    for (const id of e.genres || []) g[id] = (g[id] || 0) + w;
    for (const [id, n, p] of me.dir || []) { const o = dir[id] || (dir[id] = { id, n, p, c: 0 }); o.c += w; }
    for (const [id, n, p] of me.cast || []) { const o = act[id] || (act[id] = { id, n, p, c: 0 }); o.c += w; }
    for (const k of me.kw || []) if (!BORING.has(k)) kw[k] = (kw[k] || 0) + w;
    if (me.yr) { const d = Math.floor(+me.yr / 10) * 10; dec[d] = (dec[d] || 0) + w; }
    if (me.lang) lang[me.lang] = (lang[me.lang] || 0) + w;
    if (me.rt) { if (e.type === 'movie') { rtM += me.rt; nM++; mins += me.rt; } else { rtT += me.rt; nT++; mins += me.rt * (me.ep || 8); } }
    if (me.vc) { vc += Math.log10(me.vc + 1); nV++; }
  }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n), mx = Math.max(1, ...Object.values(g));
  const genres = top(g, 8).map(([id, v]) => ({ id: +id, n: GN[id] || id, v: v / mx }));
  const pace = nM ? rtM / nM : 0, pos = nM ? Math.min(1, Math.max(0, (pace - 85) / 85)) : nT ? Math.min(1, Math.max(0, (rtT / nT - 25) / 40)) : .5;
  const paceLabel = pos < .3 ? 'Tight and fast' : pos < .62 ? 'Balanced' : 'Epic and slow-burn';
  const niche = nV ? vc / nV : 3.5, npos = Math.min(1, Math.max(0, (niche - 2.6) / 2));
  return { genres, dirs: Object.values(dir).sort((a, b) => b.c - a.c).slice(0, 6), acts: Object.values(act).sort((a, b) => b.c - a.c).slice(0, 6), kw: top(kw, 14),
    dec: top(dec, 6).sort((a, b) => a[0] - b[0]).map(([d, v]) => ({ d: +d, v })), lang: top(lang, 3), avoid: top(avoid, 3).map(([id]) => GN[id]).filter(Boolean),
    hours: Math.round(mins / 60), avg: rn ? rs / rn : 0, count: ents.length, liked, pos, paceLabel, pace: Math.round(pace), npos,
    nicheLabel: npos < .35 ? 'Crowd-pleasers' : npos < .65 ? 'A healthy mix' : 'Deep cuts', arch: ARCH[genres[0]?.id] || 'The Curious Viewer' };
}

export function radarSvg(items) {
  const N = items.length, R = 88, C = 120, pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return [C + Math.cos(a) * r, C + Math.sin(a) * r]; };
  const grid = [.33, .66, 1].map(f => `<polygon points="${items.map((_, i) => pt(i, R * f).map(n => n.toFixed(1)).join(',')).join(' ')}" class="rg"/>`).join('');
  const axes = items.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="ra"/>`; }).join('');
  const P = items.map((it, i) => pt(i, R * Math.max(.14, it.v)));
  const labels = items.map((it, i) => { const [x, y] = pt(i, R + 14); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${x < C - 6 ? 'end' : x > C + 6 ? 'start' : 'middle'}" dominant-baseline="middle">${esc(it.n)}</text>`; }).join('');
  return `<svg viewBox="-50 -4 340 248" class="radar" role="img" aria-label="Genre radar">${grid}${axes}<polygon points="${P.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" class="rv"/>${P.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" class="rd"/>`).join('')}${labels}</svg>`;
}

export const gauge = (a, b, v) => `<div class="gauge"><span>${a}</span><div class="gt"><i style="left:${Math.round(v * 100)}%"></i></div><span>${b}</span></div>`;

export function renderDNA(D) {
  const maxDec = Math.max(1, ...D.dec.map(x => x.v)), maxKw = Math.max(1, ...D.kw.map(x => x[1]));
  const person = (p, i) => `<div class="pc2" data-person="${p.id}" style="--i:${i}"><img src="${p.p ? IMG + 'w185' + p.p : ''}" alt=""><b>${esc(p.n)}</b></div>`;
  return `<section class="dna"><div class="dhero"><div><div class="sub">Your taste DNA</div><h1 id="dArch">${esc(D.arch)}</h1><p id="dSum" class="dsum">${S.cfg.geminiKey ? '<span class="typing"><i></i><i></i><i></i></span>' : `You rate generously and lean towards ${esc(D.genres.slice(0, 3).map(g => g.n).join(', '))}. Add a free Gemini key in Settings for a written profile.`}</p></div>
    <div class="tiles"><div><b data-count="${D.count}">0</b><span>titles analysed</span></div><div><b data-count="${D.hours}">0</b><span>hours watched</span></div><div><b data-count="${(D.avg / 2).toFixed(1)}" data-dec="1">0</b><span>avg rating out of 5</span></div></div></div>
    <div class="dgrid"><div class="dcard">${D.genres.length >= 3 ? radarSvg(D.genres.slice(0, 7)) : '<p class="sub">Rate a few more titles to draw your genre map.</p>'}</div>
    <div class="dcard"><h3>Favourite genres</h3>${D.genres.slice(0, 6).map((g, i) => `<div class="hb"><span>${esc(g.n)}</span><div><i style="--w:${Math.round(g.v * 100)}%;--i:${i}"></i></div></div>`).join('')}${D.avoid.length ? `<p class="sub small" style="margin-top:12px">You tend to rate ${esc(D.avoid.join(', '))} lower.</p>` : ''}</div>
    <div class="dcard"><h3>Pacing</h3>${gauge('Tight and fast', 'Epic and slow-burn', D.pos)}<p class="dnote">${esc(D.paceLabel)}${D.pace ? ` · your films average ${D.pace} minutes` : ''}</p>
      <h3 style="margin-top:20px">Taste</h3>${gauge('Crowd-pleasers', 'Deep cuts', D.npos)}<p class="dnote">${esc(D.nicheLabel)}</p></div>
    <div class="dcard"><h3>Decades you love</h3><div class="decs">${D.dec.map((x, i) => `<div style="--i:${i}"><i style="--h:${Math.round(x.v / maxDec * 100)}%"></i><span>${x.d}s</span></div>`).join('')}</div></div></div>
    ${D.dirs.length ? `<h2>Directors and creators you keep coming back to</h2><div class="row">${D.dirs.map(person).join('')}</div>` : ''}
    ${D.acts.length ? `<h2>Faces you enjoy</h2><div class="row">${D.acts.map(person).join('')}</div>` : ''}
    ${D.kw.length ? `<h2>Themes that pull you in</h2><div class="cloud">${D.kw.map(([k, v], i) => `<span style="--s:${(0.85 + v / maxKw * 0.9).toFixed(2)};--i:${i}">${esc(k)}</span>`).join('')}</div>` : ''}
    <div id="dStyle"></div><div id="dTry"></div></section>`;
}

export async function dnaAI(D, ents, tok) {
  const sig = ents.length + ':' + Math.max(...ents.map(e => e.ts)), c = S.sum.dna;
  let j = c && c.sig === sig ? c.data : null;
  if (!j) {
    const loved = ents.filter(e => (e.my || 7) >= 8).slice(0, 14).map(e => `${e.title} (${e.year})`).join('; '), dis = ents.filter(e => e.my && e.my <= 4).slice(0, 8).map(e => e.title).join('; ');
    const sys = `You analyse a person's viewing history and write their "taste DNA". Reply with ONLY JSON: {"archetype":"a 2-4 word title like The Mind-Bender","summary":"2 warm, specific sentences about their taste, second person","storytelling":"one sentence on the storytelling styles they favour","themes":"one sentence on recurring themes","pacing":"one sentence on pacing and tone preferences","try":[{"title":"","year":2014,"type":"movie or tv","why":"max 16 words, spoiler-free"}]}. Give 4 "try" picks they have not seen and are not on the seen list. No spoilers.`;
    const msg = `Top genres: ${D.genres.slice(0, 5).map(g => g.n).join(', ')}\nDirectors: ${D.dirs.map(d => d.n).join(', ') || 'n/a'}\nActors: ${D.acts.map(d => d.n).join(', ') || 'n/a'}\nThemes: ${D.kw.map(k => k[0]).join(', ') || 'n/a'}\nPacing: ${D.paceLabel}; mainstream-vs-niche: ${D.nicheLabel}\nLoved: ${loved}\nDisliked: ${dis || 'none'}\nAlready seen: ${seenList()}`;
    try { j = jparse(await ai(sys, [{ role: 'user', content: msg }], { json: true, max: 2048 })); S.sum.dna = { sig, data: j }; save(false); } catch (e) { if (tok === RT && $('#dSum')) $('#dSum').textContent = e.message; return; }
  }
  if (tok !== RT || !$('#dSum')) return;
  $('#dArch').textContent = j.archetype || D.arch; $('#dSum').textContent = j.summary || '';
  $('#dStyle').innerHTML = `<h2>How you like stories told</h2><div class="tags3"><div><b>Storytelling</b><p>${esc(j.storytelling || '')}</p></div><div><b>Themes</b><p>${esc(j.themes || '')}</p></div><div><b>Pacing and tone</b><p>${esc(j.pacing || '')}</p></div></div>`;
  const picks = dedupePicks((await Promise.all((j.try || []).map(p => resolvePick(p)))).filter(Boolean));
  if (tok === RT && picks.length) $('#dTry').innerHTML = `<h2>Try next, based on your DNA</h2><div class="grid">${picks.map((p, i) => card(p, i)).join('')}</div>`;
}

export async function pageDNA(m, tok) {
  const ents = Object.values(S.lib).filter(e => e.status === 'watched' || e.status === 'watching').sort((a, b) => ((b.my || 7) - (a.my || 7)) || (b.ts - a.ts)).slice(0, 60);
  if (ents.length < 3) { m.innerHTML = `<div class="head"><h1>Your taste DNA</h1></div><div class="empty">Mark at least three titles as watched and rate them. Your DNA sharpens with every rating.<br><br><a href="#/swipe"><button class="primary">Start swiping</button></a></div>`; return; }
  m.innerHTML = `<div class="head"><h1>Your taste DNA</h1></div><div class="dnaload"><div class="pbar"><i id="dp" style="width:4%"></i></div><p class="sub">Reading your history…</p></div>`;
  await ensureMeta(ents, (d, n) => { const p = $('#dp'); if (p) p.style.width = (n ? Math.max(4, d / n * 100) : 100) + '%'; });
  if (tok !== RT) return;
  const D = computeDNA(ents); m.innerHTML = renderDNA(D); countUp(m);
  if (S.cfg.geminiKey) dnaAI(D, ents, tok);
}
