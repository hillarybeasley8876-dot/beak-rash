// Race · Mountain — "Sunset Switchbacks" · 130 bpm · A Dorian · straight, driving rock-funk.
// Loop A–A2–B–A3–S–D–B2–A4–T = 68 bars (2:06): every section has its own bass line, groove and comp.
import { bars, rep, transpose } from './util';
import type { Lanes, Song } from '../types';

const REST = '................';
// Drums: driving A, pushed A3, four-on-the-floor bridge, half-time breakdown.
const K1 = 'X.....X.X.....X.';
const K2 = 'X.....X.X.X...X.';
const K4 = 'X...X...X...X...';
const K_HALF = 'X.........x.....';
const S1 = '....X......gX...';
const S2 = '..g.X..g...gX.g.';
const H1 = 'x.o.x.o.x.o.x.o.';
const H2 = 'xoxoxoxoxoxoxoOo';
const FILLS: Lanes[] = [
  { snare: '....X...X.X.XXXX', tom: '........1.1.2.3.', hat: 'x.o.x.o.........' },
  { snare: '....X......gX.XX', tom: '........11223.3.', hat: 'x.o.x.o.x.o.....' },
  { snare: '....X...X.X.XxXX', kick: 'X.....X.X.X.X.X.', hat: 'x.o.............' },
  { snare: '....X.X..X.X.XXX', hat: 'x.o.x.o.........', tom: '..3.........1.2.' },
];

const BASS_A = bars(
  '1> . 8^ . 1 . 8^ . 1> . 8^ . 5 . 8^ .',
  '1> . 8^ . 1 . 8^ . 1> . 8^ . 5 . 3 .',
  '1> . 8^ . 1 . 8^ . 1> . 8^ . 5 . b7 .',
  '1> . 8^ . 1 . 8^ . 1> . 8^ . b7 . 5 .',
  '1> . 8^ . 1 . 8^ . 1> . 8^ . 5 . 8^ .',
  '1> . 8^ . 1 . 8^ . 1> . 8^ . 7 . 5 .',
  '1> . 8^ . 5 . 8^ . 1> . 8^ . 5 . 3 .',
  '1> . 8^ . 5 . 3 . 1> . 8^ . b7 . 5~ .',
);
const BASS_A3 = bars(
  '1> x 8^ x 1 x 8^ x 1> x 8^ x 5 x 8^ x',
  '1> x 8^ x 1 x 8^ x 1> x 8^ x 5 x 3 x',
  '1> x 8^ x 1 x 8^ x 1> x 8^ x 5 x b7 x',
  '1> x 8^ x 1 x 8^ x 1> x 8^ x b7 x 5 x',
  '1> x 8^ x 1 x 8^ x 1> x 8^ x 5 x 8^ x',
  '1> x 8^ x 1 x 8^ x 1> x 8^ x 7 x 5 x',
  '1> x 8^ x 5 x 8^ x 1> x 8^ x 5 x 3 x',
  '1> x 8^ x 5 x 3 x 1> . 8^ 8^ b7 . 5~ .',
);
const BASS_B = rep(bars('1> - - 5 8^ - 5 . 1> - - 5 7 . 8^ .', '1> . 3 . 5 . 7 . 8^ . 7 . 5 . 3~ .'), 4);
const BASS_S = rep('1> . . 8^ . 1 7 . 1> . 8^ . 5 . 7 8^', 8);
const BASS_D = bars(
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - b7 - - - 5 - - -',
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - b3 - - - 5 - - -',
  '1> . 1 . 1 . 1 . 1> . 1 . 1 . 1 .', '1> . 1 . 1 . 1 . 1> . 1 . 8^ . 8^ .',
  '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 8^ .', '1> 1 8^ 1 8^ 1 8^ 1 8^ 8^ 8^ 8^ 8^ 8^ 8^ 8^',
);
const BASS_T = bars(rep('1> . 8^ . 1 . 8^ . 1> . 8^ . 5 . 8^ .', 3), '1> . 8^ . b7 . 5 . 3 . 5 . b7 . 8^ .');

const KEYS_A = 'X-------X-------';
const KEYS_A3 = 'X--.x...X--.x.x.';
const CLAV_A2 = '..x...x...x...x.';
const CLAV_A3 = '..x.g.x...x.g.xg';
const BRASS_A = bars('X.....x.X-......', REST, 'X.....x.X-......', REST, 'X.....x.X-......', REST, 'X-..x.X-..x.X-..', 'X-------x.x.X.f-');
const BRASS_A3 = bars('X.....x.X-..x.X-', REST, 'X.....x.X-..x.X-', '........r-------', 'X.....x.X-..x.X-', REST, 'X-..x.X-..x.X-..', 'X-------x.x.X.f-');
const BRASS_B = bars('X-------........', 'x.x.X---........', 'X-------........', 'x.x.X---........', 'X-------........', 'x.x.X---........', 'r-------........', 'X-..x.X-f-------');
const BRASS_B2 = bars(rep(bars('X-..x.X-........', 'x.x.X---x.x.X---'), 3), 'r-------........', 'X-..x.X-f-------');
const BRASS_TOP = bars(
  'X.....x.X-..x.X-', '......x.X-......', 'X.....x.X-..x.X-', '........X-.x.X--',
  'X.....x.X-..x.X-', '......x.X-......', 'X-..x.X-..x.X-..', 'X-------x.x.X.f-',
);

// Leads: wah hook (A2 / A3 / A4), bridge melody (B / B2), square-synth solo over an A dorian vamp (S), tag riff (T).
const HOOK = bars(
  'A5 - - - G5 - E5 - G5 - A5 - - - C6 -',
  'B5 - - - A5 - G5 - E5 - - - - - . .',
  'D5 - E5 - G5 - - - A5 - B5 - D6 - - -',
  'B5 - - - - - G5 - E5 - - - . . . .',
  'A5 - - - G5 - E5 - G5 - A5 - - - C6 -',
  'E6 - - - D6 - C6 - A5 - - - G5 - - -',
  'F5 - - - A5 - C6 - B5 - - - D6 - - -',
  'E6 - - - D6 - B5 - G#5 - - - G5 - E5 -',
);
const HOOK_A4 = HOOK.split(' | ').slice(0, 7).join(' | ') + ' | E6 - - - D6 - B5 - G#5 - - - B5 - E6 -';
const BRIDGE = bars(
  'A5 - - - C6 - D6 - E6 - - - D6 - C6 -',
  'B5 - - - - - G5 - E5 - - - D5 - - -',
  'E5 - G5 - B5 - - - D6 - - - B5 - - -',
  'C6 - - - B5 - - - A5 - - - . . . .',
  'D6 - - - F6 - - - A5 - - - D6 - B5 -',
  'G#5 - - - F5 - - - D6 - - - B5 - G#5 -',
  'A5 - - - - - - - B5 - C6 - E6 - - -',
  'D6 - C6 - B5 - A5 - G#5 - - - F5 - E5 -',
);
const SOLO = bars(
  'E5 - G5 A5 - - C6~ - B5 A5 G5 - E5 - . .',
  'F#5 - - A5 - - C6 - B5 - - - . . A5 B5',
  'C6 - B5 A5 - G5 - E5 - Eb5~ E5 - G5 - A5 -',
  'B5 - A5 - F#5 - A5 - C6 - - - B5 - A5 -',
  'A5 - - - B5 - C6 - E6 - - - C6 - B5 -',
  'B5 - G5 - D6 - B5 - F5~ G5 - - E5 - - -',
  'A5 - C6 - E6 - D6 - C6 - B5 - A5 - G5 -',
  'F5 - - - D5 - - - G#5 - - - G5 - E5 -',
);
const TAG = bars(
  'A5 - C6 - E6 - D6 - C6 - B5 - A5 - G5 -',
  'B5 - D6 - F6 - E6 - D6 - B5 - G5 - - -',
  'A5 - C6 - E6 - - - B5 - - - A5 - - -',
  'G#5 - - - C6 - D6 - G5 - - - G#5 - E5~ -',
);

const CH_A = 'Am9 | Fmaj9 | G13 | Em7 | Am9 | Fmaj9 | Dm9 G13 | Cmaj9 E7#9';
const CH_B = 'Dm9 | G13 | Cmaj9 | Fmaj7#11 | Bm7b5 | E7b9 | Am9 | Fmaj7#11 E7alt';
const CRASH = 'C...............' + rep(REST, 7);

const A = {
  bars: 8, chords: CH_A, kick: K1, snare: S1, hat: H1, bass: BASS_A, keys: KEYS_A, cym: CRASH, brass: BRASS_A, fill: FILLS,
  layers: { 1: { brass: BRASS_TOP } },
};
const A3 = {
  ...A, kick: K2, snare: S2, hat: H2, bass: BASS_A3, keys: KEYS_A3, clav: CLAV_A3, brass: BRASS_A3, lead: HOOK, lead2: transpose(HOOK, -12),
};
const B = {
  ...A, chords: CH_B, kick: K4, bass: BASS_B, cym: 'C...............' + rep('R.R.R.R.R.R.R.R.', 7), hat: bars(REST, rep('..x...x...x...x.', 7)),
  pad: rep('X---------------', 8), brass: BRASS_B, lead: BRIDGE, fill: [FILLS[0], FILLS[2]] as Lanes[],
  layers: { 1: { lead2: transpose(BRIDGE, -12) } },
};

export const MOUNTAIN: Song = {
  id: 'race-mountain',
  title: 'Sunset Switchbacks',
  bpm: 130,
  swing: 0.04,
  key: 'A Dorian',
  lead: 'wah',
  sections: {
    vamp: { bars: 2, chords: 'Am9 | Am9', kick: K1, hat: H1, bass: rep('1> . 8^ . 1 . 8^ . 1> . 8^ . 5 . 8^ .', 2), keys: KEYS_A },
    intro: {
      bars: 2, chords: 'Am9 | Am9', bass: '1> . 8^ . 1 . 8^ . 1> . 8^ . 5 . 8^ .', hat: 'x.x.x.x.x.x.x.x.', cym: REST + 'W...............',
      fill: { kick: 'X...X...X...X.X.', snare: '........X.X.XXXX' },
    },
    A,
    A2: { ...A, lead: HOOK, clav: CLAV_A2, fill: [FILLS[1], FILLS[3]], layers: { 1: { brass: BRASS_TOP, lead2: transpose(HOOK, -12) } } },
    B,
    A3,
    S: {
      ...A, chords: 'Am9 | D9 | Am9 | D9 | Fmaj7#11 | G13 | Am9 | Bm7b5 E7#9', voice: 'synth', hat: H2, bass: BASS_S,
      keys: 'X-......X-..x...', clav: '..x...x...x.g.x.', lead: SOLO,
      brass: bars(REST, REST, REST, '........X-.x.X--', REST, REST, REST, 'X-------x.x.X.f-'),
    },
    D: {
      bars: 8, chords: 'Fmaj9 | G13 | Em7 | Am9 | Fmaj9 | G13 | Dm9 | E7alt',
      kick: bars(rep(K_HALF, 4), rep(K1, 3), 'X...X...X.X.XXXX'),
      snare: bars(rep('........X.......', 4), '....X.......X...', '....X...X...X...', 'X.X.X.X.X.X.X.X.', 'oooooooxxxxxxxXX'),
      hat: bars(rep(REST, 4), H1, H1, H2, H2), bass: BASS_D, keys: rep('X---------------', 8), pad: rep('X---------------', 8),
      cym: bars('C...............', rep(REST, 6), 'W...............'),
      brass: bars(rep(REST, 4), 'r-------........', REST, 'r-------........', 'x.x.x.x.X.X.X.X.'),
      layers: { 1: { clav: rep(REST, 8), perc: REST } },
    },
    B2: { ...B, kick: K2, snare: S2, hat: H2, cym: CRASH, brass: BRASS_B2, lead2: transpose(BRIDGE, -12) },
    A4: { ...A3, lead: HOOK_A4, lead2: undefined, brass: BRASS_A, layers: { 1: { brass: BRASS_TOP, lead2: transpose(HOOK_A4, -12) } } },
    T: {
      bars: 4, chords: 'Fmaj7#11 | G13 | Fmaj7#11 | E7alt', kick: K1, snare: S1, hat: H1, bass: BASS_T, keys: 'X-..X-..X-..X-..',
      cym: 'C...............' + rep(REST, 3), brass: bars('X-..X-..X-X-X---', REST, 'X-..X-..X-X-X---', 'r-------x.x.X.f-'), lead: TAG,
      fill: FILLS[3],
    },
  },
  form: ['intro', 'A', 'A2', 'B', 'A3', 'S', 'D', 'B2', 'A4', 'T'],
  loopFrom: 1,
  vamp: 'vamp',
  stretch: ['B2', 'A4'],
  lift: { tempo: 1.04, semis: 2 },
  layers: {
    1: { perc: 'b...T...b...T...', clav: 'xgxgxgxgxgxgxgxg', clap: '....X.......X...' },
    2: { perc: 's.sTs.sTs.sTs.sT', clap: '....X.......X...', hat: 'XxxxXxxxXxxxXxxx', kick: K4, bass: '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 5 .' },
  },
  notes:
    'Driving sunset rock-funk, 130 bpm, nearly straight (swing 0.04), A Dorian; loop A–A2–B–A3–S–D–B2–A4–T = 68 bars (2:06). ' +
    'A: Am9 | Fmaj9 | G13 | Em7 | Am9 | Fmaj9 | Dm9–G13 | Cmaj9–E7#9; kick on 1, &2, 3, &4, 8-bar octave slap line, half-note ' +
    'Rhodes, brass hits. A2: soaring wah hook (A–G–E–G–A–C …). B (bridge): Dm9–G13–Cmaj9–Fmaj7#11–Bm7b5–E7b9–Am9–Fmaj7#11/E7alt, ' +
    'four-on-the-floor, ride, legato slap line, pad, brass swells. A3: pushed kick, 16th hats, 16th dead-note bass, new comp + ' +
    'clav, brass answers, hook an octave down too. S: square-synth solo over an A dorian vamp (Am9 | D9). D: half-time ' +
    'breakdown, then a 4-bar build. B2: brass riff, doubled bridge melody. A4: hook resolving up to E. T: 4-bar wah/brass tag ' +
    'on Fmaj7#11–G13 into E7alt. Top-3: brass answers, octave-doubled lead, cowbell + tambourine, clav 16ths. Final stretch: ' +
    'riser + snare roll, then B2–A4 a whole step up (B dorian) at +4 % tempo, four-on-the-floor, 8th bass, 16th hats, claps.',
};
