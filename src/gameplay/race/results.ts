// Results & rewards: RaceResult rows, projected times for riders still on course when the
// player finishes, coins (place bonus + KO/pickup coins from combat − fines), saved stats.
import type { AppContext, RaceResult } from '../../core/contracts';
import type { RiderId, RiderState } from '../../core/types';
import type { RaceCtx } from './ctx';

export const PLACE_BONUS = [500, 300, 200, 120, 80, 50, 30, 10];
const MIN_PACE = 6;          // m/s floor for projected finish times
const PROJECTED_GAP = 0.35;  // s minimum gap between consecutive projected finishers

export function placeBonus(place: number): number {
  return PLACE_BONUS[place - 1] ?? 0;
}

/** Live or final result rows in standings order. `times` overrides finish times (projections). */
export function buildResults(order: readonly RiderState[], times?: Map<RiderId, number | null>): RaceResult[] {
  return order.map((r) => {
    const time = times?.has(r.id) ? (times.get(r.id) ?? null) : r.finishTime;
    const bonus = time !== null ? placeBonus(r.place) : 0;
    return {
      riderId: r.id, character: r.character, name: r.name, isPlayer: r.isPlayer, place: r.place,
      time, kos: r.kos, wrecked: r.wrecked, coins: Math.max(0, Math.round(bonus + r.coins)),
    };
  });
}

/**
 * Final times. When the player finished, riders still racing get a projected time from their pace
 * (kept in standings order); when the race timed out, unfinished riders are DNF (null).
 */
export function finalTimes(ctx: RaceCtx, order: readonly RiderState[], timedOut: boolean): Map<RiderId, number | null> {
  const times = new Map<RiderId, number | null>();
  const length = ctx.session.track.length;
  let prev = 0;
  for (const r of order) {
    if (r.finishTime !== null) {
      times.set(r.id, r.finishTime);
      prev = Math.max(prev, r.finishTime);
      continue;
    }
    if (timedOut) {
      times.set(r.id, null);
      continue;
    }
    const avg = ctx.clock > 1 ? r.s / ctx.clock : r.speed;
    const pace = Math.max(MIN_PACE, avg * 0.7 + r.speed * 0.3);
    const t = ctx.clock + Math.max(0, length - r.s) / pace;
    const time = Math.max(t, prev + PROJECTED_GAP);
    times.set(r.id, time);
    ctx.projected.add(r.id);
    prev = time;
  }
  return times;
}

/** Career statistics (coins are added to the balance by the results screen during its count-up). */
export function saveStats(app: AppContext, ctx: RaceCtx, results: RaceResult[]): void {
  const me = results.find((r) => r.isPlayer);
  if (!me) return;
  const player = ctx.session.player;
  app.save.update((d) => {
    d.stats.races += 1;
    if (me.place === 1 && me.time !== null) d.stats.wins += 1;
    d.stats.kos += me.kos;
    d.stats.wrecked += me.wrecked;
    d.stats.busted += ctx.bustedCount.get(player.id) ?? 0;
    d.stats.distance += Math.round(Math.max(0, Math.min(player.s, ctx.session.track.length)));
  });
}
