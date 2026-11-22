import { GN, S } from '../core/state.js';
import { $, esc } from '../core/utils.js';
import { countUp } from './dna.js';

const MIN = { movie: 112, ep: 45 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Everything on the stats page is computed from the library, so it is testable without the DOM. */
export function computeStats(lib, now = Date.now()) {
  const all = Object.values(lib), watched = all.filter(e => e.status === 'watched');
  const rated = watched.filter(e => e.my), avg = rated.length ? rated.reduce((a, e) => a + e.my, 0) / rated.length : 0;
  const g = {}, dec = {}, mon = Array(12).fill(0), days = new Set();
  for (const e of watched) {
    for (const id of e.genres || []) g[id] = (g[id] || 0) + 1;
    const d = Math.floor(+e.year / 10) * 10; if (d) dec[d] = (dec[d] || 0) + 1;
    mon[new Date(e.ts).getMonth()]++; days.add(new Date(e.ts).toDateString());
  }
  let streak = 0; for (let t = now; days.has(new Date(t).toDateString()); t -= 864e5) streak++;
  const movies = watched.filter(e => e.type === 'movie').length, shows = watched.length - movies;
  const hours = Math.round((movies * MIN.movie + all.filter(e => e.type === 'tv' && e.status === 'watching').length * MIN.ep * 4 + shows * MIN.ep * 8) / 60);
  return {
    total: watched.length, movies, shows, hours, avg, streak, mon,
    genres: Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => ({ n: GN[id] || id, v: n })),
    decades: Object.entries(dec).sort((a, b) => a[0] - b[0]).map(([d, v]) => ({ d, v })),
    best: rated.sort((a, b) => b.my - a.my || b.ts - a.ts).slice(0, 3),
    busiest: mon.indexOf(Math.max(...mon)),
  };
}

/** A 1080x1350 share image drawn on canvas. */
export function shareCard(st, name = 'My year', rgb = S.cfg.accent || '255,176,64') {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d'); if (!x) return null;
  const g = x.createLinearGradient(0, 0, 1080, 1350); g.addColorStop(0, '#1b1230'); g.addColorStop(1, '#0c0814'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
  const r = x.createRadialGradient(900, 160, 10, 900, 160, 700); r.addColorStop(0, `rgba(${rgb},.55)`); r.addColorStop(1, 'transparent'); x.fillStyle = r; x.fillRect(0, 0, 1080, 1350);
  x.fillStyle = '#f3eef9'; x.font = '700 64px system-ui,sans-serif'; x.fillText("What's Next", 80, 130);
  x.fillStyle = '#9d93b3'; x.font = '36px system-ui,sans-serif'; x.fillText(name, 80, 190);
  x.fillStyle = `rgb(${rgb})`; x.font = '800 260px system-ui,sans-serif'; x.fillText(String(st.total), 70, 520);
  x.fillStyle = '#f3eef9'; x.font = '44px system-ui,sans-serif'; x.fillText('titles watched', 80, 590);
  x.fillStyle = '#9d93b3'; x.font = '34px system-ui,sans-serif'; x.fillText(`${st.movies} films · ${st.shows} shows · about ${st.hours} hours`, 80, 650);
  x.fillStyle = '#f3eef9'; x.font = '600 40px system-ui,sans-serif'; x.fillText('Top genres', 80, 760);
  const mx = Math.max(1, ...st.genres.map(q => q.v));
  st.genres.slice(0, 5).forEach((q, i) => { const y = 810 + i * 80; x.fillStyle = '#9d93b3'; x.font = '30px system-ui,sans-serif'; x.fillText(q.n, 80, y + 34);
    x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(360, y, 640, 44); x.fillStyle = `rgb(${rgb})`; x.fillRect(360, y, 640 * q.v / mx, 44); });
  x.fillStyle = '#9d93b3'; x.font = '30px system-ui,sans-serif'; x.fillText(st.avg ? `Average rating ${st.avg.toFixed(1)} / 10` : '', 80, 1280);
  return c;
}

export async function pageWrapped(m) {
  const st = computeStats(S.lib);
  if (!st.total) { m.innerHTML = '<div class="page-head"><h1>Your stats</h1></div><p class="mut empty">Mark a few titles as watched and your stats appear here.</p>'; return; }
  const mx = Math.max(1, ...st.genres.map(q => q.v)), mm = Math.max(1, ...st.mon);
  m.innerHTML = `<div class="page-head"><h1>Your stats</h1><p class="mut">Hours are estimates: 112 minutes a film, 45 an episode.</p></div>
    <div class="stat-row">
      <div class="stat"><b data-count="${st.total}">0</b><span>watched</span></div>
      <div class="stat"><b data-count="${st.hours}">0</b><span>hours, roughly</span></div>
      <div class="stat"><b data-count="${st.avg.toFixed(1)}" data-dec="1">0</b><span>average rating</span></div>
      <div class="stat"><b data-count="${st.streak}">0</b><span>day streak</span></div>
    </div>
    <div class="panel"><h3>Genres you watch most</h3>${st.genres.map(q => `<div class="bar-r"><span>${esc(q.n)}</span><div><i style="width:${q.v / mx * 100}%"></i></div><em>${q.v}</em></div>`).join('')}</div>
    <div class="panel"><h3>Busiest months</h3><div class="mon">${st.mon.map((v, i) => `<div title="${MONTHS[i]}: ${v}"><i style="height:${v / mm * 100}%"></i><span>${MONTHS[i]}</span></div>`).join('')}</div></div>
    ${st.best.length ? `<div class="panel"><h3>Your top rated</h3><p>${st.best.map(e => esc(e.title)).join(', ')}</p></div>` : ''}
    <div class="filters"><button id="shareDl" class="primary">Download share card</button></div>`;
  countUp(m);
  $('#shareDl').onclick = () => { const c = shareCard(st, 'My watching so far'); if (!c) return; const a = document.createElement('a'); a.download = 'whats-next-stats.png'; a.href = c.toDataURL('image/png'); a.click(); };
}
