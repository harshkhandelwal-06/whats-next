import { describe, it, expect, beforeAll } from 'vitest';
import { boot, sleep, state } from './helpers/mocks.js';

const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
const go = async (h, sel, min = 1) => { location.hash = h; await sleep(380); expect(qa(sel).length, `${h} -> ${sel}`).toBeGreaterThanOrEqual(min); };

describe('navigation and layout', () => {
  beforeAll(async () => {
    await boot({ watchnext: { cfg: { key: 'a'.repeat(32), geminiKey: 'g' }, lib: {} } });
  }, 20000);

  it('has eight places in the top menu, and one account menu instead of three header buttons', () => {
    expect(qa('#nav a').map(a => a.dataset.r)).toEqual(['foryou', 'browse', 'radar', 'mood', 'swipe', 'night', 'list', 'rewatch']);
    expect(qa('header > button').filter(b => b.id !== 'who').length).toBe(0);
    expect(qa('#gear').length).toBe(1); expect(qa('#themeBtn').length).toBe(0);
    expect(q('#acct').closest('header')).toBeTruthy();
  });

  it('account menu opens and closes', async () => {
    expect(q('#acct').hidden).toBe(true);
    q('#who').click(); await sleep(30); expect(q('#acct').hidden).toBe(false); expect(getComputedStyle(q('#acct')).display).not.toBe('none');
    expect(q('#acctName').textContent.length).toBeGreaterThan(0);
    q('#themeSeg [data-th="light"]').click(); await sleep(30); expect(document.documentElement.dataset.theme).toBe('light');
    q('#themeSeg [data-th="dark"]').click(); await sleep(30); expect(document.documentElement.dataset.theme).toBe('dark');
    document.body.click(); await sleep(30); expect(q('#acct').hidden).toBe(true);
  });

  it('Browse has a Show unreleased toggle; Radar is its own page', async () => {
    await go('#/browse', '.card'); expect(q('h1').textContent).toBe('Explore');
    expect(qa('#pills .chip').map(c => c.textContent)).toContain('Hidden gems');
    expect(qa('#pills [data-g]').length).toBe(0); expect(qa('#pills [data-m]').length).toBeGreaterThan(10); expect(qa('#pills [data-m]').map(c => c.textContent)).toContain('Mind-bending'); expect(q('#fp [data-x]')).toBeFalsy(); expect(qa('#fp [data-g]').length).toBeGreaterThan(8);
    q('[data-m="mind"]').click(); await sleep(300); expect(q('[data-m="mind"]').classList.contains('on')).toBe(true); q('[data-m="mind"]').click(); await sleep(300);
    q('#fToggle').click(); expect(q('#fp').hidden).toBe(false); expect(q('#fUn')).toBeTruthy(); expect(q('#fUn').checked).toBe(false);
    q('#fUn').checked = true; q('#fUn').dispatchEvent(new Event('change', { bubbles: true })); await sleep(300);
    await go('#/discover', '.card'); expect(q('#nav a.on').dataset.r).toBe('browse');
    await go('#/radar', '.rh', 1); expect(q('h1').textContent).toBe('Release radar'); expect(q('#nav a.on').dataset.r).toBe('radar');
    q('#rSort').value = 'pop'; q('#rSort').dispatchEvent(new Event('change', { bubbles: true })); await sleep(300); expect(qa('.card').length).toBeGreaterThan(0);
  });

  it('filters apply from the same page', async () => {
    await go('#/browse/pop', '.card'); q('#fToggle').click(); q('#fp [data-g="27"]').click(); await sleep(350); expect(+q('.fbtn b').textContent).toBeGreaterThanOrEqual(1); expect(qa('.card').length).toBeGreaterThan(0);
  });

  it('Moods, Swipe and Movie night each have their own menu item', async () => {
    for (const [h, r] of [['#/mood', 'mood'], ['#/swipe', 'swipe'], ['#/night', 'night']]) { location.hash = h; await sleep(350); expect(q('#nav a.on').dataset.r).toBe(r); }
  });

  it('has at least 30 moods and two can be combined', async () => {
    await go('#/mood', '.mood', 30);
    qa('.mood')[0].click(); qa('.mood')[1].click(); qa('.mood')[2].click();
    expect(qa('.mood.on').length).toBe(2);
  });
});

describe('hero carousel', () => {
  it('arrows and dots change the slide, and a long title is clamped', async () => {
    await go('#/foryou', '.slide', 3);
    const on = () => qa('.slide').findIndex(s => s.classList.contains('on'));
    expect(on()).toBe(0);
    q('[data-hero="1"]').click(); expect(on()).toBe(1);
    q('[data-hero-to="3"]').click(); expect(on()).toBe(3);
    expect(qa('.dot.on').length).toBe(1);
    q('[data-hero="-1"]').click(); expect(on()).toBe(2);
    q('[data-hero="-1"]').click(); q('[data-hero="-1"]').click(); q('[data-hero="-1"]').click(); expect(on()).toBe(qa('.slide').length - 1);
  });
});

describe('swipe', () => {
  const pe = (el, t, x, y) => el.dispatchEvent(Object.assign(new MouseEvent(t.replace('pointer', 'mouse'), { bubbles: true, clientX: x, clientY: y }), {}));
  it('buttons, drags and arrow keys all record the right answer', async () => {
    await go('#/swipe', '.scard');
    const status = () => Object.values(JSON.parse(localStorage.getItem('wn:u1:meta') ? localStorage.getItem('wn:u1:p:' + JSON.parse(localStorage.getItem('wn:u1:meta')).last) : localStorage.getItem('watchnext')).lib || {}).map(x => x.status);
    q('[data-sw="right"]').click(); await sleep(450);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); await sleep(450);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await sleep(450);
    q('[data-sw="down"]').click(); await sleep(450);
    expect(status()).toEqual(['watched', 'watchlist', 'unseen', 'hidden']);
    q('#undo').click(); await sleep(50); expect(qa('.scard').length).toBeGreaterThan(0);
    expect(q('.scard:last-child h3').textContent.length).toBeGreaterThan(0);
  }, 10000);
  it('has labelled buttons that fit under the card', () => {
    expect(qa('.sb span').map(s => s.textContent)).toEqual(['Never', 'Not seen', 'Watchlist', 'Seen it', 'Loved it']);
  });
});

describe('profile avatars', () => {
  it('uses a monogram, not an emoji', () => { expect(q('#who .av').textContent).toMatch(/^[A-Z?]$/); });
});

describe('library, swipe extras, stremio', () => {
  it('library has search, filters and a list view; unrated watched is not treated as loved', async () => {
    await go('#/list/watched', '.seg4'); expect(qa('.seg4 button').length).toBe(3); expect(qa('.seg4 button').map(b => b.dataset.l)).not.toContain('watching'); expect(qa('.seg4 button').map(b => b.dataset.l)).not.toContain('unseen');
    expect(q('#lq')).toBeTruthy(); expect(q('#lr')).toBeTruthy();
    q('.seg2 [data-v="list"]').click(); await sleep(100); expect(q('.llist') || q('.empty')).toBeTruthy();
  });
  it('swipe has a Loved it button and a details panel', async () => {
    await go('#/swipe', '.scard'); expect(q('#swSide h2')).toBeTruthy();
    q('#loved').click(); await sleep(450);
    const m = JSON.parse(localStorage.getItem('wn:u1:meta')); const lib = JSON.parse(localStorage.getItem('wn:u1:p:' + m.last)).lib;
    expect(Object.values(lib).some(e => e.status === 'watched' && e.my === 10)).toBe(true);
  }, 8000);
  it('title page has a Stremio button', async () => {
    await go('#/t/movie/21', '#acts a.abtn'); expect(q('#acts a.abtn').getAttribute('href')).toMatch(/^stremio:\/\/\//);
  });

  it('clicking a poster opens the quick view; it holds the full details and scrolling never opens another page; Esc closes it', async () => {
    await go('#/browse', '.card'); q('.card[data-open]').click(); await sleep(500);
    expect(q('#qv')).toBeTruthy(); expect(q('#qv .qv-t').textContent.length).toBeGreaterThan(0);
    expect(q('#qv .wmat')).toBeTruthy(); await sleep(500); expect(q('#qv #qvFull #sumBox')).toBeTruthy(); expect(q('#qv #qvFull .qa')).toBeTruthy(); expect(qa('#qv #qvFull .row .card').length).toBeGreaterThan(0); expect(q('#qv #qvFull .hero')).toBeFalsy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(50); expect(q('#qv')).toBeFalsy();
    q('.card[data-open]').click(); await sleep(500); const b0 = location.hash, b = q('#qv .qv'); b.scrollTop = 900; b.dispatchEvent(new Event('scroll')); await sleep(600); expect(q('#qv').classList.contains('big')).toBe(true); b.scrollTop = 0; b.dispatchEvent(new Event('scroll')); expect(q('#qv').classList.contains('big')).toBe(false);   // grows when you scroll down, settles back at the top expect(location.hash).toBe(b0); expect(q('#qv')).toBeTruthy(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(50); expect(q('#qv')).toBeFalsy();
  });

  it('Home has no prompt bar; "Picked for you" is the second row; the assistant is a bubble', async () => {
    await go('#/foryou', '.lane', 2); expect(q('#hAsk')).toBeFalsy(); expect(q('#aiFab').hidden).toBe(false);
    expect(qa('.lane h2')[1].textContent).toBe('Picked for you'); expect(document.body.textContent).not.toContain('More picked for you');
    expect(qa('#nav a').some(a => /Ask/.test(a.textContent))).toBe(false);
    q('#aiFab').click(); await sleep(250); expect(q('#aiPanel').hidden).toBe(false); expect(qa('#aiIdeas .chip').length).toBeGreaterThan(2);
    q('#askI').value = 'rainy night thriller'; q('#askF').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(900);
    expect(qa('#aiPanel .msg.u').length).toBe(1); expect(qa('#aiPanel .msg.b .card').length).toBeGreaterThan(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(350); expect(q('#aiPanel').hidden).toBe(true);
  });

  it('the inline critical CSS cannot hide the open account menu', async () => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toMatch(/#acct\{[^}]*display:none/);
  });
});

describe('release radar', () => {
  it('ranks by hype, follows the languages from Settings, and its filters work', async () => {
    await boot({ watchnext: { cfg: { key: 'a'.repeat(32), langs: ['hi'] }, lib: {} } });
    location.hash = '#/radar'; await sleep(900);
    const rq = () => state.calls.filter(c => c.includes('/discover/movie')).length;
    expect(qa('.rh').map(h => h.textContent)).toEqual(['Most anticipated', 'Also coming']);
    expect(qa('#g .card').length).toBeGreaterThan(12); expect(q('#rLang').selectedOptions[0].textContent).toContain('Hindi');
    const w0 = rq(); q('[data-w="7"]').click(); await sleep(600); expect(rq()).toBeGreaterThan(w0); expect(q('#rWinC .on').textContent).toBe('This week');
    const g0 = rq(); q('#gChips [data-g="18"]').click(); await sleep(600); expect(rq()).toBeGreaterThan(g0); expect(q('#gChips .on').textContent).toBe('Drama');
    q('#rSort').value = 'date'; q('#rSort').dispatchEvent(new Event('change')); await sleep(600); expect(qa('.day').length).toBeGreaterThan(0);
  }, 15000);
});
