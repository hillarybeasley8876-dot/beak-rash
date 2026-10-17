// seagull.steal — MINE!: the nearest rival within 6 m loses its weapon (or 20 SP) to the seagull; an armed
// seagull knocks the weapon onto the road instead of swapping.
import type { RiderState } from '../../../core/types';
import { takeWeapon } from '../armory';
import type { CombatCtx } from '../ctx';
import { nudge } from '../feedback';
import { gainSp } from '../sp';
import { Tether } from '../visuals/bolts';
import { inRadius } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'seagull.steal';
export const STEAL = { radius: 6, sp: 20 } as const;

const victimOf = (ctx: CombatCtx, r: RiderState): RiderState | undefined => inRadius(ctx, r, STEAL.radius)[0];

class Steal extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, 0.42, false);
    const v = victimOf(ctx, r);
    if (!v) return;
    if (v.weapon !== 'none') takeWeapon(ctx, r, v);
    else {
      const amount = Math.min(STEAL.sp, v.sp);
      v.sp -= amount;
      gainSp(r, amount);
    }
    ctx.visuals.add(new Tether(ctx.visuals, r, v));
    ctx.bus.emit('skill:hit', { riderId: r.id, skillId: ID, victim: v.id, pos: ctx.pos(v) });
    ctx.bus.emit('taunt', { riderId: r.id, text: 'MINE!', character: r.character });
    nudge(ctx, v, 0.12);
  }

  protected tick(): void {}
}

export const steal: SkillImpl = {
  id: ID,
  ready: (ctx, r) => victimOf(ctx, r) !== undefined,
  cast: (ctx, r) => new Steal(ctx, r),
};
