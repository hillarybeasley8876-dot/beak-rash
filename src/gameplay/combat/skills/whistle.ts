// corgi.whistle — 哔——! Offenders ahead within 20 m (heat, or a hit landed in the last 6 s) are slowed
// for 1 s. Law-abiding riders only hear it.
import { DEG } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { ConeWave } from '../visuals/waves';
import { inCone, skillAffect } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'corgi.whistle';
export const WHISTLE = { range: 20, cone: 35 * DEG, slow: 0.35, time: 1, recent: 6 } as const;

class Whistle extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, 0.8, false);
    ctx.visuals.add(new ConeWave(ctx.visuals, r, { color: '#5aa9ff', count: 4, interval: 0.08, speed: 34, range: WHISTLE.range, halfAngle: WHISTLE.cone, height: 1.4 }));
    for (const v of inCone(ctx, r, WHISTLE.range, WHISTLE.cone)) {
      const offender = v.heat > 0.05 || ctx.now() - ctx.rd(v).lastAttack < WHISTLE.recent;
      if (offender) skillAffect(ctx, r, v, ID, [['slow', WHISTLE.time, WHISTLE.slow]]);
    }
  }

  protected tick(): void {}
}

export const whistle: SkillImpl = { id: ID, cast: (ctx, r) => new Whistle(ctx, r) };
