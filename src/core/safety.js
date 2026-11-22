// Kids profiles only see family-friendly titles. TMDB genre ids: 16 Animation, 10751 Family, 10762 Kids;
// 27 Horror, 53 Thriller, 80 Crime, 10752 War are always blocked.
const GOOD = [16, 10751, 10762], BAD = [27, 53, 80, 10752];
export const isSafeFor = (kids, it) => !kids || it.type === 'person' || ((it.genres || []).some(g => GOOD.includes(g)) && !(it.genres || []).some(g => BAD.includes(g)));
export const KIDS_PROMPT = 'The viewer is a child. Only recommend family-friendly titles (G or PG, kids and family animation). Never suggest horror, thrillers, crime or war.';
