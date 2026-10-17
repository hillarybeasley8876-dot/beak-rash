// Solid obstacles from session.obstacles (traffic, police car, props) in track space, plus near misses.
// Head-on / rear-end hits above 8 m/s relative crash the rider ('traffic' for vehicles, props need more);
// slower hits and side swipes push the rider out with a wobble and a short carry (so steering can't glue
// the rider back onto the vehicle every few frames). Jumping above `height` clears them.
import { TUNING as T } from './tuning';
import { endDrift } from './drift';
import { startCarry } from './steering';
import { crashRider } from './crash';
import { isSolid, worldPos, type SimCtx, type SimRider } from './state';
import type { Obstacle, ObstacleKind } from '../core/types';

const VEHICLES: ReadonlySet<ObstacleKind> = new Set<ObstacleKind>(['car', 'van', 'truck', 'bus', 'police']);

export function obstacleContacts(ctx: SimCtx, sr: SimRider, dt: number): void {
  const r = sr.r;
  sr.nearMissCooldown = Math.max(0, sr.nearMissCooldown - dt);
  sr.swipeCooldown = Math.max(0, sr.swipeCooldown - dt);
  if (!isSolid(r)) {
    sr.touching.clear();
    sr.nearMiss.clear();
    return;
  }
  for (const o of ctx.session.obstacles) {
    if (!o.active || !o.solid) continue;
    const ds = o.s - r.s;
    const reachS = o.halfLength + T.riderHalfLength;
    if (Math.abs(ds) > reachS + 6) {
      sr.touching.delete(o.id);
      sr.nearMiss.delete(o.id);
      continue;
    }
    const dx = o.x - r.x;
    const reachX = o.halfWidth + T.riderHalfWidth;
    const overlapping = Math.abs(ds) < reachS && Math.abs(dx) < reachX && r.y < o.height;
    if (overlapping) {
      const wasTouching = sr.touching.has(o.id);
      sr.touching.add(o.id);
      sr.nearMiss.set(o.id, false);
      hit(ctx, sr, o, ds, dx, wasTouching);
      if (r.mode !== 'racing' && r.mode !== 'finished') return;
      continue;
    }
    sr.touching.delete(o.id);
    trackNearMiss(ctx, sr, o, ds, dx, reachS, reachX);
  }
}

function hit(ctx: SimCtx, sr: SimRider, o: Obstacle, ds: number, dx: number, wasTouching: boolean): void {
  const r = sr.r;
  const rel = r.speed - o.speed; // > 0 = rider closing from behind (or head-on with oncoming traffic)
  const vehicle = VEHICLES.has(o.kind);
  // Came in from the front/back this step (deep longitudinal penetration is small) vs from the side.
  const depthS = o.halfLength + T.riderHalfLength - Math.abs(ds);
  const depthX = o.halfWidth + T.riderHalfWidth - Math.abs(dx);
  const endOn = !wasTouching && depthS <= depthX + 0.3;
  if (endOn && Math.abs(rel) > (vehicle ? T.trafficCrashRel : T.propCrashRel)) {
    emitHit(ctx, sr, o, Math.abs(rel));
    crashRider(ctx, sr, vehicle ? 'traffic' : 'obstacle', null);
    return;
  }
  endDrift(ctx, sr, false);
  if (endOn) {
    // Bounce off the bumper: take the obstacle's speed minus a little, step back out of it.
    const behind = ds > 0;
    r.s = o.s + (behind ? -1 : 1) * (o.halfLength + T.riderHalfLength + 0.02);
    r.speed = Math.max(0, behind ? Math.min(r.speed, o.speed - 1) : Math.max(r.speed, o.speed + 1));
    r.vx += (dx > 0 ? -1 : 1) * 1.5;
  } else {
    // Side swipe: push out to the near side, reflect the lateral velocity, scrub a little speed.
    const side = dx > 0 ? -1 : 1;
    r.x = o.x + side * (o.halfWidth + T.riderHalfWidth + 0.02);
    if (r.vx * side < 0) r.vx = -r.vx * 0.4;
    r.vx += side * 1.2;
    startCarry(sr, T.wallCarryTime, 0, T.wallCarryTau);
    if (!wasTouching && sr.swipeCooldown <= 0) r.speed *= 1 - (vehicle ? T.sideSwipeLoss : T.propSpeedLoss);
  }
  sr.wobbleTime = Math.max(sr.wobbleTime, T.wobbleTime);
  sr.wobbleStrength = Math.max(sr.wobbleStrength, vehicle ? 0.8 : 0.5);
  if (wasTouching || sr.swipeCooldown > 0) return;
  sr.swipeCooldown = T.wallHitEvery;
  emitHit(ctx, sr, o, Math.abs(rel));
}

function emitHit(ctx: SimCtx, sr: SimRider, o: Obstacle, speed: number): void {
  ctx.bus.emit('rider:obstacleHit', { riderId: sr.r.id, obstacleId: o.id, kind: o.kind, speed, pos: worldPos(ctx, sr.r) });
}

/** Passing a vehicle within 1 m at > 6 m/s relative without touching it → rider:nearMiss. */
function trackNearMiss(
  ctx: SimCtx, sr: SimRider, o: Obstacle, ds: number, dx: number, reachS: number, reachX: number,
): void {
  if (!VEHICLES.has(o.kind)) return;
  const r = sr.r;
  const alongside = Math.abs(ds) < reachS;
  const gap = Math.abs(dx) - reachX;
  const fast = Math.abs(r.speed - o.speed) > T.nearMissRel;
  if (alongside) {
    if (gap > 0 && gap < T.nearMissGap && fast && !sr.nearMiss.has(o.id)) sr.nearMiss.set(o.id, true);
    return;
  }
  const clean = sr.nearMiss.get(o.id);
  if (clean === undefined) return;
  sr.nearMiss.delete(o.id);
  if (clean && sr.nearMissCooldown <= 0 && r.mode === 'racing') {
    sr.nearMissCooldown = 0.6;
    ctx.bus.emit('rider:nearMiss', { riderId: r.id, kind: 'traffic' });
  }
}
