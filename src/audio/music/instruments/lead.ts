// Lead voices, each one persistent and monophonic (like a real mono synth): wah synth (saw +
// square layer through an envelope band-pass), square synth (low-pass) and a breathy FM-free flute
// (three sine partials + band-passed breath). Delayed vibrato from the band's shared LFO. An
// octave-down double (lead2 shadowing the hook) is one extra oscillator inside the same voice.
// 'pluck' is the Chinese string: slot 0 is a struck zheng (a modal burst: bright attack, fast
// decay, re-struck for every note), slot 1 the bowed erhu (a sustained tone that slides into the
// next note). Both are built per note — a string rings, it does not keep a running oscillator.
import { layerWave } from '../../dsp/curves';
import { adsr, anchor, filter, holdAt, perc, settle } from '../../dsp/env';
import { midiToHz } from '../theory';
import { NoiseVoice, osc, type Gate } from './voice';
import type { Band } from '../band';
import type { LeadVoice } from '../types';

const FLUTE_PARTIALS: Array<[number, number]> = [[1, 1], [2, 0.3], [3, 0.12]];
/** The struck string: [ratio, level, decay (s)] — a bright attack partial over a fast-decaying body. */
const ZHENG_PARTIALS: Array<[number, number, number]> = [[1, 1, 0.5], [2, 0.5, 0.34], [3.01, 0.3, 0.22], [4.03, 0.22, 0.05]];
/** The bowed string: [ratio, level, decay] — the fundamental saw carries the bow noise. */
const BOWED_PARTIALS: Array<[number, number, number]> = [[1, 1, 1], [2, 0.34, 1], [3, 0.16, 1]];

interface Sub { o: OscillatorNode; level: GainNode; gate: Gate }

/** Legato glide: a note starting while the last one still sounds slides from its pitch (≤ a fifth away). */
const GLIDE = 0.035;
const GLIDE_MAX = 7;

export class Lead {
  private oscs: Array<{ o: OscillatorNode; mul: number }> = [];
  private amp: GainNode;
  private vib: GainNode;
  private filt: BiquadFilterNode | null = null;
  private breath: NoiseVoice | null = null;
  private gate: Gate;
  private sub: Sub | null = null;
  private lastMidi = 0;
  private lastEnd = -Infinity;

  constructor(private b: Band, readonly voice: LeadVoice, readonly slot = 0, private readonly dest: AudioNode = b.input('lead')) {
    const ctx = b.ctx;
    this.amp = new GainNode(ctx, { gain: 0 });
    this.gate = b.gate(this.amp, dest);
    this.vib = new GainNode(ctx, { gain: 0 });
    b.lfo(voice === 'flute' ? 5.1 : 5.6).connect(this.vib);
    if (voice === 'pluck') return;   // a string is built per note, not kept running
    if (voice === 'flute') {
      for (const [mul, level] of FLUTE_PARTIALS) {
        const o = osc(b, 'sine');
        o.connect(new GainNode(ctx, { gain: level })).connect(this.amp);
        this.oscs.push({ o, mul });
      }
      this.breath = new NoiseVoice(b, [{ type: 'bandpass', frequency: 1200, Q: 3 }], this.amp);
    } else {
      this.filt = filter(ctx, voice === 'wah' ? { type: 'bandpass', frequency: 1000, Q: 2.2 } : { type: 'lowpass', frequency: 2300, Q: 2.5 });
      this.filt.connect(this.amp);
      // Saw + square as one oscillator with the pair's long-term spectrum (see layerWave).
      const o = osc(b, layerWave(ctx, 1, 1), 220);
      o.connect(this.filt);
      this.oscs.push({ o, mul: 1 });
    }
    for (const { o } of this.oscs) {
      // Vibrato is 5–6 Hz: one value per 128-frame block is plenty and keeps the oscillator fast.
      o.detune.automationRate = 'k-rate';
      this.vib.connect(o.detune);
    }
  }

  /** The note before this voice existed (a bar render continuing a phrase): legato glides from it. */
  follow(midi: number, end: number): void {
    this.lastMidi = midi;
    this.lastEnd = end;
  }

  /** The octave-down oscillator, built on the first doubled note (same wave, vibrato and filter). */
  private subOsc(): Sub {
    if (this.sub) return this.sub;
    const o = osc(this.b, this.voice === 'flute' ? 'sine' : layerWave(this.b.ctx, 1, 1), 110);
    o.detune.automationRate = 'k-rate';
    this.vib.connect(o.detune);
    const level = new GainNode(this.b.ctx, { gain: 0 });
    o.connect(level);
    return (this.sub = { o, level, gate: this.b.gate(level, this.filt ?? this.amp) });
  }

  /** `double` = level of an octave-down double relative to the note (0 = none). */
  note(t: number, midi: number, dur: number, vel: number, scoop: boolean, double = 0): void {
    if (this.voice === 'pluck') {
      this.pluck(t, midi, dur, vel, scoop);
      return;
    }
    const f = midiToHz(midi);
    this.b.underLead(t, dur);
    const sub = double > 0 ? this.subOsc() : this.sub;
    const pitches: Array<[OscillatorNode, number]> = this.oscs.map(({ o, mul }) => [o, f * mul]);
    if (sub && double > 0) pitches.push([sub.o, f / 2]);
    const glide = !scoop && t < this.lastEnd + 0.06 && Math.abs(midi - this.lastMidi) <= GLIDE_MAX && midi !== this.lastMidi;
    const from = scoop ? Math.pow(2, -1.5 / 12) : glide ? Math.pow(2, (this.lastMidi - midi) / 12) : 1;
    for (const [o, target] of pitches) {
      const p = o.frequency;
      holdAt(p, t);
      p.setValueAtTime(target * from, t);
      if (from !== 1) p.exponentialRampToValueAtTime(target, t + (scoop ? 0.07 : GLIDE));
    }
    this.lastMidi = midi;
    this.lastEnd = t + dur;
    if (sub) {
      // 5 ms level move: the shared VCA may still be releasing the previous note.
      holdAt(sub.level.gain, t);
      sub.level.gain.linearRampToValueAtTime(double, t + 0.005);
      if (double > 0) sub.gate.open(t + dur + 0.3);
    }
    this.vibrato(t, dur);
    if (this.breath) {
      const bp = this.breath.filters[0];
      if (bp) {
        holdAt(bp.frequency, t);
        bp.frequency.setValueAtTime(f * 2, t);
      }
      const g = this.breath.vca.gain;
      const hold = t + Math.max(0.12, dur);
      anchor(g, t);
      g.linearRampToValueAtTime(0.5 * vel, t + 0.02);
      g.exponentialRampToValueAtTime(0.09 * vel, t + 0.12);
      g.linearRampToValueAtTime(0.09 * vel, hold);
      g.linearRampToValueAtTime(0, hold + 0.1);
      settle(g, hold + 0.1, 0);
      this.breath.wake(hold + 0.1);
      this.gate.open(adsr(this.amp.gain, t, dur, 0.145 * vel, 0.035, 0.12, 0.82, 0.11, true));
      return;
    }
    const fr = this.filt?.frequency;
    if (fr) {
      holdAt(fr, t);
      if (this.voice === 'wah') {
        fr.setValueAtTime(420, t);
        fr.exponentialRampToValueAtTime(2500 + 800 * vel, t + 0.075);
        fr.exponentialRampToValueAtTime(1700, t + 0.32);
      } else {
        fr.setValueAtTime(5200, t);
        fr.exponentialRampToValueAtTime(2300, t + 0.25);
      }
    }
    // Levels matched per voice: each sits ≈ −5 LU under a full race mix (audio-check stems).
    this.gate.open(adsr(this.amp.gain, t, dur, (this.voice === 'wah' ? 0.3 : 0.105) * vel, 0.006, 0.2, 0.72, 0.08, true));
  }

  /**
   * A note on the Chinese string. Slot 0 is the struck zheng: a modal burst (a bright attack
   * partial over a body that decays in half a second), re-struck for every note. Slot 1 is the
   * bowed erhu: a sustained tone that slides into the next note and carries a delayed vibrato.
   */
  private pluck(t: number, midi: number, dur: number, vel: number, scoop: boolean): void {
    const ctx = this.b.ctx;
    const f = midiToHz(midi);
    const bowed = this.slot === 1;
    this.b.underLead(t, dur);
    const out = new GainNode(ctx, { gain: 1 });
    out.connect(this.dest);
    // The bowed line slides into the next note; the zheng is re-struck (no glide).
    const glide = bowed && !scoop && t < this.lastEnd + 0.06 && Math.abs(midi - this.lastMidi) <= GLIDE_MAX && midi !== this.lastMidi;
    const from = scoop ? Math.pow(2, -1.5 / 12) : glide ? Math.pow(2, (this.lastMidi - midi) / 12) : 1;
    const partials = bowed ? BOWED_PARTIALS : ZHENG_PARTIALS;
    partials.forEach(([ratio, level, decay], k) => {
      const target = f * ratio;
      const o = new OscillatorNode(ctx, { type: bowed ? (ratio === 1 ? 'sawtooth' : 'triangle') : 'triangle', frequency: target });
      const pg = new GainNode(ctx, { gain: 0 });
      o.connect(pg).connect(out);
      if (from !== 1) {
        o.frequency.setValueAtTime(target * from, t);
        o.frequency.exponentialRampToValueAtTime(target, t + (scoop ? 0.07 : GLIDE));
      }
      if (bowed) {
        this.vib.connect(o.detune);
        const end = adsr(pg.gain, t, dur, level * 0.11 * vel, 0.06, 0.25, 0.72, 0.14);
        o.start(t);
        o.stop(end + 0.02);
      } else {
        const end = perc(pg.gain, t, level * 0.15 * vel, 0.002, decay);
        o.start(t);
        o.stop(end + 0.02);
      }
      if (k === partials.length - 1) o.onended = () => out.disconnect();
    });
    if (bowed) this.vibrato(t, dur);
    this.lastMidi = midi;
    this.lastEnd = t + dur;
  }

  private vibrato(t: number, dur: number): void {
    const g = this.vib.gain;
    holdAt(g, t);
    g.setValueAtTime(0, t);
    if (dur < 0.24) return;
    const cents = this.voice === 'flute' ? 16 : 13;
    g.setValueAtTime(0, t + 0.16);
    g.linearRampToValueAtTime(cents, t + Math.min(dur, 0.45));
    g.setValueAtTime(cents, t + dur);
    g.linearRampToValueAtTime(0, t + dur + 0.08);
  }
}
