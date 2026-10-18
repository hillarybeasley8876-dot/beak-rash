// Brass section: two alternating persistent chord voices (5 detuned saws spread left/right, a
// shared "bwah" filter + VCA), so stabs can overlap their release tails without creating nodes.
// Chords with fewer than 5 notes double their top notes an octave down to fill the section.
import { adsr, anchor, filter, holdAt, settle } from '../../dsp/env';
import { midiToHz } from '../theory';
import { osc, type Gate } from './voice';
import type { Band } from '../band';

export type BrassKind = 'hit' | 'fall' | 'rip';

const SLOTS = 5;

const DETUNE = [-9, 7, -4, 10, -11];

interface ChordVoice {
  saws: OscillatorNode[];
  lp: BiquadFilterNode;
  amp: GainNode;
  gate: Gate;
  busyUntil: number;
}

export class Brass {
  private voices: ChordVoice[] = [];
  private next = 0;

  constructor(private b: Band) {
    for (let v = 0; v < 2; v++) this.voices.push(this.makeVoice());
  }

  private makeVoice(): ChordVoice {
    const ctx = this.b.ctx;
    const lp = filter(ctx, { type: 'lowpass', frequency: 400, Q: 1.6 });
    const amp = new GainNode(ctx, { gain: 0 });
    lp.connect(amp);
    const gate = this.b.gate(amp, this.b.input('brass'));
    const sides = [-0.32, 0.32].map((pan) => {
      const p = new StereoPannerNode(ctx, { pan });
      p.connect(lp);
      return p;
    });
    const saws: OscillatorNode[] = [];
    for (let s = 0; s < SLOTS; s++) {
      const o = osc(this.b, 'sawtooth', 220, DETUNE[s] ?? 0);
      o.connect(sides[s % 2] ?? lp);
      saws.push(o);
    }
    return { saws, lp, amp, gate, busyUntil: 0 };
  }

  stab(t: number, midis: number[], dur: number, vel: number, kind: BrassKind = 'hit'): void {
    let v = this.voices[this.next % this.voices.length];
    const other = this.voices[(this.next + 1) % this.voices.length];
    if (v && other && v.busyUntil > t && other.busyUntil <= v.busyUntil) v = other;
    else this.next++;
    if (!v) return;
    const notes = midis.slice(-SLOTS);
    for (let k = notes.length - 1; notes.length < SLOTS && k >= 0; k--) notes.push((notes[k] ?? 60) - 12);
    const rel = kind === 'fall' ? 0.26 : 0.09;
    const off = t + Math.max(dur, 0.05);
    if (v.busyUntil > t) {
      // Re-using a voice that is still releasing: close it just before the new onset.
      anchor(v.amp.gain, t - 0.006);
      v.amp.gain.linearRampToValueAtTime(0, t);
      settle(v.amp.gain, t, 0);
    }
    v.saws.forEach((o, s) => {
      const f = midiToHz(notes[s] ?? 60);
      const p = o.frequency;
      holdAt(p, t);
      // Rip = lip slur up a fourth; normal attacks scoop in from a third of a semitone flat.
      p.setValueAtTime(f * Math.pow(2, (kind === 'rip' ? -5 : -0.35) / 12), t);
      p.exponentialRampToValueAtTime(f, t + (kind === 'rip' ? 0.11 : 0.045));
      if (kind === 'fall') {
        p.setValueAtTime(f, off);
        p.exponentialRampToValueAtTime(f * Math.pow(2, -7 / 12), off + rel);
      }
    });
    const peak = 1700 + 2900 * vel;
    const fr = v.lp.frequency;
    holdAt(fr, t);
    fr.setValueAtTime(380, t);
    fr.exponentialRampToValueAtTime(peak, t + 0.04);
    fr.exponentialRampToValueAtTime(peak * 0.55, t + 0.22);
    v.busyUntil = adsr(v.amp.gain, t, dur, 0.16 * vel, 0.016, 0.16, 0.68, rel, true);
    v.gate.open(v.busyUntil);
  }
}
