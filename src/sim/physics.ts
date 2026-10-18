// createPhysics(session) → PhysicsSystem. Orchestrates one substep for every rider in a fixed order:
//   ground features → surface → drift → forward → lateral → vertical → move → bounds → attitude
// then rider contacts, obstacles and slipstream. All kinematics live in track space (s, x, y).
import { clamp } from '../core/math';
import { emptyControls } from '../core/types';
import type { PhysicsSystem, Session } from '../core/contracts';
import type { RiderState } from '../core/types';
import { createSimRider, emptyFrame, hasStatus, type SimCtx, type SimRider } from './state';
import { longitudinal, tickBoost } from './forces';
import { lateral, startCarry } from './steering';
import { attitude } from './attitude';
import { endDrift, updateDrift } from './drift';
import { vertical } from './air';
import { groundEffects, tickSimStatuses } from './features';
import { resolveBounds, surfaceMods } from './surfaces';
import { Contacts, slipstream } from './contacts';
import { NearPasses } from './nearpass';
import { obstacleContacts } from './obstacles';
import { crashRider, crashedUpdate, respawnRider, respawningUpdate } from './crash';
import { Poser } from './pose';
import { round, simDebug } from './debug';
import { TUNING as T } from './tuning';

export function createPhysics(session: Session): PhysicsSystem {
  const riders: SimRider[] = session.riders.map(createSimRider);
  const ctx: SimCtx = { session, bus: session.app.bus, rng: session.rng.fork(0x51d0), riders, tmpFrame: emptyFrame() };
  const contacts = new Contacts(ctx);
  const nearPasses = new NearPasses(ctx);
  const poser = new Poser(session.track);
  const idle = emptyControls();
  let nanReported = false;

  const simOf = (r: RiderState): SimRider | undefined => {
    const sr = riders[r.id];
    return sr && sr.r === r ? sr : riders.find((x) => x.r === r);
  };

  const syncRiders = (): void => {
    for (const r of session.riders) if (!simOf(r)) riders.push(createSimRider(r));
  };

  // Sub-modules may crash the rider mid-step; a call keeps TS from narrowing r.mode away.
  const crashed = (r: RiderState): boolean => r.mode === 'crashed';

  const ride = (sr: SimRider, dt: number): void => {
    const r = sr.r;
    if (hasStatus(r, 'gulped')) return; // combat carries the rider while it is in the pouch
    const c = session.controls.get(r.id) ?? idle;
    const tr = session.track;
    tr.frameAt(Math.min(r.s, tr.length), sr.frame);
    groundEffects(ctx, sr);
    sr.prevS = r.s;
    const surf = surfaceMods(ctx, sr, dt);
    if (crashed(r)) return;
    updateDrift(ctx, sr, c, dt);
    longitudinal(sr, c, surf, dt);
    lateral(sr, c, surf, dt);
    vertical(ctx, sr, c, dt);
    if (crashed(r)) return;
    // Inside lines are shorter: s advances faster on the inside of a curve.
    r.s += (r.speed / clamp(1 - sr.frame.curvature * r.x, 0.7, 1.3)) * dt;
    r.x += r.vx * dt;
    resolveBounds(ctx, sr, dt);
    if (crashed(r)) return;
    attitude(sr, dt, sr.rampSlope);
    tickBoost(sr, dt);
  };

  const hold = (sr: SimRider, decel: number, dt: number): void => {
    const r = sr.r;
    r.speed = Math.max(0, r.speed - decel * dt);
    r.s += r.speed * dt;
    r.vx = r.y = r.vy = 0;
    r.airborne = false;
    r.lean *= Math.exp(-6 * dt);
    r.yaw *= Math.exp(-6 * dt);
  };

  const guard = (sr: SimRider): void => {
    const r = sr.r;
    const ok = [r.s, r.x, r.y, r.speed, r.vx, r.vy, r.yaw, r.lean].every(Number.isFinite);
    if (ok) return;
    if (!nanReported) {
      nanReported = true;
      console.error(`[sim] non-finite state on rider ${r.id}; resetting it`, { s: r.s, x: r.x, speed: r.speed });
    }
    r.s = Number.isFinite(sr.prevS) ? sr.prevS : 0;
    r.x = r.y = r.speed = r.vx = r.vy = r.yaw = r.lean = 0;
    r.airborne = false;
  };

  const physics: PhysicsSystem = {
    step(dt) {
      if (dt <= 0) return;
      syncRiders();
      for (const sr of riders) {
        const r = sr.r;
        r.modeTime += dt;
        r.invuln = Math.max(0, r.invuln - dt);
        if (r.mode === 'racing' || r.mode === 'finished') ride(sr, dt);
        else if (r.mode === 'crashed') crashedUpdate(ctx, sr, dt);
        else if (r.mode === 'respawning') respawningUpdate(sr);
        else if (r.mode === 'busted') hold(sr, 8, dt);
        else hold(sr, 30, dt); // grid: parked until GO
        tickSimStatuses(sr, dt);
      }
      contacts.step(dt);
      nearPasses.step(dt);
      for (const sr of riders) {
        obstacleContacts(ctx, sr, dt);
        slipstream(ctx, sr, dt);
        guard(sr);
      }
    },
    applyImpulse(r, imp) {
      const sr = simOf(r);
      const lat = imp.lateral ?? 0;
      r.speed = Math.max(0, r.speed + (imp.forward ?? 0));
      r.vx += lat;
      // The shove carries the rider for a moment instead of being eaten by the 0.07 s grip lag; steering back
      // toward the hitter is muted during it, steering away is not.
      if (sr && Math.abs(lat) >= T.knockMin) startCarry(sr, T.knockTime, T.knockSteer, T.knockTau, lat > 0 ? -1 : 1);
      if (imp.up) r.vy = Math.max(r.vy, 0) + imp.up;
      if (sr && (Math.abs(lat) >= 3 || (imp.forward ?? 0) <= -3)) endDrift(ctx, sr, false);
    },
    crash(r, cause, attacker) {
      const sr = simOf(r);
      if (sr) crashRider(ctx, sr, cause, attacker);
    },
    respawn(r) {
      const sr = simOf(r);
      if (sr) respawnRider(ctx, sr);
    },
    pose(r, outPos, outQuat) {
      poser.pose(r, simOf(r)?.pitch ?? 0, outPos, outQuat);
    },
    dispose() {
      const dbg = simDebug();
      if (dbg) dbg.riders = () => [];
    },
  };

  const dbg = simDebug();
  if (dbg) {
    dbg.riders = () => riders.map((sr) => ({
      id: sr.r.id, mode: sr.r.mode, s: round(sr.r.s, 2), x: round(sr.r.x), v: round(sr.r.speed), vx: round(sr.r.vx),
      y: round(sr.r.y), vy: round(sr.r.vy), yaw: round(sr.r.yaw), lean: round(sr.r.lean), pitch: round(sr.pitch),
      air: sr.r.airborne, airKind: sr.airKind, drifting: sr.r.drifting, driftLevel: sr.driftLevel, driftDir: sr.driftDir,
      charge: round(sr.r.driftCharge), boost: round(sr.r.boostTime), boostPower: round(sr.r.boostPower),
      draft: round(sr.r.draft), surface: sr.r.surface, oil: round(sr.oilTime), wet: round(sr.wetTime),
      wobble: round(sr.wobbleTime), accel: round(sr.accel), top: round(sr.tune.top), mass: round(sr.tune.mass),
      carry: round(sr.carryTime), driftLock: round(sr.driftLock),
    }));
  }
  return physics;
}
