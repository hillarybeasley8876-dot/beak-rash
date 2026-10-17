// SP economy (SPEC §7): hit +6, hurt +3, KO +20, drafting +1/s, near miss +4, perfect landing +8,
// drift L3 +5, bell +5. Gains from riding come from sim's rider:* events.
import { clamp } from '../../core/math';
import { SKILLS } from '../../data/skills';
import type { RiderState } from '../../core/types';
import type { CombatCtx } from './ctx';
import { SP } from './tuning';

export function gainSp(r: RiderState, amount: number): void {
  r.sp = clamp(r.sp + amount, 0, SP.max);
}

/** SP the attacker earns per point of a hit / KO by `skillId`: skills paid with SP (the ult) never refund it. */
export function spRefund(skillId: string | null): number {
  return skillId !== null && (SKILLS[skillId]?.spCost ?? 0) > 0 ? 0 : 1;
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
