// hamster.violin — 悲伤小提琴: the hamster plays a sad violin; everybody within earshot is too sad to use their
// skills. It silences, it does not damage: the hamster never wants to hurt anybody, it just makes them sad.
import type { RiderState } from '../../../../core/types';
import type { CombatCtx } from '../../ctx';
import { inRadius, skillAffect } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { ViolinPlayer } from './visuals';

const ID = 'hamster.violin';
export const VIOLIN = {
  dur: 3.5,      // s of playing
  radius: 8,     // m the tune reaches
  tick: 0.3,     // s between the silencings
  silence: 3,    // s a listener stays silent
} as const;

class Violin extends TimedSkill {
  private next = 0;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, VIOLIN.dur, false);
    ctx.visuals.add(new ViolinPlayer(ctx.visuals, r, VIOLIN.dur));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    if (this.t >= this.next) {
      this.next = this.t + VIOLIN.tick;
      for (const v of inRadius(ctx, r, VIOLIN.radius)) {
        skillAffect(ctx, r, v, ID, [['silenced', VIOLIN.silence, 1]]);
      }
      ctx.session.app.fx.burst('notes', ctx.pos(r, 1.6), { count: 3 });
    }
  }
}

export const violin: SkillImpl = { id: ID, cast: (ctx, r) => new Violin(ctx, r) };
