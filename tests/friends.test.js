import { describe, it, expect, beforeAll } from 'vitest';
import { boot, sleep, state, resetServer } from './helpers/mocks.js';

const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
describe('movie night friend codes', () => {
  beforeAll(async () => {
    resetServer();
    await boot({ watchnext: { cfg: { key: 'a'.repeat(32),  }, lib: { 'movie:7': { id: 7, type: 'movie', title: 'Seen It', year: '2019', poster: '/p.jpg', genres: [18], vote: 8, status: 'watched', my: 10, ts: 5 } } } });
  }, 20000);

  it('creates a share code holding only your watched titles', async () => {
    location.hash = '#/night'; await sleep(500);
    q('#ntMake').click(); await sleep(500);
    expect(q('#ntCode').textContent).toMatch(/^wn-[a-z2-9]{22}$/);
    const doc = Object.values(state.shares)[0].data;
    expect(doc.kind).toBe('wn-share'); expect(Object.keys(doc.lib)).toEqual(['movie:7']); expect(JSON.stringify(doc)).not.toContain('aaaaaaaa');
  });

  it('adds a friend by their code, and rejects bad or own codes', async () => {
    state.shares.FRIENDx12345 = { owner: 'u9', data: { v: 1, kind: 'wn-share', name: 'Sam', lib: { 'movie:9': { i: 9, t: 'movie', n: 'Other', y: '2020', p: '/p.jpg', g: [28], s: 'w', m: 9 } } } };
    q('#ntAdd').click(); await sleep(30);
    q('#frCode').value = 'hello'; q('#frAdd').click(); await sleep(100);
    expect(q('#frErr').textContent).toMatch(/starts with wn-/);
    q('#frCode').value = q('#ntCode').textContent; q('#frAdd').click(); await sleep(200);
    expect(q('#frErr').textContent).toMatch(/your own/);
    q('#frName').value = 'Sam'; q('#frCode').value = 'wn-FRIENDx12345'; q('#frAdd').click(); await sleep(300);
    expect(qa('.nt-p[data-id^="f:"]').length).toBe(1);
  });

  it('finds picks using the friend, and drops them once the code is turned off', async () => {
    q('.nt-p[data-id^="f:"]').click(); q('#nGo').click(); await sleep(900);
    expect(qa('#nOut .night-c').length).toBeGreaterThan(0);
    expect(qa('#nOut .fit span').some(s => s.textContent.includes('Sam'))).toBe(true);
    delete state.shares.FRIENDx12345;
    q('#nGo').click(); await sleep(700);
    expect(q('#nOut').textContent).toMatch(/Not enough people|Your picks/);
  });

  it('turning your code off deletes the shared copy', async () => {
    q('#ntOff').click(); await sleep(400);
    expect(Object.keys(state.shares)).toEqual([]);
    expect(q('#ntMake')).toBeTruthy();
  });
});
