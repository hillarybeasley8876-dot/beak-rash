// Sampled electric piano. The Rhodes voice (keys.ts) is rendered once per page into note samples
// (keys-render.ts: every 4 semitones, two velocities), and every chord up to KEY_HELD then plays as
// ONE pre-mixed buffer (premix.ts: notes rolled low to high, resampled to pitch, velocity-scaled and
// released at the note-off in JS) at playbackRate 1: no per-note sources, no release automation, no
// realtime resampling (a resampling source costs the audio thread ≈ 3× a unity-rate one). Chords
// longer than a sample, and anything before the samples exist, play on the live voices.
import { Rhodes } from './keys';
import { offline, playMix, premix, type MixNote } from './premix';
import type { Band } from '../band';

export const KEY_LOW = 47;
export const KEY_STEP = 4;
/** Sample pitches KEY_LOW, KEY_LOW + KEY_STEP, … (47 … 83: the comping range plus the stretch lift). */
export const KEY_COUNT = 10;
export const KEY_VELS = [0.5, 0.95];
/** Longest note (s) a sample covers before its own release (a full bar at 120 bpm). */
export const KEY_HELD = 2;
export const KEY_RELEASE = 0.3;

/** Rendered banks per sample rate: [velocity layer][pitch]. */
const banks = new Map<number, AudioBuffer[][]>();

export function setKeyBank(sampleRate: number, bank: AudioBuffer[][]): void {
  banks.set(sampleRate, bank);
}

export function hasKeyBank(sampleRate: number): boolean {
  return banks.has(sampleRate);
}

/** ±0.5 timing / velocity jitter from the band's Rng (reproducible per band). */
const jitter = (b: Band): number => b.rng.next() - 0.5;

/** Low-to-high roll between a chord's notes (s). */
const ROLL = 0.006;

/** Nearest sample pitch for `midi` and the playback rate that bends it there. */
function slot(midi: number): [number, number] {
  const k = Math.min(KEY_COUNT - 1, Math.max(0, Math.round((midi - KEY_LOW) / KEY_STEP)));
  return [k, Math.pow(2, (midi - KEY_LOW - k * KEY_STEP) / 12)];
}

export class SampledKeys {
  private live: Rhodes | null = null;

  constructor(private b: Band) {}

  /** Chord with a slight low-to-high roll. */
  chord(t: number, midis: number[], dur: number, vel: number): void {
    const bank = banks.get(this.b.ctx.sampleRate);
    if (bank && dur <= KEY_HELD) {
      const notes: MixNote[] = [];
      midis.forEach((m, i) => {
        const v = vel * (1 + 0.12 * jitter(this.b));
        const layer = v < 0.72 ? 0 : 1;
        const [k, rate] = slot(m);
        const buf = bank[layer]?.[k];
        // The live voice's level follows 0.55 + 0.45 · velocity: scale the layer to the note.
        const gain = (0.55 + 0.45 * v) / (0.55 + 0.45 * (KEY_VELS[layer] ?? 1));
        if (buf) notes.push({ buf, rate, gain, pan: 0, at: i * ROLL });
      });
      if (!notes.length) return;
      const ctx = this.b.ctx;
      const mix = { off: Math.max(0.01, dur), release: KEY_RELEASE };
      const at = t + Math.abs(jitter(this.b)) * 0.004;
      if (offline(ctx)) {
        playMix(ctx, notes, mix, at, this.b.input('keys'));
        return;
      }
      const src = new AudioBufferSourceNode(ctx, { buffer: premix(notes, mix, ctx.sampleRate) });
      src.connect(this.b.input('keys'));
      src.start(at);
      return;
    }
    midis.forEach((m, i) => {
      const at = t + i * ROLL + Math.abs(jitter(this.b)) * 0.004;
      (this.live ??= new Rhodes(this.b)).note(at, m, dur, vel * (1 + 0.12 * jitter(this.b)));
    });
  }
}
