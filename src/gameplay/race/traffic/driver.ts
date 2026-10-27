// One traffic vehicle's behaviour in track space: keep lane, follow the car ahead, change lanes with
// blinkers, brake for riders lying in the road, hazard lights after a crash, honk at riders.
import { clamp } from '../../../core/math';
import type { Rng } from '../../../core/rng';
import type { Obstacle, RiderState } from '../../../core/types';
import type { VehicleDef } from './types';

export const BLINK_LEAD = 1.0;     // s of blinking before moving over
const LANE_RATE = 1.6;           // m/s of sideways movement in a normal lane change
const MERGE_RATE = 2.6;          // m/s of sideways movement when merging around a solid obstacle
const ACCEL = 2.2;
const DECEL = 7;

export interface Vehicle {
  readonly def: VehicleDef;
  readonly ob: Obstacle;
  readonly dir: 1 | -1;            // +1 = with the race, −1 = oncoming
  readonly color: string;
  lane: number;                    // ±1 inner, ±2 outer (sign = side of the road)
  xTarget: number;                 // the lateral position the vehicle is heading for
  merging: boolean;                // the move is a merge around a solid obstacle (blinkers on)
  hold: boolean;                   // the move waits for a gap: the vehicle holds its line
  gap: number;                     // the gap to the nearest thing ahead (debug)
  blinkT: number;                  // s of blinking left before moving
  cruise: number;
  speed: number;                   // ≥ 0, along dir
  braking: boolean;
  hazard: number;                  // s of hazard lights / stop after a crash
  honkCd: number;
  laneCd: number;
  wheelDist: number;
  vxl: number;                     // lateral speed (m/s) for heading
  slot: number;
  g: number;
}

/** Lateral centre of lane `lane` where the asphalt half-width is `hw` (4 lanes when wide, else 2). */
export function laneX(lane: number, hw: number): number {
  const side = Math.sign(lane);
  if (hw < 5.6) return side * hw * 0.5;
  return side * hw * (Math.abs(lane) >= 2 ? 0.75 : 0.25);
}

export interface Surroundings {
  /** Gap (m, bumper to bumper) and speed of the nearest thing ahead in this lane. */
  leaderGap: number;
  leaderSpeed: number;
  /** A rider is in this vehicle's path close ahead (closing) — honk-worthy. */
  riderAhead: RiderState | null;
}

/** Head for the lateral position `x` (a lane change, or a merge around a solid obstacle). */
export function startMove(v: Vehicle, x: number, merging: boolean): void {
  v.xTarget = x;
  v.merging = merging;
  v.hold = false;
  v.blinkT = BLINK_LEAD;
}

/** Advance one vehicle by dt. Returns true when it wants to honk. */
export function driveVehicle(v: Vehicle, env: Surroundings, dt: number, rng: Rng): boolean {
  v.honkCd -= dt;
  v.laneCd -= dt;
  v.hazard = Math.max(0, v.hazard - dt);
  let want = v.cruise;
  if (v.hazard > 1.2) want = 0;
  const safe = 6 + v.speed * 1.1;
  if (env.leaderGap < safe) want = Math.min(want, Math.max(0, env.leaderSpeed + (env.leaderGap - safe * 0.5) * 0.6));
  const prev = v.speed;
  v.speed = Math.max(0, v.speed + clamp(want - v.speed, -DECEL * dt, ACCEL * dt));
  v.braking = v.speed < prev - 0.5 * dt || (want < v.speed - 0.3);
  // The lateral move: toward the target, at a limited rate (a merge is quicker than a lane change).
  const x0 = v.ob.x;
  if (!v.hold) {
    const dx = v.xTarget - x0;
    const maxRate = v.merging ? MERGE_RATE : LANE_RATE;
    const rate = Math.min(maxRate, Math.abs(dx) * 2.5);
    v.ob.x = x0 + clamp(dx, -rate * dt, rate * dt);
  }
  v.vxl = (v.ob.x - x0) / Math.max(dt, 1e-4);
  v.ob.s += v.dir * v.speed * dt;
  v.ob.speed = v.dir * v.speed;
  v.wheelDist += v.speed * dt;
  if (env.riderAhead && v.honkCd <= 0) {
    v.honkCd = rng.range(2.5, 4.5);
    return true;
  }
  return false;
}

/** Blinkers: [left, right] lit this instant (hazards = both). */
export function blinkers(v: Vehicle, time: number): [boolean, boolean] {
  const on = Math.floor(time * 2.6) % 2 === 0;
  if (v.hazard > 0) return [on, on];
  if (!v.merging && Math.abs(v.xTarget - v.ob.x) <= 0.25) return [false, false];
  // The vehicle's own left/right: for oncoming traffic the road's left is the driver's right.
  const right = v.dir > 0 ? v.xTarget > v.ob.x : v.xTarget < v.ob.x;
  return [on && !right, on && right];
}
