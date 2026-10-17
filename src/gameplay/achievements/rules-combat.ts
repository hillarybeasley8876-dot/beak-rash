// Fighting and skill achievements (the player as attacker, plus a couple where the player is the victim).
import type { WeaponId } from '../../core/types';
import type { AchievementId } from '../../data/achievements';
import type { RuleCtx } from './facts';

const CHAIN_WINDOW = 3;     // s between consecutive KOs for 一鱼两吃 / 一条龙服务
const ULT_WINDOW = 3;       // s after the SHOWTIME shockwave that its victims' KOs still count
const PAYBACK_WINDOW = 10;  // s after a seagull robbed you
const TORPEDO_HITS = 3;
const WING_HITS = 2;

const WEAPON_KOS: Partial<Record<WeaponId, AchievementId>> = { slipper: 'slipper', keyboard: 'keyboard' };

export function combatRules(ctx: RuleCtx): Array<() => void> {
  const { bus, facts, session } = ctx;

  const onPlayerKo = (victim: number, skillId: string | null, weapon: WeaponId): void => {
    const t = ctx.now();
    facts.kos += 1;
    ctx.unlock('first_ko');
    facts.koTimes = [...facts.koTimes.filter((k) => t - k <= CHAIN_WINDOW), t];
    if (facts.koTimes.length >= 2) ctx.unlock('double');
    if (facts.koTimes.length >= 3) ctx.unlock('triple');
    if (facts.kos >= 3) ctx.unlock('hat_trick');
    if (facts.kos >= 6) ctx.unlock('rampage');
    const species = ctx.character(victim);
    if (species) facts.koSpecies.add(species);
    if (facts.koSpecies.size >= 4) ctx.unlock('everyone');
    if (species === 'goose') ctx.unlock('goose');
    const weaponKo = skillId === null ? WEAPON_KOS[weapon] : undefined;
    if (weaponKo) ctx.unlock(weaponKo);
    const robbed = species === 'seagull' ? facts.robbedBy.get(victim) : undefined;
    if (robbed !== undefined && t - robbed <= PAYBACK_WINDOW) ctx.unlock('payback');
    const ult = facts.ult;
    if (skillId === 'pelican.ult' || (ult.victims.has(victim) && t - ult.at <= ULT_WINDOW)) {
      ult.kos += 1;
      if (ult.kos >= 3) ctx.unlock('showtime');
    }
  };

  const onPlayerSkillHit = (skillId: string, victim: number): void => {
    if (skillId === 'pelican.gulp') {
      // Small rivals are swallowed (status 'gulped'); bigger ones only get bitten.
      if (session.rider(victim)?.statuses.some((s) => s.id === 'gulped')) ctx.unlock('gulp');
    } else if (skillId === 'pelican.torpedo') {
      facts.torpedoHits += 1;
      if (facts.torpedoHits >= TORPEDO_HITS) ctx.unlock('torpedo');
    } else if (skillId === 'pelican.wing' && facts.wing.active) {
      facts.wing.hits.add(victim);
      if (facts.wing.hits.size >= WING_HITS) ctx.unlock('wing');
    }
  };

  return [
    bus.on('combat:swing', ({ riderId }) => {
      if (ctx.isPlayer(riderId)) facts.attacked = true;
    }),
    bus.on('skill:cast', ({ riderId, skillId }) => {
      if (!ctx.isPlayer(riderId)) return;
      facts.attacked = true;
      if (skillId === 'pelican.wing') facts.wing = { active: true, hits: new Set() };
    }),
    bus.on('skill:end', ({ riderId, skillId }) => {
      if (ctx.isPlayer(riderId) && skillId === 'pelican.wing') facts.wing.active = false;
    }),
    bus.on('ult:start', ({ riderId }) => {
      if (!ctx.isPlayer(riderId)) return;
      facts.attacked = true;
      ctx.unlock('ult_first');
    }),
    bus.on('ult:impact', ({ riderId, victims }) => {
      if (ctx.isPlayer(riderId)) facts.ult = { at: ctx.now(), victims: new Set(victims), kos: 0 };
    }),
    bus.on('combat:hit', ({ victim, damage, blocked }) => {
      if (!ctx.isPlayer(victim)) return;
      if (damage > 0 && !blocked) facts.hurt = true;
      ctx.sampleHp();
    }),
    bus.on('skill:hit', ({ riderId, skillId, victim }) => {
      if (ctx.isPlayer(riderId)) onPlayerSkillHit(skillId, victim);
      else if (ctx.isPlayer(victim) && skillId === 'seagull.steal') facts.robbedBy.set(riderId, ctx.now());
    }),
    bus.on('combat:combo', ({ riderId, count }) => {
      if (ctx.isPlayer(riderId) && count >= 3) ctx.unlock('one_more');
    }),
    bus.on('combat:weaponPick', ({ riderId, stolenFrom }) => {
      if (ctx.isPlayer(riderId) && stolenFrom !== null) ctx.unlock('thief');
    }),
    bus.on('combat:ko', ({ attacker, victim, skillId, weapon }) => {
      if (ctx.isPlayer(attacker) && !ctx.isPlayer(victim)) onPlayerKo(victim, skillId, weapon);
      if (ctx.isPlayer(victim) && ctx.character(attacker) === 'goose') ctx.unlock('goosed');
    }),
    bus.on('cine:ko', ({ attacker, chain }) => {
      // The KO director's chain counter is a second witness for back-to-back KOs.
      if (!ctx.isPlayer(attacker) || facts.kos < chain) return;
      if (chain >= 2) ctx.unlock('double');
      if (chain >= 3) ctx.unlock('triple');
    }),
  ];
}
