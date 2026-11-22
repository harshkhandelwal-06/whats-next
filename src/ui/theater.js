// Theater mode: just the trailer, big, on a dark backdrop. Click anywhere or press Esc to close.
import { $ } from '../core/utils.js';

export const closeTheater = () => $('#theater')?._close?.();

/** `onClose(seconds)` lets the small player pick up where you stopped. */
export function openTheater({ key, title = '', start = 0, onClose }) {
  closeTheater();
  const el = document.createElement('div'); el.id = 'theater'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Trailer: ' + title);
  el.innerHTML = `<div class="th-stage"><iframe title="Trailer" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube-nocookie.com/embed/${key}?autoplay=1&controls=0&rel=0&playsinline=1&enablejsapi=1&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&start=${Math.floor(start)}"></iframe></div>`;
  document.body.appendChild(el); document.body.classList.add('noscroll');
  el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
  const fr = $('iframe', el);
  let t = start, closed = false, shown = false;
  const listen = () => fr.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 2, channel: 'widget' }), '*');
  const cmd = (func, args = []) => fr.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  fr.addEventListener('load', listen); const lt = setInterval(listen, 1000);
  // YouTube paints a play/pause icon over the video while it starts or buffers; the picture only fades in once it is really playing.
  const reveal = () => { if (shown || closed) return; shown = true; fr.classList.add('ready'); };
  const fallback = setTimeout(reveal, 5000);
  const hear = e => {
    if (closed || e.source !== fr.contentWindow) return;
    try {
      const i = (typeof e.data === 'string' ? JSON.parse(e.data) : e.data)?.info; if (!i) return;
      if (typeof i.currentTime === 'number') t = i.currentTime;
      if (i.playerState === 1 && !shown) setTimeout(reveal, 2600);
      if (i.playerState === 0) { cmd('seekTo', [0, true]); cmd('playVideo'); }
    } catch {}
  };
  addEventListener('message', hear);
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  function close() {
    if (closed) return; closed = true; clearInterval(lt); clearTimeout(fallback);
    removeEventListener('message', hear); document.removeEventListener('keydown', onKey, true);
    const done = () => { el.remove(); if (!$('#rs') && !$('.modal')) document.body.classList.remove('noscroll'); onClose?.(t); };
    if (el.animate) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).onfinish = done; else done();
  }
  el._close = close;
  el.addEventListener('click', close);
  return el;
}
