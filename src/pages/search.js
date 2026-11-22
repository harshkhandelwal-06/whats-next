import { api, norm } from '../core/api.js';
import { $, esc } from '../core/utils.js';
import { RT } from '../router.js';
import { card, mountGrid } from '../ui/components.js';

export async function pageSearch(m, tok, q = '') {
  $('#q').value = q;
  m.innerHTML = `<div class="head"><h1>Results for “${esc(q)}”</h1></div><div id="people"></div><div id="g"></div>`;
  const r1 = await api('/search/multi', { query: q, include_adult: 'false' });
  if (tok !== RT) return;
  const people = r1.results.filter(x => x.media_type === 'person' && x.profile_path).slice(0, 12).map(x => norm(x));
  if (people.length) $('#people').innerHTML = `<h2>People</h2><div class="row">${people.map(card).join('')}</div><h2>Titles</h2>`;
  mountGrid($('#g'), async p => {
    const r = p === 1 ? r1 : await api('/search/multi', { query: q, page: p, include_adult: 'false' });
    return { results: r.results.filter(x => x.media_type !== 'person').map(x => norm(x)), total_pages: r.total_pages };
  }, { filter: false });
}
