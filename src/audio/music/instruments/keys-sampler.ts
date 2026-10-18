// Sampled electric piano. The Rhodes voice (keys.ts) is rendered once per page into note samples
// (keys-render.ts: every 4 semitones, two velocities), and each note then plays as one buffer
// source (playbackRate covers the pitches in between) + one gain carrying velocity and the note-off
// release: a fraction of the audio-thread cost of four always-running two-oscillator voices.
// Notes longer than a sample, and anything before the samples exist, play on the live voices.
import { FLOOR, fall } from '../../dsp/env';
import { Rhodes } from './keys';
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

export class SampledKeys {
  private live: Rhodes | null = null;

  constructor(private b: Band) {}

  /** Chord with a slight low-to-high roll. */
  chord(t: number, midis: number[], dur: number, vel: number): void {
    const bank = banks.get(this.b.ctx.sampleRate);
    midis.forEach((m, i) => {
      const at = t + i * 0.006 + Math.abs(jitter(this.b)) * 0.004;
      const v = vel * (1 + 0.12 * jitter(this.b));
      if (bank && dur <= KEY_HELD) this.sampled(bank, at, m, dur, v);
      else (this.live ??= new Rhodes(this.b)).note(at, m, dur, v);
    });
  }

  private sampled(bank: AudioBuffer[][], t: number, midi: number, dur: number, vel: number): void {
    const k = Math.min(KEY_COUNT - 1, Math.max(0, Math.round((midi - KEY_LOW) / KEY_STEP)));
    const layer = vel < 0.72 ? 0 : 1;
    const buffer = bank[layer]?.[k];
    if (!buffer) return;
    const ctx = this.b.ctx;
    const src = new AudioBufferSourceNode(ctx, { buffer, playbackRate: Math.pow(2, (midi - KEY_LOW - k * KEY_STEP) / 12) });
    // The live voice's level follows 0.55 + 0.45 · velocity: scale the layer to the note.
    const level = (0.55 + 0.45 * vel) / (0.55 + 0.45 * (KEY_VELS[layer] ?? 1));
    const g = new GainNode(ctx, { gain: level });
    const off = t + Math.max(0.01, dur);
    g.gain.setValueAtTime(level, off);
    fall(g.gain, off, off + KEY_RELEASE, level, level * FLOOR);
    g.gain.linearRampToValueAtTime(0, off + KEY_RELEASE + 0.004);
    src.connect(g).connect(this.b.input('keys'));
    src.start(t);
    src.stop(off + KEY_RELEASE + 0.01);
  }
}
