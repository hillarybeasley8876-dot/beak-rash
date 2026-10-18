// Synchronous JS synthesis into Float32Arrays, for sample buffers built once per context (drum
// hits): WebAudio-equivalent biquads (Audio EQ Cookbook, as the spec defines BiquadFilterNode),
// the click-free percussive envelope of dsp/env.ts, band-limited squares and seeded noise.
import type { Rng } from '../../core/rng';
import { FLOOR } from './env';

export type BiquadType = 'lowpass' | 'highpass' | 'bandpass' | 'peaking';

/** In-place biquad with BiquadFilterNode semantics (lowpass / highpass Q in dB, others linear). */
export function biquad(x: Float32Array, sr: number, type: BiquadType, f: number, q: number, gainDb = 0): Float32Array {
  const w0 = (2 * Math.PI * Math.min(f, sr * 0.49)) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const aDb = sin / (2 * Math.pow(10, q / 20));
  const aQ = sin / (2 * Math.max(1e-4, q));
  const A = Math.pow(10, gainDb / 40);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === 'lowpass') [b0, b1, b2, a0, a1, a2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + aDb, -2 * cos, 1 - aDb];
  else if (type === 'highpass') [b0, b1, b2, a0, a1, a2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + aDb, -2 * cos, 1 - aDb];
  else if (type === 'bandpass') [b0, b1, b2, a0, a1, a2] = [aQ, 0, -aQ, 1 + aQ, -2 * cos, 1 - aQ];
  else [b0, b1, b2, a0, a1, a2] = [1 + aQ * A, -2 * cos, 1 - aQ * A, 1 + aQ / A, -2 * cos, 1 - aQ / A];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i] ?? 0;
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    x[i] = y0;
  }
  return x;
}

/** Multiply by dsp/env.ts perc(): linear attack to 1, exponential decay to FLOOR, 4 ms to 0. */
export function percEnv(x: Float32Array, sr: number, attack: number, decay: number, from = 0): Float32Array {
  const a = Math.max(1, Math.round(Math.max(0.001, attack) * sr));
  const d = Math.max(1, Math.round(Math.max(0.005, decay) * sr));
  const tail = Math.round(0.004 * sr);
  const k = Math.log(FLOOR) / d;
  const s0 = Math.round(from * sr);
  for (let i = 0; i < x.length; i++) {
    const n = i - s0;
    let g = 0;
    if (n < 0) g = 0;
    else if (n < a) g = n / a;
    else if (n < a + d) g = Math.exp(k * (n - a));
    else if (n < a + d + tail) g = FLOOR * (1 - (n - a - d) / tail);
    x[i] = (x[i] ?? 0) * g;
  }
  return x;
}

export function whiteNoise(len: number, rng: Rng): Float32Array {
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) x[i] = rng.next() * 2 - 1;
  return x;
}

/** Band-limited square (PolyBLEP) at `f` Hz, amplitude ±1, added into `out`·`level`. */
export function addSquare(out: Float32Array, sr: number, f: number, level: number, phase = 0): void {
  const dt = f / sr;
  let p = phase % 1;
  const blep = (t: number): number => {
    if (t < dt) { const u = t / dt; return u + u - u * u - 1; }
    if (t > 1 - dt) { const u = (t - 1) / dt; return u * u + u + u + 1; }
    return 0;
  };
  for (let i = 0; i < out.length; i++) {
    let v = p < 0.5 ? 1 : -1;
    v += blep(p);
    v -= blep((p + 0.5) % 1);
    out[i] = (out[i] ?? 0) + v * level;
    p += dt;
    if (p >= 1) p -= 1;
  }
}

/** Mix `src`·`level` into `dst` (same length or shorter). */
export function mixInto(dst: Float32Array, src: Float32Array, level: number): Float32Array {
  for (let i = 0; i < Math.min(dst.length, src.length); i++) dst[i] = (dst[i] ?? 0) + (src[i] ?? 0) * level;
  return dst;
}

export function rms(x: Float32Array, from = 0, to = x.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += (x[i] ?? 0) * (x[i] ?? 0);
  return Math.sqrt(s / Math.max(1, to - from));
}

/**
 * Multiply by a breakpoint envelope from 0 at t = 0: each point [time s, value, 'lin' | 'exp']
 * ramps to `value` by `time` (exponential segments need non-zero ends), 0 after the last point.
 */
export function shapeEnv(x: Float32Array, sr: number, points: Array<[number, number, 'lin' | 'exp']>): Float32Array {
  let t0 = 0;
  let v0 = 0;
  let i = 0;
  for (const [t1, v1, curve] of points) {
    const end = Math.min(x.length, Math.round(t1 * sr));
    const span = Math.max(1, end - Math.round(t0 * sr));
    const start = i;
    for (; i < end; i++) {
      const u = (i - start) / span;
      const g = curve === 'exp' && v0 > 0 && v1 > 0 ? v0 * Math.pow(v1 / v0, u) : v0 + (v1 - v0) * u;
      x[i] = (x[i] ?? 0) * g;
    }
    t0 = t1;
    v0 = v1;
  }
  for (; i < x.length; i++) x[i] = 0;
  return x;
}

/**
 * Sine or triangle whose pitch glides exponentially through `points` ([time s, Hz], the first at
 * t = 0), then holds: the drum bodies (kick / toms / snare shell), amplitude ±1.
 */
export function glide(len: number, sr: number, shape: 'sine' | 'triangle', points: Array<[number, number]>): Float32Array {
  const x = new Float32Array(len);
  let phase = 0;
  let k = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    while (k + 1 < points.length && t >= (points[k + 1]?.[0] ?? Infinity)) k++;
    const [t0, f0] = points[k] ?? [0, 100];
    const next = points[k + 1];
    const f = next ? f0 * Math.pow(next[1] / f0, (t - t0) / (next[0] - t0)) : f0;
    x[i] = shape === 'sine' ? Math.sin(2 * Math.PI * phase) : 1 - 4 * Math.abs(phase - 0.5);
    phase = (phase + f / sr) % 1;
  }
  return x;
}
