// moodeng.bounce — Q弹冲击: the hippo calf bounces up and slams down in front of itself: everyone in the way
// takes the hit and is stunned. The leap is an external flight (the sim leaves the landing to the skill), and
// the slam is measured from the caster, so it never reaches behind it.
import type { RiderState } from '../../../../core/types';
import { targetable, type CombatCtx } from '../../ctx';
import { GroundRing } from '../../visuals/ground-ring';
import { FlatRing } from '../../visuals/waves';
import { obstaclesIn, skillHit, skillObstacleHit } from '../common';
import { TimedSkill, type SkillImpl } from '../types';

const ID = 'moodeng.bounce';
export const BOUNCE = {
  rise: 0.6,      // s of the leap before the slam
  height: 3.4,    // m of the hop
  ahead: 6,       // m in front of the caster the slam lands
  radius: 5,      // m around the slam point that takes the hit
  damage: 16,
  knock: 5,
  stun: 0.8,
  recover: 0.4,   // s of the landing pose after the slam
} as const;

class Bounce extends TimedSkill {
  private slammed = false;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, BOUNCE.rise + BOUNCE.recover, true);
    r.airborne = true;
  }

  /** Height of the hop at `t` (0 on the ground, at the top in the middle of the rise). */
  private heightAt(t: number): number {
    if (t >= BOUNCE.rise) return 0;
    return BOUNCE.height * Math.sin((Math.PI * t) / BOUNCE.rise);
  }

  private fly(dt: number): void {
    const r = this.caster;
    const y = this.heightAt(this.t);
    r.y = y;
    r.vy = dt > 0 ? (this.heightAt(this.t + dt) - y) / dt : 0;
    r.airborne = true;
  }

  override pre(dt: number): void {
    if (!this.slammed) this.fly(dt);
  }

  protected tick(dt: number): void {
    if (this.slammed) return;
    this.fly(dt);
    if (this.t >= BOUNCE.rise) this.slam();
  }

  private slam(): void {
    const { ctx, caster: r } = this;
    this.slammed = true;
    r.y = 0;
    r.vy = 0;
    r.airborne = false;
    const s = r.s + BOUNCE.ahead;
    const x = r.x;
    let first = true;
    for (const v of ctx.session.riders) {
      if (v === r || !targetable(ctx, v)) continue;
      if (Math.hypot(v.s - s, v.x - x) > BOUNCE.radius) continue;
      skillHit(ctx, r, v, ID, { damage: BOUNCE.damage, knock: BOUNCE.knock, stun: BOUNCE.stun, speedLoss: 0.15, countCombo: first });
      first = false;
    }
    for (const o of obstaclesIn(ctx, r, (ob, ds, dx) => Math.hypot(ds - BOUNCE.ahead, dx) <= BOUNCE.radius)) {
      skillObstacleHit(ctx, r, o, ID, BOUNCE.damage);
    }
    ctx.visuals.add(new GroundRing(ctx.visuals, s, x, { color: '#ff9ec4', from: 0.5, to: BOUNCE.radius, dur: 0.5, source: r }));
    ctx.visuals.add(new FlatRing(ctx.visuals, s, x, { color: '#ffffff', from: 0.4, to: BOUNCE.radius * 0.7, dur: 0.35 }));
    ctx.session.app.fx.burst('dust', ctx.world(s, x, 0.2), { count: 14, scale: 1.4 });
  }
}

export const bounce: SkillImpl = { id: ID, cast: (ctx, r) => new Bounce(ctx, r) };
