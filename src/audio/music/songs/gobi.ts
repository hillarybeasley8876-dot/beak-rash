// Race · Gobi — "Dust and Turbo" · 132 bpm · E phrygian dominant · desert rock-funk: a four-on-the-
// floor kick, driving toms, handclaps and a lead that bends (a legato synth sliding between notes).
// Loop A–A2–B–A3–S–D–B2–A4 = 64 bars: every section has its own bass line, groove and comp.
import { bars, rep, transpose } from './util';
import type { Lanes, Song } from '../types';

const REST = '................';
// Drums: a driving four-on-the-floor, toms on the off-eighths, claps on the backbeat.
const K1 = 'X...X...X...X...';
const K2 = 'X...X...X...X.x.';
const K_HALF = 'X.........x.....';
const S1 = '....X.......X...';
const S2 = '....X..g....X..g';
const CL1 = '....X.......X...';
const T1 = '..3...3...3...3.';
const T2 = '.3.3.3.3.3.3.3.3';
const H1 = 'x.x.x.x.x.x.x.x.';
const H2 = 'X.x.X.x.X.x.X.x.';
const FILLS: Lanes[] = [
  { snare: '....X..g.gX.XxXX', tom: '..........1.2.33', clap: '....X.......X...' },
  { snare: '....X..g....XxXX', tom: '........11.2.3..', clap: '....X.......X...' },
  { snare: '..g.X.....X.X.XX', kick: 'X...X...X...X...', tom: '...3............', clap: '....X.......X...' },
  { snare: '....X..gX..gXXXX', tom: '111122223333....', clap: '....X.......X...' },
];

// Bass: a heavy root with 16th pickups and slides under the riff (the degrees follow each bar's
// chord: E7 | F#7 | E7 | Am | E7 | Bm | D | E7).
const BASS_A = bars(
  '1> . 1 . 8^ . 1 . 5 . 8^ . 1 . b7 .',
  '1> . 1 . 8^ . 1 . b7 . 8^ . 1 . 5 .',
  '1> . 1 . 8^ . 1 . 5 . 8^ . 1 . b6 .',
  '1> . 1 . 8^ . 1 . b7 . 5 . 1> . 8^ .',
  '1> . 1 . 8^ . 1 . 5 . 8^ . 1 . 4 .',
  '1> . 1 . 5 . 6 . 1> . 8^ . 3 . 5 .',
  '1> . 8^ . 5 . b7 . 1> . 8^ . b7 . 5~ .',
  '1> . 8^ . b7 . 5 . 1> . 8^ . 5 . b7 x',
);
const BASS_A3 = bars(
  '1> x 1 x 8^ x 1 x 5 x 8^ x 1 x b7 x',
  '1> x 1 x 8^ x 1 x b7 x 8^ x 1 x 5 x',
  '1> x 1 x 8^ x 1 x 5 x 8^ x 1 x b6 x',
  '1> x 1 x 8^ x 1 x b7 x 5 x 1> x 8^ x',
  '1> x 1 x 8^ x 1 x 5 x 8^ x 1 x 4 x',
  '1> x 1 x 5 x 6 x 1> x 8^ x 3 x 5 x',
  '1> x 8^ x 5 x b7 x 1> x 8^ x b7 x 5~ x',
  '1> x 8^ x b7 x 5 x 1> . 8^ 8^ 5 . 1~ .',
);
const BASS_B = rep(bars('1> - . 5 8^ . 5 . 1> - . 5 3 . 5 .', '1> . 8^ . 5 . 3 . 5 . 8^ . 5 . 3~ .'), 4);
const BASS_S = rep('1> . . 8^ . 1 5 . 1> . 8^ . 5 . b7 b9', 8);
const BASS_D = bars(
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - 5 - - - 3 - - -',
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - b7 - - - 5 - - -',
  '1> . 1 . 1 . 1 . 1> . 1 . 1 . 1 .', '1> . 1 . 1 . 1 . 1> . 1 . 8^ . 8^ .',
  '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 8^ .', '1> 1 8^ 1 8^ 1 8^ 1 8^ 8^ 8^ 8^ 8^ 8^ 8^ 8^',
);

// Comping: a dry stab on the backbeat, a clacking clav, a low brass in the B section.
const COMP_A = 'X---x---X---x---';
const COMP_A3 = 'x-X-x-X-x-X-x-X-';
const CLAV_A3 = 'x.gxg.x.x.gxg.x.';
const BRASS_A = bars(REST, '..........x.X-..', REST, '........X-.x.X--', REST, '..........x.X-..', REST, 'X.....x.x.X.r---');
const BRASS_B = bars('X..x..X...X.x.X-', REST, 'X..x..X...X.x.X-', REST, 'X..x..X...X.x.X-', REST, 'r-------........', 'X.....x.x.X.f---');
const BRASS_TOP = bars(
  '......x.X-......', '..........x.X-..', '......x.X-......', '........X-.x.X--',
  '......x.X-......', '..........x.X-..', 'x.x.X-..x.x.X-..', 'X.....x.x.X.r---',
);

// The lead: a bending riff (long notes that slide into the next, with scoops into the peaks).
const LEAD = bars(
  'E4 - - - G#4 - - - A4 - - - B4 - - -',
  'C5 - - - B4 - - - A4 - - - G#4 - - -',
  'E4 - - - A4 - - - B4 - - - E5 - - -',
  'F#4 - - - A4 - - - G#4 - - - E4 - - -',
  'A4 - - - C5 - - - B4 - - - G#4 - - -',
  'E4 - - - D4 - - - E4 - - - A4 - - -',
  'B4 - - - A4 - - - G#4 - - - F#4 - - -',
  'E4~ - - - . . . . . . . . . . . .',
);
// A higher answer (A2) and the solo (S).
const LEAD_A2 = bars(
  'E5 - - - G#5 - - - A5 - - - B5 - - -',
  'C6 - - - B5 - - - A5 - - - G#5 - - -',
  'E5 - - - A5 - - - B5 - - - E6 - - -',
  'F#5 - - - A5 - - - G#5 - - - E5 - - -',
  'A5 - - - C6 - - - B5 - - - G#5 - - -',
  'E5 - - - D5 - - - E5 - - - A5 - - -',
  'B5 - - - A5 - - - G#5 - - - F#5 - - -',
  'E5~ - - - . . . . . . . . . . . .',
);
const SOLO = bars(
  'E4~ - G#4 - A4 - B4~ - E5 - D5 - C5 - B4 -',
  'A4 - G#4 - F#4~ - A4 - B4 - A4 - G#4 - F#4 -',
  'E5 - D5 - C5 - B4 - A4 - G#4 - F#4 - E4 -',
  'A4~ - C5 - B4 - A4 - G#4~ - F#4 - E4 - D4 -',
  'E5 - G#5 - A5 - B5 - C6 - B5 - A5 - G#5 -',
  'F#5 - A5 - G#5 - E5 - D5 - E5 - F#5 - A5 -',
  'B5~ - A5 - G#5 - F#5 - E5 - D5 - C5 - B4 -',
  'E5 - . . . . . . . . . . . . . .',
);

const CH_A = 'E7 | F#7 | E7 | Am | E7 | Bm | D | E7';
const CH_B = 'E7 | Am | E7 | F#7 | E7 | D | C6 | E7';
const CRASH = 'C...............' + rep(REST, 7);

const A = {
  bars: 8, chords: CH_A, kick: K1, snare: S1, hat: H1, tom: T1, clap: CL1, bass: BASS_A, keys: COMP_A, cym: CRASH,
  brass: BRASS_A, fill: FILLS, layers: { 1: { brass: BRASS_TOP } },
};
const A3 = {
  ...A, kick: K2, snare: S2, tom: T2, bass: BASS_A3, keys: COMP_A3, clav: CLAV_A3, lead: LEAD,
};
const B = {
  bars: 8, chords: CH_B, kick: K1, snare: S1, hat: H2, tom: T1, clap: CL1, bass: BASS_B, keys: 'X---x---X---x---',
  cym: CRASH, pad: rep('X---------------', 8), brass: BRASS_B, lead: LEAD, fill: [FILLS[0], FILLS[2]] as Lanes[],
};

export const GOBI: Song = {
  id: 'race-gobi',
  title: 'Dust and Turbo',
  bpm: 132,
  swing: 0.06,
  key: 'E phrygian dominant',
  lead: 'synth',
  // The desert is bright and dry: the toms and claps carry it, so the Rhodes bed steps back and
  // the bass keeps its weight without booming.
  mix: { bass: 0.9, keys: 0.88, lead: 1.05, drums: 0.95 },
  sections: {
    vamp: { bars: 2, chords: 'E7 | E7', kick: K1, hat: H1, tom: T1, clap: CL1, bass: rep('1> . 1 . 8^ . 1 . 5 . 8^ . 1 . b7 .', 2), keys: bars('X-------........', REST) },
    intro: {
      bars: 2, chords: 'E7 | F#7', kick: K1, hat: H1, tom: T1, clap: CL1, keys: 'X-----------x---',
      cym: REST + 'W...............',
      fill: { snare: '....X...X.X.XXXX', bass: '1> . . . . . . . 5 . 8^ . 7 . 8^ .', brass: '............r---' },
    },
    A: { ...A, gainDb: -4.5 },
    A2: { ...A, lead: LEAD_A2, lead2: transpose(LEAD_A2, -12), fill: [FILLS[1], FILLS[3]] },
    B,
    A3,
    S: {
      ...A, chords: 'E7 | E7 | F#7 | F#7 | E7 | E7 | Bm | Bm', voice: 'synth', snare: S2, hat: H2, tom: T2,
      bass: BASS_S, keys: 'X-......X-......', clav: '.gx..gx..gx..gx.', lead: SOLO,
      brass: bars(REST, REST, REST, '........X-.x.X--', REST, REST, REST, 'X.....x.x.X.r---'),
    },
    D: {
      shape: 'breakdown',
      bars: 8, chords: 'Am | E7 | F#7 | E7 | Am | E7 | D | E7',
      kick: bars(rep(K_HALF, 4), rep(K1, 3), 'X...X...X...X.XX'),
      snare: bars(rep('........X.......', 4), '....X.......X...', '....X...X...X...', 'X.X.X.X.X.X.X.X.', 'oooooooxxxxxxxXX'),
      hat: bars(rep(REST, 4), H2, H2, H1, H1), bass: BASS_D, keys: rep('X---------------', 8), pad: rep('X---------------', 8),
      cym: bars('C...............', rep(REST, 6), 'W...............'),
      brass: bars(rep(REST, 4), 'r-------........', REST, 'r-------........', 'x.x.x.x.X.X.X.X.'),
      layers: { 1: { clav: rep(REST, 8), perc: REST } },
    },
    B2: { ...B, gainDb: 2, kick: K2, lead: LEAD },
    A4: { ...A3, tom: T1, lead: LEAD_A2, lead2: transpose(LEAD_A2, -12) },
  },
  form: ['intro', 'A', 'A2', 'B', 'A3', 'S', 'D', 'B2', 'A4'],
  loopFrom: 1,
  vamp: 'vamp',
  stretch: ['B2', 'A4'],
  lift: { tempo: 1.04, semis: 2 },
  layers: {
    1: { perc: 'b.s.B.s.b.s.B.s.', clav: 'xgxgxgxgxgxgxgxg', clap: '....X.......X...' },
    2: { perc: 'sbsbsbsb........sbsbsbsb........', clap: '....X.......X...', hat: 'XoxoXoxoXoxoXoxo', kick: K2, bass: '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 5 .' },
  },
  notes:
    'Dust and Turbo, 132 bpm, swing 0.06, E phrygian dominant (E F# G# A B C D); loop A–A2–B–A3–S–D–B2–A4 ' +
    '= 64 bars. A: E7 | F#7 (the bII) | E7 | Am | E7 | Bm | D | E7; four-on-the-floor kick, toms on the ' +
    'off-eighths, handclaps on the backbeat, a heavy 16th bass with octave pops, a dry stab comp and a ' +
    'clacking clav. A2: the lead an octave up — a bending riff (long notes that slide into the next, with ' +
    'scoops into the peaks), doubled an octave down. B: E7 | Am | E7 | F#7 | E7 | D | C6 | E7, a pad under ' +
    'it, the riff again. A3: a busier kick, more ghosts, 16th dead-note bass, 16th toms. S: a synth solo ' +
    'over E7 | E7 | F#7 | F#7 | E7 | E7 | Bm | Bm. D: a half-time breakdown then a 4-bar build. B2: the riff ' +
    'at full volume with 16th toms. A4: the high riff again. Top-3: cowbell, clav 16ths, claps. Final ' +
    'stretch: a one-bar riser + snare roll, then B2–A4 a whole step up at +4 % tempo, double-time hats, claps.',
};
