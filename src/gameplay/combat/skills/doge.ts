// shiba.doge — 3 s doge shield: melee bounces back at the attacker; +15 % speed.
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { addStatus } from '../statuses';
import { SHIELD_REFLECT } from '../tuning';
import { ShieldBubble } from '../visuals/auras';
import { skillBoost } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'shiba.doge';
export const DOGE = { dur: 3, boost: 0.15 } as const;

class Doge extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, DOGE.dur, false);
    addStatus(r, 'shield', DOGE.dur, SHIELD_REFLECT, r.id, true);
    skillBoost(ctx, r, DOGE.dur, DOGE.boost);
    ctx.visuals.add(new ShieldBubble(ctx.visuals, r, DOGE.dur, '#ffd23f'));
  }

  protected tick(): void {}
}

export const doge: SkillImpl = { id: ID, cast: (ctx, r) => new Doge(ctx, r) };
