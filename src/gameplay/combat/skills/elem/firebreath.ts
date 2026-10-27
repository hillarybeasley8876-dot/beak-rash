// pool.firebreath — 喷火: a jet of flame 10 m ahead (±30°): everyone it licks burns (fire aura, damage over time).
// The flame also scorches the police officers in the cone (SPEC §25).
import { DEG } from '../../../../core/math';
import type { RiderState } from '../../../../core/types';
import { inCone, skillObstacleHit } from '../common';
import type { CombatCtx } from '../../ctx';
import { ConeWave } from '../../visuals/waves';
import { coneObstacles, elemHit } from './common';
import { TimedSkill, type SkillImpl } from '../types';

const ID = 'pool.firebreath';
export const FIREBREATH = {
  range: 10, cone: 30 * DEG, waveSpeed: 26, damage: 12, knock: 3, speedLoss: 0.1,
} as const;

class FireBreath extends TimedSkill {
  private riders = new Set<number>();
  private obstacles = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, FIREBREATH.range / FIREBREATH.waveSpeed + 0.3, false);
    ctx.visuals.add(new ConeWave(ctx.visuals, r, {
      color: '#ff6a1a', count: 3, interval: 0.08, speed: FIREBREATH.waveSpeed,
      range: FIREBREATH.range, halfAngle: FIREBREATH.cone, height: 1.3,
    }));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    const front = Math.min(FIREBREATH.range, 0.8 + this.t * FIREBREATH.waveSpeed);
    for (const v of inCone(ctx, r, front, FIREBREATH.cone)) {
      if (this.riders.has(v.id)) continue;
      this.riders.add(v.id);
      elemHit(ctx, r, v, ID, 'fire', { damage: FIREBREATH.damage, knock: FIREBREATH.knock, speedLoss: FIREBREATH.speedLoss });
      ctx.session.app.fx.burst('aura', ctx.pos(v), { color: '#ff7a18' });
    }
    for (const o of coneObstacles(ctx, r, front, FIREBREATH.cone)) {
      if (this.obstacles.has(o.id)) continue;
      this.obstacles.add(o.id);
      skillObstacleHit(ctx, r, o, ID, FIREBREATH.damage);
      ctx.session.app.fx.burst('aura', ctx.world(o.s, o.x, 1.1), { color: '#ff7a18' });
    }
  }
}

export const firebreath: SkillImpl = { id: ID, cast: (ctx, r) => new FireBreath(ctx, r) };
