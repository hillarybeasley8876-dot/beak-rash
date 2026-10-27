// pool.firecracker — 二踢脚: a lit firecracker hops along the road behind the caster; when a rider comes close
// it goes off (12 dmg + fire) and takes the police in the blast with it (SPEC §25).
import type { RiderState } from '../../../../core/types';
import { targetable, type CombatCtx } from '../../ctx';
import { obstaclesIn, skillObstacleHit } from '../common';
import { FlatRing } from '../../visuals/waves';
import { TimedSkill, type SkillImpl } from '../types';
import { elemHit } from './common';
import { Crack } from './visuals';

const ID = 'pool.firecracker';
export const FIRECRACKER = {
  back: 2.5, fuse: 3, trigger: 3, blast: 3.5, damage: 12, knock: 4, speedLoss: 0.1,
} as const;

class Firecracker extends TimedSkill {
  private done = false;
  private spark = 0;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, FIRECRACKER.fuse, false);
    ctx.visuals.add(new Crack(ctx.visuals, r, FIRECRACKER.fuse, FIRECRACKER.back));
  }

  protected tick(dt: number): void {
    if (this.done) return;
    const { ctx, caster: r } = this;
    const at = { s: r.s - FIRECRACKER.back, x: r.x }; // the little firecracker hops along behind the caster
    this.spark -= dt;
    if (this.spark <= 0) {
      this.spark = 0.1; // the lit fuse
      ctx.session.app.fx.burst('zaps', ctx.world(at.s, at.x, 0.5), { color: '#ffd24a', count: 2 });
    }
    let near = false;
    for (const o of ctx.session.riders) {
      if (o === r || !targetable(ctx, o)) continue;
      if (Math.hypot(o.s - at.s, o.x - at.x) > FIRECRACKER.trigger) continue;
      near = true;
      break;
    }
    if (!near) return;
    this.done = true;
    for (const o of ctx.session.riders) {
      if (o === r || !targetable(ctx, o)) continue;
      if (Math.hypot(o.s - at.s, o.x - at.x) > FIRECRACKER.blast) continue;
      elemHit(ctx, r, o, ID, 'fire', { damage: FIRECRACKER.damage, knock: FIRECRACKER.knock, speedLoss: FIRECRACKER.speedLoss });
      ctx.session.app.fx.burst('aura', ctx.pos(o), { color: '#ff7a18' });
    }
    for (const o of obstaclesIn(ctx, r, (ob, ds, dx) => Math.hypot(ob.s - at.s, ob.x - at.x) <= FIRECRACKER.blast)) {
      skillObstacleHit(ctx, r, o, ID, FIRECRACKER.damage);
    }
    ctx.visuals.add(new FlatRing(ctx.visuals, at.s, at.x, { color: '#ffb347', from: 0.3, to: FIRECRACKER.blast, dur: 0.4 }));
    ctx.session.app.fx.burst('aura', ctx.world(at.s, at.x, 0.8), { color: '#ff7a18', scale: 1.4 });
  }
}

export const firecracker: SkillImpl = { id: ID, cast: (ctx, r) => new Firecracker(ctx, r) };
