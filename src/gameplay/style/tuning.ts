// Every STYLE number in one place (SPEC §17): the chain window, the multiplier, the base points and the
// rewards a banked chain pays.

/** An action within this many sim seconds of the previous one extends the chain. */
export const CHAIN_WINDOW = 3.0;
/** The chain multiplier grows by this much per extra distinct action kind. */
export const MULT_STEP = 0.25;
/** The chain multiplier never goes past ×4. */
export const MULT_MAX = 4;
/** The same action kind twice in a row scores this share of its points (rounded down). */
export const REPEAT_FACTOR = 0.5;

/** A banked chain pays SP = min(SP_CAP, floor(total / SP_PER_POINT)) and coins = floor(total / COINS_PER_POINT). */
export const SP_CAP = 25;
export const SP_PER_POINT = 100;
export const COINS_PER_POINT = 250;

/**
 * Base points per action kind. A trick takes the points its own event carries (120 per trick plus 50 per
 * extra trick in the same air), so it has no entry here. The drift entries are the mini-turbo levels.
 */
export const POINTS = {
  nearMiss: 60, slingshot: 80, perfect: 80, hit: 40, heavyHit: 60, throwHit: 90,
  parry: 150, ko: 200, steal: 80, batonDodge: 100,
  drift1: 50, drift2: 100, drift3: 180,
  roadblock: 150, geese: 120, stall: 100,
} as const;

/** The drift mini-turbo power (0.22 / 0.28 / 0.35) picks the level of the drift boost. */
export const DRIFT_POWER = { level2: 0.26, level3: 0.33 } as const;

/**
 * The set pieces of the road (SPEC §14, §19) the style chains score: how close a honking goose has to be
 * to spoil a flock, how close a smashed stall has to be to count, how far past a flock the player has to
 * ride and how near a honking goose has to be to belong to that flock.
 */
export const SPOT = {
  /** A goose honk this close to the player spoils the flock bonus. */
  honkRange: 6,
  /** A smashed stall this close to the player scores the stall bonus. */
  stallRange: 8,
  /** The player has to ride this far past a flock before it counts. */
  flockPast: 40,
  /** A honk belongs to the flock whose spot is this close to the honking goose. */
  flockMatch: 40,
} as const;

/** Short Chinese HUD labels (P5). */
export const LABEL = {
  nearMiss: '擦肩', slingshot: '甩尾弹射', perfect: '完美落地', trick: '特技', hit: '命中',
  heavyHit: '重击', throwHit: '飞刀', parry: '招架', ko: '击倒', steal: '夺械', batonDodge: '闪避警棍',
  drift1: '漂移L1', drift2: '漂移L2', drift3: '漂移L3',
  roadblock: '冲卡', geese: '鹅群穿行', stall: '砸摊',
} as const;

/** The action kinds that always score the same points. */
export type FixedKind =
  | 'nearMiss' | 'slingshot' | 'perfect' | 'parry' | 'ko' | 'steal' | 'batonDodge'
  | 'roadblock' | 'geese' | 'stall';

