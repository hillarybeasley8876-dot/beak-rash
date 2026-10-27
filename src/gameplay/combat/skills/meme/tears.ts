// cryingcat.tears — 泪如雨下: a little rain falls over the crying cat; everyone under it is soaked and slowed,
// while the cat itself speeds up (crying makes you faster than you look).
import type { RiderState } from '../../../../core/types';
import { applyElement } from '../../elements';
import type { CombatCtx } from '../../ctx';
import { AuraDisc } from '../../visuals/auras';
import { inRadius, skillAffect, skillBoost } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { RainCloud } from './visuals';

const ID = 'cryingcat.tears';
export const TEARS = {
  dur: 3.2,      // s the rain lasts
  radius: 9,     // m of rain around the caster
  tick: 0.25,    // s between the soakings
  slow: 0.3,     // fraction of speed the soaked riders lose
  slowTime: 1.2,
  boost: 0.25,   // the caster speeds up
  boostTime: 2.5,
} as const;

class Tears extends TimedSkill {
  private next = 0;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, TEARS.dur, false);
    ctx.visuals.add(new RainCloud(ctx.visuals, r, TEARS.dur, TEARS.radius));
    ctx.visuals.add(new AuraDisc(ctx.visuals, r, TEARS.radius, TEARS.dur, '#9fd0f0', '#5fa8e0'));
    skillBoost(ctx, r, TEARS.boostTime, TEARS.boost);
  }

  protected tick(): void {
    if (this.t < this.next) return;
    this.next = this.t + TEARS.tick;
    const { ctx, caster: r } = this;
    for (const v of inRadius(ctx, r, TEARS.radius)) {
      skillAffect(ctx, r, v, ID, [['slow', TEARS.slowTime, TEARS.slow]]);
      applyElement(ctx, r, v, 'water'); // the rain leaves its mark: the rider is wet
    }
  }
}

export const tears: SkillImpl = { id: ID, cast: (ctx, r) => new Tears(ctx, r) };
