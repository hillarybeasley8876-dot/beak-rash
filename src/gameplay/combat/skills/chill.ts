// capybara.chill — 10 m aura for 4 s: everyone inside rides ×0.85 and can't attack.
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { addStatus } from '../statuses';
import { AuraDisc } from '../visuals/auras';
import { inRadius } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'capybara.chill';
export const CHILL = { radius: 10, dur: 4, linger: 0.3 } as const;

class Chill extends TimedSkill {
  private touched = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, CHILL.dur, false);
    ctx.visuals.add(new AuraDisc(ctx.visuals, r, CHILL.radius, CHILL.dur, '#ffd36b', '#ff9f1a'));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    for (const v of inRadius(ctx, r, CHILL.radius)) {
      if (!addStatus(v, 'chill', CHILL.linger, 1, r.id) || this.touched.has(v.id)) continue;
      this.touched.add(v.id);
      ctx.bus.emit('skill:hit', { riderId: r.id, skillId: ID, victim: v.id, pos: ctx.pos(v) });
    }
  }
}

export const chill: SkillImpl = { id: ID, cast: (ctx, r) => new Chill(ctx, r) };
