// Sampled clavinet: the live clav's pulse through its envelope wah and pluck (keys.ts) rendered per
// pitch zone and velocity layer (bank.ts), and each double-stop pre-mixed from its two notes into
// one buffer (premix.ts) at rate 1, with the release baked: one buffer source per hit instead of a
// persistent two-oscillator voice with an envelope band-pass. Muted scratches stay samples. Before
// the bank exists, and for notes outside it, the live voice plays.
import { midiToHz } from '../theory';
import { CLAV_DUTY, CLAV_LEVEL, CLAV_MAX, CLAV_RELEASE, Clav, clavAmp, clavWah } from './keys';
import { bankOf, layerOf, prepareBank, zoneOf, type BankSpec } from './bank';
import { playSample } from './drum-samples';
import { premix, type MixNote } from './premix';
import { pulseWave } from '../../dsp/curves';
import { filter } from '../../dsp/env';
import type { Band } from '../band';

const SPEC: BankSpec = {
  id: 'clav', low: 55, step: 3, count: 10, vels: [0.6, 1], variants: 1, held: CLAV_MAX, tail: 0.12,
  play(b, dest, t, midi, vel) {
    const ctx = b.ctx;
    const o = new OscillatorNode(ctx, { frequency: midiToHz(midi) });
    o.setPeriodicWave(pulseWave(ctx, CLAV_DUTY));
    const wah = filter(ctx, { type: 'bandpass', frequency: 900, Q: 1.6 });
    const amp = new GainNode(ctx, { gain: 0 });
    o.connect(new GainNode(ctx, { gain: CLAV_LEVEL })).connect(wah).connect(amp).connect(dest);
    clavWah(wah.frequency, t, vel);
    const end = clavAmp(amp.gain, t, CLAV_MAX, vel);
    o.start(t);
    o.stop(end + 0.01);
  },
};

export function prepareClavSamples(sampleRate: number): Promise<void> {
  return prepareBank(SPEC, sampleRate);
}

export class SampledClav {
  private live: Clav | null = null;
  private mutes = 0;

  constructor(private b: Band) {}

  /** A double-stop on the first two notes of `midis`. */
  hit(t: number, midis: number[], dur: number, vel: number): void {
    const notes = this.mix(midis, vel);
    if (!notes) {
      (this.live ??= new Clav(this.b)).hit(t, midis, dur, vel);
      return;
    }
    const ctx = this.b.ctx;
    const src = new AudioBufferSourceNode(ctx, { buffer: premix(notes, { off: Math.min(dur, CLAV_MAX), release: CLAV_RELEASE }, ctx.sampleRate) });
    src.connect(this.b.input('clav'));
    src.start(t);
  }

  mute(t: number, vel: number): void {
    playSample(this.b.ctx, 'clavMute', this.mutes++, t, 0.16 * vel, this.b.input('clav'));
  }

  private mix(midis: number[], vel: number): MixNote[] | null {
    const bank = bankOf(SPEC, this.b.ctx.sampleRate);
    if (!bank || midis.length === 0) return null;
    const layer = layerOf(SPEC, vel);
    const set = bank[0]?.[layer];
    const gain = vel / (SPEC.vels[layer] ?? 1);
    const out: MixNote[] = [];
    for (let i = 0; i < 2; i++) {
      const z = zoneOf(SPEC, midis[Math.min(i, midis.length - 1)] ?? 60);
      const buf = z ? set?.[z.zone] : undefined;
      if (!z || !buf) return null;
      // The live voice's two oscillators sit a few cents apart (its Rng jitter).
      out.push({ buf, rate: z.rate * Math.pow(2, ((this.b.rng.next() - 0.5) * 6) / 1200), gain, pan: 0 });
    }
    return out;
  }
}
