// Riding, crashing and police achievements.
import type { RuleCtx } from './facts';

const PERFECT_LANDINGS = 3;
const NEAR_MISSES = 5;
/** Launch boosts: a perfect start gives clearly more power than a plain one (race flow: 0.30 vs 0.18). */
const PERFECT_LAUNCH_POWER = 0.25;

export function rideRules(ctx: RuleCtx): Array<() => void> {
  const { bus, facts, player } = ctx;

  return [
    bus.on('rider:drift', ({ riderId, phase, level }) => {
      if (ctx.isPlayer(riderId) && phase === 'end' && level >= 3) ctx.unlock('drift3');
    }),
    bus.on('rider:land', ({ riderId, perfect }) => {
      if (!ctx.isPlayer(riderId) || !perfect) return;
      facts.perfectLandings += 1;
      if (facts.perfectLandings >= PERFECT_LANDINGS) ctx.unlock('perfect3');
    }),
    bus.on('rider:boost', ({ riderId, kind, power }) => {
      if (!ctx.isPlayer(riderId)) return;
      if (kind === 'draft') ctx.unlock('slingshot');
      // Launch boosts arrive just before race:start (older race builds tag them 'pad').
      const launch = kind === 'launch' || (kind === 'pad' && !facts.started);
      if (launch && power >= PERFECT_LAUNCH_POWER) ctx.unlock('perfect_start');
    }),
    bus.on('rider:nearMiss', ({ riderId }) => {
      if (!ctx.isPlayer(riderId)) return;
      facts.nearMisses += 1;
      if (facts.nearMisses >= NEAR_MISSES) ctx.unlock('near_miss');
    }),
    bus.on('rider:bump', ({ a, b }) => {
      if (ctx.isPlayer(a) || ctx.isPlayer(b)) ctx.sampleHp();   // hard bumps cost HP without a combat:hit
    }),
    bus.on('pickup:take', ({ riderId }) => {
      if (ctx.isPlayer(riderId)) ctx.sampleHp();                // fish heal: re-base the sample
    }),
    bus.on('rider:respawn', ({ riderId }) => {
      if (ctx.isPlayer(riderId)) ctx.sampleHp();
    }),
    bus.on('rider:crash', ({ riderId, cause }) => {
      if (!ctx.isPlayer(riderId)) return;
      facts.wrecks += 1;
      facts.hurt = true;
      if (cause === 'water') ctx.unlock('water');
    }),
    bus.on('police:alert', ({ riderId, level, reason }) => {
      if (!ctx.isPlayer(riderId)) return;
      if (level > 0) {
        if (!facts.chase.active) facts.chase = { active: true, busted: false };
        return;
      }
      if (!facts.chase.active) return;
      // Outrun = the corgi gave up while you were still racing and had not been ticketed this chase.
      const escaped = !facts.chase.busted && player.finishTime === null
        && (reason === undefined ? player.mode === 'racing' : reason === 'lost');
      if (escaped) ctx.unlock('corgi');
      facts.chase.active = false;
    }),
    bus.on('police:busted', ({ riderId }) => {
      if (!ctx.isPlayer(riderId)) return;
      facts.chase.busted = true;
      ctx.unlock('busted');
    }),
  ];
}
