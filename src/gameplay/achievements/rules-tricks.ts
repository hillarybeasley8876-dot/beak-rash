// The r4 riding achievements: the air tricks (SPEC §16), the STYLE chains (SPEC §17), the track events
// (SPEC §19) and the map / mode wins (SPEC §20). A trick or a bank only counts when the player did it, and
// a map only counts when the player won the race (finished first).
import type { RuleCtx } from './facts';

const TRICK_COMBO = 3;      // tricks landed in one air
const STYLE_KEEP = 5000;    // STYLE points in a chain that was banked unbroken
const STYLE_BROKEN = 2000;  // STYLE points in a chain that broke
const EVENTS = 2;           // track events that must start in one race

export function trickRules(ctx: RuleCtx): Array<() => void> {
  const { bus, facts, session } = ctx;

  /** The maps and modes this race counts for (SPEC §20) — a win only. */
  const mapWins = (): void => {
    const cfg = session.config;
    if (cfg.trackId === 'watertown') ctx.unlock('watertown');
    if (cfg.trackId === 'gobi') ctx.unlock('gobi');
    if (cfg.reverse) ctx.unlock('reverse');
    if (cfg.weather === 'snow') ctx.unlock('snow');
    if ((cfg.route ?? 0) > 0) ctx.unlock('route');
    if (cfg.playerBike === 'llm' || ctx.player.bike === 'llm') ctx.unlock('llm_win');
  };

  return [
    bus.on('rider:trick', ({ riderId, phase, kind, count }) => {
      if (!ctx.isPlayer(riderId) || phase !== 'land') return;
      if (kind === 'backflip') ctx.unlock('backflip');
      if (kind === 'superman') ctx.unlock('superman');
      if (count >= TRICK_COMBO) ctx.unlock('trick_combo');
    }),
    bus.on('style:bank', ({ riderId, total, broken }) => {
      if (!ctx.isPlayer(riderId)) return;
      if (broken) {
        if (total >= STYLE_BROKEN) ctx.unlock('style_broken');
      } else if (total >= STYLE_KEEP) ctx.unlock('style_5k');
    }),
    bus.on('race:event', ({ phase }) => {
      if (phase === 'start') facts.events += 1;
    }),
    bus.on('race:finishLine', ({ riderId, place }) => {
      if (!ctx.isPlayer(riderId)) return;
      // Two track events and not one crash: the player threaded the whole race.
      if (facts.events >= EVENTS && facts.wrecks === 0) ctx.unlock('event_survivor');
      if (place === 1) mapWins();
    }),
  ];
}
