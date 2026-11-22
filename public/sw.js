// What's Next service worker: instant repeat loads, offline shell, cached posters.
const V = 'wn-v5', IMG = 'wn-img';
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'favicon.svg'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (/\/assets\//.test(u.pathname)) {   // hashed build files never change: serve from cache, fetch once
      e.respondWith(caches.open(V).then(async c => (await c.match(r)) || fetch(r).then(res => { c.put(r, res.clone()); return res; })));
    } else {                               // the page itself: fresh if the network answers quickly, otherwise the saved copy
      e.respondWith(withTimeout(fetch(r), 2500).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); return res; }).catch(() => caches.match(r).then(h => h || caches.match('index.html'))));
    }
  } else if (u.hostname === 'image.tmdb.org') {
    e.respondWith(caches.open(IMG).then(async c => { const hit = await c.match(r); const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit); return hit || net; }));
  }
});
