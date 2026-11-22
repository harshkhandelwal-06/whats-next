import { describe, it, expect } from 'vitest';
import { mergeData, mergeProfiles } from '../src/core/merge.js';
import { isSafeFor } from '../src/core/safety.js';
import { boot, sleep, state } from './helpers/mocks.js';

describe('merge', () => {
  it('newest wins and deletions beat older entries', () => {
    const t = { lib: { a: { ts: 5, status: 'watched' }, b: { ts: 1 } }, del: {}, meta: {}, cfg: {} };
    mergeData(t, { lib: { a: { ts: 9, status: 'watchlist' }, b: { ts: 1 } }, del: { b: 3 } });
    expect(t.lib.a.status).toBe('watchlist'); expect(t.lib.b).toBeUndefined(); expect(t.del.b).toBe(3);
  });
  it('profile lists merge by id with tombstones', () => {
    const m = mergeProfiles([{ id: 'x', ts: 1 }], {}, [{ id: 'y', ts: 2 }, { id: 'x', ts: 5, name: 'n' }], { z: 9 });
    expect(m.list.map(p => p.id).sort()).toEqual(['x', 'y']); expect(m.list.find(p => p.id === 'x').name).toBe('n');
    expect(mergeProfiles([{ id: 'x', ts: 1 }], {}, [], { x: 4 }).list).toEqual([]);
  });
});
describe('kids safety', () => {
  it('only family genres, never horror', () => {
    expect(isSafeFor(true, { genres: [16, 35] })).toBe(true);
    expect(isSafeFor(true, { genres: [16, 27] })).toBe(false);
    expect(isSafeFor(true, { genres: [28] })).toBe(false);
    expect(isSafeFor(false, { genres: [27] })).toBe(true);
  });
});
describe('profiles in the app', () => {
  it('signed out: only Google sign-in is offered, no guest and no local profiles', async () => {
    await boot(null, { signedOut: true });
    expect(document.querySelector('#welcome')).toBeTruthy(); expect(document.querySelector('#wlG')).toBeTruthy();
    expect(document.querySelector('[data-guest]')).toBeNull(); expect(document.querySelector('#wlName')).toBeNull(); expect(document.querySelector('#wlLocal')).toBeNull();
    expect(document.querySelector('#view').children.length).toBe(0);
  });
  it('Google sign-in opens a private space for that account', async () => {
    state.sub = 'u1';
    await boot({ 'wn:device': { gClient: 'x.apps.googleusercontent.com' } }, { signedOut: true });
    document.querySelector('#wlG').click(); await sleep(900);
    expect(JSON.parse(localStorage.getItem('wn:acct')).sub).toBe('u1');
    expect(JSON.parse(localStorage.getItem('wn:u1:meta')).list).toHaveLength(1);
    expect(document.querySelector('#welcome')).toBeNull(); expect(location.hash).toBe('#/foryou');
    expect(JSON.parse(localStorage.getItem('wn:gtok:u1')).t).toBe('tok'); // survives a refresh, so no reconnect needed within the hour
  });
  it("another Google account never sees someone else's profiles or lists", async () => {
    state.sub = 'u1'; state.driveFile = null;
    await boot({ 'wn:device': { gClient: 'x.apps.googleusercontent.com' } }, { signedOut: true });
    document.querySelector('#wlG').click(); await sleep(900);
    const a = JSON.parse(localStorage.getItem('wn:u1:meta')).list[0].id;
    localStorage.setItem('wn:u1:p:' + a, JSON.stringify({ lib: { 'movie:1': { id: 1, type: 'movie', status: 'watched', ts: 5 } }, del: {}, meta: {}, sum: {}, cfg: {} }));
    document.querySelector('#who').click(); document.querySelector('#signout').click(); await sleep(100);
    expect(localStorage.getItem('wn:acct')).toBeNull(); expect(document.querySelector('#welcome')).toBeTruthy();
    state.sub = 'u2'; state.driveFile = null;
    document.querySelector('#wlG').click(); await sleep(900);
    const m2 = JSON.parse(localStorage.getItem('wn:u2:meta')); expect(m2.list).toHaveLength(1); expect(m2.list[0].id).not.toBe(a);
    expect(localStorage.getItem('wn:u2:p:' + a)).toBeNull();
    expect(Object.keys(JSON.parse(localStorage.getItem('wn:u2:p:' + m2.list[0].id)).lib)).toEqual([]);
    expect(localStorage.getItem('wn:u1:p:' + a)).toBeTruthy();
    state.sub = 'u1';
  });
  it('the profile picker has no guest option, and signing out returns to the welcome page', async () => {
    await boot({ 'wn:meta': { list: [{ id: 'a', name: 'A', emoji: '🎬', color: '', kids: false, pin: '', ts: 1 }, { id: 'b', name: 'B', emoji: '🍿', color: '', kids: false, pin: '', ts: 1 }], del: {}, last: 'a' } });
    expect(document.querySelector('#picker')).toBeTruthy(); expect(document.querySelector('#picker [data-guest]')).toBeNull();
    document.querySelector('#picker [data-out]').click(); await sleep(50);
    expect(document.querySelector('#welcome')).toBeTruthy(); expect(localStorage.getItem('wn:acct')).toBeNull();
  });
  it('migrates the old save into a first profile', async () => {
    await boot({ watchnext: { cfg: { key: 'k', region: 'US' }, lib: { 'movie:1': { id: 1, type: 'movie', status: 'watched', ts: 1 } } } });
    const m = JSON.parse(localStorage.getItem('wn:u1:meta'));
    expect(m.list).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('wn:u1:p:' + m.list[0].id)).lib['movie:1']).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('wn:u1:device')).key).toBe('k');
    expect(localStorage.getItem('watchnext')).toBeNull();
  });
});

import { readExport, parseCSV } from '../src/features/importer.js';
import { groupScore } from '../src/features/night.js';
describe('import and movie night', () => {
  it('reads Letterboxd and IMDb exports', () => {
    const lb = readExport('Date,Name,Year,Letterboxd URI,Rating\n2024-01-01,"Dune, Part Two",2024,x,4.5\n');
    expect(lb[0]).toMatchObject({ title: 'Dune, Part Two', year: '2024', my: 9, kind: 'movie' });
    const im = readExport('Const,Your Rating,Title,Title Type,Year\ntt1,8,Dark,TV Series,2017\n');
    expect(im[0]).toMatchObject({ title: 'Dark', my: 8, kind: 'tv' });
    expect(parseCSV('a,"b\nc",d\n')).toEqual([['a', 'b\nc', 'd']]);
  });
  it('group score skips what anyone has seen', () => {
    const it = { type: 'movie', id: 1, genres: [28], rating: 7 };
    const a = { name: 'A', lib: { 'movie:1': { status: 'watched' } } }, b = { name: 'B', lib: {} };
    const r = groupScore(it, [a, b]);
    expect(r.per[0].seen).toBe(true); expect(r.score).toBeLessThan(groupScore(it, [b, b]).score);
  });
});

import { computeStats } from '../src/features/wrapped.js';
describe('stats', () => {
  it('counts titles, streak and busiest month', () => {
    const now = new Date('2026-06-15T12:00:00').getTime(), d = n => now - n * 864e5;
    const lib = { a: { type: 'movie', status: 'watched', my: 8, ts: d(0), year: '1999', genres: [28] }, b: { type: 'tv', status: 'watched', my: 6, ts: d(1), year: '2015', genres: [28, 18] }, c: { type: 'movie', status: 'watchlist', ts: d(5) } };
    const s = computeStats(lib, now);
    expect(s.total).toBe(2); expect(s.streak).toBe(2); expect(s.avg).toBe(7); expect(s.busiest).toBe(5); expect(s.genres[0].v).toBe(2);
  });
});

import { makeFeed } from '../src/core/feed.js';
import { S } from '../src/core/state.js';
describe('infinite feed', () => {
  it('keeps returning new titles and never repeats', async () => {
    await boot({ watchnext: { cfg: { key: 'k' }, lib: { 'movie:1': { id: 1, type: 'movie', status: 'watched', my: 10, genres: [18], ts: 1 } } } });
    const feed = makeFeed('movie'), seen = new Set(); let total = 0;
    for (let p = 1; p <= 5; p++) { const r = await feed(p); for (const x of r.results) { expect(seen.has(x.id)).toBe(false); seen.add(x.id); total++; } expect(r.total_pages).toBeGreaterThan(p); }
    expect(total).toBeGreaterThan(40);
  }, 20000);
});
