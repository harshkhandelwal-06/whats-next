import { toast } from '../core/library.js';
import { S, save } from '../core/state.js';
import { $, key } from '../core/utils.js';
import { route } from '../router.js';

export function pageSetup(m) {
  m.innerHTML = `<div class="setup"><h1>Welcome</h1><p class="sub">What's Next uses TMDB (free) for posters, cast, trailers, reviews and streaming info. One-time setup:</p>
  <ol><li>Create a free account at <a target="_blank" rel="noopener" href="https://www.themoviedb.org/signup">themoviedb.org</a></li>
  <li>Go to Settings → API and request a key (choose personal use)</li>
  <li>Copy the <b>API Key</b> (short) or the <b>API Read Access Token</b> (long) and paste it below</li></ol>
  <input id="keyIn" placeholder="Paste your TMDB key or token"><button class="primary" id="keySave">Save and start</button>
  <p class="sub" style="margin-top:18px">Already set this up on another device? Your TMDB key is saved to your account when \"Also save my API keys\" is ticked in Settings, so it will already be here.</p></div>`;
  $('#keySave').onclick = () => { const v = $('#keyIn').value.trim(); if (v.length < 20) return toast('That does not look like a TMDB key.'); S.cfg.key = v; save(); location.hash = '#/'; route(); };
}
