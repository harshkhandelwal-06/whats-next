// "See all" on a Home row: the row grows into a full page over Home with more titles, and shrinks back into place.
import { $ } from '../core/utils.js';
import { mountGrid } from './components.js';

const ROWS = new Map();
export const registerRows = list => { ROWS.clear(); list.forEach(r => ROWS.set(r.id, r)); };
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const still = () => !Element.prototype.animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
let busy = false;

const insetFor = (r, top) => {
  const vw = innerWidth, vh = innerHeight - top;
  const t = Math.max(0, r.top - top), b = Math.max(0, vh - (r.bottom - top)), l = Math.max(0, r.left), rt = Math.max(0, vw - r.right);
  return `inset(${t}px ${rt}px ${b}px ${l}px round 16px)`;
};

export function closeRow(instant = false) {
  const el = $('#rs'); if (!el || el.dataset.closing) return;
  el.dataset.closing = 1;
  const done = () => { el.remove(); document.body.classList.remove('noscroll'); busy = false; };
  if (instant || still()) return done();
  const lane = el.dataset.src ? document.querySelector(el.dataset.src) : document.getElementById('lane-' + el.dataset.id), top = el.getBoundingClientRect().top;
  const r = lane?.isConnected ? lane.getBoundingClientRect() : null;
  const inView = r && r.bottom > top && r.top < innerHeight;
  $('.rs-in', el).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
  const a = el.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: inView ? insetFor(r, top) : 'inset(40% 20% 40% 20% round 24px)', opacity: inView ? 1 : 0 }],
    { duration: 380, easing: EASE, fill: 'forwards' });
  a.onfinish = a.oncancel = done;
}

export function openRow(id) {
  const row = ROWS.get(id); if (!row || busy || $('#rs')) return; busy = true;
  const lane = document.getElementById('lane-' + id), top = 0;   // covers the whole page, header included
  const from = lane?.getBoundingClientRect();
  const el = document.createElement('div'); el.id = 'rs'; el.className = 'rowsheet'; el.dataset.id = id; el.style.top = top + 'px';
  el.innerHTML = `<div class="rs-in"><div class="rs-bar"><button class="rs-back" data-rsclose aria-label="Back to Home">‹</button><div><h2>${row.title}</h2><p class="mut">${row.sub || 'More from this row. Keep scrolling for more.'}</p></div></div><div id="rsg"></div></div>`;
  document.body.appendChild(el); document.body.classList.add('noscroll');
  const first = (row.first?.() || []).filter(x => x.poster);
  mountGrid($('#rsg', el), row.fetch, first.length ? { start: 2, first } : { start: 1 });
  el.addEventListener('click', e => { if (e.target.closest('[data-rsclose]')) closeRow(); });
  if (from && !still()) {
    el.animate([{ clipPath: insetFor(from, top) }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: 460, easing: EASE }).onfinish = () => { busy = false; };
    $('.rs-in', el).animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 140, easing: EASE, fill: 'backwards' });
  } else busy = false;
}

/** A full-page panel that grows out of any element (used for a watchlist). Returns the panel's content box. */
export function openPanel({ title, sub = '', src, tools = '', body = '' }) {
  if (busy || $('#rs')) return null; busy = true;
  const from = src ? document.querySelector(src)?.getBoundingClientRect() : null;
  const el = document.createElement('div'); el.id = 'rs'; el.className = 'rowsheet'; el.dataset.src = src || ''; el.style.top = '0px';
  el.innerHTML = `<div class="rs-in"><div class="rs-bar"><button class="rs-back" data-rsclose aria-label="Back">‹</button><div class="rs-t"><h2></h2><p class="mut"></p></div><div class="rs-tools">${tools}</div></div><div id="rsg">${body}</div></div>`;
  $('h2', el).textContent = title; $('.rs-t p', el).textContent = sub;
  document.body.appendChild(el); document.body.classList.add('noscroll');
  el.addEventListener('click', e => { if (e.target.closest('[data-rsclose]')) closeRow(); });
  if (from && !still()) {
    el.animate([{ clipPath: insetFor(from, 0) }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: 460, easing: EASE }).onfinish = () => { busy = false; };
    $('.rs-in', el).animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 140, easing: EASE, fill: 'backwards' });
  } else busy = false;
  return el;
}

document.addEventListener('click', e => { const m = e.target.closest('[data-row]'); if (m) { e.preventDefault(); openRow(m.dataset.row); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#rs') && !$('#qv')) closeRow(); });
window.addEventListener('hashchange', () => closeRow(true));
