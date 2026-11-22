// Pure defaults. No imports, so any module (and the unit tests) can use them without cycles.
export const DEVICE_KEYS = ['key', 'geminiKey', 'geminiModel', 'omdbKey', 'gClient', 'gApiKey', 'gSync', 'gSyncKeys', 'gUser'];
export const PREF_KEYS = ['region', 'langs', 'providers', 'hideSeen', 'type', 'f', 'lists', 'friends', 'myShare'];
export const DEFAULT_LIST = { id: 'next', name: 'Next to watch' };
export const DEF = {
  cfg: {
    key: '', geminiKey: '', geminiModel: '', omdbKey: '', gClient: '', gApiKey: '', gSync: false, gSyncKeys: true, gUser: null,
    shown: [], region: 'IN', type: 'movie', langs: [], providers: [], hideSeen: true, kids: false, lists: [{ id: 'next', name: 'Next to watch' }], friends: [], myShare: null,
    f: { genres: [], lang: '', sort: '', era: '', min: '', myOnly: false },
  },
  lib: {},
};
export const AVATARS = ['🎬', '🍿', '🦊', '🐼', '🐙', '🦄', '🚀', '👾', '🧙', '🦖', '🐸', '🌵', '🎧', '🎸', '⚡', '🔥', '🌙', '🍕', '🐱', '🐶', '🦉', '🧸', '👻', '🤖'];
export const COLORS = ['', '255,90,31', '49,57,251', '10,132,255', '48,176,199', '52,199,89', '255,159,10', '255,55,95', '175,82,222'];  // '' follows the theme accent
export const DEF_COLOR = '';
