import { describe, it, expect, beforeAll } from 'vitest';
import { boot, sleep, state, lib } from './helpers/mocks.js';

const go = async (h, sel, min = 1) => { location.hash = h; await sleep(350); expect(document.querySelectorAll(sel).length, `${h} -> ${sel}`).toBeGreaterThanOrEqual(min); };
const click = sel => document.querySelector(sel).click();
// there is no Start watching button any more; the same action is still triggered by the Library's move menu, so drive it directly
const startWatching = k => { const b = document.createElement('button'); b.dataset.act = 'watching'; b.dataset.k = k; document.querySelector('#acts').append(b); b.click(); };

const pd = () => { const f = state.driveFile; if (f.v === 2) { const m = JSON.parse(localStorage.getItem('wn:u1:meta')); return f.data[m.last]; } return f; };
describe('core flows (legacy single-profile seed)', () => {
  beforeAll(async () => {
    state.driveFile = { v: 1, ts: 1, lib: { 'movie:777': { id: 777, type: 'movie', title: 'Remote Film', year: '2019', poster: '/p.jpg', genres: [18], status: 'watched', my: 10, ts: 5 } }, del: {}, meta: {}, cfg: { key: 'K'.repeat(32), geminiKey: 'remote-gem', langs: ['hi'] } };
    await boot({ watchnext: { cfg: { key: 'a'.repeat(32), geminiKey: 'gem-key', omdbKey: 'om' }, lib: {} } });
  }, 20000);

  it('renders the main pages', async () => {
    await go('#/foryou', '.card');
    await go('#/browse/gems', '.card'); await go('#/discover', '.card'); await go('#/mood', '.mood', 10); await go('#/ask', '#askF'); await go('#/swipe', '.scard');
  });

  it('title page: reviews, critic scores, tracker, Q&A', async () => {
    await go('#/t/tv/7', '.hero');
    expect(document.querySelectorAll('.rev').length).toBe(2);
    expect(document.querySelector('.rev p').textContent.length).toBeLessThan(260);
    click('[data-more]'); expect(document.querySelector('.rev p').textContent.length).toBeGreaterThan(260);
    await sleep(300); expect(document.querySelector('.sumtxt')?.textContent).toContain('Loved');
    expect(document.querySelector('#crit').textContent).toContain('87%');
    startWatching('tv:7'); await sleep(300); expect(document.querySelector('.trk')).toBeTruthy();
    for (let i = 0; i < 4; i++) { click('[data-ep="1"]'); await sleep(220); }
    expect(lib()['tv:7'].prog).toEqual({ s: 2, e: 1 });
    for (let i = 0; i < 2; i++) { click('[data-ep="1"]'); await sleep(220); }
    await sleep(200); expect(lib()['tv:7'].status).toBe('watched');
    click('[data-qa]'); await sleep(300); expect(document.querySelector('[data-ans]').textContent).toContain('Mild');
  }, 15000);

  it('ticking an episode on an untracked show starts tracking it', async () => {
    location.hash = '#/t/tv/9'; await sleep(450);
    expect(lib()['tv:9']).toBeUndefined(); expect(document.querySelector('.trk.idle')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Start watching');
    click('[data-ep="1"]'); await sleep(500);
    expect(lib()['tv:9'].status).toBe('watching'); expect(lib()['tv:9'].prog.e).toBe(1);
    expect(document.querySelector('.trk.idle')).toBeFalsy();
  });

  it('movie progress slider persists', async () => {
    location.hash = '#/t/movie/8'; await sleep(350); startWatching('movie:8'); await sleep(100);
    const r = document.querySelector('[data-pct]'); r.value = 40; r.dispatchEvent(new Event('change', { bubbles: true }));
    expect(lib()['movie:8'].prog.pct).toBe(40);
    await go('#/list/watching', '.trk');
  });

  it('Ask: Gemini picks, explanations, conversational "already seen"', async () => {
    location.hash = '#/ask'; await sleep(300);
    document.querySelector('#askI').value = 'Find a movie like Interstellar but with more action'; document.querySelector('#askF').dispatchEvent(new Event('submit', { cancelable: true })); await sleep(700);
    expect(document.querySelectorAll('.chat .picks .card').length).toBe(2); expect(document.querySelector('.chat .why').textContent).toContain('action');
    document.querySelector('#askI').value = "I've already seen that one"; document.querySelector('#askF').dispatchEvent(new Event('submit', { cancelable: true })); await sleep(900);
    expect(Object.values(lib()).some(e => e.title === 'Gravity' && e.status === 'watched')).toBe(true);
  }, 10000);

  it('Mood: suggestion lands with a reason', async () => {
    location.hash = '#/mood'; await sleep(300); click('[data-mood="hyped"]'); await sleep(50); click('#suggest'); await sleep(900);
    expect(document.querySelector('.mr')).toBeTruthy(); expect(document.querySelector('.mr-why').textContent).toContain('Hyped');
    expect(document.querySelector('.mr-title').getAttribute('aria-label')).toBeTruthy(); await sleep(300); expect(document.querySelectorAll('.mr-c').length).toBeGreaterThan(3);   // a whole hand, not just one
    document.querySelector('.mr-x').click(); await sleep(400); expect(document.querySelector('.mr')).toBeFalsy();
  }, 10000);

  it('Mood: a genre can be chosen for a mood, and a custom mood can be made', async () => {
    location.hash = '#/mood'; await sleep(300);
    expect(document.querySelectorAll('[data-mood]').length).toBeGreaterThan(45);
    click('[data-x="cozy"]'); await sleep(20); expect(document.querySelector('.mgen')).toBeTruthy(); click('[data-gx="Comedy"]'); await sleep(20);
    expect(document.querySelector('[data-mood="cozy"] span').textContent).toBe('Comedy');
    click('[data-new="Feel"]'); await sleep(20); document.querySelector('#nmName').value = 'Sunday slow'; click('[data-nm="Drama"]'); await sleep(20);
    document.querySelector('#nmName').value = 'Sunday slow'; click('#nmSave'); await sleep(50);
    expect([...document.querySelectorAll('[data-mood] b')].some(b => b.textContent === 'Sunday slow')).toBe(true);
  });

  it('Taste DNA with Gemini profile', async () => {
    for (const id of [21, 22, 23]) { location.hash = '#/t/movie/' + id; await sleep(300); click('[data-act="watched"]'); await sleep(30); click('[data-rate="10"]'); }
    await go('#/dna', '.dhero'); await sleep(600);
    expect(document.querySelector('#dArch').textContent).toBe('The Mind-Bender'); expect(document.querySelector('.radar')).toBeTruthy(); expect(document.querySelector('#dTry .card')).toBeTruthy();
  }, 15000);

  it('explainable recommendations', async () => {
    await go('#/foryou', '.card'); await sleep(200);
    expect([...document.querySelectorAll('.why')].some(x => x.textContent === 'Based on your watch history')).toBe(true);
  });

  it('Account sync merges remote data, uploads local, propagates deletes', async () => {
    location.hash = '#/foryou'; await sleep(200); click('#gear'); await sleep(200); click('#sGin'); await sleep(1500);
    expect(lib()['movie:777']).toBeTruthy(); expect(pd().lib['tv:7']).toBeTruthy();
    location.hash = '#/t/movie/21'; await sleep(300); click('[data-act="watched"]'); await sleep(3200);
    expect(pd().del['movie:21']).toBeGreaterThan(0); expect(pd().lib['movie:21']).toBeUndefined();
    expect(document.querySelector('#sync').className).toContain('ok');
  }, 20000);

  it('natural-language header search opens the assistant bubble', async () => {
    const q = document.querySelector('#q'); q.value = 'find a movie like Interstellar but with more action'; q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await sleep(900);
    expect(document.querySelector('#aiPanel').hidden).toBe(false); expect(document.querySelectorAll('.chat .msg.b').length).toBeGreaterThanOrEqual(1);
  });
});
