// Helpers shared by skill files: damaging skill hits, debuff-only hits, cone and radius queries, and (r6 SPEC §25)
// skill hits on the police and hittable props, which are obstacles, not riders.
import type { Obstacle, ObstacleKind, RiderState, StatusId } from '../../../core/types';
import { BIKES } from '../../../data/bikes';
import { clampToRoad, finished, others, targetable, type CombatCtx } from '../ctx';
import { applyHit, credit, type HitOutcome } from '../damage';
import type { ImpactKind } from '../feedback';
import { addStatus } from '../statuses';
import { swallowed } from './swallow';
import { aheadAngle, sideOf } from './types';

export interface SkillHitOpts {
  damage: number;
  knock?: number;
  stun?: number;
  speedLoss?: number;
  heavy?: boolean;
  impact?: ImpactKind;
  countCombo?: boolean;
}

/**
 * Share of a boost's extra top speed given at once (r7 SPEC §29). Raising the top speed alone was not felt: a rider
 * still accelerating gained 2–3 m over a whole 2.5 s boost while the camera kicked 10°. The kick puts the bike on its
 * way to the boosted top speed the moment the skill is cast.
 */
export const BOOST_KICK = 0.6;

/** A skill speed buff: the 'boost' status (top speed through mods), the kick, and rider:boost for the camera / fx. */
export function skillBoost(ctx: CombatCtx, r: RiderState, time: number, power: number): void {
  addStatus(r, 'boost', time, power, r.id, true);
  const top = BIKES[r.bike].topSpeed;
  r.speed = Math.max(r.speed, Math.min(top * (1 + power), r.speed + top * power * BOOST_KICK));
  ctx.bus.emit('rider:boost', { riderId: r.id, kind: 'skill', power, time });
}

/** A damaging skill hit (not blockable by shields/pans: those only stop melee). */
export function skillHit(ctx: CombatCtx, a: RiderState, v: RiderState, skillId: string, o: SkillHitOpts): HitOutcome {
  return applyHit(ctx, {
    attacker: a, victim: v, damage: o.damage, side: sideOf(a, v), weapon: 'none', heavy: o.heavy ?? false,
    crit: false, skillId, knock: o.knock ?? 0, speedLoss: o.speedLoss ?? 0, melee: false,
    impact: o.impact ?? 'skill', stun: o.stun, countCombo: o.countCombo,
  });
}

/** Debuff without damage (honk, whistle). Credits `a` if the victim crashes soon after; an open pouch eats it. */
export function skillAffect(ctx: CombatCtx, a: RiderState, v: RiderState, skillId: string, statuses: Array<[StatusId, number, number]>): boolean {
  if (!targetable(ctx, v) || finished(a)) return false;
  if (ctx.skills.swallowing(v)) {
    swallowed(ctx, v, 'notes'); // the wave goes down the pouch instead
    return false;
  }
  let any = false;
  for (const [id, time, strength] of statuses) any = addStatus(v, id, time, strength, a.id) || any;
  if (!any) return false;
  credit(ctx, v, a, skillId, 'none');
  ctx.bus.emit('skill:hit', { riderId: a.id, skillId, victim: v.id, pos: ctx.pos(v) });
  if (statuses.some(([id]) => id === 'stun')) ctx.view(v)?.cue('stun');
  return true;
}

/** Targetable riders ahead of `r` within `range` metres and ±halfAngle of straight ahead. */
export function inCone(ctx: CombatCtx, r: RiderState, range: number, halfAngle: number): RiderState[] {
  return others(ctx, r, (o, ds, dx) => targetable(ctx, o) && ds > 0.3 && Math.hypot(ds, dx) <= range && aheadAngle(ds, dx) <= halfAngle);
}

/** Targetable riders within `radius` metres of `r` (track-space distance, height ignored below 2 m). */
export function inRadius(ctx: CombatCtx, r: RiderState, radius: number): RiderState[] {
  return others(ctx, r, (o, ds, dx) => targetable(ctx, o) && Math.hypot(ds, dx) <= radius && Math.abs(o.y - r.y) < 2);
}

/** Obstacles a skill may hit (r6 SPEC §25): the corgi officers and the special police squad, and hittable props. */
const HITTABLE: ReadonlySet<ObstacleKind> = new Set<ObstacleKind>(['police', 'prop']);

/** Active hittable obstacles relative to `r` passing `keep(o, ds, dx)` (ds = o.s − r.s). */
export function obstaclesIn(ctx: CombatCtx, r: RiderState, keep: (o: Obstacle, ds: number, dx: number) => boolean): Obstacle[] {
  return ctx.session.obstacles.filter((o) => o.active && HITTABLE.has(o.kind) && keep(o, o.s - r.s, o.x - r.x));
}

/**
 * A skill reaches an obstacle (r6 SPEC §25): combat:obstacleHit with the skill id; the police unit turns it into
 * damage on the officer (`ko` = knock it out whatever its HP: SHOWTIME and the big ults). Nothing past the line.
 */
export function skillObstacleHit(ctx: CombatCtx, a: RiderState, o: Obstacle, skillId: string, damage: number, ko = false): void {
  if (finished(a)) return;
  ctx.bus.emit('combat:obstacleHit', {
    obstacleId: o.id, attacker: a.id, weapon: 'none', damage, thrown: false,
    pos: ctx.world(o.s, o.x, 1.1).clone(), skillId, ko,
  });
}

/** Lateral offsets tried, in order, when a skill puts a rider down somewhere new (ghost reappearing, SHOWTIME landing). */
const LANES = [0, 1.6, -1.6, 3.2, -3.2] as const;
/** Clearance kept from traffic / obstacles and other riders at that spot. */
const CLEAR = { obstacleDs: 4, obstacleDx: 0.9, riderDs: 2.2, riderDx: 1 } as const;

/** First lateral offset near `x` at `s` with no solid obstacle or rider (except `self`, `ignore`) on it (falls back to x). */
export function clearLane(ctx: CombatCtx, self: RiderState, s: number, x: number, ignore: RiderState | null = null): number {
  const { obstacles, riders } = ctx.session;
  for (const dx of LANES) {
    const cx = clampToRoad(ctx, s, x + dx, 1);
    const blocked = obstacles.some((o) => o.active && o.solid && Math.abs(o.s - s) < o.halfLength + CLEAR.obstacleDs &&
      Math.abs(o.x - cx) < o.halfWidth + CLEAR.obstacleDx) ||
      riders.some((o) => o !== self && o !== ignore && o.mode !== 'crashed' && Math.abs(o.s - s) < CLEAR.riderDs &&
        Math.abs(o.x - cx) < CLEAR.riderDx);
    if (!blocked) return cx;
  }
  return clampToRoad(ctx, s, x, 1);
}
