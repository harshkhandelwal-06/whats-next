import { ACTIVE, S, bootProfiles } from './core/state.js';
import { initProfiles } from './features/profiles.js';
import { setSync, signedIn, syncNow } from './core/sync.js';
import { route } from './router.js';
import './app/events.js';
import './core/ai.js';
import './core/api.js';
import './core/config.js';
import './core/library.js';
import './core/rec.js';
import './core/state.js';
import './core/sync.js';
import './core/utils.js';
import './features/ask.js';
import './features/dna.js';
import './features/mood.js';
import './features/tracker.js';
import './pages/explore.js';
import './pages/foryou.js';
import './pages/list.js';
import './pages/person.js';
import './pages/search.js';
import './pages/setup.js';
import './pages/swipe.js';
import './pages/title.js';
import './router.js';
import './routes.js';
import './ui/components.js';
import './ui/motion.js';
import './fx/mode.js';
import './fx/touch.js';
import './ui/theme.js';
import './ui/motion.js';
import './fx/prefetch.js';
import { playIntro } from './fx/intro.js';
import './ui/settings.js';
import './ui/account.js';
import './core/friends.js';
import './styles/index.css';

document.documentElement.classList.add('rdy');   // styles are in; reveal the page (no unstyled flash)
bootProfiles();
window.addEventListener('hashchange', () => route());

setSync('off');

if (signedIn()) setTimeout(() => syncNow(false), 900);   // pulls in anything saved from another device

if (import.meta.env.PROD && 'serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

playIntro();
initProfiles();
if (ACTIVE.id) route();
