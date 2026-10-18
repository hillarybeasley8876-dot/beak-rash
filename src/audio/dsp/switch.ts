// A filter that sits in the signal path only while it does something. Muffle low-passes and the KO
// bass-drop high-pass are wide open (inaudible) almost all the time, yet a running biquad costs
// about twice an oscillator on the audio thread. The switch keeps a dry path and plugs the filter
// in with a 20 ms crossfade when needed, then unplugs it again once it has faded out.
import { anchor, settle } from './env';

const FADE = 0.02;

export class FilterSwitch {
  private dry: GainNode;
  private wet: GainNode;
  private on = false;
  private plugged = false;
  private unplugAt = Infinity;

  constructor(private from: AudioNode, readonly filter: BiquadFilterNode, to: AudioNode) {
    const ctx = filter.context;
    this.dry = new GainNode(ctx, { gain: 1 });
    this.wet = new GainNode(ctx, { gain: 0 });
    from.connect(this.dry).connect(to);
    filter.connect(this.wet).connect(to);
  }

  get engaged(): boolean {
    return this.on;
  }

  /** Filter in (true) or out (false) from `now`, crossfading the dry and filtered paths. */
  set(on: boolean, now: number): void {
    if (on === this.on) return;
    this.on = on;
    if (on && !this.plugged) {
      this.from.connect(this.filter);
      this.plugged = true;
    }
    this.unplugAt = on ? Infinity : now + FADE + 0.03;
    for (const [g, v] of [[this.dry.gain, on ? 0 : 1], [this.wet.gain, on ? 1 : 0]] as const) {
      anchor(g, now);
      g.linearRampToValueAtTime(v, now + FADE);
      settle(g, now + FADE, v);
    }
  }

  /** Unplug the filter once its fade-out is over (call regularly). */
  tick(now: number): void {
    if (!this.on && this.plugged && now >= this.unplugAt) {
      this.from.disconnect(this.filter);
      this.plugged = false;
    }
  }
}
