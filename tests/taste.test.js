import { describe, expect, it, beforeEach } from 'vitest';
import { S } from '../src/core/state.js';
import { blocked, lean, note, parse, setNote, summary } from '../src/core/taste.js';

const T = (o = {}) => ({ id: 1, type: 'movie', title: 'X', overview: '', genres: [], lang: 'en', ...o });
beforeEach(() => { setNote('', 'movie'); setNote('', 'tv'); });

describe('mood note', () => {
  it('understands "not in the mood for superheroes and stuff"', () => {
    setNote('I am not in the mood for superheroes and stuff', 'movie');
    expect(summary().skip).toEqual(['superheroes']);
    expect(blocked(T({ title: 'The Avengers' }))).toBe(true);
    expect(blocked(T({ title: 'Heat', overview: 'A crew of thieves.' }))).toBe(false);
    expect(blocked(T({ overview: 'A young hero with super powers fights crime' }))).toBe(true);
  });
  it('a list of things to skip, then something to lean towards', () => {
    setNote('no horror, zombies or war. more comedy please', 'movie');
    const s = summary(); expect(s.skip).toEqual(expect.arrayContaining(['horror', 'zombies', 'war'])); expect(s.lean).toEqual(['comedy']);
    expect(blocked(T({ genres: [27] }))).toBe(true); expect(blocked(T({ genres: [35] }))).toBe(false);
    expect(lean(T({ genres: [35] }))).toBeGreaterThan(0); expect(lean(T({ genres: [18] }))).toBe(0);
  });
  it('"but" flips the mood; plain words are matched in the blurb', () => {
    setNote('no romance but I want sci-fi. sick of cowboys', 'movie');
    const p = parse(note('movie')); expect(p.avoid.map(x => x.id)).toEqual(['romance']); expect(p.want.map(x => x.id)).toEqual(['scifi']);
    expect(blocked(T({ overview: 'A lone cowboy rides into town' }))).toBe(true);
  });
  it('movies and TV keep separate notes', () => {
    setNote('no superheroes', 'movie'); setNote('no reality shows', 'tv');
    expect(blocked(T({ title: 'Avengers' }))).toBe(true); expect(blocked(T({ type: 'tv', title: 'Avengers' }))).toBe(false);
    expect(blocked(T({ type: 'tv', genres: [10764] }))).toBe(true); expect(blocked(T({ genres: [10764] }))).toBe(false);
  });
  it('an empty note blocks nothing', () => { expect(blocked(T({ genres: [27], title: 'Marvel' }))).toBe(false); });
});
