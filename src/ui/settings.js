import { api, cache } from '../core/api.js';
import { IMG, LANGS, REGIONS } from '../core/config.js';
import { toast, toggle } from '../core/library.js';
import { S, save } from '../core/state.js';
import { hasServer, syncNow } from '../core/sync.js';
import * as bio from '../core/bio.js';
import { changePassword } from '../core/supa.js';
import { getAccount } from '../core/state.js';
import { signOut } from '../features/profiles.js';
import { $, $$, esc, key } from '../core/utils.js';
import { route } from '../router.js';
import { motion, setMotion } from './motion.js';
import { setTheme, themePref } from './theme.js';
import { errHtml } from './components.js';

export const modal = html => { closeModal(); const d = document.createElement('div'); d.className = 'modal'; d.innerHTML = html; d.addEventListener('click', e => { if (e.target === d || e.target.dataset.close != null) closeModal(); }); document.body.appendChild(d); return d; };

export const closeModal = () => $$('.modal').forEach(x => x.remove());

export async function openSettings() {
  const acct = getAccount();
  const sw = (id, opts, cur) => `<div class="seg3" id="${id}" role="radiogroup">${opts.map(([v, n, h]) => `<button type="button" role="radio" aria-checked="${v === cur}" class="${v === cur ? 'on' : ''}" data-v="${v}"><b>${n}</b><span>${h}</span></button>`).join('')}</div>`;
  const TABS = [['gen', 'General', '<path d="M4 6h16M4 12h16M4 18h10"/>'], ['look', 'Appearance', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/>'], ['str', 'Streaming', '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>'], ['ai', 'AI and scores', '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>'], ['acc', 'Account', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'], ['dat', 'Your data', '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>']];
  const d = modal(`<div class="box setbox"><div class="head"><h1>Settings</h1><button data-close class="x" aria-label="Close">✕</button></div>
  <div class="setwrap"><nav class="setnav" role="tablist">${TABS.map(([id, n, ic], i) => `<button role="tab" class="${i ? '' : 'on'}" data-sec="${id}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ic}</svg><span>${n}</span></button>`).join('')}</nav>
  <div class="setbody">
   <section class="sp on" data-p="gen"><h2>General</h2>
     <div class="srow"><div><b>Region</b><span>Used for streaming info and what's in cinemas</span></div><select id="sReg">${REGIONS.map(r => `<option ${r === S.cfg.region ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
     <div class="sgrp"><b>Languages I enjoy</b><span>Used for picks, swipe and the radar</span><div class="chips" style="flex-wrap:wrap" id="sLang">${LANGS.slice(1).map(([c, n]) => `<button class="chip ${S.cfg.langs.includes(c) ? 'on' : ''}" data-lg="${c}">${n}</button>`).join('')}</div></div>
     <div class="sgrp"><b>TMDB key</b><span>Where posters, cast and ratings come from</span><input id="sKey" value="${esc(S.cfg.key)}" autocomplete="off"></div>
   </section>
   <section class="sp" data-p="look"><h2>Appearance</h2>
     <div class="sgrp"><b>Theme</b>${sw('sTheme', [['system', 'Auto', 'Match my device'], ['dark', 'Dark', 'Easy at night'], ['light', 'Light', 'Bright and clean']], themePref())}</div>
     <div class="sgrp"><b>Animations</b><span>Saved on this device, so your phone can run lighter than your PC</span>${sw('sMotion', [['full', 'Full', 'Every effect'], ['lite', 'Lite', 'Quicker, no blur'], ['off', 'Off', 'Nothing moves']], motion())}</div>
   </section>
   <section class="sp" data-p="str"><h2>Streaming</h2><p class="sub">Pick the services you pay for and we'll show where things are playing.</p><div class="pl" id="sProv"><div class="spin"></div></div></section>
   <section class="sp" data-p="ai"><h2>AI and scores</h2>
     <div class="sgrp"><b>Gemini AI <em>optional</em></b><span>Powers plain-language search, the assistant, review summaries and your taste profile. Free key at aistudio.google.com/apikey, sent only to Google.</span><input id="sAi" type="password" placeholder="Gemini API key (AIza…)" value="${esc(S.cfg.geminiKey)}" autocomplete="off"></div>
     <div class="sgrp"><b>Critic scores <em>optional</em></b><span>A free key from omdbapi.com adds IMDb, Rotten Tomatoes and Metacritic.</span><input id="sOmdb" placeholder="OMDb API key" value="${esc(S.cfg.omdbKey)}" autocomplete="off"></div>
   </section>
   <section class="sp" data-p="acc"><h2>Account and sync</h2>
     <div class="gbox"><div class="gu"><span class="av">${esc(((acct?.name || acct?.email || '?')[0] || '?').toUpperCase())}</span><div><b>${esc(acct?.name || (acct?.email || '').split('@')[0])}</b><br><span class="sub">${esc(acct?.email || '')}</span></div></div>
     <p class="sub" style="margin:10px 0">Your lists, ratings and profiles are saved to this account, so they follow you to any device when you sign in.</p>
     <div class="srow" id="sBioRow" style="margin:12px 0"><div><b>Fingerprint or face unlock</b><span id="sBioTxt">Checking this device…</span></div><button id="sBio" hidden></button></div>
     <label class="chk"><input type="checkbox" id="sGk" ${S.cfg.gSyncKeys ? 'checked' : ''}> Also save my API keys to my account so a new device is ready instantly</label>
     <div class="filters" style="margin-top:12px"><button class="primary" id="sGin">Sync now</button><button id="sPw">Change password</button><button id="sGout">Sign out</button></div>
     <form id="sPwForm" hidden style="margin-top:12px;display:none;gap:8px"><input id="sPw1" type="password" placeholder="New password (8+ characters)" autocomplete="new-password" style="flex:1"><button class="primary" id="sPwGo">Save</button></form></div>
   </section>
   <section class="sp" data-p="dat"><h2>Your data</h2>
     <p class="sub">${Object.keys(S.lib).length} titles saved on this device.</p>
     <div class="filters"><button id="sExp">Export backup</button><button id="sImp">Import backup</button><input type="file" id="sFile" accept=".json" hidden><button id="sClr" class="danger-t">Clear my lists</button></div>
     <p class="sub small tmdb" style="margin-top:22px">This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data is provided by JustWatch.</p>
   </section>
  </div></div>
  <div class="setfoot"><button class="primary" id="sSave">Save</button></div></div>`);
  $$('[data-sec]', d).forEach(b => b.onclick = () => { $$('[data-sec]', d).forEach(x => x.classList.toggle('on', x === b)); $$('.sp', d).forEach(x => x.classList.toggle('on', x.dataset.p === b.dataset.sec)); });
  const seg = (id, fn) => $$('#' + id + ' button', d).forEach(b => b.onclick = () => { $$('#' + id + ' button', d).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); fn(b.dataset.v); });
  seg('sTheme', setTheme); seg('sMotion', setMotion);
  $$('[data-lg]', d).forEach(b => b.onclick = () => { const c = b.dataset.lg; S.cfg.langs = S.cfg.langs.includes(c) ? S.cfg.langs.filter(x => x !== c) : [...S.cfg.langs, c]; b.classList.toggle('on'); });
  const loadProv = async () => {
    try {
      const r = await api('/watch/providers/' + S.cfg.type, { watch_region: $('#sReg').value });
      const reg = $('#sReg').value, list = r.results.sort((a, b) => (a.display_priorities?.[reg] ?? 99) - (b.display_priorities?.[reg] ?? 99)).slice(0, 36);
      $('#sProv').innerHTML = list.map(p => `<button class="${S.cfg.providers.includes(p.provider_id) ? 'on' : ''}" data-pv="${p.provider_id}"><img src="${IMG}w92${p.logo_path}" alt="">${esc(p.provider_name)}</button>`).join('');
      $$('[data-pv]', d).forEach(b => b.onclick = () => { const id = +b.dataset.pv; S.cfg.providers = S.cfg.providers.includes(id) ? S.cfg.providers.filter(x => x !== id) : [...S.cfg.providers, id]; b.classList.toggle('on'); });
    } catch (e) { $('#sProv').innerHTML = S.cfg.key ? errHtml(e) : '<p class="sub">Save your TMDB key first.</p>'; }
  };
  const grab = () => { S.cfg.key = $('#sKey').value.trim(); S.cfg.region = $('#sReg').value; S.cfg.geminiKey = $('#sAi').value.trim(); S.cfg.omdbKey = $('#sOmdb').value.trim(); S.cfg.gSyncKeys = $('#sGk').checked; };
  $('#sReg').onchange = () => { S.cfg.providers = []; loadProv(); };
  loadProv();
  $('#sGin').onclick = async () => { grab(); save(false); if (!hasServer()) return toast('This app has no server set up yet.'); await syncNow(true); };
  const bioDraw = async () => {
    const t = $('#sBioTxt'), b = $('#sBio'); if (!t || !b) return;
    if (!(await bio.supported())) { t.textContent = 'Not available on this device or browser.'; b.hidden = true; return; }
    const on = bio.enabled(); b.hidden = false; b.textContent = on ? 'Turn off' : 'Turn on';
    t.textContent = on ? 'On for this device. After you sign out, one touch brings you back in, and you can lock profiles with it.' : 'Optional. Skip typing your password on this device. Your password still works everywhere.';
  };
  bioDraw();
  $('#sBio').onclick = async e => { const b = e.currentTarget; b.disabled = true; try { if (bio.enabled()) { bio.disable(); toast('Fingerprint unlock is off', 2000); } else { await bio.enable(); toast('Fingerprint unlock is on', 2000); } } catch (x) { toast(esc(x.message), 4000); } b.disabled = false; bioDraw(); };
  $('#sPw').onclick = () => { const f = $('#sPwForm'); f.hidden = !f.hidden; f.style.display = f.hidden ? 'none' : 'flex'; if (!f.hidden) $('#sPw1').focus(); };
  $('#sPwForm').onsubmit = async e => { e.preventDefault(); const v = $('#sPw1').value; if (v.length < 8) return toast('Use at least 8 characters.'); try { await changePassword(v); $('#sPw1').value = ''; $('#sPwForm').hidden = true; $('#sPwForm').style.display = 'none'; toast('Password changed', 2200); } catch (x) { toast(esc(x.message), 4000); } };
  $('#sGout')?.addEventListener('click', () => { closeModal(); signOut(); });
  $('#sExp').onclick = exportData;
  $('#sImp').onclick = () => $('#sFile').click();
  $('#sFile').onchange = async e => { try { const j = JSON.parse(await e.target.files[0].text()); if (j.lib) { const now = Date.now(); for (const k of Object.keys(j.lib)) j.lib[k].ts = Math.max(j.lib[k].ts || 0, now); S.lib = { ...S.lib, ...j.lib }; if (j.meta) S.meta = { ...j.meta, ...S.meta }; save(); toast('Imported ✔', 2000); closeModal(); route(); } } catch { toast('That is not a valid backup file.'); } };
  $('#sClr').onclick = () => { if (confirm('Delete all watchlist, watched, watching and hidden data?')) { const now = Date.now(); for (const k of Object.keys(S.lib)) S.del[k] = now; S.lib = {}; save(); closeModal(); route(); } };
  $('#sSave').onclick = () => { grab(); cache.clear(); save(); closeModal(); route(); };
}

export function exportData() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ lib: S.lib, cfg: { ...S.cfg, key: '' } }, null, 1)], { type: 'application/json' }));
  a.download = 'whats-next-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
}
