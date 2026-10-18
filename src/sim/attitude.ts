// Visual attitude from the state after this step's integration: yaw = atan2(vx, v) (+ drift slip, oil
// fishtail; rate-limited for a moment after a bounce flips vx in one step), lean = atan(a_lat/g) smoothed,
// pitch to ramps and the air arc.
import { clamp, damp } from '../core/math';
import { TUNING as T } from './tuning';
import { slideOf } from './steering';
import { statusStrength, type SimRider } from './state';

export function attitude(sr: SimRider, dt: number, rampSlope: number): void {
  const r = sr.r;
  const v = r.speed;
  sr.slip = damp(sr.slip, r.drifting ? sr.driftDir * T.driftSlip : 0, T.driftSlipLambda, dt);
  const slide = r.airborne ? 0 : slideOf(sr);
  const tail = slide * Math.sin(sr.slidePhase + 0.8);
  const yaw = clamp(Math.atan2(r.vx, Math.max(v, 1)) + sr.slip + tail * T.slideYaw, -T.yawMax, T.yawMax);
  if (sr.yawEase > 0) {
    sr.yawEase = Math.max(0, sr.yawEase - dt);
    const max = T.yawEaseRate * dt;
    r.yaw += clamp(yaw - r.yaw, -max, max);
  } else {
    r.yaw = yaw;
  }
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
