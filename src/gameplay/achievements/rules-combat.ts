// Fighting and skill achievements (the player as attacker, plus a couple where the player is the victim).
// KO counts, chains, species, the goose and the torpedo need KOs by the player's own hands: SHOWTIME's own KOs
// only count toward 'showtime' (one ult would otherwise hand out a whole row of them).
import type { WeaponId } from '../../core/types';
import type { AchievementId } from '../../data/achievements';
import { ROSTER } from '../../data/roster';
import type { RuleCtx } from './facts';

const ULT = 'pelican.ult';
const DOUBLE_WINDOW = 3;    // s between two KOs for 一鱼两吃
const TRIPLE_WINDOW = 6;    // s spanning three KOs for 一条龙服务
const ULT_WINDOW = 3;       // s after the SHOWTIME shockwave that its victims' KOs still count for it
const PAYBACK_WINDOW = 10;  // s after a seagull robbed you
const HAT_TRICK = 3;
const RAMPAGE = 6;
const SPECIES = 4;
const WING_HITS = 3;        // riders one wing dash knocks aside
const ONE_MORES = 5;        // ONE MORE! calls in a race (combat calls one every third hit of a combo)
const STEALS = 3;           // weapons taken out of rivals' hands in a race
/** Big Gulp swallows riders up to this body scale (SPEC §7); bigger ones only get bitten. */
const SWALLOW_SCALE = 0.85;

const WEAPON_KOS: Partial<Record<WeaponId, AchievementId>> = { slipper: 'slipper', keyboard: 'keyboard' };

export function combatRules(ctx: RuleCtx): Array<() => void> {
  const { bus, facts } = ctx;

  /** SHOWTIME's own KOs, and its victims' KOs right after the shockwave (knocked into traffic, finished off). */
  const ultKo = (victim: number, skillId: string | null, t: number): void => {
    const ult = facts.ult;
    if (skillId !== ULT && !(ult.victims.has(victim) && t - ult.at <= ULT_WINDOW)) return;
    ult.kos += 1;
    if (ult.kos >= 3) ctx.unlock('showtime');
  };

  /** A KO by the player's own hands (swing, weapon, torpedo, gulp, wing dash, a bump into a wall). */
  const handKo = (victim: number, skillId: string | null, weapon: WeaponId, t: number): void => {
    facts.kos += 1;
    facts.koTimes = [...facts.koTimes.filter((k) => t - k <= TRIPLE_WINDOW), t];
    const n = facts.koTimes.length;
    if (n >= 2 && t - (facts.koTimes[n - 2] ?? -Infinity) <= DOUBLE_WINDOW) ctx.unlock('double');
    if (n >= 3) ctx.unlock('triple');
    if (facts.kos >= HAT_TRICK) ctx.unlock('hat_trick');
    if (facts.kos >= RAMPAGE) ctx.unlock('rampage');
    const species = ctx.character(victim);
    if (species) facts.koSpecies.add(species);
    if (facts.koSpecies.size >= SPECIES) ctx.unlock('everyone');
    if (species === 'goose') ctx.unlock('goose');
    if (skillId === 'pelican.torpedo') ctx.unlock('torpedo');
    const weaponKo = skillId === null ? WEAPON_KOS[weapon] : undefined;
    if (weaponKo) ctx.unlock(weaponKo);
  };

  const onPlayerKo = (victim: number, skillId: string | null, weapon: WeaponId): void => {
    const t = ctx.now();
    ctx.unlock('first_ko');
    ultKo(victim, skillId, t);
    const robbed = ctx.character(victim) === 'seagull' ? facts.robbedBy.get(victim) : undefined;
    if (robbed !== undefined && t - robbed <= PAYBACK_WINDOW) ctx.unlock('payback');
    if (skillId !== ULT) handKo(victim, skillId, weapon, t);
  };

  const onPlayerSkillHit = (skillId: string, victim: number): void => {
    if (skillId === 'pelican.gulp') {
      // A gulp lands one skill:hit: the spit for a swallowed small rival (its 'gulped' status is already gone
      // by then), the bite for a bigger one. So the victim's size tells the two apart.
      const species = ctx.character(victim);
      if (species && ROSTER[species].scale <= SWALLOW_SCALE) ctx.unlock('gulp');
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
      if (ctx.isPlayer(riderId)) facts.attacked = true;
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
      if (!ctx.isPlayer(riderId) || count % 3 !== 0) return;
      facts.oneMores += 1;
      if (facts.oneMores >= ONE_MORES) ctx.unlock('one_more');
    }),
    bus.on('combat:weaponPick', ({ riderId, stolenFrom }) => {
      if (!ctx.isPlayer(riderId) || stolenFrom === null) return;
      facts.steals += 1;
      if (facts.steals >= STEALS) ctx.unlock('thief');
    }),
    bus.on('combat:ko', ({ attacker, victim, skillId, weapon }) => {
      if (ctx.isPlayer(attacker) && !ctx.isPlayer(victim)) onPlayerKo(victim, skillId, weapon);
      if (ctx.isPlayer(victim) && ctx.character(attacker) === 'goose') ctx.unlock('goosed');
    }),
  ];
}
