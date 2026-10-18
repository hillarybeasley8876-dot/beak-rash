// Vertical motion in road-relative coordinates: y'' = −g − v²·κv (κv = d(slope)/ds), so sharp crests
// launch naturally when v²·|κv| > g and dips press the bike down. Hops, ramp lips and external lifts
// (combat moving a rider up) all start an air episode; landings decide PERFECT / hard / crash. PERFECT is
// earned at touchdown: hands calm (|steer| < 0.3 for the last 0.15 s) and the bike straight (|yaw| < 6°),
// or Space pressed within 0.2 s before touching down (|yaw| < 12°); steering through the landing misses it.
import { TUNING as T } from './tuning';
import { giveBoost } from './drift';
import { crashRider } from './crash';
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
}

export function vertical(ctx: SimCtx, sr: SimRider, c: Controls, dt: number): void {
  const r = sr.r;
  if (sr.onRamp) return; // features.ts pins y/vy to the ramp surface this step
  if (r.airborne && !sr.airOwn) startAir(sr, 'external'); // e.g. combat set airborne for the ult
  if (!r.airborne) {
    sr.airOwn = false;
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
  const g = sr.airKind === 'hop' ? T.hopGravity : T.airGravity;
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
  if (sr.airKind === 'external') return; // the flying unit owns that landing's feedback
  if (yawAbs > T.crashLandYaw && sr.airPeak > T.crashLandHeight) {
    crashRider(ctx, sr, 'obstacle', null);
    return;
  }
  const minAir = sr.airKind === 'hop' ? T.perfectMinAirHop : T.perfectMinAir;
  const calm = sr.airCalm >= T.perfectCalmTime && yawAbs < T.perfectCalmYaw;
  const timed = sr.hopPressAt >= 0 && air - sr.hopPressAt <= T.perfectHopWindow && yawAbs < T.perfectMaxYaw;
  const perfect = air >= minAir && (calm || timed) && r.mode === 'racing';
  if (perfect) giveBoost(ctx, sr, 'land', T.perfectPower, T.perfectTime);
  else if (air >= T.hardLandAir) r.speed *= 1 - T.hardLandLoss;
  if (perfect || sr.airKind === 'hop' || (air >= T.landEventMinAir && sr.airPeak >= T.landEventMinPeak)) {
    ctx.bus.emit('rider:land', { riderId: r.id, airTime: air, perfect });
  }
}
