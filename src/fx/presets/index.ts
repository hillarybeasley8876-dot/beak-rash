// Preset registry: the names accepted by FxSystem.burst(name, pos, opts).
import * as bodies from './bodies';
import * as ground from './ground';
import * as impacts from './impacts';
import * as rewards from './rewards';
import * as skills from './skills';
import * as speed from './speed';
import type { Preset } from './kit';

export const PRESETS: Readonly<Record<string, Preset>> = {
  hit: impacts.hit,
  hitHeavy: impacts.hitHeavy,
  hitKo: impacts.hitKo,
  crit: impacts.crit,
  block: impacts.block,
  sparks: impacts.metalSparks,
  dust: ground.dust,
  grass: ground.grass,
  sand: ground.sand,
  dirt: ground.dirt,
  smoke: ground.smoke,
  driftSmoke: ground.driftSmoke,
  landing: ground.landing,
  splash: ground.splash,
  oil: ground.oil,
  hopDust: ground.hopDust,
  feathers: bodies.feathers,
  fur: bodies.fur,
  debris: bodies.debris,
  ko: bodies.koFeathers,
  koFeathers: bodies.koFeathers,
  koFur: bodies.koFur,
  scales: bodies.scales,
  crumbs: bodies.crumbs,
  leaves: bodies.leaves,
  keys: bodies.keys,
  fries: bodies.fries,
  poof: bodies.poof,
  confetti: rewards.confetti,
  coin: rewards.coin,
  sparkle: rewards.sparkle,
  heal: rewards.heal,
  crate: rewards.crate,
  driftSpark: speed.driftSpark,
  driftPop: speed.driftPop,
  streaks: speed.streaks,
  boost: speed.boost,
  shockwave: speed.shockwave,
  shout: skills.shout,
  aura: skills.aura,
  spin: skills.spin,
  zaps: skills.zaps,
  notes: skills.notes,
};

export const PRESET_NAMES = Object.keys(PRESETS);
