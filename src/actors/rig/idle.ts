// Idle micro-motions layered on top of the ride pose: cat tail swish, shiba tail wag, corgi stub wiggle,
// ear flop that follows the pedalling bounce (ears sweep back with speed), and a loose wobbling hat
// (the capybara's yuzu). Only touches bones the ride rig leaves at rest (tail, ears) plus an additive
// hat roll, so it runs after RidePose.update and before PoseState.apply.
import { Euler, Quaternion } from 'three';
import { clamp, clamp01 } from '../../core/math';
import type { SpeciesDef } from '../species/types';
import type { PoseState } from './pose-state';
import { B } from './skeleton';

const e = new Euler(0, 0, 0, 'YXZ');
const q = new Quaternion();

/** Tail motion per tail kind: [frequency (rad/s), base yaw amplitude, tip yaw amplitude, tip lag]. */
const TAIL: Partial<Record<SpeciesDef['meta']['tail'], readonly [number, number, number, number]>> = {
  long: [1.9, 0.3, 0.45, 0.9],  // lazy swish
  curl: [11, 0.22, 0.14, 0.6],  // happy wag
  stub: [7.5, 0.28, 0.2, 0.4],  // corgi butt wiggle
};

export class IdleMotion {
  private t: number;
  private bounce = 0;
  private wobble = 0;
  private wobbleV = 0;

  constructor(private readonly ps: PoseState, private readonly def: SpeciesDef, phase: number) {
    this.t = phase * 10;
  }

  /** `speed` m/s, `accel` m/s² (smoothed): the hat wobble springs back from speed changes. */
  update(speed: number, accel: number, dt: number): void {
    const ps = this.ps, m = this.def.meta;
    this.t += dt;
    const pedalling = clamp01(speed / 3);
    this.bounce += dt * (5 + speed * 0.9) * pedalling;
    const tail = TAIL[m.tail];
    if (tail) {
      const [f, a0, a1, lag] = tail;
      const calm = m.tail === 'long' ? 1 : 0.6 + 0.4 * pedalling;
      ps.lq[B.tail1]?.premultiply(q.setFromEuler(e.set(0, Math.sin(this.t * f) * a0 * calm, 0)));
      ps.lq[B.tail2]?.premultiply(q.setFromEuler(e.set(0, Math.sin(this.t * f - lag) * a1 * calm, Math.sin(this.t * f * 0.5) * 0.08)));
    }
    const ear = m.earFlop ?? 0;
    if (ear > 0) {
      const sweep = clamp(speed / 20, 0, 1) * 0.35;
      for (const [bone, s] of [[B.earL, -1], [B.earR, 1]] as const) {
        const flop = Math.sin(this.bounce * 2 + (s > 0 ? 0.5 : 0)) * ear * (0.4 + 0.6 * pedalling) + Math.sin(this.t * 1.3) * ear * 0.25;
        ps.lq[bone]?.premultiply(q.setFromEuler(e.set(sweep, 0, -s * flop)));
      }
    }
    const hat = m.hatWobble ?? 0;
    if (hat > 0) {
      // Damped spring kicked by acceleration and the pedalling bounce.
      this.wobbleV += (-this.wobble * 60 - this.wobbleV * 4 + accel * 0.08 + Math.sin(this.bounce * 2) * 0.6 * pedalling) * dt;
      this.wobble = clamp(this.wobble + this.wobbleV * dt, -1, 1);
      ps.lq[B.hat]?.premultiply(q.setFromEuler(e.set(this.wobble * hat * 0.6, 0, this.wobble * hat + Math.sin(this.t * 2.6) * hat * 0.3)));
    }
    ps.fkChain([B.hat, B.earL, B.earR, B.tail1, B.tail2]);
  }
}
