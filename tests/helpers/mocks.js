// Fake TMDB, Gemini, Google Drive and OMDb used by the end-to-end tests.
export const mk = id => ({ id, title: 'Movie ' + id, name: 'Show ' + id, poster_path: '/p.jpg', backdrop_path: '/b.jpg', vote_average: 7.5, vote_count: 900, genre_ids: [18, 53, 28], release_date: '2020-01-01', first_air_date: '2020-01-01', overview: 'ov', original_language: 'en', popularity: 5 });
export const state = { driveFile: null, calls: [], geminiFail: 0, sub: 'u1' };

function tmdb(url) {
  const u = new URL(url), p = u.pathname.replace('/3', '');
  const list = () => {
    const from = u.searchParams.get('primary_release_date.gte') || u.searchParams.get('first_air_date.gte'), lang = u.searchParams.get('with_original_language');
    return { results: Array.from({ length: 20 }, (_, i) => { const pg = +(u.searchParams.get('page') || 1); const x = mk(pg * 100 + i + (lang ? lang.charCodeAt(0) * 1000 : 0)); return from ? { ...x, release_date: from, first_air_date: from, popularity: 1000 - pg * 50 - i, original_language: lang || 'en' } : x; }), total_pages: 5, page: 1 };
  };
  if (p.startsWith('/genre')) return { genres: [{ id: 18, name: 'Drama' }, { id: 53, name: 'Thriller' }, { id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }, { id: 16, name: 'Animation' }, { id: 10751, name: 'Family' }] };
  if (p === '/search/multi') return { results: [{ ...mk(1), media_type: 'movie', title: 'Interstellar' }, { id: 9, name: 'Actor', profile_path: '/a.jpg', media_type: 'person' }], total_pages: 1 };
  if (p.startsWith('/search/')) { const q = u.searchParams.get('query'); return { results: [{ ...mk(50 + q.length), title: q, name: q }] }; }
  if (p.startsWith('/person/')) return { id: 9, name: 'Actor', biography: 'bio', combined_credits: { cast: [{ ...mk(3), media_type: 'movie', character: 'X' }], crew: [] } };
  if (p.startsWith('/collection/')) return { name: 'Col', parts: [mk(5)] };
  if (p.startsWith('/watch/providers')) return { results: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg', display_priorities: { IN: 1 } }] };
  if (/^\/(movie|tv)\/\d+$/.test(p)) {
    const tv = p.startsWith('/tv');
    return { ...mk(+p.split('/').pop()), genres: [{ id: 18, name: 'Drama' }], runtime: 120, episode_run_time: [45], number_of_episodes: 12, tagline: 'tag', status: 'Returning Series',
      credits: { cast: [{ id: 9, name: 'Actor', character: 'X', profile_path: '/a.jpg' }], crew: [{ job: 'Director', id: 10, name: 'Dir', profile_path: '/d.jpg' }] }, created_by: [{ id: 11, name: 'Creator' }],
      keywords: { keywords: [{ name: 'space' }, { name: 'time travel' }], results: [{ name: 'dystopia' }] },
      videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'abc', official: true }] }, 'watch/providers': { results: { IN: { flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }], link: 'http://x' } } },
      recommendations: list(), similar: list(), external_ids: { imdb_id: 'tt1' }, belongs_to_collection: { id: 1, name: 'Col' },
      seasons: [{ season_number: 1, name: 'S1', episode_count: 3, air_date: '2020-01-01' }, { season_number: 2, name: 'S2', episode_count: 2, air_date: '2021-01-01' }], number_of_seasons: 2,
      next_episode_to_air: tv ? { air_date: '2026-12-01' } : null,
      reviews: { results: [...Array.from({ length: p.endsWith('/777') ? 6 : 0 }, (_, i) => ({ author: 'Rev' + i, content: 'Another thoughtful take on the film number ' + i + '. '.repeat(1) + 'It has real pacing and heart.', author_details: { rating: 6 } })), { author: 'Ann', content: 'A gripping film with great pacing. '.repeat(20), author_details: { rating: 8 }, url: 'http://r' }, { author: 'Bob', content: 'Short but sweet review that says enough.' + ' x'.repeat(30), url: 'http://r2' }] } };
  }
  return list();
}
const ok = j => ({ ok: true, status: 200, json: async () => j });
const gem = t => ok({ candidates: [{ content: { parts: [{ text: t }] } }] });

export const fetchMock = async (url, opt = {}) => {
  url = String(url); state.calls.push(url.replace(/\?.*/, ''));
  if (url.includes('generativelanguage.googleapis.com')) {
    if (state.geminiFail > 0) { state.geminiFail--; return { ok: false, status: 404, json: async () => ({ error: { message: 'model not found' } }) }; }
    const b = JSON.parse(opt.body), sys = b.systemInstruction.parts[0].text, last = b.contents[b.contents.length - 1].parts[0].text;
    if (sys.includes("You are What's Next")) {
      const j = last.includes('seen') ? { reply: 'Noted, replaced it.', picks: [{ title: 'Arrival', year: 2016, type: 'movie', why: 'Cerebral sci-fi like Interstellar.' }], mark_watched: [{ title: 'Gravity', year: 2013, type: 'movie' }] }
        : { reply: 'Try these.', picks: [{ title: 'Edge of Tomorrow', year: 2014, type: 'movie', why: 'More action, same big ideas.' }, { title: 'Sunshine', year: 2007, type: 'movie', why: 'Space tension.' }] };
      return gem(JSON.stringify(j));
    }
    if (sys.includes('taste DNA')) return gem(JSON.stringify({ archetype: 'The Mind-Bender', summary: 'You love puzzles.', storytelling: 'Non-linear.', themes: 'Time.', pacing: 'Slow burn.', try: [{ title: 'Primer', year: 2004, type: 'movie', why: 'Time puzzle.' }] }));
    if (sys.includes('Summarise audience')) return gem('Loved: pacing.\nMixed: length.');
    if (sys.includes('NOT seen')) return gem('Mild intensity, no major gore.');
    return gem('ok');
  }
  if (url.includes('omdbapi')) return ok({ Response: 'True', imdbRating: '8.6', Ratings: [{ Source: 'Rotten Tomatoes', Value: '87%' }, { Source: 'Metacritic', Value: '74/100' }] });
  if (url.includes('userinfo')) return ok({ sub: state.sub, name: 'Test User', email: state.sub + '@example.com', picture: '' });
  if (url.includes('googleapis.com/drive/v3/files?')) return ok({ files: state.driveFile ? [{ id: 'F1' }] : [] });
  if (url.includes('googleapis.com/drive/v3/files/F1')) return ok(state.driveFile);
  if (url.includes('googleapis.com/upload')) { state.driveFile = JSON.parse(opt.method === 'PATCH' ? opt.body : opt.body.split('\r\n\r\n')[2].split('\r\n--')[0]); return ok({ id: 'F1' }); }
  if (url.includes('themoviedb')) return ok(tmdb(url));
  return ok({});
};

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Boot the app fresh inside the current jsdom window. */
export async function boot(seed, opts = {}) {
  const fs = await import('node:fs'), path = await import('node:path');
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script', html.indexOf('<body>')));
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('wn:fx', 'off');
  if (!opts.signedOut) localStorage.setItem('wn:acct', JSON.stringify({ sub: 'u1', email: 't@example.com', name: 'Test User', picture: '' }));
  if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  location.hash = '';
  globalThis.fetch = window.fetch = fetchMock;
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  Element.prototype.setPointerCapture = () => {}; Element.prototype.scrollIntoView = () => {}; window.scrollTo = () => {}; window.confirm = () => true;
  window.google = { accounts: { oauth2: { initTokenClient: cfg => ({ requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'tok', expires_in: 3600 }), 5) }), revoke: () => {} } } };
  const vi = (await import('vitest')).vi; vi.resetModules();
  await import('../../src/main.js'); await sleep(450);
}
export const lib = () => { const m = JSON.parse(localStorage.getItem('wn:u1:meta') || 'null'); const id = m?.last; const raw = id && localStorage.getItem('wn:u1:p:' + id); return raw ? JSON.parse(raw).lib : (JSON.parse(localStorage.getItem('watchnext') || '{}').lib || {}); };
