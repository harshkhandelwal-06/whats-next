import { api } from './core/api.js';
import { toggle } from './core/library.js';
import { ACTIVE, GENRES, GN, S } from './core/state.js';
import { $, $$, key } from './core/utils.js';
import { pageForYou } from './pages/foryou.js';
import { pageSetup } from './pages/setup.js';
import { ROUTES } from './routes.js';
import { CUR_IO, SPOT, errHtml, skel } from './ui/components.js';
import { closeModal } from './ui/settings.js';

export function moveInd() {}

export function moveThumb() { const b = $('#typeSeg button.on'), t = $('#typeSeg .thumb'); if (b && t) { t.style.width = b.offsetWidth + 'px'; t.style.transform = `translateX(${b.offsetLeft}px)`; } }

export const NAVOF = { foryou: 'foryou', browse: 'browse', discover: 'browse', radar: 'radar', mood: 'mood', ask: 'ask', swipe: 'swipe', night: 'night', list: 'list', rewatch: 'rewatch' };
export const setNav = r => { $$('#nav a').forEach(a => { const on = a.dataset.r === r; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); }); const a = $('#nav a.on'); if (a?.scrollIntoView && window.matchMedia?.('(max-width:1000px)')?.matches) a.scrollIntoView({ inline: 'center', block: 'nearest' }); };
function drawTabs() {}

export const setSeg = () => { $$('#typeSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === S.cfg.type)); moveThumb(); };


/* ============ router ============ */
export let RT = 0;

export function barStart() { const b = $('#bar'); b.style.transition = 'none'; b.style.width = '0'; b.style.opacity = '1'; void b.offsetWidth; b.style.transition = 'width 8s cubic-bezier(.1,.8,.2,1)'; b.style.width = '85%'; }

export function barEnd() { const b = $('#bar'); b.style.transition = 'width .25s, opacity .45s .25s'; b.style.width = '100%'; b.style.opacity = '0'; }

export async function route(soft) {
  if (!ACTIVE.id) return;   // nothing to show until someone has signed in with Google
  const tok = ++RT; CUR_IO?.disconnect(); clearInterval(SPOT); closeModal();
  const parts = location.hash.slice(2).split('/').map(decodeURIComponent);
  let [a, b, c] = parts; setSeg();
  const m = $('#view');
  if (!S.cfg.key) { setNav(''); drawTabs(''); return pageSetup(m); }
  if (!a) a = 'foryou';
  setNav(NAVOF[a] || ''); drawTabs(a);
  if (!soft) {
    m.style.removeProperty('--acr'); m.style.removeProperty('--ac');
    m.innerHTML = ['t', 'p', 'c'].includes(a) ? '<div class="spin big"></div>' : '<div class="grid">' + skel(14) + '</div>';
    window.scrollTo(0, 0); barStart();
  }
  try {
    if (!GENRES.movie.length) { if (!restoreGenres()) await loadGenres(); else loadGenres().catch(() => {}); }
    if (tok !== RT) return;
    await (ROUTES[a] || pageForYou)(m, tok, b, c);
  } catch (e) { if (tok === RT) m.innerHTML = errHtml(e); }
  if (tok === RT) barEnd();
}

// Genre names almost never change, so keep a copy on the device and start instantly.
function restoreGenres() { try { const g = JSON.parse(localStorage.getItem('wn:genres') || 'null'); if (!g?.movie?.length) return false; GENRES.movie = g.movie; GENRES.tv = g.tv; [...g.movie, ...g.tv].forEach(x => GN[x.id] = x.name); return true; } catch { return false; } }
export async function loadGenres() {
  const [mv, tv] = await Promise.all([api('/genre/movie/list'), api('/genre/tv/list')]);
  GENRES.movie = mv.genres; GENRES.tv = tv.genres;
  [...mv.genres, ...tv.genres].forEach(g => GN[g.id] = g.name);
  try { localStorage.setItem('wn:genres', JSON.stringify({ movie: mv.genres, tv: tv.genres })); } catch {}
}
