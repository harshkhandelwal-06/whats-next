import { ai } from '../core/ai.js';
import { api, norm } from '../core/api.js';
import { IMG, LANGS, RATES } from '../core/config.js';
import { S, save } from '../core/state.js';
import { $, $$, esc, key } from '../core/utils.js';
import { enrichTrk, trkHtml } from '../features/tracker.js';
import { RT } from '../router.js';
import { accentFrom, card, ring } from '../ui/components.js';

export let CUR = null;

export const clean = s => String(s || '').replace(/\r?\n+/g, ' ').replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();

export function snip(s, n) { s = clean(s); if (s.length <= n) return s; const cut = s.slice(0, n), i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? ')); return i > n * .5 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, '') + '…'; }

export const QA_IDEAS = ['Is it scary or intense?', 'How is the pacing?', 'Is it okay for kids?', 'What should I know before watching?', 'Is it worth my time?'];

export async function pageTitle(m, tok, type, id, embed = false) {
  const d = await api(`/${type}/${id}`, { append_to_response: 'credits,videos,watch/providers,recommendations,similar,external_ids,reviews', include_video_language: 'en,null' });
  if (!embed && tok !== RT) return;
  const it = norm(d, type); if (!embed) CUR = { it, d };
  const vids = (d.videos?.results || []).filter(v => v.site === 'YouTube');
  const trailer = vids.find(v => v.type === 'Trailer' && v.official) || vids.find(v => v.type === 'Trailer') || vids.find(v => v.type === 'Teaser') || vids[0];
  const prov = d['watch/providers']?.results?.[S.cfg.region], mine = new Set(S.cfg.providers);
  const pr = (label, arr) => arr?.length ? `<div class="prov"><span class="lbl">${label}</span>${arr.map(p => `<span class="${mine.has(p.provider_id) ? 'mine' : ''}" title="${esc(p.provider_name)}"><img src="${IMG}w92${p.logo_path}" alt="${esc(p.provider_name)}"></span>`).join('')}</div>` : '';
  const dirs = type === 'movie' ? (d.credits?.crew || []).filter(c => c.job === 'Director') : (d.created_by || []);
  const cast = (d.credits?.cast || []).slice(0, 24);
  const seen = new Set(), more = [...(d.recommendations?.results || []), ...(d.similar?.results || [])].filter(x => { const dt = x.release_date || x.first_air_date; return (!dt || dt <= new Date().toISOString().slice(0, 10)) && !seen.has(x.id) && seen.add(x.id); }).slice(0, 24).map(x => norm(x, type));
  const runtime = type === 'movie' ? (d.runtime ? Math.floor(d.runtime / 60) + 'h ' + d.runtime % 60 + 'm' : '') : (d.number_of_seasons ? `${d.number_of_seasons} season${d.number_of_seasons > 1 ? 's' : ''} · ${d.number_of_episodes} eps` : '');
  const rid = 'rv' + d.id + (embed ? 'q' : ''), imdb = d.external_ids?.imdb_id, revs = REVS[rid] = (d.reviews?.results || []).filter(r => clean(r.content).length > 40);
  const word = type === 'movie' ? 'movie' : 'show';
  let html = `<div class="hero"><div class="hbg"><div class="kb" style="background-image:url(${d.backdrop_path ? IMG + 'w1280' + d.backdrop_path : ''})"></div></div><div class="dt">
    ${d.poster_path ? `<img class="pimg tilt" src="${IMG}w500${d.poster_path}" alt="">` : ''}
    <div class="tx"><h1>${esc(it.title)} <span class="sub">${esc(it.year ? '(' + it.year + ')' : '')}</span></h1>
    ${d.tagline ? `<div class="tag">${esc(d.tagline)}</div>` : ''}
    <div class="meta"><span class="rg">${ring(d.vote_average)}<small>${(d.vote_count || 0).toLocaleString()} votes</small></span>${runtime ? `<span>${runtime}</span>` : ''}${d.status ? `<span>${esc(d.status)}</span>` : ''}${d.original_language ? `<span>${esc((LANGS.find(l => l[0] === d.original_language) || [0, d.original_language.toUpperCase()])[1])}</span>` : ''}<span id="crit" class="crit"></span></div>
    <div class="chips" style="flex-wrap:wrap">${(d.genres || []).map(g => `<button class="chip" data-genre="${g.id}">${esc(g.name)}</button>`).join('')}</div>
    <p style="margin:14px 0;max-width:760px">${esc(d.overview || 'No synopsis available.')}</p>
    ${dirs.length ? `<p class="sub">${type === 'movie' ? 'Director' : 'Created by'}: ${dirs.map(p => `<a data-person="${p.id}" style="color:var(--tx);cursor:pointer;text-decoration:underline">${esc(p.name)}</a>`).join(', ')}</p>` : ''}
    <div class="acts" id="acts"></div><div class="rating" id="rating"></div><div id="trkSlot"></div></div></div></div>
  <div class="sec">
    <h2>Where to watch <span class="sub" style="font-size:13px">(${esc(S.cfg.region)})</span></h2>
    ${prov ? pr('Stream', prov.flatrate) + pr('Free', prov.free) + pr('Rent', prov.rent) + pr('Buy', prov.buy) + (prov.link ? `<p class="sub small"><a target="_blank" rel="noopener" href="${esc(prov.link)}" style="text-decoration:underline">Full availability (via JustWatch)</a>${mine.size ? ' · green outline = your services' : ''}</p>` : '') : '<p class="sub">No streaming info for your region.</p>'}
    <h2>What people are saying</h2>
    <div class="sumbox" id="sumBox"></div>
    ${revs.length ? `<div class="revs" id="${rid}">${revCards(revs.slice(0, REV_N))}</div><p class="sub small">Reviews come from TMDB users and can contain spoilers.</p>${revs.length > REV_N ? `<div class="revmore"><button class="btn ghost" data-revs="${rid}">Show other reviews</button><span class="mut" id="${rid}n">1–${REV_N} of ${revs.length}</span></div>` : ''}` : '<p class="sub">No audience reviews yet.</p>'}
    <h2>Ask about this ${word} <span class="sub" style="font-size:13px">No spoilers, promised</span></h2>
    <div class="qa"><div class="chips" style="flex-wrap:wrap">${QA_IDEAS.map(q => `<button class="chip" data-qa>${esc(q)}</button>`).join('')}</div>
      <form id="qaF" class="askbar" style="position:static"><input id="qaI" placeholder="Is it slow? Do I need to see the first one?" autocomplete="off"><button class="primary">Ask</button></form><div id="qaOut"></div></div>
    ${cast.length ? `<h2>Cast</h2><div class="row">${cast.map(p => card({ type: 'person', id: p.id, title: p.name, poster: p.profile_path, sub: p.character })).join('')}</div>` : ''}
    ${type === 'tv' && d.seasons?.length ? `<h2>Seasons</h2><div class="seasons">${d.seasons.filter(s => s.season_number > 0).map(s => `<div><b>${esc(s.name)}</b><br><span class="sub">${esc((s.air_date || '').slice(0, 4))} · ${s.episode_count} episodes${s.vote_average ? ' · ★ ' + s.vote_average.toFixed(1) : ''}</span></div>`).join('')}</div>` : ''}
    ${d.belongs_to_collection ? `<h2>Collection</h2><a href="#/c/${d.belongs_to_collection.id}"><button>${esc(d.belongs_to_collection.name)}</button></a>` : ''}
    ${more.length ? `<h2>More like this</h2><div class="row">${more.map(card).join('')}</div>` : ''}
    <h2>Links</h2><p class="links">${imdb ? `<a target="_blank" rel="noopener" href="https://www.imdb.com/title/${imdb}/">IMDb</a>` : ''}<a target="_blank" rel="noopener" href="https://www.themoviedb.org/${type}/${id}">TMDB</a><a target="_blank" rel="noopener" href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(it.title + ' ' + (type === 'movie' ? 'film' : 'TV series'))}">Wikipedia</a>
    ${trailer ? '' : `<a target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(it.title + ' ' + it.year + ' trailer')}">Find trailer</a>`}</p>
    ${d.production_companies?.length ? `<p class="sub" style="margin-top:10px;font-size:13px">${esc(d.production_companies.slice(0, 4).map(c => c.name).join(' · '))}</p>` : ''}
    <div style="height:50px"></div></div>`;
  // embedded in the quick view: its own header, buttons and where-to-watch are already on screen
  if (embed) html = html.slice(html.indexOf('<div class="sec">')).replace(/<h2>Where to watch[\s\S]*?(?=<h2>What people)/, '');
  m.innerHTML = html;
  if (!embed) { CUR.trailer = trailer; paintActions(); accentFrom(d.poster_path, m); }
  // critic scores (optional OMDb key)
  if (S.cfg.omdbKey && imdb) fetch(`https://www.omdbapi.com/?i=${imdb}&apikey=${encodeURIComponent(S.cfg.omdbKey.trim())}`).then(r => r.json()).then(o => {
    if ((!embed && tok !== RT) || !$('#crit') || o.Response === 'False') return;
    const rt = (o.Ratings || []).find(x => x.Source === 'Rotten Tomatoes')?.Value, mc = (o.Ratings || []).find(x => x.Source === 'Metacritic')?.Value;
    $('#crit').innerHTML = [o.imdbRating && o.imdbRating !== 'N/A' ? `<b>IMDb</b> ${esc(o.imdbRating)}` : '', rt ? `Rotten Tomatoes ${esc(rt)}` : '', mc ? `<b>Metacritic</b> ${esc(mc.split('/')[0])}` : ''].filter(Boolean).map(x => `<span>${x}</span>`).join('');
  }).catch(() => {});
  // short review summary
  const sb = $('#sumBox'), k = key(it);
  const showSum = txt => sb.innerHTML = `<div class="sumtxt">${esc(txt).replace(/\n+/g, '<br>')}</div>`;
  if (S.sum[k]) showSum(S.sum[k]);
  else if (revs.length) {
    if (S.cfg.geminiKey) {
      sb.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
      ai(`Summarise audience reviews of a ${word} in two short lines. Line 1 starts "Loved:" (what people praise). Line 2 starts "Mixed:" (common criticism). Plain language, under 28 words per line. ABSOLUTELY no plot spoilers.`,
        [{ role: 'user', content: `${it.title} (${it.year}). Reviews:\n` + revs.slice(0, 5).map(r => clean(r.content).slice(0, 700)).join('\n---\n') }], { tier: 'fast', max: 700 })
        .then(t => { S.sum[k] = t; save(false); if ((embed || tok === RT) && $('#sumBox')) showSum(t); }).catch(() => { if ($('#sumBox')) sb.innerHTML = ''; });
    } else sb.innerHTML = `<p class="sub small">Add a free Gemini key in Settings to get a two-line summary of these reviews.</p>`;
  }
  // spoiler-free Q&A
  const hist = [], out = $('#qaOut');
  const askQ = async q => {
    q = q.trim(); if (!q) return;
    if (!S.cfg.geminiKey) { out.innerHTML = `<div class="msg b">Add your free Gemini API key in <a href="#" data-settings style="color:var(--ac)">Settings</a> to ask questions about this ${word}.</div>`; return; }
    out.insertAdjacentHTML('afterbegin', `<div class="qa1"><div class="msg u">${esc(q)}</div><div class="msg b" data-ans><span class="typing"><i></i><i></i><i></i></span></div></div>`);
    const slot = $('[data-ans]', out);
    const sys = `You answer questions about "${it.title}" (${it.year}, ${word}) for someone who has NOT seen it. ABSOLUTE RULE: no spoilers. Never reveal plot twists, endings, deaths, betrayals, hidden identities or events beyond the opening setup. If asked for those, say you won't spoil it and instead describe tone, atmosphere and what to expect. Useful topics: content warnings, pacing, tone, themes, who it suits, whether earlier entries are needed. Be concise: at most 3 sentences, plain language. If unsure of a fact, say so.
Known data: overview: ${d.overview || 'n/a'}; genres: ${(d.genres || []).map(g => g.name).join(', ')}; director/creator: ${dirs.map(p => p.name).join(', ') || 'n/a'}; cast: ${cast.slice(0, 6).map(p => p.name).join(', ')}; runtime: ${runtime || 'n/a'}; audience rating: ${(+d.vote_average || 0).toFixed(1)}/10.`;
    hist.push({ role: 'user', content: q });
    try { const a = await ai(sys, hist.slice(-8), { max: 1000 }); hist.push({ role: 'assistant', content: a }); slot.textContent = a; }
    catch (e) { hist.pop(); slot.textContent = e.message; }
  };
  $('#qaF').onsubmit = e => { e.preventDefault(); const v = $('#qaI').value; $('#qaI').value = ''; askQ(v); };
  $$('[data-qa]', m).forEach(b => b.onclick = () => askQ(b.textContent));
}

const REV_N = 4, REVS = {}, REVI = {};
const revCards = list => list.map(r => { const sh = snip(r.content, 230), full = clean(r.content).slice(0, 1400); return `<article class="rev"><div class="rh"><b>${esc(r.author)}</b>${r.author_details?.rating ? `<span class="rr">★ ${r.author_details.rating}/10</span>` : ''}</div><p data-short="${esc(sh)}" data-full="${esc(full)}">${esc(sh)}</p><div class="rf">${full.length > sh.length ? '<button class="lnk" data-more>Read more</button>' : ''}${r.url ? `<a target="_blank" rel="noopener" href="${esc(r.url)}">Full review</a>` : ''}</div></article>`; }).join('');
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-revs]'); if (!b) return;
  const id = b.dataset.revs, all = REVS[id], box = document.getElementById(id); if (!all || !box) return;
  const i = ((REVI[id] || 0) + REV_N) % all.length; REVI[id] = i;
  const part = all.slice(i, i + REV_N); box.innerHTML = revCards(part.length < REV_N ? [...part, ...all.slice(0, REV_N - part.length)] : part);
  const n = document.getElementById(id + 'n'); if (n) n.textContent = `${i + 1}–${Math.min(i + REV_N, all.length)} of ${all.length}`;
  box.animate?.([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
});
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-more]'); if (!b) return;
  const p = b.closest('.rev').querySelector('p'), open = b.dataset.open === '1';
  p.textContent = open ? p.dataset.short : p.dataset.full; b.textContent = open ? 'Read more' : 'Show less'; b.dataset.open = open ? '0' : '1';
});

export function paintActions() {
  if (!CUR || !$('#acts')) return;
  const { it, trailer } = CUR, k = key(it), e = S.lib[k], st = e?.status;
  const im = CUR.d?.external_ids?.imdb_id, kind = it.type === 'tv' ? 'series' : 'movie';
  const stremio = im ? `stremio:///detail/${kind}/${im}/${im}` : `stremio:///search?search=${encodeURIComponent(it.title)}`;
  $('#acts').innerHTML = `${trailer ? '<button class="primary" data-trailer>Watch trailer</button>' : ''}
    <a class="btn ghost abtn" href="${stremio}" title="Opens the Stremio app on this title">Watch in Stremio</a>
    <button class="wl ${st === 'watchlist' ? 'on' : ''}" data-act="watchlist" data-k="${k}">${st === 'watchlist' ? 'On watchlist' : 'Add to watchlist'}</button>
    <button class="${st === 'watched' ? 'on' : ''}" data-act="watched" data-k="${k}">${st === 'watched' ? 'Watched' : 'Mark as watched'}</button>
    <button class="${st === 'hidden' ? 'on' : ''}" data-act="hidden" data-k="${k}">${st === 'hidden' ? 'Hidden' : 'Not interested'}</button>`;
  $('#rating').innerHTML = st === 'watched' ? `<span class="sub">Your rating: </span>` + RATES.map(([v, em, n]) => `<button class="${e.my === v ? 'on' : ''}" data-rate="${v}" data-k="${k}" title="${n}">${em}</button>`).join(' ') : '';
  const slot = $('#trkSlot'), showTrk = st === 'watching' || (it.type === 'tv' && st !== 'watched' && st !== 'hidden');
  slot.innerHTML = showTrk ? `<div class="trks one">${trkHtml(st === 'watching' ? e : { ...it, prog: e?.prog || { s: 1, e: 0 } }, st !== 'watching')}</div>` : ''; if (showTrk) enrichTrk(slot);
}
