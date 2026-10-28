// When a rider fires each skill (SPEC §24): one rule per skill id, plus a generic rule per category for the
// skills that have no rule of their own. A rule answers "is this skill worth firing right now?" — the presses,
// the cooldowns and the SP live in skills.ts.
import { SKILLS, type SkillCategory } from '../../../data/skills';
import type { RiderState, Weather } from '../../../core/types';
import type { Blip } from './sense';

export interface SkillView {
  me: RiderState;
  blips: readonly Blip[];
  blocked: boolean;        // the planner could not find a free lane
  straight: number;        // m of nearly straight road ahead
  /** The human this rider is up against (offline: the player; online: its nearest human, SPEC §28). */
  human: RiderState;
  /** Race seconds since GO. */
  time: number;
  /** Hunting a human out of a grudge: a valid chance is taken three times as eagerly. */
  grudge: boolean;
  /** 宿敌: the rider this one wants to hit first (the nemesis goes for the human). */
  prefer: RiderState | null;
  /** Riders in the race (bottom half / bottom 3). */
  field: number;
  /** The race weather (optional: the brain may not pass it, then the rain rules use their plain range). */
  weather?: Weather;
}

/** A rule answers "is this skill worth firing right now?". */
export type Rule = (v: SkillView) => boolean;

const riders = (v: SkillView): Blip[] => v.blips.filter((b) => b.kind === 'rider' && b.rider !== null);
/** The rivals a skill can land on: racing, visible, not in respawn protection (the skills' own target check). */
const targets = (v: SkillView): Blip[] => riders(v).filter((b) =>
  b.rider !== null && b.rider.mode === 'racing' && !b.rider.mods.invisible && b.rider.invuln <= 0);
const dist = (b: Blip, me: RiderState): number => Math.hypot(b.ds, b.x - me.x);
const ahead = (b: Blip, me: RiderState, lo: number, hi: number, halfAngle: number): boolean =>
  b.ds > lo && b.ds < hi && Math.abs(b.x - me.x) < b.ds * Math.tan(halfAngle) + 0.6;
const threatened = (v: SkillView): boolean =>
  riders(v).some((b) => dist(b, v.me) < 3 && b.rider?.action !== null && (b.rider?.action?.kind === 'attack' || b.rider?.action?.kind === 'heavy'));

/** Back on the bike after a crash for less than 12 s (the same window as the pace's no-catch-up rule). */
const recovering = (v: SkillView): boolean => v.me.modeTime < 12 && v.time - v.me.modeTime > 5;

// Speed skills (slide, flash, doge, ghost) need a purpose, never fired on cooldown: an overtake (a rider 3–25 m
// ahead in my lane), defence (threatened), or a comeback (behind the human or in the bottom half). Riders on the
// podium places, anyone more than 20 m ahead of the human and a rider back from a crash for < 12 s keep them
// holstered (defence only when hurt), so a speed skill is a way back into the race, not what decides the podium,
// and a KO still buys a real gap.
const LEAD_FREE = 20;
const PODIUM = 3;
const holstered = (v: SkillView): boolean => v.me.place <= PODIUM || v.me.s - v.human.s > LEAD_FREE || recovering(v);
const hurt = (v: SkillView): boolean => v.me.hp < v.me.maxHp * 0.5;
/** Shield / slide under attack: always when hurt, otherwise only off the podium places. */
const defend = (v: SkillView): boolean => threatened(v) && (hurt(v) || !holstered(v));
const overtaking = (v: SkillView): boolean => riders(v).some((b) => b.ds > 3 && b.ds < 25 && Math.abs(b.x - v.me.x) < 1.6);
const comeback = (v: SkillView): boolean => v.human.s > v.me.s || v.me.place > v.field / 2;
const purpose = (v: SkillView): boolean => !holstered(v) && (overtaking(v) || comeback(v));

const DEG = Math.PI / 180;

/** A rival in front, inside the cone (lo..hi m ahead, half-angle in rad). */
const inRange = (bs: Blip[], me: RiderState, lo: number, hi: number, halfAngle: number): boolean =>
  bs.some((b) => ahead(b, me, lo, hi, halfAngle));

/** A rival ahead inside a lane band: a thrown skill needs its target in reach, not only in front. */
const inLane = (bs: Blip[], me: RiderState, lo: number, hi: number, lane: number): boolean =>
  bs.some((b) => b.ds > lo && b.ds <= hi && Math.abs(b.x - me.x) < lane);

/** How far the nearest rival ahead is (null: nobody ahead). */
const nearestAhead = (bs: Blip[]): number | null => {
  let best: number | null = null;
  for (const b of bs) {
    if (b.ds <= 0) continue;
    if (best === null || b.ds < best) best = b.ds;
  }
  return best;
};

/** The nearest rival ahead is lo..hi m away (the skills that pick the closest target). */
const nearestIn = (bs: Blip[], lo: number, hi: number): boolean => {
  const d = nearestAhead(bs);
  return d !== null && d >= lo && d <= hi;
};

/** How many rivals are within r m of me (any side). */
const near = (bs: Blip[], me: RiderState, r: number): number => bs.filter((b) => dist(b, me) < r).length;

/** How many rivals are within r m in front of me. */
const nearAhead = (bs: Blip[], me: RiderState, r: number): number =>
  bs.filter((b) => b.ds > 0 && dist(b, me) < r).length;

/**
 * An officer in the spray ahead of me: the pool skills knock the police about, and an officer that loses the
 * player never catches them. The AI keeps its backup skills holstered while an officer is right in front.
 */
const OFFICER_CLEAR = 12;   // m
const officerAhead = (v: SkillView): boolean =>
  v.blips.some((b) => b.kind === 'police' && b.ds > 0 && b.ds < OFFICER_CLEAR
    && Math.abs(b.x - v.me.x) < b.ds * 0.6 + 1.4);

/** An officer right next to me: a trap or a fire line dropped here goes off under it. */
const officerNear = (v: SkillView): boolean =>
  v.blips.some((b) => b.kind === 'police' && Math.abs(b.ds) < 8 && Math.abs(b.x - v.me.x) < 4);

/** The human's own patch of road: a disorienting skill here makes the confused riders swerve into each other. */
const playerPatch = (v: SkillView): boolean => Math.abs(v.me.s - v.human.s) < 10;

/** The rivals a shove may hit: the pack, never the human (a shove throws them out of the officer's lane). */
const shoveable = (v: SkillView): Blip[] => targets(v).filter((b) => b.rider !== v.human);

/**
 * The hold a speed skill waits for: a rider in my own lane, a little way ahead, that I close on fast. Boosting
 * into it would ram it (the boost pushes the rider into the slower one), so the skill waits until the lane is
 * clear. The numbers: 0–15 m ahead, 1.6 m sideways, closing faster than 4 m/s.
 */
export const BOOST_HOLD = {
  ahead: 15,     // m
  lane: 1.6,     // m sideways
  closing: 4,    // m/s
} as const;

/** The skills that speed the caster up: they all wait for the lane ahead to be clear. */
export const SELF_SPEED: ReadonlySet<string> = new Set([
  'pelican.wing', 'pigeon.ghost', 'penguin.slide', 'sloth.flash', 'xinxian.fresh', 'pool.rocket', 'pool.blink',
  'pool.warsong', 'shiba.doge', 'cryingcat.tears', 'ult.timestop',
]);

/** A slower rider in my lane ahead that I close on fast: a speed skill would ram it, so it is held. */
export const rammingAhead = (v: SkillView): boolean =>
  riders(v).some((b) => b.ds > 0 && b.ds < BOOST_HOLD.ahead
    && Math.abs(b.x - v.me.x) < BOOST_HOLD.lane
    && v.me.speed - b.vs > BOOST_HOLD.closing);

/** A rival right behind me (a chaser) within r m: the traps and the fire lines go there. */
const chaser = (bs: Blip[], me: RiderState, r: number): boolean =>
  bs.some((b) => b.ds < 0 && b.ds > -r && Math.abs(b.x - me.x) < 3);

/** The ult: SP full (the runner checks that) and a pack ahead to land it on. */
const ULT: Rule = (v) => targets(v).filter((b) => b.ds > 0 && b.ds < 40).length >= 2;

/** The meme signatures' own reach: the rain of 泪如雨下 falls over the caster, the Q弹冲击 slams 6 m ahead. */
const TEARS = { rain: 9 };                     // m around the caster
const BOUNCE = { ahead: 6, radius: 5 };        // m ahead of the caster, m around the slam

// The generic rules (SPEC §24): what a skill of a category is worth when it has no rule of its own.
const ATTACK: Rule = (v) => inRange(targets(v), v.me, 2, 25, 25 * DEG);
const CONTROL: Rule = (v) => near(targets(v), v.me, 8) >= 2 || near(targets(v), v.me, 4) >= 1;
const MOVE: Rule = (v) => purpose(v);
const DEFENSE: Rule = (v) => threatened(v) || hurt(v);
const TRAP: Rule = (v) => chaser(targets(v), v.me, 15);
const SUMMON: Rule = (v) => inRange(targets(v), v.me, 6, 25, 30 * DEG);
const GAG: Rule = (v) => near(targets(v), v.me, 10) >= 1;

/** Every skill's own rule: when firing it is worth the cooldown. */
export const RULES: Record<string, Rule> = {
  // ---- the pelican's kit (the rules the old autopilot branch used, so the player's own pace does not change)
  'pelican.torpedo': (v) => riders(v).some((b) => ahead(b, v.me, 5, 60, (25 * Math.PI) / 180)),
  'pelican.gulp': (v) => riders(v).some((b) => dist(b, v.me) < 2.5),
  'pelican.wing': (v) => v.straight > 60 && riders(v).some((b) => b.ds > 2 && b.ds < 15),
  'pelican.ult': ULT,
  // ---- the rival signatures (unchanged: they were the only rules the AI had)
  'goose.honk': (v) => riders(v).some((b) => ahead(b, v.me, 2, 14, Math.PI / 6)),
  'capybara.chill': (v) => riders(v).filter((b) => dist(b, v.me) < 10).length >= 2,
  'cat.spin': (v) => riders(v).some((b) => dist(b, v.me) < 2.4),
  'shiba.doge': (v) => defend(v) || (hurt(v) && !holstered(v) && riders(v).some((b) => dist(b, v.me) < 5))
    || (purpose(v) && v.straight > 80 && riders(v).some((b) => b.ds > 5 && b.ds < 30)),
  'pigeon.ghost': (v) => !holstered(v) && (v.blocked || riders(v).filter((b) => dist(b, v.me) < 5).length >= 2
    || (v.human.s - v.me.s > 5 && v.human.s - v.me.s < 30)),
  'penguin.slide': (v) => defend(v) || (purpose(v) && v.straight > 90),
  'seagull.steal': (v) => riders(v).some((b) => dist(b, v.me) < 6 && b.rider !== null && ((b.rider.weapon !== 'none' && v.me.weapon === 'none') || b.rider.sp >= 20)),
  // A lazy comeback tool: only from the bottom 3 (trailing the player too made the sloth a podium regular).
  'sloth.flash': (v) => v.time > 8 && !holstered(v) && v.me.place > v.field - 3 && v.straight > 100
    && riders(v).some((b) => b.ds > 3 && b.ds < 40),
  'corgi.whistle': CONTROL,
  // ---- the r6 meme signatures (the generic rule of their category, until they ask for one of their own)
  'bananacat.peel': TRAP,
  // The rain falls over the caster: a rival inside it is slowed (and the cat speeds up — but not into a rider
  // it is closing on, or the boost would ram it).
  'cryingcat.tears': (v) => !rammingAhead(v) && near(targets(v), v.me, TEARS.rain) >= 1,
  'xinxian.fresh': MOVE,
  // The Q弹冲击 slams 6 m ahead with a 5 m radius: the AI uses it when a rival is inside that reach
  // (the brief's window — 3–9 m ahead, within 3 m sideways — is the core of it).
  'moodeng.bounce': (v) => targets(v).some((b) => Math.hypot(b.ds - BOUNCE.ahead, b.x - v.me.x) <= BOUNCE.radius),
  'pedro.trash': GAG,
  // The sad violin takes the skills away from everyone in earshot — the human included. Like the brainfight,
  // it stays out of the human's patch of road: the human keeps its own skills, and the pack's formation
  // under the human does not shift (the brakecheck counts a bump in that formation as a ram).
  'hamster.violin': (v) => CONTROL(v) && !playerPatch(v),
  // ---- the r6 shared pool (SPEC §24): the ranges the skills' own job asked for. The skills that spray down the
  // road stay holstered while an officer is in the spray: the chase is the player's business.
  'pool.firebreath': (v) => !officerAhead(v) && inRange(targets(v), v.me, 4, 10, 30 * DEG),
  'pool.icelance': (v) => !officerAhead(v) && nearestIn(targets(v), 8, 40),   // the spike homes on the closest one
  'pool.thunder': (v) => !officerAhead(v)
    && (nearestIn(targets(v), 5, 40) || (v.weather === 'rain' && nearestIn(targets(v), 3, 60))),
  'pool.watergun': (v) => !officerAhead(v) && inRange(shoveable(v), v.me, 3, 9, 30 * DEG),
  'pool.tornado': (v) => !officerAhead(v) && inRange(targets(v), v.me, 10, 35, 35 * DEG),
  'pool.snowball': (v) => !officerAhead(v) && targets(v).filter((b) => b.ds > 8 && b.ds < 30).length >= 2,
  'pool.rocket': (v) => !officerNear(v) && chaser(targets(v), v.me, 12),     // the dash plus the fire line behind
  'pool.firecracker': (v) => !officerNear(v) && chaser(targets(v), v.me, 15),
  'pool.bubble': (v) => threatened(v),                                     // the bubble eats the next punch
  'pool.boomerang': (v) => !officerAhead(v) && inRange(targets(v), v.me, 6, 25, 30 * DEG),
  'pool.pie': (v) => !officerAhead(v) && inLane(targets(v), v.me, 4, 20, 4),      // the pie's own reach, or it is refused
  'pool.brainfight': (v) => nearAhead(targets(v), v.me, 5) >= 2 && !playerPatch(v),   // it argues with the pack in front
  'pool.blink': (v) => !holstered(v) && (v.blocked || near(targets(v), v.me, 5) >= 2
    || (v.human.s - v.me.s > 5 && v.human.s - v.me.s < 30)),
  'pool.thermos': (v) => hurt(v),
  'pool.ducks': (v) => !officerAhead(v) && inRange(targets(v), v.me, 6, 20, 30 * DEG),
  'pool.popup': (v) => !officerAhead(v) && inLane(targets(v), v.me, 4, 24, 5),   // the ad's own reach, or it is refused
  'pool.warsong': (v) => near(targets(v), v.me, 6) >= 2,
  // ---- the r6 shared ults (SP 100, any character)
  'ult.timestop': ULT,
  'ult.meteor': (v) => !officerAhead(v) && ULT(v),
  'ult.storm': (v) => !officerAhead(v) && ULT(v),
};

/** The generic rule of every category: the fallback for a skill without a rule of its own. */
const CATEGORY: Record<SkillCategory, Rule> = {
  attack: ATTACK, control: CONTROL, move: MOVE, defense: DEFENSE, trap: TRAP, summon: SUMMON, gag: GAG,
};

/** The rule of a skill: its own, or the generic one of its category (null: not a skill this build knows). */
export function ruleFor(id: string): Rule | null {
  const own = RULES[id];
  if (own) return own;
  const def = SKILLS[id];
  if (!def) return null;
  return CATEGORY[def.category] ?? null;
}
