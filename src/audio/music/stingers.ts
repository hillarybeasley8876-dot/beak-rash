// Stingers: short composed phrases over (and ducking) the current song, built in the song's key
// (tonic + mode) so they never fight it. The Conductor lands them on the song's grid.
import { voiceChord, type Chord, type Mode, type Tonality } from './theory';
import { filter, perc } from '../dsp/env';
import type { Band } from './band';

export type StingerId = 'count' | 'go' | 'ko' | 'showtime' | 'busted' | 'finish' | 'wrecked' | 'onemore';

export interface StingCtx {
  key: Tonality;
  /** GO: the chord the song lands on (bar 1 of section A), so the hit doubles it. */
  chord?: Chord;
}

type Sting = (b: Band, t: number, c: StingCtx) => number;

/** How each stinger meets the song: grid in 16ths (0 = immediately) and whether it ducks the music. */
export const STING_TIMING: Record<StingerId, { grid: number; duck: boolean }> = {
  count: { grid: 0, duck: false }, go: { grid: 0, duck: false },
  ko: { grid: 2, duck: true }, wrecked: { grid: 2, duck: true }, onemore: { grid: 2, duck: true },
  showtime: { grid: 4, duck: true }, finish: { grid: 4, duck: true }, busted: { grid: 4, duck: true },
};

export const isStinger = (id: string): id is StingerId => id in STING_TIMING;

/** Tonic triad quality per mode: major third or minor third. */
const third = (m: Mode): number => (m === 'major' ? 4 : 3);

/** Lowest midi note ≥ `low` whose pitch class is `semis` above the tonic. */
const pc = (k: Tonality, semis: number, low: number): number => low + ((((k.tonic + semis - low) % 12) + 12) % 12);

/** The mode's tonic colour chord, open five-note voicing: 6/9 in major, m9 in minor / dorian. */
function tonicChord(k: Tonality, low = 52): number[] {
  const r = pc(k, 0, low);
  return (k.mode === 'major' ? [0, 7, 16, 21, 26] : [0, 7, 15, 22, 26]).map((s) => r + s);
}

/** Triad on the degree `root` semitones above the tonic (close position from `low`). */
function triad(k: Tonality, root: number, minor = false, low = 64): number[] {
  const r = pc(k, root, low);
  return [r, r + (minor ? 3 : 4), r + 7];
}

/** Power chord + the mode's third an octave up (no colour tones: safe over any chord of the key). */
function power(k: Tonality, low = 50): number[] {
  const r = pc(k, 0, low);
  return [r, r + 7, r + 12, r + 12 + third(k.mode), r + 19];
}

function beep(b: Band, t: number, freq: number, dur: number, level: number): void {
  const ctx = b.ctx;
  const sq = new OscillatorNode(ctx, { type: 'square', frequency: freq });
  const sine = new OscillatorNode(ctx, { type: 'sine', frequency: freq / 2 });
  const lp = filter(ctx, { type: 'lowpass', frequency: 3800, Q: 0.7 });
  const g = new GainNode(ctx, { gain: 0 });
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.004);
  g.gain.setValueAtTime(level, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.004);
  sq.connect(lp).connect(g);
  sine.connect(g);
  g.connect(b.input('fx'));
  for (const o of [sq, sine]) {
    o.start(t);
    o.stop(t + dur + 0.01);
  }
}

function boom(b: Band, t: number, level: number, dur = 1.1): void {
  const ctx = b.ctx;
  const o = new OscillatorNode(ctx, { type: 'sine', frequency: 70 });
  o.frequency.setValueAtTime(78, t);
  o.frequency.exponentialRampToValueAtTime(30, t + dur);
  const g = new GainNode(ctx, { gain: 0 });
  const end = perc(g.gain, t, level, 0.004, dur);
  o.connect(g).connect(b.input('fx'));
  o.start(t);
  o.stop(end);
}

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Velocity for the short cue stingers that must clear a full race mix (≈ +6 dB, brighter brass). */
const LOUD = 2;

/** Brass voicing of a song chord near the stinger register (GO doubles the song's downbeat). */
const songChord = (chord: Chord): number[] => voiceChord(chord, 66, null, true);

export const STINGERS: Record<StingerId, Sting> = {
  count(b, t, { key }) {
    // The key's fifth, no drums: the race song is holding a drumless vamp under the countdown.
    beep(b, t, hz(pc(key, 7, 74)), 0.16, 0.3);
    return 0.2;
  },
  go(b, t, { key, chord }) {
    // The race song's section A lands on the same downbeat with its own crash.
    beep(b, t, hz(pc(key, 0, 84)), 0.45, 0.26);
    b.brass.stab(t, chord ? songChord(chord) : tonicChord(key), 0.5, 1, 'fall');
    if (!chord) b.drums.crash(t, 0.8);
    return 0.9;
  },
  ko(b, t, { key }) {
    // Tonic power stab → fall; no kick / boom: the KO impact sfx owns the sub.
    b.drums.crash(t, 1);
    b.brass.stab(t, power(key), 0.09, 1);
    b.brass.stab(t + 0.14, tonicChord(key), 0.5, 1, 'fall');
    b.drums.tom(t + 0.14, 0.8, 2);
    return 1.2;
  },
  showtime(b, t, { key }) {
    b.drums.swell(t, 0.42, 0.9);
    const step = 0.105;
    [1, 1, 2, 2, 3, 3].forEach((which, i) => b.drums.tom(t + i * step * 0.66, 0.8, which as 1 | 2 | 3));
    // Rising rips into the tonic: IV–V–I in major, bVI–bVII–i in minor / dorian.
    const f = pc(key, key.mode === 'major' ? 5 : 8, 58);
    b.brass.stab(t, [f, f + 4, f + 7], 0.08, 1, 'rip');
    b.brass.stab(t + step, [f + 2, f + 6, f + 9], 0.08, 1);
    b.brass.stab(t + step * 2, [f + 6, f + 9, f + 14], 0.08, 1);
    const big = t + step * 4;
    b.brass.stab(big, tonicChord(key, f - (key.mode === 'major' ? 5 : 8)), 0.85, 1, 'fall');
    b.lead('synth').note(big, pc(key, 7, 76), 0.85, 1, true);
    b.drums.crash(big, 1);
    b.drums.kick(big, 1);
    boom(b, big, 0.5, 0.8);
    return big - t + 1.2;
  },
  busted(b, t, { key }) {
    // Sad-trombone wah sliding down onto the tonic.
    [3, 2, 1, 0].forEach((s, i) => b.lead('wah').note(t + i * 0.32, pc(key, s, 52), i === 3 ? 1.1 : 0.26, LOUD, false));
    b.drums.snare(t + 0.96, 0.8);
    return 2.3;
  },
  finish(b, t, { key }) {
    const beat = 0.24;
    [1, 1, 2, 3].forEach((which, i) => b.drums.tom(t + i * beat * 0.25, 0.85, which as 1 | 2 | 3));
    // bVI – bVII – I: the victory cadence works in every mode.
    b.brass.stab(t + beat, triad(key, 8, false, 58), 0.2, LOUD);
    b.brass.stab(t + beat * 2, triad(key, 10, false, 58), 0.2, LOUD);
    const big = t + beat * 3;
    b.brass.stab(big, tonicChord(key), 1.4, LOUD, 'fall');
    b.lead('synth').note(big, pc(key, 0, 81), 1.3, LOUD, true);
    b.drums.crash(big, 1);
    b.drums.kick(big, 1);
    b.drums.swell(t, beat * 3, 0.6);
    return big - t + 1.8;
  },
  wrecked(b, t, { key }) {
    b.brass.stab(t, power(key, 46), 0.12, 0.9, 'fall');
    b.drums.tom(t, 0.9, 3);
    return 0.8;
  },
  onemore(b, t, { key }) {
    // Pickup into the tonic: V–I in major, bVII–i in minor / dorian (both diatonic).
    b.brass.stab(t, triad(key, key.mode === 'major' ? 7 : 10, false, 62), 0.06, LOUD);
    b.brass.stab(t + 0.12, triad(key, 0, key.mode !== 'major', 62), 0.22, LOUD, 'rip');
    b.drums.clap(t + 0.12, 1);
    return 0.5;
  },
};
