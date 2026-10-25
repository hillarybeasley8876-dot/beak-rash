// Results — "Victory Lap" · 122 bpm · F major · feel-good gospel-funk with a brassy synth lead.
// Loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:06). Off the podium the song opens on B (system.ts).
import { bars, rep, transpose } from './util';
import type { Lanes, Song } from '../types';

const REST = '................';
const K = 'X.....x...x.....';
const K2 = 'X.....x...x...x.';
const K_HALF = 'X.........x.....';
const S = '....X..g....X..g';
const S2 = '..g.X..g.g..X.gg';
const H = 'xoxoxoxoxoxoxoOo';
const H2 = 'x.O.x.O.x.O.x.O.';
const FILLS: Lanes[] = [
  { snare: '....X..g.xX.XxXX', tom: '..........1.2.3.', hat: 'xoxoxoxoxo......' },
  { snare: '....X..g....X.XX', tom: '........1.2.3.3.', hat: 'xoxoxoxo........' },
  { snare: '....X...X.x.XxXX', kick: 'X.....x...X.X.X.', hat: 'xoxo............' },
];

// Bass: 8-bar lines (degrees follow the chord sounding at each step).
const ONE = '1> . . 5 8^ . 5 . 1 . 3 . 5 . 6 .';
const TWO = '1> . 5 . 8^ . 7 . 1> . 5 . 7 . 8^ .';
const BASS_A = bars(
  ONE, TWO, '1> . . 5 8^ . 5 . 1 . 3 . 5 . 7 .', '1> . 5 . 8^ . 7 . 1> . 3 . 5 . 6 .',
  ONE, ONE, '1> . 5 . 8^ . 7 . 1> . 3 . 5 . 7 .', '1> . 5 . 8^ . 7 . 1> . 3 . 5 . 7~ .',
);
const BASS_A3 = bars(
  '1> x . 5 8^ x 5 x 1 x 3 x 5 x 6 x', '1> x 5 x 8^ x 7 x 1> x 5 x 7 x 8^ x',
  '1> x . 5 8^ x 5 x 1 x 3 x 5 x 7 x', '1> x 5 x 8^ x 7 x 1> x 3 x 5 x 6 x',
  '1> x . 5 8^ x 5 x 1 x 3 x 5 x 6 x', '1> x . 5 8^ x 5 x 1 x 3 x 5 x 6 x',
  '1> x 5 x 8^ x 7 x 1> x 3 x 5 x 7 x', '1> x 5 x 8^ x 7 x 1> . 3 . 5 . 7~ .',
);
const BASS_B = bars(
  '1> - - . 5 - . 8^ . 7 - . 5 . 3 .', '1> - - . 5 - 8^ . 7 - . 5 . 3~ - .',
  '1> - - . 3 - 5 . 8^ - . 7 5 . 3 .', '1> - - . 5 - . 8^ . 7 - . 5 . 3 .',
  '1> - - . 3 - 5 . 8^ - . 7 5 . 3 .', '1> - - . 5 - . 8^ . 4 - . 5 . 2 .',
  '1> - - . 3 - 5 . 8^ - . 7 5 . 3 .', '1> - 5 . 8^ . 1~ . 1> - 5 . 8^ . 5 .',
);
const BASS_B2 = bars(
  '1> . 8^ . 5 . 8^ x 1> . 8^ . 7 . 5 x', '1> . 8^ . 5 . 7 x 1> . 8^ . 5 . 3~ .',
  '1> . 8^ . 5 . 8^ x 1> . 8^ . 7 . 5 x', '1> . 8^ . 5 . 8^ x 1> . 8^ . 7 . 6 x',
  '1> . 8^ . 3 . 5 x 1> . 8^ . 7 . 5 .', '1> . 8^ . 4 . 5 x 1> . 8^ . 5 . 2 .',
  '1> . 8^ . 3 . 5 x 1> . 8^ . 7 . 5 .', '1> . 8^ . 1~ . 8^ . 1> . 8^ . 5 . 8^ .',
);
// Solo: the gospel I–IV7 vamp.
const VAMP_I = '1> . . 8^ . 1 7 . 1> . 8^ . 5 . 4 8^';
const VAMP_IV = '1> . 8^ . 5 . 7 . 1> . 8^ . 6 . 5 3';
const BASS_S = bars(VAMP_I, VAMP_IV, VAMP_I, VAMP_IV, '1> . . 8^ . 1 7 . 1> . 8^ . 5 . 3 .', '1> . 8^ . 5 . 7 . 1> . 8^ . 6 . 5 .', VAMP_IV, '1> . 8^ . 7 . 8^ x 1> . 5 . 3 . 8^ .');
const BASS_D = bars(
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - 5 - - - 3 - - -',
  '1> - - - - - - - 5 - - - 8^ - - -', '1> - - - - - - - 4 - - - 5 - - -',
  '1> . 1 . 1 . 1 . 1> . 1 . 1 . 1 .', '1> . 1 . 1 . 1 . 1> . 1 . 8^ . 8^ .',
  '1> . 1 . 8^ . 1 . 1> . 1 . 8^ . 8^ .', '1> 1 8^ 1 8^ 1 8^ 1 8^ 8^ 8^ 8^ 8^ 8^ 8^ 8^',
);

const COMP = 'X-..x.x-..X-.x..';
const COMP_A3 = 'x..x..x-..x..x..';
const CRASH = 'C...............' + rep(REST, 7);
const BRASS_A = bars(REST, '........x.X-....', REST, '........x.X-....', REST, 'X-------........', REST, '..........x.X.f-');
const BRASS_A3 = bars('X.......x.X-....', '........x.X-....', 'X.......x.X-....', '........x.X-....', 'X-..x.X-........', 'X-------........', 'x.x.X-..x.x.X-..', '..........x.X.f-');
const BRASS_B = bars('X-------........', REST, 'X-------........', REST, 'X-------........', 'x.x.X---........', 'r-------........', 'X.....x.x.X.f---');

// Leads: synth-brass melody (A2 / A3 / A4), gospel bridge (B / B2), wah solo over the I–IV7 vamp (S).
const MELODY = bars(
  'A5 - - - C6 - - A5 G5 - F5 - - - . .',
  'G5 - - - E5 - G5 - C#6 - - - C6 - A5 -',
  'D6 - - - C6 - A5 - F5 - - - E5 - D5 -',
  'Eb5 - - - G5 - Bb5 - A5 - - - F5 - - -',
  'D6 - - - C6 - Bb5 - A5 - - - F5 - G5 -',
  'Db6 - - - C6 - - - Bb5 - G5 - - - . .',
  'C6 - - - A5 - G5 - F#5 - - - A5 - C6 -',
  'Bb5 - - - A5 - G5 - E5 - - - . . . .',
);
const MELODY_A4 = MELODY.split(' | ').slice(0, 7).join(' | ') + ' | Bb5 - D6 - C6 - Bb5 - G5 - - - E5 - C6 -';
const BRIDGE = bars(
  'F5 - A5 - C6 - D6 - - - C6 - A5 - - -',
  'Bb5 - - - A5 - - - G5 - E5 - - - . .',
  'C6 - - - E6 - - - D6 - C6 - A5 - - -',
  'F5 - - - E5 - - - D5 - - - A5 - - -',
  'Bb5 - - - D6 - - - F6 - - - - - D6 -',
  'C6 - - - Bb5 - - - G5 - - - F5 - - -',
  'A5 - - - C6 - - - E6 - - - G6 - - -',
  'F6 - - - D6 - Bb5 - Bb5 - Ab5 - E5 - - -',
);
const SOLO = bars(
  'A5 - C6 - E6 - - - D6 C6 A5 - G5 - F5 -',
  'Ab5 - - - G5 - F5 - D5 - - - . . F5 G5',
  'A5 - C6 - F6 - E6 - C6 - A5 - G5 - E5 -',
  'F5 - Ab5 - C6 - D6 - - - C6 - Ab5 - G5 -',
  'F5 - A5 - C6 - E6 - F6 - - - E6 - C6 -',
  'B5 - D6 - E6 - - - D6 - B5 - G5 - F5 -',
  'Bb5 - D6 - F6 - - - D6 - Bb5 - A5 - G5 -',
  'E5 - G5 - Bb5 - A5 - G5 - E5 - C5 - - -',
);

const A = {
  bars: 8,
  chords: 'Fmaj9 | Em7 A7#9 | Dm9 | Cm9 F13 | Bbmaj9 | Bbm6 | Am7 D7b9 | Gm9 C13',
  kick: K, snare: S, hat: H, bass: BASS_A, keys: COMP, cym: CRASH, brass: BRASS_A, fill: FILLS,
};
const B = {
  ...A,
  chords: 'Bbmaj9 | C13 | Am7 | Dm9 | Gm9 | C9sus | Fmaj9 | Gm9 Gb7#11',
  clap: '....X.......X...', bass: BASS_B, pad: rep('X---------------', 8), brass: BRASS_B, lead: BRIDGE,
};

export const RESULTS: Song = {
  id: 'results',
  title: 'Victory Lap',
  bpm: 122,
  swing: 0.16,
  key: 'F major',
  lead: 'synth',
  // The bright synth-brass melody reads louder than its level.
  mix: { lead: 0.78 },
  sections: {
    intro: {
      bars: 2, chords: 'Fmaj9 | C13', cym: 'C...............' + REST, brass: 'r-------........' + REST,
      keys: 'X-------x-------', pad: 'X---------------', hat: 'x.x.x.x.x.x.x.x.',
      fill: { snare: '....X...X.x.XxXX', tom: '........1.2.3...', bass: '1> . . . . . . . 5 . 8^ . 7 . 8^ .' },
    },
    A: { ...A, gainDb: -4.5 },
    A2: { ...A, lead: MELODY, perc: 's.s.T.s.s.s.T.s.' },
    B,
    A3: {
      ...A, kick: K2, snare: S2, bass: BASS_A3, keys: COMP_A3, brass: BRASS_A3, lead: MELODY, lead2: transpose(MELODY, -12),
      perc: 's.s.T.s.s.s.T.s.', clap: '....X.......X...',
    },
    S: {
      ...A, chords: 'Fmaj9 | Bb13 | Fmaj9 | Bb13 | Dm9 | G13 | Gm9 | C13', voice: 'wah', hat: H2, snare: '....X.......X..g',
      bass: BASS_S, keys: 'X-......X-......', lead: SOLO, clap: '....X.......X...',
      brass: bars(REST, REST, REST, '........X-.x.X--', REST, REST, REST, 'X.....x.x.X.r---'),
    },
    D: {
      shape: 'breakdown',
      bars: 8, chords: 'Bbmaj9 | Am7 | Gm9 | C9sus | Bbmaj9 | Am7 | Gm9 | C13',
      kick: bars(rep(K_HALF, 4), rep(K, 3), 'X...X...X.X.XXXX'),
      snare: bars(rep('........X.......', 4), '....X.......X...', '....X...X...X...', 'X.X.X.X.X.X.X.X.', 'oooooooxxxxxxxXX'),
      hat: bars(rep(REST, 4), H2, H2, H, H), bass: BASS_D, keys: rep('X---------------', 8), pad: rep('X---------------', 8),
      cym: bars('C...............', rep(REST, 6), 'W...............'),
      brass: bars(rep(REST, 4), 'r-------........', REST, 'r-------........', 'x.x.x.x.X.X.X.X.'),
    },
    B2: { ...B, gainDb: 2, kick: K2, snare: S2, bass: BASS_B2, brass: rep('X..x..X...X.x.X-', 6) + ' | r-------........ | X.....x.x.X.f---', lead2: transpose(BRIDGE, -12) },
    A4: { ...A, bass: BASS_A3, keys: COMP_A3, lead: MELODY_A4, perc: 's.s.T.s.s.s.T.s.' },
  },
  form: ['intro', 'A', 'A2', 'B', 'A3', 'S', 'D', 'B2', 'A4'],
  loopFrom: 1,
  notes:
    'Results / victory lap, 122 bpm, swing 0.16, F major; loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:06). Intro: brass rip + ' +
    'crash fanfare and a tom fill. A (8): Fmaj9 | Em7–A7#9 | Dm9 | Cm9–F13 (ii–V to IV) | Bbmaj9 | Bbm6 (minor plagal) | ' +
    'Am7–D7b9 | Gm9–C13 (ii–V home); shuffled kick / ghost-snare groove, an 8-bar slap line (1–5–8–5–3–5–6 on the one-chord ' +
    'bars, root–octave–7th on the ii–V bars, a slide home), Rhodes comp, brass punches. A2: bright synth-brass melody ' +
    '(A–C … C#–C over A7#9, Db over Bbm6) + shaker / tambourine. B (gospel bridge): Bbmaj9–C13–Am7–Dm9–Gm9–C9sus–Fmaj9 with ' +
    'a Gb7#11 tritone sub, legato walk with slides, claps on 2 & 4, pad, brass swells. A3: pushed kick, 16th dead-note bass, ' +
    'new comp, brass answers, claps, the melody doubled an octave down. S: wah solo over the gospel I–IV7 vamp (Fmaj9 | ' +
    'Bb13) into Dm9–G13–Gm9–C13. D: 4-bar half-time breakdown then a 4-bar build. B2: the bridge with 8th-note pops, a ' +
    'brass riff every bar and an octave-doubled lead. A4: melody with a new last bar. Three rotating fills.',
};
