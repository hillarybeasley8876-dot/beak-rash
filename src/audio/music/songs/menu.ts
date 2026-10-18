// Menu — "Hideout Café" · 120 bpm · F minor / Ab major · lazy swung lounge acid jazz.
// Loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:08): walking lines per section, a solo, a breakdown.
import { bars, rep, transpose } from './util';
import type { Lanes, Song } from '../types';

const REST = '................';
const K = 'X......x..X.....';
const K2 = 'X......x..X...x.';
const S = '....r..g....r..g';
const S2 = '..g.r..g.g..r..g';
const H = 'x.o.x.o.x.o.x.oo';
const SHAKE = '..s...s...s...s.';
const RIDE = 'R..R.RR..R.RR..R';
const FILLS: Lanes[] = [
  { snare: '....r..g..g.X.gg', hat: 'x.o.x.o.x.o.....', cym: '..............W.' },
  { snare: '....r..g....r.gX', tom: '..........1.2.3.', hat: 'x.o.x.o.x.......' },
  { snare: '....r...r.g.X.gg', kick: 'X......x..X.X...', hat: 'x.o.x.o.........' },
];

// Bass: walking lines, 8 bars each (degrees follow each bar's chord).
const BASS_A = bars(
  '1 - - . 5 - 8 . 7 - - . 5 . 3 .', '1 - - . 3 - 5 . 8 - - . 7 . 5 .',
  '1 - - . 5 - 6 . 7 - - . 5 . 3 .', '1 - - . 3 - 5 . 7 - - . 5 . 3~ .',
  '1 - - . 5 - 8 . 7 - - . 6 . 5 .', '1 - - . 3 - 5 . 8 - - . 5 . 3 .',
  '1 - - . 3 - 5 . 7 - - . 5 . 3 .', '1 - - . 5 - 8 . 5 - - . 3 . 2 .',
);
const BASS_A2 = bars(
  '1 - . 5 8 - . 7 5 - . 3 1 . 7, .', '1 - . 3 5 - . 8 7 - . 5 3 . 2 .',
  '1 - . 3 5 - . 6 7 - . 5 3 . 1 .', '1 - . 3 5 - . 7 8 - . 7 5 . 3~ .',
  '1 - . 5 8 - . 7 6 - . 5 3 . 2 .', '1 - . 3 5 - . 8 5 - . 3 1 . 7, .',
  '1 - . 3 5 - . 7 8 - . 7 5 . 3 .', '1 - . 5 8 - . 5 3 - . 2 1 . 5, .',
);
const BASS_A3 = bars(
  '1 . x 5 . x 8 . 7 . x 5 . 3 x .', '1 . x 3 . x 5 . 8 . x 7 . 5 x .',
  '1 . x 5 . x 6 . 7 . x 5 . 3 x .', '1 . x 3 . x 5 . 7 . x 5 . 3~ x .',
  '1 . x 5 . x 8 . 7 . x 6 . 5 x .', '1 . x 3 . x 5 . 8 . x 5 . 3 x .',
  '1 . x 3 . x 5 . 7 . x 5 . 3 x .', '1 . x 5 . x 8 . 5 . 3 . 2 . 1 .',
);
// Bridge: a two-feel (half notes) for four bars, then walking again.
const BASS_B = bars(
  '1 - - - - - - - 5 - - - 8 - - -', '1 - - - - - - - 5 - - - 3 - - -',
  '1 - - - - - - - 5 - - - 7 - - -', '1 - - - - - - - 3 - - - 5 - - -',
  '1 - - . 3 - 5 . 8 - - . 5 . 3 .', '1 - - . 3 - 5 . 7 - - . 5 . 3 .',
  '1 - - . 5 - 8 . 7 - - . 5 . 3 .', '1 - - . 3 - 5 . 7 - - . 5 . 1 .',
);
const BASS_B2 = bars(
  '1 - - . 5 - 8 . 7 - - . 5 . 3 .', '1 - - . 3 - 5 . 6 - - . 5 . 3 .',
  '1 - - . 5 - 8 . 7 - - . 5 . 3~ .', '1 - - . 3 - 5 . 7 - - . 8 . 5 .',
  '1 - - . 3 - 5 . 8 - - . 5 . 3 .', '1 - - . 3 - 5 . 7 - - . 5 . 3 .',
  '1 - - . 5 - 8 . 7 - - . 5 . 3 .', '1 - - . 3 - 5 . 7 - - . 5 . 1 .',
);
// Solo: four to the bar.
const BASS_S = bars(
  '1 - - . 3 - - . 5 - - . 7 - - .', '1 - - . 3 - - . 5 - - . 8 - - .',
  '1 - - . 3 - - . 5 - - . 6 - - .', '1 - - . 3 - - . 5 - - . 7 - - .',
  '1 - - . 5 - - . 3 - - . 5 - - .', '1 - - . 3 - - . 5 - - . 3 - - .',
  '1 - - . 3 - - . 5 - - . 7 - - .', '1 - - . 5 - - . 3 - - . 2 - - .',
);
const BASS_D = bars(
  rep('1 - - - - - - - - - - - - - - -', 3), '1 - - - - - - - 5 - - - 3 - - -',
  '1 . 1 . 1 . 1 . 1 . 1 . 1 . 1 .', '1 . 1 . 1 . 1 . 1 . 1 . 8 . 8 .',
  '1 . 1 . 8 . 1 . 1 . 1 . 8 . 8 .', '1 1 8 1 8 1 8 1 5 5 5 5 3 3 2 2',
);

// Comping.
const COMP = 'X---..x-...x-...';
const COMP_A3 = 'x-..x-..x-...x..';
const CHORDS_A = 'Fm9 | Bbm9 | Eb13 | Abmaj9 | Dbmaj9 | Gm7b5 | C7b9 | Fm9';
const CHORDS_B = 'Bbm9 | Eb13 | Abmaj9 | Dbmaj7#11 | Gm7b5 | C7alt | Fm9 | Gb7#11';

// Leads: breathy flute melody (A2 / A3 / A4) and bridge line (B / B2), square-synth solo over the A changes (S).
const MELODY = bars(
  'C6 - - - Bb5 - Ab5 - G5 - - - Ab5 - Bb5 -',
  'C6 - - - Db6 - C6 - Bb5 - Ab5 - F5 - - -',
  'G5 - - - - - Ab5 Bb5 C6 - Bb5 - G5 - Eb5 -',
  'Eb5 - - - - - - - . . . . C5 Eb5 G5 Bb5',
  'C6 - - - Ab5 - F5 - Eb5 - - - F5 - Ab5 -',
  'Bb5 - - - A5 - G5 - F5 - - - Db5 - F5 -',
  'E5 - - - G5 - Bb5 - Db6 - - - C6 - Bb5 -',
  'Ab5 - - - - - - - G5 - - - . . . .',
);
const MELODY_A4 = MELODY.split(' | ').slice(0, 7).join(' | ') + ' | Ab5 - - - G5 - F5 - Eb5 - - - C5 - - -';
const BRIDGE = bars(
  'F5 - - - Ab5 - C6 - Db6 - - - C6 - - -',
  'Bb5 - - - G5 - - - F5 - - - Eb5 - - -',
  'G5 - - - - - Bb5 - C6 - - - Eb6 - - -',
  'F6 - - - Eb6 - C6 - G5 - - - . . . .',
  'Db6 - - - - - Bb5 - A5 - - - F5 - - -',
  'E5 - - - Ab5 - - - Eb6 - - - Db6 - - -',
  'C6 - - - - - Ab5 - G5 - - - F5 - - -',
  'Bb5 - - - Ab5 - - - E5 - - - . . . .',
);
const SOLO = bars(
  'C6 - Ab5 - G5 F5 - Eb5 - F5 - Ab5 C6 - - .',
  'Db6 - C6 - Bb5 - F5 - Ab5 - - - . . Db6 C6',
  'Bb5 - G5 - C6 - Db6 - C6 - Bb5 - G5 - Eb5 -',
  'C6 - Eb6 - G6 - - - F6 - Eb6 - C6 - Bb5 -',
  'Ab5 - C6 - Eb6 - F6 - - - Eb6 - C6 - Ab5 -',
  'Bb5 - Db6 - F6 - - - Db6 - Bb5 - G5 - - -',
  'E5 - G5 - Bb5 - Db6 - C6 - Bb5 - G5 - E5 -',
  'F5 - - - Ab5 - G5 - F5 - - - . . . .',
);

const A = {
  bars: 8, chords: CHORDS_A, kick: K, snare: S, hat: H, perc: SHAKE, bass: BASS_A, keys: COMP, fill: FILLS,
};
const B = {
  ...A,
  chords: CHORDS_B,
  cym: 'C...............' + rep('R...R...R...R...', 7),
  hat: bars(REST, rep(H, 7)),
  bass: BASS_B,
  keys: 'X-------x-------',
  pad: rep('X---------------', 8),
  brass: bars(rep(REST, 3), '........x-------', rep(REST, 3), 'x-------........'),
  lead: BRIDGE,
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
    A: { ...A, gainDb: -3 },
    A2: { ...A, bass: BASS_A2, lead: MELODY },
    B,
    A3: { ...A, kick: K2, snare: S2, bass: BASS_A3, keys: COMP_A3, lead: MELODY, lead2: transpose(MELODY, -12), perc: '..s.t.s...s.t.s.' },
    S: {
      ...A, voice: 'synth', hat: REST, cym: rep(RIDE, 8), snare: '....r.......r...', bass: BASS_S, keys: 'X-......x-......', lead: SOLO,
      brass: bars(rep(REST, 3), '........x-------', rep(REST, 3), 'x-------........'),
    },
    D: {
      shape: 'breakdown',
      bars: 8, chords: 'Dbmaj9 | C7b9 | Fm9 | Fm9 | Dbmaj9 | C7b9 | Fm9 | C7alt',
      kick: bars(rep(REST, 4), 'X.........X.....', 'X.........X.....', K, 'X...X...X.X.XXXX'),
      snare: bars(rep(REST, 4), '....r.......r...', '....r.......r...', '....r..g....r.gg', 'g.g.g.g.r.r.rrrr'),
      hat: bars(rep(REST, 5), 'x...x...x...x...', H, H), perc: bars(rep(SHAKE, 4), rep(REST, 4)),
      bass: BASS_D, keys: rep('X---------------', 8), pad: rep('X---------------', 8),
      cym: bars('C...............', rep(REST, 6), 'W...............'),
      brass: bars(rep(REST, 5), '........x-------', REST, 'r-------........'),
    },
    B2: { ...B, gainDb: 2, kick: K2, snare: S2, bass: BASS_B2, keys: COMP, lead2: transpose(BRIDGE, -12) },
    A4: { ...A, bass: BASS_A2, keys: COMP_A3, lead: MELODY_A4, perc: '..s.t.s...s.t.s.' },
  },
  form: ['intro', 'A', 'A2', 'B', 'A3', 'S', 'D', 'B2', 'A4'],
  loopFrom: 1,
  notes:
    'Lounge acid jazz for the menus, 120 bpm, heavy 16th swing (0.24), vinyl crackle; loop A–A2–B–A3–S–D–B2–A4 = 64 bars ' +
    '(2:08). A (8): the circle progression Fm9–Bbm9–Eb13–Abmaj9–Dbmaj9–Gm7b5–C7b9–Fm9 (vi–ii–V–I–IV–vii–III7–vi in Ab). ' +
    'Rim-click backbeat with ghost notes, soft kick, 8th hats, shaker on the &s, an 8-bar walking slap line (1–5–8–7 shapes, ' +
    'a slide into Abmaj9). A2: the breathy flute melody (C6 down to G5, answered over Bbm9, a b9 Db6 over C7b9) over a busier ' +
    'walk with approach notes. B (bridge): Bbm9–Eb13–Abmaj9–Dbmaj7#11 then Gm7b5–C7alt–Fm9 and a Gb7#11 tritone sub back; ' +
    'two-feel bass for 4 bars then walking, ride, warm pad, soft brass swells, flute counter-line. A3: pushed kick, ghosted ' +
    '16th bass, new comp rhythm, tambourine, the melody doubled an octave down. S: square-synth solo over the A changes ' +
    '(arpeggios with a b9 over C7b9), ride cymbal, four-to-the-bar bass. D: 4-bar breakdown (Rhodes + pad + whole-note bass, ' +
    'shaker only) and a 4-bar rebuild (rim, kick, 8th → 16th bass) into B2: the bridge with the full groove and an ' +
    'octave-doubled flute. A4: melody with a new last bar (Ab–G–F–Eb–C). Three rotating fills.',
};
