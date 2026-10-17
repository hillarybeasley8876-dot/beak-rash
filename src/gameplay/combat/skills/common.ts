// Helpers shared by skill files: damaging skill hits, debuff-only hits, cone and radius queries.
import type { RiderState, StatusId } from '../../../core/types';
import { others, targetable, type CombatCtx } from '../ctx';
import { applyHit, type HitOutcome } from '../damage';
import type { ImpactKind } from '../feedback';
import { addStatus } from '../statuses';
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

/** Debuff without damage (honk, whistle). Credits `a` if the victim crashes soon after. */
export function skillAffect(ctx: CombatCtx, a: RiderState, v: RiderState, skillId: string, statuses: Array<[StatusId, number, number]>): boolean {
  if (!targetable(ctx, v)) return false;
  let any = false;
  for (const [id, time, strength] of statuses) any = addStatus(v, id, time, strength, a.id) || any;
  if (!any) return false;
  v.lastHitBy = a.id;
  v.lastHitTime = ctx.now();
  ctx.rd(v).hitByMirror = a.id;
  ctx.rd(v).koBy = { attacker: a.id, skillId, weapon: 'none' };
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
