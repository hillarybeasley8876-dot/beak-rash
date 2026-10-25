// Every combat number in one place (SPEC §7). Weapon/skill catalogues live in data/weapons.ts + data/skills.ts.

/** Swing phases for the 0.32 s reference swing; scaled by weapon.swing / SWING_REF. */
export const SWING_REF = 0.32;
export const LIGHT_PHASES = { windup: 0.06, active: 0.1, recover: 0.16 } as const;
export const HEAVY_PHASES = { windup: 0.16, active: 0.12, recover: 0.24 } as const;
/** Swing presses during the last part of a swing are buffered and fire when it ends. */
export const INPUT_BUFFER = 0.18;
/** A buffered press (swing, bell, skill) waits this long for the swing / hit stagger (0.28 s) blocking it. */
export const PRESS_HOLD = 0.32;
/** A skill pressed while another of the rider's skills keeps it busy queues if that lock ends within this many
 *  seconds (it casts the moment the lock ends); a press with more lock left is denied at once. */
export const SKILL_QUEUE = 0.6;
/** The player's SHOWTIME press waits for a running KO cinematic to end (cap in real seconds if no end arrives). */
export const ULT_KO_LATCH = 3;

export const MELEE = {
  minLateral: 0.4,      // m, closer than this is a bump, not a swing hit
  maxDs: 1.6,           // m along the track
  maxDy: 1.3,           // m height difference
  heavyAutoSideRange: 1.2, // extra reach when picking the heavy side
  critChance: 0.1,
  critMul: 1.6,
  heavyKnockMul: 1.5,
  speedLoss: [0.05, 0.1] as const, // victim speed fraction lost per hit
  wobble: 0.4,
  hitReaction: 0.28,    // s of 'hit' action on the victim
  blockedRecoil: 2.2,   // m/s lateral recoil for an attacker whose hit was blocked
} as const;

/** power stat 1..5 → damage multiplier (3 = 1.0). */
export const powerMul = (power: number): number => 0.7 + 0.1 * power;

/** Rival heavies within `range` m of the player wind up `windupMul`× longer behind a glint (a readable counter). */
export const HEAVY_TELL = { windupMul: 1.6, range: 6 } as const;

export const HITSTOP = { light: 0.045, heavy: 0.08, crit: 0.1, skill: 0.06, ult: 0.12 } as const;
export const SHAKE = { light: 0.25, heavy: 0.45, crit: 0.5, skill: 0.35, ult: 0.7 } as const;
/** Hits further than this from the player don't freeze time or shake the camera. */
export const FEEDBACK_RANGE = 16;

export const COMBO = { gap: 1.5, oneMore: 3, oneMoreSp: 2 } as const;

/**
 * SP economy (retuned r3: an aggressive player fills the bar about once a minute, not every 15 s). A swing pays
 * more than a skill hit (the skill already did the work); riding well pays as before. Fighting pays nothing with
 * an SP-paid skill (SHOWTIME's own hits and KOs) and for `afterUlt` s after its cast (its stunned victims are easy
 * pickings, the bar must not refill off them).
 */
export const SP = {
  max: 100, hit: 2.5, skillHit: 1, hurt: 1.5, ko: 10, draftPerSec: 1, nearMiss: 4, perfect: 8, driftL3: 5, bell: 3,
  repeatWindow: 4, repeatHit: 0.5, // a swing pays `hit` once per window per victim, `repeatHit` in between
  afterUlt: 12,
} as const;

export const KO = { creditWindow: 3, coins: 50, respawnHp: 0.7 } as const;

export const WEAPON_RULES = {
  looseLight: 0.3,
  looseHeavy: 0.6,
  /** Chance a rival starts armed, by career level (index = level, clamped). */
  armedByLevel: [0.35, 0.35, 0.55, 0.75, 0.9] as const,
} as const;

/** payReach: a rival this far behind (m) or more is no provocation worth SP. */
export const BELL = { radius: 15, cooldown: 3, angry: 8, action: 0.45, payReach: 6 } as const;

export const PICKUP = {
  float: 0.95,          // m above the road
  bob: 0.08,
  spin: 2.6,            // rad/s
  takeDs: 1.3,
  takeDx: 1.2,
  takeMaxY: 1.6,
  respawn: 6,           // s until a row item comes back (drops never respawn)
  coinValue: 5,
  fishHp: 25,
  canSp: 20,
  dropLife: 25,         // s a dropped weapon stays on the road
  viewRange: 220,       // m around the player that is animated / drawn
  autoRowEvery: 260,    // m between generated rows when the track defines none
} as const;

/** Shield strengths: melee-immune for the duration (penguin slide) / reflect melee (doge). */
export const SHIELD_IMMUNE = 1;
export const SHIELD_REFLECT = 2;

/** Thrown weapons (SPEC §15). A held heavy that outlives the swing windup becomes a throw aim. */
export const THROW = {
  aimTime: 1.5,          // s of holding before the weapon leaves the hand by itself
  handHeight: 1.4,       // m above the road where the weapon starts
  forwardSpeed: 16,      // m/s added to the rider's speed (forward throw)
  backSpeed: 14,         // m/s subtracted from the rider's speed (backward throw)
  launchVy: 3,           // m/s up at the release
  gravity: 12,           // m/s² (a throw with no target in sight arcs down)
  life: 1.6,             // s before the weapon gives up and lands
  damageMul: 1.2,        // × the weapon's heavyDamage
  turnRate: 1.2,         // rad/s of lateral turn while homing
  lateralGain: 2,        // m/s of lateral speed wanted per metre of offset to the target
  lateralMax: 8,         // m/s the homing may pull sideways
  heightGain: 2.4,       // m/s of climb wanted per metre of height error
  cone: 18,              // ± degrees the homing looks in
  range: 35,             // m the homing reaches forward
  backRange: 25,         // m the homing reaches backward
  hitRadius: 1.0,        // m around the weapon a rider is hit by
  hitHeight: 1.2,        // m around the rider's chest the weapon has to pass
  spin: 12,              // rad/s the weapon tumbles at
  sp: 6,                 // SP the thrower earns for a hit
  dropGrace: 1,          // s before a dropped weapon can be grabbed again
} as const;

/** A strike from outside the riders (police baton, event hazard, SPEC §14). */
export const NPC_STRIKE = {
  wobble: 0.4,           // s of wobble on the victim
  speedLoss: 0.08,       // fraction of the victim's speed lost
} as const;

export const STATUS_MODS = {
  stun: { steer: 0, accel: 0.25, speed: 0.92 },
  wobble: { steer: 0.7, grip: 0.8 },
  blind: { steer: 0.75 },
  oiled: { grip: 0.25 },
  wet: { grip: 0.85 },
  chill: { speed: 0.85 },
} as const;
