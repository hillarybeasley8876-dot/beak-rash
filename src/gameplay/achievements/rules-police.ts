// Police 2.0 (SPEC §14), the pan's perfect parry (SPEC §15) and the r6 薄纱警察 (SPEC §25): the corgi goes
// home, the wanted stars go up and down again, the bribe goes through — and the player can beat the police
// down. All of them are the player's own doing.
import type { RuleCtx } from './facts';

const WANTED_MAX = 3;   // ★3 is the top of the wanted scale
const THREE_DOWNS = 3;  // the officers the player has to send home for 「一日三下班」

export function policeRules(ctx: RuleCtx): Array<() => void> {
  const { bus, facts } = ctx;

  return [
    // The last blow on every officer: a skill that hits it, then a swing takes it back.
    bus.on('combat:obstacleHit', ({ obstacleId, attacker, skillId, ko }) => {
      facts.policeHits.set(obstacleId, { attacker, skill: (skillId ?? null) !== null || ko === true });
    }),
    bus.on('police:down', ({ obstacleId, attacker }) => {
      if (!ctx.isPlayer(attacker)) return;
      ctx.unlock('corgi_down');
      facts.policeDowns++;
      if (facts.policeDowns >= THREE_DOWNS) ctx.unlock('police_three');
      // 「降维打击」: the blow that downed the officer was one of the player's skills.
      const hit = facts.policeHits.get(obstacleId);
      if (hit && hit.skill && ctx.isPlayer(hit.attacker)) ctx.unlock('police_skill');
    }),
    bus.on('police:offDuty', ({ riderId }) => {
      if (ctx.isPlayer(riderId)) ctx.unlock('police_off');
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
