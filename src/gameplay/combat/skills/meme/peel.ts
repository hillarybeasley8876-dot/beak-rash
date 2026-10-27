// bananacat.peel — 香蕉皮: three peels are dropped behind the caster, one after another; whoever rides over one
// skids out of control (mirrored steering, a slick grip and a short slow). The peel is a trap, not a weapon:
// it never damages anybody, and the caster is immune to its own mess.
import type { RiderState } from '../../../../core/types';
import { targetable, type CombatCtx } from '../../ctx';
import { addStatus } from '../../statuses';
import { FlatRing } from '../../visuals/waves';
import { skillAffect } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { PeelField, type PeelSpot } from './visuals';

const ID = 'bananacat.peel';
export const PEEL = {
  count: 3,        // peels dropped per cast
  gap: 0.35,       // s between the drops (they fall where the caster is by then)
  behind: 1.2,     // m behind the caster a peel lands
  radius: 1.6,     // m a rider has to be near to skid on it
  life: 4,         // s the peel lies on the road
  confused: 1.8,   // s of mirrored steering
  wobble: 0.9,     // s of a slippery grip
  slow: 0.25,      // fraction of speed lost
  slowTime: 1.5,
} as const;

class Peel extends TimedSkill {
  private plan: PeelSpot[] = [];
  private down: PeelSpot[] = [];
  private next = 0;
  private skidded = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, PEEL.life, false);
    for (let i = 0; i < PEEL.count; i++) this.plan.push({ s: 0, x: 0, at: i * PEEL.gap });
    ctx.visuals.add(new PeelField(ctx.visuals, this.plan, PEEL.life));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    while (this.next < this.plan.length && this.t >= (this.plan[this.next]?.at ?? 0)) {
      const spot = this.plan[this.next];
      if (spot) {
        spot.s = r.s - PEEL.behind;
        spot.x = r.x;
        this.down.push(spot);
        ctx.visuals.add(new FlatRing(ctx.visuals, spot.s, spot.x, { color: '#ffe27a', from: 0.3, to: PEEL.radius * 1.7, dur: 0.45 }));
        ctx.session.app.fx.burst('poof', ctx.world(spot.s, spot.x, 0.2), { count: 4, scale: 0.5 });
      }
      this.next++;
    }
    for (const spot of this.down) this.slip(ctx, r, spot);
  }

  /** A rider that touches a peel skids: no damage, only a lost rhythm. */
  private slip(ctx: CombatCtx, r: RiderState, spot: PeelSpot): void {
    for (const v of ctx.session.riders) {
      if (v === r || !targetable(ctx, v) || this.skidded.has(v.id)) continue;
      if (Math.hypot(v.s - spot.s, v.x - spot.x) > PEEL.radius) continue;
      this.skidded.add(v.id);
      addStatus(v, 'confused', PEEL.confused, 1, r.id);
      skillAffect(ctx, r, v, ID, [['wobble', PEEL.wobble, 1], ['slow', PEEL.slowTime, PEEL.slow]]);
      ctx.session.app.fx.burst('dust', ctx.pos(v, 0.2), { count: 6 });
    }
  }
}

export const peel: SkillImpl = { id: ID, cast: (ctx, r) => new Peel(ctx, r) };
