// Helpers shared by skill files: damaging skill hits, debuff-only hits, cone and radius queries.
import type { RiderState, StatusId } from '../../../core/types';
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

/** A skill speed buff: the 'boost' status (top speed through mods) + rider:boost for the camera kick / fx. */
export function skillBoost(ctx: CombatCtx, r: RiderState, time: number, power: number): void {
  addStatus(r, 'boost', time, power, r.id, true);
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
