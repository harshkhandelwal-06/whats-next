// Effects level: full, lite or off. Reduced-motion users start on "off".
const K = 'wn:fx';
const reduce = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const fxLevel = () => { try { return localStorage.getItem(K) || (reduce() ? 'off' : 'full'); } catch { return 'full'; } };
export const setFx = v => { try { localStorage.setItem(K, v); } catch {} document.documentElement.dataset.fx = v; window.dispatchEvent(new Event('wn:fx')); };
export const cycleFx = () => { const n = { full: 'lite', lite: 'off', off: 'full' }[fxLevel()]; setFx(n); return n; };
document.documentElement.dataset.fx = fxLevel();
