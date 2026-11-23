// Optional fingerprint / face unlock (WebAuthn platform authenticator). It is a convenience lock on THIS device:
// the check happens here, and your password stays the real key. Nothing biometric ever leaves the device.
import { getAccount } from './state.js';

const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ns = sub => 'wn:' + String(sub || '').replace(/[^\w-]/g, '') + ':bio';

export async function supported() {
  try { return !!(window.PublicKeyCredential && navigator.credentials && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
}
/** Is fingerprint/face unlock turned on for the account signed in here? */
export const enabled = () => !!read(ns(getAccount()?.sub))?.cred;
export const credOf = () => read(ns(getAccount()?.sub))?.cred || '';

async function ask(credId) {
  const r = await navigator.credentials.get({ publicKey: { challenge: rnd(32), rpId: location.hostname, userVerification: 'required', timeout: 60000, allowCredentials: [{ type: 'public-key', id: unb64(credId), transports: ['internal'] }] } });
  if (!r) throw new Error('cancelled'); return true;
}
const friendly = e => (/NotAllowed|cancel|abort|timed out/i.test(e?.name + ' ' + e?.message) ? new Error('Cancelled. Nothing changed.') : new Error('Your device could not do that. Try again, or use your password.'));

/** Turn it on for the signed-in account. Asks the device for a fingerprint or face once. */
export async function enable() {
  const a = getAccount(); if (!a) throw new Error('Sign in first.');
  let c; try { c = await navigator.credentials.create({ publicKey: { challenge: rnd(32), rp: { name: "What's Next", id: location.hostname }, user: { id: rnd(16), name: a.email || 'account', displayName: a.name || a.email || 'account' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000 } }); } catch (e) { throw friendly(e); }
  if (!c?.rawId) throw new Error('Your device could not do that. Try again, or use your password.');
  write(ns(a.sub), { cred: b64(c.rawId), ts: Date.now() }); return true;
}
export function disable() { const a = getAccount(); if (!a) return; write(ns(a.sub), null); const q = read('wn:quick') || {}; delete q[a.sub]; write('wn:quick', q); }

/** A fresh fingerprint/face check for the account signed in here (used to open locked profiles). */
export async function verify() { try { return await ask(credOf()); } catch (e) { throw friendly(e); } }

/* Signing out keeps a small "unlock" entry on this device so a fingerprint can bring you back in. */
export const quickList = () => Object.values(read('wn:quick') || {}).filter(e => e?.cred && e?.rt);
export function stash(rt) { const a = getAccount(); if (!a || !enabled() || !rt) return false; const q = read('wn:quick') || {}; q[a.sub] = { sub: a.sub, email: a.email, name: a.name, cred: credOf(), rt }; write('wn:quick', q); return true; }
export const forget = sub => { const q = read('wn:quick') || {}; delete q[sub]; write('wn:quick', q); write(ns(sub), null); };
export async function unlockEntry(e) { try { return await ask(e.cred); } catch (x) { throw friendly(x); } }
export const consume = sub => { const q = read('wn:quick') || {}; delete q[sub]; write('wn:quick', q); };   // one use: the next sign-out saves a fresh one
