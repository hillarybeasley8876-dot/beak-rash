// The r4 rival achievements (SPEC §18): the nemesis goes down, the plastic friendship breaks, and a win
// while everybody hunts the player.
import type { RuleCtx } from './facts';

export function rivalRules(ctx: RuleCtx): Array<() => void> {
  const { bus, facts } = ctx;

  return [
    bus.on('race:nemesisDown', ({ attacker }) => {
      if (ctx.isPlayer(attacker)) ctx.unlock('nemesis');
    }),
    bus.on('race:alliance', ({ phase, target, reason }) => {
      if (!ctx.isPlayer(target)) return;
      if (phase === 'form') facts.alliance = true;
      // A betrayed alliance is the plastic one; the others break for a reason of their own.
      if (phase === 'break' && reason === 'betrayal') ctx.unlock('alliance_break');
    }),
    bus.on('race:finishLine', ({ riderId, place }) => {
      if (ctx.isPlayer(riderId) && place === 1 && facts.alliance) ctx.unlock('alliance_win');
    }),
  ];
}
