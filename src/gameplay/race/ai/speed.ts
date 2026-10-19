// Speed planning: corner speed from curvature ahead (with braking distance), an adaptive grip
// estimate (learns if the physics pushes harder than expected), and when to drift.
import { clamp } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import type { RacingLine } from './line';

const PUSH = 0.8;        // SPEC §6: ax −= curvature · v² · 0.8
const BRAKE_PLAN = 7;    // m/s² deceleration assumed when planning braking points
const SAMPLE = 6;        // m between curvature samples

/** Highest speed that still makes every bend in the braking horizon. */
export function cornerSpeed(line: RacingLine, s: number, v: number, aLat: number): number {
  const horizon = 12 + (v * v) / (2 * BRAKE_PLAN);
  let best = Infinity;
  for (let d = 0; d <= horizon; d += SAMPLE) {
    const k = Math.abs(line.curv(s + d));
    if (k < 1e-4) continue;
    const vCurve = Math.sqrt(aLat / (PUSH * k));
    const allowed = Math.sqrt(vCurve * vCurve + 2 * BRAKE_PLAN * d);
    if (allowed < best) best = allowed;
  }
  return best;
}

/** Learns how much lateral grip the bike really has: shrinks when the rider runs wide. */
export class GripModel {
  aLat: number;
  constructor(private base: number) {
    this.aLat = base;
  }

  update(r: RiderState, steer: number, lateralError: number, curv: number, dt: number): void {
    const outward = Math.sign(curv) !== 0 && Math.sign(lateralError) === Math.sign(curv) && Math.abs(lateralError) > 1.5;
    if (Math.abs(steer) > 0.93 && outward && r.speed > 8) {
      this.aLat = Math.max(3.5, this.aLat - 2.5 * dt);
    } else {
      this.aLat = Math.min(this.base, this.aLat + 0.25 * dt);
    }
  }
}

export interface DriftPlan {
  active: boolean;
  dir: number;       // +1 bend to the right, −1 left
  goal: number;      // seconds of charge wanted before release (L1 0.55 / L2 1.2 / L3 2.0)
  cool: number;      // s before another drift may start (no start/stop flicker)
}

const DRIFT_COOLDOWN = 1.6;

const BEND_K = 0.0042;     // |curvature| worth drifting through (R < ~240 m)
const SKILL_L2 = 0.5, SKILL_L3 = 0.75;   // driving skill that plans a level-2 / level-3 mini-turbo

/** Metres of same-direction bend ahead of s (stops where the bend eases or flips). */
function bendLength(line: RacingLine, s: number, dir: number): number {
  let len = 0;
  for (let d = 0; d < 120; d += 3) {
    const k = line.curv(s + d);
    if (Math.sign(k) !== dir || Math.abs(k) < BEND_K * 0.8) break;
    len = d;
  }
  return len;
}

/**
 * Drift through bends long enough to charge a mini-turbo, release at the wanted level or when the bend
 * ends. `inside` = how far (m) the rider is inside its lateral target: drifts only turn inward.
 */
export function updateDrift(plan: DriftPlan, r: RiderState, line: RacingLine, drifter: number, skill: number, roll: number, inside: number, dt: number): void {
  if (!plan.active) {
    plan.cool -= dt;
    const k = line.curv(r.s);
    if (plan.cool > 0 || r.speed < 11 || r.airborne || roll >= drifter || Math.abs(k) < BEND_K) return;
    if (inside * Math.sign(k) > 0.3) return;   // already inside the line: no room to drift in
    const dir = Math.sign(k);
    const len = bendLength(line, r.s, dir);
    const t = len / r.speed;
    if (t < (skill > SKILL_L3 ? 1.3 : 0.75)) return;
    plan.active = true;
    plan.cool = 0;
    plan.dir = dir;
    plan.goal = t > 2.3 && skill > SKILL_L3 ? 2.05 : t > 1.4 && skill > SKILL_L2 ? 1.25 : 0.6;
    return;
  }
  const ahead = line.curv(r.s + 4);
  const bendOver = Math.abs(ahead) < BEND_K * 0.6 || Math.sign(ahead) !== plan.dir;
  const lost = r.speed < 7 || (!r.drifting && plan.cool < -0.4);   // never started (blocked) or bled out
  if (r.driftCharge >= plan.goal || bendOver || lost || inside > 1.5) {
    plan.active = false;
    plan.cool = DRIFT_COOLDOWN;
  } else {
    plan.cool -= dt;
  }
}

/** Corner speed adjusted for drift (turn authority ×1.35 lets drifters carry more speed). */
export function targetSpeed(base: number, corner: number, drifting: boolean): number {
  return clamp(Math.min(base, drifting ? corner * 1.12 : corner), 0, 60);
}
