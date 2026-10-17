// goose.honk — soundwave cone 14 m ±30°: riders the wave reaches are stunned 0.8 s and slowed 15 %.
import { DEG } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { ConeWave } from '../visuals/waves';
import { inCone, skillAffect } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'goose.honk';
export const HONK = { range: 14, cone: 30 * DEG, waveSpeed: 30, stun: 0.8, slow: 0.15, slowTime: 2 } as const;

class Honk extends TimedSkill {
  private done = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, HONK.range / HONK.waveSpeed + 0.35, false);
    ctx.visuals.add(new ConeWave(ctx.visuals, r, { color: '#ff8a00', count: 3, interval: 0.1, speed: HONK.waveSpeed, range: HONK.range, halfAngle: HONK.cone, height: 1.5 }));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    const front = 0.8 + this.t * HONK.waveSpeed;
    for (const v of inCone(ctx, r, Math.min(front, HONK.range), HONK.cone)) {
      if (this.done.has(v.id)) continue;
      this.done.add(v.id);
      skillAffect(ctx, r, v, ID, [['stun', HONK.stun, 1], ['slow', HONK.slowTime, HONK.slow]]);
    }
  }
}

export const honk: SkillImpl = { id: ID, cast: (ctx, r) => new Honk(ctx, r) };
