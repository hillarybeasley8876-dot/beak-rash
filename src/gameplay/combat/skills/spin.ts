// cat.spin — OIIA: 0.8 s spin, everyone within 2.6 m takes 10 dmg + knockback (once per cast), police officers too.
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { SpinSwirl } from '../visuals/auras';
import { inRadius, obstaclesIn, skillHit, skillObstacleHit } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'cat.spin';
export const SPIN = { dur: 0.8, radius: 2.6, damage: 10, knock: 5.5 } as const;

class Spin extends TimedSkill {
  private hit = new Set<number>();
  private hitObstacles = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, SPIN.dur, true);
    ctx.visuals.add(new SpinSwirl(ctx.visuals, r, SPIN.radius, SPIN.dur, ['#ffb347', '#ffffff']));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    for (const v of inRadius(ctx, r, SPIN.radius)) {
      if (this.hit.has(v.id)) continue;
      this.hit.add(v.id);
      skillHit(ctx, r, v, ID, { damage: SPIN.damage, knock: SPIN.knock, speedLoss: 0.08, countCombo: this.hit.size === 1 });
    }
    for (const o of obstaclesIn(ctx, r, (_o, ds, dx) => Math.hypot(ds, dx) <= SPIN.radius)) {
      if (this.hitObstacles.has(o.id)) continue;
      this.hitObstacles.add(o.id);
      skillObstacleHit(ctx, r, o, ID, SPIN.damage);
    }
  }
}

export const spin: SkillImpl = { id: ID, cast: (ctx, r) => new Spin(ctx, r) };
