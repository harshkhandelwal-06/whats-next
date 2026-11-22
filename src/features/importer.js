import { api, norm } from '../core/api.js';
import { put, toast } from '../core/library.js';
import { ITEMS, S } from '../core/state.js';
import { key } from '../core/utils.js';

/** Tiny RFC-4180 CSV parser (quotes, commas and newlines inside quotes). */
export function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

/** Read Letterboxd (Name, Year, Rating) or IMDb (Title, Year, Your Rating, Title Type) exports. */
export function readExport(text) {
  const [head, ...rest] = parseCSV(text); if (!head) return [];
  const h = head.map(x => x.trim().toLowerCase()), col = (...n) => h.findIndex(x => n.includes(x));
  const ti = col('name', 'title'), yi = col('year'), ri = col('rating', 'your rating'), tt = col('title type');
  if (ti < 0) return [];
  return rest.map(r => {
    const raw = parseFloat(r[ri]), isLb = h.includes('name') || h.includes('letterboxd uri');
    const my = isNaN(raw) ? undefined : Math.max(1, Math.min(10, Math.round(isLb ? raw * 2 : raw)));
    const kind = /series|episode/i.test(r[tt] || '') ? 'tv' : 'movie';
    return { title: (r[ti] || '').trim(), year: (r[yi] || '').trim(), my, kind };
  }).filter(x => x.title);
}

export async function importRows(rows, onProgress = () => {}) {
  let done = 0, ok = 0, i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const r = rows[i++];
      try {
        const res = await api(`/search/${r.kind}`, { query: r.title, ...(r.year ? (r.kind === 'movie' ? { year: r.year } : { first_air_date_year: r.year }) : {}) });
        const hit = res.results?.[0];
        if (hit) { const it = norm(hit, r.kind); put(key(it), 'watched', r.my); ok++; }
      } catch {}
      onProgress(++done, rows.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return ok;
}

export function pickFile() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,text/csv';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const rows = readExport(await f.text());
    if (!rows.length) return toast('That file does not look like a Letterboxd or IMDb export.', 3600);
    toast(`Importing ${rows.length} titles…`, 2200);
    const ok = await importRows(rows.slice(0, 1500), (d, n) => { if (d % 25 === 0) toast(`Imported ${d} of ${n}…`, 1200); });
    toast(`Imported ${ok} of ${rows.length} titles`, 3600); location.hash = '#/list/watched';
  };
  inp.click();
}
