// window.__br.net — the online race's test surface (SPEC §28): the state hashes this client reported, the ticks
// it ran and the ticks that still wait. Installed like src/fx/debug.ts hooks window.__br (the debug API is
// created after the systems, so the surface is attached whenever it appears).
export interface NetDebug {
  /** The state hashes this client sent to the relay ({ tick, h }). */
  hashes(): Array<{ tick: number; h: string }>;
  /** The ticks that ran (the sim steps). */
  ticks(): number;
  /** The ticks that arrived and wait for their turn. */
  queued(): number;
}

type WithNet = { __br?: { net?: NetDebug } };

/** Hook the surface onto window.__br; it does nothing while the debug API is not there yet. */
export function installNetDebug(debug: NetDebug): void {
  const w = window as unknown as WithNet;
  if (!w.__br) return;
  w.__br.net = debug;
}
