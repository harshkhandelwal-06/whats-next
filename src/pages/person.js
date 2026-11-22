import { api, norm } from '../core/api.js';
import { IMG } from '../core/config.js';
import { toggle } from '../core/library.js';
import { $, $$, esc } from '../core/utils.js';
import { RT } from '../router.js';
import { card } from '../ui/components.js';

export async function pagePerson(m, tok, id) {
  const d = await api(`/person/${id}`, { append_to_response: 'combined_credits' });
  if (tok !== RT) return;
  const cc = d.combined_credits || { cast: [], crew: [] }, map = new Map();
  for (const x of cc.cast) { if (!x.poster_path || (x.genre_ids || []).some(g => [10767, 10763, 10764].includes(g))) continue; map.set(x.media_type + x.id, { x, role: x.character }); }
  for (const x of cc.crew) { if (!x.poster_path || !['Director', 'Creator', 'Writer', 'Screenplay'].includes(x.job)) continue; if (!map.has(x.media_type + x.id)) map.set(x.media_type + x.id, { x, role: x.job }); }
  const items = [...map.values()].map(({ x, role }) => ({ ...norm(x, x.media_type), sub: role, pop: x.popularity || 0 })).sort((a, b) => b.pop - a.pop);
  const known = items.slice(0, 12);
  const age = d.birthday ? ` · born ${d.birthday}${d.place_of_birth ? ' in ' + d.place_of_birth : ''}` : '';
  let flt = 'all';
  m.innerHTML = `<div class="dt" style="padding-top:0">${d.profile_path ? `<img class="pimg" style="width:200px" src="${IMG}w342${d.profile_path}" alt="">` : ''}
    <div><h1>${esc(d.name)}</h1><div class="sub">${esc(d.known_for_department || '')}${esc(age)}</div>
    <p class="bio" id="bio" style="margin-top:12px">${esc(d.biography || 'No biography available.')}</p>
    <p class="links" style="margin-top:10px"><a target="_blank" rel="noopener" href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(d.name)}">Wikipedia</a><a target="_blank" rel="noopener" href="https://www.themoviedb.org/person/${id}">TMDB</a></p></div></div>
    <h2>Known for</h2><div class="row">${known.map(card).join('')}</div>
    <div class="head"><h2 style="margin:0">Filmography</h2><div class="seg" id="pf"><button data-f="all" class="on">All</button><button data-f="movie">Movies</button><button data-f="tv">TV</button></div></div><div id="fg"></div>`;
  $('#bio').onclick = e => e.currentTarget.classList.toggle('open');
  const draw = () => { const l = items.filter(i => flt === 'all' || i.type === flt); $('#fg').innerHTML = `<div class="grid">${l.map(card).join('')}</div>`; };
  $$('#pf button').forEach(b => b.onclick = () => { flt = b.dataset.f; $$('#pf button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}

export async function pageCollection(m, tok, id) {
  const d = await api(`/collection/${id}`);
  if (tok !== RT) return;
  const parts = (d.parts || []).sort((a, b) => (a.release_date || '').localeCompare(b.release_date || '')).map(x => norm(x, 'movie'));
  m.innerHTML = `<div class="head"><h1>${esc(d.name)}</h1></div><p class="sub" style="max-width:800px;margin-bottom:16px">${esc(d.overview || '')}</p><div class="grid">${parts.map(card).join('')}</div>`;
}
