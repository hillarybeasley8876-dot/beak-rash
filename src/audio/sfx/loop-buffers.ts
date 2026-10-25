// Pre-rendered loops, built once per context in JS: the bike's chain whirr (tooth-rate gated,
// band-passed noise, played at a playbackRate that follows the cadence: resampling scales the tooth
// rate and the band together, as the live AM + filter did) and the corgi's police siren (the two-tone
// square through its speaker filter). One buffer source + gain each, instead of oscillators and
// biquads on the audio thread.
import { Rng } from '../../core/rng';
import { addSquare, biquad, whiteNoise } from '../dsp/render';

export type LoopKind = 'chain' | 'siren';

/** What the buffer holds at playbackRate 1. */
export const LOOP_REF = {
  /** Chain: noise gated at this chainring tooth rate, band-passed at chainHz (Q 1): 3600 Hz at 15 m/s. */
  chainTooth: 64,
  chainHz: 2700,
} as const;

/** Siren "nee-naw": each tone holds SIREN_HALF s with a whole number of cycles (seamless switches and
 *  loop; the live version was 865 ± 95 Hz switched at 1.1 Hz), through a 2.6 kHz low-pass and a
 *  +6 dB speaker peak at 1.4 kHz. */
const SIREN_TONES = [960, 771.1];
const SIREN_HALF = 0.45;

const SECONDS = 2;
const cache = new WeakMap<BaseAudioContext, Map<LoopKind, AudioBuffer>>();

/** Filter one period of a periodic signal: run it twice and keep the second pass (seamless loop). */
function periodic(x: Float32Array, fx: (y: Float32Array) => Float32Array): Float32Array {
  const two = new Float32Array(x.length * 2);
  two.set(x);
  two.set(x, x.length);
  return fx(two).slice(x.length);
}

function chain(sr: number, len: number, rng: Rng): Float32Array {
  const x = whiteNoise(len, rng);
  // Chain: a whole number of tooth periods per loop, gain 0.5 + 0.5 · square (as the live VCA did).
  const periods = Math.round(SECONDS * LOOP_REF.chainTooth);
  const am = new Float32Array(len);
  addSquare(am, sr, (periods * sr) / len, 0.5);
  for (let i = 0; i < len; i++) x[i] = (x[i] ?? 0) * (0.5 + (am[i] ?? 0));
  return periodic(x, (y) => biquad(y, sr, 'bandpass', LOOP_REF.chainHz, 1));
}

function siren(sr: number): Float32Array {
  const half = Math.round(SIREN_HALF * sr);
  const x = new Float32Array(half * 2);
  SIREN_TONES.forEach((f, k) => addSquare(x.subarray(k * half, (k + 1) * half), sr, f, 1));
  return periodic(x, (y) => biquad(biquad(y, sr, 'lowpass', 2600, 0.8), sr, 'peaking', 1400, 1.2, 6));
}

/** The loop buffer for `kind`, built on first use per context. */
export function loopBuffer(ctx: BaseAudioContext, kind: LoopKind): AudioBuffer {
  let byKind = cache.get(ctx);
  if (!byKind) {
    byKind = new Map();
    cache.set(ctx, byKind);
  }
  const hit = byKind.get(kind);
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const data = kind === 'siren' ? siren(sr) : chain(sr, Math.round(sr * SECONDS), new Rng(0x100f + kind.length * 131));
  const buf = ctx.createBuffer(1, data.length, sr);
  buf.getChannelData(0).set(data);
  byKind.set(kind, buf);
  return buf;
}

/** A looping source of `kind` started at `t` from a random point (k-rate playbackRate). */
export function loopSource(ctx: BaseAudioContext, kind: LoopKind, t: number, rng: Rng): AudioBufferSourceNode {
  const src = new AudioBufferSourceNode(ctx, { buffer: loopBuffer(ctx, kind), loop: true });
  src.start(t, rng.next() * SECONDS);
  return src;
}

/** Build every loop buffer now (boot), so the first race frame does not pay for the JS render. */
export function prepareLoopBuffers(ctx: BaseAudioContext): void {
  loopBuffer(ctx, 'chain');
  loopBuffer(ctx, 'siren');
}
