import { describe, it, expect, beforeEach } from 'vitest';
import { SB, boot, resetServer, sleep, state } from './helpers/mocks.js';

const q = s => document.querySelector(s);
const submit = (mail, pw, up = false, name = '') => { if (up) q('[data-tab="up"]').click(); q('#wlEmail').value = mail; q('#wlPass').value = pw; if (name && q('#wlName')) q('#wlName').value = name; q('#wlForm').dispatchEvent(new Event('submit', { cancelable: true })); };
const lib = id => { const m = JSON.parse(localStorage.getItem('wn:' + id + ':meta') || 'null'); const p = m && localStorage.getItem(`wn:${id}:p:${m.last || m.list[0].id}`); return p ? JSON.parse(p).lib : {}; };

describe('email accounts', () => {
  beforeEach(() => resetServer());

  it('a wrong password is explained, a right one signs in', async () => {
    await boot(null, { signedOut: true });
    submit('t@example.com', 'nope-nope'); await sleep(300);
    expect(q('#wlErr').textContent).toBe('Wrong email or password.'); expect(q('#welcome')).toBeTruthy();
    submit('t@example.com', 'password1'); await sleep(900);
    expect(q('#welcome')).toBeNull();
  });

  it('checks the email and password length before asking the server', async () => {
    await boot(null, { signedOut: true });
    submit('not-an-email', 'password1'); await sleep(50); expect(q('#wlErr').textContent).toMatch(/email address/);
    submit('new@example.com', 'short', true); await sleep(50); expect(q('#wlErr').textContent).toMatch(/at least 8/);
    expect(Object.keys(state.users)).toEqual(['t@example.com']);
  });

  it('creating an account signs you in and names your first profile', async () => {
    await boot(null, { signedOut: true });
    submit('Sam@Example.com', 'longpassword', true, 'Sam Rao'); await sleep(900);
    const acct = JSON.parse(localStorage.getItem('wn:acct'));
    expect(acct.email).toBe('sam@example.com'); expect(acct.name).toBe('Sam Rao');
    expect(JSON.parse(localStorage.getItem(`wn:${acct.sub}:meta`)).list[0].name).toBe('Sam');
    expect(q('#welcome')).toBeNull();
  });

  it('an existing email is told to sign in instead', async () => {
    await boot(null, { signedOut: true });
    submit('t@example.com', 'password1', true); await sleep(300);
    expect(q('#wlErr').textContent).toMatch(/already has an account/);
  });

  it('when the project wants email confirmation, the sign-up says so and signs nobody in', async () => {
    state.confirm = true; await boot(null, { signedOut: true });
    submit('c@example.com', 'longpassword', true); await sleep(300);
    expect(q('#wlErr').textContent).toMatch(/confirmation link/); expect(localStorage.getItem('wn:acct')).toBeNull();
  });

  it('lists are saved to the account and come back on a brand-new browser', async () => {
    await boot(null, { signedOut: true });
    submit('t@example.com', 'password1'); await sleep(900);
    const m = JSON.parse(localStorage.getItem('wn:u1:meta')), id = m.list[0].id;
    location.hash = '#/foryou'; await sleep(300);
    const st = await import('../src/core/state.js'); st.S.lib['movie:42'] = { id: 42, type: 'movie', title: 'Kept', status: 'watched', ts: Date.now() }; st.save(false);
    q('#who').click(); q('#signout').click(); await sleep(400);          // signing out pushes the last changes first
    expect(state.rows.u1.data[id].lib['movie:42']).toBeTruthy();
    await boot(null, { signedOut: true });                              // a fresh browser: nothing stored locally
    localStorage.removeItem('wn:u1:meta');
    submit('t@example.com', 'password1'); await sleep(1100);
    expect(Object.keys(lib('u1'))).toContain('movie:42');
  }, 20000);

  it('forgot password asks the server for a reset link', async () => {
    await boot(null, { signedOut: true });
    q('#wlEmail').value = 't@example.com'; q('#wlForgot').click(); await sleep(200);
    expect(state.calls).toContain('recover:t@example.com'); expect(q('#wlErr').textContent).toMatch(/reset link/);
  });

  it('a lost connection gives a friendly message', async () => {
    await boot(null, { signedOut: true }); state.down = true;
    submit('t@example.com', 'password1'); await sleep(300);
    expect(q('#wlErr').textContent).toMatch(/Could not reach the server/); state.down = false;
  });

  it('without a server the sign-in screen asks for one, and checks what is typed', async () => {
    await boot(null, { signedOut: true }); localStorage.removeItem('wn:supa');
    const { openWelcome } = await import('../src/features/welcome.js'); openWelcome();
    expect(q('#wlSetup').open).toBe(true);
    q('#wlUrl').value = 'http://example.com'; q('#wlKey').value = 'x'.repeat(50); q('#wlSrvSave').click();
    expect(q('#wlErr').textContent).toMatch(/Supabase project URL/);
    q('#wlUrl').value = SB; q('#wlSrvSave').click();
    expect(JSON.parse(localStorage.getItem('wn:supa')).url).toBe(SB);
  });

  it('old data saved on this device from a previous login can be brought into the new account', async () => {
    await boot({ 'wn:oldg:meta': { list: [{ id: 'pa', name: 'Old', emoji: '🎬', color: '', kids: false, pin: '', ts: 1 }], del: {}, last: 'pa' }, 'wn:oldg:p:pa': { lib: { 'movie:5': { id: 5, type: 'movie', status: 'watched', ts: 3 } }, del: {}, meta: {}, sum: {}, cfg: {} } }, { signedOut: true });
    submit('t@example.com', 'password1'); await sleep(1000);
    expect(JSON.parse(localStorage.getItem('wn:u1:meta')).list[0].id).toBe('pa');
    expect(lib('u1')['movie:5']).toBeTruthy();
  }, 20000);
});
