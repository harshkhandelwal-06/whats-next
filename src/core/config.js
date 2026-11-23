export const IMG = 'https://image.tmdb.org/t/p/';

export const BASE = 'https://api.themoviedb.org/3';

// Your Supabase project (Project Settings -> API). Both values are safe to publish: the anon key only works within the row rules in supabase/setup.sql.
const live = import.meta.env.MODE !== 'test';   // the automated tests run against a fake server
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || (live ? 'https://yynvpdmkqgynioujjwwr.supabase.co' : '');
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || (live ? 'sb_publishable_hJ7ZEg6EoRsQBBRESn-Z7Q_f0R3CSbG' : '');
export const LANGS = [['','Any language'],['en','English'],['hi','Hindi'],['ta','Tamil'],['te','Telugu'],['ml','Malayalam'],['kn','Kannada'],['bn','Bengali'],['mr','Marathi'],['pa','Punjabi'],['ko','Korean'],['ja','Japanese'],['zh','Chinese'],['es','Spanish'],['fr','French'],['de','German'],['it','Italian'],['pt','Portuguese'],['tr','Turkish'],['th','Thai'],['ru','Russian'],['ar','Arabic']];

export const REGIONS = ['IN','US','GB','CA','AU','DE','FR','ES','IT','JP','KR','BR','MX','AE','SG'];

export const STATUS_LABEL = { watchlist: 'Watchlist', watching: 'Watching', watched: 'Watched', unseen: 'Not seen', hidden: 'Hidden' };

export const RATES = [[10,'❤️','Loved it'],[8,'👍','Liked it'],[5,'😐','Meh'],[2,'👎','Disliked']];

export const ERAS = [['','Any year'],['2020-2029','2020s'],['2010-2019','2010s'],['2000-2009','2000s'],['1990-1999','1990s'],['1980-1989','1980s'],['1900-1979','Classics']];
