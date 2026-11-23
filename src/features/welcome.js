import { toast } from '../core/library.js';
import { ACTIVE, PROFILES, adoptSpace, createProfile, getAccount, isLocked, markOldOffered, oldSpaces, setAccount } from '../core/state.js';
import { syncNow } from '../core/sync.js';
import * as bio from '../core/bio.js';
import { changePassword, clearServer, hasServer, server, sendReset, setServer, signIn, signUp, resume, takeRecovery, whoAmI } from '../core/supa.js';
import { $, esc } from '../core/utils.js';
import { enter, openPicker } from './profiles.js';

const MARK = '<svg class="mark" width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="rgb(var(--acr))"/><path d="M21 19 L41 32 L21 45 Z" fill="var(--onac,#fff)" stroke="var(--onac,#fff)" stroke-width="5" stroke-linejoin="round"/><rect x="45.5" y="17.5" width="6" height="29" rx="3" fill="var(--onac,#fff)"/></svg>';
const FP = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11v3c0 2.5-.6 4.5-1.8 6"/><path d="M8 14.5c0-2.2 1.8-4 4-4s4 1.8 4 4c0 1.7-.2 3.3-.7 4.7"/><path d="M5 14.5a7 7 0 0114 0c0 1.2-.1 2.3-.4 3.4"/><path d="M3.5 9.5A9.5 9.5 0 0112 4.5a9.5 9.5 0 018.5 5"/></svg>';
const EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

/** The only way in: an email and password. Everything inside the app belongs to that account. */
export const shouldWelcome = () => !getAccount();

/** After signing in: bring in older saved data from this browser if there is any, then go in, or let them choose a profile. */
function finish() {
  $('#welcome')?.remove();
  if (!PROFILES.list.length) {
    const old = oldSpaces()[0]; if (old) markOldOffered();
    if (old && confirm(`Found lists saved on this device from your earlier login (${old.profiles} profile${old.profiles > 1 ? 's' : ''}). Bring them into this account?`)) { adoptSpace(old.ns); syncNow(false); }
  }
  if (!PROFILES.list.length) { const a = getAccount(), first = (a?.name || (a?.email || '').split('@')[0] || '').split(' ')[0] || 'Me'; return enter(createProfile({ name: first[0].toUpperCase() + first.slice(1) }).id); }
  const one = PROFILES.list.length === 1 ? PROFILES.list[0] : null;
  if (one && !isLocked(one)) return enter(one.id);
  openPicker();
}

const valid = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function openWelcome() {
  $('#welcome')?.remove(); $('#picker')?.remove();
  const el = document.createElement('div'); el.id = 'welcome'; document.body.appendChild(el);
  el.innerHTML = `<div class="wl-brand">
      <div class="wl-logo" style="--i:0">${MARK}<span>What's <b>Next</b></span></div>
      <h1 style="--i:1">What's next?</h1>
      <p style="--i:2">Tell it what you love. It keeps finding what to watch, for movies and TV, without end.</p>
      <ul style="--i:3"><li>Picks that learn your taste</li><li>A profile for everyone, with a kids mode</li><li>Your lists on every device, private to you</li></ul>
    </div>
    <div class="wl-card" style="--i:2">
      <div class="wl-body" id="wlBody"></div>
      <div class="wl-foot"><small>Your profiles and lists belong to your account. Nobody else can open them.</small><small class="tmdb">This product uses the TMDB API but is not endorsed or certified by TMDB.</small></div>
    </div>`;
  const body = $('#wlBody', el);
  let tab = 'in', recovery = takeRecovery();

  const setup = () => { const s = server(); return s?.fixed ? '' : `<details class="wl-setup" id="wlSetup" ${s ? '' : 'open'}><summary>${s ? 'Server settings' : 'This app needs a one-time server setup'}</summary>
      <p>Create a free project at supabase.com, run <code>supabase/setup.sql</code> in its SQL editor, then paste the Project URL and the anon public key from Project Settings → API.</p>
      <input id="wlUrl" placeholder="https://abcd1234.supabase.co" value="${esc(s?.url || '')}" autocomplete="off" style="margin-bottom:8px">
      <div class="wl-row"><input id="wlKey" placeholder="anon public key" value="${esc(s?.key || '')}" autocomplete="off"><button id="wlSrvSave" type="button">Save</button></div>
      ${s ? '<p><a href="#" id="wlSrvClear">Remove this server</a></p>' : ''}</details>`; };

  const field = (id, label, type, ph, auto) => `<label class="wl-f"><span>${label}</span><div class="wl-in"><input id="${id}" type="${type}" placeholder="${ph}" autocomplete="${auto}" ${type === 'email' ? 'inputmode="email" autocapitalize="off" spellcheck="false"' : ''}>${type === 'password' ? `<button type="button" class="wl-eye" data-eye="${id}" aria-label="Show password" aria-pressed="false">${EYE}</button>` : ''}</div></label>`;

  const draw = (msg = '') => {
    if (recovery) {
      body.innerHTML = `<h2>Choose a new password</h2><p class="mut">Pick something you don't use anywhere else.</p>
        <form id="wlForm" novalidate>${field('wlP1', 'New password', 'password', 'At least 8 characters', 'new-password')}<button class="primary wl-go" id="wlGo">Save password</button></form><div class="err" id="wlErr">${esc(msg)}</div>`;
      $('#wlForm', el).onsubmit = async e => {
        e.preventDefault(); const p = $('#wlP1', el).value, err = $('#wlErr', el);
        if (p.length < 8) return (err.textContent = 'Use at least 8 characters.');
        const b = $('#wlGo', el); b.disabled = true;
        try { await changePassword(p); const u = await whoAmI(); recovery = false; setAccount({ sub: u.id, email: u.email, name: u.name }); toast('Password changed', 2200); finish(); syncNow(false); }
        catch (x) { err.textContent = x.message; b.disabled = false; }
      };
      return;
    }
    const up = tab === 'up', quick = bio.quickList();
    body.innerHTML = `${quick.length ? `<div class="wl-quick">${quick.map(q => `<button type="button" class="wl-bio" data-q="${esc(q.sub)}">${FP}<span>Unlock as <b>${esc(q.name || q.email.split('@')[0])}</b><small>${esc(q.email)}</small></span></button>`).join('')}<div class="wl-or">or use your password</div></div>` : ''}<div class="wl-tabs" data-tab="${tab}" role="tablist"><span class="thumb"></span><button type="button" role="tab" data-tab="in" aria-selected="${!up}">Sign in</button><button type="button" role="tab" data-tab="up" aria-selected="${up}">Create account</button></div>
      <form id="wlForm" novalidate>
        ${up ? field('wlName', 'Your name <em>optional</em>', 'text', 'What should we call you?', 'name') : ''}
        ${field('wlEmail', 'Email', 'email', 'you@example.com', 'email')}
        ${field('wlPass', 'Password', 'password', up ? 'At least 8 characters' : 'Your password', up ? 'new-password' : 'current-password')}
        <button class="primary wl-go" id="wlGo">${up ? 'Create account' : 'Sign in'}</button>
        ${up ? '' : '<a href="#" class="wl-forgot" id="wlForgot">Forgot your password?</a>'}
      </form><div class="err" id="wlErr" role="alert">${esc(msg)}</div>${setup()}`;
    $$tabs();
    el.querySelectorAll('[data-q]').forEach(b => { b.onclick = () => quickIn(b.dataset.q, b); });
    $('#wlForm', el).onsubmit = submit;
    $('#wlForgot', el)?.addEventListener('click', async e => {
      e.preventDefault(); const mail = $('#wlEmail', el).value.trim().toLowerCase(), err = $('#wlErr', el);
      if (!valid(mail)) return (err.textContent = 'Type your email above, then tap this again.');
      if (!hasServer()) return (err.textContent = 'Set up the server first.');
      try { await sendReset(mail); err.style.color = 'var(--ok)'; err.textContent = 'If that email has an account, a reset link is on its way. Open it on this device.'; } catch (x) { err.textContent = x.message; }
    });
    $('#wlSrvSave', el)?.addEventListener('click', () => { try { setServer($('#wlUrl', el).value, $('#wlKey', el).value); toast('Saved. Now sign in or create your account.', 2600); draw(); } catch (x) { $('#wlErr', el).textContent = x.message; } });
    $('#wlSrvClear', el)?.addEventListener('click', e => { e.preventDefault(); clearServer(); draw(); });
  };
  const $$tabs = () => {
    el.querySelectorAll('[data-tab]').forEach(b => { if (b.tagName === 'BUTTON') b.onclick = () => { tab = b.dataset.tab; draw(); $('#wlEmail', el)?.focus(); }; });
    el.querySelectorAll('[data-eye]').forEach(b => { b.onclick = () => { const i = $('#' + b.dataset.eye, el), on = i.type === 'password'; i.type = on ? 'text' : 'password'; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Hide password' : 'Show password'); }; });
  };
  async function quickIn(sub, btn) {
    const q = bio.quickList().find(x => x.sub === sub), err = $('#wlErr', el); if (!q) return;
    err.style.color = ''; err.textContent = ''; btn.disabled = true;
    try {
      await bio.unlockEntry(q);
      let u; try { u = await resume(q.rt); } catch (x) { bio.consume(sub); throw new Error('That quick unlock expired. Sign in with your password.'); }
      bio.consume(sub); setAccount({ sub: u.id, email: u.email || q.email, name: u.name || q.name });
      await syncNow(false); finish();
    } catch (x) { err.textContent = x.message; btn.disabled = false; if (/expired/.test(x.message)) draw(x.message); }
  }
  async function submit(e) {
    e.preventDefault(); const err = $('#wlErr', el); err.style.color = ''; err.textContent = '';
    if (!hasServer()) return (err.textContent = 'Set up the server first (below).');
    const mail = $('#wlEmail', el).value.trim().toLowerCase(), pw = $('#wlPass', el).value, up = tab === 'up', name = $('#wlName', el)?.value || '';
    if (!valid(mail)) return (err.textContent = 'That email address does not look right.');
    if (up && pw.length < 8) return (err.textContent = 'Use at least 8 characters for your password.');
    if (!pw) return (err.textContent = 'Type your password.');
    const b = $('#wlGo', el); b.disabled = true; b.classList.add('busy');
    try {
      let u;
      if (up) { const r = await signUp(mail, pw, name); if (r.confirm) { b.disabled = false; b.classList.remove('busy'); tab = 'in'; return draw('We sent a confirmation link to ' + mail + '. Open it, then sign in here.'); } u = r.user; }
      else u = await signIn(mail, pw);
      setAccount({ sub: u.id, email: u.email || mail, name: u.name || name });
      await syncNow(false);          // brings this account's saved lists down before anything is shown
      finish();
    } catch (x) { err.textContent = x.message; b.disabled = false; b.classList.remove('busy'); }
  }
  draw();
  $('#wlEmail', el)?.focus({ preventScroll: true });
}
