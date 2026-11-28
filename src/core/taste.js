// "Right now I am not in the mood for ..." — a short note in the person's own words that keeps shaping
// what the home screen recommends until they edit or clear it. It is saved with the profile (cfg.note).
import { S } from './state.js';

/* say = how a person might mention it, re = how it shows up in a title or blurb, g = TMDB genre ids it stands for. */
const TOPICS = [
  { id: 'hero', name: 'superheroes', say: /super\s?-?hero|marvel|\bdc\b|avengers|comic\s?-?book|batman|superman|spider\s?-?man|x-men|capes?\b/, re: /super\s?-?hero|marvel|avengers|batman|superman|spider\s?-?man|x-men|justice league|comic[- ]book|super\s?-?powers?|mutants?\b|\bdc comics\b/i, g: [] },
  { id: 'horror', name: 'horror', say: /horror|scary|creepy|spooky|slasher|jump ?scares?/, re: /\bslasher|haunted|possess(ed|ion)|demonic|serial killer/i, g: [27] },
  { id: 'romance', name: 'romance', say: /romance|romantic|rom-?com|love stor|mushy|cheesy love/, re: /\bromance|falls? in love|love story/i, g: [10749] },
  { id: 'war', name: 'war', say: /\bwars?\b|military|battlefield|soldiers?/, re: /\bworld war|battlefield|soldiers?\b/i, g: [10752] },
  { id: 'anime', name: 'anime', say: /anime/, fn: it => it.lang === 'ja' && (it.genres || []).includes(16), g: [] },
  { id: 'animation', name: 'animation', say: /animat|cartoon|pixar|kids? stuff/, re: /$^/, g: [16] },
  { id: 'comedy', name: 'comedy', say: /comed|funny|sitcom|slapstick/, re: /$^/, g: [35] },
  { id: 'action', name: 'action', say: /\baction\b|explosion|shoot-?outs?|fight scenes?/, re: /$^/, g: [28, 10759] },
  { id: 'scifi', name: 'sci-fi', say: /sci-?fi|science fiction|\baliens?\b|\bspace\b|futuristic/, re: /\baliens?\b|outer space|spaceship|dystopi/i, g: [878, 10765] },
  { id: 'fantasy', name: 'fantasy', say: /fantasy|wizards?|\bdragons?\b|sword and sorcery/, re: /\bwizards?\b|\bdragons?\b|sorcer/i, g: [14] },
  { id: 'crime', name: 'crime', say: /\bcrime|gangsters?|mafia|heists?/, re: /\bgangsters?\b|\bmafia\b|\bheist\b|drug lord/i, g: [80] },
  { id: 'thriller', name: 'thrillers', say: /thriller|suspense|edge of (my|the) seat/, re: /$^/, g: [53] },
  { id: 'doc', name: 'documentaries', say: /documentar/, re: /$^/, g: [99] },
  { id: 'musical', name: 'musicals', say: /musicals?|singing|sing-?along/, re: /\bmusical\b/i, g: [10402] },
  { id: 'zombie', name: 'zombies', say: /zombie|undead|apocalypse|post-?apocalyptic/, re: /zombie|undead|apocalyp/i, g: [] },
  { id: 'sad', name: 'heavy, sad stories', say: /\bsad\b|depress|tragic|heavy|bleak|tearjerker|cry\b/, re: /tragic|grief|bleak|heartbreak|terminal(ly)? ill|loses? (his|her|their) (wife|husband|child|son|daughter)/i, g: [] },
  { id: 'reality', name: 'reality TV', say: /reality|talk shows?|game shows?/, re: /$^/, g: [10764, 10767] },
  { id: 'sports', name: 'sports', say: /sports?\b|football|cricket|boxing|basketball/, re: /\bsports?\b|football|cricket|boxing|basketball|wrestl/i, g: [] },
  { id: 'violence', name: 'violence and gore', say: /violen|gore|gory|brutal|bloody/, re: /brutal|gore|massacre|bloodbath|slasher/i, g: [27] },
  { id: 'kids', name: 'kids’ shows', say: /\bkids?\b|childish|children/, re: /$^/, g: [10762] },
];

const NEG = /\b(not in the mood|no more|not into|not a fan|don'?t want|do not want|don'?t like|do not like|dont want|dont like|avoid|skip|hate|sick of|tired of|bored of|fed up|without|never|nothing|no\b|not\b|less)\b/;
const CUE = /\b(i am|i'm|im|i do not|i don'?t|dont|not in the mood for|not in the mood of|not in the mood|in the mood for|in the mood|want|wanna|love|like|prefer|crave|into|more|less|no more|avoid|skip|hate|sick of|tired of|bored of|fed up with|fed up|without|never|nothing|please|right now|today|tonight|anything|with|any|for|of|to|see|watch|watching|recommend|recommendations?|suggest|me|my|the|a|an|and|or|but|also|just|really|too|much|stuff|things?|type|types|kind|kinds|genre|genres|movies?|films?|shows?|series|tv|content|that|those|these|this|is|are|be|have|has|get|got|some|so|very|not|no)\b/g;

const POS = /\b(want|wanna|love|crave|prefer|into|more|in the mood for|feel like|only)\b/;
let memo = { text: null, val: null };

/** What a note means: topics to steer away from, topics to lean towards, and any other words to avoid. */
export function parse(text) {
  const t = String(text || '').toLowerCase().trim();
  if (memo.text === t && memo.val) return memo.val;
  const avoid = new Map(), want = new Map(), words = new Set();
  for (const sent of t.split(/[.;!\n]+/).map(s => s.trim()).filter(Boolean)) {
    let prev = 'pos', flip = false;
    sent.split(/(\bbut\b|\binstead\b|\brather\b|,|\band\b|\bor\b|&|\/)/).forEach(part => {
      if (/^(but|instead|rather)$/.test(part)) { flip = true; return; }
      if (/^(,|and|or|&|\/)$/.test(part)) return;
      // Each clause says "no" or "yes". A clause with no cue of its own follows the one before it, or flips it after "but".
      const mode = NEG.test(part) ? 'neg' : POS.test(part) ? 'pos' : flip ? (prev === 'neg' ? 'pos' : 'neg') : prev;
      prev = mode; flip = false;
      let rest = part;
      for (const tp of TOPICS) if (tp.say.test(part)) { (mode === 'neg' ? avoid : want).set(tp.id, tp); rest = rest.replace(new RegExp(tp.say.source, 'g'), ' '); }
      if (mode === 'neg') for (const w of rest.replace(CUE, ' ').split(/[^a-z0-9'’-]+/)) { const x = w.replace(/('s|’s)$/, '').replace(/ies$/, 'y').replace(/s$/, ''); if (x.length >= 4) words.add(x); }
    });
  }
  for (const id of avoid.keys()) want.delete(id);
  const val = { avoid: [...avoid.values()], want: [...want.values()], words: [...words].slice(0, 8) };
  val.re = val.words.length ? new RegExp('\\b(' + val.words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'i') : null;
  memo = { text: t, val };
  return val;
}

const ty = t => t === 'tv' ? 'tv' : 'movie';
/** Movies and TV shows each keep their own note: what you want from a film tonight is not what you want from a series. */
export const note = (type = S.cfg?.type) => String(S.cfg?.notes?.[ty(type)] || '').trim();
export const setNote = (v, type = S.cfg.type) => { const n = S.cfg.notes = S.cfg.notes || { movie: '', tv: '', movieTs: 0, tvTs: 0 }; n[ty(type)] = String(v || '').trim().slice(0, 400); n[ty(type) + 'Ts'] = Date.now(); };
const cur = type => parse(note(type));

/** Short, readable list of what the note was understood to mean. */
export function summary(text = note(), type) {
  const p = parse(text);
  return { skip: [...p.avoid.map(x => x.name), ...p.words], lean: p.want.map(x => x.name) };
}

const hits = (tp, it) => (tp.g || []).some(g => (it.genres || []).includes(g)) || (tp.fn ? tp.fn(it) : false) || (tp.re ? tp.re.test((it.title || '') + ' ' + (it.overview || '')) : false);

/** True when a title is something the person said they are not in the mood for (in the note for its own type). */
export function blocked(it) {
  if (!it || it.type === 'person' || !note(it.type)) return false;
  const p = cur(it.type);
  return p.avoid.some(tp => hits(tp, it)) || !!(p.re && p.re.test((it.title || '') + ' ' + (it.overview || '')));
}

/** A small score bonus for topics the person said they do want. */
export function lean(it) { if (!it || !note(it.type)) return 0; return cur(it.type).want.reduce((s, tp) => s + (hits(tp, it) ? .7 : 0), 0); }

/** One line for the AI, so its picks respect the note too. */
export const noteBrief = type => note(type) ? `\nTHE VIEWER SAYS RIGHT NOW (follow strictly, in their words): "${note(type)}"` : '';
