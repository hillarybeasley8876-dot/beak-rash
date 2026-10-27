// ult.meteor — 陨石雨: meteors rain on the road ahead of the caster; whoever they hit catches fire. The shower
// walks the road from near to far, so the whole stretch in front is covered; the officers it reaches go down
// with it (ko: the big ults flatten the police they hit, SPEC §25).
import type { RiderState } from '../../../../core/types';
import { applyElement } from '../../elements';
import { targetable, type CombatCtx } from '../../ctx';
import { FlatRing } from '../../visuals/waves';
import { obstaclesIn, skillHit, skillObstacleHit } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { MeteorFall } from './visuals';

const ID = 'ult.meteor';
export const METEOR = {
  dur: 2.6,        // s of the shower
  count: 12,       // meteors
  interval: 0.17,  // s between the falls
  fall: 0.4,       // s a meteor takes to drop
  from: 4,         // m in front of the caster the shower starts
  step: 3.5,       // m between two meteors
  lateral: [0, 1.2, -1.2, 0.6, -0.6, 1.8, -1.8] as const, // m to the side, cycled
  radius: 3.5,     // m a meteor flattens
  damage: 11,
} as const;

class Meteor extends TimedSkill {
  private falling = 0;   // meteors on their way down
  private landed = 0;    // meteors that already hit
  private victims = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, METEOR.dur, true, 'ult');
    ctx.bus.emit('ult:start', { riderId: r.id, skillId: ID });
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    while (this.falling < METEOR.count && this.t >= this.falling * METEOR.interval) {
      const i = this.falling++;
      const ds = METEOR.from + i * METEOR.step;
      const dx = METEOR.lateral[i % METEOR.lateral.length] as number;
      // the meteor always drops on the spot that is `ds` in front of the caster right now
      ctx.visuals.add(new MeteorFall(ctx.visuals, () => ({ s: r.s + ds, x: r.x + dx }), METEOR.fall));
    }
    while (this.landed < METEOR.count && this.t >= METEOR.fall + this.landed * METEOR.interval) {
      this.land(ctx, r, this.landed++);
    }
  }

  private land(ctx: CombatCtx, r: RiderState, i: number): void {
    const ds = METEOR.from + i * METEOR.step;
    const dx = METEOR.lateral[i % METEOR.lateral.length] as number;
    const s = r.s + ds;
    const x = r.x + dx;
    let first = true;
    for (const v of ctx.session.riders) {
      if (v === r || !targetable(ctx, v)) continue;
      if (Math.hypot(v.s - s, v.x - x) > METEOR.radius) continue;
      skillHit(ctx, r, v, ID, { damage: METEOR.damage, knock: 3, speedLoss: 0.1, countCombo: first });
      applyElement(ctx, r, v, 'fire'); // the meteor leaves them burning
      this.victims.add(v.id);
      first = false;
    }
    for (const o of obstaclesIn(ctx, r, (ob, ods, odx) => Math.hypot(ods - ds, odx - dx) <= METEOR.radius)) {
      skillObstacleHit(ctx, r, o, ID, METEOR.damage, true);
    }
    ctx.visuals.add(new FlatRing(ctx.visuals, s, x, { color: '#ff8a3c', from: 0.6, to: METEOR.radius * 2, dur: 0.7 }));
    ctx.visuals.add(new FlatRing(ctx.visuals, s, x, { color: '#ffd36b', from: 0.4, to: METEOR.radius, dur: 0.45 }));
    ctx.session.app.fx.burst('shockwave', ctx.world(s, x, 0.3), { count: 10, scale: 1.3 });
  }

  protected override cleanup(): void {
    if (this.landed < METEOR.count) return; // the shower was cut short: no impact to announce
    const { ctx, caster: r } = this;
    ctx.bus.emit('ult:impact', { riderId: r.id, skillId: ID, pos: ctx.pos(r, 0.2), victims: [...this.victims] });
  }
}

export const meteor: SkillImpl = { id: ID, cast: (ctx, r) => new Meteor(ctx, r) };
