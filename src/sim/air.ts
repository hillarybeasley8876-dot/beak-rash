// Vertical motion in road-relative coordinates: y'' = −g − v²·κv (κv = d(slope)/ds), so sharp crests
// launch naturally when v²·|κv| > g and dips press the bike down. Hops, ramp lips and external lifts
// (combat moving a rider up) all start an air episode; landings decide PERFECT / hard / crash. PERFECT is
// earned at touchdown: hands calm (|steer| < 0.3 for the last 0.15 s) and the bike straight (|yaw| < 6°),
// or Space pressed within 0.2 s before touching down (|yaw| < 12°); steering through the landing misses it.
// While airborne the rider may also trick (SPEC §16, tricks.ts) or glide under an umbrella (SPEC §15):
// both are visual, but a trick left unfinished at touchdown wrecks the rider.
import { TUNING as T } from './tuning';
import { giveBoost } from './drift';
import { crashRider } from './crash';
import { landCompression } from './attitude';
import { resetTrick, updateAirTricks } from './tricks';
import { verticalCurvature, type AirKind, type SimCtx, type SimRider } from './state';
import type { Controls } from '../core/types';

export function startAir(sr: SimRider, kind: AirKind): void {
  const r = sr.r;
  r.airborne = true;
  r.airTime = 0;
  sr.airKind = kind;
  sr.airOwn = true;
  sr.airPeak = r.y;
  sr.airCalm = 0;
  sr.hopPressAt = -1;
  resetTrick(sr); // every air episode starts a fresh chain
}

export function vertical(ctx: SimCtx, sr: SimRider, c: Controls, dt: number): void {
  const r = sr.r;
  if (sr.onRamp) return; // features.ts pins y/vy to the ramp surface this step
  if (r.airborne && !sr.airOwn) startAir(sr, 'external'); // e.g. combat set airborne for the ult
  if (!r.airborne) {
    sr.airOwn = false;
    finishOnGround(r, dt);
    if (r.y > 0.05 || r.vy > 0.5) {
      startAir(sr, 'launch');
    } else if (c.hop && r.mode === 'racing') {
      r.vy = T.hopVy;
      startAir(sr, 'hop');
      ctx.bus.emit('rider:hop', { riderId: r.id });
    } else if (r.speed > T.crestMinSpeed && -verticalCurvature(ctx, r.s) * r.speed * r.speed > T.airGravity) {
      startAir(sr, 'launch');
    } else {
      r.y = 0;
      r.vy = 0;
      return;
    }
  }
  // The trick and the glide of this step (before the gravity: the umbrella cuts it).
  updateAirTricks(ctx, sr, c, dt);
  const g = (sr.airKind === 'hop' ? T.hopGravity : T.airGravity) * (r.gliding ? T.glideGravity : 1);
  // Externally flown riders get gravity too, but whoever flies them rewrites y/vy each step.
  const kv = verticalCurvature(ctx, r.s);
  r.vy += (-g - r.speed * r.speed * kv) * dt;
  r.y += r.vy * dt;
  r.airTime += dt;
  sr.airPeak = Math.max(sr.airPeak, r.y);
  sr.airCalm = Math.abs(c.steer) < T.perfectSteerMax ? sr.airCalm + dt : 0;
  if (c.hop) sr.hopPressAt = r.airTime;
  if (r.y <= 0) land(ctx, sr);
}

function land(ctx: SimCtx, sr: SimRider): void {
  const r = sr.r;
  const air = r.airTime;
  const yawAbs = Math.abs(r.yaw);
  r.airborne = false;
  r.y = 0;
  r.vy = 0;
  r.airTime = 0;
  sr.airOwn = false;
  r.gliding = false;
  if (sr.airKind === 'external') {
    resetTrick(sr);
    return; // the flying unit owns that landing's feedback
  }
  if (!judgeTrick(ctx, sr)) return; // an unfinished trick wrecks the rider
  if (yawAbs > T.crashLandYaw && sr.airPeak > T.crashLandHeight) {
    crashRider(ctx, sr, 'obstacle', null);
    return;
  }
  if (air >= T.landEventMinAir) landCompression(sr, air);
  const minAir = sr.airKind === 'hop' ? T.perfectMinAirHop : T.perfectMinAir;
  const calm = sr.airCalm >= T.perfectCalmTime && yawAbs < T.perfectCalmYaw;
  const timed = sr.hopPressAt >= 0 && air - sr.hopPressAt <= T.perfectHopWindow && yawAbs < T.perfectMaxYaw;
  const perfect = air >= minAir && (calm || timed) && r.mode === 'racing';
  // PERFECT keeps its own boost; a trick chain pays one too and the larger of the two wins.
  let power = 0;
  let time = 0;
  if (perfect) {
    power = T.perfectPower;
    time = T.perfectTime;
  }
  if (r.trickChain >= 1) {
    const count = r.trickChain;
    const points = T.tricks.pointsBase * count + T.tricks.pointsExtra * (count - 1);
    ctx.bus.emit('rider:trick', { riderId: r.id, phase: 'land', kind: sr.lastTrick ?? 'spin', count, points });
    power = Math.max(power, T.tricks.boostPower);
    time = Math.max(time, T.tricks.boostTime * (1 + T.tricks.boostStep * (count - 1)));
  }
  if (power > 0) giveBoost(ctx, sr, 'land', power, time);
  else if (air >= T.hardLandAir) r.speed *= 1 - T.hardLandLoss;
  resetTrick(sr);
  if (sr.finishing) {
    r.trick = sr.finishing; // shown until its rotation completes (finishOnGround)
    sr.finishing = null;
  }
  if (perfect || sr.airKind === 'hop' || (air >= T.landEventMinAir && sr.airPeak >= T.landEventMinPeak)) {
    ctx.bus.emit('rider:land', { riderId: r.id, airTime: air, perfect });
  }
}

/**
 * The trick judgement of a landing (SPEC §16): a spin / flip below tricks.snap done wrecks the rider (cause
 * 'trick'); a nearly finished one snaps to done. A superman still held is a sloppy landing (no points, speed lost,
 * no PERFECT) and its not-yet-started hold is simply dropped — holding Shift into a landing to drift is common.
 * False when the rider crashed.
 */
function judgeTrick(ctx: SimCtx, sr: SimRider): boolean {
  const r = sr.r;
  const trick = r.trick;
  if (!trick) {
    sr.supermanHold = -1;
    return true;
  }
  if (trick.kind === 'superman') {
    ctx.bus.emit('rider:trick', { riderId: r.id, phase: 'fail', kind: 'superman', count: r.trickChain + 1, points: 0 });
    resetTrick(sr);
    r.speed *= 1 - T.tricks.sloppyLoss;
    sr.airCalm = 0;
    return true;
  }
  const kind = trick.kind;
  const progress = trick.t / trick.dur;
  if (progress < T.tricks.snap) {
    ctx.bus.emit('rider:trick', { riderId: r.id, phase: 'fail', kind, count: r.trickChain + 1, points: 0 });
    resetTrick(sr);
    crashRider(ctx, sr, 'trick', null);
    return false;
  }
  sr.finishing = trick; // done: it keeps turning its last degrees after touchdown (view only)
  r.trick = null;
  r.trickChain += 1;
  sr.lastTrick = kind;
  sr.supermanHold = -1;
  return true;
}

/** A trick that landed at ≥ snap finishes its rotation on the ground (visual only), then clears. */
function finishOnGround(r: SimRider['r'], dt: number): void {
  if (!r.trick) return;
  r.trick.t += dt;
  if (r.trick.t >= r.trick.dur) r.trick = null;
}
