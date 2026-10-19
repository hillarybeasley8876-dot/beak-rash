// Drift: Shift + steer above 8 m/s. Slip builds to ~27°, the bike follows the bend (steering.ts), speed
// bleeds ~4 %/s. Charge levels at 0.55 / 1.2 / 2.0 charge-seconds; the charge rate rewards commitment (steer
// into the drift, a bend turning the same way), so counter-steered wiggles on a straight barely charge.
// Releasing Shift fires the mini-turbo for that level and hands the lateral speed over to grip steering
// over 0.35 s (steering.ts), so a release with the stick held never darts inward; a release with L1+ charged
// arms the exit carve (carve.ts) so the rest of a hairpin stays holdable. Ends without a boost below
// 6 m/s or on a collision (endDrift(sr, false)). Any end locks drifting out for 0.3 s, and no drift starts
// toward a wall the rider is pressed against.
import { clamp, clamp01, lerp } from '../core/math';
import { TUNING as T } from './tuning';
import { hasStatus, type SimCtx, type SimRider } from './state';
import type { Controls } from '../core/types';
import { startCarve, stopCarve } from './carve';

export function updateDrift(ctx: SimCtx, sr: SimRider, c: Controls, dt: number): void {
  const r = sr.r;
  sr.driftLock = Math.max(0, sr.driftLock - dt);
  if (!r.drifting) {
    // No drift into a wall the rider is pressed against (it would only scrape along it with no charge).
    const intoWall = sr.wallSide !== 0 && Math.sign(c.steer) === sr.wallSide;
    const canStart = c.drift && sr.driftLock <= 0 && !r.airborne && r.mode === 'racing' && r.speed > T.driftMinSpeed
      && Math.abs(c.steer) > T.driftSteerMin && r.mods.steerMul > 0 && !hasStatus(r, 'stun') && !intoWall;
    if (canStart) startDrift(ctx, sr, c.steer > 0 ? 1 : -1);
    return;
  }
  if (r.speed < T.driftEndSpeed || r.mode !== 'racing') {
    endDrift(ctx, sr, false);
    return;
  }
  if (!c.drift) {
    endDrift(ctx, sr, true);
    return;
  }
  if (!r.airborne) r.driftCharge += dt * chargeRate(sr, c.steer);
  let level = 0;
  for (const t of T.driftLevels) if (r.driftCharge >= t) level++;
  if (level > sr.driftLevel) {
    sr.driftLevel = level;
    ctx.bus.emit('rider:drift', { riderId: r.id, phase: 'level', level });
  }
}

/**
 * Charge-seconds per second: steering into the drift and a bend turning the drift's way charge fastest; on
 * such a bend a drift that holds its line (counter-steering) still charges at ~75 % of the full rate.
 */
export function chargeRate(sr: SimRider, steer: number): number {
  const d = sr.driftDir;
  const u = (clamp(steer, -1, 1) * d + 1) / 2;
  const bend = clamp01(sr.frame.curvature * d * T.driftChargeKappa);
  const low = lerp(T.driftChargeLow, T.driftChargeLowBend, bend);
  return lerp(low, T.driftChargeHigh, u) * lerp(T.driftChargeStraight, 1, bend);
}

function startDrift(ctx: SimCtx, sr: SimRider, dir: -1 | 1): void {
  const r = sr.r;
  r.drifting = true;
  r.driftCharge = 0;
  sr.driftDir = dir;
  stopCarve(sr); // the new drift brings its own cancel; a forced end of it must not revive the old carve
  sr.driftLevel = 0;
  ctx.bus.emit('rider:drift', { riderId: r.id, phase: 'start', level: 0 });
}

/** Stop drifting; `reward` fires the mini-turbo for the charged level. Safe to call when not drifting. */
export function endDrift(ctx: SimCtx, sr: SimRider, reward: boolean): void {
  const r = sr.r;
  if (!r.drifting) return;
  const level = sr.driftLevel;
  const dir = sr.driftDir;
  r.drifting = false;
  r.driftCharge = 0;
  sr.driftDir = 0;
  sr.driftLevel = 0;
  ctx.bus.emit('rider:drift', { riderId: r.id, phase: 'end', level: reward ? level : 0 });
  sr.driftLock = T.driftLockout; // forced ends too: a wall or bump never restarts the drift on the next frame
  if (reward) {
    sr.driftExit = T.driftExitGuard;
    sr.driftExitVx = r.vx;
  }
  if (reward && level > 0) {
    if (dir !== 0) startCarve(sr, dir); // the rest of the bend keeps the drift's bite (carve.ts)
    const time = T.driftBoostTime[level - 1] ?? 0;
    const power = T.driftBoostPower[level - 1] ?? 0;
    giveBoost(ctx, sr, 'drift', power, time);
  }
}

/** The shared boost API (SPEC §6): max() on time and power, plus the event. */
export function giveBoost(
  ctx: SimCtx, sr: SimRider, kind: 'drift' | 'land' | 'draft' | 'pad', power: number, time: number,
): void {
  const r = sr.r;
  r.boostTime = Math.max(r.boostTime, time);
  r.boostPower = Math.max(r.boostPower, power);
  ctx.bus.emit('rider:boost', { riderId: r.id, kind, power, time });
}
