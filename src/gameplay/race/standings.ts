// Standings: progress, finish line, places, race:placeChange / race:finishLine / race:finalStretch.
// Finish times are interpolated inside the substep and riders crossing in the same substep are placed
// in crossing order, so the place announced at the line is the final place. Passes on the player only
// count once the lead has held for PLAYER_HOLD s beyond PLAYER_MARGIN (no ping-pong callouts).
import { clamp, clamp01 } from '../../core/math';
import type { RiderId, RiderState } from '../../core/types';
import type { RaceCtx } from './ctx';

const PASS_MARGIN = 0.35;    // m a rider must lead by to take a place (rider vs rider)
const PLAYER_MARGIN = 1.0;   // m for passes involving the player…
const PLAYER_HOLD = 0.4;     // …held this long
const FINAL_STRETCH = 0.85;

export interface Standings {
  /** `dt` = the substep just simulated (for crossing-time interpolation and pass hysteresis). */
  update(dt: number): void;
  readonly order: readonly RiderState[];
  finishedCount(): number;
}

export function createStandings(ctx: RaceCtx): Standings {
  const { session } = ctx;
  const { bus } = session.app;
  const length = session.track.length;
  const player = session.player;
  const order = session.riders.slice().sort((a, b) => a.place - b.place);
  /** +1 = counted ahead of the player, −1 = behind; flips after PLAYER_HOLD s past the margin. */
  const vsPlayer = new Map<RiderId, 1 | -1>(session.riders.map((r) => [r.id, r.place < player.place ? 1 : -1]));
  const flipT = new Map<RiderId, number>();
  let finished = 0;
  let finalStretchSent = false;

  const ahead = (a: RiderState, b: RiderState): boolean => {
    if (a.finishTime !== null) return b.finishTime === null || a.finishTime < b.finishTime;
    if (b.finishTime !== null) return false;
    if (b.isPlayer) return vsPlayer.get(a.id) === 1;
    if (a.isPlayer) return vsPlayer.get(b.id) === -1;
    return a.s > b.s + PASS_MARGIN;
  };

  const trackPlayerPasses = (dt: number): void => {
    for (const r of session.riders) {
      if (r.isPlayer) continue;
      const d = r.s - player.s;
      const now = d > PLAYER_MARGIN ? 1 : d < -PLAYER_MARGIN ? -1 : 0;
      if (now === 0 || now === vsPlayer.get(r.id)) { flipT.set(r.id, 0); continue; }
      const t = (flipT.get(r.id) ?? 0) + dt;
      flipT.set(r.id, t);
      if (t >= PLAYER_HOLD) { vsPlayer.set(r.id, now); flipT.set(r.id, 0); }
    }
  };

  /** Riders who crossed the line during the last substep, in crossing order (interpolated times). */
  const detectFinish = (dt: number): void => {
    const crossed: Array<{ r: RiderState; t: number }> = [];
    for (const r of session.riders) {
      if (r.finishTime !== null) {
        if (r.mode === 'racing') { r.mode = 'finished'; r.modeTime = 0; }
        continue;
      }
      if (r.s < length) continue;
      const over = (r.s - length) / Math.max(0.1, r.speed);
      crossed.push({ r, t: ctx.clock + dt - clamp(over, 0, dt) });
    }
    crossed.sort((a, b) => a.t - b.t);
    for (const { r, t } of crossed) {
      r.finishTime = t;
      if (ctx.winnerTime === null) ctx.winnerTime = t;
      finished++;
      if (r.mode === 'racing') { r.mode = 'finished'; r.modeTime = 0; }
      bus.emit('race:finishLine', { riderId: r.id, place: finished, time: t });
    }
  };

  const sort = (): void => {
    for (let i = 1; i < order.length; i++) {
      for (let j = i; j > 0; j--) {
        const a = order[j] as RiderState, b = order[j - 1] as RiderState;
        if (!ahead(a, b)) break;
        order[j] = b;
        order[j - 1] = a;
      }
    }
  };

  return {
    order,
    finishedCount: () => finished,
    update(dt) {
      const racing = session.phase === 'racing' || session.phase === 'finished';
      for (const r of session.riders) r.progress = clamp01(r.s / length);
      if (!racing) return;
      detectFinish(dt);
      trackPlayerPasses(dt);
      sort();
      order.forEach((r, i) => {
        const place = i + 1;
        if (r.place === place) return;
        const from = r.place;
        r.place = place;
        bus.emit('race:placeChange', { riderId: r.id, from, to: place });
      });
      if (!finalStretchSent && player.progress >= FINAL_STRETCH) {
        finalStretchSent = true;
        bus.emit('race:finalStretch', { riderId: player.id });
      }
    },
  };
}
