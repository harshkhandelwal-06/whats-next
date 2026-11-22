import { pageAsk } from './features/ask.js';
import { pageDNA } from './features/dna.js';
import { pageWrapped } from './features/wrapped.js';
import { pageNight } from './features/night.js';
import { pageMood } from './features/mood.js';
import { pageExplore, pageRadar } from './pages/explore.js';
import { pageForYou } from './pages/foryou.js';
import { pageList } from './pages/list.js';
import { pageCollection, pagePerson } from './pages/person.js';
import { pageSearch } from './pages/search.js';
import { pageSwipe, swipe } from './pages/swipe.js';
import { pageTitle } from './pages/title.js';

// Getters keep the table lazy, so import cycles between pages and the router can never leave a route undefined.
export const ROUTES = { get stats() { return pageWrapped; }, get night() { return pageNight; }, get radar() { return pageRadar; }, get foryou() { return pageForYou; }, get browse() { return pageExplore; }, get discover() { return pageExplore; }, get swipe() { return pageSwipe; }, get list() { return pageList; }, get rewatch() { return (m, tok) => pageList(m, tok, 'rewatch'); }, get mood() { return pageMood; }, get ask() { return pageAsk; }, get dna() { return pageDNA; }, get t() { return pageTitle; }, get p() { return pagePerson; }, get c() { return pageCollection; }, get search() { return pageSearch; } };
