// Race · City — "Neon Pursuit" · 124 bpm · C minor · night acid jazz (broken beat, flute + brass).
// Loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:04): every section has its own bass line, groove and comp.
import { bars, rep, transpose } from './util';
import type { Lanes, Song } from '../types';

const REST = '................';
// Drums: broken beat A, busier A3, half-time breakdown, ride bridge, four-on-the-floor drive in B2.
const K1 = 'X.....x.X..x....';
const K2 = 'X..x..x.X..x..x.';
const K4 = 'X...X...X...X...';
const K_HALF = 'X.........x.....';
const S1 = '....X..g..g.X...';
const S2 = '..g.X..g..g.X.g.';
const H1 = 'xoxOxoxoxoxoxoOo';
const H2 = 'x.x.x.x.x.x.x.x.';
const FILLS: Lanes[] = [
  { snare: '....X..g.gX.XxXX', tom: '..........1.2.33', hat: 'xoxOxoxoxo......' },
  { snare: '....X..g....XxXX', tom: '........11.2.3..', hat: 'xoxOxoxo........' },
  { snare: '..g.X.....X.X.XX', kick: 'X.....x.X.X.X...', hat: 'xoxOxo..........' },
  { snare: '....X..gX..gXXXX', hat: 'xoxOxoxoxoxo....', tom: '...3............' },
];

const BASS_A = bars(
  '1> . 8^ . . 1 b7 8^ . 1> . 5 . b7 8^ x',
  '1> . 8^ . . 1 b7 8^ . 1> . 5 . 4 b3 x',
  '1> . 8^ . . 1 b7 8^ . 1> . 5 . b7 8^ x',
  '1> . 8^ . 5 . b7 . 1> . 8^ . 3 . b7 .',
  '1> . 8^ . . 1 b7 8^ . 1> . 5 . 9 8^ x',
  '1> . 8^ . . 1 b3 . 5 . 8^ . b7 . 4 .',
  '1> . 8^ . b5 . b7 . 1> . 8^ . 3 . 5 .',
  '1> . 8^ . 5 . b7 . 1> . 8^ . b7 . 5~ .',
);
const BASS_A3 = bars(
  '1> x 8^ x . 1 b7 8^ x 1> x 5 x b7 8^ x',
  '1> x 8^ x . 1 b7 8^ x 1> x 5 x 4 b3 x',
  '1> x 8^ x . 1 b7 8^ x 1> x 5 x b7 8^ x',
  '1> x 8^ x 5 x b7 x 1> x 8^ x 3 x b7 x',
  '1> x 8^ x . 1 b7 8^ x 1> x 5 x 9 8^ x',
  '1> x 8^ x . 1 b3 x 5 x 8^ x b7 x 4 x',
  '1> x 8^ x b5 x b7 x 1> x 8^ x 3 x 5 x',
  '1> x 8^ x 5 x b7 x 1> . 8^ 8^ b7 . 1~ .',
);
const BASS_B = rep(bars('1> - . 5 8^ . 7 . 1> - . 5 3 . 5 .', '1> . 3 . 5 . 7 . 8^ . 7 . 5 . 3~ .'), 4);
const BASS_S = rep('1> . . 8^ . 1 7 . 1> . 8^ . 5 . 7 8^', 8);
const BASS_D = bars(
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - 7 - - - 5 - - -',
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - 3 - - - 5 - - -',
  '1> . 1 . 1 . 1 . 1> . 1 . 1 . 1 .', '1> . 1 . 1 . 1 . 1> . 1 . 8^ . 8^ .',
  '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 8^ .', '1> 1 8^ 1 8^ 1 8^ 1 8^ 8^ 8^ 8^ 8^ 8^ 8^ 8^',
);

const COMP_A = 'X-..x..x..X-..x.';
const COMP_A3 = '..x.X-..x..x.X-.';
const CLAV_A2 = '..x.g.x...x.g.x.';
const CLAV_A3 = 'x.gx..x.g.x.gx..';
const BRASS_A = bars(rep(REST, 3), 'X-..x.X-........', rep(REST, 3), '........x.x.X-f-');
const BRASS_A3 = bars('........x.X-....', REST, '........x.X-....', 'X-..x.X-r-------', '........x.X-....', REST, 'x.x.X-..x.x.X-..', '........x.x.X-f-');
const BRASS_B = bars('X-------........', REST, 'X-------........', 'x.x.X-..x.x.X-..', 'X-------........', REST, 'X---x.x.X-------', 'X.....x.x.X.f---');
const BRASS_B2 = bars(rep('X-..x.X-..x.X-..', 3), 'x.x.X-..x.x.X-..', rep('X-..x.X-..x.X-..', 2), 'X---x.x.X-------', 'X.....x.x.X.f---');
const BRASS_TOP = bars(
  '......x.X-......', '..........x.X-..', '......x.X-......', 'X-..x.X-........',
  '......x.X-......', '..........x.X-..', 'x.x.X-..x.x.X-..', '........x.x.X-f-',
);

// Leads: flute hook (A2 / A3 / A4) and bridge melody (B / B2), wah solo over a C dorian vamp (S).
const HOOK = bars(
  'G5 - Bb5 - C6 - . Eb6 - D6 - C6 Bb5 - G5 -',
  'Ab5 - - - G5 F5 - Eb5 - - F5 - G5 - - -',
  'G5 - Bb5 - C6 - . Eb6 - F6 - Eb6 D6 - C6 -',
  'D6 - C6 - Bb5 - Ab5 - B5 - - - Bb5 - G5 -',
  'C6 - - - - - Eb6 D6 C6 - Bb5 - G5 - - -',
  'Ab5 - - - Bb5 - C6 Eb6 - - - - D6 - C6 -',
  'F5 - Ab5 - C6 - Ab5 - B5 - - - Ab5 - F5 -',
  'Eb5 - - - D5 - C5 - F5 - - - G5 - Ab5 -',
);
const HOOK_A4 = HOOK.split(' | ').slice(0, 7).join(' | ') + ' | Eb5 - - - G5 - C6 - B5 - - - Ab5 - - -';
const BRIDGE = bars(
  'C6 - - - Eb6 - G6 - F6 - Eb6 - C6 - - -',
  'D6 - - - Bb5 - - - F5 - G5 - Bb5 - - -',
  'Ab5 - - - G5 - - - F5 - Eb5 - C5 - - -',
  'Db6 - - - C6 - Bb5 - G5 - - - F5 - - -',
  'Eb6 - - - - - C6 - Bb5 - - - G5 - - -',
  'F6 - - - Eb6 - - - C6 - G5 - - - . .',
  'Ab5 - - - C6 - - - F6 - - - D6 - C6 -',
  'B5 - - - Ab5 - - - F5 - - - Eb5 - D5 -',
);
const SOLO = bars(
  'G5 - Bb5 C6 - - Eb6~ - D6 C6 Bb5 - G5 - . .',
  'A5 - - C6 - - Eb6 - D6 - - - . . C6 D6',
  'Eb6 - D6 C6 - Bb5 - G5 - Gb5~ G5 - Bb5 - C6 -',
  'D6 - C6 - A5 - C6 - Eb6 - - - D6 - C6 -',
  'C6 - - - D6 - Eb6 - G6 - - - Eb6 - D6 -',
  'D6 - B5 - F6 - D6 - Bb5~ B5 - - G5 - - -',
  'C6 - Eb6 - G6 - F6 - Eb6 - D6 - C6 - Bb5 -',
  'Ab5 - - - F5 - - - B5 - - - Ab5 - G5 -',
);

const CH_A = 'Cm9 | Fm9 | Cm9 | Ab7#11 G7#9 | Cm9 | Fm9 | Dm7b5 G7b9 | Cm9 Db7#11';
const CH_B = 'Abmaj9 | Gm7 | Fm9 | Bbm9 Eb13 | Abmaj9 | Dbmaj7#11 | Dm7b5 | G7alt';
const CRASH = 'C...............' + rep(REST, 7);

const A = {
  bars: 8, chords: CH_A, kick: K1, snare: S1, hat: H1, bass: BASS_A, keys: COMP_A, cym: CRASH, brass: BRASS_A, fill: FILLS,
  layers: { 1: { brass: BRASS_TOP } },
};
const A3 = {
  ...A, kick: K2, snare: S2, bass: BASS_A3, keys: COMP_A3, clav: CLAV_A3, brass: BRASS_A3, lead: HOOK, lead2: transpose(HOOK, -12),
};
const B = {
  ...A, chords: CH_B, bass: BASS_B, cym: 'C...............' + rep('R.R.R.R.R.R.R.R.', 7), hat: bars(REST, rep('x...x...x...x...', 7)),
  pad: rep('X---------------', 8), brass: BRASS_B, lead: BRIDGE, fill: [FILLS[0], FILLS[2]] as Lanes[],
  layers: { 1: { lead2: transpose(BRIDGE, -12) } },
};

export const CITY: Song = {
  id: 'race-city',
  title: 'Neon Pursuit',
  bpm: 124,
  swing: 0.14,
  key: 'C minor',
  lead: 'flute',
  // The flute carries further than the wah: ≈ −4.5 LU under the full mix.
  mix: { lead: 0.81 },
  crackle: 0.08,
  sections: {
    vamp: { bars: 2, chords: 'Cm9 | Cm9', kick: K1, hat: H2, bass: rep('1> . 8^ . . 1 b7 8^ . 1> . 5 . b7 8^ x', 2), keys: COMP_A, pad: 'X---------------' },
    intro: {
      bars: 2, chords: 'Cm9 | Cm9', hat: 'x.x.x.x.x.x.x.x.', keys: 'X-..x..x..X-..x.', pad: 'X---------------',
      cym: REST + 'W...............',
      fill: { kick: 'X.....x.X..x....', snare: '....X.......XxXX', bass: '1> . 8^ . . 1 b7 8^ . . . . 5 . b7 8^' },
    },
    A: { ...A, gainDb: -3 },
    A2: { ...A, lead: HOOK, clav: CLAV_A2, fill: [FILLS[1], FILLS[3]], layers: { 1: { brass: BRASS_TOP, lead2: transpose(HOOK, -12) } } },
    B,
    A3,
    S: {
      ...A, chords: 'Cm9 | F9 | Cm9 | F9 | Abmaj7#11 | G7#9 | Cm9 | Dm7b5 G7b9', voice: 'wah', hat: H2, bass: BASS_S,
      keys: 'X-......x.X-....', clav: '.g..x.g..g..x.g.', lead: SOLO,
      brass: bars(REST, REST, REST, 'X-..x.X-........', REST, REST, REST, '........x.x.X-f-'),
    },
    D: {
      shape: 'breakdown',
      bars: 8, chords: 'Abmaj9 | Gm7 | Fm9 | G7#9 | Abmaj9 | Gm7 | Fm9 | G7alt',
      kick: bars(rep(K_HALF, 4), rep(K1, 3), 'X.....x.X.X.XXXX'),
      snare: bars(rep('........X.......', 4), '....X.......X...', '....X...X...X...', 'X.X.X.X.X.X.X.X.', 'oooooooxxxxxxxXX'),
      hat: bars(rep(REST, 4), H2, H2, H1, H1), bass: BASS_D, keys: rep('X---------------', 8), pad: rep('X---------------', 8),
      cym: bars('C...............', rep(REST, 6), 'W...............'),
      brass: bars(rep(REST, 4), 'r-------........', REST, 'r-------........', 'x.x.x.x.X.X.X.X.'),
      layers: { 1: { clav: rep(REST, 8), perc: REST } },
    },
    B2: { ...B, gainDb: 2, kick: K4, snare: S2, hat: H1, cym: CRASH, brass: BRASS_B2, lead2: transpose(BRIDGE, -12) },
    A4: { ...A3, lead: HOOK_A4, lead2: undefined, brass: BRASS_A, layers: { 1: { brass: BRASS_TOP, lead2: transpose(HOOK_A4, -12) } } },
  },
  form: ['intro', 'A', 'A2', 'B', 'A3', 'S', 'D', 'B2', 'A4'],
  loopFrom: 1,
  vamp: 'vamp',
  stretch: ['B2', 'A4'],
  lift: { tempo: 1.04, semis: 2 },
  layers: {
    1: { perc: 's.sBs.s.s.sBs.s.', clav: 'xgxgxgxgxgxgxgxg', clap: '....X.......X...' },
    2: { perc: 'ssTsssTsssTsssTs', clap: '....X.......X...', hat: 'XxxxXxxxXxxxXxxx', kick: K4, bass: '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 5 .' },
  },
  notes:
    'Night acid jazz, 124 bpm, swing 0.14, C minor; loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:04). A: Cm9 | Fm9 | Cm9 | ' +
    'Ab7#11–G7#9 | Cm9 | Fm9 | Dm7b5–G7b9 (minor ii–V) | Cm9–Db7#11 (tritone sub); broken-beat kick, ghost snares, 8-bar slap ' +
    'line (octave pops, b7 runs, b5 under the half-diminished), Rhodes comp, brass punches. A2: flute hook (G–Bb–C–Eb–D) + clav. ' +
    'B (bridge): Abmaj9–Gm7–Fm9–Bbm9/Eb13–Abmaj9–Dbmaj7#11–Dm7b5–G7alt, ride, walking slap line, pad, brass swells. A3: busier ' +
    'kick / ghosts, 16th dead-note bass, new comp + clav, brass answers, hook an octave down too. S: wah solo over a C dorian ' +
    'vamp (Cm9 | F9) into Abmaj7#11–G7#9. D: half-time breakdown then a 4-bar build. B2: four-on-the-floor drive, brass riff, ' +
    'doubled bridge melody. A4: hook ending B–Ab over the Db7#11 tritone sub, resolving into Cm9 at the loop. Top-3: brass answers, octave-doubled lead, shaker + cowbell, clav 16ths. ' +
    'Final stretch: riser + snare roll, then B2–A4 a whole step up (D minor) at +4 % tempo, four-on-the-floor, 8th bass, claps.',
};
