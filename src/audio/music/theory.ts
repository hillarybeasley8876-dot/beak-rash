// Music theory helpers: note names, chord symbols (jazz qualities incl. 9/11/13, altered and
// tritone-sub dominants), voicings with smooth voice leading, bass degrees relative to a chord.

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#' / 'Db' / 'F' → pitch class 0..11. */
export function pitchClass(name: string): number {
  const letter = LETTER[name.charAt(0).toUpperCase()];
  if (letter === undefined) throw new Error(`[audio] bad note "${name}"`);
  let pc = letter;
  for (const ch of name.slice(1)) {
    if (ch === '#') pc++;
    else if (ch === 'b') pc--;
  }
  return (pc + 12) % 12;
}

/** 'A4' → 69, 'Bb2' → 46, 'C#5' → 73. */
export function noteToMidi(name: string): number {
  const m = /^([A-Ga-g][#b]*)(-?\d)$/.exec(name);
  if (!m || m[1] === undefined || m[2] === undefined) throw new Error(`[audio] bad note "${name}"`);
  const letter = LETTER[m[1].charAt(0).toUpperCase()] ?? 0;
  let acc = 0;
  for (const ch of m[1].slice(1)) acc += ch === '#' ? 1 : -1;
  return (Number(m[2]) + 1) * 12 + letter + acc;
}

interface Quality { third: number; fifth: number; seventh: number; voicing: number[] }

// Voicing = the colour tones a comping instrument plays (rootless where idiomatic); the bass
// supplies the root. Intervals in semitones above the root.
const QUALITIES: Record<string, Quality> = {
  '': { third: 4, fifth: 7, seventh: 11, voicing: [0, 4, 7, 12] },
  m: { third: 3, fifth: 7, seventh: 10, voicing: [0, 3, 7, 12] },
  maj7: { third: 4, fifth: 7, seventh: 11, voicing: [4, 7, 11, 14] },
  maj9: { third: 4, fifth: 7, seventh: 11, voicing: [4, 11, 14, 19] },
  'maj7#11': { third: 4, fifth: 7, seventh: 11, voicing: [4, 11, 14, 18] },
  '6/9': { third: 4, fifth: 7, seventh: 9, voicing: [4, 9, 14, 19] },
  6: { third: 4, fifth: 7, seventh: 9, voicing: [4, 7, 9, 14] },
  m6: { third: 3, fifth: 7, seventh: 9, voicing: [3, 7, 9, 14] },
  m7: { third: 3, fifth: 7, seventh: 10, voicing: [3, 7, 10, 14] },
  m9: { third: 3, fifth: 7, seventh: 10, voicing: [3, 10, 14, 19] },
  m11: { third: 3, fifth: 7, seventh: 10, voicing: [3, 10, 14, 17] },
  mmaj7: { third: 3, fifth: 7, seventh: 11, voicing: [3, 7, 11, 14] },
  7: { third: 4, fifth: 7, seventh: 10, voicing: [4, 7, 10, 14] },
  9: { third: 4, fifth: 7, seventh: 10, voicing: [4, 10, 14, 19] },
  13: { third: 4, fifth: 7, seventh: 10, voicing: [4, 10, 14, 21] },
  '7#9': { third: 4, fifth: 7, seventh: 10, voicing: [4, 10, 15, 19] },
  '7b9': { third: 4, fifth: 7, seventh: 10, voicing: [4, 10, 13, 19] },
  '7#11': { third: 4, fifth: 7, seventh: 10, voicing: [4, 10, 14, 18] },
  '7alt': { third: 4, fifth: 8, seventh: 10, voicing: [4, 10, 15, 20] },
  '13b9': { third: 4, fifth: 7, seventh: 10, voicing: [4, 10, 13, 21] },
  '9sus': { third: 5, fifth: 7, seventh: 10, voicing: [5, 10, 14, 19] },
  m7b5: { third: 3, fifth: 6, seventh: 10, voicing: [3, 6, 10, 14] },
  dim7: { third: 3, fifth: 6, seventh: 9, voicing: [3, 6, 9, 12] },
};

export interface Chord {
  symbol: string;
  root: number;        // pitch class
  bass: number;        // pitch class (slash chords)
  q: Quality;
  /** Absolute pitch classes of the voicing tones. */
  pcs: number[];
}

export function parseChord(symbol: string): Chord {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol);
  if (!m || m[1] === undefined) throw new Error(`[audio] bad chord "${symbol}"`);
  const q = QUALITIES[m[2] ?? ''];
  if (!q) throw new Error(`[audio] unknown chord quality in "${symbol}"`);
  const root = pitchClass(m[1]);
  return { symbol, root, bass: m[3] ? pitchClass(m[3]) : root, q, pcs: q.voicing.map((i) => (root + i) % 12) };
}

/**
 * Place a chord's voicing near `center` (midi), moving as little as possible from `prev`.
 * `drop2` opens the voicing (second-highest note down an octave) for a wider section sound.
 */
export function voiceChord(chord: Chord, center: number, prev: number[] | null, drop2 = false): number[] {
  const pcs = chord.pcs;
  let best: number[] = [];
  let bestScore = Infinity;
  for (let rot = 0; rot < pcs.length; rot++) {
    for (let base = center - 12; base <= center + 5; base++) {
      if (((base % 12) + 12) % 12 !== pcs[rot]) continue;
      const notes = [base];
      for (let k = 1; k < pcs.length; k++) {
        const pc = pcs[(rot + k) % pcs.length] ?? 0;
        let n = (notes[k - 1] ?? base) + 1;
        while (((n % 12) + 12) % 12 !== pc) n++;
        notes.push(n);
      }
      if (drop2 && notes.length >= 3) {
        const i = notes.length - 2;
        notes[i] = (notes[i] ?? 0) - 12;
        notes.sort((a, b) => a - b);
      }
      const mean = notes.reduce((s, n) => s + n, 0) / notes.length;
      let score = Math.abs(mean - center) * 0.6;
      if (prev && prev.length === notes.length) {
        for (let k = 0; k < notes.length; k++) score += Math.abs((notes[k] ?? 0) - (prev[k] ?? 0));
      }
      if (score < bestScore) {
        bestScore = score;
        best = notes;
      }
    }
  }
  return best;
}

const DEGREES: Record<string, number> = {
  1: 0, b2: 1, 2: 2, b3: 3, M3: 4, 4: 5, '#4': 6, b5: 6, '#5': 8, b6: 8, 6: 9, b7: 10, M7: 11,
  8: 12, b9: 13, 9: 14, '#9': 15, 10: 16, 11: 17, '#11': 18, b13: 20, 13: 21,
};

/**
 * Semitone offset of a degree above the chord root. Plain 3 / 5 / 7 follow the chord quality
 * (Dm7: 3 = F, Cmaj7: 7 = B); b3, M3, b7, M7 … force the interval. Returns null if unknown.
 */
export function degreeOffset(degree: string, chord: Chord): number | null {
  if (degree === '3') return chord.q.third;
  if (degree === '5') return chord.q.fifth;
  if (degree === '7') return chord.q.seventh;
  const v = DEGREES[degree];
  return v === undefined ? null : v;
}

export type Mode = 'major' | 'minor' | 'dorian';

export interface Tonality {
  /** Tonic pitch class 0..11. */
  tonic: number;
  mode: Mode;
}

/** 'A major' / 'C minor' / 'D Dorian' → tonic pitch class + mode (stingers are built in the song's key). */
export function parseKey(key: string): Tonality {
  const m = /^([A-G][#b]?)\s+(major|minor|dorian)\b/i.exec(key.trim());
  if (!m || m[1] === undefined || m[2] === undefined) throw new Error(`[audio] bad key "${key}"`);
  return { tonic: pitchClass(m[1]), mode: m[2].toLowerCase() as Mode };
}
