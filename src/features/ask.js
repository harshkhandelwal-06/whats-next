import { ai, dedupePicks, jparse, resolvePick, seenList, tasteBrief } from '../core/ai.js';
import { api, norm } from '../core/api.js';
import { put, toast } from '../core/library.js';
import { GN, ITEMS, S } from '../core/state.js';
import { $, $$, esc, key, rand } from '../core/utils.js';
import { card } from '../ui/components.js';
import { recommend } from '../core/rec.js';

export const ASK = { pre: '' };

export let CHAT = [];

export const ASK_IDEAS = ['A movie like Interstellar but with more action', 'Something short and funny for tonight', 'Hidden gems in Korean cinema', 'A suspenseful series I can binge this weekend'];

export const chatHtml = c => c.role === 'user' ? `<div class="msg u">${esc(c.text)}</div>`
  : `<div class="msg b"><p>${esc(c.text)}</p>${c.picks?.length ? `<div class="picks">${c.picks.map((p, i) => card(p, i)).join('')}</div>` : ''}</div>`;

export function paintChat(typing) {
  const el = $('#chat'); if (!el) return;
  el.innerHTML = (CHAT.length ? CHAT.map(chatHtml).join('') : `<div class="msg b welcome"><p><b>What are you in the mood for?</b></p><p class="mut">Name a title you loved, a mood, a runtime or a language. I'll use your watch history and never suggest anything you've seen. Refine as we go: “shorter”, “more suspenseful”, “I've seen that”.</p></div>`)
    + (typing ? '<div class="msg b think"><span class="typing"><i></i><i></i><i></i></span><span class="tl" id="tl">Thinking…</span></div>' : '');
  if (typing) { clearTimeout(paintChat.t1); clearTimeout(paintChat.t2); paintChat.t1 = setTimeout(() => { const n = $('#tl'); if (n) n.textContent = 'Finding the best matches…'; }, 4000); paintChat.t2 = setTimeout(() => { const n = $('#tl'); if (n) n.textContent = 'Still working, almost there…'; }, 10000); }
  el.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export async function askTurn(text) {
  text = (text || '').trim(); if (!text) return;
  CHAT.push({ role: 'user', text }); paintChat(true);
  try { const r = S.cfg.geminiKey ? await askAI() : await askLocal(text); CHAT.push({ role: 'bot', ...r }); }
  catch (e) { CHAT.push({ role: 'bot', text: e.message || 'Something went wrong. Try again.', picks: [] }); }
  paintChat();
}

export async function askAI() {
  const gem = $('#askGem')?.checked, t = S.cfg.type;
  // Our own recommender ranks titles from your history (never ones you have seen); the AI works from that list and your request.
  const cands = (await Promise.race([recommend(t), new Promise(r => setTimeout(() => r([]), 3500))]).catch(() => [])).slice(0, 30);
  const sys = `You are What's Next, an expert film and TV recommender inside a personal watch-guide app.
Reply with ONLY a JSON object (no markdown): {"intent":"recommend or about or chat","reply":"your answer","about":[{"title":"","year":2014,"type":"movie or tv"}],"picks":[{"title":"","year":2014,"type":"movie or tv","why":"max 18 words, spoiler-free, tied to the request or the user's taste"}],"mark_watched":[{"title":"","year":2014,"type":"movie or tv"}]}
FIRST decide the intent:
- "about": the user asks about a specific title or person (what is it about, is it good, is it scary, who is in it, who directed it, how long, how does it compare, should I watch it, explain it). ANSWER THE QUESTION in "reply" (2 to 5 plain sentences, spoiler-free unless they explicitly ask for spoilers or the ending), put the title(s) you discussed in "about" (max 3), and return "picks": []. Do NOT suggest similar titles unless they ask for them.
- "recommend": they want suggestions (like X, something for a mood, what next, more of this). Fill "picks".
- "chat": anything else. Answer in "reply"; picks empty.
Rules for recommendations:
- Give 6 picks unless the user asks for a different number. Use real titles with the correct release year (first air year for TV).
- Default to ${t === 'movie' ? 'movies' : 'TV shows'} unless the user clearly asks for something else or both.
- Never put spoilers in any text.
- Never recommend anything on the already-seen list. Honour refinements across the conversation (shorter, more suspenseful, not that one, something older).
- If the user says they have already seen a title, list it in mark_watched and replace it with a new pick.
- Where it helps, explain with the user's own taste, for example "Because you loved Dark and Inception".
${gem ? '- Hidden-gem mode: only lesser-known, under-appreciated titles, never household names.' : ''}
${cands.length ? `- CANDIDATES below (only for recommend requests) were ranked for this user by our recommender from their watch history. When they fit the request, choose mostly from them; the request always wins, so go beyond them when it asks for something they do not cover.` : ''}
USER TASTE:\n${tasteBrief(t)}\nALREADY SEEN OR HIDDEN: ${seenList() || 'nothing yet'}${cands.length ? '\nCANDIDATES: ' + cands.map(c => `${c.title} (${c.year}, ${c.type})`).join('; ') : ''}`;
  const hist = CHAT.slice(-12).map(c => ({ role: c.role === 'user' ? 'user' : 'assistant', content: c.role === 'user' ? c.text : (c.raw || c.text) }));
  while (hist.length && hist[0].role !== 'user') hist.shift();
  const out = await ai(sys, hist, { tier: 'fast', json: true, max: 1400, limit: 16000 });
  let j; try { j = jparse(out); } catch { return { text: out.slice(0, 700), picks: [], raw: out }; }
  for (const w of j.mark_watched || []) { const it = await resolvePick({ ...w, type: w.type || t }); if (it) put(key(it), 'watched'); }
  if (j.mark_watched?.length) toast('Marked ' + j.mark_watched.map(w => esc(w.title)).join(', ') + ' as watched', 2600);
  const about = (await Promise.all((j.about || []).slice(0, 3).map(p => resolvePick({ ...p, type: p.type || t })))).filter(Boolean);
  const picks = dedupePicks((await Promise.all((j.picks || []).slice(0, 10).map(p => resolvePick({ ...p, type: p.type || t })))).filter(Boolean));
  // If the AI came back thin, top up from the recommender so you always get something good.
  if (!picks.length && !about.length && (!j.intent || j.intent === 'recommend')) { const have = new Set(picks.map(key)); for (const c of cands) { if (picks.length >= 6) break; if (!have.has(key(c))) picks.push({ ...c, why: 'Based on your watch history' }); } }
  return { text: j.reply || 'Here you go.', picks: [...about, ...picks.filter(p => !about.some(a => key(a) === key(p)))], raw: out };
}

export const KW = [[/action|fight|explosi|adrenaline/, 28], [/comed|funny|laugh|lighter|light-?hearted/, 35], [/horror|scary|frighten|creepy/, 27], [/romanc|love story/, 10749], [/suspens|thrill|tense|gripping/, 53],
  [/myster|whodunit/, 9648], [/sci-?fi|space|futur|alien/, 878], [/anim|cartoon/, 16], [/crime|gangster|heist/, 80], [/drama|emotional|moving/, 18], [/fantasy|magic/, 14], [/\bwar\b/, 10752], [/histor/, 36], [/documentar/, 99], [/family|kids/, 10751], [/adventure/, 12]];

export const LG = { hindi: 'hi', tamil: 'ta', telugu: 'te', malayalam: 'ml', kannada: 'kn', bengali: 'bn', korean: 'ko', japanese: 'ja', french: 'fr', spanish: 'es', german: 'de', italian: 'it', chinese: 'zh', english: 'en', thai: 'th', turkish: 'tr' };

export const TVG = { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768, 27: 9648, 10749: 18, 53: 9648, 36: 18 };

export async function askLocal(q) {
  const t = S.cfg.type, low = q.toLowerCase(), mm = q.match(/(?:like|similar to|reminds me of|in the vein of)\s+["“]?(.+?)["”]?(?=\s+(?:but|with|and|except|though|only)\b|[,.!?]|$)/i);
  const rest = mm ? low.replace(mm[0].toLowerCase(), ' ') : low;
  const genres = [...new Set(KW.filter(([re]) => re.test(rest)).map(x => x[1]))];
  const lang = Object.entries(LG).find(([n]) => rest.includes(n))?.[1] || '';
  const gem = /hidden gem|underrated|lesser.known|obscure/.test(low);
  const tm = rest.match(/under (\d+(?:\.\d+)?)\s*(h|hr|hour|hours|m|min|minutes)/), maxRt = tm ? (/^h/.test(tm[2]) ? tm[1] * 60 : +tm[1]) : /short/.test(rest) ? 100 : 0, minRt = /\b(long|epic)\b/.test(rest) ? 130 : 0;
  const old = /classic|old school|older/.test(rest), fresh = /\b(recent|new|latest)\b/.test(rest);
  const gid = (type, g) => type === 'tv' ? (TVG[g] || g) : g;
  let pool = [], type = t, head = '', refName = '';
  if (mm) {
    const ref = await api('/search/multi', { query: mm[1] }); const rr = ref.results.find(x => x.media_type === 'movie' || x.media_type === 'tv');
    if (rr) {
      type = rr.media_type; refName = rr.title || rr.name;
      const [a, b, d0] = await Promise.all([api(`/${type}/${rr.id}/recommendations`), api(`/${type}/${rr.id}/similar`), api(`/${type}/${rr.id}`)]);
      pool = [...a.results, ...b.results].map(x => norm(x, type));
      if (genres.length) {
        const gids = [...new Set([...(d0.genres || []).map(x => x.id).slice(0, 2), ...genres.map(g => gid(type, g))])];
        const dd = await api(`/discover/${type}`, { with_genres: gids.join(','), sort_by: 'popularity.desc', 'vote_count.gte': 300 }).catch(() => ({ results: [] }));
        pool.push(...dd.results.map(x => norm(x, type)));
      }
      head = `Titles in the spirit of ${refName}`;
    }
  }
  if (!pool.length) {
    const p = { sort_by: gem ? 'vote_average.desc' : 'popularity.desc', 'vote_count.gte': gem ? 150 : 200, 'vote_count.lte': gem ? 3500 : '', 'vote_average.gte': gem ? 7 : 6.3, with_genres: genres.map(g => gid(t, g)).join('|'), with_original_language: lang, page: 1 + rand(3) };
    const dk = t === 'movie' ? 'primary_release_date' : 'first_air_date';
    if (old) p[dk + '.lte'] = '1999-12-31'; if (fresh) p[dk + '.gte'] = (new Date().getFullYear() - 3) + '-01-01';
    if (t === 'movie') { if (maxRt) p['with_runtime.lte'] = maxRt; if (minRt) p['with_runtime.gte'] = minRt; }
    pool = (await api(`/discover/${t}`, p)).results.map(x => norm(x, t));
    head = 'Here is what matches';
  }
  const want = genres.map(g => gid(type, g)), parts = [];
  if (genres.length) parts.push(genres.map(g => GN[gid(type, g)]).filter(Boolean).join(' + '));
  if (maxRt) parts.push('under ' + Math.round(maxRt) + ' min'); if (gem) parts.push('hidden gem'); if (lang) parts.push(Object.keys(LG).find(k => LG[k] === lang));
  pool = dedupePicks(pool).filter(x => !lang || x.lang === lang).filter(x => !old || +x.year < 2000).filter(x => !fresh || +x.year >= new Date().getFullYear() - 4);
  pool.forEach(x => x.sc = x.genres.filter(g => want.includes(g)).length * 2 + x.rating / 5 + Math.random() * .5);
  const picks = pool.sort((a, b) => b.sc - a.sc).slice(0, 8).map(x => { const o = { ...x, why: refName ? `Similar to ${refName}${parts.length ? ' · ' + parts.join(', ') : ''}` : (parts.join(', ') || 'Popular pick') }; ITEMS.set(key(o), o); return o; });
  return { text: picks.length ? `${head}${parts.length && !refName ? ' (' + parts.join(', ') + ')' : ''}. Add a free Gemini key in Settings for smarter, conversational answers.` : 'I could not find a match. Try rewording, or loosen a filter.', picks };
}

export function pageAsk() { location.replace('#/foryou'); import('./aibubble.js').then(m => m.openAssistant(ASK.pre)); }
