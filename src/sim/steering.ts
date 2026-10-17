// Lateral dynamics + visual attitude. Riding: the lateral velocity chases
//   steer · handling · lerp(4.5, 7.5, v/top)  −  curvature·v²·curvePush  (+ wobble, oil fishtail)
// with time constant gripTau/grip, so input shows on screen the next frame, never overshoots, and fast
// corners need ~60–80 % steer. Drifting is road-relative: the bike follows the bend (no curve push) and
// steering only sets how fast it moves across the road. Knocks, hard bumps and wall bounces open a short
// carry window (weak steering, slow grip) so the shove reads on screen instead of being eaten by the lag.
// Yaw = atan2(vx, v) (+ drift slip, fishtail); lean = atan(a_lat/g) smoothed.
import { clamp, clamp01, damp, lerp } from '../core/math';
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

/** Open (or extend) a carry window: steering ×`steer`, grip lag ≥ `tau` s, for `time` s. */
export function startCarry(sr: SimRider, time: number, steer: number, tau: number): void {
  if (sr.carryTime > 0) {
    sr.carrySteer = Math.min(sr.carrySteer, steer);
    sr.carryTau = Math.max(sr.carryTau, tau);
  } else {
    sr.carrySteer = steer;
    sr.carryTau = tau;
  }
  sr.carryTime = Math.max(sr.carryTime, time);
}

/** Drift: lateral velocity across the road set by steering alone (u = 0 full counter … 1 full into it). */
export function driftTarget(sr: SimRider, steer: number): number {
  const d = sr.driftDir;
  const u = (steer * d + 1) / 2;
  return d * lerp(T.driftLatOut, T.driftLatIn, u) * clamp01(sr.r.speed / sr.tune.top) * steerCtl(sr);
}

/** Oil / puddle fishtail strength 0..1, decaying with the effect timer. */
export function slideOf(sr: SimRider): number {
  const oil = sr.oilTime > 0 ? sr.oilTime / T.oilTime : 0;
  const wetLeft = sr.wetTime - (T.wetTime - T.puddleSlideTime);
  const wet = wetLeft > 0 ? (wetLeft / T.puddleSlideTime) * T.puddleSlide : 0;
  return Math.max(oil, wet);
}

export function lateral(sr: SimRider, c: Controls, surf: SurfaceMods, dt: number): void {
  const r = sr.r;
  const v = r.speed;
  const steer = r.mode === 'finished' ? clamp(c.steer, -1, 1) * 0.5 : clamp(c.steer, -1, 1);
  const carry = sr.carryTime > 0;
  sr.carryTime = Math.max(0, sr.carryTime - dt);
  const drifting = r.drifting && sr.driftDir !== 0;
  const cap = T.maxSlipRatio * v;
  let cmd = drifting ? driftTarget(sr, steer) : clamp(steer * steerAuthority(sr), -cap, cap);
  if (carry) cmd *= sr.carrySteer;
  if (r.airborne) cmd *= T.airControl;
  let target = drifting ? cmd : cmd - sr.frame.curvature * v * v * T.curvePush;
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
  if (carry) tau = Math.max(tau, sr.carryTau);
  r.vx += (target - r.vx) * (1 - Math.exp(-dt / tau));
  if (drifting) {
    const lim = v * Math.tan(T.driftMaxAngle);
    r.vx = clamp(r.vx, -lim, lim);
  }
}

/** Visual yaw / lean / pitch from the state after this step's integration. */
export function attitude(sr: SimRider, dt: number, rampSlope: number): void {
  const r = sr.r;
  const v = r.speed;
  sr.slip = damp(sr.slip, r.drifting ? sr.driftDir * T.driftSlip : 0, T.driftSlipLambda, dt);
  const slide = r.airborne ? 0 : slideOf(sr);
  const tail = slide * Math.sin(sr.slidePhase + 0.8);
  r.yaw = clamp(Math.atan2(r.vx, Math.max(v, 1)) + sr.slip + tail * T.slideYaw, -T.yawMax, T.yawMax);
  const aLat = v * v * sr.frame.curvature + T.leanCarve * v * r.vx;
  let lean = Math.atan(aLat / T.gravity) + tail * T.slideLean;
  if (r.drifting) lean += sr.driftDir * T.driftLean;
  if (r.airborne) lean *= 0.5;
  const wob = statusStrength(r, 'wobble');
  if (wob > 0) lean += wob * 0.14 * Math.sin(sr.wobblePhase * 1.3);
  r.lean = damp(r.lean, clamp(lean, -T.leanMax, T.leanMax), T.leanLambda, dt);
  const pitchT = r.airborne
    ? clamp(Math.atan2(r.vy, Math.max(v, 4)) * 0.6, -0.45, 0.45)
    : sr.onRamp ? Math.atan(rampSlope) : 0;
  sr.pitch = damp(sr.pitch, pitchT, T.pitchLambda, dt);
}
