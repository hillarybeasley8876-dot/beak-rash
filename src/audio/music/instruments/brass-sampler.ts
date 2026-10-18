// Sampled brass section: the live section's saw (brass.ts: scoop / rip, "bwah" filter sweep,
// envelope) rendered per pitch zone and velocity layer (bank.ts), and each stab pre-mixed from
// four notes into one stereo buffer (premix.ts) with the slots spread left / right: one buffer
// source per stab instead of a persistent 4-saw voice. Falls bend during the release in the mix.
// Before the bank exists, and for notes outside it or held longer than it covers, the live voice plays.
import { midiToHz } from '../theory';
import { BRASS_DETUNE, Brass, brassAmp, brassFilter, brassPitch, brassRelease, brassVoicing, type BrassKind } from './brass';
import { bankOf, layerOf, prepareBank, zoneOf, type BankSpec } from './bank';
import { premix, type MixNote } from './premix';
import { filter } from '../../dsp/env';
import type { Band } from '../band';

/** Voicing slots 1 + 3 left, 2 + 4 right: a horn section, not one synth voice. */
const SLOT_PAN = [-0.32, 0.32, -0.32, 0.32];
const HELD = 1.2;

const SPEC: BankSpec = {
  id: 'brass', low: 46, step: 4, count: 11, vels: [0.75, 1], variants: 2, held: HELD, tail: 0.3,
  play(b, dest, t, midi, vel, variant) {
    const ctx = b.ctx;
    const kind: BrassKind = variant === 1 ? 'rip' : 'hit';
    const o = new OscillatorNode(ctx, { type: 'sawtooth', frequency: midiToHz(midi) });
    const lp = filter(ctx, { type: 'lowpass', frequency: 400, Q: 1.6 });
    const amp = new GainNode(ctx, { gain: 0 });
    o.connect(lp).connect(amp).connect(dest);
    brassPitch(o.frequency, t, midiToHz(midi), kind, t + HELD);
    brassFilter(lp.frequency, t, vel);
    const end = brassAmp(amp.gain, t, HELD, vel, kind);
    o.start(t);
    o.stop(end + 0.01);
  },
};

export function prepareBrassSamples(sampleRate: number): Promise<void> {
  return prepareBank(SPEC, sampleRate);
}

export class SampledBrass {
  private live: Brass | null = null;

  constructor(private b: Band) {}

  stab(t: number, midis: number[], dur: number, vel: number, kind: BrassKind = 'hit'): void {
    const notes = this.mix(midis, dur, vel, kind);
    if (!notes) {
      (this.live ??= new Brass(this.b)).stab(t, midis, dur, vel, kind);
      return;
    }
    const ctx = this.b.ctx;
    const buffer = premix(notes, { off: Math.max(dur, 0.05), release: brassRelease(kind), fall: kind === 'fall' ? 7 : 0 }, ctx.sampleRate);
    const src = new AudioBufferSourceNode(ctx, { buffer });
    src.connect(this.b.input('brass'));
    src.start(t);
  }

  /** The stab's four notes from the bank (null = the live voice has to play it). */
  private mix(midis: number[], dur: number, vel: number, kind: BrassKind): MixNote[] | null {
    const bank = bankOf(SPEC, this.b.ctx.sampleRate);
    if (!bank || dur > HELD) return null;
    const layer = layerOf(SPEC, vel);
    const set = bank[kind === 'rip' ? 1 : 0]?.[layer];
    const gain = vel / (SPEC.vels[layer] ?? 1);
    const out: MixNote[] = [];
    for (const [s, m] of brassVoicing(midis).entries()) {
      const z = zoneOf(SPEC, m);
      const buf = z ? set?.[z.zone] : undefined;
      if (!z || !buf) return null;
      out.push({ buf, rate: z.rate * Math.pow(2, (BRASS_DETUNE[s] ?? 0) / 1200), gain, pan: SLOT_PAN[s] ?? 0 });
    }
    return out;
  }
}
