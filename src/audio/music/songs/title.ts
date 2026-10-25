// Title theme — "BEAK RASH!" · 126 bpm · D Dorian · swung 16ths. The main hook lives here.
// Loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:02): it also plays through every menu screen until the
// first race, so each section has its own bass line, comp and brass, and the fills rotate.
import { bars, rep, transpose } from './util';
import type { Lanes, Song } from '../types';

const K = 'X.....x...X..x..';
const K2 = 'X.....x...X..x.x';
const K_HALF = 'X.........x.....';
const S = '....X..g.g..X..g';
const S2 = '..g.X..g.g..X.gg';
const H = 'xoxoxoxoxoxoxoOo';
const H2 = 'x.O.x.O.x.O.x.O.';
const REST = '................';
const FILLS: Lanes[] = [
  { snare: '....X..g.x.xX...', tom: '.............123', hat: 'xoxoxoxoxoxo....' },
  { snare: '....X..g....X.XX', tom: '........1.2.3.3.', hat: 'xoxoxoxo........' },
  { snare: '....X...X.x.XxXX', kick: 'X.....x...X.X.X.', hat: 'xoxo............' },
];

// Bass: 8-bar lines (degrees follow each bar's chord).
const SLAP = '1> . 8^ x . 1 8^ . 1> . x 5 7 . 8^ x';
const BASS_A = bars(
  SLAP, '1> . 8^ . 7 . 8^ x 1> . 5 . 7 . 8^ 5', SLAP, '1> . 8^ . 7 . 5 . 1> . 8^ . 6 . 5~ .',
  '1> . 5 . 8^ . 5 . 1> . 3 . 5 . 8^ .', '1> . 8^ . 7 . 8^ x 1> . 5 . 7 . 8^ 5', SLAP, '1> . 8^ . 7 . 8^ x 1> . 5 . 3 . 2 1',
);
const BASS_A3 = bars(
  '1> x 8^ x . 1 8^ x 1> x x 5 7 x 8^ x', '1> x 8^ x 7 x 8^ x 1> x 5 x 7 x 8^ x',
  '1> x 8^ x . 1 8^ x 1> x x 5 7 x 8^ x', '1> x 8^ x 7 x 5 x 1> x 8^ x 6 x 5~ x',
  '1> x 5 x 8^ x 5 x 1> x 3 x 5 x 8^ x', '1> x 8^ x 7 x 8^ x 1> x 5 x 7 x 8^ 5',
  '1> x 8^ x . 1 8^ x 1> x x 5 7 x 8^ x', '1> x 8^ x 7 x 8^ x 1> . 5 . 3 . 2 1',
);
// Bridge: a legato walk with slides through the ii–V–I in F and the minor ii–V home.
const BASS_B = bars(
  '1> - - . 5 - . 8^ . 7 - . 5 . 3 .', '1> - - . 5 - 8^ . 7 - . 5 . 3~ - .',
  '1> - - . 5 - . 8^ . 7 - . 6 . 5 .', '1> - - . 3 - 5 . 8^ - . 7 5 . 3 .',
  '1> - - . 3 - 5 . 8^ - . 5 3 . 1 .', '1> - - . 3 - 5 . 7 - . 5 3 . 1 .',
  '1> - - . 5 - 8^ . 7 - . 5 4 . 3 .', '1> - 5 . 8^ . 1~ . 1> - 5 . 8^ . 5 .',
);
const BASS_B2 = bars(
  '1> . 8^ . 5 . 8^ x 1> . 8^ . 7 . 5 x', '1> . 8^ . 5 . 7 x 1> . 8^ . 5 . 3~ .',
  '1> . 8^ . 5 . 8^ x 1> . 8^ . 7 . 6 x', '1> . 8^ . 3 . 5 x 1> . 8^ . 7 . 5 .',
  '1> . 8^ . 3 . 5 x 1> . 8^ . 5 . 3 x', '1> . 8^ . 3 . 5 x 1> . 7 . 5 . 3 .',
  '1> . 8^ . 5 . 8^ x 1> . 8^ . 5 . 4 3', '1> . 8^ . 1~ . 8^ . 1> . 8^ . 5 . 8^ .',
);
// Solo vamp (Dorian i–IV) and its turnaround.
const VAMP_I = '1> . . 8^ . 1 7 . 1> . 8^ . 5 . 4 8^';
const VAMP_IV = '1> . 8^ . 5 . 7 . 1> . 8^ . 6 . 5 3';
const BASS_S = bars(VAMP_I, VAMP_IV, VAMP_I, VAMP_IV, '1> . 5 . 8^ . 5 . 1> . 3 . 5 . 8^ .', '1> . 8^ . 5 . 7 . 1> . 8^ . 6 . 5 .', VAMP_I, '1> . 8^ . 7 . 8^ x 1> . 5 . 3 . 8^ .');
const BASS_D = bars(
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - 5 - - - 3 - - -',
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - 7 - - - 5 - - -',
  '1> . 1 . 1 . 1 . 1> . 1 . 1 . 1 .', '1> . 1 . 1 . 1 . 1> . 1 . 8^ . 8^ .',
  '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 8^ .', '1> 1 8^ 1 8^ 1 8^ 1 8^ 8^ 8^ 8^ 8^ 8^ 8^ 8^',
);

// Comping.
const COMP = 'X-..x.x-..X-.x..';
const COMP_A3 = 'x..x..x-..x..x..';
const CLAV = '..x.g.x...x.g.x.';
const CLAV_A3 = 'x.g.x.gxx.g.x.g.';
const BRASS_A = bars(rep(REST, 3), '..........x.X-..', rep(REST, 3), 'X.....x.x.X.f---');
const BRASS_A3 = bars('X.......x.X-....', '..........x.X-..', 'X.......x.X-....', '..x.x.X-........', 'X-..x.X-........', 'r-------f---....', 'X.......x.X-....', 'X.....x.x.X.f---');
const BRASS_B2 = rep('X..x..X...X.x.X-', 6) + ' | r-------........ | X---x.x.r---f---';
const CRASH = 'C...............' + rep(REST, 7);

// Leads: wah hook (A2 / A3 / A4), lyrical bridge (B / B2), square-synth solo over the Dorian vamp (S).
const HOOK = bars(
  'A4 . D5 . F5 - E5 D5 . F5 - G5 A5 - - .',
  '. . B5 A5 - G5 E5 - D5 - - - . . . .',
  'A4 . D5 . F5 - E5 D5 . F5 - G5 A5 - C6 -',
  'A5 G5 F5 - E5 - D5 - . . . . . . . .',
  'F5 - A5 - D6 - C6 A5 - - . F5 G5 A5 - .',
  'E5 - G5 - E5 - C#5 - C5 - - . A4 - - .',
  'D5 - - - - . F5 E5 D5 - - . A4 C5 D5 -',
  '. . . . G5 F5 Eb5 Db5 C5 . A4 - - - . .',
);
const HOOK_A4 = HOOK.split(' | ').slice(0, 7).join(' | ') + ' | Eb5 - G5 - Bb5 - Db6 - Bb5 - A5 - G5 - F5 -';
const BRIDGE = bars(
  'D5 - - - F5 - A5 - Bb5 - - - A5 - F5 -',
  'G5 - - - - - E5 - D5 - - - C5 - D5 -',
  'E5 - - - - - G5 - A5 - - - C6 - - -',
  'D6 - - - C6 - A5 - F5 - - - . . . .',
  'G5 - - - Bb5 - - - D6 - - - C6 - Bb5 -',
  'A5 - - - G5 - - - E5 - - - C#5 - Bb4 -',
  'D5 - - - - - - - E5 - F5 - A5 - - -',
  'G5 - F5 - D5 - - - C#5 - - - C5 - A4 -',
);
const SOLO = bars(
  'D5 - F5 A5 - - C6~ - A5 G5 F5 - D5 - . .',
  'E6 - - D6 - - B5 - A5 - - - . . A5 C6',
  'D6 - F6~ E6 - D6 - C6 - A5 - G5 - F5 - .',
  'G5 - B5 - D6 - E6 - F6 - E6 - D6 - B5 -',
  'D6 - - - C6 - A5 - F5 - - - G5 - F5 -',
  'G5 - Bb5 - E6 - D6 - C6 - - - Bb5 - A5 -',
  'F5 - A5 - C6 - E6 - F6 - - - E6 - D6 -',
  'C#6 - - - C6 - A5 - G5 - E5 - C#5 - A4~ -',
);

const A = {
  bars: 8, chords: 'Dm9 | G13 | Dm9 | G13 | Bbmaj7 | A7#9 | Dm9 | Eb7#11', kick: K, snare: S, hat: H, bass: BASS_A,
  keys: COMP, cym: CRASH, brass: BRASS_A, fill: FILLS,
};
const A3 = {
  ...A, kick: K2, snare: S2, bass: BASS_A3, keys: COMP_A3, clav: CLAV_A3, brass: BRASS_A3, lead: HOOK,
  lead2: transpose(HOOK, -12), perc: 's.s.T.s.s.s.T.s.',
};
const B = {
  bars: 8, chords: 'Gm9 | C13 | Fmaj9 | Bbmaj7 | Em7b5 | A7b9 | Dm9 | Bb13 A7#9',
  kick: bars(rep('X.......X..x....', 4), rep(K, 4)),
  snare: bars(rep('....X.......X...', 4), rep(S, 4)),
  hat: bars(rep(REST, 4), rep(H, 4)),
  cym: bars('C...............', rep('R.R.R.R.R.R.R.R.', 3), rep(REST, 3), 'W...............'),
  bass: BASS_B,
  keys: bars(rep('X-------x-------', 4), rep(COMP, 4)),
  pad: rep('X---------------', 8),
  brass: bars(rep(REST, 4), 'X-------........', 'x.x.X---........', 'X-------........', 'X---x.x.r---f---'),
  lead: BRIDGE,
  fill: { snare: '....X...X.x.XxXX', tom: '........1.2.3...' },
};

export const TITLE: Song = {
  id: 'title',
  title: 'BEAK RASH! (Main Theme)',
  bpm: 126,
  swing: 0.1,
  key: 'D Dorian',
  lead: 'wah',
  // The hook a touch under the default; a little less sub.
  mix: { lead: 0.88, bass: 0.85 },
  crackle: 0.12,
  sections: {
    intro: {
      bars: 2, chords: 'Dm9 | Dm9', keys: 'X-------....x-..', pad: 'X---------------',
      hat: 'x.x.x.x.x.x.x.x.', cym: REST + 'W...............',
      fill: { kick: 'X.........X.....', snare: '....X.....x.xxXX', tom: '........1.2.3.3.', bass: '1> - - . . . . . 5 . 8^ . 7 . 8^ .' },
    },
    A: { ...A, gainDb: -4.5 },
    A2: { ...A, lead: HOOK, clav: CLAV },
    B,
    A3,
    S: {
      ...A, chords: 'Dm9 | G13 | Dm9 | G13 | Bbmaj7 | C13 | Dm9 | A7#9', voice: 'synth', hat: H2, snare: '....X.......X..g',
      bass: BASS_S, keys: 'X-......X-......', clav: '.gx..gx..gx..gx.', lead: SOLO,
      brass: bars(REST, REST, REST, '........X-.x.X--', REST, REST, REST, 'X.....x.x.X.r---'),
    },
    D: {
      shape: 'breakdown',
      bars: 8, chords: 'Dm9 | Bbmaj7 | Gm9 | A7#9 | Dm9 | Bbmaj7 | Gm9 | A7#9',
      kick: bars(rep(K_HALF, 4), rep(K, 3), 'X...X...X.X.XXXX'),
      snare: bars(rep('........X.......', 4), '....X.......X...', '....X...X...X...', 'X.X.X.X.X.X.X.X.', 'oooooooxxxxxxxXX'),
      hat: bars(rep(REST, 4), H2, H2, H, H), bass: BASS_D, keys: rep('X---------------', 8), pad: rep('X---------------', 8),
      cym: bars('C...............', rep(REST, 6), 'W...............'),
      brass: bars(rep(REST, 4), 'r-------........', REST, 'r-------........', 'x.x.x.x.X.X.X.X.'),
    },
    B2: {
      gainDb: 2,
      ...B, kick: rep(K2, 8), snare: rep(S2, 8), hat: rep(H, 8), cym: CRASH, bass: BASS_B2, keys: rep(COMP, 8),
      brass: BRASS_B2, lead2: transpose(BRIDGE, -12),
    },
    A4: { ...A3, lead: HOOK_A4, lead2: undefined, brass: BRASS_A },
  },
  form: ['intro', 'A', 'A2', 'B', 'A3', 'S', 'D', 'B2', 'A4'],
  loopFrom: 1,
  notes:
    'D Dorian funk at 126 bpm, 16th swing 0.10; loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:02). Intro: Rhodes + pad + vinyl ' +
    'crackle, reverse-cymbal swell and tom fill. A (8): Dm9–G13 Dorian vamp ×2, Bbmaj7–A7#9, Dm9, Eb7#11 (tritone sub of A7) ' +
    'back to Dm9; 8-bar slap line (thumb/pop octaves, dead notes, 6th and slide into bar 5, chromatic F–Eb into D), ghost-note ' +
    'snare, syncopated Rhodes comp, brass punches on bars 4/8. A2: the wah hook (call A–D–F–E–D / answer B–A–G–E–D, climbing ' +
    'to C6, bluesy C over A7#9) + clavinet chops. B (bridge): ii–V–I in F (Gm9–C13–Fmaj9–Bbmaj7), minor ii–V home ' +
    '(Em7b5–A7b9–Dm9) and Bb13–A7#9; half-time ride feel for 4 bars, legato walking bass with slides, lyrical counter-melody, ' +
    'brass swells, rip + fall. A3: pushed kick, busier ghosts, 16th dead-note bass, new comp / clav rhythms, brass answers, ' +
    'hook doubled an octave down, shaker / tambourine. S: square-synth solo over the Dorian i–IV vamp (Dm9 | G13) into ' +
    'Bbmaj7–C13–Dm9–A7#9. D: 4-bar half-time breakdown (Dm9–Bbmaj7–Gm9–A7#9, pad, long bass notes) then a 4-bar build ' +
    '(8th → 16th snare, octave bass, brass rips, swell). B2: the bridge with a full groove, octave-doubled lead, 8th-note ' +
    'bass with pops and a brass riff every bar. A4: hook with a new last bar (an Eb7#11 arpeggio falling 5–#11–3–9). Three ' +
    'rotating fills.',
};
