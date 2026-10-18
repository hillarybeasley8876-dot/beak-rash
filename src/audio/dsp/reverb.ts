// Cheap stereo reverb from delay lines: on the realtime audio thread a ConvolverNode with a 1.1 s
// impulse response costs ~1.5 % of a core; this network of six DelayNodes costs a fraction of it.
// Pre-delay → two series allpass diffusers → four damped feedback combs (low-pass in the loop:
// highs die first), two per side, so left and right are decorrelated (stereo width).
import { filter } from './env';

export interface Reverb {
  input: GainNode;
  output: GainNode;
}

/** Comb delays (s): mutually prime in samples, spread so the echo density builds evenly. */
const COMBS = [0.0297, 0.0371, 0.0411, 0.0437];
/** Allpass diffuser delays (s): above one 128-frame render quantum (a cycle needs ≥ 4 ms at 32 kHz). */
const DIFFUSE = [0.0051, 0.0077];
const DIFFUSION = 0.62;

/** Schroeder allpass: v = x + g·v[n−D]; y = −g·v + v[n−D] (flat magnitude, smeared phase). */
function allpass(ctx: BaseAudioContext, src: AudioNode, d: number, g: number): AudioNode {
  const sum = new GainNode(ctx, { gain: 1 });
  const delay = new DelayNode(ctx, { delayTime: d, maxDelayTime: d + 0.01 });
  const out = new GainNode(ctx, { gain: 1 });
  src.connect(sum).connect(delay);
  delay.connect(new GainNode(ctx, { gain: g })).connect(sum);
  sum.connect(new GainNode(ctx, { gain: -g })).connect(out);
  delay.connect(out);
  return out;
}

/**
 * `rt60` s decay at low frequencies; `damp` Hz = the in-loop low-pass (lower = darker tail);
 * `level` = output gain (calibrated against the former convolution plate in audio-check renders).
 */
export function createReverb(
  ctx: BaseAudioContext, rt60: number, opts: { preDelay?: number; damp?: number; level?: number } = {},
): Reverb {
  const input = new GainNode(ctx, { gain: 1, channelCount: 1, channelCountMode: 'explicit' });
  const pre = new DelayNode(ctx, { delayTime: opts.preDelay ?? 0.018, maxDelayTime: 0.2 });
  input.connect(pre);
  let head: AudioNode = pre;
  for (const d of DIFFUSE) head = allpass(ctx, head, d, DIFFUSION);
  const merger = new ChannelMergerNode(ctx, { numberOfInputs: 2 });
  COMBS.forEach((d, i) => {
    const delay = new DelayNode(ctx, { delayTime: d, maxDelayTime: d + 0.01 });
    // Q is a resonance in dB for WebAudio low-passes: −3 dB = no peak (a peak would ring on).
    const damp = filter(ctx, { type: 'lowpass', frequency: opts.damp ?? 4200, Q: -3 });
    const fb = new GainNode(ctx, { gain: Math.pow(10, (-3 * d) / rt60) });
    head.connect(delay);
    delay.connect(damp).connect(fb).connect(delay);
    delay.connect(merger, 0, i % 2);
  });
  const output = new GainNode(ctx, { gain: opts.level ?? 0.25 });
  merger.connect(output);
  return { input, output };
}
