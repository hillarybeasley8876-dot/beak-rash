// bananacat.peel — 香蕉皮: three peels are tossed up over the cat's head, one after another, and land on the road
// behind it; whoever rides over one skids out of control (mirrored steering, a slick grip and a short slow). The
// toss is the point (r7 SPEC §29): a peel dropped straight down behind the rider lands under the chase camera and
// is never seen, so each one flies a visible arc first. The peel is a trap, not a weapon: it never damages
// anybody, and the caster is immune to its own mess.
import type { RiderState } from '../../../../core/types';
import { clampToRoad, targetable, type CombatCtx } from '../../ctx';
import { addStatus } from '../../statuses';
import { FlatRing } from '../../visuals/waves';
import { skillAffect } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { PeelField, type PeelSpot } from './visuals';

const ID = 'bananacat.peel';
export const PEEL = {
  count: 3,        // peels tossed per cast
  gap: 0.22,       // s between the tosses
  flight: 0.7,     // s a peel is in the air (up over the cat's head, then down behind it)
  apex: 2.6,       // m the arc reaches above the road
  launch: 1.1,     // m above the road the peel leaves the cat's paw
  reach: 0.7,      // m in front of the caster the toss starts
  fan: 0.7,        // m to the side the outer peels land (they spread across the lane)
  behind: 1.2,     // m behind the caster a peel lands (as it flies, so the three land strung out)
  air: 1.5,        // scale in the air (read against the sky, a few metres from the camera)
  ground: 1.5,     // scale on the road
  slick: 0.8,      // m radius of the yellow slick under a landed peel
  halo: 0.55,      // m radius of the glow around a peel in flight
  radius: 1.6,     // m a rider has to be near to skid on it
  life: 4,         // s the peel lies on the road
  confused: 1.8,   // s of mirrored steering
  wobble: 0.9,     // s of a slippery grip
  slow: 0.25,      // fraction of speed lost
  slowTime: 1.5,
} as const;

class Peel extends TimedSkill {
  private plan: PeelSpot[] = [];
  private air: PeelSpot[] = [];
  private down: PeelSpot[] = [];
  private next = 0;
  private skidded = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, PEEL.life, false);
    for (let i = 0; i < PEEL.count; i++) this.plan.push({ s: 0, x: 0, at: i * PEEL.gap, fromS: 0, fromX: 0 });
    ctx.visuals.add(new PeelField(ctx.visuals, this.plan, PEEL.life, PEEL));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    while (this.next < this.plan.length && this.t >= (this.plan[this.next]?.at ?? 0)) {
      const spot = this.plan[this.next];
      if (spot) {
        const side = this.next - (PEEL.count - 1) / 2;   // −1, 0, +1: they fan out across the lane
        spot.fromS = r.s + PEEL.reach;
        spot.fromX = r.x + side * 0.3;
        this.air.push(spot);
        ctx.session.app.fx.burst('sparkle', ctx.world(spot.fromS, spot.fromX, PEEL.launch), { count: 3, scale: 0.5 });
      }
      this.next++;
    }
    // a peel in the air is still aimed: it goes up over the cat's head and comes down just behind it, where the
    // riders chasing it are (both ends of the arc ride with the caster until it lands)
    for (const spot of this.air) {
      const side = this.plan.indexOf(spot) - (PEEL.count - 1) / 2;
      spot.fromS = r.s + PEEL.reach;
      spot.fromX = r.x + side * 0.3;
      spot.s = r.s - PEEL.behind;
      spot.x = clampToRoad(ctx, spot.s, r.x + side * PEEL.fan, 0.6);
    }
    for (let i = this.air.length - 1; i >= 0; i--) {
      const spot = this.air[i];
      if (!spot || this.t < spot.at + PEEL.flight) continue;
      this.air.splice(i, 1);
      this.down.push(spot);
      ctx.visuals.add(new FlatRing(ctx.visuals, spot.s, spot.x, { color: '#ffe27a', from: 0.3, to: PEEL.radius * 1.7, dur: 0.45 }));
      ctx.session.app.fx.burst('poof', ctx.world(spot.s, spot.x, 0.2), { count: 4, scale: 0.5 });
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
