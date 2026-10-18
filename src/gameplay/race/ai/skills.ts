// When each species fires its signature skill (controls.skill1), and the pelican kit for autopilot.
import { ROSTER } from '../../../data/roster';
import type { Controls, RiderState } from '../../../core/types';
import type { Blip } from './sense';

export interface SkillView {
  me: RiderState;
  blips: readonly Blip[];
  blocked: boolean;        // the planner could not find a free lane
  straight: number;        // m of nearly straight road ahead
  player: RiderState;
  /** Race seconds since GO. */
  time: number;
  /** Hunting the player out of a grudge: a valid chance is taken three times as eagerly. */
  grudge: boolean;
  /** Riders in the race (bottom half / bottom 3). */
  field: number;
}

/** Back on the bike after a crash (racing again for < 3 s, well after the start). */
const fresh = (v: SkillView): boolean => v.time > 10 && v.me.modeTime < 3;

type Rule = (v: SkillView) => boolean;

const riders = (v: SkillView): Blip[] => v.blips.filter((b) => b.kind === 'rider' && b.rider !== null);
const dist = (b: Blip, me: RiderState): number => Math.hypot(b.ds, b.x - me.x);
const ahead = (b: Blip, me: RiderState, lo: number, hi: number, halfAngle: number): boolean =>
  b.ds > lo && b.ds < hi && Math.abs(b.x - me.x) < b.ds * Math.tan(halfAngle) + 0.6;
const threatened = (v: SkillView): boolean =>
  riders(v).some((b) => dist(b, v.me) < 3 && b.rider?.action !== null && (b.rider?.action?.kind === 'attack' || b.rider?.action?.kind === 'heavy'));

// Speed skills (slide, flash, doge, ghost) need a purpose, never fired on cooldown: an overtake (a rider 3–25 m
// ahead in my lane), defence (threatened), or a comeback (behind the player or in the bottom half). The race
// leader and anyone more than 20 m ahead of the player keep them holstered (defence aside), so a speed skill is
// a way back into the race, not a lead that grows every cooldown.
const LEAD_FREE = 20;
const holstered = (v: SkillView): boolean => v.me.place === 1 || v.me.s - v.player.s > LEAD_FREE;
const overtaking = (v: SkillView): boolean => riders(v).some((b) => b.ds > 3 && b.ds < 25 && Math.abs(b.x - v.me.x) < 1.6);
const comeback = (v: SkillView): boolean => v.player.s > v.me.s || v.me.place > v.field / 2;
const purpose = (v: SkillView): boolean => !holstered(v) && (overtaking(v) || comeback(v));

const SIG: Record<string, Rule> = {
  'goose.honk': (v) => riders(v).some((b) => ahead(b, v.me, 2, 14, Math.PI / 6)),
  'capybara.chill': (v) => riders(v).filter((b) => dist(b, v.me) < 10).length >= 2,
  'cat.spin': (v) => riders(v).some((b) => dist(b, v.me) < 2.4),
  'shiba.doge': (v) => threatened(v) || (v.me.hp < v.me.maxHp * 0.5 && riders(v).some((b) => dist(b, v.me) < 5))
    || (purpose(v) && v.straight > 80 && riders(v).some((b) => b.ds > 5 && b.ds < 30)),
  'pigeon.ghost': (v) => !holstered(v) && (v.blocked || riders(v).filter((b) => dist(b, v.me) < 5).length >= 2
    || (v.player.s - v.me.s > 5 && v.player.s - v.me.s < 30)),
  'penguin.slide': (v) => threatened(v) || (purpose(v) && v.straight > 90),
  'seagull.steal': (v) => riders(v).some((b) => dist(b, v.me) < 6 && b.rider !== null && ((b.rider.weapon !== 'none' && v.me.weapon === 'none') || b.rider.sp >= 20)),
  // A lazy comeback tool: only from the bottom 3 or trailing the player.
  'sloth.flash': (v) => v.time > 8 && !holstered(v) && (v.me.place > v.field - 3 || v.player.s - v.me.s > 10) && v.straight > 100
    && (riders(v).some((b) => b.ds > 3 && b.ds < 40) || (fresh(v) && v.me.speed < 10)),
};

/** Pelican autopilot: torpedo, gulp, wing dash, SHOWTIME. */
function pelican(v: SkillView, c: Controls, roll: number): boolean {
  const { me } = v;
  const rs = riders(v);
  if (me.sp >= 100 && rs.filter((b) => b.ds > 0 && b.ds < 40).length >= 2) { c.ult = true; return true; }
  if (me.cooldowns[0] <= 0 && rs.some((b) => ahead(b, me, 5, 60, (25 * Math.PI) / 180)) && roll < 0.5) { c.skill1 = true; return true; }
  if (me.cooldowns[1] <= 0 && rs.some((b) => dist(b, me) < 2.5)) { c.skill2 = true; return true; }
  if (me.cooldowns[2] <= 0 && v.straight > 60 && rs.some((b) => b.ds > 2 && b.ds < 15)) { c.skill3 = true; return true; }
  return false;
}

/** Skills that hit or rob: a grudge fires these eagerly; the rest (shields, slides, vanishing) wait, as they block the payback swing. */
const PAYBACK = new Set(['goose.honk', 'cat.spin', 'seagull.steal']);

/** Decide and press a skill. `eager` 0..1 scales how quickly a valid chance is taken. */
export function useSkill(v: SkillView, c: Controls, eager: number, roll: number): boolean {
  const { me } = v;
  if (me.mode !== 'racing' || !me.mods.canAttack || me.action !== null || me.airborne) return false;
  if (me.character === 'pelican') return roll < eager * 0.3 && pelican(v, c, roll / Math.max(0.01, eager * 0.3));
  const id = ROSTER[me.character].skill;
  const rule = SIG[id];
  if (!rule || me.cooldowns[0] > 0 || (v.grudge && !PAYBACK.has(id)) || roll > eager * (v.grudge ? 0.75 : 0.25)) return false;
  if (!rule(v)) return false;
  c.skill1 = true;
  return true;
}
