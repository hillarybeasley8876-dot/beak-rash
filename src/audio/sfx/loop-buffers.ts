// Pre-rendered texture for the bike's chain whirr: tooth-rate gated, band-passed noise rendered once
// per context in JS, played as a looping buffer whose playbackRate follows the cadence (resampling
// scales the tooth rate and the band together, as the live AM + filter did): one buffer source + gain
// instead of noise → biquad → AM oscillator on the audio thread.
import { Rng } from '../../core/rng';
import { addSquare, biquad, whiteNoise } from '../dsp/render';

export type LoopKind = 'chain';

/** What the buffer holds at playbackRate 1. */
export const LOOP_REF = {
  /** Chain: noise gated at this chainring tooth rate, band-passed at chainHz (Q 1): 3600 Hz at 15 m/s. */
  chainTooth: 64,
  chainHz: 2700,
} as const;

const SECONDS = 2;
const cache = new WeakMap<BaseAudioContext, Map<LoopKind, AudioBuffer>>();

/** Filter one period of a periodic signal: run it twice and keep the second pass (seamless loop). */
function periodic(x: Float32Array, fx: (y: Float32Array) => Float32Array): Float32Array {
  const two = new Float32Array(x.length * 2);
  two.set(x);
  two.set(x, x.length);
  return fx(two).slice(x.length);
}

function channel(sr: number, len: number, rng: Rng): Float32Array {
  const x = whiteNoise(len, rng);
  // Chain: a whole number of tooth periods per loop, gain 0.5 + 0.5 · square (as the live VCA did).
  const periods = Math.round(SECONDS * LOOP_REF.chainTooth);
  const am = new Float32Array(len);
  addSquare(am, sr, (periods * sr) / len, 0.5);
  for (let i = 0; i < len; i++) x[i] = (x[i] ?? 0) * (0.5 + (am[i] ?? 0));
  return periodic(x, (y) => biquad(y, sr, 'bandpass', LOOP_REF.chainHz, 1));
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
  const len = Math.round(sr * SECONDS);
  const buf = ctx.createBuffer(1, len, sr);
  buf.getChannelData(0).set(channel(sr, len, new Rng(0x100f + kind.length * 131)));
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
}
