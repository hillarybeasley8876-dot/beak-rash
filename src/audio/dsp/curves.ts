// Static curves and buffers: soft-clip / drive shaper curves, reverb impulse responses and
// periodic waves (impulse train, narrow pulse). All cached per audio context.
import { Rng } from '../../core/rng';

/**
 * Master safety clipper. Domain [-1, 1] represents input [-2, 2] (feed it through a 0.5 gain):
 * linear below `knee`, then a tanh shoulder that never exceeds `ceiling` (0.88 ≈ −1.1 dBFS).
 */
export function softClipCurve(ceiling = 0.88, knee = 0.6, n = 8192): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const span = ceiling - knee;
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2;
    const ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + span * Math.tanh((ax - knee) / span);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/** Symmetric tanh drive normalised to ±1 (amount 1 = gentle warmth, 6 = fuzz). */
export function driveCurve(amount: number, n = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}

/**
 * Stereo reverb impulse: early reflections + exponentially decaying noise whose brightness
 * falls over time (one-pole low-pass with a closing cutoff), so tails sound warm, not hissy.
 */
export function impulseResponse(
  ctx: BaseAudioContext, seconds: number, rt60: number,
  opts: { preDelay?: number; bright?: number; seed?: number; channels?: 1 | 2 } = {},
): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const channels = opts.channels ?? 2;
  const buf = ctx.createBuffer(channels, len, sr);
  const pre = Math.floor((opts.preDelay ?? 0.012) * sr);
  const bright = opts.bright ?? 0.6;
  for (let ch = 0; ch < channels; ch++) {
    const rng = new Rng((opts.seed ?? 77) + ch * 131);
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const amp = Math.pow(10, (-3 * t) / rt60);
      const cutoff = bright * Math.exp(-t * 2.2) + 0.04; // one-pole coefficient, closes over time
      lp += cutoff * ((rng.next() * 2 - 1) - lp);
      d[i] = lp * amp;
    }
    for (let k = 0; k < 7; k++) {
      const at = pre + Math.floor(rng.range(0.004, 0.07) * sr);
      if (at < len) d[at] = (d[at] ?? 0) + rng.range(0.25, 0.6) * (rng.chance(0.5) ? 1 : -1);
    }
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i] ?? 0));
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < len; i++) {
      const tail = i > len - fade ? (len - i) / fade : 1;
      d[i] = ((d[i] ?? 0) / (peak || 1)) * 0.6 * tail;
    }
  }
  return buf;
}

const waves = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

function cachedWave(ctx: BaseAudioContext, key: string, make: () => PeriodicWave): PeriodicWave {
  let m = waves.get(ctx);
  if (!m) {
    m = new Map();
    waves.set(ctx, m);
  }
  let w = m.get(key);
  if (!w) {
    w = make();
    m.set(key, w);
  }
  return w;
}

/** Band-limited impulse train (equal-amplitude cosine harmonics): clicks / ratchet ticks. */
export function impulseWave(ctx: BaseAudioContext, harmonics = 48): PeriodicWave {
  return cachedWave(ctx, `imp${harmonics}`, () => {
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let k = 1; k <= harmonics; k++) real[k] = 1;
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  });
}

/** Narrow pulse (duty ≈ 1/6): nasal, clavinet / reed-like timbre. */
export function pulseWave(ctx: BaseAudioContext, duty = 1 / 6, harmonics = 40): PeriodicWave {
  return cachedWave(ctx, `pulse${duty.toFixed(3)}`, () => {
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let k = 1; k <= harmonics; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * 2;
    return ctx.createPeriodicWave(real, imag);
  });
}

/**
 * Peak-normalised sawtooth / square / sine mixed into one wave at the given levels, so a voice
 * that layered three oscillators runs one (no detune between the layers, same spectrum).
 */
export function mixWave(ctx: BaseAudioContext, mix: { saw?: number; square?: number; sine?: number }, harmonics = 256): PeriodicWave {
  const key = `mix${mix.saw ?? 0}/${mix.square ?? 0}/${mix.sine ?? 0}/${harmonics}`;
  return cachedWave(ctx, key, () => {
    const saw = (k: number): number => ((k % 2 ? 2 : -2) / (Math.PI * k));
    const square = (k: number): number => (k % 2 ? 4 / (Math.PI * k) : 0);
    // WebAudio normalises its built-in waves to a peak of 1; a band-limited saw or square peaks at
    // the Wilbraham–Gibbs value (2/π)·Si(π) ≈ 1.179, so those layers are scaled by 1 / 1.179.
    const g = 1 / 1.179;
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let k = 1; k <= harmonics; k++) {
      imag[k] = g * ((mix.saw ?? 0) * saw(k) + (mix.square ?? 0) * square(k)) + (k === 1 ? mix.sine ?? 0 : 0);
    }
    return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
  });
}
