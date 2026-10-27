// pool.thermos — 枸杞保温杯: a gulp of goji tea. HP back, and every negative status washed off.
import type { RiderState, StatusId } from '../../../../core/types';
import { type CombatCtx } from '../../ctx';
import { CLEANSABLE, removeStatus } from '../../statuses';
import { ShieldBubble } from '../../visuals/shield';
import { FlatRing } from '../../visuals/waves';
import { TimedSkill, type SkillImpl } from '../types';

const ID = 'pool.thermos';
export const THERMOS = { heal: 30, dur: 1.2 } as const;

class Thermos extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, THERMOS.dur, false);
    r.hp = Math.min(r.maxHp, r.hp + THERMOS.heal);
    const dirty: StatusId[] = [];
    for (const st of r.statuses) if (CLEANSABLE.has(st.id) && !dirty.includes(st.id)) dirty.push(st.id);
    for (const id of dirty) removeStatus(r, id);
    ctx.visuals.add(new ShieldBubble(ctx.visuals, r, THERMOS.dur, '#ffb347'));
    ctx.visuals.add(new FlatRing(ctx.visuals, r.s, r.x, { color: '#9be564', from: 0.2, to: 2, dur: 0.5 }));
  }

  protected tick(): void {}
}

export const thermos: SkillImpl = { id: ID, cast: (ctx, r) => new Thermos(ctx, r) };
