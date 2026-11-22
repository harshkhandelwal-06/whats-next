import { api, norm } from '../core/api.js';
import { IMG } from '../core/config.js';
import { put, rateToast, toast } from '../core/library.js';
import { likedOf, prefLang, recommend } from '../core/rec.js';
import { GN, ITEMS, S, save } from '../core/state.js';
import { $, esc, key, rand, shuffle } from '../core/utils.js';
import { RT } from '../router.js';

export let DECK = [], HIST = [], deckBusy = false, deckType = null;
const SW = { right: 0, up: 0, left: 0, down: 0 };

export async function fillDeck() {
  if (deckBusy) return; deckBusy = true;
  const t = S.cfg.type;
  try {
    let inc = [];
    if (likedOf(t).length) inc = await recommend(t, []);
    const p = await api(`/discover/${t}`, { sort_by: 'popularity.desc', 'vote_count.gte': 150, page: 1 + rand(15), with_original_language: prefLang() }).catch(() => ({ results: [] }));
    inc = inc.concat(shuffle(p.results.map(x => norm(x, t))));
    const have = new Set(DECK.map(key));
    inc = inc.filter(x => !S.lib[key(x)] && !have.has(key(x)) && x.poster);
    DECK.push(...inc);
  } finally { deckBusy = false; }
}

const IC = {
  down: '<path d="M5 5l14 14M19 5L5 19"/><circle cx="12" cy="12" r="9"/>',
  left: '<path d="M6 6l12 12M18 6L6 18"/>',
  up: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  right: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const sb = (d, label, title) => `<div class="sb ${d}"><button data-sw="${d}" title="${title}" aria-label="${title}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[d]}</svg></button><span>${label}</span></div>`;

export async function pageSwipe(m, tok) {
  if (deckType !== S.cfg.type) { DECK = []; HIST = []; deckType = S.cfg.type; }
  m.innerHTML = `<div class="swipe">
    <div class="sw-head"><div><h1>Swipe</h1><p class="mut">Go with your gut. Every swipe sharpens your picks.</p></div>
      <div class="sw-stats" aria-live="polite"><span><b id="swS">${SW.right}</b> seen</span><span><b id="swW">${SW.up}</b> saved</span><span><b id="swN">${SW.left + SW.down}</b> skipped</span></div></div>
    <div class="sw-main">
      <div class="sw-play">
        <div class="stack" id="stack"><div class="spin"></div></div>
        <div class="sbtns main">${sb('down', 'Never', 'Never show again')}${sb('left', 'Not seen', 'Haven\'t seen it')}${sb('up', 'Watchlist', 'Add to watchlist')}${sb('right', 'Seen it', 'Seen it')}
          <div class="sb love"><button id="loved" title="Seen and loved it" aria-label="Seen and loved it"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C1 8.7 2.8 5 6.2 5c2 0 3.2 1 3.8 2 .6-1 1.8-2 3.8-2 3.4 0 5.2 3.700 3.800 6.800C19.500 16.400 12 21 12 21z"/></svg></button><span>Loved it</span></div></div>
      </div>
      <aside class="sw-side" id="swSide" aria-label="About this title"></aside>
    </div>
    <div class="sbtns sec"><button id="undo" class="btn ghost">↶ Undo</button><button id="info" class="btn ghost">Details</button><button id="refresh" class="btn ghost">New deck</button></div></div>`;
  $('#refresh').onclick = async () => { DECK = []; $('#stack').innerHTML = '<div class="spin"></div>'; await fillDeck(); renderDeck(); };
  $('#undo').onclick = undoSwipe;
  $('#loved').onclick = () => swipe('right', 10);
  $('#info').onclick = () => DECK[0] && (location.hash = `#/t/${DECK[0].type}/${DECK[0].id}`);
  if (DECK.length < 6) await fillDeck();
  if (tok === RT) renderDeck();
}

const stats = () => { const g = id => $('#' + id); if (g('swS')) { g('swS').textContent = SW.right; g('swW').textContent = SW.up; g('swN').textContent = SW.left + SW.down; } };
function paintSide(it) {
  const side = $('#swSide'); if (!side) return;
  if (!it) { side.innerHTML = ''; return; }
  const g = it.genres.slice(0, 4).map(x => GN[x]).filter(Boolean);
  side.innerHTML = `<p class="sw-k">${it.type === 'tv' ? 'TV series' : 'Movie'}${it.year ? ' · ' + esc(it.year) : ''}</p><h2>${esc(it.title)}</h2>
    <div class="sw-m"><span class="sw-r">★ ${(+it.rating).toFixed(1)}</span>${g.map(x => `<span class="sw-g">${esc(x)}</span>`).join('')}</div>
    ${it.why ? `<p class="sw-why">✦ ${esc(it.why)}</p>` : ''}<p class="sw-o">${esc(it.overview || 'No description yet.')}</p>
    <div class="sw-legend"><span><i>→</i> Seen it</span><span><i>←</i> Not seen</span><span><i>↑</i> Watchlist</span><span><i>↓</i> Never</span></div>`;
}
export function setAmb() {}

const PRE = new Set();
// Reuses the cards already on screen: the back card is promoted to the front instead of being rebuilt,
// so a poster is never requested or painted a second time.
export function renderDeck() {
  const st = $('#stack'); if (!st) return;
  if (!DECK.length) { st.innerHTML = '<div class="empty">You have swiped through everything for now.<br>Choose New deck for more.</div>'; paintSide(null); return; }
  const mk = (it, back) => `<div class="scard ${back ? 'back' : ''}" data-k="${key(it)}" style="background-image:url(${IMG}w500${it.poster})">
    <div class="stamp r">Seen it</div><div class="stamp l">Not seen</div><div class="stamp u">Watchlist</div><div class="stamp d">Never</div>
    <div class="sc-top"><span class="sc-rate">★ ${(+it.rating).toFixed(1)}</span>${it.why ? '<span class="sc-why">✦ For you</span>' : ''}</div>
    <div class="info"><h3>${esc(it.title)}</h3><div class="sub">${esc(it.year)} · ★ ${(+it.rating).toFixed(1)} · ${esc(it.genres.slice(0, 3).map(g => GN[g]).filter(Boolean).join(', '))}${it.why ? '<br><em>' + esc(it.why) + '</em>' : ''}</div><p>${esc(it.overview)}</p></div></div>`;
  const k0 = key(DECK[0]), k1 = DECK[1] && key(DECK[1]), want = [k0, k1].filter(Boolean);
  st.querySelectorAll('.spin,.empty').forEach(n => n.remove());
  st.querySelectorAll('.scard').forEach(c => { if (c.dataset.gone || !want.includes(c.dataset.k)) c.remove(); });
  const have = k => [...st.querySelectorAll('.scard')].find(c => c.dataset.k === k);
  if (k1 && !have(k1)) st.insertAdjacentHTML('afterbegin', mk(DECK[1], true));
  if (!have(k0)) st.insertAdjacentHTML('beforeend', mk(DECK[0]));
  const front = have(k0), back = k1 && have(k1);
  front.classList.remove('back'); front.style.filter = ''; front.style.transform = ''; front.style.opacity = '';
  if (back) { back.classList.add('back'); back.style.transform = ''; back.style.filter = ''; st.prepend(back); }
  st.append(front);
  DECK.slice(0, 4).forEach(d => { if (PRE.has(d.poster)) return; PRE.add(d.poster); const i = new Image(); i.src = `${IMG}w500${d.poster}`; });
  setAmb(DECK[0]); paintSide(DECK[0]);
  bindDrag(front);
}

export function bindDrag(el) {
  let sx, sy, dx = 0, dy = 0, on = false;
  const back = el.previousElementSibling, stamps = { r: $('.stamp.r', el), l: $('.stamp.l', el), u: $('.stamp.u', el), d: $('.stamp.d', el) };
  const clr = () => Object.values(stamps).forEach(s => s.style.opacity = 0);
  el.onpointerdown = e => { on = true; sx = e.clientX; sy = e.clientY; dx = dy = 0; el.setPointerCapture(e.pointerId); el.style.transition = 'none'; el.style.animation = 'none'; };
  el.onpointermove = e => {
    if (!on) return; dx = e.clientX - sx; dy = e.clientY - sy;
    el.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 20}deg)`;
    const h = Math.abs(dx) >= Math.abs(dy), p = Math.min(Math.hypot(dx, dy) / 140, 1);
    stamps.r.style.opacity = h && dx > 0 ? Math.min(dx / 110, 1) : 0; stamps.l.style.opacity = h && dx < 0 ? Math.min(-dx / 110, 1) : 0;
    stamps.u.style.opacity = !h && dy < 0 ? Math.min(-dy / 110, 1) : 0; stamps.d.style.opacity = !h && dy > 0 ? Math.min(dy / 110, 1) : 0;
    if (back) { back.style.transform = `scale(${.94 + .06 * p}) translateY(${16 - 16 * p}px)`; back.style.filter = `brightness(${.6 + .4 * p})`; }
  };
  const end = () => {
    if (!on) return; on = false; el.style.transition = '';
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) { el.style.transform = ''; return DECK[0] && (location.hash = `#/t/${DECK[0].type}/${DECK[0].id}`); }
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 110 ? 'right' : dx < -110 ? 'left' : '') : (dy < -110 ? 'up' : dy > 110 ? 'down' : '');
    if (dir) swipe(dir); else { el.style.transform = ''; clr(); if (back) { back.style.transform = ''; back.style.filter = ''; } }
  };
  el.onpointerup = end; el.onpointercancel = () => { if (!on) return; on = false; el.style.transition = ''; el.style.transform = ''; clr(); if (back) { back.style.transform = ''; back.style.filter = ''; } };
}

export function swipe(dir, my) {
  const el = $('.scard:last-child'); const it = DECK[0]; if (!el || !it || el.dataset.gone) return;
  el.dataset.gone = 1;
  const back = el.previousElementSibling; if (back) { back.style.transform = 'none'; back.style.filter = 'none'; }
  const off = { right: [900, 0, 25], left: [-900, 0, -25], up: [0, -900, 0], down: [0, 900, 0] }[dir];
  el.style.animation = 'none'; el.style.transition = 'transform .32s cubic-bezier(.5,0,.9,.5), opacity .32s'; el.style.transform = `translate(${off[0]}px,${off[1]}px) rotate(${off[2]}deg)`; el.style.opacity = 0;
  setTimeout(() => {
    const k = key(it); HIST.push({ k, prev: S.lib[k], dir }); SW[dir]++; stats();
    put(k, { right: 'watched', left: 'unseen', up: 'watchlist', down: 'hidden' }[dir]);
    if (my && S.lib[k]) { S.lib[k].my = my; S.lib[k].ts = Date.now(); save(); }
    DECK.shift(); renderDeck();
    if (dir === 'right' && !my) rateToast(k);
    if (dir === 'up') toast(`Added <b>${esc(it.title)}</b> to your watchlist`, 2200);
    if (DECK.length < 6) fillDeck().then(() => { if (location.hash === '#/swipe' && $('#stack') && !$('.scard')) renderDeck(); });
  }, 300);
}

export function undoSwipe() {
  const h = HIST.pop(); if (!h) return toast('Nothing to undo', 1500);
  if (h.dir && SW[h.dir] > 0) SW[h.dir]--; stats();
  if (h.prev) S.lib[h.k] = { ...h.prev, ts: Date.now() }; else { delete S.lib[h.k]; S.del[h.k] = Date.now(); } save();
  const it = ITEMS.get(h.k); if (it) DECK.unshift(it); renderDeck();
}
