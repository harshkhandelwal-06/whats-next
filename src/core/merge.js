import { DEF, PREF_KEYS } from './defaults.js';

/**
 * Merge remote data into `t` (a plain { lib, del, meta, cfg } object). Newest timestamp wins per title,
 * and a deletion beats any older entry. Returns true when `t` changed.
 */
export function mergeData(t, r, { keys = false } = {}) {
  if (!r) return false;
  t.lib = t.lib || {}; t.del = t.del || {}; t.meta = t.meta || {}; t.cfg = t.cfg || {};
  const before = JSON.stringify([t.lib, t.del, t.cfg.key, t.cfg.geminiKey]);
  for (const k of new Set([...Object.keys(t.lib), ...Object.keys(r.lib || {}), ...Object.keys(t.del), ...Object.keys(r.del || {})])) {
    const a = t.lib[k], b = r.lib?.[k], te = Math.max(a?.ts || 0, b?.ts || 0), td = Math.max(t.del[k] || 0, r.del?.[k] || 0);
    if (td && td >= te) { delete t.lib[k]; t.del[k] = td; } else { t.lib[k] = (a && (!b || a.ts >= b.ts)) ? a : b; delete t.del[k]; }
  }
  t.meta = { ...(r.meta || {}), ...t.meta };
  const rc = r.cfg || {};
  if (Array.isArray(rc.friends)) { const have = new Set((t.cfg.friends || []).map(f => f.id)); t.cfg.friends = [...(t.cfg.friends || []), ...rc.friends.filter(f => f && f.id && !have.has(f.id))]; }
  if (Array.isArray(rc.myMoods)) { const have = new Set((t.cfg.myMoods || []).map(x => x.id)); t.cfg.myMoods = [...(t.cfg.myMoods || []), ...rc.myMoods.filter(x => x && x.id && !have.has(x.id))]; }
  if (Array.isArray(rc.lists)) { const have = new Set((t.cfg.lists || []).map(l => l.id)); t.cfg.lists = [...(t.cfg.lists || DEF.cfg.lists), ...rc.lists.filter(l => l && l.id && !have.has(l.id))]; }
  for (const ty of ['movie', 'tv']) { const rn = rc.notes || {}, tn = t.cfg.notes = t.cfg.notes || { movie: '', tv: '', movieTs: 0, tvTs: 0 }; if ((rn[ty + 'Ts'] || 0) > (tn[ty + 'Ts'] || 0)) { tn[ty] = rn[ty] || ''; tn[ty + 'Ts'] = rn[ty + 'Ts']; } }
  for (const k of PREF_KEYS) if (rc[k] !== undefined && JSON.stringify(t.cfg[k]) === JSON.stringify(DEF.cfg[k])) t.cfg[k] = rc[k];
  if (keys) for (const k of ['key', 'geminiKey', 'omdbKey']) if (!t.cfg[k] && rc[k]) t.cfg[k] = rc[k];
  return before !== JSON.stringify([t.lib, t.del, t.cfg.key, t.cfg.geminiKey]);
}

/** Merge profile lists by id (newest edit wins; a newer deletion beats an older profile). */
export function mergeProfiles(localList, localDel, remoteList = [], remoteDel = {}) {
  const del = { ...localDel }; for (const [id, ts] of Object.entries(remoteDel)) del[id] = Math.max(del[id] || 0, ts);
  const map = new Map(localList.map(p => [p.id, p])), added = [], removed = [];
  for (const rp of remoteList) { const lp = map.get(rp.id); if (!lp) { map.set(rp.id, rp); added.push(rp.id); } else if ((rp.ts || 0) > (lp.ts || 0)) map.set(rp.id, rp); }
  for (const [id, p] of [...map]) if (del[id] && del[id] >= (p.ts || 0)) { map.delete(id); removed.push(id); }
  return { list: [...map.values()], del, added, removed };
}
