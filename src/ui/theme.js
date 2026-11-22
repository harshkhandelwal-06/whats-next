// Light, dark, or follow the system. The choice is stored on this device and applied before first paint (see index.html).
const K = 'wn:theme';
export const themePref = () => { try { return localStorage.getItem(K) || 'system'; } catch { return 'system'; } };
export const resolved = () => { const p = themePref(); return p === 'system' ? (matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : p; };
export function applyThemeMode() {
  const r = resolved(); document.documentElement.dataset.theme = r;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', r === 'light' ? '#F7F6F2' : '#0B0B0D');
}
export function setTheme(p) { try { localStorage.setItem(K, p); } catch {} applyThemeMode(); }
export function toggleTheme() { try { localStorage.setItem(K, resolved() === 'light' ? 'dark' : 'light'); } catch {} applyThemeMode(); return resolved(); }
const ICON = {
  sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};
document.addEventListener('DOMContentLoaded', applyThemeMode);
if (document.readyState !== 'loading') applyThemeMode();
matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => themePref() === 'system' && applyThemeMode());
