// Shared helpers for the elemental pool skills (SPEC §24): the police / prop reach of a cone, and the
// one-call "hit a rider and lay the element on it" every element skill uses (so the reactions fire).
import type { Element, Obstacle, RiderState } from '../../../../core/types';
import { applyElement } from '../../elements';
import type { CombatCtx } from '../../ctx';
import { obstaclesIn, skillHit, type SkillHitOpts } from '../common';
import { aheadAngle } from '../types';

/** The police and props inside the cone in front of `r` (the same cone the riders get). */
export function coneObstacles(ctx: CombatCtx, r: RiderState, range: number, halfAngle: number): Obstacle[] {
  return obstaclesIn(ctx, r, (o, ds, dx) => ds > 0.3 && Math.hypot(ds, dx) <= range && aheadAngle(ds, dx) <= halfAngle);
}

/**
 * A skill hit that also lays the element on the victim (reactions fire: 蒸发 / 冻结 / 感电 / 超载 …).
 * `stacks` is the ice stack count (three cold stacks freeze).
 */
export function elemHit(
  ctx: CombatCtx, a: RiderState, v: RiderState, skillId: string, element: Element, opts: SkillHitOpts, stacks = 1,
): void {
  skillHit(ctx, a, v, skillId, opts);
  applyElement(ctx, a, v, element, stacks);
}
