// Two clocks: real time (camera cinematics, UI, audio) and sim time (physics, combat, AI).
// Sim time = real time × product of named scale layers, frozen during hit-stop.
// Layers let a KO slow-mo, a pause and a skill's time-warp overlap without fighting.

import { approach } from './math';

export const SIM_STEP = 1 / 120;     // max sim substep (s)
export const MAX_FRAME_DT = 1 / 15;  // clamp for tab switches / long frames

interface Layer { value: number; target: number; rate: number }

export class Clock {
  realTime = 0;
  simTime = 0;
  private layers = new Map<string, Layer>();
  private stopLeft = 0;

  /** Set layer `name` toward `target` over `rampSeconds` (0 = instant). Value 1 removes the layer once reached. */
  setScale(name: string, target: number, rampSeconds = 0): void {
    const layer = this.layers.get(name) ?? { value: 1, target: 1, rate: 0 };
    layer.target = Math.max(0, target);
    layer.rate = rampSeconds > 0 ? Math.abs(layer.target - layer.value) / rampSeconds : Infinity;
    if (layer.rate === Infinity) layer.value = layer.target;
    this.layers.set(name, layer);
  }

  getScale(name: string): number {
    return this.layers.get(name)?.value ?? 1;
  }

  clearScale(name: string): void {
    this.layers.delete(name);
  }

  /** Freeze sim time for `seconds` of real time (impact punctuation). Overlapping calls keep the longest. */
  hitStop(seconds: number): void {
    this.stopLeft = Math.max(this.stopLeft, seconds);
  }

  get frozen(): boolean {
    return this.stopLeft > 0;
  }

  /** Effective multiplier (product of layers), ignoring hit-stop. */
  get scale(): number {
    let s = 1;
    for (const layer of this.layers.values()) s *= layer.value;
    return s;
  }

  /** Advance by one rendered frame. Returns the real and sim deltas for this frame. */
  advance(rawDt: number): { dtReal: number; dtSim: number } {
    const dtReal = Math.min(Math.max(rawDt, 0), MAX_FRAME_DT);
    this.realTime += dtReal;
    for (const [name, layer] of this.layers) {
      layer.value = layer.rate === Infinity ? layer.target : approach(layer.value, layer.target, layer.rate * dtReal);
      if (layer.value === 1 && layer.target === 1) this.layers.delete(name);
    }
    let dtSim = dtReal * this.scale;
    if (this.stopLeft > 0) {
      const frozen = Math.min(this.stopLeft, dtReal);
      this.stopLeft -= frozen;
      dtSim *= 1 - frozen / dtReal;
    }
    this.simTime += dtSim;
    return { dtReal, dtSim };
  }

  /** Split a sim delta into equal substeps no longer than SIM_STEP. */
  static substeps(dtSim: number): { count: number; dt: number } {
    if (dtSim <= 0) return { count: 0, dt: 0 };
    const count = Math.ceil(dtSim / SIM_STEP - 1e-9);
    return { count, dt: dtSim / count };
  }
}
