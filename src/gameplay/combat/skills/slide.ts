// penguin.slide — belly slide for 2.5 s: melee-immune, +25 % speed, leaves an icy streak.
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { addStatus } from '../statuses';
import { SHIELD_IMMUNE } from '../tuning';
import { Trail } from '../visuals/trail';
import { skillBoost } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'penguin.slide';
export const SLIDE = { dur: 2.5, boost: 0.33 } as const;

class Slide extends TimedSkill {
  private streak: Trail;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, SLIDE.dur, true);
    addStatus(r, 'shield', SLIDE.dur, SHIELD_IMMUNE, r.id, true);
    skillBoost(ctx, r, SLIDE.dur, SLIDE.boost);
    this.streak = ctx.visuals.add(new Trail(ctx.visuals, (out) => {
      if (r.mode === 'crashed') return false;
      ctx.world(r.s, r.x, 0.06, out);
      return true;
    }, { color: '#9be7ff', width: 0.9, life: 0.7, max: 30, alpha: 0.7, taper: false }));
  }

  protected tick(): void {}

  protected override cleanup(): void {
    this.streak.stop();
  }
}

export const slide: SkillImpl = { id: ID, cast: (ctx, r) => new Slide(ctx, r) };
