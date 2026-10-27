// ult.storm — 雷暴: a thunderstorm breaks over the road ahead; everybody in it is soaked first and then struck,
// bolt by bolt, until the whole stretch in front is under the weather. The officers the storm reaches go down
// with it (ko: the big ults flatten the police they hit, SPEC §25).
import type { RiderState } from '../../../../core/types';
import { applyElement } from '../../elements';
import { targetable, type CombatCtx } from '../../ctx';
import { FlatRing } from '../../visuals/waves';
import { obstaclesIn, skillHit, skillObstacleHit } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { BoltStrike, StormVeil } from './visuals';

const ID = 'ult.storm';
export const STORM = {
  dur: 2.5,        // s of the storm
  from: 5,         // m in front of the caster the storm starts
  to: 50,          // m it reaches
  halfWidth: 8,    // m to the side of the road it covers
  bands: 6,        // how many bolts walk the stretch
  interval: 0.36,  // s between the bolts
  first: 0.3,      // s before the first bolt
  damage: 14,
} as const;

class Storm extends TimedSkill {
  private soaked = false;
  private next = 0;
  private victims = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, STORM.dur, true, 'ult');
    ctx.visuals.add(new StormVeil(ctx.visuals, r, STORM.dur, STORM.to - STORM.from));
    ctx.bus.emit('ult:start', { riderId: r.id, skillId: ID });
  }

  /** m the band `i` starts at, in front of the caster. */
  private band(i: number): number {
    return STORM.from + (i * (STORM.to - STORM.from)) / STORM.bands;
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    if (!this.soaked) {
      this.soaked = true;
      for (const v of ctx.session.riders) {
        if (v === r || !targetable(ctx, v)) continue;
        const ds = v.s - r.s;
        if (ds < STORM.from || ds > STORM.to || Math.abs(v.x - r.x) > STORM.halfWidth) continue;
        applyElement(ctx, r, v, 'water'); // the rain soaks everybody under the weather
      }
    }
    while (this.next < STORM.bands && this.t >= STORM.first + this.next * STORM.interval) {
      this.strike(ctx, r, this.next++);
    }
  }

  /** One bolt: it hits everybody in its band of the road. */
  private strike(ctx: CombatCtx, r: RiderState, i: number): void {
    const from = this.band(i);
    const to = this.band(i + 1);
    let first = true;
    for (const v of ctx.session.riders) {
      if (v === r || !targetable(ctx, v)) continue;
      const ds = v.s - r.s;
      if (ds < from || ds > to || Math.abs(v.x - r.x) > STORM.halfWidth) continue;
      skillHit(ctx, r, v, ID, { damage: STORM.damage, knock: 2, speedLoss: 0.1, countCombo: first });
      applyElement(ctx, r, v, 'thunder'); // on a soaked rider the bolt chains through the wet ones
      this.victims.add(v.id);
      first = false;
    }
    for (const o of obstaclesIn(ctx, r, (ob, ods, odx) => ods >= from && ods <= to && Math.abs(odx) <= STORM.halfWidth)) {
      skillObstacleHit(ctx, r, o, ID, STORM.damage, true);
    }
    const at = r.s + (from + to) / 2;
    ctx.visuals.add(new BoltStrike(ctx.visuals, at, r.x, 0.35, '#bfe6ff'));
    ctx.visuals.add(new FlatRing(ctx.visuals, at, r.x, { color: '#8fd0ff', from: 0.5, to: 6, dur: 0.5 }));
    ctx.session.app.fx.burst('zaps', ctx.world(at, r.x, 1.2), { count: 8 });
  }

  protected override cleanup(): void {
    if (this.next < STORM.bands) return; // the storm was cut short: no impact to announce
    const { ctx, caster: r } = this;
    ctx.bus.emit('ult:impact', { riderId: r.id, skillId: ID, pos: ctx.pos(r, 0.2), victims: [...this.victims] });
  }
}

export const storm: SkillImpl = { id: ID, cast: (ctx, r) => new Storm(ctx, r) };
