// Small persistent cache in IndexedDB so a second visit does not wait on the network.
// Entries are { t: savedAt, v: json }. Missing IndexedDB (tests, private modes) just means no persistence.
let dbp = null;
const open = () => dbp || (dbp = new Promise(res => {
  if (typeof indexedDB === 'undefined') return res(null);
  try {
    const r = indexedDB.open('wn-cache', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('c');
    r.onsuccess = () => res(r.result); r.onerror = () => res(null);
  } catch { res(null); }
}));
const tx = async (mode, f) => { const db = await open(); if (!db) return undefined; return new Promise(res => { try { const t = db.transaction('c', mode), s = t.objectStore('c'), q = f(s); if (q) { q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } else t.oncomplete = () => res(); t.onerror = () => res(undefined); } catch { res(undefined); } }); };
export const cget = k => tx('readonly', s => s.get(k));
export const cset = (k, v) => tx('readwrite', s => { s.put({ t: Date.now(), v }, k); });
export async function cprune(maxAge = 3 * 864e5) {
  const db = await open(); if (!db) return;
  try { const s = db.transaction('c', 'readwrite').objectStore('c'), q = s.openCursor(); q.onsuccess = () => { const c = q.result; if (!c) return; if (Date.now() - c.value.t > maxAge) c.delete(); c.continue(); }; } catch {}
}
setTimeout(() => cprune(), 4000);
