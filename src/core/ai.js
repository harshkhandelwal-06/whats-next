import { KIDS_PROMPT } from './safety.js';
import { L, api, norm } from './api.js';
import { topGenres } from './rec.js';
import { GN, ITEMS, S } from './state.js';
import { key } from './utils.js';

export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

export const MODELS = { smart: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'], fast: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'] };

const ver = n => (n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1] * 1;
const plain = n => /^gemini-[\d.]+-flash(-lite)?$/.test(n);   // stable text models only: no preview, image, live or audio variants
/** Ask Google which Gemini models this key can use, so the app keeps working as new ones appear. Cached for a day. */
async function discover(k) {
  try { const c = JSON.parse(localStorage.getItem('wn:gm') || 'null'); if (c && Date.now() - c.t < 864e5 && c.k === k.slice(-6)) return c.v; } catch {}
  try {
    const r = await fetch(`${GEMINI_URL.replace(/models\/$/, 'models')}?pageSize=200&key=${encodeURIComponent(k)}`, { signal: AbortSignal.timeout?.(6000) });
    if (!r.ok) return null;
    const names = ((await r.json()).models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', '')).filter(plain);
    const byV = l => l.sort((a, b) => ver(b) - ver(a));
    const v = { smart: byV(names.filter(n => !/lite/.test(n))), fast: byV(names.filter(n => /lite/.test(n))) };
    try { localStorage.setItem('wn:gm', JSON.stringify({ t: Date.now(), k: k.slice(-6), v })); } catch {}
    return v;
  } catch { return null; }
}
const thinkOff = m => /pro/.test(m) ? null : ver(m) >= 3 ? { thinkingLevel: 'minimal' } : { thinkingBudget: 0 };

/**
 * One Gemini call. `tier: 'fast'` tries the quick lite models first (best for chat); every model gets a time limit,
 * so a slow or overloaded one is skipped instead of leaving you waiting.
 */
export async function ai(system, messages, { tier = 'smart', max = 2048, json = false, limit = 14000 } = {}) {
  const key = (S.cfg.geminiKey || '').trim();
  if (!key) throw new Error('Add your free Gemini API key in Settings to use the AI features.');
  const found = await discover(key);
  const order = tier === 'fast' ? ['fast', 'smart'] : ['smart', 'fast'];
  const chain = [...new Set([(S.cfg.geminiModel || '').trim(), ...order.flatMap(t => [...(found?.[t] || []).slice(0, 2), ...MODELS[t]])].filter(Boolean))].slice(0, 5);
  const sys = { parts: [{ text: system + (S.cfg.kids ? ' ' + KIDS_PROMPT : '') }] }, contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  let last;
  for (const model of chain) {
    for (const think of [thinkOff(model), null]) {
      const body = JSON.stringify({ systemInstruction: sys, contents, generationConfig: { maxOutputTokens: max, temperature: 0.8, ...(json ? { responseMimeType: 'application/json' } : {}), ...(think ? { thinkingConfig: think } : {}) } });
      const ac = new AbortController(), timer = setTimeout(() => ac.abort(), limit);
      let r;
      try { r = await fetch(`${GEMINI_URL}${model}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: ac.signal }); }
      catch (e) { clearTimeout(timer); if (e.name === 'AbortError') { last = new Error('The AI took too long to answer. Try again in a moment.'); break; } throw new Error('Could not reach Gemini. Check your internet connection.'); }
      clearTimeout(timer);
      if (r.ok) {
        const j = await r.json(), t = (j.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
        if (t) return t;
        last = new Error(j.promptFeedback?.blockReason ? 'Gemini declined that request (' + j.promptFeedback.blockReason + ').' : 'Gemini returned an empty answer.');
        if (j.promptFeedback?.blockReason) throw last; break;
      }
      let msg = ''; try { msg = (await r.json()).error?.message || ''; } catch {}
      if ((r.status === 400 && /api key/i.test(msg)) || r.status === 403) throw new Error('Gemini rejected the API key. Check it in Settings.');
      last = new Error('Gemini error ' + r.status + (msg ? ': ' + msg : ''));
      if (r.status === 400 && think && /think/i.test(msg)) continue;   // that model does not take the thinking setting; retry plain
      break;
    }
  }
  throw last || new Error('The AI request failed.');
}

export const jparse = t => { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('bad json'); return JSON.parse(t.slice(a, b + 1)); };

export function tasteBrief(type) {
  const L = Object.values(S.lib), by = (f, n) => L.filter(f).sort((a, b) => b.ts - a.ts).slice(0, n).map(e => `${e.title} (${e.year})`);
  const loved = by(e => e.status === 'watched' && (e.my || 0) >= 8, 14), disliked = by(e => (e.status === 'watched' && e.my && e.my <= 4) || e.status === 'hidden', 10);
  const g = topGenres(type, 4).map(id => GN[id]).filter(Boolean);
  return `Loved or liked: ${loved.join('; ') || 'unknown'}\nDisliked: ${disliked.join('; ') || 'none'}\nFavourite genres: ${g.join(', ') || 'unknown'}\nPreferred languages: ${S.cfg.langs.join(', ') || 'any'}`;
}

export const seenList = () => Object.values(S.lib).filter(e => e.status === 'watched' || e.status === 'hidden').slice(0, 200).map(e => e.title).join('; ');

export async function resolvePick(p) {
  const type = p.type === 'tv' ? 'tv' : 'movie';
  const q = { query: p.title }; if (p.year) { if (type === 'movie') q.year = p.year; else q.first_air_date_year = p.year; }
  let r = await api(`/search/${type}`, q).catch(() => null), hit = r?.results?.[0];
  if (!hit && p.year) { r = await api(`/search/${type}`, { query: p.title }).catch(() => null); hit = r?.results?.[0]; }
  if (!hit) return null;
  const it = { ...norm(hit, type), why: p.why || '' }; ITEMS.set(key(it), it); return it;
}

/** Find the TMDB record for a title the AI named. */
export async function resolveRaw(p) {
  const type = p.type === 'tv' ? 'tv' : 'movie';
  const q = { query: p.title }; if (p.year) { if (type === 'movie') q.year = p.year; else q.first_air_date_year = p.year; }
  let r = await api(`/search/${type}`, q).catch(() => null), hit = r?.results?.[0];
  if (!hit && p.year) { r = await api(`/search/${type}`, { query: p.title }).catch(() => null); hit = r?.results?.[0]; }
  return hit ? { hit, type } : null;
}

const TASTE = {};
/** A batch of titles the AI picks from your history. Used by the Home feed, so it never waits on it: it fills in once ready. */
export function aiTaste(type) {
  if (!(S.cfg.geminiKey || '').trim()) return null;
  const sig = Object.keys(S.lib).length + ':' + type;
  if (TASTE[type]?.sig === sig) return TASTE[type];
  const o = TASTE[type] = { sig, ready: false, items: [] };
  const sys = `You are a film and TV recommender. Reply with ONLY JSON: {"picks":[{"title":"","year":2014,"type":"${type}"}]}. Give 14 real titles (correct release year) this person has NOT seen and would love. Mix well-known and lesser-known. No spoilers.\nUSER TASTE:\n${tasteBrief(type)}\nALREADY SEEN OR HIDDEN (never repeat): ${seenList() || 'nothing yet'}`;
  ai(sys, [{ role: 'user', content: 'Pick for me.' }], { tier: 'fast', json: true, max: 900, limit: 12000 })
    .then(async t => { const j = jparse(t); o.items = (await Promise.all((j.picks || []).slice(0, 14).map(p => resolveRaw({ ...p, type })))).filter(Boolean).map(r => r.hit); })
    .catch(() => {}).finally(() => { o.ready = true; });
  return o;
}

export const dedupePicks = list => { const s = new Set(); return list.filter(p => { const k = key(p); if (s.has(k) || ['watched', 'hidden'].includes(S.lib[k]?.status)) return false; s.add(k); return true; }); };
