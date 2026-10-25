// A band's send effects: the tempo-synced dotted-8th feedback delay (band-passed repeats) and the
// Haas width pair (two short delayed copies panned apart: a wider lead / horn section that stays
// centred). Both are built with the first strip that sends to them.
import { filter } from '../dsp/env';

/** The Haas pair: delay (s) and pan of each copy. */
const HAAS: Array<[number, number]> = [[0.011, -0.85], [0.017, 0.85]];

/** Dotted-8th delay at `bpm` into `dest`; `line` follows tempo changes. */
export function dottedDelay(ctx: BaseAudioContext, bpm: number, dest: AudioNode): { input: GainNode; line: DelayNode } {
  const line = new DelayNode(ctx, { delayTime: (60 / bpm) * 0.75, maxDelayTime: 2 });
  const fb = new GainNode(ctx, { gain: 0.32 });
  const tone = filter(ctx, { type: 'bandpass', frequency: 1600, Q: 0.5 });
  const input = new GainNode(ctx, { gain: 1 });
  input.connect(line).connect(tone).connect(fb).connect(line);
  tone.connect(dest);
  return { input, line };
}

/** The Haas width pair into `dest`; returns its input. */
export function haasPair(ctx: BaseAudioContext, dest: AudioNode): GainNode {
  const input = new GainNode(ctx, { gain: 1 });
  for (const [time, pan] of HAAS) {
    input.connect(new DelayNode(ctx, { delayTime: time, maxDelayTime: 0.05 })).connect(new StereoPannerNode(ctx, { pan })).connect(dest);
  }
  return input;
}
