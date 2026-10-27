// pool.snowball — 大雪球: a big ball thrown at the pack; where it lands it freezes everyone around it (two cold
// stacks each). The ball shatters on the police in its path too (SPEC §25).
import { DEG } from '../../../../core/math';
import type { Obstacle, RiderState } from '../../../../core/types';
import { nearest, targetable, type CombatCtx } from '../../ctx';
import type { Projectile } from '../../projectiles/projectiles';
import { obstaclesIn, skillObstacleHit } from '../common';
import { FlatRing } from '../../visuals/waves';
import { aheadAngle, TimedSkill, type SkillImpl } from '../types';
import { elemHit } from './common';

const ID = 'pool.snowball';
export const SNOWBALL = {
  range: 40, cone: 30 * DEG, speedBonus: 18, life: 3, radius: 0.55,
  burstRadius: 4.5, damage: 12, knock: 3, speedLoss: 0.1, stacks: 2, flight: 1.8,
} as const;

class Snowball extends TimedSkill {
  private shot: Projectile | null = null;
  private shattered = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, SNOWBALL.flight, false);
    const target = nearest(ctx, r, (o, ds, dx) => targetable(ctx, o) && ds > 1.5 && ds <= SNOWBALL.range &&
      aheadAngle(ds, dx) <= SNOWBALL.cone) ?? null;
    this.shot = ctx.projectiles.spawn({
      skillId: ID, owner: r, target, s: r.s + 1.2, x: r.x, y: r.y + 1.5,
      speed: r.speed + SNOWBALL.speedBonus, turn: 6, life: SNOWBALL.life, radius: SNOWBALL.radius,
      geometry: ctx.lib.get('elem:snowball'), trail: '#eaf7ff',
      onHit: (victim, proj) => this.burst(ctx, r, proj.s, proj.x, victim),
      onObstacle: (o, proj) => {
        this.shatter(ctx, r, o);
        this.pop(ctx, proj.s, proj.x);
      },
    });
    if (target) {
      const p = this.shot;
      if (p) p.vx = Math.max(-6, Math.min(6, (target.x - r.x) * 1.2));
    }
  }

  /** The ball bursts: everyone around the impact takes the hit and two cold stacks. */
  private burst(ctx: CombatCtx, r: RiderState, s: number, x: number, direct: RiderState): void {
    for (const o of ctx.session.riders) {
      if (o === r || !targetable(ctx, o)) continue;
      if (Math.hypot(o.s - s, o.x - x) > SNOWBALL.burstRadius) continue;
      elemHit(ctx, r, o, ID, 'ice', { damage: SNOWBALL.damage, knock: SNOWBALL.knock, speedLoss: SNOWBALL.speedLoss }, SNOWBALL.stacks);
    }
    this.pop(ctx, s, x);
  }

  /** The burst itself: a ring of frost and a puff of snow. */
  private pop(ctx: CombatCtx, s: number, x: number): void {
    ctx.visuals.add(new FlatRing(ctx.visuals, s, x, { color: '#dff3ff', from: 0.4, to: SNOWBALL.burstRadius, dur: 0.45 }));
    ctx.session.app.fx.burst('aura', ctx.world(s, x, 0.6), { color: '#dff3ff' });
  }

  /** The ball shatters on an officer. */
  private shatter(ctx: CombatCtx, r: RiderState, o: Obstacle): void {
    if (this.shattered.has(o.id)) return;
    this.shattered.add(o.id);
    skillObstacleHit(ctx, r, o, ID, SNOWBALL.damage);
  }

  protected tick(): void {
    const p = this.shot;
    if (!p || !p.alive) return;
    // the officers the ball rolls over are in the burst too
    for (const o of obstaclesIn(this.ctx, this.caster, (ob, ds, dx) => Math.hypot(ob.s - p.s, ob.x - p.x) <= SNOWBALL.burstRadius)) {
      this.shatter(this.ctx, this.caster, o);
    }
  }
}

export const snowball: SkillImpl = { id: ID, cast: (ctx, r) => new Snowball(ctx, r) };
