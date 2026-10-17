// Longitudinal dynamics: pedalling with a (1 − (v/top)²) taper, brake, coasting drag, slopes,
// overspeed drag (descents settle above top speed) + decay of boost overspeed, boosts (anyone may raise
// boostTime/boostPower), slipstream and drift bleed.
import { clamp01 } from '../core/math';
import { TUNING as T } from './tuning';
import type { Controls } from '../core/types';
import type { SimRider } from './state';

export interface SurfaceMods {
  top: number;     // top-speed multiplier
  grip: number;    // lateral grip multiplier
  wobble: number;  // lateral sway amplitude (m/s)
}

export const NEUTRAL_SURFACE: Readonly<SurfaceMods> = { top: 1, grip: 1, wobble: 0 };

const MAX_SPEED = 60;

/** Flat-road top speed right now, before boosts (bike, statuses, surface, draft). */
export function baseTop(sr: SimRider, surf: SurfaceMods): number {
  const r = sr.r;
  return Math.max(0.1, sr.tune.top * r.mods.speedMul * surf.top * (1 + T.draftTop * r.draft));
}

export function longitudinal(sr: SimRider, c: Controls, surf: SurfaceMods, dt: number): void {
  const r = sr.r;
  const finished = r.mode === 'finished';
  const throttle = finished ? 0 : clamp01(c.throttle);
  const brake = clamp01(c.brake);
  const top0 = baseTop(sr, surf);
  const boosting = r.boostTime > 0 && r.boostPower > 0;
  const top = boosting ? top0 * (1 + r.boostPower) : top0;
  const v = r.speed;
  let a = 0;
  if (r.airborne) {
    a -= T.airDrag;
  } else {
    const pedal = sr.tune.accel * r.mods.accelMul * (1 + T.draftAccel * r.draft) * (r.drifting ? T.driftPedalMul : 1);
    if (v < top0) a += pedal * throttle * (1 - (v / top0) ** 2);
    if (boosting && v < top) a += T.boostAccel * clamp01((top - v) / (0.25 * top));
    const slopeA = -T.gravity * sr.frame.slope * T.slopeK;
    if (v > top) a -= overspeed(v, top, slopeA);
    a -= T.coastDrag * (1 - throttle);
    a -= sr.tune.brake * brake;
    a += slopeA;
    if (r.drifting) a -= T.driftBleed * v;
    if (finished) a -= T.finishBrake;
  }
  r.speed = Math.min(MAX_SPEED, Math.max(0, v + a * dt));
  sr.accel = (r.speed - v) / dt;
}

/**
 * Deceleration above top speed: quadratic drag, so gravity holds a descent at its settle speed
 * sqrt(top² + slopeA/k), plus a linear pull on whatever exceeds that (a boost wearing off).
 */
function overspeed(v: number, top: number, slopeA: number): number {
  const settle = Math.sqrt(top * top + Math.max(0, slopeA) / T.overspeedDrag);
  return T.overspeedDrag * (v * v - top * top) + (v > settle ? T.overspeedDecay * (v - settle) : 0);
}

/** Count down the shared boost; power resets with the timer so stale powers never linger. */
export function tickBoost(sr: SimRider, dt: number): void {
  const r = sr.r;
  if (r.boostTime > 0) r.boostTime = Math.max(0, r.boostTime - dt);
  if (r.boostTime <= 0) r.boostPower = 0;
}
