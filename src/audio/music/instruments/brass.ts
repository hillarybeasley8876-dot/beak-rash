// Brass section: persistent chord voices (a detuned saw per voicing note into a shared "bwah"
// filter + VCA, asleep between stabs); a stab arriving during the previous one's release closes it
// in the 6 ms before its onset. Chords with fewer than 4 notes double their top notes an octave
// down. (A pre-rendered version measured no cheaper on the audio thread: the voices sleep.)
import { adsr, anchor, filter, holdAt, settle } from '../../dsp/env';
import { midiToHz } from '../theory';
import { osc, type Gate } from './voice';
import type { Band } from '../band';

export type BrassKind = 'hit' | 'fall' | 'rip';

const BRASS_SLOTS = 4;
/** Detune (cents) of each voicing slot's saw. */
const BRASS_DETUNE = [-9, 7, -4, 10];

/** The four voicing notes: the top of `midis`, short chords doubled downwards. */
function brassVoicing(midis: number[]): number[] {
  const notes = midis.slice(-BRASS_SLOTS);
  for (let k = notes.length - 1; notes.length < BRASS_SLOTS && k >= 0; k--) notes.push((notes[k] ?? 60) - 12);
  return notes;
}

const brassRelease = (kind: BrassKind): number => (kind === 'fall' ? 0.26 : 0.09);

/** Pitch of one saw: rip = lip slur up a fourth, otherwise a scoop from a third of a semitone flat; a fall drops a fifth after note-off. */
function brassPitch(p: AudioParam, t: number, f: number, kind: BrassKind, off: number): void {
  holdAt(p, t);
  p.setValueAtTime(f * Math.pow(2, (kind === 'rip' ? -5 : -0.35) / 12), t);
  p.exponentialRampToValueAtTime(f, t + (kind === 'rip' ? 0.11 : 0.045));
  if (kind !== 'fall') return;
  p.setValueAtTime(f, off);
  p.exponentialRampToValueAtTime(f * Math.pow(2, -7 / 12), off + brassRelease(kind));
}

/** The "bwah": the low-pass opens to a velocity peak in 40 ms, then settles to 55 %. */
function brassFilter(fr: AudioParam, t: number, vel: number): void {
  const peak = 1700 + 2900 * vel;
  holdAt(fr, t);
  fr.setValueAtTime(380, t);
  fr.exponentialRampToValueAtTime(peak, t + 0.04);
  fr.exponentialRampToValueAtTime(peak * 0.55, t + 0.22);
}

/** The section's envelope; returns when the note has died away. */
function brassAmp(g: AudioParam, t: number, dur: number, vel: number, kind: BrassKind): number {
  // 0.126: the mono 4-saw section matches the loudness of the former 5-saw stereo spread.
  return adsr(g, t, dur, 0.126 * vel, 0.016, 0.16, 0.68, brassRelease(kind), true);
}

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
    this.voices.push(this.makeVoice());
  }

  private makeVoice(): ChordVoice {
    const ctx = this.b.ctx;
    const lp = filter(ctx, { type: 'lowpass', frequency: 400, Q: 1.6 });
    const amp = new GainNode(ctx, { gain: 0 });
    lp.connect(amp);
    const gate = this.b.gate(amp, this.b.input('brass'));
    const saws: OscillatorNode[] = [];
    for (let s = 0; s < BRASS_SLOTS; s++) {
      const o = osc(this.b, 'sawtooth', 220, BRASS_DETUNE[s] ?? 0);
      o.connect(lp);
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
    const notes = brassVoicing(midis);
    const off = t + Math.max(dur, 0.05);
    if (v.busyUntil > t) {
      // Re-using a voice that is still releasing: close it just before the new onset.
      anchor(v.amp.gain, t - 0.006);
      v.amp.gain.linearRampToValueAtTime(0, t);
      settle(v.amp.gain, t, 0);
    }
    v.saws.forEach((o, s) => brassPitch(o.frequency, t, midiToHz(notes[s] ?? 60), kind, off));
    brassFilter(v.lp.frequency, t, vel);
    v.busyUntil = brassAmp(v.amp.gain, t, dur, vel, kind);
    v.gate.open(v.busyUntil);
  }
}
