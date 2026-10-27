// pool.watergun — 滋水枪: a jet of water 9 m ahead (±28°): it soaks the riders it hits and shoves them aside.
// The jet keeps pushing for a moment, so the rider it hits really leaves your lane (SPEC §25: the police too).
import { DEG } from '../../../../core/math';
import type { RiderState } from '../../../../core/types';
import { targetable, type CombatCtx } from '../../ctx';
import { inCone, skillObstacleHit } from '../common';
import { ConeWave } from '../../visuals/waves';
import { coneObstacles, elemHit } from './common';
import { TimedSkill, type SkillImpl } from '../types';

const ID = 'pool.watergun';
export const WATERGUN = {
  range: 9, cone: 28 * DEG, waveSpeed: 30, damage: 8, knock: 6, push: 0.4, pushTime: 0.3, speedLoss: 0.05,
} as const;

class WaterGun extends TimedSkill {
  private riders = new Set<number>();
  private pushed: RiderState[] = [];
  private obstacles = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, WATERGUN.range / WATERGUN.waveSpeed + 0.3, false);
    ctx.visuals.add(new ConeWave(ctx.visuals, r, {
      color: '#7fd8ff', count: 3, interval: 0.07, speed: WATERGUN.waveSpeed,
      range: WATERGUN.range, halfAngle: WATERGUN.cone, height: 1.2,
    }));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    const front = Math.min(WATERGUN.range, 0.8 + this.t * WATERGUN.waveSpeed);
    for (const v of inCone(ctx, r, front, WATERGUN.cone)) {
      if (this.riders.has(v.id)) continue;
      this.riders.add(v.id);
      elemHit(ctx, r, v, ID, 'water', { damage: WATERGUN.damage, knock: WATERGUN.knock, speedLoss: WATERGUN.speedLoss });
      this.pushed.push(v);
      ctx.session.app.fx.burst('splash', ctx.pos(v), { color: '#9fe4ff' });
    }
    for (const o of coneObstacles(ctx, r, front, WATERGUN.cone)) {
      if (this.obstacles.has(o.id)) continue;
      this.obstacles.add(o.id);
      skillObstacleHit(ctx, r, o, ID, WATERGUN.damage);
    }
    // the jet keeps shoving while it lasts
    if (this.t < WATERGUN.pushTime) {
      for (const v of this.pushed) {
        if (!targetable(ctx, v)) continue;
        ctx.session.physics.applyImpulse(v, { lateral: (v.x >= r.x ? 1 : -1) * WATERGUN.push });
      }
    }
  }
}

export const watergun: SkillImpl = { id: ID, cast: (ctx, r) => new WaterGun(ctx, r) };
