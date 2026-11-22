import { IMG, RATES, STATUS_LABEL } from '../core/config.js';
import { put, toast, toggle } from '../core/library.js';
import { GN, ITEMS, S } from '../core/state.js';
import { $, $$, esc, key, rand } from '../core/utils.js';
import { closeModal, modal } from './settings.js';
import { motion } from './motion.js';

const vibe = s => { s = String(s || '').replace(/\s+/g, ' ').trim(); if (!s) return ''; const m = s.match(/^.{24,120}?[.!?](\s|$)/); return m ? m[0].trim() : s.length > 110 ? s.slice(0, 105).replace(/\s+\S*$/, '') + '…' : s; };
const hov = it => { const gs = (it.genres || []).slice(0, 2).map(g => GN[g]).filter(Boolean), v = vibe(it.overview);
  return `<div class="hov"><b>${esc(it.title)}</b><span>${esc(it.year || '')}${it.type === 'tv' ? ' · TV' : ''}</span>${gs.length ? `<div class="gp">${gs.map(g => `<i>${esc(g)}</i>`).join('')}</div>` : ''}${v ? `<p>${esc(v)}</p>` : ''}</div>`; };
export function card(it, i = 0) {
  const an = i < 0 ? ' static' : '', stl = i < 0 ? '' : ` style="--i:${Math.min(i, 24)}"`;
  if (it.type === 'person') return `<div class="card person${an}"${stl} data-person="${it.id}"><div class="poster">${it.poster ? `<img loading="lazy" src="${IMG}w185${it.poster}" alt="">` : '<div class="noimg">No photo</div>'}</div><div class="ct">${esc(it.title)}</div><div class="cs">${esc(it.sub || '')}</div></div>`;
  const k = key(it), st = S.lib[k]?.status, my = S.lib[k]?.my;
  const emoji = my ? RATES.find(r => r[0] === my)?.[1] || '' : '';
  return `<div class="card${an}"${stl} data-open="${k}"><div class="poster">${it.poster ? `<img loading="lazy" decoding="async" src="${IMG}w342${it.poster}" srcset="${IMG}w185${it.poster} 185w, ${IMG}w342${it.poster} 342w, ${IMG}w500${it.poster} 500w" sizes="(max-width:760px) 44vw, 180px" alt="">` : `<div class="noimg">${esc(it.title)}</div>`}
    ${it.rating ? `<span class="rate">★ ${(+it.rating).toFixed(1)}</span>` : ''}${st ? `<span class="badge ${st}">${STATUS_LABEL[st]}</span>` : ''}
    ${hov(it)}<div class="quick"><button data-act="watchlist" data-k="${k}" title="Watchlist">＋</button><button data-act="watched" data-k="${k}" title="Watched">✓</button><button data-act="hidden" data-k="${k}" title="Not interested">✕</button></div></div>
    <div class="ct" title="${esc(it.title)}">${esc(it.title)}</div><div class="cs">${esc(it.year)}${it.sub ? ' · ' + esc(it.sub) : ''}</div>${it.why ? `<div class="why">${esc(it.why)}</div>` : ''}</div>`;
}

export const skel = (n = 14) => Array.from({ length: n }, (_, i) => `<div class="card sk" style="--i:${i}"><div class="poster"></div><div class="ct">&nbsp;</div><div class="cs">&nbsp;</div></div>`).join('');

export const ring = v => { const p = Math.round((+v || 0) * 10); return `<svg class="ring" viewBox="0 0 44 44" role="img" aria-label="Rating ${(+v || 0).toFixed(1)} out of 10"><circle class="bg" cx="22" cy="22" r="19"/><circle class="fg" cx="22" cy="22" r="19" style="--p:${p}"/><text x="22" y="26.5" text-anchor="middle">${(+v || 0).toFixed(1)}</text></svg>`; };


export let SPOT = null;

export function spotlight(el, items) {
  clearInterval(SPOT);
  items = (items || []).filter(i => i.backdrop && i.type !== 'person').slice(0, 6);
  if (!el) return;
  if (!items.length) { el.innerHTML = ''; return; }
  let cur = 0, paused = false;
  const slide = (it, i) => { const k = key(it), g = it.genres.slice(0, 2).map(x => GN[x]).filter(Boolean).join(', ');
    return `<article class="slide ${i ? '' : 'on'}" aria-hidden="${i ? 'true' : 'false'}" style="--img:url(${IMG}w1280${it.backdrop})"><div class="sc">
      <p class="kicker">${it.type === 'movie' ? 'Movie' : 'TV series'}${it.why ? ' · ' + esc(it.why) : ''}</p><h2 title="${esc(it.title)}">${esc(it.title)}</h2>
      <p class="smeta"><span>★ ${(+it.rating).toFixed(1)}</span><span>${esc(it.year)}</span>${g ? `<span>${esc(g)}</span>` : ''}</p>
      <p class="blurb">${esc(it.overview)}</p>
      <div class="acts"><button class="primary" data-open="${k}">See details</button>${heroBtns(k, it.type)}</div></div></article>`; };
  el.innerHTML = `<section class="spot" aria-roledescription="carousel" aria-label="Featured">${items.map(slide).join('')}
    <div class="hctl"><button class="harrow" data-hero="-1" aria-label="Previous">‹</button>
      <div class="dots">${items.map((_, i) => `<button class="dot ${i ? '' : 'on'}" data-hero-to="${i}" aria-label="Show ${i + 1} of ${items.length}"><i></i></button>`).join('')}</div>
      <button class="harrow" data-hero="1" aria-label="Next">›</button></div></section>`;
  const sec = $('.spot', el), slides = $$('.slide', sec), dots = $$('.dot', sec);
  const go = n => {
    cur = (n + items.length) % items.length;
    slides.forEach((s, i) => { s.classList.toggle('on', i === cur); s.setAttribute('aria-hidden', i === cur ? 'false' : 'true'); });
    dots.forEach((d, i) => { d.classList.remove('on'); if (i === cur) { void d.offsetWidth; d.classList.add('on'); } });
    clearInterval(SPOT); SPOT = setInterval(tick, 7000);
  };
  const tick = () => { if (!document.body.contains(sec)) return clearInterval(SPOT); if (!paused && !document.hidden && motion() !== "off") go(cur + 1); };
  sec.addEventListener('click', e => {
    const a = e.target.closest('[data-hero]'), d = e.target.closest('[data-hero-to]');
    if (a) { e.stopPropagation(); go(cur + +a.dataset.hero); } else if (d) { e.stopPropagation(); go(+d.dataset.heroTo); }
  });
  let x0 = null;
  sec.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; paused = true; }, { passive: true });
  sec.addEventListener('touchend', e => { paused = false; if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45) go(cur + (dx < 0 ? 1 : -1)); });
  SPOT = setInterval(tick, 7000);
  // A title you mark watched (or hide) leaves the slideshow and the next one slides in.
  const seen = it => ['watched', 'hidden'].includes(S.lib[key(it)]?.status);
  const prune = () => {
    if (!sec.isConnected) return document.removeEventListener('wn:lib', prune);
    const rm = items.map((it, i) => (seen(it) ? i : -1)).filter(i => i >= 0); if (!rm.length) return;
    let ni = -1; for (let o = 0; o < items.length; o++) { const j = (cur + o) % items.length; if (!seen(items[j])) { ni = j; break; } }
    if (ni < 0) { clearInterval(SPOT); el.innerHTML = ''; return document.removeEventListener('wn:lib', prune); }
    const keep = slides[ni], deadS = rm.map(i => slides[i]), deadD = rm.map(i => dots[i]);
    slides.forEach(sl => sl.classList.toggle('on', sl === keep));
    [...rm].reverse().forEach(i => { items.splice(i, 1); slides.splice(i, 1); dots.splice(i, 1); });
    deadD.forEach(d => d.remove()); setTimeout(() => deadS.forEach(sl => sl.remove()), 700);
    dots.forEach((d, i) => { d.dataset.heroTo = i; d.setAttribute('aria-label', `Show ${i + 1} of ${items.length}`); });
    go(slides.indexOf(keep));
  };
  document.addEventListener('wn:lib', prune);
}

export function accentFrom(path, m) {
  if (!path) return;
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const c = document.createElement('canvas'), w = c.width = 24, h = c.height = 36, x = c.getContext('2d');
      x.drawImage(img, 0, 0, w, h); const px = x.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < px.length; i += 4) {
        const R = px[i], G = px[i + 1], B = px[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = mx ? (mx - mn) / mx : 0, lum = (R + G + B) / 3;
        if (sat > .35 && lum > 60 && lum < 225) { const wt = sat * sat; r += R * wt; g += G * wt; b += B * wt; n += wt; }
      }
      if (!n) return;
      let col = [r / n, g / n, b / n].map(v => Math.round(v)); const mxv = Math.max(...col);
      if (mxv < 200) col = col.map(v => Math.min(255, Math.round(v * 200 / mxv)));
      m.style.setProperty('--acr', col.join(',')); m.style.setProperty('--ac', `rgb(${col.join(',')})`);
    } catch {}
  };
  img.src = IMG + 'w92' + path;
}

/** A small pop of emoji from a button, for feedback moments. Skipped when motion is reduced. */
export function burst(el, glyphs = ['✨'], n = 14) {
  const mo = motion(); if (mo === 'off') return; if (mo === 'lite') n = Math.ceil(n / 2);
  if (!el || typeof Element.prototype.animate !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const wrap = document.createElement('div'); wrap.setAttribute('aria-hidden', 'true'); wrap.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:400;pointer-events:none';
  document.body.appendChild(wrap);
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span'); p.textContent = glyphs[i % glyphs.length];
    p.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;font-size:${13 + Math.random() * 11}px;line-height:1;will-change:transform,opacity`;
    wrap.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = 46 + Math.random() * 74, dx = Math.cos(a) * d, dy = Math.sin(a) * d - 34, rot = Math.random() * 120 - 60;
    p.animate([
      { transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1) rotate(${rot}deg)`, opacity: 1, offset: .55 },
      { transform: `translate(calc(-50% + ${dx * 1.12}px),calc(-50% + ${dy + 46}px)) scale(.7) rotate(${rot * 1.5}deg)`, opacity: 0 },
    ], { duration: 760 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
  }
  setTimeout(() => wrap.remove(), 1200);
}

export function roulette(items, o = {}) {
  items = items.filter(i => i.poster); if (!items.length) return;
  const win = o.win || items[rand(items.length)], total = 14 + rand(5);
  const m = modal(`<div class="box roul"><div class="rp"><img id="rimg" alt=""></div><h3 id="rt">Picking…</h3><p class="sub" id="rw"></p><div id="rb" class="rbtn"></div></div>`);
  const img = $('#rimg', m), t = $('#rt', m);
  let delay = 55, n = 0;
  const tick = () => {
    const it = n >= total ? win : items[rand(items.length)];
    img.src = it.poster ? IMG + 'w342' + it.poster : ''; t.textContent = it.title;
    img.classList.remove('flip'); void img.offsetWidth; img.classList.add('flip');
    if (n++ < total) { delay *= 1.1; setTimeout(tick, delay); return; }
    $('.rp', m).classList.add('win'); t.textContent = `${win.title}${win.year ? ' (' + win.year + ')' : ''}`;
    if (o.why) $('#rw', m).textContent = o.why;
    $('#rb', m).innerHTML = `<button class="primary" data-go>See details</button><button data-wl>Add to watchlist</button><button data-seen>Already seen</button><button data-spin>${o.again ? 'Suggest another' : 'Pick again'}</button>`;
    burst(img, ['🎬', '🍿', '✨', '⭐']);
    const again = () => { closeModal(); o.again ? o.again() : roulette(items); };
    $('[data-go]', m).onclick = () => { closeModal(); location.hash = `#/t/${win.type}/${win.id}`; };
    $('[data-wl]', m).onclick = () => { ITEMS.set(key(win), ITEMS.get(key(win)) || win); put(key(win), 'watchlist'); toast(`Added <b>${esc(win.title)}</b> to your watchlist`, 1800); };
    $('[data-seen]', m).onclick = () => { ITEMS.set(key(win), ITEMS.get(key(win)) || win); put(key(win), 'watched'); again(); };
    $('[data-spin]', m).onclick = again;
  };
  tick();
}

export let CUR_IO = null;

export function mountGrid(el, fetcher, { start = 1, filter = true, first = null } = {}) {
  el.innerHTML = '<div class="grid">' + (first ? first.map((x, i) => card(x, i)).join('') : skel(14)) + '</div><div class="sentinel"></div>';
  const g = $('.grid', el), s = $('.sentinel', el);
  let page = start - 1, busy = false, done = false, total = 0, tries = 0, cleared = !!first;
  async function more() {
    if (busy || done) return; busy = true;
    try {
      let added = 0, guard = 0;
      while (added < 14 && !done && guard++ < 4) {
        page++;
        const r = await fetcher(page);
        let list = r.results || [];
        if (!list.length && page > 1 && total === 0 && start > 1 && !tries++) { page = 0; continue; }
        if (filter && S.cfg.hideSeen) list = list.filter(x => x.type === 'person' || !['watched', 'hidden'].includes(S.lib[key(x)]?.status));
        if (page >= (r.total_pages || 1) || !(r.results || []).length) done = true;
        if (!cleared) { $$('.sk', g).forEach(x => x.remove()); cleared = true; }
        g.insertAdjacentHTML('beforeend', list.map((x, i) => card(x, i)).join('')); added += list.length; total += list.length;
      }
      if (!cleared) { $$('.sk', g).forEach(x => x.remove()); cleared = true; }
      s.innerHTML = total ? '' : '<div class="empty">Nothing matches these filters. Remove a genre or switch the language to widen the search.</div>';
    } catch (e) { $$('.sk', g).forEach(x => x.remove()); s.innerHTML = errHtml(e); done = true; }
    busy = false;
    if (!done && CUR_IO) { CUR_IO.disconnect(); CUR_IO.observe(s); }
  }
  CUR_IO?.disconnect();
  CUR_IO = new IntersectionObserver(es => { if (es[0].isIntersecting) more(); }, { rootMargin: '700px' });
  CUR_IO.observe(s); more();
}

export function errHtml(e) {
  if (e.status === 401) return `<div class="err">TMDB rejected your API key. Open <a href="#" data-settings style="color:var(--ac2)">Settings</a> and check it.</div>`;
  return `<div class="err">${esc(e.message)}. Check your internet connection and try again.</div>`;
}

/* ---------- swimlanes ---------- */
const HERO_LBL = { watchlist: ['Add to watchlist', 'On watchlist'], watched: ['Mark as watched', 'Watched'] };
export const heroBtns = (k, type) => ['watchlist', ...(type === 'movie' ? ['watched'] : [])].map(a => { const on = S.lib[k]?.status === a; return `<button class="${on ? 'on' : ''}" data-act="${a}" data-k="${k}">${HERO_LBL[a][on ? 1 : 0]}</button>`; }).join('');
export const laneShell = (id, title, href) => `<section class="lane" id="lane-${id}"><div class="shead"><h2>${esc(title)}</h2><button class="refresh" data-refresh="${id}" title="Show different picks" aria-label="Refresh ${esc(title)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/></svg></button><button class="more" data-row="${id}" aria-label="See all in ${esc(title)}">See all <span aria-hidden="true">›</span></button></div><div class="lrail"><button class="arr l" data-arrow="-1" aria-label="Scroll left">‹</button><div class="track">${skel(8).replace(/class="card sk"/g, 'class="card sk static"')}</div><button class="arr r" data-arrow="1" aria-label="Scroll right">›</button></div></section>`;
export function fillLane(id, items, { rank = false, more = null } = {}) {
  const el = document.querySelector(`#lane-${id}`); if (!el) return;
  items = (items || []).filter(x => x.poster);
  if (!items.length) { el.remove(); return; }
  const track = el.querySelector('.track');
  track.innerHTML = items.slice(0, rank ? 10 : 20).map((x, i) => rank ? `<div class="rk"><i aria-hidden="true">${i + 1}</i>${card(x, -1)}</div>` : card(x, -1)).join('');
  // Endless row: keep fetching the next page as you scroll toward the end.
  if (more && !rank) {
    track._ac?.abort(); const ac = track._ac = new AbortController(), sig = { signal: ac.signal };
    let page = 1, busy = false, dry = 0;
    const have = new Set(items.slice(0, 20).map(key));
    const next = async () => {
      if (busy || dry >= 2 || !track.isConnected) return; busy = true;
      try {
        const r = await more(++page), fresh = (r.results || []).filter(x => x.poster && !have.has(key(x)));
        fresh.forEach(x => have.add(key(x)));
        if (fresh.length) { track.insertAdjacentHTML('beforeend', fresh.map(x => card(x, -1)).join('')); dry = 0; } else dry++;
        if (page >= (r.total_pages || 9999)) dry = 2;
      } catch { dry++; }
      busy = false;
      if (dry < 2 && track.scrollWidth - track.scrollLeft - track.clientWidth < 500) next();
    };
    track.addEventListener('scroll', () => { if (track.scrollWidth - track.scrollLeft - track.clientWidth < 500) next(); }, { passive: true, ...sig });
    document.addEventListener('click', e => { if (e.target.closest(`#lane-${id} [data-arrow]`)) setTimeout(() => { if (track.scrollWidth - track.scrollLeft - track.clientWidth < 500) next(); }, 450); }, sig);
  }
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-arrow]'); if (!a) return;
  const t = a.parentElement.querySelector('.track'); t.scrollBy({ left: +a.dataset.arrow * t.clientWidth * .85, behavior: 'smooth' });
});

/* A four-card editorial grid: one big card and three smaller ones. */
export function bento(slots) {
  const ok = slots.filter(s => s.it && (s.it.backdrop || s.it.poster));
  if (ok.length < 3) return '';
  return `<section class="shelf"><div class="shead"><h2>Editorial picks</h2></div><div class="bento">${ok.slice(0, 4).map((s, i) => { const it = s.it, k = key(it);
    return `<a class="bt b${i}" href="#/t/${it.type}/${it.id}" style="--img:url(${IMG}${i ? 'w780' : 'w1280'}${it.backdrop || it.poster})"><div class="bi"><span class="tag">${esc(s.tag)}</span><b>${esc(it.title)}</b><p>${esc(s.line || it.overview)}</p></div></a>`; }).join('')}</div></section>`;
}
