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
  /** `from` feeds the switch (detach() stops pulling everything upstream). */
  private attached = true;

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

  /** Filter in (true) or out (false) from `now`, crossfading the dry and filtered paths
   *  (`immediate`: switched at `now`, for a render that starts in the middle of a filtered passage). */
  set(on: boolean, now: number, immediate = false): void {
    if (on === this.on) return;
    this.on = on;
    if (on && !this.plugged) {
      if (this.attached) this.from.connect(this.filter);
      this.plugged = true;
    }
    this.unplugAt = on ? Infinity : now + FADE + 0.03;
    for (const [g, v] of [[this.dry.gain, on ? 0 : 1], [this.wet.gain, on ? 1 : 0]] as const) {
      anchor(g, now);
      if (immediate) g.setValueAtTime(v, now);
      else g.linearRampToValueAtTime(v, now + FADE);
      settle(g, immediate ? now : now + FADE, v);
    }
  }

  /** Unplug the filter once its fade-out is over (call regularly). */
  tick(now: number): void {
    if (!this.on && this.plugged && now >= this.unplugAt) {
      if (this.attached) this.from.disconnect(this.filter);
      this.plugged = false;
    }
  }

  /** Stop pulling `from` (nothing upstream renders) or pull it again. */
  attach(on: boolean): void {
    if (on === this.attached) return;
    this.attached = on;
    for (const node of this.plugged ? [this.dry, this.filter] : [this.dry]) {
      if (on) this.from.connect(node);
      else this.from.disconnect(node);
    }
  }

  /** Unplug from the destination for good (its owner is gone). */
  disconnect(): void {
    this.dry.disconnect();
    this.wet.disconnect();
  }
}
