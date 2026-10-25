// Police 2.0 (SPEC §14) and the pan's perfect parry (SPEC §15): the corgi goes home, the wanted stars
// go up and down again, and the bribe goes through. All of them are the player's own doing.
import type { RuleCtx } from './facts';

const WANTED_MAX = 3;   // ★3 is the top of the wanted scale

export function policeRules(ctx: RuleCtx): Array<() => void> {
  const { bus, facts } = ctx;

  return [
    bus.on('police:down', ({ attacker }) => {
      if (ctx.isPlayer(attacker)) ctx.unlock('corgi_down');
    }),
    bus.on('combat:parry', ({ riderId }) => {
      if (ctx.isPlayer(riderId)) ctx.unlock('parry');
    }),
    bus.on('police:wanted', ({ riderId, level }) => {
      if (ctx.isPlayer(riderId) && level >= WANTED_MAX) facts.wanted3 = true;
    }),
    bus.on('police:alert', ({ riderId, reason }) => {
      // ★3 first, then outrunning them: the stars have to be up before they are shaken off.
      if (ctx.isPlayer(riderId) && reason === 'lost' && facts.wanted3) ctx.unlock('wanted3');
    }),
    bus.on('police:bribe', ({ riderId, accepted }) => {
      if (ctx.isPlayer(riderId) && accepted) ctx.unlock('bribe');
    }),
  ];
}
