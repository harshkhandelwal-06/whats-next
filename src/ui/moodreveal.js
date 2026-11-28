// The mood result: one top pick that arrives with a flourish, then a whole dealt hand of more titles for the mood.
import { IMG } from '../core/config.js';
import { put, toast } from '../core/library.js';
import { GN, ITEMS } from '../core/state.js';
import { $, $$, esc, key, rand, shuffle } from '../core/utils.js';
import { burst } from './components.js';
import { motion } from './motion.js';

const HAND = 15;
const close = () => { $('.mr')?.classList.add('out'); setTimeout(() => $$('.mr').forEach(x => x.remove()), motion() === 'off' ? 0 : 260); document.documentElement.classList.remove('mr-open'); };
const gname = it => (it.genres || []).slice(0, 3).map(g => GN[g]).filter(Boolean).join(', ');

const letters = t => [...String(t)].map((c, i) => c === ' ' ? ' ' : `<span style="--c:${i}">${esc(c)}</span>`).join('');
const count = (el, to) => { if (motion() === 'off') { el.textContent = to.toFixed(1); return; } const t0 = performance.now(); const f = t => { const p = Math.min((t - t0) / 1100, 1); el.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(1); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); };

function dealCard(it, i) {
  const k = key(it); ITEMS.set(k, ITEMS.get(k) || it);
  return `<article class="mr-c" data-k="${k}" style="--i:${i};--r:${(Math.random() * 10 - 5).toFixed(1)}deg"><div class="mr-tilt"><div class="mr-p"><img loading="lazy" decoding="async" src="${IMG}w342${it.poster}" alt="">
    <span class="mr-glare"></span><span class="mr-rate">★ ${(+it.rating || 0).toFixed(1)}</span>
    <div class="mr-q"><button data-add title="Add to watchlist" aria-label="Add to watchlist">＋</button><button data-seen title="Already seen" aria-label="Already seen">✓</button></div></div>
    <h4>${esc(it.title)}</h4><p>${esc(it.year || '')}${gname(it) ? ' · ' + esc(gname(it)) : ''}</p></div></article>`;
}

/** items: ranked pool. o: { win, defs, why, again } */
export function moodReveal(items, o = {}) {
  items = items.filter(i => i.poster); if (!items.length) return;
  const win = o.win || items[0], hue = o.defs?.[0]?.h ?? 350, rest = items.filter(i => key(i) !== key(win));
  let deck = shuffle(rest.slice(0, 40)), at = 0;
  const take = () => { if (at + HAND > deck.length) { deck = shuffle(deck); at = 0; } const part = deck.slice(at, at + HAND); at += HAND; return part; };
  document.querySelectorAll('.mr').forEach(x => x.remove());
  const el = document.createElement('div'); el.className = 'mr'; el.style.setProperty('--h', hue); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Your mood picks');
  const ov = String(win.overview || '').trim();
  el.innerHTML = `<div class="mr-bg"></div><button class="mr-x" aria-label="Close">✕</button>
    <div class="mr-scroll"><section class="mr-hero">${win.backdrop ? `<div class="mr-back" style="background-image:url(${IMG}w780${win.backdrop})"></div>` : ''}<div class="mr-veil"></div>
      <div class="mr-poster"><img src="${IMG}w500${win.poster}" alt=""><span class="mr-shine"></span></div>
      <div class="mr-info"><p class="mr-why">${esc(o.why || 'Picked for your mood')}</p><h2 class="mr-title" aria-label="${esc(win.title)}">${letters(win.title)}</h2>
        <div class="mr-meta"><span class="mr-score">★ <b id="mrNum">0.0</b></span>${win.year ? `<span>${esc(win.year)}</span>` : ''}${win.type === 'tv' ? '<span>TV</span>' : ''}${gname(win) ? `<span>${esc(gname(win))}</span>` : ''}</div>
        <p class="mr-ov">${esc(ov.length > 320 ? ov.slice(0, 316).replace(/\s+\S*$/, '') + '…' : ov || 'No description yet.')}</p>
        <div class="mr-btns"><button class="primary" data-go>See details</button><button data-wl>Add to watchlist</button><button data-seen>Already seen</button><button data-again>${o.again ? 'Suggest another' : 'Pick again'}</button></div></div></section>
      <section class="mr-more"><div class="mr-mh"><h3>More for this mood</h3><button id="mrDeal" class="mr-deal">Deal new ones</button></div><div class="mr-grid" id="mrGrid"></div></section></div>`;
  document.body.appendChild(el); document.documentElement.classList.add('mr-open');
  requestAnimationFrame(() => el.classList.add('in'));
  count($('#mrNum', el), +win.rating || 0);
  setTimeout(() => burst($('.mr-poster', el), ['🎬', '🍿', '✨', '⭐'], 16), motion() === 'off' ? 0 : 650);

  const grid = $('#mrGrid', el);
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { root: $('.mr-scroll', el), threshold: .12 }) : null;
  const deal = () => {
    const part = take(); const old = $$('.mr-c', grid);
    const paint = () => {
      grid.innerHTML = part.map((it, i) => dealCard(it, i)).join('');
      $$('.mr-c', grid).forEach((c, i) => { if (io) io.observe(c); else c.classList.add('in'); c.style.setProperty('--d', Math.min(i, 10) * 70 + 'ms'); });
    };
    if (old.length && motion() !== 'off') { old.forEach((c, i) => c.classList.add('fly')); setTimeout(paint, 380); } else paint();
  };
  deal();

  el.addEventListener('click', e => {
    const x = e.target.closest('.mr-x'); if (x) return close();
    const card = e.target.closest('.mr-c');
    if (card) {
      const it = ITEMS.get(card.dataset.k); if (!it) return;
      const add = e.target.closest('[data-add]'), seen = e.target.closest('[data-seen]');
      if (add) { put(card.dataset.k, 'watchlist'); burst(add, ['✨', '🍿'], 8); toast(`Added <b>${esc(it.title)}</b> to your watchlist`, 1800); card.classList.add('saved'); return; }
      if (seen) { put(card.dataset.k, 'watched'); card.classList.add('fly'); setTimeout(() => card.remove(), 380); return; }
      close(); location.hash = `#/t/${it.type}/${it.id}`; return;
    }
    if (e.target.closest('[data-go]')) { close(); location.hash = `#/t/${win.type}/${win.id}`; }
    else if (e.target.closest('[data-wl]')) { ITEMS.set(key(win), ITEMS.get(key(win)) || win); put(key(win), 'watchlist'); burst(e.target, ['✨', '🍿'], 10); toast(`Added <b>${esc(win.title)}</b> to your watchlist`, 1800); }
    else if (e.target.closest('[data-seen]')) { ITEMS.set(key(win), ITEMS.get(key(win)) || win); put(key(win), 'watched'); close(); o.again ? o.again() : moodReveal(items, { ...o, win: rest[rand(rest.length)] }); }
    else if (e.target.closest('[data-again]')) { close(); o.again ? o.again() : moodReveal(items, { ...o, win: rest[rand(rest.length)] }); }
    else if (e.target.closest('#mrDeal')) deal();
  });
  // Cards tilt towards the pointer and catch a moving highlight.
  el.addEventListener('pointermove', e => {
    if (motion() !== 'full' || e.pointerType === 'touch') return;
    const t = e.target.closest?.('.mr-tilt'); if (!t) return; const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    t.style.setProperty('--rx', ((.5 - y) * 14).toFixed(1) + 'deg'); t.style.setProperty('--ry', ((x - .5) * 16).toFixed(1) + 'deg'); t.style.setProperty('--gx', (x * 100).toFixed(0) + '%'); t.style.setProperty('--gy', (y * 100).toFixed(0) + '%');
  });
  el.addEventListener('pointerout', e => { const t = e.target.closest?.('.mr-tilt'); if (t && !t.contains(e.relatedTarget)) { t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); } });
  return el;
}
