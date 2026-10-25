// STYLE and trick rewards (SPEC §16, §17): a landed trick pays SP, a banked STYLE chain pays SP and
// coins. Both respect the r3 economy: nothing is paid in the 12 s after a SHOWTIME, and the bonus a
// rider may earn per race is bounded, so the SHOWTIME meter still fills about once a minute.
import type { RiderState } from '../../core/types';
import type { CombatCtx } from './ctx';
import { fightSp } from './sp';
import { SP } from './tuning';

/**
 * Pay bonus SP (a STYLE bank, a landed trick). The bar stops at SP.max like the fighting economy (a reward
 * on a full bar is lost and does not count), and a rider may only earn SP.rewardBudget of it per race.
 */
function payBonus(ctx: CombatCtx, r: RiderState, amount: number): void {
  if (amount <= 0) return;
  if (fightSp(ctx, r, null) === 0) return; // the 12 s after a SHOWTIME pay nothing
  const d = ctx.rd(r);
  const room = SP.rewardBudget - d.bonusSp;
  if (room <= 0) return;
  const pay = Math.min(amount, room, SP.max - r.sp);
  if (pay <= 0) return;
  d.bonusSp += pay;
  d.bonusPaid += pay;
  r.sp += pay;
}

/** Listen to the riding rewards. Returns the unsubscribe function. */
export function listenRewards(ctx: CombatCtx): () => void {
  const { bus } = ctx;
  const offTrick = bus.on('rider:trick', (e) => {
    if (e.phase !== 'land') return;
    const r = ctx.session.rider(e.riderId);
    if (r && r.mode === 'racing') payBonus(ctx, r, SP.trick * e.count);
  });
  const offBank = bus.on('style:bank', (e) => {
    const r = ctx.session.rider(e.riderId);
    if (!r) return;
    payBonus(ctx, r, e.sp);
    r.coins += e.coins;
  });
  return () => {
    offTrick();
    offBank();
  };
}
