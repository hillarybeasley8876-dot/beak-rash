// pool.tornado — 龙卷风: a whirlwind races along the road ahead of the caster and knocks everyone it meets over.
// Wind carries the elements it touches to the riders around them (SPEC §24); the police in its path are hit too.
import type { RiderState } from '../../../../core/types';
import { targetable, type CombatCtx } from '../../ctx';
import { obstaclesIn, skillObstacleHit } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { elemHit } from './common';
import { Whirl, type WhirlState } from './visuals';

const ID = 'pool.tornado';
export const TORNADO = {
  speed: 22, life: 2.2, radius: 2.6, damage: 10, knock: 5, speedLoss: 0.12,
} as const;

class Tornado extends TimedSkill {
  private where: WhirlState;
  private riders = new Set<number>();
  private obstacles = new Set<number>();
  private puff = 0;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, TORNADO.life, false);
    this.where = { s: r.s, x: r.x };
    ctx.visuals.add(new Whirl(ctx.visuals, this.where, TORNADO.life));
  }

  protected tick(dt: number): void {
    const { ctx, caster: r } = this;
    this.where.s = r.s + this.t * TORNADO.speed; // the whirlwind races ahead of the caster
    this.where.x = r.x;
    this.puff -= dt;
    if (this.puff <= 0) {
      this.puff = 0.12; // the dust it drags along the road
      ctx.session.app.fx.burst('smoke', ctx.world(this.where.s, this.where.x, 0.4), { color: '#cfe9ff', count: 2 });
    }
    for (const o of ctx.session.riders) {
      if (o === r || !targetable(ctx, o)) continue;
      if (Math.hypot(o.s - this.where.s, o.x - this.where.x) > TORNADO.radius) continue;
      if (this.riders.has(o.id)) continue;
      this.riders.add(o.id);
      elemHit(ctx, r, o, ID, 'wind', { damage: TORNADO.damage, knock: TORNADO.knock, speedLoss: TORNADO.speedLoss });
      ctx.session.app.fx.burst('smoke', ctx.pos(o), { color: '#cfe9ff' });
    }
    for (const o of obstaclesIn(ctx, r, (ob, ds, dx) => Math.hypot(ob.s - this.where.s, ob.x - this.where.x) <= TORNADO.radius)) {
      if (this.obstacles.has(o.id)) continue;
      this.obstacles.add(o.id);
      skillObstacleHit(ctx, r, o, ID, TORNADO.damage);
    }
  }
}

export const tornado: SkillImpl = { id: ID, cast: (ctx, r) => new Tornado(ctx, r) };
