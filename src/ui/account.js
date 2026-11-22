import { openPicker, signOut } from '../features/profiles.js';
import { gClient, syncNow } from '../core/sync.js';
import { $, $$ } from '../core/utils.js';
import { openSettings } from './settings.js';
import { applyThemeMode, themePref } from './theme.js';

/* One account menu replaces the separate sync, theme and settings buttons. */
const menu = () => $('#acct'), btn = () => $('#who');

export function closeAcct() { const m = menu(); if (!m || m.hidden) return; m.hidden = true; btn()?.setAttribute('aria-expanded', 'false'); }
export function openAcct() {
  const m = menu(); if (!m) return; m.hidden = false; btn()?.setAttribute('aria-expanded', 'true');
  $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.th === themePref()));
  const t = $('#syncTxt'); if (t) t.textContent = gClient() ? ($('#sync').classList.contains('ok') ? 'On' : $('#sync').classList.contains('err') ? 'Problem' : 'Reconnect') : 'Set up';
}
const toggle = () => (menu().hidden ? openAcct() : closeAcct());

btn().addEventListener('click', e => { e.stopPropagation(); toggle(); });
document.addEventListener('click', e => { if (!e.target.closest('#acct') && !e.target.closest('#who')) closeAcct(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAcct(); });
menu().addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.th) { try { localStorage.setItem('wn:theme', b.dataset.th); } catch {} applyThemeMode(); return openAcct(); }
  const id = b.id;
  if (id === 'switchP') { closeAcct(); return openPicker(); }
  if (id === 'signout') { closeAcct(); return signOut(); }
  if (id === 'gear') { closeAcct(); return openSettings(); }
  if (id === 'sync') { closeAcct(); return !gClient() ? openSettings() : syncNow(true); }
});
