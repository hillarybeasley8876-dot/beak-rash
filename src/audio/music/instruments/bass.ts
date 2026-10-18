// Slap synth bass, one persistent monophonic voice: saw + square (+ a light sine sub, one mixed
// wave) through a plucked resonant low-pass (bright, growly sustain), thumb / pop string
// transients, slides and dead (muted) ghost notes. Retriggers ramp from the current level, so
// legato lines never click.
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

export class SlapBass {
  private oscs: OscillatorNode[];
  private lp: BiquadFilterNode;
  private amp: GainNode;
  private gate: Gate;
  private input: AudioNode;
  private turn = 0;

  constructor(private b: Band) {
    const ctx = b.ctx;
    // The sub rides through the low-pass too (its cutoff stays above the fundamental). The layers
    // now add in phase (they were 5 cents apart), so saw / square sit lower for the same loudness.
    const tone = osc(b, 'sine');
    tone.setPeriodicWave(mixWave(ctx, { saw: 0.33, square: 0.17, sine: 0.3 }));
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
        o.frequency.setValueAtTime(f * Math.pow(2, -2 / 12), t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      } else {
        o.frequency.setValueAtTime(f, t);
      }
    }
  }

  /** String noise: band-passed bursts rendered once (pop 2.7 kHz, thumb 1.4 kHz, dead note 0.9 kHz). */
  private transient(t: number, kind: DrumSample, level: number): void {
    playSample(this.b.ctx, kind, this.turn++, t, level, this.input);
  }

  note(t: number, n: BassNote): void {
    const f = midiToHz(n.midi);
    this.pitch(t, f, n.slide);
    const bright = (n.pop ? 36 : n.accent ? 20 : 12) * (0.6 + 0.4 * n.vel);
    const start = Math.min(9500, f * bright);
    // Growl: the settled cutoff also lifts the 1 kHz string bite (no separate EQ stage).
    const settle = Math.min(start, f * 4.4 + 420);
    const fr = this.lp.frequency;
    holdAt(fr, t);
    fr.setValueAtTime(start, t);
    fr.exponentialRampToValueAtTime(settle, t + (n.pop ? 0.2 : 0.13));
    holdAt(this.lp.Q, t);
    this.lp.Q.setValueAtTime(n.pop ? 9 : 6, t);
    const level = 0.42 * n.vel * (n.accent ? 1.12 : 1) * (n.pop ? 1.08 : 1);
    this.gate.open(adsr(this.amp.gain, t, n.dur, level, 0.002, 0.24, 0.55, 0.045, true));
    if (n.pop) this.transient(t, 'slapPop', 0.3 * n.vel);
    else if (n.accent) this.transient(t, 'slapThumb', 0.2 * n.vel);
  }

  /** Muted ghost note: percussive "tk" with a hint of pitch. */
  dead(t: number, midi: number, vel: number): void {
    this.pitch(t, midiToHz(midi), false);
    const fr = this.lp.frequency;
    holdAt(fr, t);
    fr.setValueAtTime(1400, t);
    fr.exponentialRampToValueAtTime(300, t + 0.03);
    this.gate.open(perc(this.amp.gain, t, 0.2 * vel, 0.001, 0.035, true));
    this.transient(t, 'slapDead', 0.1 * vel);
  }
}
