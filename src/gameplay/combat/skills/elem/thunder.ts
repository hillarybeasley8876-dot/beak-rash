// pool.thunder — 天打雷劈: a bolt out of the sky on the nearest opponent ahead (≤ 40 m, ±30°); in the rain it
// chains from rider to rider. It strikes the police in reach too (SPEC §25).
import { DEG } from '../../../../core/math';
import type { RiderState } from '../../../../core/types';
import { nearest, targetable, type CombatCtx } from '../../ctx';
import { obstaclesIn, skillObstacleHit } from '../common';
import { aheadAngle, TimedSkill, type SkillImpl } from '../types';
import { elemHit } from './common';
import { Bolt } from './visuals';

const ID = 'pool.thunder';
export const THUNDER = {
  range: 40, cone: 30 * DEG, damage: 14, stun: 0.3, speedLoss: 0.1,
  chainRadius: 18, chainMax: 3,
} as const;

/** Is it raining on the track (then the bolt chains)? */
function raining(ctx: CombatCtx): boolean {
  return ctx.session.track.weather === 'rain' || ctx.session.config.weather === 'rain';
}

class Thunder extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, 0.45, false);
    const rider = nearest(ctx, r, (o, ds, dx) => targetable(ctx, o) && ds > 0.5 && ds <= THUNDER.range &&
      aheadAngle(ds, dx) <= THUNDER.cone);
    const obstacles = obstaclesIn(ctx, r, (o, ds, dx) => ds > 0.5 && ds <= THUNDER.range &&
      aheadAngle(ds, dx) <= THUNDER.cone);
    let officer = obstacles[0];
    for (const o of obstacles) if (!officer || o.s < officer.s) officer = o;
    if (officer && (!rider || officer.s - r.s < rider.s - r.s)) {
      skillObstacleHit(ctx, r, officer, ID, THUNDER.damage);
      this.strike(ctx, officer.s, officer.x);
      return;
    }
    if (!rider) {
      // Nobody to strike: the bolt falls on the road ahead of the caster.
      this.strike(ctx, r.s + 6, r.x);
      return;
    }
    elemHit(ctx, r, rider, ID, 'thunder', { damage: THUNDER.damage, stun: THUNDER.stun, speedLoss: THUNDER.speedLoss });
    this.strike(ctx, rider.s, rider.x);
    if (raining(ctx)) this.chain(ctx, r, rider);
  }

  /** The bolt out of the sky onto a point on the road. */
  private strike(ctx: CombatCtx, s: number, x: number): void {
    ctx.visuals.add(new Bolt(ctx.visuals, s, x, '#fff2a8', 0.4));
    ctx.session.app.fx.burst('zaps', ctx.world(s, x, 1.2), { color: '#fff6a0' });
  }

  /** Rain: the bolt jumps to the riders nearby (up to `chainMax` of them). */
  private chain(ctx: CombatCtx, r: RiderState, first: RiderState): void {
    let n = 0;
    for (const o of ctx.session.riders) {
      if (n >= THUNDER.chainMax) break;
      if (o === r || o === first || !targetable(ctx, o)) continue;
      if (Math.hypot(o.s - first.s, o.x - first.x) > THUNDER.chainRadius) continue;
      elemHit(ctx, r, o, ID, 'thunder', { damage: THUNDER.damage, stun: THUNDER.stun, speedLoss: THUNDER.speedLoss });
      this.strike(ctx, o.s, o.x);
      n++;
    }
  }

  protected tick(): void {}
}

export const thunder: SkillImpl = { id: ID, cast: (ctx, r) => new Thunder(ctx, r) };
