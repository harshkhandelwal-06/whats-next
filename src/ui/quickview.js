// Quick-view popup: trailer, where to watch, cast and "if you like this". Opens when a poster is clicked.
import { openTheater, closeTheater } from './theater.js';
import { api, norm } from '../core/api.js';
import { IMG, RATES } from '../core/config.js';
import { taste } from '../core/rec.js';
import { GN, S } from '../core/state.js';
import { $, esc, key } from '../core/utils.js';
import { enrichTrk, trkHtml } from '../features/tracker.js';

const PARAMS = { append_to_response: 'credits,videos,watch/providers,recommendations,similar,external_ids,reviews', include_video_language: 'en,null' };
let TOK = 0;

// Rough fit from the genres you rate highly; null until you have rated enough to say anything.
export function matchPct(it) {
  const g = taste(it.type), max = Math.max(0, ...Object.values(g).map(Math.abs));
  if (max < 0.5 || !(it.genres || []).length) return null;
  const sc = it.genres.reduce((a, id) => a + (g[id] || 0), 0) / it.genres.length / max;
  return Math.round(Math.min(98, Math.max(35, 62 + sc * 34)));
}

export const closeQuick = instant => {
  TOK++; const el = $('#qv'); if (!el) return;
  const done = () => { el.remove(); document.body.classList.remove('noscroll'); };
  if (instant || typeof el.animate !== 'function' || el.dataset.closing) return done();
  el.dataset.closing = '1'; const box = $('.qv', el);
  if (box) box.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px) scale(.98)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).finished.then(done, done);
};

const actions = (k, type, id, im, name) => {
  const e = S.lib[k], st = e?.status;
  const stremio = im ? `stremio:///detail/${type === 'tv' ? 'series' : 'movie'}/${im}/${im}` : `stremio:///search?search=${encodeURIComponent(name)}`;
  return `<button class="primary wl ${st === 'watchlist' ? 'on' : ''}" data-act="watchlist" data-k="${k}">${st === 'watchlist' ? 'On watchlist' : 'Add to watchlist'}</button>
    <button class="${st === 'watched' ? 'on' : ''}" data-act="watched" data-k="${k}">${st === 'watched' ? 'Watched' : 'Mark as watched'}</button>
    <a class="btn ghost abtn" href="${stremio}">Watch in Stremio</a>
    ${st === 'watched' ? `<span class="qrate">${RATES.map(([v, em, n]) => `<button class="${e.my === v ? 'on' : ''}" data-rate="${v}" data-k="${k}" title="${n}">${em}</button>`).join('')}</span>` : ''}`;
};

export async function openQuick(type, id) {
  closeQuick(true);
  const tok = ++TOK, el = document.createElement('div'); el.id = 'qv'; el.className = 'modal qvm';
  el.innerHTML = `<div class="qv" role="dialog" aria-modal="true" aria-label="Quick view"><button class="qx" data-qclose aria-label="Close">✕</button><div class="qv-load"><div class="spin"></div></div></div>`;
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-qclose]')) closeQuick(); });
  document.body.appendChild(el); document.body.classList.add('noscroll');
  let d; try { d = await api(`/${type}/${id}`, PARAMS); } catch { if (tok === TOK) { $('.qv', el).innerHTML = `<button class="qx" data-qclose>✕</button><p class="empty">Couldn't load this title. Check your connection and try again.</p>`; } return; }
  if (tok !== TOK) return;
  const it = norm(d, type), k = key(it), box = $('.qv', el);
  const vids = (d.videos?.results || []).filter(v => v.site === 'YouTube');
  const tr = vids.find(v => v.type === 'Trailer' && v.official) || vids.find(v => v.type === 'Trailer') || vids.find(v => v.type === 'Teaser') || vids[0];
  const prov = d['watch/providers']?.results?.[S.cfg.region], mine = new Set(S.cfg.providers);
  const row = (label, arr) => arr?.length ? `<div class="wrow"><span class="wl-l">${label}</span><div class="wl-p">${arr.map(p => `<a class="${mine.has(p.provider_id) ? 'mine' : ''}" target="_blank" rel="noopener" href="${esc(prov.link || '#')}" title="Open availability for ${esc(p.provider_name)}"><img src="${IMG}w92${p.logo_path}" alt=""><span>${esc(p.provider_name)}</span></a>`).join('')}</div></div>` : '';
  const dirs = type === 'movie' ? (d.credits?.crew || []).filter(c => c.job === 'Director') : (d.created_by || []);
  const rt = type === 'movie' ? (d.runtime ? Math.floor(d.runtime / 60) + 'h ' + d.runtime % 60 + 'm' : '') : (d.number_of_seasons ? `${d.number_of_seasons} season${d.number_of_seasons > 1 ? 's' : ''}` : '');
  const im = d.external_ids?.imdb_id, mp = matchPct(it);
  box.innerHTML = `<button class="qx" data-qclose aria-label="Close">✕</button>
    <div class="qv-head" style="background-image:url(${d.backdrop_path ? IMG + 'w1280' + d.backdrop_path : ''})">
      ${tr ? `<iframe id="qvf" title="Trailer" src="https://www.youtube-nocookie.com/embed/${tr.key}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&enablejsapi=1&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&showinfo=0" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="qctl"><button class="qmute" id="qtheater" aria-label="Open theater mode">⛶ Theater</button><button class="qmute" id="qplay" aria-label="Pause">❚❚ Pause</button><button class="qmute" id="qmute" aria-label="Unmute">Sound off</button></div>` : ''}
      <div class="qv-fade"></div><h2 class="qv-t">${esc(it.title)}</h2></div>
    <div class="qv-body">
      <div class="qv-meta">${d.vote_average ? `<span class="star">★ ${d.vote_average.toFixed(1)}</span>` : ''}${mp != null ? `<span class="match" title="Based on the genres you rate highly">${mp}% match</span>` : ''}<span>${esc(it.year || '')}</span>${rt ? `<span>${rt}</span>` : ''}${(d.genres || []).slice(0, 3).map(g => `<span>${esc(g.name)}</span>`).join('')}</div>
      <p class="qv-o">${esc(d.overview || 'No synopsis available.')}</p>
      ${dirs.length ? `<p class="sub">${type === 'movie' ? 'Director' : 'Created by'}: ${dirs.slice(0, 2).map(p => `<a data-person="${p.id}" data-qclose class="ul">${esc(p.name)}</a>`).join(', ')}</p>` : ''}
      <div class="qv-acts" id="qvActs">${actions(k, type, id, im, it.title)}</div><div id="qvTrk"></div>
      <h3>Where to watch <span class="sub">(${esc(S.cfg.region)})</span></h3>
      ${prov && (prov.flatrate || prov.free || prov.rent || prov.buy) ? `<div class="wmat">${row('Stream', prov.flatrate)}${row('Free', prov.free)}${row('Rent', prov.rent)}${row('Buy', prov.buy)}</div>${mine.size ? '<p class="sub small">Green outline: one of your services.</p>' : ''}` : '<p class="sub">No streaming info for your region.</p>'}
      <div id="qvFull" class="qv-full"><div class="spin"></div></div>
    </div>`;
  const body = $('.qv', el); body.scrollTop = 0;
  // The popup grows to full screen once you scroll down and settles back near the top. It changes size once, smoothly, so scrolling itself never fights the layout.
  let big = false;
  body.addEventListener('scroll', () => { const t = body.scrollTop; if (!big && t > 240) { big = true; el.classList.add('big'); } else if (big && t < 140) { big = false; el.classList.remove('big'); } }, { passive: true });
  const paintTrk = () => {
    const slot = $('#qvTrk', el); if (!slot) return; const e = S.lib[k], st = e?.status;
    const show = type === 'tv' && st !== 'watched' && st !== 'hidden' || st === 'watching';
    slot.innerHTML = show ? `<div class="trks one">${trkHtml(st === 'watching' ? e : { ...it, prog: e?.prog || { s: 1, e: 0 } }, st !== 'watching')}</div>` : ''; if (show) enrichTrk(slot);
  };
  paintTrk();
  // Sound on/off for the trailer, via YouTube's iframe messages.
  const mb = $('#qmute', el), fr = $('#qvf', el);
  if (mb && fr) {
    let muted = true;
    const cmd = (func, args = []) => fr.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    // Loop without a playlist (a playlist is what makes YouTube draw previous/next buttons).
    // YouTube paints its own play/pause icon over the picture while a video starts, pauses or buffers. The picture is only shown while it is really playing.
    let curT = 0, playing = false, wasShown = false, hideT = 0;
    const show = on => fr.classList.toggle('ready', on);
    const fallback = setTimeout(() => { if (!wasShown) { wasShown = true; show(true); } }, 5000);
    const pb = $('#qplay', el); let paused = false;
    const hear = e => {
      if (!fr.isConnected) { clearTimeout(fallback); return removeEventListener('message', hear); }
      if (e.source !== fr.contentWindow) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data, i = d?.info; if (!i) return;
        if (typeof i.currentTime === 'number') curT = i.currentTime;
        const st = i.playerState; if (st === undefined) return;
        if (st === 1) { playing = true; clearTimeout(hideT); setTimeout(() => { if (playing && !paused) { wasShown = true; show(true); } }, wasShown ? 350 : 2600); }
        else { playing = false; if (st === 0) { cmd('seekTo', [0, true]); cmd('playVideo'); } if (wasShown) { clearTimeout(hideT); hideT = setTimeout(() => { if (!playing) show(false); }, 120); } }
      } catch {}
    };
    $('#qtheater', el)?.addEventListener('click', e => {
      e.stopPropagation(); cmd('mute');
      openTheater({ key: fr.src.match(/embed\/([\w-]+)/)?.[1], title: it.title, start: curT, onClose: t => { cmd('seekTo', [t, true]); if (!muted) cmd('unMute'); } });
    });
    if (pb) pb.addEventListener('click', e => { e.stopPropagation(); paused = !paused; cmd(paused ? 'pauseVideo' : 'playVideo'); if (paused) show(false); pb.textContent = paused ? '▶ Play' : '❚❚ Pause'; pb.setAttribute('aria-label', paused ? 'Play' : 'Pause'); });
    addEventListener('message', hear);
    const listen = () => fr.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
    fr.addEventListener('load', listen); setTimeout(listen, 1200);
    mb.addEventListener('click', e => {
      e.stopPropagation(); muted = !muted;
      if (muted) cmd('mute'); else { cmd('unMute'); cmd('setVolume', [100]); cmd('playVideo'); }
      mb.textContent = muted ? 'Sound off' : 'Sound on'; mb.setAttribute('aria-label', muted ? 'Unmute' : 'Mute'); mb.classList.toggle('on', !muted);
    });
  }
  // everything from the full details page lives right here, below the trailer, so there is nothing else to open
  import('../pages/title.js').then(m => { if (tok !== TOK) return; const f = $('#qvFull', el); if (f) m.pageTitle(f, 0, type, id, true).catch(() => { f.innerHTML = ''; }); });
  // keep the buttons in step with the library after a click
  body.addEventListener('click', e => {
        const q = e.target.closest('[data-qv]'); if (q) { const [t, i] = q.dataset.qv.split(':'); openQuick(t, i); return; }
    if (e.target.closest('[data-act],[data-rate]')) setTimeout(() => { const a = $('#qvActs'); if (a) a.innerHTML = actions(k, type, id, im, it.title); paintTrk(); }, 30);
    if (e.target.closest('[data-person],[data-genre],[data-settings],a[href^="#/"]')) setTimeout(closeQuick, 0);
  });
}

// warm the cache while the pointer rests on a poster, so the popup opens instantly
let HT = 0, HK = '';
document.addEventListener('mouseover', e => {
  const c = e.target.closest?.('.card[data-open]'); if (!c || c.dataset.open === HK) return;
  clearTimeout(HT); HK = c.dataset.open; const [t, i] = HK.split(':');
  HT = setTimeout(() => { if (i) api(`/${t}/${i}`, PARAMS).catch(() => {}); }, 280);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#qv')) closeQuick(); });
window.addEventListener('hashchange', closeQuick);
