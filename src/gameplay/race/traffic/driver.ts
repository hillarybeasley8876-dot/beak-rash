// One traffic vehicle's behaviour in track space: keep lane, follow the car ahead, change lanes with
// blinkers, brake for riders lying in the road, hazard lights after a crash, honk at riders.
import { clamp, smoothstep } from '../../../core/math';
import type { Rng } from '../../../core/rng';
import type { Obstacle, RiderState } from '../../../core/types';
import type { VehicleDef } from './types';

export const BLINK_LEAD = 1.0;     // s of blinking before moving over
const CHANGE_TIME = 2.3;           // s to cross one lane
const ACCEL = 2.2;
const DECEL = 7;

export interface Vehicle {
  readonly def: VehicleDef;
  readonly ob: Obstacle;
  readonly dir: 1 | -1;            // +1 = with the race, −1 = oncoming
  readonly color: string;
  lane: number;                    // ±1 inner, ±2 outer (sign = side of the road)
  fromLane: number;
  laneT: number;                   // 0..1 progress of a lane change (1 = settled)
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

/** Current lateral position, interpolating an ongoing lane change. */
export function vehicleX(v: Vehicle, hw: number): number {
  const a = laneX(v.fromLane, hw), b = laneX(v.lane, hw);
  return a + (b - a) * smoothstep(0, 1, v.laneT);
}

export interface Surroundings {
  /** Gap (m, bumper to bumper) and speed of the nearest thing ahead in this lane. */
  leaderGap: number;
  leaderSpeed: number;
  /** A rider is in this vehicle's path close ahead (closing) — honk-worthy. */
  riderAhead: RiderState | null;
}

export function startLaneChange(v: Vehicle, to: number): void {
  v.fromLane = v.lane;
  v.lane = to;
  v.laneT = 0;
  v.blinkT = BLINK_LEAD;
}

/** Advance one vehicle by dt. Returns true when it wants to honk. */
export function driveVehicle(v: Vehicle, env: Surroundings, hw: number, dt: number, rng: Rng): boolean {
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
  const x0 = vehicleX(v, hw);
  if (v.laneT < 1) {
    if (v.blinkT > 0) v.blinkT -= dt;
    else v.laneT = Math.min(1, v.laneT + dt / CHANGE_TIME);
  }
  const x1 = vehicleX(v, hw);
  v.vxl = (x1 - x0) / Math.max(dt, 1e-4);
  v.ob.s += v.dir * v.speed * dt;
  v.ob.x = x1;
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
  if (v.laneT >= 1) return [false, false];
  // Vehicle's own left/right: for oncoming traffic the road's left is the driver's right.
  const towardRoadRight = laneX(v.lane, 7) > laneX(v.fromLane, 7);
  const right = v.dir > 0 ? towardRoadRight : !towardRoadRight;
  return [on && !right, on && right];
}
