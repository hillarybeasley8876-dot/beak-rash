// STYLE for the set pieces on the road (SPEC §17): threading the gap of a police roadblock (150), riding
// through a goose flock untouched (120) and smashing a fruit stall (100). Player only: a spot is remembered
// while it lies on the road and forgotten when the race ends.
import type { Session } from '../../core/contracts';
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../core/events-map';
import type { Obstacle } from '../../core/types';
import { fixedAction, type StyleAction } from './actions';
import { SPOT } from './tuning';

/** A police roadblock: one open gap in the barrier row, at `s`. */
interface Roadblock {
  s: number;
  gapX: number;
  gapWidth: number;
}

/** A goose flock waddling across the road at `s`. */
interface Flock {
  s: number;
  spoiled: boolean;   // a goose was honked at the player
}

export interface TrackStyleDeps {
  /** The bus of the running app. */
  bus: EventBus<GameEvents>;
  /** The session the chains run in (null when the style module is detached). */
  session(): Session | null;
  /** Score an action: it joins the player's chain. */
  score(action: StyleAction): void;
}

export interface TrackStyle {
  /** The bus listeners (the caller registers them and removes them with the race). */
  listen(): Array<() => void>;
  /** Once per frame: the crossings the bus events do not drive. */
  update(): void;
  /** Forget every remembered spot (a new race). */
  reset(): void;
}

export function createTrackStyle(deps: TrackStyleDeps): TrackStyle {
  const roadblocks: Roadblock[] = [];
  const flocks: Flock[] = [];
  const stalls = new Set<number>();

  /** The obstacle with this id on the road (null when it is gone). */
  const obstacle = (id: number): Obstacle | null => {
    const list = deps.session()?.obstacles;
    if (!list) return null;
    for (const ob of list) if (ob.id === id) return ob;
    return null;
  };

  /** The goose nearest to the player (the honking one may already be off the road). */
  const nearestGoose = (p: { s: number; x: number }): Obstacle | null => {
    const list = deps.session()?.obstacles;
    if (!list) return null;
    let best: Obstacle | null = null;
    let bestD = Infinity;
    for (const ob of list) {
      if (ob.kind !== 'goose') continue;
      const d = Math.hypot(ob.s - p.s, ob.x - p.x);
      if (d < bestD) { bestD = d; best = ob; }
    }
    return best;
  };

  /** The flock the honking goose belongs to loses the bonus. */
  const spoilFlock = (gooseS: number): void => {
    let best: Flock | null = null;
    let bestD = Infinity;
    for (const f of flocks) {
      if (f.spoiled) continue;
      const d = Math.abs(f.s - gooseS);
      if (d < bestD) { bestD = d; best = f; }
    }
    if (best && bestD <= SPOT.flockMatch) best.spoiled = true;
  };

  const listen = (): Array<() => void> => {
    const bus = deps.bus;
    return [
      bus.on('police:roadblock', (e) => {
        const s = deps.session();
        if (!s || e.riderId !== s.player.id) return;
        roadblocks.push({ s: e.s, gapX: e.gapX, gapWidth: e.gapWidth });
      }),
      bus.on('race:event', (e) => {
        if (e.kind !== 'geese' || e.phase !== 'start') return;
        flocks.push({ s: e.s, spoiled: false });
      }),
      bus.on('traffic:honk', (e) => {
        const s = deps.session();
        if (!s) return;
        const p = s.player;
        const ob = obstacle(e.obstacleId) ?? nearestGoose(p);
        if (!ob || ob.kind !== 'goose') return;
        if (Math.hypot(ob.s - p.s, ob.x - p.x) > SPOT.honkRange) return;
        spoilFlock(ob.s);
      }),
      bus.on('npc:say', (e) => {
        const s = deps.session();
        if (!s) return;
        const p = s.player;
        const ob = obstacle(e.obstacleId);
        if (!ob || ob.kind !== 'stall') return;
        if (Math.hypot(ob.s - p.s, ob.x - p.x) > SPOT.stallRange) return;
        if (stalls.has(ob.id)) return;
        stalls.add(ob.id);
        deps.score(fixedAction('stall'));
      }),
    ];
  };

  /**
   * The crossings the bus events do not drive: the player passes the roadblock's line and rides past the
   * flock. A roadblock only counts while the player is racing (a crash through the barriers is no gap).
   */
  const update = (): void => {
    const s = deps.session();
    if (!s) return;
    const p = s.player;
    const racing = p.mode === 'racing' || p.mode === 'finished';
    for (let i = roadblocks.length - 1; i >= 0; i--) {
      const r = roadblocks[i];
      if (p.s < r.s) continue;
      roadblocks.splice(i, 1);
      if (!racing) continue;
      if (Math.abs(p.x - r.gapX) > r.gapWidth / 2) continue;
      deps.score(fixedAction('roadblock'));
    }
    for (let i = flocks.length - 1; i >= 0; i--) {
      const f = flocks[i];
      if (p.s < f.s + SPOT.flockPast) continue;
      flocks.splice(i, 1);
      if (f.spoiled) continue;
      deps.score(fixedAction('geese'));
    }
  };

  const reset = (): void => {
    roadblocks.length = 0;
    flocks.length = 0;
    stalls.clear();
  };

  return { listen, update, reset };
}
