// Menu — "Hideout Café" · 120 bpm · F minor / Ab major · lazy swung lounge acid jazz.
import { bars, rep } from './util';
import type { Song } from '../types';

const REST = '................';
const K = 'X......x..X.....';
const S = '....r..g....r..g';
const H = 'x.o.x.o.x.o.x.oo';
const SHAKE = '..s...s...s...s.';
const WALK = '1 - - . 5 - 8 . 7 - - . 5 . 3 .';
const COMP = 'X---..x-...x-...';
const FILL = { snare: '....r..g..g.X.gg', hat: 'x.o.x.o.x.o.....', cym: '..............W.' };

const MELODY = bars(
  'C6 - - - Bb5 - Ab5 - G5 - - - Ab5 - Bb5 -',
  'C6 - - - Db6 - C6 - Bb5 - Ab5 - F5 - - -',
  'G5 - - - - - Ab5 Bb5 C6 - Bb5 - G5 - Eb5 -',
  'Eb5 - - - - - - - . . . . C5 Eb5 G5 Bb5',
  'C6 - - - Ab5 - F5 - Eb5 - - - F5 - Ab5 -',
  'Bb5 - - - Ab5 - G5 - F5 - - - Db5 - F5 -',
  'E5 - - - G5 - Bb5 - Db6 - - - C6 - Bb5 -',
  'Ab5 - - - - - - - G5 - - - . . . .',
);

const BRIDGE = bars(
  'F5 - - - Ab5 - C6 - Db6 - - - C6 - - -',
  'Bb5 - - - G5 - - - F5 - - - Eb5 - - -',
  'G5 - - - - - Bb5 - C6 - - - Eb6 - - -',
  'F6 - - - Eb6 - C6 - G5 - - - . . . .',
  'Db6 - - - C6 - Bb5 - Ab5 - - - F5 - - -',
  'E5 - - - Ab5 - - - Eb6 - - - Db6 - - -',
  'C6 - - - - - Ab5 - G5 - - - F5 - - -',
  'Bb5 - - - Ab5 - - - E5 - - - . . . .',
);

const A = {
  bars: 8, chords: 'Fm9 | Bbm9 | Eb13 | Abmaj9 | Dbmaj9 | Gm7b5 | C7b9 | Fm9',
  kick: K, snare: S, hat: H, perc: SHAKE, bass: WALK, keys: COMP, fill: FILL,
};

export const MENU: Song = {
  id: 'menu',
  title: 'Hideout Café',
  bpm: 120,
  swing: 0.24,
  key: 'F minor / Ab major',
  lead: 'flute',
  crackle: 0.3,
  mix: { drums: 0.75, keys: 1.15, bass: 0.75, lead: 0.6 },
  sections: {
    intro: {
      bars: 2, chords: 'Fm9 | Fm9', keys: 'X-------x-------', hat: 'x...x...x...x...', pad: 'X---------------',
      fill: { keys: 'X---..x-...x-...', snare: '....r.......r.gg', bass: '. . . . . . . . 5 - 8 . 7 - 5 .', cym: '........W.......' },
    },
    A,
    A2: { ...A, lead: MELODY },
    B: {
      ...A,
      chords: 'Bbm9 | Eb13 | Abmaj9 | Dbmaj7#11 | Gm7b5 | C7alt | Fm9 | Gb7#11',
      cym: 'C...............' + rep('R...R...R...R...', 7),
      hat: bars(REST, rep(H, 7)),
      pad: rep('X---------------', 8),
      brass: bars(rep(REST, 3), '........x-------', rep(REST, 3), 'x-------........'),
      lead: BRIDGE,
    },
  },
  form: ['intro', 'A', 'A2', 'B', 'A2'],
  loopFrom: 1,
  notes:
    'Lounge acid jazz for the menus, 120 bpm, heavy 16th swing (0.24), vinyl crackle. A (8): the circle progression ' +
    'Fm9–Bbm9–Eb13–Abmaj9–Dbmaj9–Gm7b5–C7b9–Fm9 (vi–ii–V–I–IV–vii–III7–vi in Ab). Rim-click backbeat with ghost notes, ' +
    'soft kick, 8th hats, shaker on the &s, walking-ish legato slap bass (1–5–8–7–5–3), sustained Rhodes comping. ' +
    'A2 adds the breathy flute melody (C6 down to G5, answered over Bbm9, a b9 Db6 over C7b9). B (bridge): ' +
    'Bbm9–Eb13–Abmaj9–Dbmaj7#11 then Gm7b5–C7alt–Fm9 and a Gb7#11 tritone-sub back to Fm9; ride cymbal, warm pad, ' +
    'soft brass swells, flute counter-line. Loops A→A2→B→A2.',
};
