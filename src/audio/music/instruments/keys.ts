// Keyboards: pooled electric piano, a persistent funk clavinet (narrow pulse through an envelope
// wah, plus a muted "chicken scratch"), and a persistent legato saw pad.
import { adsr, anchor, filter, holdAt, perc, settle } from '../../dsp/env';
import { pulseWave } from '../../dsp/curves';
import { midiToHz } from '../theory';
import { playSample } from './drum-samples';
import { Pool, osc, type Gate } from './voice';
import type { Band } from '../band';

/** ±0.5 detune / timing jitter from the band's Rng (reproducible per band). */
const jitter = (b: Band): number => b.rng.next() - 0.5;

interface EpVoice {
  body: OscillatorNode;
  bark: OscillatorNode;
  bodyAmp: GainNode;
  barkAmp: GainNode;
  /** Separate gates: the bark (≈ 0.3 s) unplugs long before a sustained body does. */
  bodyGate: Gate;
  barkGate: Gate;
  busyUntil: number;
  startedAt: number;
}

const waves = new WeakMap<BaseAudioContext, [PeriodicWave, PeriodicWave]>();

/**
 * Electric-piano spectra: a mellow body (mostly fundamental) and a bright "bark" (the spectrum a
 * ratio-1 FM pair has at a high index, plus a little tine), crossfaded by envelopes.
 */
function epWaves(ctx: BaseAudioContext): [PeriodicWave, PeriodicWave] {
  let w = waves.get(ctx);
  if (!w) {
    const make = (amps: number[]): PeriodicWave => {
      const real = new Float32Array(amps.length + 1);
      const imag = new Float32Array(amps.length + 1);
      amps.forEach((a, k) => (imag[k + 1] = a));
      return ctx.createPeriodicWave(real, imag);
    };
    w = [
      make([1, 0.16, 0.05, 0.02]),
      make([1, 0.78, 0.5, 0.26, 0.13, 0.07, 0.12, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.06]),
    ];
    waves.set(ctx, w);
  }
  return w;
}

/**
 * 4-voice electric piano: every voicing has 4 notes, so a new chord takes over the last one's
 * voices, which fade out in the 6 ms before it (like lifted keys). Each voice = body + bark
 * oscillators at the same pitch; the bark decays in ~0.3 s (louder when played harder) so notes
 * bite then mellow, like an FM tine piano, while every oscillator stays on WebAudio's cheap
 * constant-frequency path.
 */
export class Rhodes {
  private pool: Pool<EpVoice>;

  /** `dest`: the keys channel, or (sample rendering) any node. */
  constructor(b: Band, dest: AudioNode = b.input('keys')) {
    const [bodyWave, barkWave] = epWaves(b.ctx);
    const voices: EpVoice[] = [];
    for (let i = 0; i < 4; i++) {
      const body = osc(b, 'sine', 220, jitter(b) * 7);
      const bark = osc(b, 'sine', 220, jitter(b) * 7);
      body.setPeriodicWave(bodyWave);
      bark.setPeriodicWave(barkWave);
      const bodyAmp = new GainNode(b.ctx, { gain: 0 });
      const barkAmp = new GainNode(b.ctx, { gain: 0 });
      body.connect(bodyAmp);
      bark.connect(barkAmp);
      voices.push({ body, bark, bodyAmp, barkAmp, bodyGate: b.gate(bodyAmp, dest), barkGate: b.gate(barkAmp, dest), busyUntil: 0, startedAt: 0 });
    }
    this.pool = new Pool(voices);
  }

  note(t: number, midi: number, dur: number, vel: number): void {
    const v = this.pool.take(t);
    const f = midiToHz(midi);
    if (v.busyUntil > t) {
      // Stealing a sounding voice: duck it to zero just before the new onset.
      for (const g of [v.bodyAmp.gain, v.barkAmp.gain]) {
        anchor(g, t - 0.006);
        g.linearRampToValueAtTime(0, t);
        settle(g, t, 0);
      }
    }
    for (const o of [v.body, v.bark]) {
      holdAt(o.frequency, t);
      o.frequency.setValueAtTime(f, t);
    }
    const keyScale = Math.min(1.15, Math.max(0.5, (midi - 36) / 40));
    const peak = 0.2 * (0.55 + 0.45 * vel);
    v.busyUntil = adsr(v.bodyAmp.gain, t, dur, peak, 0.003, 1.6, 0.3, 0.3, true);
    v.barkGate.open(perc(v.barkAmp.gain, t, peak * (0.25 + 0.75 * vel) * keyScale, 0.002, Math.min(dur + 0.05, 0.22 + 0.18 * vel), true));
    v.startedAt = t;
    v.bodyGate.open(v.busyUntil);
  }
}

export class Clav {
  private oscs: OscillatorNode[] = [];
  private wah: BiquadFilterNode;
  private amp: GainNode;
  private gate: Gate;
  private input: AudioNode;
  private mutes = 0;

  constructor(private b: Band) {
    const ctx = b.ctx;
    // The envelope band-pass alone shapes it (the pulse has no DC and plays above 300 Hz).
    this.wah = filter(ctx, { type: 'bandpass', frequency: 900, Q: 1.6 });
    this.amp = new GainNode(ctx, { gain: 0 });
    this.wah.connect(this.amp);
    this.gate = b.gate(this.amp, b.input('clav'));
    // Funk double-stops: the voicing's two guide tones (3rd + 7th of the rootless voicings).
    const wave = pulseWave(ctx, 0.22);
    const level = new GainNode(ctx, { gain: 0.52 });
    level.connect(this.wah);
    for (let i = 0; i < 2; i++) {
      const o = osc(b, 'sine', 330, jitter(b) * 6);
      o.setPeriodicWave(wave);
      o.connect(level);
      this.oscs.push(o);
    }
    this.input = b.input('clav');
  }

  hit(t: number, midis: number[], dur: number, vel: number): void {
    this.oscs.forEach((o, i) => {
      const m = midis[Math.min(i, midis.length - 1)];
      if (m === undefined) return;
      holdAt(o.frequency, t);
      o.frequency.setValueAtTime(midiToHz(m), t);
    });
    const w = this.wah.frequency;
    holdAt(w, t);
    w.setValueAtTime(550, t);
    w.exponentialRampToValueAtTime(2300 + 900 * vel, t + 0.045);
    w.exponentialRampToValueAtTime(850, t + 0.22);
    this.gate.open(adsr(this.amp.gain, t, Math.min(dur, 0.5), 0.3 * vel, 0.002, 0.12, 0.35, 0.05, true));
  }

  mute(t: number, vel: number): void {
    playSample(this.b.ctx, 'clavMute', this.mutes++, t, 0.16 * vel, this.input);
  }
}

/** Pad voices' detune (cents): alternate saws flat / sharp. */
export const PAD_DETUNE = (i: number): number => (i % 2 ? 9 : -11);
export const PAD_RELEASE = 0.7;

/** The pad's slowly opening low-pass: 700 Hz → 1500 Hz over min(1.2 s, the chord). */
export function padFilter(fr: AudioParam, t: number, dur: number): void {
  const open = t + Math.max(0.06, Math.min(1.2, dur));
  anchor(fr, t);
  fr.linearRampToValueAtTime(700, t + 0.05);
  fr.linearRampToValueAtTime(1500, open);
  settle(fr, open, 1500);
}

/** The pad's swell; returns when the chord has died away. */
export function padAmp(g: AudioParam, t: number, dur: number, vel: number): number {
  return adsr(g, t, dur, 0.085 * vel, 0.35, 0.5, 0.8, PAD_RELEASE, true);
}

/**
 * Warm legato pad: four persistent detuned saws through one slowly opening low-pass. Chord
 * changes glide the voices (40 ms) and re-swell the VCA from its current level, so no new nodes.
 * (pad-sampler.ts plays pre-rendered chords; this voice covers the time before its bank exists.)
 */
export class Pad {
  private saws: OscillatorNode[] = [];
  private lp: BiquadFilterNode;
  private amp: GainNode;
  private gate: Gate;
  private busyUntil = 0;

  constructor(b: Band) {
    this.lp = filter(b.ctx, { type: 'lowpass', frequency: 700, Q: 0.8 });
    this.amp = new GainNode(b.ctx, { gain: 0 });
    this.lp.connect(this.amp);
    this.gate = b.gate(this.amp, b.input('pad'));
    for (let i = 0; i < 4; i++) {
      const o = osc(b, 'sawtooth', 220, PAD_DETUNE(i));
      o.connect(this.lp);
      this.saws.push(o);
    }
  }

  chord(t: number, midis: number[], dur: number, vel: number): void {
    // Glide only between sounding chords; after a rest the new chord starts on its own pitches.
    const legato = t < this.busyUntil;
    this.saws.forEach((o, i) => {
      const m = midis[i % Math.max(1, midis.length)];
      if (m === undefined) return;
      const f = midiToHz(m);
      anchor(o.frequency, t);
      if (legato) o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      else o.frequency.setValueAtTime(f, t);
      settle(o.frequency, legato ? t + 0.04 : t, f);
    });
    padFilter(this.lp.frequency, t, dur);
    this.busyUntil = padAmp(this.amp.gain, t, dur, vel);
    this.gate.open(this.busyUntil);
  }
}
