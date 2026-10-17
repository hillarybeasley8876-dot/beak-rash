// STUB kept by core for isolation tests (?stub=...) and as load fallback. The race unit owns index.ts: countdown, naive AI, standings and the finish line.
// Contract: createRaceLogic(session) → RaceLogic (core/contracts.ts).
import type { RaceLogic, RaceResult, Session } from '../../core/contracts';

export function createRaceLogic(session: Session): RaceLogic {
  const { bus } = session.app;
  let t = 0;
  let lastCount = 4;
  let ended = false;
  const results = (): RaceResult[] =>
    session.riders
      .slice()
      .sort((a, b) => a.place - b.place)
      .map((r) => ({
        riderId: r.id, character: r.character, name: r.name, isPlayer: r.isPlayer, place: r.place,
        time: r.finishTime, kos: r.kos, wrecked: r.wrecked, coins: r.coins,
      }));
  return {
    preStep(dt) {
      t += dt;
      if (session.phase === 'intro' && t > 0.5) session.phase = 'countdown';
      if (session.phase === 'countdown') {
        const n = Math.max(0, 3 - Math.floor(t - 0.5));
        if (n < lastCount) {
          lastCount = n;
          bus.emit('race:countdown', { n });
          if (n === 0) {
            session.phase = 'racing';
            for (const r of session.riders) r.mode = 'racing';
            bus.emit('race:start', {});
          }
        }
      }
      for (const r of session.riders) {
        if (r.isPlayer && !session.config.autopilot) continue;
        const c = session.controls.get(r.id);
        if (!c) continue;
        c.throttle = session.phase === 'racing' ? 0.92 : 0;
        const lane = ((r.id % 3) - 1) * 3;
        c.steer = Math.max(-1, Math.min(1, (lane - r.x) * 0.4));
      }
    },
    postStep() {
      const order = session.riders.slice().sort((a, b) => (b.finishTime === null ? 0 : 1) - (a.finishTime === null ? 0 : 1) || b.s - a.s);
      order.forEach((r, i) => {
        if (r.place !== i + 1 && r.finishTime === null) {
          bus.emit('race:placeChange', { riderId: r.id, from: r.place, to: i + 1 });
          r.place = i + 1;
        }
        r.progress = Math.min(1, r.s / session.track.length);
        if (r.finishTime === null && r.s >= session.track.length) {
          r.finishTime = session.time;
          r.mode = 'finished';
          bus.emit('race:finishLine', { riderId: r.id, place: r.place, time: session.time });
        }
      });
      if (!ended && session.player.finishTime !== null) {
        ended = true;
        session.phase = 'finished';
        bus.emit('race:end', { results: results() });
      }
    },
    results,
    dispose() {},
  };
}
