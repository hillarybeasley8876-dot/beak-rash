// pool.pie — 画大饼: a big pie flies at the rider ahead; they stop to eat it (rooted 1.8 s).
import type { RiderState } from '../../../../core/types';
import { nearest, targetable, type CombatCtx } from '../../ctx';
import { FlatRing } from '../../visuals/waves';
import { skillAffect } from '../common';
import { TimedSkill, type EndReason, type SkillImpl } from '../types';
import { Flyer } from './flyer';

const ID = 'pool.pie';
export const PIE = {
  range: 20,    // m: how far ahead the pie can be thrown
  dur: 1.4,     // s the flight lasts
  speed: 45,    // m/s (a thrown pie has to keep up with a rider at full speed)
  reach: 1.2,   // m: the pie lands on the target
  rooted: 1.8,  // s the target stands there eating
  height: 1.3,  // m above the road
} as const;

/** The rider the pie is thrown at (the nearest one ahead). */
const pieTarget = (ctx: CombatCtx, r: RiderState): RiderState | undefined =>
  nearest(ctx, r, (o, ds, dx) => targetable(ctx, o) && ds > 1.5 && ds <= PIE.range && Math.abs(dx) < 4);

class Pie extends TimedSkill {
  private pie: Flyer;
  private target: RiderState | null;
  private landed = false;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, PIE.dur, false);
    this.target = pieTarget(ctx, r) ?? null;
    this.pie = ctx.visuals.add(new Flyer(ctx.visuals, ctx.lib.get('gag:pie'), { scale: 1, spin: 7 }));
    this.pie.s = r.s + 1.1;
    this.pie.x = r.x;
    this.pie.y = PIE.height;
  }

  /** The pie reaches the target: they stop to eat it. */
  private land(v: RiderState): void {
    this.landed = true;
    this.pie.stop();
    skillAffect(this.ctx, this.caster, v, ID, [['rooted', PIE.rooted, 1]]);
    this.ctx.visuals.add(new FlatRing(this.ctx.visuals, v.s, v.x, { color: '#f0d9a4', from: 0.2, to: 1.7, dur: 0.5 }));
  }

  protected tick(dt: number): void {
    if (this.landed) return;
    const { ctx } = this;
    const v = this.target;
    if (!v || !targetable(ctx, v)) return;
    const ds = v.s - this.pie.s, dx = v.x - this.pie.x;
    const dist = Math.hypot(ds, dx);
    if (dist <= Math.max(PIE.speed * dt, PIE.reach)) {
      this.land(v);
      return;
    }
    this.pie.s += (ds / dist) * PIE.speed * dt;
    this.pie.x += (dx / dist) * PIE.speed * dt;
    this.pie.y = PIE.height + Math.sin(Math.min(1, this.t / PIE.dur) * Math.PI) * 0.7;
  }

  protected override cleanup(reason: EndReason): void {
    this.pie.stop();
    // the flight ran out before the pie reached them: it still lands on the target's head
    if (reason === 'done' && !this.landed && this.target && targetable(this.ctx, this.target)) this.land(this.target);
  }
}

export const pie: SkillImpl = {
  id: ID, noTarget: '饼画给谁？', ready: (ctx, r) => pieTarget(ctx, r) !== undefined, cast: (ctx, r) => new Pie(ctx, r),
};
