// SFX synthesis kit: tiny primitives every sound is built from. A sound receives an `S` (where to
// play, when, how loud, pitch factor) and schedules short-lived nodes; `pitch` scales every
// frequency and divides every time, like changing tape speed (slow-mo makes hits deeper/longer).
import { filter, perc } from '../dsp/env';
import { noise, type NoiseKind } from '../dsp/noise';
import type { Rng } from '../../core/rng';

export interface S {
  ctx: BaseAudioContext;
  out: AudioNode;
  t: number;
  vol: number;
  pitch: number;
  /** The player's Rng (noise offsets), so renders are reproducible per player. */
  rng: Rng;
}

export type SfxFn = (s: S) => number;

interface Filt { type: BiquadFilterType; f: number; to?: number; q?: number }

const hz = (s: S, f: number): number => Math.min(15000, f * s.pitch);
const sec = (s: S, d: number): number => d / s.pitch;

function dest(s: S, pan?: number): AudioNode {
  if (!pan) return s.out;
  const p = new StereoPannerNode(s.ctx, { pan: Math.max(-1, Math.min(1, pan)) });
  p.connect(s.out);
  return p;
}

function chain(s: S, head: AudioNode, f: Filt | undefined, start: number, len: number): AudioNode {
  if (!f) return head;
  const node = filter(s.ctx, { type: f.type, frequency: hz(s, f.f), Q: f.q ?? 0.8 });
  if (f.to !== undefined) {
    node.frequency.setValueAtTime(hz(s, f.f), start);
    node.frequency.exponentialRampToValueAtTime(hz(s, f.to), start + len);
  }
  return head.connect(node);
}

export interface ToneOpts {
  type?: OscillatorType;
  wave?: PeriodicWave;
  f: number;
  to?: number;
  glide?: number;
  at?: number;
  a?: number;
  d: number;
  peak: number;
  filt?: Filt;
  pan?: number;
  vib?: [number, number];
}

/** Oscillator with an exponential pitch glide and a percussive envelope. Returns its end offset. */
export function tone(s: S, o: ToneOpts): number {
  const t = s.t + sec(s, o.at ?? 0);
  const a = sec(s, o.a ?? 0.004);
  const d = sec(s, o.d);
  const osc = new OscillatorNode(s.ctx, { type: o.type ?? 'sine', frequency: hz(s, o.f) });
  if (o.wave) osc.setPeriodicWave(o.wave);
  if (o.to !== undefined) {
    osc.frequency.setValueAtTime(hz(s, o.f), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, hz(s, o.to)), t + sec(s, o.glide ?? o.d));
  }
  if (o.vib) {
    const lfo = new OscillatorNode(s.ctx, { frequency: o.vib[0] });
    lfo.connect(new GainNode(s.ctx, { gain: o.vib[1] })).connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + a + d + 0.02);
  }
  const g = new GainNode(s.ctx, { gain: 0 });
  const end = perc(g.gain, t, o.peak * s.vol, a, d);
  chain(s, osc, o.filt, t, a + d).connect(g).connect(dest(s, o.pan));
  osc.start(t);
  osc.stop(end + 0.01);
  return end - s.t;
}

export interface HissOpts {
  kind?: NoiseKind;
  at?: number;
  a?: number;
  d: number;
  peak: number;
  filt: Filt;
  filt2?: Filt;
  pan?: number;
}

/** Filtered noise burst with an optional cutoff sweep (whooshes, impacts, splashes, wind). */
export function hiss(s: S, o: HissOpts): number {
  const t = s.t + sec(s, o.at ?? 0);
  const a = sec(s, o.a ?? 0.003);
  const d = sec(s, o.d);
  const src = noise(s.ctx, o.kind ?? 'white', t, a + d + 0.01, s.rng, s.pitch);
  const g = new GainNode(s.ctx, { gain: 0 });
  const end = perc(g.gain, t, o.peak * s.vol, a, d);
  chain(s, chain(s, src, o.filt, t, a + d), o.filt2, t, a + d).connect(g).connect(dest(s, o.pan));
  return end - s.t;
}

/** Additive inharmonic ring: bells, pans, metal clangs. partials = [ratio, level, decay]. */
export function ring(s: S, o: { f: number; partials: Array<[number, number, number]>; at?: number; peak: number; pan?: number }): number {
  let end = 0;
  for (const [ratio, level, decay] of o.partials) {
    end = Math.max(end, tone(s, { f: o.f * ratio, at: o.at, a: 0.0015, d: decay, peak: o.peak * level, pan: o.pan }));
  }
  return end;
}

/** Two-operator FM blip (zaps, sparkles, chimes). `index` = modulation depth as a multiple of f, start → end. */
export function fm(
  s: S, o: { f: number; to?: number; ratio: number; index: [number, number]; at?: number; a?: number; d: number; peak: number; pan?: number; filt?: Filt },
): number {
  const t = s.t + sec(s, o.at ?? 0);
  const a = sec(s, o.a ?? 0.003);
  const d = sec(s, o.d);
  const f = hz(s, o.f);
  const car = new OscillatorNode(s.ctx, { frequency: f });
  const mod = new OscillatorNode(s.ctx, { frequency: f * o.ratio });
  const depth = new GainNode(s.ctx, { gain: f * o.index[0] });
  depth.gain.setValueAtTime(f * o.index[0], t);
  depth.gain.exponentialRampToValueAtTime(Math.max(0.01, f * o.index[1]), t + a + d);
  if (o.to !== undefined) {
    const f1 = hz(s, o.to);
    car.frequency.setValueAtTime(f, t);
    car.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    mod.frequency.setValueAtTime(f * o.ratio, t);
    mod.frequency.exponentialRampToValueAtTime(f1 * o.ratio, t + a + d);
  }
  mod.connect(depth).connect(car.frequency);
  const g = new GainNode(s.ctx, { gain: 0 });
  const end = perc(g.gain, t, o.peak * s.vol, a, d);
  chain(s, car, o.filt, t, a + d).connect(g).connect(dest(s, o.pan));
  for (const n of [car, mod]) {
    n.start(t);
    n.stop(end + 0.01);
  }
  return end - s.t;
}

export interface CallOpts {
  type?: OscillatorType;
  wave?: PeriodicWave;
  /** Pitch contour (Hz) at `times` (s, relative); the last time is the call's length. */
  f: number[];
  times: number[];
  /** Formant sets [F1, F2, F3] (Hz) at the same times. */
  vowels: Array<[number, number, number]>;
  peak: number;
  at?: number;
  pan?: number;
  breath?: number;
  q?: number;
}

/** Formant-filtered vocal call (animal voices): a pitch contour through moving vowel formants. */
export function call(s: S, o: CallOpts): number {
  const t = s.t + sec(s, o.at ?? 0);
  const times = o.times.map((x) => t + sec(s, x));
  const end = times[times.length - 1] ?? t + 0.2;
  const src = new OscillatorNode(s.ctx, { type: o.type ?? 'sawtooth', frequency: hz(s, o.f[0] ?? 300) });
  if (o.wave) src.setPeriodicWave(o.wave);
  o.f.forEach((f, i) => {
    const at = times[i] ?? end;
    if (i === 0) src.frequency.setValueAtTime(hz(s, f), at);
    else src.frequency.exponentialRampToValueAtTime(hz(s, f), at);
  });
  const amp = new GainNode(s.ctx, { gain: 0 });
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(o.peak * s.vol, t + sec(s, 0.012));
  amp.gain.setValueAtTime(o.peak * s.vol, Math.max(t + sec(s, 0.013), end - sec(s, 0.05)));
  amp.gain.linearRampToValueAtTime(0, end);
  const sum = new GainNode(s.ctx, { gain: 1 });
  const breath = o.breath ? noise(s.ctx, 'white', t, end - t + 0.01, s.rng).connect(new GainNode(s.ctx, { gain: o.breath })) : null;
  [1, 0.55, 0.25].forEach((level, k) => {
    const bp = filter(s.ctx, { type: 'bandpass', frequency: hz(s, o.vowels[0]?.[k] ?? 800), Q: o.q ?? 6 });
    o.vowels.forEach((v, i) => {
      const at = times[i] ?? end;
      if (i === 0) bp.frequency.setValueAtTime(hz(s, v[k]), at);
      else bp.frequency.linearRampToValueAtTime(hz(s, v[k]), at);
    });
    src.connect(bp).connect(new GainNode(s.ctx, { gain: level * 3 })).connect(sum);
    breath?.connect(bp);
  });
  sum.connect(amp).connect(dest(s, o.pan));
  src.start(t);
  src.stop(end + 0.01);
  return end - s.t;
}

/** Longest of several part durations (sounds return their total length for voice accounting). */
export const span = (...parts: number[]): number => Math.max(0, ...parts);
