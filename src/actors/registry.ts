// Live rider views per app, so a view can find its neighbours (look-at targets) without knowing
// the session. Positions are world-space and one frame old, which is fine for glances.
import { Vector3 } from 'three';
import type { AppContext } from '../core/contracts';
import type { RiderId, RiderMode } from '../core/types';

export interface RiderEntry {
  id: RiderId;
  pos: Vector3;     // world position of the head
  body: Vector3;    // world position of the body
  mode: RiderMode;
  visible: boolean;
}

const byApp = new WeakMap<AppContext, Map<RiderId, RiderEntry>>();

export function registry(app: AppContext): Map<RiderId, RiderEntry> {
  let m = byApp.get(app);
  if (!m) {
    m = new Map();
    byApp.set(app, m);
  }
  return m;
}

/**
 * Nearest other rider to `from` whose offset passes `accept` (offset in world space).
 * Returns null when nobody qualifies within `maxDist`.
 */
export function nearest(
  app: AppContext, self: RiderId, from: Vector3, maxDist: number, accept: (offset: Vector3) => boolean,
): RiderEntry | null {
  let best: RiderEntry | null = null, bestD = maxDist;
  const off = new Vector3();
  for (const e of registry(app).values()) {
    if (e.id === self || !e.visible || e.mode === 'crashed') continue;
    off.subVectors(e.body, from);
    const d = off.length();
    if (d < bestD && accept(off)) {
      best = e;
      bestD = d;
    }
  }
  return best;
}
