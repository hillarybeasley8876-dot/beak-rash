// pool.boomerang — 回旋咸鱼: a whole salted fish, big enough to read, flies out over the caster's head and comes
// back behind a white swoosh, glinting where it turns; it hits a rider (and an officer in its reach) on the way out
// and again on the way home.
import type { RiderState } from '../../../../core/types';
import { targetable, type CombatCtx } from '../../ctx';
import { Trail } from '../../visuals/trail';
import { FlatRing } from '../../visuals/waves';
import { skillHit, skillObstacleHit, obstaclesIn } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { Flyer } from './flyer';
import { Glint } from './glint';

const ID = 'pool.boomerang';
export const BOOM = {
  out: 16,        // m the fish flies out (and the same distance back)
  dur: 1.8,       // s for the whole round trip (it leaves slower now, so the eye can follow it)
  damage: 10,     // per pass
  knock: 4,
  reach: 1.3,     // m around the fish that it hits (the fish looks twice as big now, its hitbox does not grow with
                  // it: a wider one had rivals' fish landing on the player so often that the SP came in too fast)
  height: 1.85,   // m above the road: over the caster's head, so the fish is never hidden behind it
  scale: 3,       // the fish's size: a whole salted fish, twice the old throw (r7 SPEC §29)
  spin: 9,        // rad/s
  trail: { width: 0.7, life: 0.35, max: 26, alpha: 0.55 }, // the white swoosh behind it
  glint: { size: 2.2, dur: 0.4 },                            // the flash where it turns round
} as const;

class Boomerang extends TimedSkill {
  private fish: Flyer;
  private swoosh: Trail;
  private glinted = -1;                                   // the pass whose turn already flashed
  private riderHits = new Map<number, number>();  // rider id → the pass it was hit on
  private officerHits = new Map<number, number>(); // obstacle id → the pass it was hit on

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, BOOM.dur, false);
    this.fish = ctx.visuals.add(new Flyer(ctx.visuals, ctx.lib.get('gag:fish'), { scale: BOOM.scale, spin: BOOM.spin }));
    this.swoosh = ctx.visuals.add(new Trail(ctx.visuals, (out) => {
      ctx.world(this.fish.s, this.fish.x, this.fish.y, out);
      return true;
    }, { color: '#ffffff', ...BOOM.trail, additive: true }));
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
    this.turnGlint(pass);
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

  /** The turn glint: a flash where the fish turns round at the far end of its flight (never over the caster's face). */
  private turnGlint(pass: number): void {
    if (pass !== 1 || this.glinted === pass) return;
    this.glinted = pass;
    const { ctx } = this;
    ctx.visuals.add(new Glint(ctx.visuals, this.fish.s, this.fish.x, this.fish.y, BOOM.glint));
    ctx.visuals.add(new FlatRing(ctx.visuals, this.fish.s, this.fish.x, { color: '#ffffff', from: 0.3, to: 2.6, dur: 0.4 }));
  }

  protected override cleanup(): void {
    this.fish.stop();
    this.swoosh.stop();
  }
}

export const boomerang: SkillImpl = { id: ID, cast: (ctx, r) => new Boomerang(ctx, r) };
