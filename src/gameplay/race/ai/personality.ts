// AI personalities: species temperament + roster stats + career level + a little per-rider dice.
import { clamp, clamp01 } from '../../../core/math';
import { ROSTER } from '../../../data/roster';
import type { Rng } from '../../../core/rng';
import type { CharacterId } from '../../../core/types';

export interface Personality {
  aggression: number;   // 0..1 how eagerly they start fights and hunt targets
  skill: number;        // 0..1 driving precision: line, braking points, drift timing
  lineFollow: number;   // 0..1 how closely they follow the ideal racing line
  lineBias: number;     // m preferred offset from the line (+ = right)
  wander: number;       // m amplitude of slow lateral wandering
  lateralRate: number;  // m/s max slew of the lateral target
  reaction: number;     // s between attack decisions
  drafter: number;      // 0..1 seeks slipstreams
  drifter: number;      // 0..1 uses drift on bends
  heavyChance: number;  // 0..1 heavy swing when armed
  skillUse: number;     // 0..1 eagerness to fire the signature skill
  taunty: number;       // taunt frequency multiplier
  risk: number;         // 0..1 share of the bike's steering authority they use against curve push
  launch: number;       // 0..1 chance of a perfect start
  bell: number;         // 0..1 chance to ring the bell after overtaking the player
  playerPull: number;   // hunt-target weight of the player vs other riders (1 = no preference)
  playerFury: number;   // attack-chance multiplier while hunting the player
  huntBudget: number;   // hits on the player within 4 s before the hunter backs off
  grace: number;        // s before swinging at the player again after landing a hit on them
  grudge: number;       // 0..1 chance to hit back (and hunt the player for a few seconds) when the player hits them
}

type Temper = Pick<Personality, 'aggression' | 'skill' | 'drafter' | 'drifter' | 'wander' | 'taunty' | 'skillUse' | 'bell' | 'grudge'>;

const TEMPER: Record<CharacterId, Temper> = {
  pelican: { aggression: 0.6, skill: 0.85, drafter: 0.6, drifter: 0.7, wander: 0.3, taunty: 1, skillUse: 0.8, bell: 0.2, grudge: 0.6 },
  goose: { aggression: 0.95, skill: 0.6, drafter: 0.3, drifter: 0.4, wander: 0.5, taunty: 1.5, skillUse: 0.9, bell: 0.5, grudge: 1 },
  capybara: { aggression: 0.15, skill: 0.55, drafter: 0.5, drifter: 0.2, wander: 0.25, taunty: 0.7, skillUse: 0.6, bell: 0.05, grudge: 0.15 },
  cat: { aggression: 0.65, skill: 0.8, drafter: 0.3, drifter: 0.8, wander: 1.1, taunty: 1.2, skillUse: 0.8, bell: 0.3, grudge: 0.9 },
  shiba: { aggression: 0.45, skill: 0.75, drafter: 0.5, drifter: 0.6, wander: 0.5, taunty: 1, skillUse: 0.7, bell: 0.35, grudge: 0.8 },
  pigeon: { aggression: 0.25, skill: 0.85, drafter: 0.8, drifter: 0.5, wander: 0.6, taunty: 1, skillUse: 0.8, bell: 0.15, grudge: 0.35 },
  penguin: { aggression: 0.4, skill: 0.7, drafter: 0.4, drifter: 1, wander: 0.4, taunty: 0.9, skillUse: 0.8, bell: 0.1, grudge: 0.45 },
  seagull: { aggression: 0.75, skill: 0.7, drafter: 0.6, drifter: 0.5, wander: 0.8, taunty: 1.3, skillUse: 0.9, bell: 0.3, grudge: 0.95 },
  sloth: { aggression: 0.1, skill: 0.4, drafter: 0.2, drifter: 0.1, wander: 0.2, taunty: 0.6, skillUse: 0.7, bell: 0.05, grudge: 0.1 },
  corgi: { aggression: 0.5, skill: 0.8, drafter: 0.2, drifter: 0.3, wander: 0.2, taunty: 1, skillUse: 1, bell: 0, grudge: 0.5 },
};

/** Species temperament aggression (0..1) before level and dice. */
export const baseAggression = (character: CharacterId): number => TEMPER[character].aggression;

export function makePersonality(character: CharacterId, level: number, rng: Rng): Personality {
  const t = TEMPER[character];
  const st = ROSTER[character].stats;
  const lv = clamp(level - 1, 0, 4);
  const dice = (spread: number): number => rng.range(-spread, spread);
  const skill = clamp01(t.skill + 0.05 * lv + dice(0.08));
  // Level 1 rivals are noticeably calmer; temperament reaches full strength at level 4.
  const aggression = clamp01(t.aggression * (0.7 + 0.1 * lv) + dice(0.08));
  return {
    aggression,
    skill,
    lineFollow: clamp(0.45 + 0.5 * skill + dice(0.1), 0.3, 1),
    lineBias: dice(1.4),
    wander: t.wander * (0.7 + rng.next() * 0.6),
    lateralRate: 1.6 + 1.6 * skill + 0.2 * st.handling,
    reaction: clamp((1.15 - 0.5 * aggression) * (1 - 0.08 * lv) + dice(0.1), 0.25, 1.4),
    drafter: clamp01(t.drafter + dice(0.1)),
    drifter: clamp01(t.drifter + dice(0.1)),
    heavyChance: clamp01(0.15 + 0.4 * aggression + 0.05 * (st.power - 3)),
    skillUse: clamp01(t.skillUse + dice(0.1)),
    taunty: t.taunty,
    risk: 0.68 + 0.2 * skill,
    launch: clamp01(0.2 + 0.5 * skill + 0.05 * lv),
    bell: t.bell,
    playerPull: 1.5 + 0.4 * Math.max(0, lv - 1),
    playerFury: 1 + 0.1 * lv,
    huntBudget: lv < 2 ? 2 : 3,
    grace: 1.2 - 0.15 * lv,
    grudge: clamp01(t.grudge * (0.9 + 0.05 * lv)),
  };
}
