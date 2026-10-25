// Corgi police siren: the two-tone "nee-naw" through its speaker filter, pre-rendered as a seamless
// loop (sfx/loop-buffers.ts) and played as one buffer source → gain → panner, placed in space each
// frame (gain / pan) and faded in and out with the chase. Slow-mo plays the loop slower (pitch and
// switching rate follow the clock, as the live oscillator's LFO did).
import { holdAt, steer } from '../dsp/env';
import { loopBuffer } from './loop-buffers';
import type { Engine } from '../engine';
import type { Placement } from './spatial';

export class Siren {
  private src: AudioBufferSourceNode;
  private gain: GainNode;
  private pan: StereoPannerNode;
  private level = -1;
  private panned = 0;
  private rate = 1;

  constructor(private engine: Engine) {
    const ctx = engine.ctx;
    this.src = new AudioBufferSourceNode(ctx, { buffer: loopBuffer(ctx, 'siren'), loop: true });
    this.gain = new GainNode(ctx, { gain: 0 });
    this.pan = new StereoPannerNode(ctx, { pan: 0 });
    this.src.connect(this.gain).connect(this.pan).connect(engine.sfxIn);
    this.src.start();
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
    // A ramp that lands exactly on the rate: a source that never quite reaches 1 keeps resampling.
    const rate = Math.abs(slow - 1) < 0.03 ? 1 : slow;
    if (rate !== this.rate) {
      holdAt(this.src.playbackRate, now);
      this.src.playbackRate.linearRampToValueAtTime(rate, now + 0.2);
      this.rate = rate;
    }
  }

  stop(): void {
    const now = this.engine.now;
    steer(this.gain.gain, now, 0, 0.05);
    this.src.stop(now + 0.3);
    this.src.onended = () => this.pan.disconnect();
  }
}
