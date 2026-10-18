// Crashes and respawns (SPEC §6): launch the body (forward 0.7 v, up 4–7 m/s, lateral, spin 4–9 rad/s)
// into rider.crash for the actors view, slide the sim body to a stop, then after 2.6 s respawn at a
// safe x near the crash point: 0.6 s 'respawning' blink, 2 s invulnerability, HP back to ≥ 70 %.
// End-on into a solid obstacle the body never tunnels through it: low ones (cars, props) are vaulted, high
// and far enough to pass the far end before dropping to roof height; tall ones (vans, trucks, buses) bounce
// it back off their tail (or nose), slower than the vehicle, which brakes away from it.
import { clamp, damp } from '../core/math';
import { TUNING as T } from './tuning';
import { endDrift } from './drift';
import { dropStatus, isRiding, trackEnd, worldPos, type SimCtx, type SimRider } from './state';
import type { CrashCause, Obstacle, RiderId } from '../core/types';

/** Body launch along the road: forward m/s (negative = thrown back), up m/s, tumbling backwards. */
interface Launch { fwd: number; up: number; back: boolean }

function launchFor(ctx: SimCtx, sr: SimRider, hit: Obstacle | undefined): Launch {
  const r = sr.r;
  const up = ctx.rng.range(T.crashUp[0] ?? 4, T.crashUp[1] ?? 7) + Math.max(0, r.vy) * 0.5;
  const fwd = T.crashForward * r.speed;
  if (!hit) return { fwd, up, back: false };
  if (hit.height > T.crashVaultMaxHeight) {
    const back = T.crashBounceBack + T.crashBounceK * Math.abs(r.speed - hit.speed);
    return { fwd: Math.min(hit.speed, 0) - back, up, back: true };
  }
  const g = T.crashVaultGravity;
  const vy = Math.max(up, Math.sqrt(2 * g * Math.max(0, hit.height + T.crashVaultMargin - T.crashBodyHeight)));
  const atRoof = vy * vy - 2 * g * (hit.height - T.crashBodyHeight); // vy² when it falls back to roof height
  const tRoof = atRoof > 0 ? (vy + Math.sqrt(atRoof)) / g : 0;
  const pass = tRoof > 0 ? hit.speed + (2 * hit.halfLength + T.crashVaultClear) / tRoof : 0;
  return { fwd: clamp(pass, fwd, Math.max(fwd, r.speed)), up: vy, back: false };
}

export function crashRider(
  ctx: SimCtx, sr: SimRider, cause: CrashCause, attacker: RiderId | null, hit?: Obstacle,
): void {
  const r = sr.r;
  if (r.mode === 'crashed' || r.mode === 'respawning' || r.mode === 'finished' || r.mode === 'busted') return;
  endDrift(ctx, sr, false);
  const tr = ctx.session.track;
  const fr = tr.frameAt(Math.min(r.s, trackEnd(tr)), ctx.tmpFrame);
  const rng = ctx.rng;
  const speed = r.speed;
  const { fwd, up, back } = launchFor(ctx, sr, hit);
  const side = r.vx * 0.8 + rng.range(-2, 2);
  const origin = worldPos(ctx, r);
  // Mostly a forward tumble (negative rotation about the road's right axis; backwards when bounced), plus yaw/roll.
  const mag = rng.range(T.crashSpin[0] ?? 4, T.crashSpin[1] ?? 9);
  const pitch = (back ? 1 : -1) * mag * rng.range(0.75, 0.95);
  const yaw = mag * rng.range(-0.4, 0.4);
  const roll = mag * rng.range(-0.45, 0.45);
  r.crash = {
    cause, attacker, origin,
    vel: {
      x: fr.tangent.x * fwd + fr.up.x * up + fr.right.x * side,
      y: fr.tangent.y * fwd + fr.up.y * up + fr.right.y * side,
      z: fr.tangent.z * fwd + fr.up.z * up + fr.right.z * side,
    },
    spin: {
      x: fr.right.x * pitch + fr.up.x * yaw - fr.tangent.x * roll,
      y: fr.right.y * pitch + fr.up.y * yaw - fr.tangent.y * roll,
      z: fr.right.z * pitch + fr.up.z * yaw - fr.tangent.z * roll,
    },
  };
  r.mode = 'crashed';
  r.modeTime = 0;
  r.speed = Math.max(0, fwd);
  sr.crashBack = Math.max(0, -fwd);
  r.vx *= 0.5;
  r.y = 0;
  r.vy = 0;
  r.airborne = false;
  r.airTime = 0;
  r.boostTime = 0;
  r.boostPower = 0;
  r.draft = 0;
  sr.draftLeader = -1;
  sr.nearMiss.clear();
  ctx.bus.emit('rider:crash', { riderId: r.id, cause, speed, pos: { ...origin }, attacker });
}

/** The sim body slides to a stop while the actors view tumbles the rider from rider.crash. */
export function crashedUpdate(ctx: SimCtx, sr: SimRider, dt: number): void {
  const r = sr.r;
  r.speed = Math.max(0, r.speed - T.crashSlideDecel * dt);
  sr.crashBack = Math.max(0, sr.crashBack - T.crashSlideDecel * dt);
  r.vx = damp(r.vx, 0, 3, dt);
  r.s += (r.speed - sr.crashBack) * dt;
  r.x += r.vx * dt;
  const b = ctx.session.track.bounds(Math.min(r.s, trackEnd(ctx.session.track)));
  r.x = clamp(r.x, -b.left + 0.5, b.right - 0.5);
  r.lean = damp(r.lean, 0, 6, dt);
  r.yaw = damp(r.yaw, 0, 6, dt);
  if (r.modeTime >= T.crashedTime) respawnRider(ctx, sr);
}

export function respawnRider(ctx: SimCtx, sr: SimRider): void {
  const r = sr.r;
  endDrift(ctx, sr, false);
  r.mode = 'respawning';
  r.modeTime = 0;
  r.crash = null;
  r.x = safeX(ctx, sr);
  r.y = r.vy = r.vx = r.speed = r.yaw = r.lean = r.airTime = 0;
  r.airborne = false;
  r.draft = 0;
  r.boostTime = r.boostPower = 0;
  r.invuln = Math.max(r.invuln, T.invulnTime);
  r.hp = Math.max(r.hp, T.respawnHp * r.maxHp);
  sr.oilTime = sr.wetTime = 0;
  sr.slip = sr.pitch = 0;
  sr.onRamp = false;
  sr.carryTime = sr.yawEase = sr.driftExit = sr.crashBack = 0;
  sr.wallSide = 0;
  sr.swipeLatch = -1;
  dropStatus(r, 'oiled');
  dropStatus(r, 'wet');
  ctx.bus.emit('rider:respawn', { riderId: r.id });
}

export function respawningUpdate(sr: SimRider): void {
  const r = sr.r;
  r.speed = 0;
  if (r.modeTime < T.respawnTime) return;
  r.mode = 'racing';
  r.modeTime = 0;
  r.speed = T.respawnSpeed;
}

/** Lateral slot on the asphalt near the crash x with the most room from traffic and riders. */
function safeX(ctx: SimCtx, sr: SimRider): number {
  const r = sr.r;
  const tr = ctx.session.track;
  const hw = Math.max(1, tr.bounds(Math.min(r.s, trackEnd(tr))).halfWidth - 1.2);
  const base = clamp(r.x, -hw, hw);
  let best = base;
  let bestScore = -Infinity;
  for (let i = 0; i <= 10; i++) {
    const x = clamp(base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.4, -hw, hw);
    let clear = 2.5; // capped so "more room" never drags the respawn to the far edge
    for (const o of ctx.session.obstacles) {
      if (!o.active || !o.solid) continue;
      const ds = o.s - r.s;
      if (ds > -25 && ds < 45) clear = Math.min(clear, Math.abs(o.x - x) - o.halfWidth - 0.6);
    }
    for (const other of ctx.riders) {
      if (other === sr || !isRiding(other.r)) continue;
      if (Math.abs(other.r.s - r.s) < 10) clear = Math.min(clear, Math.abs(other.r.x - x) - 1);
    }
    const score = clear - Math.abs(x - base) * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best;
}
