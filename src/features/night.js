import { L, api, norm } from '../core/api.js';
import { likedOf, taste } from '../core/rec.js';
import { isSafeFor } from '../core/safety.js';
import { ACTIVE, PROFILES, S, loadProfileData } from '../core/state.js';
import { $, $$, esc, key, rand, shuffle } from '../core/utils.js';
import { card } from '../ui/components.js';
import { toast } from '../core/library.js';
import { idOf, addFriend, apiKey, codeOf, createShare, fetchFriend, friendLib, friends, hasShareAccess, myCode, removeFriend, stopShare, updateShare } from '../core/friends.js';
import { getAccount } from '../core/state.js';
import { gClient } from '../core/sync.js';
import { GN } from '../core/state.js';
import { modal, closeModal } from '../ui/settings.js';

/** Group fit: how well a title matches each person's genre taste, plus a penalty if anyone already watched it. */
export function groupScore(it, people) {
  const per = people.map(p => {
    const aff = taste(it.type, p.lib), seen = p.lib[key(it)]?.status === 'watched' || p.lib[key(it)]?.status === 'hidden';
    const g = (it.genres || []).reduce((a, id) => a + (aff[id] || 0), 0);
    return { name: p.name, fit: Math.max(0, Math.min(100, Math.round(50 + g * 12 + (it.rating - 6.5) * 6))), seen };
  });
  const min = Math.min(...per.map(x => x.fit)), avg = per.reduce((a, x) => a + x.fit, 0) / per.length;
  return { per, score: min * 0.6 + avg * 0.4 - per.filter(x => x.seen).length * 40 };
}


const ini = n => esc((n || '?').trim().charAt(0).toUpperCase());
const GENRES = { movie: [28, 12, 16, 35, 80, 18, 14, 27, 9648, 10749, 878, 53], tv: [10759, 16, 35, 80, 18, 10765, 9648, 10751] };

export async function pageNight(m, tok) {
  const profs = PROFILES.list, acct = getAccount();
  const sel = new Set(profs.slice(0, 1).map(p => 'p:' + p.id));
  let type = S.cfg.type, seenBy = 'none'; const gsel = new Set();
  const ready = () => !!acct && !!gClient();

  m.innerHTML = `<div class="nt"><div class="nt-hero"><div><h1>Movie night</h1><p class="mut">Pick who's watching. We find something everyone should enjoy, using everyone's taste and what they've already seen.</p></div></div>
    <section class="nt-card"><div class="nt-h"><h2>Who's watching</h2><button class="btn ghost" id="ntAdd">＋ Add a friend</button></div><div id="ntPeople" class="nt-people"></div><p class="mut nt-note">Friends join with a share code. Ask them for theirs, or share yours below.</p></section>
    <section class="nt-card" id="ntShare"></section>
    <section class="nt-card"><h2>What are you in the mood for?</h2>
      <div class="nt-row"><span class="nt-l">Type</span><div class="seg2" id="ntType"><button data-t="movie">Movie</button><button data-t="tv">TV show</button></div></div>
      <div class="nt-row"><span class="nt-l">Already watched</span><div class="seg2" id="ntSeen"><button data-s="none">By nobody</button><button data-s="one">By one person</button><button data-s="any">Anyone</button></div></div>
      <div class="nt-row top"><span class="nt-l">Genres</span><div class="chips wrap" id="ntGen"></div></div></section>
    <div class="nt-go"><button id="nGo" class="primary big">Find our pick</button></div><div id="nOut"></div></div>`;

  const setSeg = (id, attr, val) => $$('#' + id + ' button').forEach(b => b.classList.toggle('on', b.dataset[attr] === val));
  const drawFilters = () => {
    setSeg('ntType', 't', type); setSeg('ntSeen', 's', seenBy);
    $('#ntGen').innerHTML = GENRES[type].map(g => `<button class="chip ${gsel.has(g) ? 'on' : ''}" data-g="${g}">${esc(GN[g] || g)}</button>`).join('');
  };
  const people = () => [...profs.map(p => ({ id: 'p:' + p.id, name: p.name, tag: p.id === ACTIVE.id ? 'You' : 'Profile', kids: p.kids })), ...friends().map(f => ({ id: 'f:' + f.id, name: f.name, tag: 'Friend', fid: f.id }))];
  const drawPeople = () => {
    $('#ntPeople').innerHTML = people().map(p => `<button class="nt-p ${sel.has(p.id) ? 'on' : ''}" data-id="${p.id}"><span class="nt-av ${p.fid ? 'fr' : ''}">${ini(p.name)}</span><span class="nt-n"><b>${esc(p.name)}</b><i>${p.tag}</i></span><span class="nt-ck" aria-hidden="true">✓</span>${p.fid ? `<span class="nt-x" role="button" tabindex="0" data-rmf="${p.fid}" aria-label="Remove ${esc(p.name)}" title="Remove friend">✕</span>` : ''}</button>`).join('');
  };
  const drawShare = () => {
    const c = myCode(), box = $('#ntShare');
    box.innerHTML = c ? `<div class="nt-h"><h2>Your share code</h2><span class="nt-on"><i></i>Active</span></div>
      <p class="mut">Anyone with this code can see the titles you've watched or saved, and your ratings. Nothing else. Turn it off any time and it stops working for everyone.</p>
      <div class="nt-code"><code id="ntCode">${esc(c)}</code><button class="btn" id="ntCopy">Copy</button></div>
      <div class="nt-btns"><button class="btn ghost" id="ntUpd">Update now</button><button class="btn ghost danger-t" id="ntOff">Turn off</button></div>`
      : `<h2>Share your taste</h2><p class="mut">Create a code your friends can paste into Movie night, so their picks take your taste into account. It shares only the titles you've watched or saved, and your ratings. You can turn it off any time.</p>
      <div class="nt-btns"><button class="primary" id="ntMake">Create my code</button></div><p class="err nt-err" id="ntErr"></p>`;
  };
  drawFilters(); drawPeople(); drawShare();
  if (myCode() && hasShareAccess()) updateShare(false).catch(() => {});

  $('#ntType').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; type = b.dataset.t; gsel.clear(); drawFilters(); };
  $('#ntSeen').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; seenBy = b.dataset.s; drawFilters(); };
  $('#ntGen').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; const g = +b.dataset.g; gsel.has(g) ? gsel.delete(g) : gsel.add(g); drawFilters(); };
  $('#ntPeople').onclick = e => {
    const rm = e.target.closest('[data-rmf]');
    if (rm) { e.stopPropagation(); if (confirm('Remove this friend from Movie night?')) { removeFriend(rm.dataset.rmf); sel.delete('f:' + rm.dataset.rmf); drawPeople(); } return; }
    const pick = e.target.closest('.nt-p[data-id]'); if (!pick) return;
    sel.has(pick.dataset.id) ? sel.delete(pick.dataset.id) : sel.add(pick.dataset.id); pick.classList.toggle('on');
  };
  $('#ntShare').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.id === 'ntMake') { if (!ready()) return ($('#ntErr').textContent = 'Sign in with Google and set a Client ID in Settings first.'); b.disabled = true; b.textContent = 'Creating…'; await createShare(); drawShare(); }
      else if (b.id === 'ntCopy') { try { await navigator.clipboard.writeText(myCode()); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); } catch { const r = document.createRange(); r.selectNodeContents($('#ntCode')); getSelection().removeAllRanges(); getSelection().addRange(r); } }
      else if (b.id === 'ntUpd') { b.disabled = true; await updateShare(true); toast('Your shared taste is up to date', 1800); b.disabled = false; }
      else if (b.id === 'ntOff' && confirm('Turn off your code? Friends using it will lose access.')) { await stopShare(); drawShare(); toast('Your code is off', 1800); }
    } catch (er) { toast(esc(er.message), 5000); drawShare(); }
  };
  $('#ntAdd').onclick = () => {
    const d = modal(`<div class="sheet"><h2>Add a friend</h2><p class="mut">Paste the share code your friend gave you. It starts with <b>wn-</b>.</p>
      <input id="frName" placeholder="Their name" maxlength="24" autocomplete="off"><input id="frCode" placeholder="wn-…" autocomplete="off" style="margin-top:10px"><div class="err" id="frErr"></div>
      <div class="pk-foot"><button class="btn" id="frAdd">Add friend</button><button class="btn ghost" data-close>Cancel</button></div></div>`);
    $('#frName', d).focus();
    const go = async () => {
      const b = $('#frAdd', d); b.disabled = true; b.textContent = 'Checking…';
      try {
        const code = $('#frCode', d).value, id = idOf(code); if (!id) throw new Error('That does not look like a What\'s Next code. It starts with wn-.');
        const data = await fetchFriend(id);   // proves the code works before saving it
        addFriend(code, $('#frName', d).value || data.name); closeModal(); drawPeople(); toast('Friend added. Pick them under Who\'s watching.', 2800);
      } catch (er) { $('#frErr', d).textContent = er.message; b.disabled = false; b.textContent = 'Add friend'; }
    };
    $('#frAdd', d).onclick = go; $('#frCode', d).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  };

  $('#nGo').onclick = async () => {
    const chosen = people().filter(p => sel.has(p.id));
    if (chosen.length < 2) return toast('Pick at least two people.');
    const out = $('#nOut'); out.innerHTML = '<p class="mut nt-wait">Finding a match…</p>';
    const who = []; const lost = [];
    for (const p of chosen) {
      if (p.fid) { try { who.push({ name: p.name, lib: friendLib(await fetchFriend(p.fid)) }); } catch (er) { lost.push(p.name); } }
      else { const id = p.id.slice(2), d = id === ACTIVE.id ? null : loadProfileData(id); who.push({ name: p.name, kids: p.kids, lib: d ? d.lib : S.lib }); }
    }
    if (lost.length) toast(`${esc(lost.join(', '))}'s code is not active, so they were left out.`, 4500);
    if (who.length < 2) { out.innerHTML = '<p class="mut empty">Not enough people to match. Ask your friend for a new code.</p>'; return; }
    const kids = who.some(p => p.kids);
    const genres = new Map(); who.forEach(p => Object.entries(taste(type, p.lib)).forEach(([g, v]) => genres.set(g, (genres.get(g) || 0) + v)));
    const top = gsel.size ? [...gsel] : [...genres].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
    const seeds = shuffle(who.flatMap(p => likedOf(type, p.lib))).slice(0, 6);
    const pages = await Promise.all([
      ...seeds.map(s => api(`/${type}/${s.id}/recommendations`).then(r => r.results).catch(() => [])),
      ...[1, 2, 3].map(pg => api(`/discover/${type}`, { with_genres: top.slice(0, 3).join('|'), sort_by: 'popularity.desc', 'vote_count.gte': 250, page: pg + (gsel.size ? 0 : rand(2)) }).then(r => r.results).catch(() => [])),
      api(`/trending/${type}/week`).then(r => r.results).catch(() => []),
      api(`/${type}/top_rated`, { page: 1 + rand(3) }).then(r => r.results).catch(() => []),
    ]);
    const seen = new Set(), items = [];
    for (const x of pages.flat()) { const it = norm(x, type), k = key(it); if (seen.has(k) || !it.poster || !isSafeFor(kids, it)) continue; if (gsel.size && !it.genres.some(g => gsel.has(g))) continue; seen.add(k); items.push(it); }
    const cap = { none: 0, one: 1, any: 99 }[seenBy];
    const ranked = items.map(it => ({ it, ...groupScore(it, who) })).filter(r => r.per.filter(x => x.seen).length <= cap).sort((a, b) => b.score - a.score).slice(0, 15);
    if (!ranked.length) { out.innerHTML = '<p class="mut empty">Nothing matches those filters. Try allowing titles one person has seen, or fewer genres.</p>'; return; }
    out.innerHTML = `<div class="nt-pick"><div><h2>Your picks</h2><p class="mut">${esc(who.map(p => p.name).join(', '))}${kids ? ' · kids-safe filter on' : ''}</p></div><button id="nRoll" class="btn">🎲 Choose for us</button></div>
      <div class="grid night">${ranked.map((r, i) => `<div class="night-c">${card(r.it, i)}<div class="fit">${r.per.map(x => `<span class="${x.seen ? 'seen' : ''}" title="${x.seen ? 'Already watched' : ''}">${esc(x.name)} ${x.seen ? '✓ seen' : x.fit + '%'}</span>`).join('')}</div></div>`).join('')}</div>`;
    $('#nRoll').onclick = () => { const p = ranked[rand(Math.min(4, ranked.length))]; location.hash = `#/t/${p.it.type}/${p.it.id}`; };
  };
}
