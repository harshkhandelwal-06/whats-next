import { describe, it, expect, beforeAll } from 'vitest';
import { boot, sleep, fetchMock } from './helpers/mocks.js';

const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
// A tiny in-memory Google Drive.
const drive = { files: {}, n: 0, perms: [] };
const ok = j => ({ ok: true, status: 200, json: async () => j });
function fake(url, opt = {}) {
  url = String(url);
  if (!url.includes('googleapis.com/drive/v3/files') && !url.includes('googleapis.com/upload/drive/v3/files')) return fetchMock(url, opt);
  const m = opt.method || 'GET', id = (url.match(/files\/([^/?]+)/) || [])[1];
  if (url.includes('/upload/') && m === 'POST' && !opt.body.includes('whatsnext-share.json')) return fetchMock(url, opt);
  if (url.includes('/upload/') && m === 'POST') { const doc = JSON.parse(opt.body.split('\r\n\r\n')[2].split('\r\n--')[0]), fid = 'SHARE' + String(++drive.n).padStart(12, 'x'); drive.files[fid] = doc; return ok({ id: fid }); }
  if (url.includes('/upload/') && m === 'PATCH' && drive.files[id]) { drive.files[id] = JSON.parse(opt.body); return ok({ id }); }
  if (url.includes('/permissions')) { drive.perms.push({ id, ...JSON.parse(opt.body) }); return ok({}); }
  if (m === 'DELETE') { delete drive.files[id]; return ok({}); }
  if (url.includes('alt=media') && url.includes('key=')) return drive.files[id] ? ok(drive.files[id]) : { ok: false, status: 404, json: async () => ({}) };
  return fetchMock(url, opt);
}

describe('movie night friend codes', () => {
  beforeAll(async () => {
    await boot({ watchnext: { cfg: { key: 'a'.repeat(32), gClient: 'cid', gApiKey: 'APIKEY' }, lib: { 'movie:7': { id: 7, type: 'movie', title: 'Seen It', year: '2019', poster: '/p.jpg', genres: [18], vote: 8, status: 'watched', my: 10, ts: 5 } } } });
    globalThis.fetch = window.fetch = fake;
  }, 20000);

  it('creates a share code that is a public-link file with only your watched titles', async () => {
    location.hash = '#/night'; await sleep(500);
    q('#ntMake').click(); await sleep(500);
    expect(q('#ntCode').textContent).toMatch(/^wn-SHARE/);
    expect(drive.perms.some(p => p.type === 'anyone' && p.role === 'reader')).toBe(true);
    const doc = Object.values(drive.files)[0];
    expect(doc.kind).toBe('wn-share'); expect(Object.keys(doc.lib)).toEqual(['movie:7']); expect(JSON.stringify(doc)).not.toContain('aaaaaaaa');
  });

  it('adds a friend by their code, and rejects bad or own codes', async () => {
    drive.files.FRIENDx12345 = { v: 1, kind: 'wn-share', name: 'Sam', lib: { 'movie:9': { i: 9, t: 'movie', n: 'Other', y: '2020', p: '/p.jpg', g: [28], s: 'w', m: 9 } } };
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
    delete drive.files.FRIENDx12345;
    q('#nGo').click(); await sleep(700);
    expect(q('#nOut').textContent).toMatch(/Not enough people|Your picks/);
  });

  it('turning your code off deletes the file', async () => {
    q('#ntOff').click(); await sleep(400);
    expect(Object.keys(drive.files).some(k => k.startsWith('SHARE'))).toBe(false);
    expect(q('#ntMake')).toBeTruthy();
  });
});
