// Note banks: an instrument's live voice rendered once per page and sample rate into per-note
// samples (pitch zones × velocity layers × variants), in one OfflineAudioContext off the audio
// thread. Sampled instruments then play a note (or a whole pre-mixed chord, premix.ts) as one
// buffer source: the realtime thread no longer runs the voice's oscillators, filters and envelopes.
// Before a bank exists (or for notes it does not cover) the instruments use their live voices.
import { Rng } from '../../../core/rng';
import { Engine } from '../../engine';
import { Band } from '../band';

export interface BankSpec {
  /** Cache key (per sample rate). */
  id: string;
  /** Pitch zones: low, low + step, … (count zones). */
  low: number;
  step: number;
  count: number;
  /** Velocity layers rendered (nearest one is picked, the level is scaled to the note). */
  vels: number[];
  /** Variants (articulations) rendered per zone and layer. */
  variants: number;
  /** Longest held part (s) a sample covers before its release. */
  held: number;
  /** Seconds kept after the note-off (release + ring). */
  tail: number;
  /** Render at this rate instead of the context's (a low-passed pad needs no 16 kHz bandwidth: half the memory). */
  renderRate?: number;
  /** Play one note of the live voice into `dest` (a fresh offline band hosts it). */
  play(b: Band, dest: AudioNode, t: number, midi: number, vel: number, variant: number): void;
}

/** Rendered samples per `${id}@${rate}`: [variant][layer][zone]. */
const banks = new Map<string, AudioBuffer[][][]>();
const pending = new Map<string, Promise<void>>();

export function bankOf(spec: BankSpec, sampleRate: number): AudioBuffer[][][] | null {
  return banks.get(`${spec.id}@${sampleRate}`) ?? null;
}

/** Nearest zone for `midi` and the playback rate that bends the zone's sample to it (null = out of range). */
export function zoneOf(spec: BankSpec, midi: number): { zone: number; rate: number } | null {
  const zone = Math.round((midi - spec.low) / spec.step);
  if (zone < 0 || zone >= spec.count) return null;
  return { zone, rate: Math.pow(2, (midi - spec.low - zone * spec.step) / 12) };
}

/** Index of the velocity layer nearest to `vel`. */
export function layerOf(spec: BankSpec, vel: number): number {
  let best = 0;
  spec.vels.forEach((v, i) => {
    if (Math.abs(v - vel) < Math.abs((spec.vels[best] ?? 1) - vel)) best = i;
  });
  return best;
}

/** Render the bank for this sample rate (once; a failure leaves the live voices in charge). */
export function prepareBank(spec: BankSpec, sampleRate: number): Promise<void> {
  const key = `${spec.id}@${sampleRate}`;
  if (banks.has(key)) return Promise.resolve();
  let job = pending.get(key);
  if (!job) {
    job = render(spec, sampleRate).then(
      (bank) => { banks.set(key, bank); },
      (err: unknown) => console.warn(`[audio] ${spec.id} samples unavailable, using live voices`, err),
    );
    pending.set(key, job);
  }
  return job;
}

async function render(spec: BankSpec, contextRate: number): Promise<AudioBuffer[][][]> {
  const sr = spec.renderRate ?? contextRate;
  const slot = Math.round((spec.held + spec.tail + 0.05) * sr);
  const count = spec.variants * spec.vels.length * spec.count;
  const ctx = new OfflineAudioContext(1, slot * count, sr);
  // A silent engine / band hosts the voice; its notes go straight to the destination (no strip).
  const engine = new Engine(ctx, { master: 1, music: 1, sfx: 1, voice: 1 }, { glue: false });
  const band = new Band(engine, 120, {}, ctx.destination, new Rng(0x5a3b1e));
  let n = 0;
  for (let v = 0; v < spec.variants; v++) {
    spec.vels.forEach((vel) => {
      for (let z = 0; z < spec.count; z++) spec.play(band, ctx.destination, (n++ * slot) / sr, spec.low + z * spec.step, vel, v);
    });
  }
  const out = (await ctx.startRendering()).getChannelData(0);
  let k = 0;
  return Array.from({ length: spec.variants }, () => spec.vels.map(() => Array.from({ length: spec.count }, () => {
    const buf = new AudioBuffer({ length: slot, numberOfChannels: 1, sampleRate: sr });
    buf.getChannelData(0).set(out.subarray(k * slot, (k + 1) * slot));
    k++;
    return buf;
  })));
}
