// Debug surface for critics and tools: window.__br.sim = { tuning, riders(), cam }.
// Live-tweak handling with e.g. `__br.sim.tuning.gripTau = 0.05` (no reload needed).
import { TUNING, type Tuning } from './tuning';
import type { DebugApi } from '../core/debug';

export type DebugRow = Record<string, number | string | boolean>;

export interface SimDebug {
  tuning: Tuning;
  /** Private per-rider sim state (drift level, air kind, timers…). */
  riders: () => DebugRow[];
  /** Chase camera internals, refreshed every frame by the rig. */
  cam: DebugRow;
}

type WithSim = DebugApi & { sim?: SimDebug };

/** The shared __br.sim object (created on first use); null before the debug API exists. */
export function simDebug(): SimDebug | null {
  if (typeof window === 'undefined') return null;
  const br = window.__br as WithSim | undefined;
  if (!br) return null;
  if (!br.sim) br.sim = { tuning: TUNING, riders: () => [], cam: {} };
  return br.sim;
}

export const round = (v: number, d = 3): number => Math.round(v * 10 ** d) / 10 ** d;
