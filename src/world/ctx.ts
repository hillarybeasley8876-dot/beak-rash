// Shared build context for the world builders: layout, queries, look, seeded rngs, the track group,
// resource ownership (only what the track creates is disposed — shared toon() materials are not)
// and per-frame updaters.
import type { Group, PerspectiveCamera } from 'three';
import type { AppContext } from '../core/contracts';
import type { Rng } from '../core/rng';
import type { EnvLook, Quality, TrackId } from '../core/types';
import type { BuiltLayout } from './layout/build';
import type { TrackQuery } from './layout/query';

export interface Disposable { dispose(): void }
export type Updater = (dtSim: number, dtReal: number, camera: PerspectiveCamera) => void;

/** Ground height lookup in track space (exact rendered surface where a terrain mesh exists). */
export type GroundFn = (s: number, x: number) => number;

export interface WorldCtx {
  readonly app: AppContext;
  readonly id: TrackId;
  readonly L: BuiltLayout;
  readonly q: TrackQuery;
  readonly look: EnvLook;
  /** Cosmetic randomness, seeded per track id so the world looks the same every race. */
  readonly rng: Rng;
  /** Session-seeded randomness for per-race variety (billboard text order). */
  readonly raceRng: Rng;
  readonly quality: Quality;
  readonly group: Group;
  /** Register a resource the track created; disposed with the track. */
  own<T extends Disposable>(res: T): T;
  /** One owned instance per key (shared textures/materials between builders). */
  shared<T extends Disposable>(key: string, make: () => T): T;
  onUpdate(fn: Updater): void;
  /** Build diagnostics (`[track] …`), printed only with the `debug` URL parameter. */
  log(msg: string): void;
  /** Progress within the current build stage (0 … 1), reported as `flow:loading` (track.ts maps it). */
  progress(f: number): void;
  /** Terrain height at (s, x); set by the terrain builder, before dressing runs. */
  ground: GroundFn;
  /** Terrain height at a world point (x, z). */
  groundWorld: (wx: number, wz: number) => number;
}

export function createCtx(base: Omit<WorldCtx, 'own' | 'shared' | 'onUpdate' | 'log' | 'ground' | 'groundWorld'>): {
  ctx: WorldCtx; updaters: Updater[]; owned: Disposable[];
} {
  const owned: Disposable[] = [];
  const updaters: Updater[] = [];
  const memo = new Map<string, Disposable>();
  const own = <T extends Disposable>(res: T): T => {
    owned.push(res);
    return res;
  };
  const ctx: WorldCtx = {
    ...base,
    own,
    shared: <T extends Disposable>(key: string, make: () => T): T => {
      const hit = memo.get(key);
      if (hit) return hit as T;
      const res = own(make());
      memo.set(key, res);
      return res;
    },
    onUpdate: (fn) => {
      updaters.push(fn);
    },
    log: (msg) => {
      if (base.app.params?.has('debug')) console.info(`[track] ${msg}`);
    },
    ground: (s) => base.q.frameAt(s).pos.y,
    groundWorld: () => 0,
  };
  return { ctx, updaters, owned };
}
