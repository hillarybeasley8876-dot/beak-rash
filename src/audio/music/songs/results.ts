// Results — "Victory Lap" · 122 bpm · F major · feel-good gospel-funk with a brassy synth lead.
import { bars, rep } from './util';
import type { Song } from '../types';

const REST = '................';
const K = 'X.....x...x.....';
const S = '....X..g....X..g';
const H = 'xoxoxoxoxoxoxoOo';
const BASS = '1> . . 5 8^ . 5 . 1 . 3 . 5 . 6 .';
const COMP = 'X-..x.x-..X-.x..';
const FILL = { snare: '....X..g.xX.XxXX', tom: '..........1.2.3.', hat: 'xoxoxoxoxo......' };

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

const BRIDGE = bars(
  'F5 - A5 - C6 - D6 - - - C6 - A5 - - -',
  'Bb5 - - - A5 - - - G5 - E5 - - - . .',
  'C6 - - - E6 - - - D6 - C6 - A5 - - -',
  'F5 - - - E5 - - - D5 - - - A5 - - -',
  'Bb5 - - - D6 - - - F6 - - - E6 - D6 -',
  'C6 - - - Bb5 - - - G5 - - - F5 - - -',
  'A5 - - - C6 - - - E6 - - - G6 - - -',
  'F6 - - - D6 - Bb5 - Bb5 - Ab5 - E5 - - -',
);

const A = {
  bars: 8,
  chords: 'Fmaj9 | Em7 A7#9 | Dm9 | Cm9 F13 | Bbmaj9 | Bbm6 | Am7 D7b9 | Gm9 C13',
  kick: K, snare: S, hat: H, bass: BASS, keys: COMP,
  cym: 'C...............' + rep(REST, 7),
  brass: bars(REST, '........x.X-....', REST, '........x.X-....', REST, 'X-------........', REST, '..........x.X.f-'),
  fill: FILL,
};

export const RESULTS: Song = {
  id: 'results',
  title: 'Victory Lap',
  bpm: 122,
  swing: 0.16,
  key: 'F major',
  lead: 'synth',
  sections: {
    intro: {
      bars: 2, chords: 'Fmaj9 | C13', cym: 'C...............' + REST, brass: 'r-------........' + REST,
      keys: 'X-------x-------', pad: 'X---------------', hat: 'x.x.x.x.x.x.x.x.',
      fill: { snare: '....X...X.x.XxXX', tom: '........1.2.3...', bass: '1> . . . . . . . 5 . 8^ . 7 . 8^ .' },
    },
    A,
    A2: { ...A, lead: MELODY, perc: 's.s.T.s.s.s.T.s.' },
    B: {
      ...A,
      chords: 'Bbmaj9 | C13 | Am7 | Dm9 | Gm9 | C9sus | Fmaj9 | Gm9 Gb7#11',
      clap: '....X.......X...',
      pad: rep('X---------------', 8),
      brass: bars('X-------........', REST, 'X-------........', REST, 'X-------........', 'x.x.X---........', 'r-------........', 'X.....x.x.X.f---'),
      lead: BRIDGE,
    },
  },
  form: ['intro', 'A', 'A2', 'B', 'A2'],
  loopFrom: 1,
  notes:
    'Results / victory lap, 122 bpm, swing 0.16, F major. Intro: brass rip + crash fanfare and a tom fill. A (8): ' +
    'Fmaj9 | Em7–A7#9 | Dm9 | Cm9–F13 (ii–V to IV) | Bbmaj9 | Bbm6 (minor plagal) | Am7–D7b9 | Gm9–C13 (ii–V home). ' +
    'Shuffled kick/ghost-snare groove, slap bass 1–5–8–5–3–5–6, Rhodes comp, brass punches. A2: bright synth-brass ' +
    'melody (A–C … C#–C over A7#9, Db over Bbm6) + shaker/tambourine. B (gospel bridge): Bbmaj9–C13–Am7–Dm9–Gm9–C9sus–' +
    'Fmaj9 with a Gb7#11 tritone sub turnaround, claps on 2 & 4, pad, brass swells. Loops A→A2→B→A2.',
};
