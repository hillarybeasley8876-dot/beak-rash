// pool.boomerang — 回旋咸鱼: a salted fish flies out in front of the caster and comes back; it hits a rider (and
// an officer in its reach) on the way out and again on the way home.
import type { RiderState } from '../../../../core/types';
import { targetable, type CombatCtx } from '../../ctx';
import { skillHit, skillObstacleHit, obstaclesIn } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { Flyer } from './flyer';

const ID = 'pool.boomerang';
export const BOOM = {
  out: 14,        // m the fish flies out (and the same distance back)
  dur: 1.2,       // s for the whole round trip
  damage: 10,     // per pass
  knock: 4,
  reach: 1.3,     // m around the fish that it hits
  height: 1.35,   // m above the road
} as const;

class Boomerang extends TimedSkill {
  private fish: Flyer;
  private riderHits = new Map<number, number>();  // rider id → the pass it was hit on
  private officerHits = new Map<number, number>(); // obstacle id → the pass it was hit on

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, BOOM.dur, false);
    this.fish = ctx.visuals.add(new Flyer(ctx.visuals, ctx.lib.get('gag:fish'), { scale: 1.3, spin: 9 }));
    this.place(0);
  }

  /** How far the fish is ahead of the caster (out and back on a sine: it leaves, turns and returns). */
  private distance(t: number): number {
    const u = Math.max(0, Math.min(1, t / BOOM.dur));
    return BOOM.out * Math.sin(Math.PI * u);
  }

  /** The pass the fish is on: 0 = out, 1 = home. */
  private get pass(): number {
    return this.t < BOOM.dur / 2 ? 0 : 1;
  }

  private place(d: number): void {
    const r = this.caster;
    this.fish.s = r.s + d;
    this.fish.x = r.x;
    this.fish.y = BOOM.height;
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    const d = this.distance(this.t);
    this.place(d);
    const pass = this.pass;
    for (const v of ctx.session.riders) {
      if (v === r || !targetable(ctx, v)) continue;
      if (this.riderHits.get(v.id) === pass) continue;
      if (Math.abs(v.s - r.s - d) > BOOM.reach || Math.abs(v.x - r.x) > BOOM.reach) continue;
      this.riderHits.set(v.id, pass);
      skillHit(ctx, r, v, ID, { damage: BOOM.damage, knock: BOOM.knock, countCombo: this.riderHits.size === 1 });
    }
    for (const o of obstaclesIn(ctx, r, (o, ds, dx) => Math.abs(ds - d) < o.halfLength + 0.5 && Math.abs(dx) < o.halfWidth + 0.5)) {
      if (this.officerHits.get(o.id) === pass) continue;
      this.officerHits.set(o.id, pass);
      skillObstacleHit(ctx, r, o, ID, BOOM.damage);
    }
  }

  protected override cleanup(): void {
    this.fish.stop();
  }
}

export const boomerang: SkillImpl = { id: ID, cast: (ctx, r) => new Boomerang(ctx, r) };
