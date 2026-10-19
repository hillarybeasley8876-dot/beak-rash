// Debug surface for critics and tools: window.__br.sim = { tuning, riders(), cam }.
// Live-tweak handling with e.g. `__br.sim.tuning.gripTau = 0.05` (no reload needed).
import { TUNING, type Tuning } from './tuning';
import type { DebugApi } from '../core/debug';
import type { SimRider } from './state';

export type DebugRow = Record<string, number | string | boolean>;

export interface SimDebug {
  tuning: Tuning;
  /** Private per-rider sim state (drift level, air kind, timers…). */
  riders: () => DebugRow[];
  /** Chase camera internals, refreshed every frame by the rig. */
  cam: DebugRow;
}

type WithSim = DebugApi & { sim?: SimDebug };

/** The idle rows hook. Module-level on purpose: a closure made inside createPhysics would keep that
 *  scope (and so the disposed RaceSession) reachable from window.__br after the race ends. */
export const noRows = (): DebugRow[] => [];

/** The shared __br.sim object (created on first use); null before the debug API exists. */
export function simDebug(): SimDebug | null {
  if (typeof window === 'undefined') return null;
  const br = window.__br as WithSim | undefined;
  if (!br) return null;
  if (!br.sim) br.sim = { tuning: TUNING, riders: noRows, cam: {} };
  return br.sim;
}

/** Rows hook for a live race; it captures only the sim riders, never the session. */
export function riderRows(riders: readonly SimRider[]): () => DebugRow[] {
  return () => riders.map((sr) => ({
    id: sr.r.id, mode: sr.r.mode, s: round(sr.r.s, 2), x: round(sr.r.x), v: round(sr.r.speed), vx: round(sr.r.vx),
    y: round(sr.r.y), vy: round(sr.r.vy), yaw: round(sr.r.yaw), lean: round(sr.r.lean), pitch: round(sr.pitch),
    air: sr.r.airborne, airKind: sr.airKind, drifting: sr.r.drifting, driftLevel: sr.driftLevel, driftDir: sr.driftDir,
    charge: round(sr.r.driftCharge), boost: round(sr.r.boostTime), boostPower: round(sr.r.boostPower),
    draft: round(sr.r.draft), surface: sr.r.surface, oil: round(sr.oilTime), wet: round(sr.wetTime),
    wobble: round(sr.wobbleTime), accel: round(sr.accel), top: round(sr.tune.top), mass: round(sr.tune.mass),
    carry: round(sr.carryTime), driftLock: round(sr.driftLock),
  }));
}

export const round = (v: number, d = 3): number => Math.round(v * 10 ** d) / 10 ** d;
