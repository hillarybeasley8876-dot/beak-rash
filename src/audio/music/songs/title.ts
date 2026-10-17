// Title theme — "BEAK RASH!" · 126 bpm · D Dorian · swung 16ths. The main hook lives here.
import { bars, rep, transpose } from './util';
import type { Song } from '../types';

const K = 'X.....x...X..x..';
const S = '....X..g.g..X..g';
const H = 'xoxoxoxoxoxoxoOo';
const REST = '................';
const SLAP = '1> . 8^ x . 1 8^ . 1> . x 5 7 . 8^ x';
const SLAP_IV = '1> . 5 . 8^ . 5 . 1> . 3 . 5 . 8^ .';
const SLAP_V = '1> . 8^ . 7 . 8^ x 1> . 5 . 7 . 8^ 5';
const SLAP_SUB = '1> . 8^ . 7 . 8^ x 1> . 5 . 3 . 2 1';
const BASS_A = bars(SLAP, SLAP, SLAP, SLAP, SLAP_IV, SLAP_V, SLAP, SLAP_SUB);
const COMP = 'X-..x.x-..X-.x..';
const CLAV = '..x.g.x...x.g.x.';
const CHORDS_A = 'Dm9 | G13 | Dm9 | G13 | Bbmaj7 | A7#9 | Dm9 | Eb7#11';
const FILL = { snare: '....X..g.x.xX...', tom: '.............123', hat: 'xoxoxoxoxoxo....' };

const HOOK = bars(
  'A4 . D5 . F5 - E5 D5 . F5 - G5 A5 - - .',
  '. . B5 A5 - G5 E5 - D5 - - - . . . .',
  'A4 . D5 . F5 - E5 D5 . F5 - G5 A5 - C6 -',
  'A5 G5 F5 - E5 - D5 - . . . . . . . .',
  'F5 - A5 - D6 - C6 A5 - - . F5 G5 A5 - .',
  'E5 - G5 - F5 - E5 - C5 - - . A4 - - .',
  'D5 - - - - . F5 E5 D5 - - . A4 C5 D5 -',
  '. . . . G5 F5 Eb5 Db5 C5 . A4 - - - . .',
);

const BRIDGE = bars(
  'D5 - - - F5 - A5 - Bb5 - - - A5 - F5 -',
  'G5 - - - - - E5 - D5 - - - C5 - D5 -',
  'E5 - - - - - G5 - A5 - - - C6 - - -',
  'D6 - - - C6 - A5 - F5 - - - . . . .',
  'G5 - - - Bb5 - - - D6 - - - C6 - Bb5 -',
  'A5 - - - G5 - - - F5 - E5 - C#5 - Bb4 -',
  'D5 - - - - - - - E5 - F5 - A5 - - -',
  'G5 - F5 - D5 - - - C#5 - - - C5 - A4 -',
);

const A = {
  bars: 8, chords: CHORDS_A, kick: K, snare: S, hat: H, bass: BASS_A, keys: COMP,
  cym: 'C...............' + rep(REST, 7),
  brass: bars(rep(REST, 3), '..........x.X-..', rep(REST, 3), 'X.....x.x.X.f---'),
  fill: FILL,
};

export const TITLE: Song = {
  id: 'title',
  title: 'BEAK RASH! (Main Theme)',
  bpm: 126,
  swing: 0.1,
  key: 'D Dorian',
  lead: 'wah',
  crackle: 0.12,
  sections: {
    intro: {
      bars: 2, chords: 'Dm9 | Dm9', keys: 'X-------....x-..', pad: 'X---------------',
      hat: 'x.x.x.x.x.x.x.x.', cym: REST + 'W...............',
      fill: { kick: 'X.........X.....', snare: '....X.....x.xxXX', tom: '........1.2.3.3.', bass: '1> - - . . . . . 5 . 8^ . 7 . 8^ .' },
    },
    A,
    A2: { ...A, lead: HOOK, clav: CLAV },
    B: {
      bars: 8,
      chords: 'Gm9 | C13 | Fmaj9 | Bbmaj7 | Em7b5 | A7b9 | Dm9 | Bb13 A7#9',
      kick: bars(rep('X.......X..x....', 4), rep(K, 4)),
      snare: bars(rep('....X.......X...', 4), rep(S, 4)),
      hat: bars(rep(REST, 4), rep(H, 4)),
      cym: bars('C...............', rep('R.R.R.R.R.R.R.R.', 3), rep(REST, 3), 'W...............'),
      bass: rep('1> - - . 5 . 8^ . 1 - . 5 7 . 8^ .', 8),
      keys: bars(rep('X-------x-------', 4), rep(COMP, 4)),
      pad: rep('X---------------', 8),
      brass: bars(rep(REST, 4), 'X-------........', 'x.x.X---........', 'X-------........', 'X---x.x.r---f---'),
      lead: BRIDGE,
      fill: { snare: '....X...X.x.XxXX', tom: '........1.2.3...' },
    },
    A3: {
      ...A, lead: HOOK, lead2: transpose(HOOK, -12), clav: CLAV,
      brass: bars('X.......x.X-....', '..........x.X-..', 'X.......x.X-....', '..x.x.X-........', 'X-..x.X-........', 'r-------f---....', 'X.......x.X-....', 'X.....x.x.X.f---'),
      perc: 's.s.T.s.s.s.T.s.',
    },
  },
  form: ['intro', 'A', 'A2', 'B', 'A3'],
  loopFrom: 1,
  notes:
    'D Dorian funk at 126 bpm, 16th swing 0.10. Intro: Rhodes + pad + vinyl crackle, reverse-cymbal swell and tom fill. ' +
    'A (8): Dm9–G13 Dorian vamp ×2, Bbmaj7–A7#9, Dm9, Eb7#11 (tritone sub of A7) turning back to Dm9. Slap bass thumb/pop ' +
    'octaves with dead notes, ghost-note snare, open hat on the & of 4, syncopated Rhodes comp, brass punches on bars 4/8. ' +
    'A2 adds the wah-lead hook (call A–D–F–E–D / answer B–A–G–E–D, climbing to C6, bluesy C over A7#9) + clavinet chops. ' +
    'B (8, bridge): ii–V–I in F (Gm9–C13–Fmaj9–Bbmaj7) then minor ii–V to Dm (Em7b5–A7b9–Dm9) and Bb13–A7#9 turnaround; ' +
    'half-time ride feel for 4 bars, then full groove, lyrical counter-melody, brass swells, rip + fall into A3. ' +
    'A3: hook doubled an octave down, busier brass answers, shaker/tambourine. Loops A→A2→B→A3.',
};
