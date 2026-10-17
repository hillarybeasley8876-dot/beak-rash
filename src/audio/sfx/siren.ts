// Corgi police siren: a little two-tone square "nee-naw" through a speaker-ish filter, placed in
// space each frame (gain / pan / air absorption) and faded in and out with the chase.
import { filter, steer } from '../dsp/env';
import type { Engine } from '../engine';
import type { Placement } from './spatial';

export class Siren {
  private osc: OscillatorNode;
  private lfo: OscillatorNode;
  private gain: GainNode;
  private pan: StereoPannerNode;
  private lp: BiquadFilterNode;
  private level = -1;
  private panned = 0;
  private cutoff = 2600;
  private rate = 1.1;

  constructor(private engine: Engine) {
    const ctx = engine.ctx;
    this.osc = new OscillatorNode(ctx, { type: 'square', frequency: 865 });
    this.lfo = new OscillatorNode(ctx, { type: 'square', frequency: 1.1 });
    this.lfo.connect(new GainNode(ctx, { gain: 95 })).connect(this.osc.frequency);
    this.lp = filter(ctx, { type: 'lowpass', frequency: 2600, Q: 0.8 });
    const speaker = filter(ctx, { type: 'peaking', frequency: 1400, Q: 1.2, gain: 6 });
    this.gain = new GainNode(ctx, { gain: 0 });
    this.pan = new StereoPannerNode(ctx, { pan: 0 });
    this.osc.connect(this.lp).connect(speaker).connect(this.gain).connect(this.pan).connect(engine.sfxIn);
    this.osc.start();
    this.lfo.start();
  }

  /** level 0..1 (0 = off); `place` from the police bike's position; `slow` = time-scale pitch factor. */
  update(level: number, place: Placement, slow: number): void {
    const now = this.engine.now;
    const target = Math.max(0, Math.min(1, level)) * 0.1 * place.gain;
    if (Math.abs(target - this.level) > 0.002) {
      steer(this.gain.gain, now, target, 0.12);
      this.level = target;
    }
    if (Math.abs(place.pan - this.panned) > 0.03) {
      steer(this.pan.pan, now, place.pan, 0.08);
      this.panned = place.pan;
    }
    const cutoff = Math.min(2600, place.lowpass);
    if (Math.abs(cutoff - this.cutoff) > this.cutoff * 0.05) {
      steer(this.lp.frequency, now, cutoff, 0.2);
      this.cutoff = cutoff;
    }
    if (Math.abs(1.1 * slow - this.rate) > 0.03) {
      steer(this.lfo.frequency, now, 1.1 * slow, 0.2);
      this.rate = 1.1 * slow;
    }
  }

  stop(): void {
    const now = this.engine.now;
    steer(this.gain.gain, now, 0, 0.05);
    this.osc.stop(now + 0.3);
    this.lfo.stop(now + 0.3);
    this.osc.onended = () => this.pan.disconnect();
  }
}
