// Slap synth bass, one persistent monophonic voice: saw + square through a plucked resonant
// low-pass (bright, growly sustain), a light sine sub, thumb / pop string transients, slides and
// dead (muted) ghost notes. Retriggers ramp from the current level, so legato lines never click.
import { adsr, filter, holdAt, perc } from '../../dsp/env';
import { midiToHz } from '../theory';
import { NoiseVoice, osc } from './voice';
import type { Band } from '../band';

export interface BassNote {
  midi: number;
  dur: number;
  vel: number;
  pop: boolean;     // slap pop: brighter, more resonant
  accent: boolean;  // thumb slap
  slide: boolean;   // slide in from a whole tone below
}

export class SlapBass {
  private oscs: OscillatorNode[];
  private lp: BiquadFilterNode;
  private amp: GainNode;
  private click: NoiseVoice;

  constructor(b: Band) {
    const ctx = b.ctx;
    const saw = osc(b, 'sawtooth');
    const sq = osc(b, 'square', 110, 5);
    const sub = osc(b, 'sine');
    this.oscs = [saw, sq, sub];
    this.lp = filter(ctx, { type: 'lowpass', frequency: 400, Q: 5 });
    this.amp = new GainNode(ctx, { gain: 0 });
    saw.connect(new GainNode(ctx, { gain: 0.5 })).connect(this.lp);
    sq.connect(new GainNode(ctx, { gain: 0.26 })).connect(this.lp);
    sub.connect(new GainNode(ctx, { gain: 0.3 })).connect(this.amp);
    this.lp.connect(this.amp).connect(b.input('bass'));
    this.click = new NoiseVoice(b, [{ type: 'bandpass', frequency: 1250, Q: 1.6 }], b.input('bass'));
  }

  private pitch(t: number, f: number, slide: boolean): void {
    for (const o of this.oscs) {
      holdAt(o.frequency, t);
      if (slide) {
        o.frequency.setValueAtTime(f * Math.pow(2, -2 / 12), t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      } else {
        o.frequency.setValueAtTime(f, t);
      }
    }
  }

  private transient(t: number, freq: number, level: number): void {
    const bp = this.click.filters[0];
    if (bp) {
      holdAt(bp.frequency, t);
      bp.frequency.setValueAtTime(freq, t);
    }
    this.click.hit(t, level, 0.0008, 0.012);
  }

  note(t: number, n: BassNote): void {
    const f = midiToHz(n.midi);
    this.pitch(t, f, n.slide);
    const bright = (n.pop ? 36 : n.accent ? 20 : 12) * (0.6 + 0.4 * n.vel);
    const start = Math.min(9500, f * bright);
    const settle = Math.min(start, f * 3.6 + 280);
    const fr = this.lp.frequency;
    holdAt(fr, t);
    fr.setValueAtTime(start, t);
    fr.exponentialRampToValueAtTime(settle, t + (n.pop ? 0.2 : 0.13));
    holdAt(this.lp.Q, t);
    this.lp.Q.setValueAtTime(n.pop ? 9 : 6, t);
    const level = 0.42 * n.vel * (n.accent ? 1.12 : 1) * (n.pop ? 1.08 : 1);
    adsr(this.amp.gain, t, n.dur, level, 0.002, 0.24, 0.55, 0.045, true);
    if (n.pop) this.transient(t, 2700, 0.3 * n.vel);
    else if (n.accent) this.transient(t, 1400, 0.2 * n.vel);
  }

  /** Muted ghost note: percussive "tk" with a hint of pitch. */
  dead(t: number, midi: number, vel: number): void {
    this.pitch(t, midiToHz(midi), false);
    const fr = this.lp.frequency;
    holdAt(fr, t);
    fr.setValueAtTime(1400, t);
    fr.exponentialRampToValueAtTime(300, t + 0.03);
    perc(this.amp.gain, t, 0.2 * vel, 0.001, 0.035, true);
    this.transient(t, 900, 0.1 * vel);
  }
}
