// pool.rocket — 窜天猴: a firecracker under the saddle: the rider shoots forward (+35 % top speed for 3 s) and
// leaves a scorching line on the road behind them. Whoever rides over the line burns (SPEC §24, §25).
import type { RiderState } from '../../../../core/types';
import { targetable, type CombatCtx } from '../../ctx';
import { obstaclesIn, skillBoost, skillObstacleHit } from '../common';
import { Trail } from '../../visuals/trail';
import { TimedSkill, type SkillImpl } from '../types';
import { elemHit } from './common';
import { Ember } from './visuals';

const ID = 'pool.rocket';
export const ROCKET = {
  boost: 0.35, boostTime: 3, dash: 5, life: 3, gap: 2.5, patchRadius: 1.8,
  damage: 6, speedLoss: 0.05, knock: 2,
} as const;

/** A burning patch of road the rocket left behind. */
interface Patch { s: number; x: number }

class Rocket extends TimedSkill {
  private patches: Patch[] = [];
  private lastS = 0;
  private burned = new Set<number>();
  private police = new Set<number>();
  private trail: Trail;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, ROCKET.life, false);
    skillBoost(ctx, r, ROCKET.boostTime, ROCKET.boost);
    ctx.session.physics.applyImpulse(r, { forward: ROCKET.dash });
    this.lastS = r.s;
    const vs = ctx.visuals;
    this.trail = vs.add(new Trail(vs, (out) => {
      if (r.mode === 'crashed') return false;
      vs.local(r, 0, 0.5, 0.4, out);
      return true;
    }, { color: '#ff8a20', width: 0.4, life: 0.35, max: 20, alpha: 0.8, additive: true }));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    if (r.s - this.lastS >= ROCKET.gap) {
      this.lastS = r.s;
      this.patches.push({ s: r.s - 0.6, x: r.x });
      ctx.visuals.add(new Ember(ctx.visuals, r.s - 0.6, r.x, ROCKET.life));
    }
    for (const p of this.patches) {
      for (const o of ctx.session.riders) {
        if (o === r || !targetable(ctx, o) || this.burned.has(o.id)) continue;
        if (Math.hypot(o.s - p.s, o.x - p.x) > ROCKET.patchRadius) continue;
        this.burned.add(o.id);
        elemHit(ctx, r, o, ID, 'fire', { damage: ROCKET.damage, knock: ROCKET.knock, speedLoss: ROCKET.speedLoss });
        ctx.session.app.fx.burst('aura', ctx.pos(o), { color: '#ff7a18' });
      }
      for (const o of obstaclesIn(ctx, r, (ob, ds, dx) => Math.hypot(ob.s - p.s, ob.x - p.x) <= ROCKET.patchRadius)) {
        if (this.police.has(o.id)) continue;
        this.police.add(o.id);
        skillObstacleHit(ctx, r, o, ID, ROCKET.damage);
      }
    }
  }

  protected override cleanup(): void {
    this.trail.stop();
    this.patches.length = 0;
  }
}

export const rocket: SkillImpl = { id: ID, cast: (ctx, r) => new Rocket(ctx, r) };
