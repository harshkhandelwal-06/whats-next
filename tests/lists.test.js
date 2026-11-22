import { describe, it, expect, beforeAll } from 'vitest';
import { boot, sleep } from './helpers/mocks.js';

const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
const meta = () => JSON.parse(localStorage.getItem('wn:u1:meta') || '{}');

describe('watchlists', () => {
  beforeAll(async () => {
    await boot({ watchnext: { cfg: { key: 'a'.repeat(32) }, lib: {
      'movie:1': { id: 1, type: 'movie', title: 'One', year: '2020', poster: '/p.jpg', genres: [], vote: 7, status: 'watchlist', ts: 1 },
      'movie:2': { id: 2, type: 'movie', title: 'Two', year: '2021', poster: '/p.jpg', genres: [], vote: 7, status: 'watchlist', wl: 'l1', ts: 2 },
    } } });
  }, 20000);

  it('names the default list "Next to watch" and shows list chips in the library', async () => {
    location.hash = '#/list/watchlist'; await sleep(400);
    const chips = qa('[data-wlbox]').map(b => b.textContent);
    expect(chips.some(t => t.includes('Next to watch'))).toBe(true);
    expect(q('[data-wl-new]')).toBeTruthy();
  });

  it('opens a list in the same page and shows its titles', async () => {
    location.hash = '#/list/watchlist'; await sleep(400);
    q('[data-wlbox="next"]').click(); await sleep(200);
    expect(q('#rs')).toBeTruthy(); expect(qa('#wlpg .card').length).toBe(2);
    q('[data-rsclose]').click(); await sleep(50); document.querySelector('#rs')?.remove(); document.body.classList.remove('noscroll');
  });

  it('creates a new list from the library', async () => {
    q('[data-wl-new]').click(); await sleep(50);
    q('#leName').value = 'Weekend films'; q('#leSave').click(); await sleep(400);
    expect(qa('[data-wlbox]').some(b => b.textContent.includes('Weekend films'))).toBe(true);
    document.querySelector('#rs')?.remove();
    const raw = Object.keys(localStorage).filter(k => k.startsWith('wn:u1:p:')).map(k => localStorage.getItem(k)).join('');
    expect(raw).toContain('Weekend films'); expect(raw).toContain('Next to watch');
  });

  it('asks which list to use when adding with several lists', async () => {
    location.hash = '#/browse'; await sleep(500);
    const btn = q('[data-act="watchlist"]'); expect(btn).toBeTruthy();
    btn.click(); await sleep(80);
    expect(q('#lpick')).toBeTruthy();
    expect(qa('#lpick [data-l]').length).toBeGreaterThanOrEqual(2);
  });
});

describe('animation setting', () => {
  it('saves the level on this device and applies it to the page', async () => {
    const { setMotion, motion } = await import('../src/ui/motion.js');
    setMotion('off'); expect(motion()).toBe('off'); expect(document.documentElement.dataset.motion).toBe('off');
    setMotion('lite'); expect(document.documentElement.dataset.motion).toBe('lite');
    setMotion('full'); expect(localStorage.getItem('wn:motion')).toBe('full');
  });
  it('lets you pick it in the redesigned settings', async () => {
    const { openSettings } = await import('../src/ui/settings.js');
    openSettings(); await sleep(50);
    expect(qa('.setnav [data-sec]').length).toBe(6);
    q('[data-sec="look"]').click(); q('#sMotion [data-v="off"]').click();
    expect(document.documentElement.dataset.motion).toBe('off');
    q('#sMotion [data-v="full"]').click();
  });
});

describe('rewatch tab', () => {
  it('lists watched titles with genre chips and a random pick', async () => {
    const { S } = await import('../src/core/state.js');
    S.lib['movie:7'] = { id: 7, type: 'movie', title: 'Seen It', year: '2019', poster: '/p.jpg', genres: [18], vote: 8, status: 'watched', ts: 5 };
    location.hash = '#/rewatch'; await sleep(450);
    expect(q('#nav [data-r="rewatch"]')).toBeTruthy(); expect(q('.seg4')).toBeNull();
    expect(qa('#lbody .card').length).toBeGreaterThanOrEqual(1);
    expect(qa('[data-rg]').length).toBeGreaterThanOrEqual(2);
    expect(q('#rwRand')).toBeTruthy();
  });
});

describe('watched titles leave the feeds', () => {
  it('removes a card from a home row when you mark it watched, and keeps it out of the feed', async () => {
    location.hash = '#/foryou'; await sleep(900);
    const card = q('.lane .track .card[data-open]'); expect(card).toBeTruthy();
    const k = card.dataset.open;
    card.querySelector('[data-act="watched"]').click(); await sleep(450);
    expect(document.querySelector(`.lane .card[data-open="${k}"]`)).toBeNull();
    expect(q("#fHide")).toBeNull();
  });
});

describe('other reviews', () => {
  it('cycles to different reviews with one button', async () => {
    location.hash = '#/t/movie/777'; await sleep(900);
    const b = q('[data-revs]'); expect(b).toBeTruthy();
    const first = qa('.revs .rev b').map(x => x.textContent).join();
    b.click(); await sleep(50);
    expect(qa('.revs .rev b').map(x => x.textContent).join()).not.toBe(first);
  });
});

describe('refresh a row', () => {
  it('swaps in new picks and keeps the row filled', async () => {
    location.hash = '#/foryou'; await sleep(900);
    const b = q('#lane-pick [data-refresh]'); expect(b).toBeTruthy();
    expect(q('#lane-top [data-refresh]')).toBeNull();
    b.click(); await sleep(900);
    expect(qa('#lane-pick .track .card[data-open]').length).toBeGreaterThan(5);
  });
});

describe('slideshow', () => {
  it('drops a title from the slideshow once it is marked watched', async () => {
    location.hash = '#/foryou'; await sleep(1100);
    const before = document.querySelectorAll('.spot .slide').length; expect(before).toBeGreaterThan(1);
    const k = q('.spot .slide [data-act="watched"]').dataset.k;
    q('.spot .slide.on [data-act="watched"]').click(); await sleep(1000);
    expect(document.querySelector(`.spot .slide [data-open="${k}"]`)).toBeNull();
    expect(document.querySelectorAll('.spot .slide').length).toBe(before - 1);
  });
});

describe('theater mode', () => {
  it('shows only the trailer on a dark stage, and closes on click', async () => {
    const { openTheater } = await import('../src/ui/theater.js');
    let got = null; openTheater({ key: 'abc', title: 'Test', start: 12, onClose: t => { got = t; } });
    expect(q('#theater iframe').src).toContain('start=12');
    expect(qa('#theater button').length).toBe(0);
    q('#theater').click(); await sleep(50);
    expect(q('#theater')).toBeNull(); expect(got).toBe(12);
  });
});
