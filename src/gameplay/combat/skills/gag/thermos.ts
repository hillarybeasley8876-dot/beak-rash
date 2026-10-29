// pool.thermos — 枸杞保温杯: a gulp of goji tea. HP back, every negative status washed off, a short pick-me-up so a
// cast at full HP still does something, and a green goji steam swirl around the rider.
import type { RiderState, StatusId } from '../../../../core/types';
import { type CombatCtx } from '../../ctx';
import { CLEANSABLE, removeStatus } from '../../statuses';
import { ShieldBubble } from '../../visuals/shield';
import { FlatRing } from '../../visuals/waves';
import { skillBoost } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { GojiSteam } from './steam';

const ID = 'pool.thermos';
export const THERMOS = {
  heal: 30,                              // HP back
  dur: 1.2,                              // s the cast holds
  kick: { time: 1.5, power: 0.15 },      // 枸杞提神: the pick-me-up a cast at full HP still feels (r7 SPEC §29)
  steam: 1.6,                            // s the goji steam swirls
} as const;

/** What the caster reads over their own head: 「+30 HP」, with the cleanse 「+30 HP · 净化 2」, at full HP 「枸杞提神」. */
export function thermosResult(healed: number, cleaned: number): string {
  const parts: string[] = [];
  if (healed > 0) parts.push(`+${Math.round(healed)} HP`);
  if (cleaned > 0) parts.push(`净化 ${cleaned}`);
  return parts.length > 0 ? parts.join(' · ') : '枸杞提神';
}

class Thermos extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, THERMOS.dur, false);
    const before = r.hp;
    r.hp = Math.min(r.maxHp, r.hp + THERMOS.heal);
    const dirty: StatusId[] = [];
    for (const st of r.statuses) if (CLEANSABLE.has(st.id) && !dirty.includes(st.id)) dirty.push(st.id);
    for (const id of dirty) removeStatus(r, id);
    skillBoost(ctx, r, THERMOS.kick.time, THERMOS.kick.power);
    ctx.visuals.add(new ShieldBubble(ctx.visuals, r, THERMOS.dur, '#ffb347'));
    ctx.visuals.add(new GojiSteam(ctx.visuals, r, THERMOS.steam));
    ctx.visuals.add(new FlatRing(ctx.visuals, r.s, r.x, { color: '#9be564', from: 0.2, to: 2.6, dur: 0.6 }));
    ctx.bus.emit('skill:result', { riderId: r.id, skillId: ID, text: thermosResult(r.hp - before, dirty.length), good: true });
  }

  protected tick(): void {}
}

export const thermos: SkillImpl = { id: ID, cast: (ctx, r) => new Thermos(ctx, r) };
