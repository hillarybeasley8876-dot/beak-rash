// Every combat number in one place (SPEC §7). Weapon/skill catalogues live in data/weapons.ts + data/skills.ts.

/** Swing phases for the 0.32 s reference swing; scaled by weapon.swing / SWING_REF. */
export const SWING_REF = 0.32;
export const LIGHT_PHASES = { windup: 0.06, active: 0.1, recover: 0.16 } as const;
export const HEAVY_PHASES = { windup: 0.16, active: 0.12, recover: 0.24 } as const;
/** Presses during the last part of a swing are buffered and fire when it ends. */
export const INPUT_BUFFER = 0.18;
/** A skill pressed while a swing or hit stagger (0.28 s) blocks it is retried this long before skill:denied. */
export const SKILL_BUFFER = 0.3;

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

export const HITSTOP = { light: 0.045, heavy: 0.08, crit: 0.1, skill: 0.06, ult: 0.12 } as const;
export const SHAKE = { light: 0.25, heavy: 0.45, crit: 0.5, skill: 0.35, ult: 0.7 } as const;
/** Hits further than this from the player don't freeze time or shake the camera. */
export const FEEDBACK_RANGE = 16;

export const COMBO = { gap: 1.5, oneMore: 3, oneMoreSp: 10 } as const;

export const SP = {
  max: 100, hit: 6, hurt: 3, ko: 20, draftPerSec: 1, nearMiss: 4, perfect: 8, driftL3: 5, bell: 5,
} as const;

export const KO = { creditWindow: 3, coins: 50, respawnHp: 0.7 } as const;

export const WEAPON_RULES = {
  looseLight: 0.3,
  looseHeavy: 0.6,
  /** Chance a rival starts armed, by career level (index = level, clamped). */
  armedByLevel: [0.35, 0.35, 0.55, 0.75, 0.9] as const,
} as const;

export const BELL = { radius: 15, cooldown: 3, angry: 8, action: 0.45 } as const;

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
  canSp: 25,
  dropLife: 25,         // s a dropped weapon stays on the road
  viewRange: 220,       // m around the player that is animated / drawn
  autoRowEvery: 260,    // m between generated rows when the track defines none
} as const;

/** Status magnitudes. Shield strength: block-once / immune for the duration / reflect melee. */
export const SHIELD_BLOCK_ONCE = 0.5;
export const SHIELD_IMMUNE = 1;
export const SHIELD_REFLECT = 2;

export const STATUS_MODS = {
  stun: { steer: 0, accel: 0.25, speed: 0.92 },
  wobble: { steer: 0.7, grip: 0.8 },
  blind: { steer: 0.75 },
  oiled: { grip: 0.25 },
  wet: { grip: 0.85 },
  chill: { speed: 0.85 },
} as const;
