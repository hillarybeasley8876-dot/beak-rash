// Race · Coast — "Sunny Side Sprint" · 128 bpm · A major · bright disco-funk with a wah hook.
// Loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2 min): every section has its own bass line, groove and comp.
import { bars, rep, transpose } from './util';
import type { Lanes, Song } from '../types';

const REST = '................';
// Drums: four-on-the-floor A, pushed A3 / B2, half-time breakdown, ride chorus.
const K1 = 'X...X...X...X...';
const K2 = 'X...X...X..xX...';
const K_HALF = 'X.........x.....';
const S1 = '....X..g.g..X...';
const S2 = '..g.X..g.g..X.gg';
const H1 = 'XoOoxoOoXoOoxoOo';
const H2 = 'x.O.x.O.x.O.x.O.';
const FILLS: Lanes[] = [
  { snare: '....X..g.xxXxXXX', hat: 'xxOxxxOx........', tom: '........1.2.3...' },
  { snare: '....X..g....X.XX', hat: 'xxOxxxOxxxO.....', tom: '........11223.3.' },
  { snare: '....X...X.X.XxXX', kick: 'X...X...X.X.X.X.', hat: 'xxOx............' },
  { snare: '....X.X..X.X.XXX', hat: 'xxOxxxO.........', tom: '..3.........1.2.' },
];

// Bass: 8-bar lines (degrees follow each bar's chord).
const BASS_A = bars(
  '1> . . 8^ . 1 5 . 6 . 8^ . 5 x 3 .',
  '1> . 8^ . 5 . b7 . 1> . 8^ . 5 . 3 .',
  '1> . . 8^ . 1 5 . 6 . 8^ . 9 . 8^ 7',
  '1> . 8^ . b7 . 5 . 1> . 8^ . b7 . 5 .',
  '1> . . 8^ . 1 b7 . 5 . 8^ . 4 x b3 .',
  '1> . 8^ . 5 . 6 . 1> . 8^ . b3 . 5 .',
  '1> . 8^ . 5 . b7 . 1> . 8^ . b7 . 5~ .',
  '1> . 8^ . b7 . 5 . 1> . 8^ . 5 . b7 x',
);
const BASS_A3 = bars(
  '1> x . 8^ x 1 5 x 6 . 8^ x 5 x 3 x',
  '1> x 8^ x 5 x b7 x 1> x 8^ x 5 x 3 x',
  '1> x . 8^ x 1 5 x 6 . 8^ x 9 x 8^ 7',
  '1> x 8^ x b7 x 5 x 1> x 8^ x b7 x 5 x',
  '1> x . 8^ x 1 b7 x 5 . 8^ x 4 x b3 x',
  '1> x 8^ x 5 x 6 x 1> x 8^ x b3 x 5 x',
  '1> x 8^ x 5 x b7 x 1> x 8^ x b7 x 5~ x',
  '1> x 8^ x b7 x 5 x 1> . 8^ 8^ 5 . 1~ .',
);
const BASS_B = rep(bars('1> - . 5 8^ . 5 . 1> - . 5 7 . 8^ .', '1> . 8^ . 5 . 3 . 5 . 8^ . 5 . 3~ .'), 4);
const BASS_S = rep('1> . . 8^ . 1 b7 . 1> . 8^ . 5 . 4 8^', 8);
const BASS_D = bars(
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - 5 - - - 3 - - -',
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - b7 - - - 5 - - -',
  '1> . 1 . 1 . 1 . 1> . 1 . 1 . 1 .', '1> . 1 . 1 . 1 . 1> . 1 . 8^ . 8^ .',
  '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 8^ .', '1> 1 8^ 1 8^ 1 8^ 1 8^ 8^ 8^ 8^ 8^ 8^ 8^ 8^',
);

// Comping.
const COMP_A = '..x...x-..x...x.';
const COMP_A3 = 'x..x..x...x..x..';
const CLAV_A = 'x.g.x.gxx.g.x.g.';
const CLAV_A3 = 'x.gxg.x.x.gxg.x.';
const BRASS_A = bars(REST, '..........x.X-..', REST, '........X-.x.X--', REST, '..........x.X-..', REST, 'X.....x.x.X.r---');
const BRASS_A3 = bars('........x.X-....', REST, '........x.X-....', 'X-..X-..r-------', '........x.X-....', REST, 'x.x.X-..x.x.X-..', 'X.....x.x.X.f---');
const BRASS_B = bars('X..x..X...X.x.X-', REST, 'X..x..X...X.x.X-', REST, 'X..x..X...X.x.X-', REST, 'r-------........', 'X.....x.x.X.f---');
const BRASS_B2 = rep('X..x..X...X.x.X-', 6) + ' | r-------........ | X.....x.x.X.f---';
// Top-3: the horns answer every bar.
const BRASS_TOP = bars(
  '......x.X-......', '..........x.X-..', '......x.X-......', '........X-.x.X--',
  '......x.X-......', '..........x.X-..', 'x.x.X-..x.x.X-..', 'X.....x.x.X.r---',
);

// Leads: wah hook (A2 / A3 / A4), anthem chorus (B / B2), square-synth solo over an A mixolydian vamp (S).
const HOOK = bars(
  'E5 - C#5 E5 - F#5 - E5 . C#5 - B4 - A4 - .',
  'B4 - D5 - F#5 - E5 D5 . C#5 - B4 G#4 - . .',
  'E5 - C#5 E5 - F#5 - A5 . G#5 - F#5 - E5 - .',
  'E5 - - - G#5 - E5 . A5 - - - A#5 - C#6 -',
  'D6 - - - C#6 - B5 - A5 - F#5 - - - . .',
  'F#5 - - - A5 - E5 - F5 - - - D5 - - .',
  'E5 - - - G#5 - B5 - A#5 - G5 - E5 - C#5 -',
  'D5 - - - C#5 - B4 - G#4 - - - . . E5~ -',
);
const HOOK_A4 = HOOK.split(' | ').slice(0, 7).join(' | ') + ' | B4 - D5 - F#5 - A5 - G#5 - - - E5 - - -';
const CHORUS = bars(
  'F#5 - A5 - C#6 - - - B5 - A5 - F#5 - E5 -',
  'G#5 - - - B5 - - - C#6 - B5 - G#5 - - -',
  'E5 - G#5 - B5 - - - D#6 - C#6 - B5 - - -',
  'A5 - - - G#5 - F#5 - E5 - - - C#5 - - -',
  'D5 - F#5 - A5 - - - C#6 - B5 - A5 - - -',
  'B5 - - - C#6 - - - D6 - - - E6 - - -',
  'E6 - - - - - C#6 - B5 - - - A5 - - -',
  'G#5 - - - F5 - - - E5 - D5 - . . E5~ -',
);
const SOLO = bars(
  'E5 - G5 A5 - - C#6~ - B5 A5 G5 - E5 - . .',
  'D6 - - B5 - - G5 - A5 - - - . . E5 G5',
  'A5 - C6~ C#6 - E6 - C#6 - A5 - G5 - E5 - .',
  'G5 - B5 - D6 - G6 - F#6 - D6 - B5 - A5 -',
  'F#6 - - - E6 - C#6 - A5 - - - G#5 - A5 -',
  'B5 - D6 - F#6 - D6 - E6 - - - D6 - B5 -',
  'C#6 - E6 - G#6 - E6 - A6 - - - F#6 - E6 -',
  'D6 - C#6 - B5 - A5 - G#5 - - - B5 - E5~ -',
);

const CH_A = 'Amaj9 | Bm9 E13 | Amaj9 | C#m7 F#7#9 | Bm9 | Dmaj9 Dm6 | C#m7 F#7alt | Bm9 E13';
const CH_B = 'Dmaj9 | E13 | C#m9 | F#m9 | Bm9 | E13 | Amaj9 | Bb7#11';
const CRASH = 'C...............' + rep(REST, 7);

const A = {
  bars: 8, chords: CH_A, kick: K1, snare: S1, hat: H1, bass: BASS_A, keys: COMP_A, clav: CLAV_A, cym: CRASH, brass: BRASS_A, fill: FILLS,
  layers: { 1: { brass: BRASS_TOP } },
};
const A3 = {
  ...A, kick: K2, snare: S2, bass: BASS_A3, keys: COMP_A3, clav: CLAV_A3, brass: BRASS_A3, lead: HOOK, lead2: transpose(HOOK, -12),
};
const B = {
  bars: 8, chords: CH_B, kick: K1, snare: S1, hat: H2, bass: BASS_B, keys: 'X-..x...X-..x...', cym: CRASH,
  pad: rep('X---------------', 8), brass: BRASS_B, lead: CHORUS, fill: [FILLS[0], FILLS[2]] as Lanes[],
  layers: { 1: { lead2: transpose(CHORUS, -12) } },
};

export const COAST: Song = {
  id: 'race-coast',
  title: 'Sunny Side Sprint',
  bpm: 128,
  swing: 0.08,
  key: 'A major',
  lead: 'wah',
  // Four-on-the-floor + slap octaves: a little less bass keeps the low end from booming.
  mix: { bass: 0.9 },
  sections: {
    vamp: { bars: 2, chords: 'Amaj9 | Amaj9', kick: K1, hat: 'x.x.x.x.x.x.x.x.', bass: rep('1> . . 8^ . 1 5 . 6 . 8^ . 5 x 3 .', 2), keys: bars('X-------........', REST) },
    intro: {
      bars: 2, chords: 'Amaj9 | E13', kick: K1, hat: 'x.x.x.x.x.x.x.x.', keys: 'X-----------x---',
      cym: REST + 'W...............',
      fill: { snare: '....X...X.X.XXXX', bass: '1> . . . . . . . 5 . 8^ . 7 . 8^ .', brass: '............r---' },
    },
    A: { ...A, gainDb: -4.5 },
    A2: { ...A, lead: HOOK, fill: [FILLS[1], FILLS[3]], layers: { 1: { brass: BRASS_TOP, lead2: transpose(HOOK, -12) } } },
    B,
    A3,
    S: {
      ...A, chords: 'A9 | G/A | A9 | G/A | F#m9 | Bm9 E13 | C#m7 F#7#9 | Bm9 E13', voice: 'synth', snare: '....X.......X..g',
      hat: H2, bass: BASS_S, keys: 'X-......X-......', clav: '.gx..gx..gx..gx.', lead: SOLO,
      brass: bars(REST, REST, REST, '........X-.x.X--', REST, REST, REST, 'X.....x.x.X.r---'),
    },
    D: {
      shape: 'breakdown',
      bars: 8, chords: 'F#m9 | Dmaj9 | Bm9 | E13 | F#m9 | Dmaj9 | Bm9 | E13',
      kick: bars(rep(K_HALF, 4), rep(K1, 3), 'X...X...X.X.XXXX'),
      snare: bars(rep('........X.......', 4), '....X.......X...', '....X...X...X...', 'X.X.X.X.X.X.X.X.', 'oooooooxxxxxxxXX'),
      hat: bars(rep(REST, 4), H2, H2, H1, H1), bass: BASS_D, keys: rep('X---------------', 8), pad: rep('X---------------', 8),
      cym: bars('C...............', rep(REST, 6), 'W...............'),
      brass: bars(rep(REST, 4), 'r-------........', REST, 'r-------........', 'x.x.x.x.X.X.X.X.'),
      layers: { 1: { clav: rep(REST, 8), perc: REST } },
    },
    B2: { ...B, gainDb: 2, kick: K2, snare: S2, hat: H1, brass: BRASS_B2, lead2: transpose(CHORUS, -12) },
    A4: { ...A3, lead: HOOK_A4, lead2: undefined, brass: BRASS_A, layers: { 1: { brass: BRASS_TOP, lead2: transpose(HOOK_A4, -12) } } },
  },
  form: ['intro', 'A', 'A2', 'B', 'A3', 'S', 'D', 'B2', 'A4'],
  loopFrom: 1,
  vamp: 'vamp',
  stretch: ['B2', 'A4'],
  lift: { tempo: 1.04, semis: 2 },
  layers: {
    1: { perc: 'b.s.B.s.b.s.B.s.', clav: 'xgxgxgxgxgxgxgxg', clap: '....X.......X...' },
    2: { perc: 's.sbs.sbs.sbs.sb', clap: '....X.......X...', hat: 'XoxoXoxoXoxoXoxo', bass: '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 5 .' },
  },
  notes:
    'Sunny disco-funk, 128 bpm, swing 0.08, A major; loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:00). A: Amaj9 | Bm9–E13 | Amaj9 | ' +
    'C#m7–F#7#9 | Bm9 | Dmaj9–Dm6 (minor plagal) | C#m7–F#7alt | Bm9–E13; four-on-the-floor, ghosted backbeat, 16th hats, ' +
    '8-bar slap line (root–octave pop–5–6, #5 under F#7alt), off-beat Rhodes, clav chicken-scratch, brass punches. A2: wah ' +
    'hook (E–C#–E–F#–E … climbing to D6). B (chorus): Dmaj9–E13–C#m9–F#m9–Bm9–E13–Amaj9–Bb7#11, legato bass with slides, ' +
    'pad, brass riff, anthem lead. A3: pushed kick, busier ghosts, 16th dead-note bass, new comp/clav rhythms, brass answers, ' +
    'hook doubled an octave down. S: square-synth solo over an A mixolydian vamp (A9 | G/A ×2) into a ii–V turnaround. ' +
    'D: 4-bar half-time breakdown (pad, long bass notes) then a 4-bar build (8th → 16th snare, octave bass, brass rips, swell). ' +
    'B2: chorus + octave-doubled lead + brass riff every bar. A4: hook with a new last bar. Four rotating fills. Top-3: cowbell, ' +
    'shaker, clav 16ths (1–4 kHz). Final stretch: one-bar riser + snare roll, then B2–A4 up a whole step at +4 % tempo, ' +
    '+2 dB, driving 8th bass, double-time hats, claps.',
};
