// Music reverb: a diffused feedback loop. A ConvolverNode with a full plate IR costs ≈ 1.8 % of the
// realtime audio thread (its early FFT stages always run there); this loop costs about a third:
//   send ─ pre-delay ─▶ Σ ─▶ diffuser (512-tap allpass chain, mono) ─▶ damping LP ─▶ L
//                       ▲                                           └─ × fb ─▶ loop delay ─▶ R
//                       └───────────────────────────────────────────────────────────┘
// Every pass smears the sound through the allpass chain (flat magnitude, so the loop gain is just
// fb × LP and always stable), so echo density builds within ~50 ms; L is taken after the diffuser,
// R one loop later (decorrelated, correlation ≈ 0). RT60 ≈ 0.9 s.

/** Truncated Schroeder allpass chain (delays in samples, gain g), scaled so its peak gain is 1. */
export function allpassDiffuser(ctx: BaseAudioContext, length: number, delays: number[], g: number): AudioBuffer {
  let x = new Float64Array(length);
  x[0] = 1;
  for (const d of delays) {
    const w = new Float64Array(length);
    const y = new Float64Array(length);
    for (let i = 0; i < length; i++) {
      const back = i >= d ? (w[i - d] ?? 0) : 0;
      w[i] = (x[i] ?? 0) + g * back;
      y[i] = -g * (w[i] ?? 0) + back;
    }
    x = y;
  }
  // Truncation leaves a little ripple: normalise by the peak of the magnitude response.
  let peak = 0;
  for (let k = 0; k <= 512; k++) {
    const omega = (Math.PI * k) / 512;
    let re = 0;
    let im = 0;
    for (let i = 0; i < length; i++) {
      re += (x[i] ?? 0) * Math.cos(omega * i);
      im -= (x[i] ?? 0) * Math.sin(omega * i);
    }
    peak = Math.max(peak, Math.hypot(re, im));
  }
  const buf = new AudioBuffer({ length, numberOfChannels: 1, sampleRate: ctx.sampleRate });
  buf.getChannelData(0).set(Float32Array.from(x, (v) => v / (peak || 1)));
  return buf;
}

const diffusers = new Map<number, AudioBuffer>();

/** Build the loop between a send `input` (summed to mono) and a stereo `output`; returns the return gain.
 *  `fb` sets the decay (0.73 ≈ 0.9 s, 0.86 ≈ 1.4 s), `damp` the loop's low-pass (Hz). */
export function loopReverb(
  ctx: BaseAudioContext, input: AudioNode, output: AudioNode, level: number, { fb = 0.73, damp = 4800 } = {},
): GainNode {
  const rate = ctx.sampleRate;
  let ir = diffusers.get(rate);
  if (!ir) diffusers.set(rate, (ir = allpassDiffuser(ctx, Math.round(rate * 0.016), [19, 27, 37, 53].map((n) => Math.round((n * rate) / 32000)), 0.45)));
  const mono = { channelCount: 1, channelCountMode: 'explicit' as const };
  const pre = new DelayNode(ctx, { delayTime: 0.012, maxDelayTime: 0.05, ...mono });
  const sum = new GainNode(ctx, { gain: 1, ...mono });
  const diffuse = new ConvolverNode(ctx, { buffer: ir, disableNormalization: true, ...mono });
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: damp, Q: 0 });
  const back = new GainNode(ctx, { gain: fb });
  const loop = new DelayNode(ctx, { delayTime: 0.021, maxDelayTime: 0.05 });
  input.connect(pre).connect(sum);
  loop.connect(sum);
  sum.connect(diffuse).connect(lp).connect(back).connect(loop);
  const merge = new ChannelMergerNode(ctx, { numberOfInputs: 2 });
  lp.connect(merge, 0, 0);
  // The late tap carries one pass less energy: +0.9 dB keeps the image centred.
  loop.connect(new GainNode(ctx, { gain: 1.11 })).connect(merge, 0, 1);
  const ret = new GainNode(ctx, { gain: level });
  merge.connect(ret).connect(output);
  return ret;
}
