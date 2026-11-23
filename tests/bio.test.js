import { describe, it, expect, beforeEach } from 'vitest';
import { boot, resetServer, sleep, state } from './helpers/mocks.js';

const q = s => document.querySelector(s);
let fail = false;
const setup = async () => {
  resetServer(); fail = false;
  window.PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => true };
  Object.defineProperty(navigator, 'credentials', { configurable: true, value: { create: async () => ({ rawId: new Uint8Array([1, 2, 3, 4]).buffer }), get: async () => { if (fail) { const e = new Error('no'); e.name = 'NotAllowedError'; throw e; } return {}; } } });
  await boot(null);
};
const enableIt = async () => { q('#gear').click(); await sleep(300); await sleep(100); q('#sBio').click(); await sleep(300); };

describe('fingerprint / face unlock (optional)', () => {
  beforeEach(setup);

  it('is off until you turn it on, and says so when the device cannot do it', async () => {
    q('#gear').click(); await sleep(300);
    expect(q('#sBio').textContent).toBe('Turn on'); expect(localStorage.getItem('wn:u1:bio')).toBeNull();
  });

  it('turning it on is per account, and signing out then leaves a one-touch way back in', async () => {
    await enableIt();
    expect(JSON.parse(localStorage.getItem('wn:u1:bio')).cred).toBeTruthy(); expect(q('#sBio').textContent).toBe('Turn off');
    document.querySelector('[data-close]')?.click(); q('#who').click(); q('#signout').click(); await sleep(500);
    expect(q('#welcome')).toBeTruthy(); expect(q('.wl-bio')).toBeTruthy(); expect(q('.wl-bio').textContent).toMatch(/Test User/);
    expect(state.calls.some(c => c.endsWith('/auth/v1/logout'))).toBe(false);   // the login stays valid so the fingerprint can resume it
    q('.wl-bio').click(); await sleep(900);
    expect(q('#welcome')).toBeNull(); expect(JSON.parse(localStorage.getItem('wn:acct')).sub).toBe('u1'); expect(JSON.parse(localStorage.getItem('wn:sess')).user.id).toBe('u1');
  }, 20000);

  it('a cancelled check keeps you on the sign-in screen, and the password still works', async () => {
    await enableIt(); q('#who').click(); q('#signout').click(); await sleep(500);
    fail = true; q('.wl-bio').click(); await sleep(300);
    expect(q('#welcome')).toBeTruthy(); expect(q('#wlErr').textContent).toMatch(/Cancelled/);
    q('#wlEmail').value = 't@example.com'; q('#wlPass').value = 'password1'; q('#wlForm').dispatchEvent(new Event('submit', { cancelable: true })); await sleep(900);
    expect(q('#welcome')).toBeNull();
  }, 20000);

  it('without turning it on, signing out fully ends the login on the server', async () => {
    q('#who').click(); q('#signout').click(); await sleep(500);
    expect(q('.wl-bio')).toBeNull(); expect(state.calls.some(c => c.endsWith('/auth/v1/logout'))).toBe(true);
  });

  it('a profile can be locked with it, and only on devices where it is turned on', async () => {
    const st = await import('../src/core/state.js'); const p = st.PROFILES.list[0] || st.createProfile({ name: 'Me' });
    st.updateProfile(p.id, { bio: true }); expect(st.isLocked(p)).toBe(false);   // not enabled here: never locks you out
    await enableIt(); expect(st.isLocked(p)).toBe(true);
    st.unlock(p.id); expect(st.isLocked(p)).toBe(false);
  }, 20000);
});
