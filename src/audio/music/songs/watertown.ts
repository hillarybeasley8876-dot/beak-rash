// Race · Watertown — "Canal Lanterns" · 104 bpm · D major (pentatonic melody) · a laid-back
// water-town funk: a plucked zheng hook, a bowed erhu line that slides, and a light swing.
// Loop A–A2–B–A3–S–D–B2–A4 = 64 bars: every section has its own bass line, groove and comp.
import { bars, rep } from './util';
import type { Lanes, Song } from '../types';

const REST = '................';
// Drums: a laid-back funk (the kick on the "and of 2", the snare behind the beat), a busier A3.
const K1 = 'X.....X.....X...';
const K2 = 'X.....X..X..X...';
const K_HALF = 'X.........x.....';
const S1 = '....X..g....X..g';
const S2 = '..g.X..g.g..X.g.';
const H1 = 'xoxoxoxoxoxoxoxo';
const H2 = 'xoxoxoxoxoxoxoxO';
/** A 16th shaker: the laid-back groove's constant (it fills the space between the kicks). */
const SHAKER = 'ssssssssssssssss';
const FILLS: Lanes[] = [
  { snare: '....X..g.gxXxXXX', hat: 'xxOxxxOx........', tom: '........1.2.3...' },
  { snare: '....X..g....xXXX', hat: 'xxOxxxOxxxO.....', tom: '........11223.3.' },
  { snare: '....X...X.X.xxXX', kick: 'X.....X..X.X.X..', hat: 'xxOx............' },
  { snare: '....X.X..X.X.XXX', hat: 'xxOxxxO.........', tom: '..3.........1.2.' },
];

// Bass: a lazy slap line that walks under the zheng (root–octave pop–5–6); the degrees follow
// each bar's chord (Dmaj9 | Bm7 | Gmaj7 | A7 | Dmaj9 | Bm9 | Gmaj7 | A7). Every bar ends on a
// held note, so the groove never falls off the edge of the bar.
const BASS_A = bars(
  '1> . 8^ . . 1 5 . 6 . 8^ . 5 - - -',
  '1> . 8^ . 1 b7 8^ . 1> . 5 . b6 - - -',
  '1> . . 8^ . 1 5 . 6 . 8^ . 9 - - -',
  '1> . 8^ . b7 . 5 . 1> . 8^ . 5 - - -',
  '1> . 8^ . 1 5 . 6 . 8^ . 7 - 3 - -',
  '1> . 8^ . 5 . b6 . 1> . 8^ . 3 . 5 -',
  '1> . 8^ . 5 . 7 . 1> . 8^ . 7 . 5~ -',
  '1> . 8^ . b7 . 5 . 1> . 8^ . 5 . b7 -',
);
const BASS_A3 = bars(
  '1> x . 8^ x 1 5 x 6 . 8^ x 5 - - -',
  '1> x 8^ x 1 x b7 x 1> x 8^ x 5 - - -',
  '1> x . 8^ x 1 5 x 6 . 8^ x 9 - - -',
  '1> x 8^ x b7 x 5 x 1> x 8^ x 5 - - -',
  '1> x . 8^ x 1 5 x 6 . 8^ x 7 - 3 -',
  '1> x 8^ x 5 x b6 x 1> x 8^ x 5 - - -',
  '1> x 8^ x 5 x 7 x 1> x 8^ x 5~ - - -',
  '1> x 8^ x b7 x 5 x 1> . 8^ 8^ 5 . 1~ .',
);
const BASS_B = rep(bars('1> - . 5 8^ . 5 . 1> - . 5 3 . 5 -', '1> . 8^ . 5 . 3 . 5 . 8^ . 5 . 3~ -'), 4);
const BASS_S = rep('1> . . 8^ . 1 5 . 1> . 8^ . 5 . b7 -', 8);
const BASS_D = bars(
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - 5 - - - 3 - - -',
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - b7 - - - 5 - - -',
  '1> . 1 . 1 . 1 . 1> . 1 . 1 . 1 .', '1> . 1 . 1 . 1 . 1> . 1 . 8^ . 8^ .',
  '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 8^ .', '1> 1 8^ 1 8^ 1 8^ 1 8^ 8^ 8^ 8^ 8^ 8^ 8^ 8^',
);

// Comping: a soft Rhodes on the off-beats, a clav chicken-scratch, a bamboo pad in the B section.
// The last chord of each bar is tied, so the comp rings over the bar line.
const COMP_A = '..x...x-..x...x-';
const COMP_A3 = 'x..x..x...x..x--';
const CLAV_A3 = 'x.gxg.x.x.gxg.x.';
const BRASS_A = bars(REST, '..........x.X-..', REST, '........X-.x.X--', REST, '..........x.X-..', REST, 'X.....x.x.X.r---');
const BRASS_B = bars('X..x..X...X.x.X-', REST, 'X..x..X...X.x.X-', REST, 'X..x..X...X.x.X-', REST, 'r-------........', 'X.....x.x.X.f---');
const BRASS_TOP = bars(
  '......x.X-......', '..........x.X-..', '......x.X-......', '........X-.x.X--',
  '......x.X-......', '..........x.X-..', 'x.x.X-..x.x.X-..', 'X.....x.x.X.r---',
);

// The zheng hook (lead slot 0): a plucked pentatonic phrase, syncopated off the 8ths.
const HOOK = bars(
  'F#5 - . E5 - D5 - . B4 - A4 - . . . .',
  'D5 - . E5 - F#5 - A5 - B5 - . . . . .',
  'A5 - . B5 - A5 - F#5 - E5 - . . . . .',
  'D5 - . F#5 - A5 - . B4 - . . . . . .',
  'E5 - . F#5 - A5 - B5 - . A5 - . . . .',
  'F#5 - . E5 - D5 - . B4 - . . . . . .',
  'A5 - . B5 - D6 - . A5 - F#5 - E5 - D5 -',
  'B5 - . A5 - F#5 - E5 - D5 - . . . . .',
);
const HOOK_A4 = HOOK.split(' | ').slice(0, 7).join(' | ') + ' | A5 - . F#5 - D5 - . . . . . . . . .';
// The erhu line (lead2 slot 1): long bowed notes that slide into the next one.
const ERHU = bars(
  'D5 - - - A4 - - - F#4 - - - E4 - - -',
  'A4 - - - D5 - - - E5 - - - F#5 - - -',
  'A5 - - - F#5 - - - D5 - - - B4 - - -',
  'E5 - - - A4 - - - F#5 - - - A5 - - -',
  'D5 - - - F#5 - - - A5 - - - E5 - - -',
  'B4 - - - D5 - - - A4 - - - . . . .',
  'F#5 - - - E5 - - - A5 - - - D6 - - -',
  'B5 - - - A5 - - - F#5 - - - D5 - - -',
);
// A zheng improvisation over the vamp (S): the same pentatonic, wandering.
const SOLO = bars(
  'D5 - . F#5 - A5 - . D6 - . A5 - . F#5 -',
  'E5 - . A5 - B5 - . E6 - . B5 - . A5 -',
  'F#5 - . B5 - A5 - . F#5 - E5 - . D5 - .',
  'A4 - . D5 - F#5 - A5 - . F#5 - . D5 - .',
  'B4 - . E5 - A5 - B5 - . A5 - . F#5 - .',
  'D6 - . A5 - F#5 - E5 - . D5 - . B4 - .',
  'E5 - . A5 - D6 - . B5 - . A5 - . F#5 -',
  'A5 - . F#5 - E5 - . D5 - . . . . . .',
);

const CH_A = 'Dmaj9 | Bm7 | Gmaj7 | A7 | Dmaj9 | Bm9 | Gmaj7 | A7';
const CH_B = 'G6 | A7 | Dmaj9 | Bm7 | G6 | A7 | Em7 | A7';
const CRASH = 'C...............' + rep(REST, 7);

const A = {
  bars: 8, chords: CH_A, kick: K1, snare: S1, hat: H1, perc: SHAKER, bass: BASS_A, keys: COMP_A, cym: CRASH,
  brass: BRASS_A, fill: FILLS, layers: { 1: { brass: BRASS_TOP } },
};
const A3 = {
  ...A, kick: K2, snare: S2, bass: BASS_A3, keys: COMP_A3, clav: CLAV_A3, brass: BRASS_A, lead: HOOK,
};
const B = {
  bars: 8, chords: CH_B, kick: K1, snare: S1, hat: H2, bass: BASS_B, keys: 'X-..x...X-..x...', cym: CRASH,
  pad: rep('X---------------', 8), brass: BRASS_B, lead2: ERHU, fill: [FILLS[0], FILLS[2]] as Lanes[],
};

export const WATERTOWN: Song = {
  id: 'race-watertown',
  title: 'Canal Lanterns',
  bpm: 104,
  swing: 0.14,
  key: 'D major',
  lead: 'pluck',
  // The zheng is a bright, percussive pluck: it needs more level than the Rhodes bed under it, and
  // the bass a touch of room so the laid-back groove does not boom.
  mix: { bass: 0.85, keys: 0.82, lead: 2.0 },
  sections: {
    vamp: { bars: 2, chords: 'Dmaj9 | Dmaj9', kick: K1, hat: H1, bass: rep('1> . 8^ . . 1 5 . 6 . 8^ . 5 . 3 .', 2), keys: bars('X-------........', REST) },
    intro: {
      bars: 2, chords: 'Dmaj9 | Gmaj7', kick: K1, hat: H1, keys: 'X-----------x---',
      cym: REST + 'W...............',
      fill: { snare: '....X...X.X.XXXX', bass: '1> . . . . . . . 5 . 8^ . 7 . 8^ .', brass: '............r---' },
    },
    A: { ...A, gainDb: -4.5 },
    A2: { ...A, lead: HOOK, fill: [FILLS[1], FILLS[3]] },
    B,
    A3,
    S: {
      ...A, chords: 'Dmaj9 | Dmaj9 | Bm7 | Bm7 | G6 | G6 | A7 | A7', voice: 'pluck', snare: '....X.......X..g',
      hat: H2, bass: BASS_S, keys: 'X-......X-......', clav: '.gx..gx..gx..gx.', lead: SOLO,
      brass: bars(REST, REST, REST, '........X-.x.X--', REST, REST, REST, 'X.....x.x.X.r---'),
    },
    D: {
      shape: 'breakdown',
      bars: 8, chords: 'Bm7 | Em7 | Gmaj7 | A7 | Bm7 | Em7 | Gmaj7 | A7',
      kick: bars(rep(K_HALF, 4), rep(K1, 3), 'X.....X..X.X.XXX'),
      snare: bars(rep('........X.......', 4), '....X.......X...', '....X...X...X...', 'X.X.X.X.X.X.X.X.', 'oooooooxxxxxxxXX'),
      hat: bars(rep(REST, 4), H2, H2, H1, H1), bass: BASS_D, keys: rep('X---------------', 8), pad: rep('X---------------', 8),
      cym: bars('C...............', rep(REST, 6), 'W...............'),
      brass: bars(rep(REST, 4), 'r-------........', REST, 'r-------........', 'x.x.x.x.X.X.X.X.'),
      layers: { 1: { clav: rep(REST, 8), perc: REST } },
    },
    B2: { ...B, gainDb: 2, kick: K2, snare: S2, hat: H1, brass: BRASS_B },
    A4: { ...A3, lead: HOOK_A4, brass: BRASS_A, layers: { 1: { brass: BRASS_TOP } } },
  },
  form: ['intro', 'A', 'A2', 'B', 'A3', 'S', 'D', 'B2', 'A4'],
  loopFrom: 1,
  vamp: 'vamp',
  stretch: ['B2', 'A4'],
  lift: { tempo: 1.05, semis: 2 },
  layers: {
    1: { perc: 's.s.s.s.s.s.s.s.', clav: 'xgxgxgxgxgxgxgxg', clap: '....X.......X...' },
    2: { perc: 's.sbs.sbs.sbs.sb', clap: '....X.......X...', hat: 'XoxoXoxoXoxoXoxo', bass: '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 5 .' },
  },
  notes:
    'Canal Lanterns, 104 bpm, swing 0.14, D major; loop A–A2–B–A3–S–D–B2–A4 = 64 bars. A: Dmaj9 | Bm7 | Gmaj7 | A7 | ' +
    'Dmaj9 | Bm9 | Gmaj7 | A7; a laid-back kick (1, the and of 2, 3), a ghosted backbeat, 8th hats, an 8-bar ' +
    'slap line (root–octave pop–5–6), an off-beat Rhodes comp, a clav chicken-scratch, a bamboo pad, brass ' +
    'punches. A2: the zheng hook (F#–E–D–B–A … climbing to B5) — a plucked modal string, D major pentatonic ' +
    '(D E F# A B). B: the erhu line (a bowed, sliding second voice on the same instrument: long notes that ' +
    'bend into the next), G6 | A7 | Dmaj9 | Bm7 | G6 | A7 | Em7 | A7. A3: a busier kick, more ghosts, a 16th ' +
    'dead-note bass, a new comp + clav. S: a zheng improvisation over Dmaj9 | Dmaj9 | Bm7 | Bm7 | G6 | G6 | ' +
    'A7 | A7. D: a half-time breakdown (pad, long bass notes) then a 4-bar build. B2: the erhu line louder. ' +
    'A4: the zheng hook with a new last bar. Top-3: a shaker, clav 16ths, claps. Final stretch: a one-bar ' +
    'riser + snare roll, then B2–A4 a whole step up at +5 % tempo, double-time hats, claps.',
};