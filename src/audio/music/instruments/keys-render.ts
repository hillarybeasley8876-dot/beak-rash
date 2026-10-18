// Renders the electric-piano note samples for keys-sampler.ts once per page and sample rate: the
// live Rhodes voice plays every sample pitch at both velocities, one after another, in a single
// OfflineAudioContext (off the audio thread), and the result is sliced into one buffer per note.
import { Rng } from '../../../core/rng';
import { Engine } from '../../engine';
import { Band } from '../band';
import { Rhodes } from './keys';
import { KEY_COUNT, KEY_HELD, KEY_LOW, KEY_RELEASE, KEY_STEP, KEY_VELS, hasKeyBank, setKeyBank } from './keys-sampler';

/** Seconds per rendered note: held part + release + the envelope's closing tail. */
const SLOT = KEY_HELD + KEY_RELEASE + 0.05;
const pending = new Map<number, Promise<void>>();

/** Render the bank for this sample rate (once; failures leave the live voices in charge). */
export function prepareKeySamples(sampleRate: number): Promise<void> {
  if (hasKeyBank(sampleRate)) return Promise.resolve();
  let job = pending.get(sampleRate);
  if (!job) {
    job = render(sampleRate).catch((err: unknown) => console.warn('[audio] keys samples unavailable, using live voices', err));
    pending.set(sampleRate, job);
  }
  return job;
}

async function render(sr: number): Promise<void> {
  const len = Math.round(SLOT * sr);
  const count = KEY_VELS.length * KEY_COUNT;
  const ctx = new OfflineAudioContext(1, len * count, sr);
  // A silent engine / band host the voice; its notes go straight to the destination (no strip).
  const engine = new Engine(ctx, { master: 1, music: 1, sfx: 1, voice: 1 }, { glue: false });
  const ep = new Rhodes(new Band(engine, 120, {}, ctx.destination, new Rng(0x6e95)), ctx.destination);
  KEY_VELS.forEach((vel, layer) => {
    for (let k = 0; k < KEY_COUNT; k++) ep.note(((layer * KEY_COUNT + k) * len) / sr, KEY_LOW + k * KEY_STEP, KEY_HELD, vel);
  });
  const out = (await ctx.startRendering()).getChannelData(0);
  setKeyBank(sr, KEY_VELS.map((_, layer) => Array.from({ length: KEY_COUNT }, (_, k) => {
    const buf = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: sr });
    const at = (layer * KEY_COUNT + k) * len;
    buf.getChannelData(0).set(out.subarray(at, at + len));
    return buf;
  })));
}
