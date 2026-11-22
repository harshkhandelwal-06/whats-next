import { toast } from '../core/library.js';
import { S, save } from '../core/state.js';
import { gClient, syncNow } from '../core/sync.js';
import { $, key } from '../core/utils.js';
import { route } from '../router.js';

export function pageSetup(m) {
  const g = gClient();
  m.innerHTML = `<div class="setup"><h1>Welcome</h1><p class="sub">What's Next uses TMDB (free) for posters, cast, trailers, reviews and streaming info. One-time setup:</p>
  <ol><li>Create a free account at <a target="_blank" rel="noopener" href="https://www.themoviedb.org/signup">themoviedb.org</a></li>
  <li>Go to Settings → API and request a key (choose personal use)</li>
  <li>Copy the <b>API Key</b> (short) or the <b>API Read Access Token</b> (long) and paste it below</li></ol>
  <input id="keyIn" placeholder="Paste your TMDB key or token"><button class="primary" id="keySave">Save and start</button>
  <hr style="border:0;border-top:1px solid var(--line);margin:22px 0 16px">
  <p class="sub">Already use What's Next on another device? Restore your lists and keys from Google.</p>
  ${g ? '' : '<input id="gcIn" placeholder="Google OAuth Client ID (see README)" style="margin-bottom:10px">'}
  <button id="gRestore">Restore with Google</button></div>`;
  $('#keySave').onclick = () => { const v = $('#keyIn').value.trim(); if (v.length < 20) return toast('That does not look like a TMDB key.'); S.cfg.key = v; save(); location.hash = '#/'; route(); };
  $('#gRestore').onclick = () => { const c = $('#gcIn')?.value.trim(); if (c) { S.cfg.gClient = c; save(false); } if (!gClient()) return toast('Paste a Google OAuth Client ID first.'); syncNow(true); };
}
