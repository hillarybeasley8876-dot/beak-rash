// Sampled pad: the live pad's detuned saw through its slowly opening low-pass and swell (keys.ts)
// rendered per pitch zone at half rate (it never passes 1.5 kHz: half the memory, bank.ts), and
// each chord pre-mixed from its notes into one stereo buffer (premix.ts) with the voices spread
// left / right: one buffer source per chord instead of four persistent saws and a filter.
// Consecutive chords overlap (release under the next swell) where the live pad glides; before the
// bank exists, and for chords it does not cover, the live voice plays.
import { midiToHz } from '../theory';
import { PAD_DETUNE, PAD_RELEASE, Pad, padAmp, padFilter } from './keys';
import { bankOf, layerOf, prepareBank, zoneOf, type BankSpec } from './bank';
import { offline, playMix, premix, type MixNote } from './premix';
import { filter } from '../../dsp/env';
import type { Band } from '../band';

/** Voices alternate left / right (width without a delay line). */
const VOICE_PAN = [-0.6, 0.6, -0.6, 0.6];
const HELD = 4.2;

const SPEC: BankSpec = {
  id: 'pad', low: 46, step: 3, count: 11, vels: [0.85], variants: 1, held: HELD, tail: PAD_RELEASE + 0.1, renderRate: 16000,
  play(b, dest, t, midi, vel) {
    const ctx = b.ctx;
    const o = new OscillatorNode(ctx, { type: 'sawtooth', frequency: midiToHz(midi) });
    const lp = filter(ctx, { type: 'lowpass', frequency: 700, Q: 0.8 });
    const amp = new GainNode(ctx, { gain: 0 });
    o.connect(lp).connect(amp).connect(dest);
    padFilter(lp.frequency, t, HELD);
    const end = padAmp(amp.gain, t, HELD, vel);
    o.start(t);
    o.stop(end + 0.01);
  },
};

export function preparePadSamples(sampleRate: number): Promise<void> {
  return prepareBank(SPEC, sampleRate);
}

export class SampledPad {
  private live: Pad | null = null;

  constructor(private b: Band) {}

  chord(t: number, midis: number[], dur: number, vel: number): void {
    const notes = this.mix(midis, dur, vel);
    if (!notes) {
      (this.live ??= new Pad(this.b)).chord(t, midis, dur, vel);
      return;
    }
    const ctx = this.b.ctx;
    const mix = { off: dur, release: PAD_RELEASE };
    if (offline(ctx)) {
      playMix(ctx, notes, mix, t, this.b.input('pad'));
      return;
    }
    // Mixed at the bank's half rate (half the main-thread work; the source resamples a low-passed pad).
    const src = new AudioBufferSourceNode(ctx, { buffer: premix(notes, mix, SPEC.renderRate ?? ctx.sampleRate) });
    src.connect(this.b.input('pad'));
    src.start(t);
  }

  /** The chord's four voices from the bank (null = the live voice has to play it). */
  private mix(midis: number[], dur: number, vel: number): MixNote[] | null {
    const bank = bankOf(SPEC, this.b.ctx.sampleRate);
    if (!bank || dur > HELD || midis.length === 0) return null;
    const set = bank[0]?.[layerOf(SPEC, vel)];
    const gain = vel / (SPEC.vels[0] ?? 1);
    const out: MixNote[] = [];
    for (let i = 0; i < 4; i++) {
      const m = midis[i % midis.length] ?? 60;
      const z = zoneOf(SPEC, m);
      const buf = z ? set?.[z.zone] : undefined;
      if (!z || !buf) return null;
      out.push({ buf, rate: z.rate * Math.pow(2, PAD_DETUNE(i) / 1200), gain, pan: VOICE_PAN[i] ?? 0 });
    }
    return out;
  }
}
