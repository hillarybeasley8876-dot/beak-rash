// pool.icelance — 冰锥: a homing ice spike at the nearest rival ahead (≤ 45 m, ±25°): two cold stacks (three freeze).
// With nobody in sight it flies straight; it shatters on the police in its path either way (SPEC §25).
import { DEG } from '../../../../core/math';
import type { Obstacle, RiderState } from '../../../../core/types';
import { nearest, targetable, type CombatCtx } from '../../ctx';
import type { Projectile } from '../../projectiles/projectiles';
import { obstaclesIn, skillObstacleHit } from '../common';
import { aheadAngle, TimedSkill, type SkillImpl } from '../types';
import { elemHit } from './common';

const ID = 'pool.icelance';
export const ICELANCE = {
  range: 45, cone: 25 * DEG, speedBonus: 24, life: 3, radius: 0.4, damage: 10, stacks: 2, speedLoss: 0.08,
  flight: 1.6, policeRadius: 2,
} as const;

/** The rider the lance locks onto (the nearest one ahead in the cone). */
export function iceTarget(ctx: CombatCtx, r: RiderState): RiderState | null {
  return nearest(ctx, r, (o, ds, dx) => targetable(ctx, o) && ds > 1 && ds <= ICELANCE.range &&
    aheadAngle(ds, dx) <= ICELANCE.cone) ?? null;
}

class IceLance extends TimedSkill {
  private shot: Projectile | null = null;
  private shattered = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, ICELANCE.flight, false);
    const target = iceTarget(ctx, r);
    this.shot = ctx.projectiles.spawn({
      skillId: ID, owner: r, target, s: r.s + 1.1, x: r.x, y: r.y + 1.7,
      speed: r.speed + ICELANCE.speedBonus, turn: 8, life: ICELANCE.life, radius: ICELANCE.radius,
      geometry: ctx.lib.get('elem:icelance'), trail: '#bfe9ff',
      onHit: (victim) => {
        elemHit(ctx, r, victim, ID, 'ice', { damage: ICELANCE.damage, speedLoss: ICELANCE.speedLoss }, ICELANCE.stacks);
        ctx.session.app.fx.burst('aura', ctx.pos(victim), { color: '#9fdcff' });
      },
      onObstacle: (o) => this.shatter(ctx, r, o),
    });
    if (target) {
      const p = this.shot;
      if (p) p.vx = Math.max(-6, Math.min(6, (target.x - r.x) * 1.5));
    }
  }

  /** The lance shatters on an officer (the officer takes the hit). */
  private shatter(ctx: CombatCtx, r: RiderState, o: Obstacle): void {
    if (this.shattered.has(o.id)) return;
    this.shattered.add(o.id);
    skillObstacleHit(ctx, r, o, ID, ICELANCE.damage);
    ctx.session.app.fx.burst('aura', ctx.world(o.s, o.x, 1.1), { color: '#9fdcff' });
  }

  protected tick(): void {
    const p = this.shot;
    if (!p || !p.alive) return;
    // the officers the lance passes shatter (the projectile's own contact is a narrow window)
    for (const o of obstaclesIn(this.ctx, this.caster, (ob, ds, dx) => Math.hypot(ob.s - p.s, ob.x - p.x) <= ICELANCE.policeRadius)) {
      this.shatter(this.ctx, this.caster, o);
    }
  }
}

export const icelance: SkillImpl = { id: ID, cast: (ctx, r) => new IceLance(ctx, r) };
