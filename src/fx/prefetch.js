import { api } from '../core/api.js';
// McMaster-Carr rule: the next page should already be there. Hovering a poster warms its detail request.
let t, last = '';
document.addEventListener('pointerover', e => {
  const c = e.target.closest?.('[data-open]'); if (!c) return;
  const k = c.dataset.open; if (k === last) return;
  clearTimeout(t); t = setTimeout(() => { last = k; const [type, id] = k.split(':');
    api(`/${type}/${id}`, { append_to_response: 'credits,videos,watch/providers,recommendations,similar,external_ids,reviews', include_video_language: 'en,null' }).catch(() => {}); }, 140);
}, { passive: true });
