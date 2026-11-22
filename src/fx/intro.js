import { fxLevel } from './mode.js';
// One short title sequence per browser session: letters rise, a line draws, the curtain lifts.
export function playIntro() {
  let seen = false; try { seen = sessionStorage.getItem('wn:intro') === '1'; sessionStorage.setItem('wn:intro', '1'); } catch {}
  if (seen || fxLevel() === 'off') return Promise.resolve();
  return new Promise(res => {
    const el = document.createElement('div'); el.id = 'intro';
    el.innerHTML = `<div class="in-word">${[..."What's Next"].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</div><i class="in-line"></i>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 750);
    setTimeout(() => { el.remove(); res(); }, 1350);
    el.onclick = () => { el.remove(); res(); };
  });
}
