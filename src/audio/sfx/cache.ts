// Rendered one-shots. A synthesized sfx builds 5–20 nodes per play, and the realtime audio thread
// pays for every one of them, so after its first (live) play each sound is rendered once into a
// couple of takes (OfflineAudioContext: off the audio thread) and replayed as a buffer: one source
// node instead of a graph. `pitch` maps to playbackRate (the kit's pitch is tape speed: frequencies
// × p, times ÷ p), `vol` to a gain (the kit's levels are linear in vol), so takes sound identical.
import { Rng } from '../../core/rng';
import type { SfxFn } from './kit';

/** Total cached audio (s, all takes): bounds memory (≈ 128 kB per mono second at 32 kHz). */
const BUDGET_S = 90;
/** Sounds shorter than this get two takes (noise offsets differ), longer ones one. */
const SHORT_S = 0.9;
const TAIL_S = 0.03;
/** Render length for a sound whose length is not known yet (prewarm); trimmed afterwards. */
const MAX_S = 3.2;

export class SfxCache {
  private takes = new Map<string, AudioBuffer[]>();
  private queued = new Set<string>();
  private queue: Array<{ id: string; fn: SfxFn; dur: number | null }> = [];
  private seconds = 0;
  private running = false;
  private next = 0;

  constructor(private sampleRate: number, private rng: Rng) {}

  /** A cached take of `id` (alternating between takes), or null if it is not rendered yet. */
  get(id: string): AudioBuffer | null {
    const list = this.takes.get(id);
    if (!list || list.length === 0) return null;
    this.next = (this.next + 1) % 997;
    return list[this.next % list.length] ?? null;
  }

  /** Render `id` in the background (once); `dur` = its length at pitch 1 (null = not known yet). */
  request(id: string, fn: SfxFn, dur: number | null): void {
    if (this.takes.has(id) || this.queued.has(id) || (dur !== null && dur <= 0) || this.seconds + (dur ?? 1) > BUDGET_S) return;
    this.queued.add(id);
    this.queue.push({ id, fn, dur });
    if (!this.running) void this.drain();
  }

  private async drain(): Promise<void> {
    this.running = true;
    for (let job = this.queue.shift(); job; job = this.queue.shift()) {
      try {
        const first = await this.render(job.fn, job.dur);
        const list = [first];
        if (first.duration < SHORT_S) list.push(await this.render(job.fn, first.duration));
        this.takes.set(job.id, list);
        this.seconds += first.duration * list.length;
      } catch (err) {
        // Rendering is an optimisation: on failure the sound keeps being synthesized live.
        console.warn(`[audio] could not pre-render sfx "${job.id}"`, err);
      }
    }
    this.running = false;
  }

  private async render(fn: SfxFn, dur: number | null): Promise<AudioBuffer> {
    const len = Math.ceil((dur === null ? MAX_S : dur + TAIL_S) * this.sampleRate);
    const ctx = new OfflineAudioContext(2, len, this.sampleRate);
    fn({ ctx, out: ctx.destination, t: 0, vol: 1, pitch: 1, rng: this.rng.fork(Math.floor(this.rng.next() * 1e9)) });
    return compact(await ctx.startRendering());
  }
}

/**
 * Drop the silent tail, and keep one channel when the sound is centred (most are): half the
 * memory, the same sound after up-mixing.
 */
function compact(buf: AudioBuffer): AudioBuffer {
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  let end = l.length;
  while (end > 1 && Math.abs(l[end - 1] ?? 0) < 1e-6 && Math.abs(r[end - 1] ?? 0) < 1e-6) end--;
  let centred = true;
  for (let i = 0; i < end && centred; i++) centred = Math.abs((l[i] ?? 0) - (r[i] ?? 0)) <= 1e-6;
  const out = new AudioBuffer({ length: end, numberOfChannels: centred ? 1 : 2, sampleRate: buf.sampleRate });
  out.copyToChannel(l.subarray(0, end), 0);
  if (!centred) out.copyToChannel(r.subarray(0, end), 1);
  return out;
}
