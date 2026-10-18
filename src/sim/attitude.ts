// Visual attitude from the state after this step's integration: yaw = atan2(vx, v) (+ drift slip, oil
// fishtail, the nose pressed into a wall while scraping; rate-limited for a moment after a bounce flips vx in
// one step), lean = atan(a_lat/g) smoothed (+ leaning on a scraped wall), pitch to ramps and the air arc plus
// weight cues: nose dive under braking, squat under acceleration, a compression dip on landing.
import { clamp, damp } from '../core/math';
import { TUNING as T } from './tuning';
import { slideOf } from './steering';
import { statusStrength, type SimRider } from './state';

export function attitude(sr: SimRider, dt: number, rampSlope: number): void {
  const r = sr.r;
  const v = r.speed;
  sr.slip = damp(sr.slip, r.drifting ? sr.driftDir * T.driftSlip : 0, T.driftSlipLambda, dt);
  sr.scrapePose = damp(sr.scrapePose, sr.scrape, T.scrapeLambda, dt);
  const slide = r.airborne ? 0 : slideOf(sr);
  const tail = slide * Math.sin(sr.slidePhase + 0.8);
  const grind = sr.scrapePose * (T.scrapeYaw + Math.abs(sr.scrapePose) * T.scrapeShimmy * Math.sin(r.s * T.scrapeShimmyK));
  const yaw = clamp(Math.atan2(r.vx, Math.max(v, 1)) + sr.slip + tail * T.slideYaw + grind, -T.yawMax, T.yawMax);
  if (sr.yawEase > 0) {
    sr.yawEase = Math.max(0, sr.yawEase - dt);
    const max = T.yawEaseRate * dt;
    r.yaw += clamp(yaw - r.yaw, -max, max);
  } else {
    r.yaw = yaw;
  }
  const aLat = v * v * sr.frame.curvature + T.leanCarve * v * r.vx;
  let lean = Math.atan(aLat / T.gravity) + tail * T.slideLean + sr.scrapePose * T.scrapeLean;
  if (r.drifting) lean += sr.driftDir * T.driftLean;
  if (r.airborne) lean *= 0.5;
  const wob = statusStrength(r, 'wobble');
  if (wob > 0) lean += wob * 0.14 * Math.sin(sr.wobblePhase * 1.3);
  r.lean = damp(r.lean, clamp(lean, -T.leanMax, T.leanMax), T.leanLambda, dt);
  sr.pitch = damp(sr.pitch, pitchTarget(sr, rampSlope), T.pitchLambda, dt);
  sr.landPitch = damp(sr.landPitch, 0, T.landPitchLambda, dt);
}

/** Air arc, ramp slope, or on the road: weight transfer from the forward acceleration + landing compression. */
function pitchTarget(sr: SimRider, rampSlope: number): number {
  const r = sr.r;
  if (r.airborne) return clamp(Math.atan2(r.vy, Math.max(r.speed, 4)) * 0.6, -0.45, 0.45);
  if (sr.onRamp) return Math.atan(rampSlope);
  const weight = sr.accel * (sr.accel < 0 ? T.pitchBrake : T.pitchSquat);
  return clamp(weight, -T.pitchWeightMax, T.pitchWeightMax) + sr.landPitch;
}

/** Touchdown after `air` s: start the nose-down compression dip. */
export function landCompression(sr: SimRider, air: number): void {
  sr.landPitch = -Math.min(T.landPitchMax, T.landPitchBase + T.landPitchAir * air);
}
