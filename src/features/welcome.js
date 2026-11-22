import { toast } from '../core/library.js';
import { ACTIVE, PROFILES, S, createProfile, getAccount, isUnlocked, save } from '../core/state.js';
import { gClient, syncNow } from '../core/sync.js';
import { $, esc } from '../core/utils.js';
import { enter, openPicker } from './profiles.js';

const G = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
const MARK = '<svg class="mark" width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="rgb(var(--acr))"/><path d="M21 19 L41 32 L21 45 Z" fill="var(--onac,#fff)" stroke="var(--onac,#fff)" stroke-width="5" stroke-linejoin="round"/><rect x="45.5" y="17.5" width="6" height="29" rx="3" fill="var(--onac,#fff)"/></svg>';

/** The only way in: sign in with Google. Everything inside the app belongs to that Google account. */
export const shouldWelcome = () => !getAccount();

/** After a successful Google sign-in: go straight in when there is one profile, otherwise let them choose or create. */
function finish() {
  $('#welcome')?.remove();
  if (!PROFILES.list.length) { const first = (getAccount()?.name || '').split(' ')[0] || 'Me'; return enter(createProfile({ name: first }).id); }
  const one = PROFILES.list.length === 1 ? PROFILES.list[0] : null;
  if (one && (!one.pin || isUnlocked(one.id))) return enter(one.id);
  openPicker();
}

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
      <div class="wl-foot"><small>Your profiles and lists belong to your Google account. Nobody else can open them.</small><small class="tmdb">This product uses the TMDB API but is not endorsed or certified by TMDB.</small></div>
    </div>`;
  const body = $('#wlBody', el);
  const setup = () => gClient() ? '' : `<details class="wl-setup" id="wlSetup"><summary>Google sign-in needs a one-time setup</summary>
      <p>Create a free OAuth client in Google Cloud Console (type Web application), add <code>${esc(location.origin)}</code> as an authorized JavaScript origin, enable the Google Drive API, then paste the Client ID here.</p>
      <div class="wl-row"><input id="wlCid" placeholder="123456789-abc.apps.googleusercontent.com" autocomplete="off"><button id="wlCidSave">Save</button></div></details>`;
  const draw = () => {
    body.innerHTML = `<h2>Sign in to continue</h2><p class="mut">Use your Google account to open What's Next. New here? The same button creates your account.</p>
      <button class="google" id="wlG">${G}<span>Continue with Google</span></button>${setup()}<div class="err" id="wlErr"></div>`;
    $('#wlG', el).onclick = async e => {
      const b = e.currentTarget;
      if (!gClient()) { const d = $('#wlSetup', el); if (d) { d.open = true; $('#wlCid', el)?.focus(); } return; }
      b.disabled = true; b.classList.add('busy');
      await syncNow(true);
      b.disabled = false; b.classList.remove('busy');
      if (getAccount()) finish();
    };
    $('#wlCidSave', el)?.addEventListener('click', () => { const v = $('#wlCid', el).value.trim(); if (!/\.apps\.googleusercontent\.com$/.test(v)) return toast('That does not look like a Client ID. It ends in .apps.googleusercontent.com', 3600); S.cfg.gClient = v; save(false); toast('Saved. Now continue with Google.'); draw(); });
  };
  draw();
  $('#wlG', el)?.focus({ preventScroll: true });
}
