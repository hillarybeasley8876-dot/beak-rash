// SP economy (tuning.ts SP, retuned r3): swing hit +2.5 (+0.5 on a rival already paid for in the last 4 s),
// skill hit +1, hurt +1.5, KO +10, ONE MORE +2, can +20, drafting +1/s, near miss +4, perfect landing +8,
// drift L3 +5, bell +3. Fighting pays nothing with an SP-paid skill (the ult) or for SP.afterUlt s after
// casting one. Gains from riding come from sim's rider:* events.
import { clamp } from '../../core/math';
import { SKILLS } from '../../data/skills';
import type { RiderState } from '../../core/types';
import type { CombatCtx } from './ctx';
import { SP } from './tuning';

export function gainSp(r: RiderState, amount: number): void {
  r.sp = clamp(r.sp + amount, 0, SP.max);
}

/**
 * 1 if `a`'s fighting (a hit, ONE MORE, a KO, a provoking bell) with `skillId` earns SP now, else 0: skills paid
 * with SP (the ult) never refund it, and nothing pays for SP.afterUlt s after such a cast.
 */
export function fightSp(ctx: CombatCtx, a: RiderState, skillId: string | null): number {
  if (skillId !== null && (SKILLS[skillId]?.spCost ?? 0) > 0) return 0;
  return ctx.time - ctx.rd(a).spSpentAt < SP.afterUlt ? 0 : 1;
}

/**
 * SP for `a` landing a hit on `v`: a skill pays SP.skillHit (the skill already did the work); a swing pays SP.hit
 * once per SP.repeatWindow s per victim and SP.repeatHit for the swings in between (beating one rival down pays
 * off with the KO, not per mash).
 */
export function hitSp(ctx: CombatCtx, a: RiderState, v: RiderState, skillId: string | null): number {
  if (fightSp(ctx, a, skillId) === 0) return 0;
  if (skillId !== null) return SP.skillHit;
  const paid = ctx.rd(a).hitPaid;
  if (ctx.time - (paid[v.id] ?? -Infinity) < SP.repeatWindow) return SP.repeatHit;
  paid[v.id] = ctx.time;
  return SP.hit;
}

/** Subscribe to riding events that grant SP. Returns the unsubscribe function. */
export function listenSp(ctx: CombatCtx): () => void {
  const { bus } = ctx;
  const who = (id: number): RiderState | undefined => {
    const r = ctx.session.rider(id);
    return r && r.mode === 'racing' ? r : undefined;
  };
  const offs = [
    bus.on('rider:nearMiss', ({ riderId }) => {
      const r = who(riderId);
      if (r) gainSp(r, SP.nearMiss);
    }),
    bus.on('rider:land', ({ riderId, perfect }) => {
      const r = who(riderId);
      if (r && perfect) gainSp(r, SP.perfect);
    }),
    bus.on('rider:drift', ({ riderId, phase, level }) => {
      const r = who(riderId);
      if (r && phase === 'level' && level >= 3) gainSp(r, SP.driftL3);
    }),
  ];
  return () => offs.forEach((off) => off());
}

/** Per substep: drafting trickle. */
export function tickSp(r: RiderState, dt: number): void {
  if (r.mode === 'racing' && r.draft > 0.3) gainSp(r, SP.draftPerSec * dt);
}
