// pool.blink — 闪现: a flash of light and the rider appears 15 m further up the road. Never through a wall, never
// past the line, never off the asphalt.
import type { RiderState } from '../../../../core/types';
import { finished, type CombatCtx } from '../../ctx';
import { FlatRing } from '../../visuals/waves';
import { clearLane } from '../common';
import { TimedSkill, type SkillImpl } from '../types';

const ID = 'pool.blink';
export const BLINK = { dist: 15, gap: 5, dur: 0.3 } as const;

class Blink extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, BLINK.dur, false);
    const from = { s: r.s, x: r.x };
    const s = Math.min(ctx.session.track.length - BLINK.gap, r.s + BLINK.dist);
    if (s > r.s && !finished(r)) {
      r.x = clearLane(ctx, r, s, r.x);
      r.s = s;
      r.y = 0; // back on the road, never in the air over a jump
      r.vy = 0;
      r.airborne = false;
    }
    ctx.visuals.add(new FlatRing(ctx.visuals, from.s, from.x, { color: '#ffffff', from: 0.2, to: 1.8, dur: 0.35 }));
    ctx.visuals.add(new FlatRing(ctx.visuals, r.s, r.x, { color: '#7ef9ff', from: 0.2, to: 2.2, dur: 0.45, delay: 0.08 }));
  }

  protected tick(): void {}
}

export const blink: SkillImpl = { id: ID, cast: (ctx, r) => new Blink(ctx, r) };
