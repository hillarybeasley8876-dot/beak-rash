// pool.brainfight — 左右脑互搏: the riders around get their steering mirrored (their left hand steers right) for
// 3 s, so they swerve into whatever they were trying to avoid.
import type { RiderState } from '../../../../core/types';
import { type CombatCtx } from '../../ctx';
import { addStatus } from '../../statuses';
import { AuraDisc } from '../../visuals/auras';
import { inRadius } from '../common';
import { TimedSkill, type SkillImpl } from '../types';

const ID = 'pool.brainfight';
export const BRAIN = {
  radius: 5,   // m: who hears the argument in their head
  dur: 3,      // s
  linger: 0.4, // s: the last rider keeps the mirrored steering a moment longer
} as const;

class BrainFight extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, BRAIN.dur, false);
    ctx.visuals.add(new AuraDisc(ctx.visuals, r, BRAIN.radius, BRAIN.dur, '#c08bff', '#7a3cff'));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    for (const v of inRadius(ctx, r, BRAIN.radius)) addStatus(v, 'confused', BRAIN.linger, 1, r.id);
  }
}

export const brainfight: SkillImpl = { id: ID, cast: (ctx, r) => new BrainFight(ctx, r) };
