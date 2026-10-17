// Persistent voices. Re-creating nodes for every note is what costs CPU in WebAudio (graph churn),
// so frequent instruments keep their oscillators / noise sources running for the band's lifetime
// and only automate pitch, filters and a VCA per note. Sources register with the band and stop
// when it is disposed.
import { filter, perc } from '../../dsp/env';
import type { Band } from '../band';

export function osc(b: Band, type: OscillatorType, frequency = 110, detune = 0): OscillatorNode {
  const o = new OscillatorNode(b.ctx, { type, frequency, detune });
  o.start(b.ctx.currentTime);
  b.own(o);
  return o;
}

/**
 * Connects a persistent voice's output only while it sounds. WebAudio only renders nodes the
 * destination pulls, so a sleeping voice (VCA at 0, output unplugged) costs nothing.
 */
export class Gate {
  private plugged = false;
  private until = 0;

  constructor(private out: AudioNode, private dest: AudioNode) {}

  /** Plug in now (we schedule ahead, so this is before the note) and stay awake until `until`. */
  open(until: number): void {
    if (!this.plugged) {
      this.out.connect(this.dest);
      this.plugged = true;
    }
    this.until = Math.max(this.until, until);
  }

  sleep(now: number): void {
    if (this.plugged && now > this.until + 0.05) {
      this.out.disconnect(this.dest);
      this.plugged = false;
    }
  }
}

/** The band's shared looping noise → filter chain → VCA (→ pan) → gated destination. */
export class NoiseVoice {
  readonly vca: GainNode;
  readonly filters: BiquadFilterNode[];
  private gate: Gate;

  constructor(b: Band, filters: BiquadFilterOptions[], dest: AudioNode, pan = 0) {
    const ctx = b.ctx;
    this.filters = filters.map((o) => filter(ctx, o));
    this.vca = new GainNode(ctx, { gain: 0 });
    let head: AudioNode = b.noise;
    for (const f of this.filters) head = head.connect(f);
    head.connect(this.vca);
    const out = pan !== 0 ? this.vca.connect(new StereoPannerNode(ctx, { pan })) : this.vca;
    this.gate = b.gate(out, dest);
  }

  /** Keep the voice plugged in until `until` (for envelopes written directly on `vca`). */
  wake(until: number): void {
    this.gate.open(until);
  }

  hit(t: number, peak: number, attack: number, decay: number): number {
    const end = perc(this.vca.gain, t, peak, attack, decay, true);
    this.gate.open(end);
    return end;
  }
}

/** Round-robin allocator for pooled polyphonic voices (least-recently-freed first). */
export class Pool<V extends { busyUntil: number; startedAt: number }> {
  constructor(readonly voices: V[]) {}

  take(t: number): V {
    let best = this.voices[0];
    if (!best) throw new Error('[audio] empty voice pool');
    for (const v of this.voices) {
      const free = v.busyUntil <= t;
      const bestFree = best.busyUntil <= t;
      if (free && (!bestFree || v.busyUntil < best.busyUntil)) best = v;
      else if (!free && !bestFree && v.startedAt < best.startedAt) best = v;
    }
    return best;
  }
}
