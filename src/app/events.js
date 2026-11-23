import { RATES } from '../core/config.js';
import { lists, rateToast, refreshView, toast, toggle } from '../core/library.js';
import { DEF, S, save } from '../core/state.js';
import { $, key } from '../core/utils.js';
import { openAssistant } from '../features/aibubble.js';
import { DECK, swipe, undoSwipe } from '../pages/swipe.js';
import { CUR } from '../pages/title.js';
import { route } from '../router.js';
import { burst } from '../ui/components.js';
import { openListPicker } from '../features/lists.js';
const RATE_POP = { 10: ['❤️', '💖', '✨', '💕'], 8: ['👍', '✨', '⭐'], 5: ['😐', '💭'], 2: ['👎', '💨'] };
import { closeModal, modal, openSettings } from '../ui/settings.js';
import { openQuick } from '../ui/quickview.js';

document.addEventListener('click', e => {
  const t = e.target;
  let n;
  if ((n = t.closest('[data-act]'))) { e.preventDefault(); e.stopPropagation(); if (n.dataset.act === 'watchlist' && lists().length > 1) { openListPicker(n.dataset.k, n); return; } const rc = n.getBoundingClientRect(), ghost = { getBoundingClientRect: () => rc }; toggle(n.dataset.k, n.dataset.act); const ns = S.lib[n.dataset.k]?.status; if (ns === 'watched') { burst(ghost, ['✓', '✨', '🎬'], 12); rateToast(n.dataset.k); } else if (ns === 'watchlist') burst(ghost, ['💜', '＋', '✨'], 12); return; }
  if ((n = t.closest('[data-rate]'))) { const k = n.dataset.k, v = +n.dataset.rate, rc = n.getBoundingClientRect(), ghost = { getBoundingClientRect: () => rc }; if (S.lib[k]) { S.lib[k].my = v; S.lib[k].ts = Date.now(); save(); $('.toast')?.remove(); refreshView(k); burst(ghost, RATE_POP[v] || ['✨'], 16); } return; }
  if (t.closest('[data-settings]')) { e.preventDefault(); return openSettings(); }
  if ((n = t.closest('[data-person]'))) { location.hash = '#/p/' + n.dataset.person; return; }
  if ((n = t.closest('[data-genre]'))) { S.cfg.f = Object.assign({}, DEF.cfg.f, { genres: [+n.dataset.genre] }); save(); location.hash = '#/discover'; return; }
  if (t.closest('[data-trailer]') && CUR?.trailer) { modal(`<div class="box vid"><iframe src="https://www.youtube-nocookie.com/embed/${CUR.trailer.key}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><a target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${CUR.trailer.key}">Video not playing? Open on YouTube ↗</a></div>`); return; }
  if ((n = t.closest('[data-sw]'))) { swipe(n.dataset.sw); return; }
  if ((n = t.closest('[data-open]'))) { const [ty, id] = n.dataset.open.split(':'); if (!id) return; if (n.classList.contains('card')) openQuick(ty, id); else location.hash = `#/t/${ty}/${id}`; }
});

$('#typeSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.cfg.type = b.dataset.t; S.cfg.f.genres = []; save(); const h = location.hash; if (/^#\/(t|p|c)\//.test(h)) location.hash = '#/'; else route(); };


export const isNL = v => v.trim().split(/\s+/).length >= 4 || /\b(like|similar to|but|with more|under \d|shorter|longer|something)\b/i.test(v);

export const toAsk = v => { $('#q').value = ''; $('#q').blur(); openAssistant(v); };

export let qt;

$('#q').addEventListener('input', e => { clearTimeout(qt); const v = e.target.value.trim(); qt = setTimeout(() => { if (v.length > 1 && !isNL(v)) location.hash = '#/search/' + encodeURIComponent(v); }, 450); });

$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(qt); const v = e.target.value.trim(); if (!v) return; if (isNL(v)) toAsk(v); else location.hash = '#/search/' + encodeURIComponent(v); } });


document.addEventListener('keydown', e => {
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  if (e.key === 'Escape') { closeModal(); document.activeElement.blur(); return; }
  if (typing) return;
  if (location.hash === '#/swipe') {
    const d = { ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
    if (d) { e.preventDefault(); swipe(d); }
    if (e.key === 'z' || e.key === 'Z') undoSwipe();
    if (e.key === 'Enter' && DECK[0]) location.hash = `#/t/${DECK[0].type}/${DECK[0].id}`;
  }
});

