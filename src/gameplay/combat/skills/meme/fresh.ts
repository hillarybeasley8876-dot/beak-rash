// xinxian.fresh — 五秒真香: for five seconds every pickup within reach is sucked in; every bite makes it faster
// (up to a fifth more speed). The five seconds are the point: the fresh one eats whatever is freshest.
import type { RiderState } from '../../../../core/types';
import type { CombatCtx } from '../../ctx';
import { VacuumSpiral } from '../../visuals/bolts';
import { skillBoost } from '../common';
import { TimedSkill, type SkillImpl } from '../types';

const ID = 'xinxian.fresh';
export const FRESH = {
  dur: 5,        // s the fresh window lasts
  radius: 12,    // m of pickups that get sucked in
  boost: 0.06,   // speed per bite
  boostTime: 3,
  maxBoost: 0.4, // the cap (never more than +40 %)
} as const;

class Fresh extends TimedSkill {
  private eaten = 0;
  private off: () => void;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, FRESH.dur, false);
    ctx.visuals.add(new VacuumSpiral(ctx.visuals, r, FRESH.dur, 6));
    this.off = ctx.bus.on('pickup:take', (e) => {
      if (e.riderId !== r.id) return;
      this.eaten++;
      skillBoost(ctx, r, FRESH.boostTime, Math.min(FRESH.maxBoost, this.eaten * FRESH.boost));
    });
  }

  protected tick(dt: number): void {
    this.ctx.pickups.vacuum(this.caster, FRESH.radius, dt);
  }

  protected override cleanup(): void {
    this.off();
    this.ctx.pickups.releaseVacuum(this.caster);
  }
}

export const fresh: SkillImpl = { id: ID, cast: (ctx, r) => new Fresh(ctx, r) };
