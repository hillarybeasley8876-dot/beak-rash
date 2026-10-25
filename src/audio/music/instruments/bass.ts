// Slap synth bass, one persistent monophonic voice: saw + square (+ a light sine sub, one mixed
// wave) through a plucked resonant low-pass (bright, growly sustain), thumb / pop string
// transients, slides and dead (muted) ghost notes. Retriggers ramp from the current level, so
// legato lines never click. The per-note shapes are shared with the note bank the sampled bass
// plays from (bass-sampler.ts); this voice covers the time before the bank exists.
import { mixWave } from '../../dsp/curves';
import { adsr, filter, holdAt, perc } from '../../dsp/env';
import { midiToHz } from '../theory';
import { playSample, type DrumSample } from './drum-samples';
import { osc, type Gate } from './voice';
import type { Band } from '../band';

export interface BassNote {
  midi: number;
  dur: number;
  vel: number;
  pop: boolean;     // slap pop: brighter, more resonant
  accent: boolean;  // thumb slap
  slide: boolean;   // slide in from a whole tone below
}

/** The tone: the layers add in phase (they were 5 cents apart), so saw / square sit lower for the same loudness. */
export const bassWave = (ctx: BaseAudioContext): PeriodicWave => mixWave(ctx, { saw: 0.33, square: 0.17, sine: 0.3 });
export const BASS_RELEASE = 0.045;
/** Slides come up from this many semitones below over BASS_SLIDE s. */
export const BASS_SLIDE_FROM = -2;
export const BASS_SLIDE = 0.07;

/** Pluck: the cutoff starts bright (pops brightest) and settles to a growl that keeps the 1 kHz string bite. */
export function bassFilter(fr: AudioParam, q: AudioParam, t: number, n: BassNote): void {
  const f = midiToHz(n.midi);
  const bright = (n.pop ? 36 : n.accent ? 20 : 12) * (0.6 + 0.4 * n.vel);
  const start = Math.min(9500, f * bright);
  holdAt(fr, t);
  fr.setValueAtTime(start, t);
  fr.exponentialRampToValueAtTime(Math.min(start, f * 3 + 170), t + (n.pop ? 0.2 : 0.13));
  holdAt(q, t);
  q.setValueAtTime(n.pop ? 7 : 3.5, t);
}

/** The note's envelope; returns when it has died away. */
export function bassAmp(g: AudioParam, t: number, n: BassNote): number {
  const level = 0.42 * n.vel * (n.accent ? 1.12 : 1) * (n.pop ? 1.08 : 1);
  return adsr(g, t, n.dur, level, 0.002, 0.24, 0.55, BASS_RELEASE, true);
}

/** String noise played with a note (rendered samples: pop 2.7 kHz, thumb 1.4 kHz). */
export function bassTransient(n: BassNote): [DrumSample, number] | null {
  if (n.pop) return ['slapPop', 0.3 * n.vel];
  if (n.accent) return ['slapThumb', 0.2 * n.vel];
  return null;
}

/** Dead (muted) ghost note: a 30 ms filter snap and a short click. */
export function bassDead(fr: AudioParam, g: AudioParam, t: number, vel: number): number {
  holdAt(fr, t);
  fr.setValueAtTime(1400, t);
  fr.exponentialRampToValueAtTime(300, t + 0.03);
  return perc(g, t, 0.2 * vel, 0.001, 0.035, true);
}

export class SlapBass {
  private oscs: OscillatorNode[];
  private lp: BiquadFilterNode;
  private amp: GainNode;
  private gate: Gate;
  private input: AudioNode;
  private turn = 0;

  constructor(private b: Band) {
    const ctx = b.ctx;
    // The sub rides through the low-pass too (its cutoff stays above the fundamental).
    const tone = osc(b, bassWave(ctx));
    this.oscs = [tone];
    this.lp = filter(ctx, { type: 'lowpass', frequency: 400, Q: 5 });
    this.amp = new GainNode(ctx, { gain: 0 });
    tone.connect(this.lp).connect(this.amp);
    this.input = b.input('bass');
    this.gate = b.gate(this.amp, this.input);
  }

  private pitch(t: number, f: number, slide: boolean): void {
    for (const o of this.oscs) {
      holdAt(o.frequency, t);
      if (slide) {
        o.frequency.setValueAtTime(f * Math.pow(2, BASS_SLIDE_FROM / 12), t);
        o.frequency.exponentialRampToValueAtTime(f, t + BASS_SLIDE);
      } else {
        o.frequency.setValueAtTime(f, t);
      }
    }
  }

  note(t: number, n: BassNote): void {
    this.pitch(t, midiToHz(n.midi), n.slide);
    bassFilter(this.lp.frequency, this.lp.Q, t, n);
    this.gate.open(bassAmp(this.amp.gain, t, n));
    const click = bassTransient(n);
    if (click) playSample(this.b.ctx, click[0], this.turn++, t, click[1], this.input);
  }

  /** Muted ghost note: percussive "tk" with a hint of pitch. */
  dead(t: number, midi: number, vel: number): void {
    this.pitch(t, midiToHz(midi), false);
    this.gate.open(bassDead(this.lp.frequency, this.amp.gain, t, vel));
    playSample(this.b.ctx, 'slapDead', this.turn++, t, 0.1 * vel, this.input);
  }
}
