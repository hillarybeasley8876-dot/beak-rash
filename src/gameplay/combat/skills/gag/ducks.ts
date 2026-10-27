// pool.ducks — 鸭鸭大军: five little yellow ducks charge forward and wobble whoever they meet (officers too).
import type { RiderState } from '../../../../core/types';
import { targetable, type CombatCtx } from '../../ctx';
import { addStatus } from '../../statuses';
import { obstaclesIn, skillHit, skillObstacleHit } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { Flyer } from './flyer';

const ID = 'pool.ducks';
export const DUCKS = {
  count: 5,      // ducks in the flock
  dur: 2.6,      // s they keep running
  speed: 15,     // m/s faster than the caster
  damage: 6,     // per rider they reach
  knock: 2,
  reach: 1.2,    // m around a duck that it bumps
  wobble: 1.4,   // s the bumped rider wobbles
  height: 0.3,   // m above the road
  lanes: [-1.4, -0.7, 0, 0.7, 1.4], // m beside the caster
} as const;

class Ducks extends TimedSkill {
  private ducks: Flyer[] = [];
  private lanes: number[] = [];
  private ahead = 0;              // m the flock is ahead of the caster
  private hitRiders = new Set<number>();
  private hitOfficers = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, DUCKS.dur, false);
    for (let i = 0; i < DUCKS.count; i++) {
      const lane = DUCKS.lanes[i] ?? 0;
      this.lanes.push(lane);
      const f = ctx.visuals.add(new Flyer(ctx.visuals, ctx.lib.get('gag:duck'), { scale: 1, bob: 0.05 }));
      f.s = r.s;
      f.x = r.x + lane;
      f.y = DUCKS.height;
      this.ducks.push(f);
    }
  }

  protected tick(dt: number): void {
    const { ctx, caster: r } = this;
    this.ahead += DUCKS.speed * dt;
    this.ducks.forEach((f, i) => {
      f.s = r.s + this.ahead;
      f.x = r.x + (this.lanes[i] ?? 0);
      f.y = DUCKS.height;
    });
    for (const f of this.ducks) {
      for (const v of ctx.session.riders) {
        if (v === r || !targetable(ctx, v) || this.hitRiders.has(v.id)) continue;
        if (Math.abs(v.s - f.s) > DUCKS.reach || Math.abs(v.x - f.x) > DUCKS.reach) continue;
        this.hitRiders.add(v.id);
        skillHit(ctx, r, v, ID, { damage: DUCKS.damage, knock: DUCKS.knock, countCombo: this.hitRiders.size === 1 });
        addStatus(v, 'wobble', DUCKS.wobble, 1, r.id);
      }
    }
    for (const o of obstaclesIn(ctx, r, (o, ds, dx) =>
      Math.abs(ds - this.ahead) < o.halfLength + 0.6 && Math.abs(dx) < DUCKS.reach + o.halfWidth)) {
      if (this.hitOfficers.has(o.id)) continue;
      this.hitOfficers.add(o.id);
      skillObstacleHit(ctx, r, o, ID, DUCKS.damage);
    }
  }

  protected override cleanup(): void {
    for (const f of this.ducks) f.stop();
  }
}

export const ducks: SkillImpl = { id: ID, cast: (ctx, r) => new Ducks(ctx, r) };
