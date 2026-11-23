import { COLORS } from '../core/defaults.js';
import { ACTIVE, PROFILES, S, activate, clearAccount, createProfile, deleteProfile, getAccount, isLocked, isUnlocked, pinHash, unlock, updateProfile } from '../core/state.js';
import { toast } from '../core/library.js';
import { $, esc } from '../core/utils.js';
import { route } from '../router.js';
import { closeModal } from '../ui/settings.js';
import * as bio from '../core/bio.js';
import { refreshToken, signOutRemote } from '../core/supa.js';
import { syncNow } from '../core/sync.js';
import { openWelcome } from './welcome.js';
import { showBubble } from './aibubble.js';

const cur = () => PROFILES.list.find(p => p.id === ACTIVE.id);
const rgb = c => `rgb(${c})`;
const ini = n => (String(n || '?').trim().charAt(0) || '?').toUpperCase();
const PAL = ['255,90,31', '49,57,251', '10,132,255', '48,176,199', '52,199,89', '255,159,10', '255,55,95', '175,82,222'];
/** Avatar colour: the profile's own colour, or a stable one picked from its name so profiles are easy to tell apart. */
export const avColor = p => p?.color || PAL[[...String(p?.name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];

/** Header avatar button reflects who is watching. */
export function renderWho() {
  const b = $('#who'); if (!b) return;
  const p = cur();
  b.hidden = !ACTIVE.id; showBubble(!!ACTIVE.id);
  const name = p?.name || '', col = avColor(p);
  b.innerHTML = ACTIVE.id ? `<span class="av" style="--c:${col}">${esc(ini(name))}</span><em>${esc(name)}</em><svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>` : '';
  b.title = 'Account';
  const av = $('#acctAv'); if (av) { av.textContent = ini(name); av.style.setProperty('--c', col); }
  const n = $('#acctName'); if (n) n.textContent = name;
  const sub = $('#acctSub'); if (sub) sub.textContent = p?.kids ? 'Kids profile' : getAccount()?.email || '';
  document.body.classList.toggle('is-kids', !!p?.kids);
}

export function enter(id) {
  if (!activate(id)) return;
  $('#picker')?.remove(); renderWho(); location.hash = '#/foryou'; route(true);
}

const bioOn = p => !!p.bio && bio.enabled();
async function tryBio(p) {
  try { await bio.verify(); unlock(p.id); enter(p.id); return true; } catch (e) { const er = $('#pinErr'); if (er) er.textContent = e.message; return false; }
}
function askLock(p) { if (bioOn(p)) { askPin(p, true); tryBio(p); } else askPin(p); }
function askPin(p, auto = false) {
  const d = $('#pinBox'); d.hidden = false;
  d.innerHTML = `<p>${bioOn(p) ? `Unlock <b>${esc(p.name)}</b>` : `Enter the PIN for <b>${esc(p.name)}</b>`}</p>${bioOn(p) ? '<button class="btn" id="pinBio">Use fingerprint or face</button>' : ''}${p.pin ? `<input id="pinIn" inputmode="numeric" maxlength="6" type="password" autocomplete="off" placeholder="${bioOn(p) ? 'Or type the PIN' : ''}">` : ''}<div class="err" id="pinErr"></div>`;
  $('#pinBio')?.addEventListener('click', () => tryBio(p));
  const i = $('#pinIn'); if (!i) return; if (!auto) i.focus();
  i.oninput = () => { if (i.value.length >= 4 && pinHash(i.value) === p.pin) { unlock(p.id); enter(p.id); } else if (i.value.length >= 6) { $('#pinErr').textContent = 'Wrong PIN. Try again.'; i.value = ''; } };
}

/** Full-screen "Who's watching?" picker. */
export function openPicker({ manage = false } = {}) {
  closeModal(); $('#picker')?.remove();
  const el = document.createElement('div'); el.id = 'picker'; document.body.appendChild(el);
  const draw = () => {
    el.innerHTML = `<div class="pk-in">
      <h1>${manage ? 'Manage profiles' : "Who's watching?"}</h1>
      <div class="pk-grid">
        ${PROFILES.list.map(p => `<button class="pk" data-id="${p.id}" style="--c:${avColor(p)}"><span class="av big">${esc(ini(p.name))}</span><b>${esc(p.name)}</b>${p.kids ? '<small>Kids</small>' : p.pin ? '<small>PIN protected</small>' : bioOn(p) ? '<small>Fingerprint locked</small>' : ''}${manage ? '<i class="pen">✎</i>' : ''}</button>`).join('')}
        <button class="pk add" data-add><span class="av big">＋</span><b>Add profile</b></button>
      </div>
      <div id="pinBox" class="pinbox" hidden></div>
      <div class="pk-foot">
        ${manage ? '<button class="btn" data-done>Done</button>' : '<button class="btn ghost" data-manage>Manage profiles</button>'}
        ${ACTIVE.id && !manage ? '<button class="btn ghost" data-back>Cancel</button>' : ''}${!manage ? '<button class="btn ghost" data-out>Sign out</button>' : ''}
      </div></div>`;
    el.querySelectorAll('.pk[data-id]').forEach(b => b.onclick = () => {
      const p = PROFILES.list.find(x => x.id === b.dataset.id);
      if (manage) return editor(p);
      if (isLocked(p)) return askLock(p);
      enter(p.id);
    });
    el.querySelector('[data-add]').onclick = () => editor(null);
    el.querySelector('[data-out]')?.addEventListener('click', signOut);
    el.querySelector('[data-manage]')?.addEventListener('click', () => openPicker({ manage: true }));
    el.querySelector('[data-done]')?.addEventListener('click', () => { el.remove(); if (!ACTIVE.id) openPicker(); });
    el.querySelector('[data-back]')?.addEventListener('click', () => el.remove());
  };
  const editor = p => {
    const st = { emoji: p?.emoji || '🎬', color: p ? p.color : '', kids: !!p?.kids };
    el.innerHTML = `<div class="pk-in ed"><h1>${p ? 'Edit profile' : 'New profile'}</h1>
      <div class="ed-prev"><span class="av big" id="edAv" style="--c:${st.color || avColor(p || { name: '' })}">${esc(ini(p?.name || '?'))}</span></div>
      <input id="edName" maxlength="18" placeholder="Name" value="${esc(p?.name || '')}">
      <div class="ed-row" id="edColor">${COLORS.map(c => `<button data-c="${c}" class="sw ${c === st.color ? 'on' : ''}" style="--c:${c || 'var(--acr)'}" aria-label="${c ? 'colour' : 'theme colour'}" title="${c ? '' : 'Follow the theme'}"></button>`).join('')}</div>
      <label class="chk"><input type="checkbox" id="edKids" ${st.kids ? 'checked' : ''}> Kids profile (family-friendly titles only)</label>
      <input id="edPin" inputmode="numeric" maxlength="6" placeholder="${p?.pin ? 'New PIN (blank keeps the current one)' : 'Optional PIN, 4 to 6 digits'}">
      ${p?.pin ? '<label class="chk"><input type="checkbox" id="edNoPin"> Remove PIN</label>' : ''}
      ${bio.enabled() ? `<label class="chk"><input type="checkbox" id="edBio" ${p?.bio ? 'checked' : ''}> Lock with fingerprint or face on this device</label>` : '<p class="sub small">To lock a profile with your fingerprint or face, turn it on first in Settings → Account.</p>'}
      <div class="err" id="edErr"></div>
      <div class="pk-foot"><button class="btn" id="edSave">Save</button><button class="btn ghost" id="edCancel">Cancel</button>${p ? '<button class="btn danger" id="edDel">Delete profile</button>' : ''}</div></div>`;
    const sync = () => { const a = $('#edAv'); a.textContent = ini($('#edName').value || '?'); a.style.setProperty('--c', st.color || avColor({ name: $('#edName').value })); };
    $('#edName').addEventListener('input', sync);
    $('#edColor').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; st.color = b.dataset.c; $('#edColor .on')?.classList.remove('on'); b.classList.add('on'); sync(); };
    $('#edCancel').onclick = draw;
    $('#edSave').onclick = () => {
      const name = $('#edName').value.trim(), pin = $('#edPin').value.trim(), err = $('#edErr');
      if (!name) return err.textContent = 'Give the profile a name.';
      if (pin && !/^\d{4,6}$/.test(pin)) return err.textContent = 'A PIN is 4 to 6 digits.';
      const kids = $('#edKids').checked;
      if (p) updateProfile(p.id, { name, emoji: st.emoji, color: st.color, kids, ...($('#edBio') ? { bio: $('#edBio').checked } : {}), ...(pin ? { pin } : $('#edNoPin')?.checked ? { pin: '' } : {}) });
      else createProfile({ name, emoji: st.emoji, color: st.color, kids, pin, bio: !!$('#edBio')?.checked });
      renderWho(); draw();
    };
    $('#edDel')?.addEventListener('click', () => {
      if (!confirm(`Delete ${p.name}? Their watchlist and ratings are removed.`)) return;
      const was = ACTIVE.id === p.id; deleteProfile(p.id); renderWho(); if (was) openPicker({ manage: true }); else draw();
    });
  };
  draw();
}

/** Menu from the header avatar. */
export const openWhoMenu = () => openPicker();

export async function signOut() {
  // push the last changes first (never wait more than a moment), then forget the login on this device
  try { await Promise.race([syncNow(false), new Promise(r => setTimeout(r, 2500))]); } catch {}
  const kept = bio.stash(refreshToken());   // fingerprint/face unlock keeps the login valid so it can bring you back
  await signOutRemote(kept); clearAccount();
  $('#picker')?.remove(); renderWho(); $('#view').innerHTML = ''; openWelcome();
}
// the server ended this login (password changed elsewhere, or it expired)
document.addEventListener('wn:authlost', () => { if (!getAccount()) return; toast('Your login ended. Sign in again to keep syncing.', 5000); signOut(); });

export function initProfiles() {
  renderWho();
  if (!getAccount()) openWelcome();
  else if (!ACTIVE.id) openPicker();
}
