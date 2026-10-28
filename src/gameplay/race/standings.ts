// Standings: progress, finish line, places, race:placeChange / race:finishLine / race:finalStretch.
// Finish times are interpolated inside the substep and riders crossing in the same substep are placed
// in crossing order, so the place announced at the line is the final place. Passes on a human only
// count once the lead has held for HUMAN_HOLD s beyond HUMAN_MARGIN (no ping-pong callouts).
// Online (SPEC §28) every human has its own hysteresis: the places of the humans do not wobble either.
import { clamp, clamp01 } from '../../core/math';
import type { RiderId, RiderState } from '../../core/types';
import type { RaceCtx } from './ctx';

const PASS_MARGIN = 0.35;    // m a rider must lead by to take a place (rider vs rider)
const HUMAN_MARGIN = 1.0;    // m for passes involving a human…
const HUMAN_HOLD = 0.4;      // …held this long
const FINAL_STRETCH = 0.85;

export interface Standings {
  /** `dt` = the substep just simulated (for crossing-time interpolation and pass hysteresis). */
  update(dt: number): void;
  /** After race:end (results final, no events): riders still crossing the line roll out instead of riding on. */
  rollOutLate(): void;
  readonly order: readonly RiderState[];
  finishedCount(): number;
}

export function createStandings(ctx: RaceCtx): Standings {
  const { session } = ctx;
  const { bus } = session.app;
  const length = session.track.length;
  const order = session.riders.slice().sort((a, b) => a.place - b.place);
  /** human id → rider id → +1 (counted ahead of the human) / −1 (behind); flips after HUMAN_HOLD s. */
  const vsHuman = new Map<RiderId, Map<RiderId, 1 | -1>>();
  const flipT = new Map<string, number>();
  let finished = 0;
  const stretched = new Set<RiderId>();

  /** The side of `r` as the human `h` sees it (+1 = ahead). */
  const sideOf = (h: RiderState, r: RiderState): 1 | -1 => {
    let m = vsHuman.get(h.id);
    if (!m) { m = new Map(); vsHuman.set(h.id, m); }
    const v = m.get(r.id);
    if (v !== undefined) return v;
    const first: 1 | -1 = r.place < h.place ? 1 : -1;
    m.set(r.id, first);
    return first;
  };

  const ahead = (a: RiderState, b: RiderState): boolean => {
    if (a.finishTime !== null) return b.finishTime === null || a.finishTime < b.finishTime;
    if (b.finishTime !== null) return false;
    if (b.human) return sideOf(b, a) === 1;
    if (a.human) return sideOf(a, b) === -1;
    return a.s > b.s + PASS_MARGIN;
  };

  /** Write the side of `r` as the human `h` sees it. */
  const setSide = (h: RiderState, r: RiderState, v: 1 | -1): void => {
    let m = vsHuman.get(h.id);
    if (!m) { m = new Map(); vsHuman.set(h.id, m); }
    m.set(r.id, v);
  };

  const trackHumanPasses = (dt: number): void => {
    for (const h of session.humans) {
      for (const r of session.riders) {
        if (r === h) continue;
        const key = `${h.id}:${r.id}`;
        const d = r.s - h.s;
        const now = d > HUMAN_MARGIN ? 1 : d < -HUMAN_MARGIN ? -1 : 0;
        if (now === 0 || now === sideOf(h, r)) { flipT.set(key, 0); continue; }
        const t = (flipT.get(key) ?? 0) + dt;
        flipT.set(key, t);
        if (t >= HUMAN_HOLD) { setSide(h, r, now); flipT.set(key, 0); }
      }
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
      if (r.human && ctx.firstHumanFinish === null) ctx.firstHumanFinish = t;
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
    rollOutLate() {
      for (const r of session.riders) {
        if (r.s >= length && r.mode === 'racing') { r.mode = 'finished'; r.modeTime = 0; }
      }
    },
    update(dt) {
      const racing = session.phase === 'racing' || session.phase === 'finished';
      for (const r of session.riders) r.progress = clamp01(r.s / length);
      if (!racing) return;
      detectFinish(dt);
      trackHumanPasses(dt);
      sort();
      order.forEach((r, i) => {
        const place = i + 1;
        if (r.place === place) return;
        const from = r.place;
        r.place = place;
        bus.emit('race:placeChange', { riderId: r.id, from, to: place });
      });
      // The final stretch is announced for every human (the HUD shows the one of its own rider).
      for (const h of session.humans) {
        if (stretched.has(h.id) || h.progress < FINAL_STRETCH) continue;
        stretched.add(h.id);
        bus.emit('race:finalStretch', { riderId: h.id });
      }
    },
  };
}
