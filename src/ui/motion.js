// Animation level for this device: full, lite (shorter, no blur) or off. Stored locally like the theme.
const K = 'wn:motion';
export const MODES = ['full', 'lite', 'off'];
export const motion = () => { try { const v = localStorage.getItem(K); if (MODES.includes(v)) return v; } catch {} return matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'lite' : 'full'; };
export const applyMotion = () => { document.documentElement.dataset.motion = motion(); };
export const setMotion = m => { try { localStorage.setItem(K, m); } catch {} applyMotion(); };
const SCALE = { full: 1, lite: .5, off: 0 };
// Every Web Animations call in the app goes through this, so the setting applies everywhere.
if (typeof Element !== 'undefined' && Element.prototype.animate && !Element.prototype.animate.__wn) {
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (kf, o) {
    const f = SCALE[motion()];
    if (f !== 1 && o && typeof o === 'object') o = { ...o, duration: Math.max(0, (o.duration || 0) * f), delay: (o.delay || 0) * f };
    return orig.call(this, kf, o);
  };
  Element.prototype.animate.__wn = true;
}
applyMotion();

/** Remove a card smoothly: it fades and shrinks, then its neighbours glide into the gap. */
export function vanish(el) {
  const par = el.parentElement;
  if (!par || typeof el.animate !== 'function' || motion() === 'off') { el.remove(); return; }
  const sib = [...par.children].filter(c => c !== el && c.nodeType === 1);
  const before = new Map(sib.map(c => [c, c.getBoundingClientRect()]));
  const gone = el.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.9)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
  const done = () => {
    if (!el.isConnected) return;
    el.remove();
    for (const c of sib) {
      const a = before.get(c), b = c.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  };
  gone.finished ? gone.finished.then(done, done) : done();
}
