// Low-level driving: lateral position → steer (P + learned bias, so curve push and unknown physics
// tuning are compensated), target speed → throttle/brake, smoothed like a human hand.
import { BIKES } from '../../../data/bikes';
import { ROSTER } from '../../../data/roster';
import { clamp, damp, lerp } from '../../../core/math';
import type { Controls, RiderState } from '../../../core/types';

const KP = 2.4;          // 1/s lateral position gain
const KI = 1.6;          // 1/s bias learning rate
const BIAS_MAX = 0.75;

/** Flat-road top speed estimate: bike × character speed stat (SPEC §6 ratings). */
export const topOf = (r: RiderState): number => BIKES[r.bike].topSpeed * (1 + 0.025 * (ROSTER[r.character].stats.speed - 4));
export const handlingOf = (r: RiderState): number => BIKES[r.bike].handling * (1 + 0.04 * (ROSTER[r.character].stats.handling - 4));

export class Driver {
  steer = 0;
  private bias = 0;

  /** Steering authority estimate in m/s of lateral velocity per unit steer (SPEC §6 model). */
  authority(r: RiderState): number {
    const v = Math.max(0, r.speed);
    const fade = clamp(v / 4, 0.25, 1);
    return handlingOf(r) * lerp(4.5, 7.5, clamp(v / topOf(r), 0, 1)) * fade * Math.max(0.05, r.mods.steerMul);
  }

  /** Authority at top speed: what the rider has to fight the curve push with. */
  authorityAtTop(r: RiderState): number {
    return handlingOf(r) * 7.5;
  }

  /** Steer toward lateral target `tx`; `urgency` 0..1 widens the allowed lateral speed. */
  steerTo(r: RiderState, tx: number, urgency: number, dt: number, c: Controls): void {
    const auth = this.authority(r);
    const vxMax = auth * lerp(0.45, 0.95, urgency);
    const vxCmd = clamp((tx - r.x) * KP, -vxMax, vxMax);
    const learning = !r.airborne && r.mods.steerMul > 0.3 && r.speed > 3 && r.mode === 'racing';
    if (learning) {
      this.bias = clamp(this.bias + ((vxCmd - r.vx) / auth) * KI * dt, -BIAS_MAX, BIAS_MAX);
    } else {
      this.bias = damp(this.bias, 0, 2, dt);
    }
    const want = clamp(vxCmd / auth + this.bias, -1, 1);
    this.steer = damp(this.steer, want, 16, dt);
    c.steer = this.steer;
  }

  /**
   * While drifting the sim pulls the bike into the bend; steering only scales how hard (counter-steer =
   * least pull). P-control in "drift space": steer into the drift to tighten, against it to run wider.
   */
  steerDrift(r: RiderState, tx: number, dir: number, dt: number, c: Controls): void {
    const inward = (tx - r.x) * dir;
    const want = dir * clamp(inward * 1.1 - r.vx * dir * 0.12, -1, 1);
    this.steer = damp(this.steer, want, 16, dt);
    this.bias = damp(this.bias, 0, 2, dt);
    c.steer = this.steer;
  }

  /** Pedal/brake toward `target` m/s; `soft` = only ease off the pedals, never brake. */
  speedTo(r: RiderState, target: number, c: Controls, soft = false): void {
    const err = target - r.speed;
    if (err > 0.4) {
      c.throttle = 1;
      c.brake = 0;
    } else if (err > -0.6) {
      c.throttle = clamp(0.55 + err, 0, 1);
      c.brake = 0;
    } else {
      c.throttle = 0;
      c.brake = soft ? 0 : clamp(-err / 5, 0.12, 1);
    }
  }

  reset(): void {
    this.bias = 0;
    this.steer = 0;
  }
}
