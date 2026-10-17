// sloth.flash — 闪电: 3 s at +60 % top speed with instant acceleration.
import { BIKES } from '../../../data/bikes';
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { Lightning } from '../visuals/bolts';
import { skillBoost } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'sloth.flash';
export const FLASH = { dur: 3, boost: 0.6, launch: 1.2 } as const;

class Flash extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, FLASH.dur, false);
    skillBoost(ctx, r, FLASH.dur, FLASH.boost);
    r.speed = Math.max(r.speed, BIKES[r.bike].topSpeed * FLASH.launch);
    ctx.visuals.add(new Lightning(ctx.visuals, r, FLASH.dur));
  }

  protected tick(): void {}
}

export const flash: SkillImpl = { id: ID, cast: (ctx, r) => new Flash(ctx, r) };
