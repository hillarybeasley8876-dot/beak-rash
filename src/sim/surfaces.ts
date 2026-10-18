// Surfaces under the wheels (track.surfaceAt) and the drivable extent (track.bounds):
// grass/sand/dirt slow and wobble, curbs rumble, water swallows you; walls bounce
// (vx ×−0.35, speed −25 %·impact) and crash you at a hard angle above 18 m/s; soft edges just stop you.
// Contact hysteresis: after an impact the rider is latched to that wall, so pressing back into it scrapes
// (friction by pressure, sparks) instead of pinballing off it again, until the rider steers > 0.4 m away,
// is > 1 m away or stays off it for 0.8 s.
import { clamp01 } from '../core/math';
import { TUNING as T } from './tuning';
import { endDrift } from './drift';
import { startCarry } from './steering';
import { crashRider } from './crash';
import { isRiding, trackEnd, worldPos, type SimCtx, type SimRider } from './state';
import { NEUTRAL_SURFACE, type SurfaceMods } from './forces';
import type { Surface } from '../core/types';

const OFFROAD: ReadonlySet<Surface> = new Set<Surface>(['grass', 'sand', 'dirt']);

/** Sample the surface, update rider.surface, emit rider:offroad on entering rough ground. */
export function surfaceMods(ctx: SimCtx, sr: SimRider, dt: number): SurfaceMods {
  const r = sr.r;
  sr.offroadCooldown = Math.max(0, sr.offroadCooldown - dt);
  if (r.airborne) return NEUTRAL_SURFACE;
  const tr = ctx.session.track;
  const surface = tr.surfaceAt(Math.min(r.s, trackEnd(tr)), r.x);
  r.surface = surface;
  if (OFFROAD.has(surface) && !OFFROAD.has(sr.lastSurface as Surface) && sr.offroadCooldown <= 0) {
    ctx.bus.emit('rider:offroad', { riderId: r.id, surface });
    sr.offroadCooldown = 0.5;
  }
  sr.lastSurface = surface;
  const off = sr.tune.offroad;
  const rough = T.offroadWobble * (1 - off);
  switch (surface) {
    case 'grass': return { top: T.grassTopBase + T.grassTopOffroad * off, grip: T.offroadGrip, wobble: rough };
    case 'sand': return { top: T.sandTop, grip: T.offroadGrip * 0.9, wobble: rough * 1.2 };
    case 'dirt': return { top: T.dirtTop, grip: 0.9, wobble: rough * 0.5 };
    case 'curb': return { top: T.curbTop, grip: 1, wobble: 0.15 };
    case 'water':
      crashRider(ctx, sr, 'water', null);
      return NEUTRAL_SURFACE;
    default: return NEUTRAL_SURFACE;
  }
}

/** Keep the rider inside bounds(s); walls bounce, drops into water crash, other edges are soft. */
export function resolveBounds(ctx: SimCtx, sr: SimRider, dt: number): void {
  const r = sr.r;
  sr.wallCooldown = Math.max(0, sr.wallCooldown - dt);
  sr.wallHitCooldown = Math.max(0, sr.wallHitCooldown - dt);
  const tr = ctx.session.track;
  const b = tr.bounds(Math.min(r.s, trackEnd(tr)));
  const right = b.right - T.riderHalfWidth;
  const left = -b.left + T.riderHalfWidth;
  updateLatch(sr, sr.wallSide > 0 ? right : left, dt);
  if (r.x > right) edge(ctx, sr, 1, b.rightKind, right, dt);
  else if (r.x < left) edge(ctx, sr, -1, b.leftKind, left, dt);
}

/** The latch holds while the rider keeps pressing toward that edge (a bounce is not a new approach). */
function updateLatch(sr: SimRider, limit: number, dt: number): void {
  const side = sr.wallSide;
  if (side === 0) return;
  sr.wallFree += dt;
  const gap = (limit - sr.r.x) * side;
  const leaving = gap > T.wallLatchFar || (gap > T.wallLatchGap && sr.vxWant * side <= 0);
  if (leaving || sr.wallFree > T.wallLatchTime || !isRiding(sr.r)) sr.wallSide = 0;
}

function edge(ctx: SimCtx, sr: SimRider, side: 1 | -1, kind: Surface, limit: number, dt: number): void {
  const r = sr.r;
  if (kind === 'water') {
    // Let the bike go over the lip a little so the tumble reads as falling off, then crash.
    if ((r.x - limit) * side > 0.6) crashRider(ctx, sr, 'water', null);
    return;
  }
  r.x = limit;
  const into = r.vx * side;
  const latched = sr.wallSide === side;
  if (latched) sr.wallFree = 0;
  if (into > T.wallBounceMin && !latched) impact(ctx, sr, kind, into, side);
  else if (into > 0) {
    r.vx = 0;
    if (into > T.wallBounceMin) sr.yawEase = T.yawEaseTime; // a latched re-contact straightens the nose smoothly
  }
  if (kind !== 'wall' || r.airborne || r.mode !== 'racing') return;
  // Scraping: friction proportional to how hard the rider leans on the wall, sparks ~6×/s.
  const pressure = clamp01((sr.vxWant * side) / T.wallPressureFull);
  if (pressure <= 0) return;
  r.speed = Math.max(0, r.speed - T.wallScrapeDecel * pressure * dt);
  if (pressure > 0.15 && sr.wallCooldown <= 0 && r.speed > 4) {
    sr.wallCooldown = T.wallScrapeEvery;
    ctx.bus.emit('rider:obstacleHit', { riderId: r.id, obstacleId: -1, kind: 'wallScrape', speed: r.speed * pressure, pos: worldPos(ctx, r) });
  }
}

function impact(ctx: SimCtx, sr: SimRider, kind: Surface, into: number, side: 1 | -1): void {
  const r = sr.r;
  sr.wallSide = side;
  sr.wallFree = 0;
  if (kind !== 'wall') {
    r.vx = -r.vx * T.softEdgeRestitution;
    return;
  }
  // "Hard angle": only a steep slam at speed wrecks you; full-lock steering (≈20°) bounces off.
  if (r.speed > T.wallCrashSpeed && Math.atan2(into, r.speed) > T.wallCrashAngle && !r.airborne) {
    crashRider(ctx, sr, 'wall', null);
    return;
  }
  const k = clamp01(into / T.steerAuthHigh);
  r.vx = -r.vx * T.wallRestitution;
  r.speed *= 1 - T.wallSpeedLoss * k;
  if (k > 0.15) endDrift(ctx, sr, false);
  // The bounce carries the rider off the wall: steering back into it is muted for a moment (steering away
  // stays live), and the heading eases instead of snapping with the flipped lateral velocity.
  startCarry(sr, T.wallCarryTime, 0, T.wallCarryTau, side);
  sr.yawEase = T.yawEaseTime;
  sr.wallCooldown = T.wallScrapeEvery;
  if (sr.wallHitCooldown > 0) return;
  sr.wallHitCooldown = T.wallHitEvery;
  ctx.bus.emit('rider:obstacleHit', { riderId: r.id, obstacleId: -1, kind: 'wall', speed: into, pos: worldPos(ctx, r) });
}
