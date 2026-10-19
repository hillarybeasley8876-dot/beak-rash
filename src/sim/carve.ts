// Exit carve: releasing a mini-turbo mid-bend (players let go at the pink sparks, halfway round a hairpin) keeps
// the drift's bite for the rest of that bend. Plain grip holds only ≈ R43 at top speed, so without it the boost
// would carry the bike into the outside wall. While the carve lasts, the curve push beyond driftCarveHold × the
// grip authority is cancelled (at most the drift's own cancel), so the rest of a hairpin needs ~70 % steer, and
// neutral hands only run wide at an angle below the wall-crash angle. It fades once the bend turning the drift's
// way relaxes (or reverses) and after driftCarveMax s, so it never carries over to the next corner.
import { clamp, clamp01, lerp } from '../core/math';
import { TUNING as T } from './tuning';
import type { SimRider } from './state';

/** Arm the carve for a bend turning `dir` (a rewarded release with at least L1 charged). */
export function startCarve(sr: SimRider, dir: -1 | 1): void {
  sr.carve = 1;
  sr.carveDir = dir;
  sr.carveTime = 0;
}

export function stopCarve(sr: SimRider): void {
  sr.carve = 0;
  sr.carveDir = 0;
  sr.carveTime = 0;
}

/** Advance the carve by dt and return the outward curve push (+ = toward −x) that it leaves. */
export function carvedPush(sr: SimRider, push: number, dt: number): number {
  const d = sr.carveDir;
  if (d === 0) return push;
  sr.carveTime += dt;
  const bendOver = sr.frame.curvature * d < T.driftCarveEndKappa || sr.carveTime > T.driftCarveMax;
  if (bendOver || sr.carve < 1) {
    sr.carve -= dt / T.driftCarveFade; // once fading, it never re-arms for a later bend
    if (sr.carve <= 0) {
      stopCarve(sr);
      return push;
    }
  }
  if (push * d <= 0) return push;
  const vNorm = clamp01(sr.r.speed / sr.tune.top);
  const grip = lerp(T.steerAuthLow, T.steerAuthHigh, vNorm) * sr.tune.handling;
  const cancelMax = T.driftCurveCancel * T.steerAuthHigh * sr.tune.handling * vNorm;
  const excess = clamp(Math.abs(push) - T.driftCarveHold * grip, 0, cancelMax);
  return push - d * excess * sr.carve;
}

/** True while a carve is armed or fading (steering keeps the release's |vx| guard on). */
export function carving(sr: SimRider): boolean {
  return sr.carveDir !== 0;
}
