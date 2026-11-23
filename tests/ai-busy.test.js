import { describe, it, expect } from 'vitest';
import { boot, sleep, state } from './helpers/mocks.js';

describe('when Gemini is overloaded', () => {
  it('answers from the movie database instead of showing a raw error', async () => {
    await boot({ watchnext: { cfg: { key: 'a'.repeat(32), geminiKey: 'gem-key' }, lib: {} } });
    state.geminiBusy = true;
    const q = document.querySelector('#q'); q.value = 'looking for a movie like Interstellar or Dune'; q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await sleep(4500);
    const last = [...document.querySelectorAll('.chat .msg.b')].pop();
    expect(last.textContent).toMatch(/busy right now/); expect(last.textContent).not.toMatch(/Gemini error 503/);
    expect(last.querySelectorAll('.card').length).toBeGreaterThan(0);
    state.geminiBusy = false;
  }, 20000);
});
