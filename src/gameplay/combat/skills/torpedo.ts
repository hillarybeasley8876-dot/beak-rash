// pelican.torpedo — spit a homing salted fish at the nearest rival ahead (≤ 60 m, ±25°): flies at
// rider speed + 22 m/s, 14 dmg + 0.6 s stun. With no rival in the cone it flies at the nearest police officer there
// (r6 SPEC §25: combat:obstacleHit), else straight on, and poofs.
import { DEG } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import { nearest, targetable, type CombatCtx } from '../ctx';
import { obstaclesIn, skillHit, skillObstacleHit } from './common';
import { aheadAngle, TimedSkill, type SkillImpl } from './types';

const ID = 'pelican.torpedo';
export const TORPEDO = { range: 60, cone: 25 * DEG, speedBonus: 22, damage: 14, stun: 0.6, knock: 3, life: 3.2 } as const;

export function torpedoTarget(ctx: CombatCtx, r: RiderState): RiderState | null {
  return nearest(ctx, r, (o, ds, dx) => targetable(ctx, o) && ds > 1 && ds <= TORPEDO.range && aheadAngle(ds, dx) <= TORPEDO.cone) ?? null;
}

class Torpedo extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, 0.3, false);
    const target = torpedoTarget(ctx, r);
    const cop = target ? null : obstaclesIn(ctx, r, (o, ds, dx) => o.kind === 'police' && ds > 1 && ds <= TORPEDO.range && aheadAngle(ds, dx) <= TORPEDO.cone)[0] ?? null;
    const p = ctx.projectiles.spawn({
      skillId: ID, owner: r, target, s: r.s + 1.1, x: r.x, y: r.y + 1.55,
      speed: r.speed + TORPEDO.speedBonus, turn: 7, life: TORPEDO.life, radius: 0.45,
      geometry: ctx.lib.get('torpedo'), trail: '#ffffff',
      onHit: (victim) => {
        skillHit(ctx, r, victim, ID, { damage: TORPEDO.damage, stun: TORPEDO.stun, knock: TORPEDO.knock, speedLoss: 0.12 });
      },
      onObstacle: (o) => skillObstacleHit(ctx, r, o, ID, TORPEDO.damage),
      targetObstacle: cop,
    });
    const aimX = target?.x ?? cop?.x;
    if (aimX !== undefined) p.vx = Math.max(-6, Math.min(6, (aimX - r.x) * 1.5));
  }

  protected tick(): void {}
}

export const torpedo: SkillImpl = { id: ID, cast: (ctx, r) => new Torpedo(ctx, r) };
