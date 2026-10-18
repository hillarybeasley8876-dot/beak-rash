// Lateral dynamics. Riding: the lateral velocity chases
//   steer · handling · lerp(4.5, 7.5, v/top)  −  curvature·v²·curvePush  (+ wobble, oil fishtail)
// with time constant gripTau/grip, so input shows on screen the next frame, never overshoots, and fast
// corners need ~60–80 % steer. Drifting: the bike follows the bend (the curve push is cancelled up to
// ×1.35 of the grip authority, so very tight bends still run wide) and steering sets how fast it moves
// across the road; a release hands over to grip steering over 0.2 s. Knocks, hard bumps, wall bounces and
// side swipes open a short carry window: steering that points back at the hazard is weak and the grip
// pulling that way is slow, so the shove reads on screen, while steering away keeps full authority.
import { clamp, clamp01, lerp, smoothstep } from '../core/math';
import { TUNING as T } from './tuning';
import { hasStatus, statusStrength, type SimRider } from './state';
import type { Controls } from '../core/types';
import type { SurfaceMods } from './forces';

/** Combined grip: the lowest of statuses (combat mods), surface, oil and puddle. Never multiplied twice. */
export function gripOf(sr: SimRider, surf: SurfaceMods): number {
  let g = Math.min(sr.r.mods.gripMul, surf.grip);
  if (sr.oilTime > 0) g = Math.min(g, T.oilGrip);
  if (sr.wetTime > 0) g = Math.min(g, T.puddleGrip);
  return Math.max(0.05, g);
}

function steerCtl(sr: SimRider): number {
  return hasStatus(sr.r, 'stun') ? 0 : sr.r.mods.steerMul;
}

/** Lateral authority (m/s) at the current speed. */
export function steerAuthority(sr: SimRider): number {
  const r = sr.r;
  const vNorm = clamp01(r.speed / sr.tune.top);
  return lerp(T.steerAuthLow, T.steerAuthHigh, vNorm) * sr.tune.handling * steerCtl(sr) * clamp01(r.speed / T.steerFullSpeed);
}

/**
 * Open (or extend) a carry window for `time` s: steering toward `dir` (the hazard's side; 0 = every
 * direction) ×`steer`, and the grip lag ≥ `tau` s while it pulls that way.
 */
export function startCarry(sr: SimRider, time: number, steer: number, tau: number, dir: -1 | 0 | 1 = 0): void {
  if (sr.carryTime > 0) {
    sr.carrySteer = Math.min(sr.carrySteer, steer);
    sr.carryTau = Math.max(sr.carryTau, tau);
    if (sr.carryDir !== dir) sr.carryDir = 0; // hazards on both sides: clamp everything
  } else {
    sr.carrySteer = steer;
    sr.carryTau = tau;
    sr.carryDir = dir;
  }
  sr.carryTime = Math.max(sr.carryTime, time);
}

/** Drift: lateral velocity across the road set by steering alone (u = 0 full counter … 1 full into it). */
export function driftTarget(sr: SimRider, steer: number): number {
  const d = sr.driftDir;
  const u = (steer * d + 1) / 2;
  return d * lerp(T.driftLatOut, T.driftLatIn, u) * clamp01(sr.r.speed / sr.tune.top) * steerCtl(sr);
}

/** Outward curve push; a drift cancels it up to ×1.35 of the grip authority (tight bends still run wide). */
function curvePush(sr: SimRider, drifting: boolean): number {
  const push = sr.frame.curvature * sr.r.speed * sr.r.speed * T.curvePush;
  if (!drifting) return push;
  const cancel = T.driftCurveCancel * T.steerAuthHigh * sr.tune.handling * clamp01(sr.r.speed / sr.tune.top);
  return push - clamp(push, -cancel, cancel);
}

/** Oil / puddle fishtail strength 0..1, decaying with the effect timer. */
export function slideOf(sr: SimRider): number {
  const oil = sr.oilTime > 0 ? sr.oilTime / T.oilTime : 0;
  const wetLeft = sr.wetTime - (T.wetTime - T.puddleSlideTime);
  const wet = wetLeft > 0 ? (wetLeft / T.puddleSlideTime) * T.puddleSlide : 0;
  return Math.max(oil, wet);
}

/** Steering command after the carry clamp: only the part pointing at the hazard is weakened. */
function carried(sr: SimRider, cmd: number): number {
  return sr.carryDir === 0 || cmd * sr.carryDir > 0 ? cmd * sr.carrySteer : cmd;
}

export function lateral(sr: SimRider, c: Controls, surf: SurfaceMods, dt: number): void {
  const r = sr.r;
  const v = r.speed;
  const steer = r.mode === 'finished' ? clamp(c.steer, -1, 1) * 0.5 : clamp(c.steer, -1, 1);
  const carry = sr.carryTime > 0;
  sr.carryTime = Math.max(0, sr.carryTime - dt);
  const drifting = r.drifting && sr.driftDir !== 0;
  const cap = T.maxSlipRatio * v;
  const want = drifting ? driftTarget(sr, steer) : clamp(steer * steerAuthority(sr), -cap, cap);
  let cmd = carry ? carried(sr, want) : want;
  if (r.airborne) cmd *= T.airControl;
  const push = curvePush(sr, drifting);
  let target = cmd - push;
  sr.vxWant = (r.airborne ? want * T.airControl : want) - push;
  if (!drifting && sr.driftExit > 0) {
    // Release ramp: hand over from the drift's lateral speed to grip steering instead of darting inward.
    const a = smoothstep(0, 1, 1 - sr.driftExit / T.driftExitTime);
    target = lerp(sr.driftExitVx, target, a);
    sr.driftExit = Math.max(0, sr.driftExit - dt);
  }
  const wob = statusStrength(r, 'wobble') * T.wobbleAmp + (r.airborne ? 0 : surf.wobble);
  if (wob > 0) {
    sr.wobblePhase += T.wobbleFreq * dt;
    target += wob * Math.sin(sr.wobblePhase);
  }
  const slide = r.airborne ? 0 : slideOf(sr);
  if (slide > 0) {
    sr.slidePhase += T.slideFreq * dt;
    target += slide * T.slideSway * Math.sin(sr.slidePhase);
  }
  sr.vxTarget = target;
  let tau = (T.gripTau / gripOf(sr, surf)) * (r.airborne ? T.airTauMul : 1);
  // The carry's slow grip only holds back motion toward the hazard; pulling away from it stays crisp.
  if (carry && (sr.carryDir === 0 || (target - r.vx) * sr.carryDir > 0)) tau = Math.max(tau, sr.carryTau);
  r.vx += (target - r.vx) * (1 - Math.exp(-dt / tau));
  if (drifting) {
    const lim = v * Math.tan(T.driftMaxAngle);
    r.vx = clamp(r.vx, -lim, lim);
  }
}
