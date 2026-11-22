// The assistant lives in a bubble at the bottom corner of every page.
import { ASK, ASK_IDEAS, CHAT, askTurn, paintChat } from './ask.js';
import { S } from '../core/state.js';
import { $, esc } from '../core/utils.js';

const SPARK = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/></svg>';
const SPARK_S = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';
const X = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const fab = () => $('#aiFab'), panel = () => $('#aiPanel');
export const isOpen = () => !!panel() && !panel().hidden;

function build() {
  let p = panel(); if (p) return p;
  p = document.createElement('section'); p.id = 'aiPanel'; p.hidden = true; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Ask What\'s Next');
  p.innerHTML = `<div class="aih"><span class="aiav" aria-hidden="true">${SPARK_S}</span><div><b>What's Next AI</b><span class="sub" id="aiMode"></span></div><button class="aix" id="aiNew" title="Start a new chat">New chat</button></div>
    <div class="chat" id="chat"></div>
    <div class="chips" id="aiIdeas">${ASK_IDEAS.map(x => `<button class="chip" data-idea>${esc(x)}</button>`).join('')}</div>
    <label class="gemchk"><input type="checkbox" id="askGem"><span>💎 Hidden gems only</span></label>
    <form id="askF" class="askbar"><input id="askI" placeholder="Describe your vibe, or ask for a movie like…" autocomplete="off"><button class="send" aria-label="Send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></form>`;
  document.body.appendChild(p);
  const go = t => { $('#askI').value = ''; $('#aiIdeas').hidden = true; askTurn(t); };
  $('#askF', p).onsubmit = e => { e.preventDefault(); go($('#askI').value); };
  p.querySelectorAll('[data-idea]').forEach(b => b.onclick = () => go(b.textContent));
  $('#aiNew', p).onclick = () => { CHAT.length = 0; $('#aiIdeas').hidden = false; paintChat(); };
  return p;
}

export function openAssistant(pre) {
  const p = build(), f = fab(); if (!f) return;
  $('#aiMode', p).innerHTML = S.cfg.geminiKey ? '<i class="dot on"></i>AI on, spoiler-free' : '<i class="dot"></i>Basic mode. Add a Gemini key in Settings.';
  p.hidden = false; f.classList.add('on'); f.innerHTML = X; f.setAttribute('aria-expanded', 'true'); f.setAttribute('aria-label', 'Close assistant');
  $('#aiIdeas', p).hidden = CHAT.length > 0; paintChat();
  requestAnimationFrame(() => p.classList.add('open'));
  if (pre && String(pre).trim()) { ASK.pre = ''; $('#aiIdeas', p).hidden = true; askTurn(pre); } else setTimeout(() => $('#askI')?.focus({ preventScroll: true }), 120);
}
export function closeAssistant() {
  const p = panel(), f = fab(); if (!p || p.hidden) return;
  p.classList.remove('open'); f.classList.remove('on'); f.innerHTML = SPARK; f.setAttribute('aria-expanded', 'false'); f.setAttribute('aria-label', 'Ask What\'s Next');
  setTimeout(() => { if (!p.classList.contains('open')) p.hidden = true; }, 200);
}
export const toggleAssistant = () => (isOpen() ? closeAssistant() : openAssistant());

/** Show the bubble only while someone is signed in and inside the app. */
export function showBubble(on) { const f = fab(); if (!f) return; f.hidden = !on; if (!on) { closeAssistant(); const p = panel(); if (p) p.hidden = true; } }

const f0 = fab(); if (f0) { f0.innerHTML = SPARK; f0.onclick = toggleAssistant; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen() && !$('#qv')) closeAssistant(); });
