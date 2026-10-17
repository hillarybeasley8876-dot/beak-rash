// Constants and shared state of the camera rig (rig.ts) and its bus listeners (listeners.ts).
import { clamp01, lerp } from '../core/math';
import type { ChaseCam } from './chase';
import type { ShakeKick } from './shake';
import type { Blend } from './blend';
import type { AppContext, CameraOverride, Session } from '../core/contracts';

export const RIG = {
  blendOut: 0.35, respawnBlend: 0.45,
  buzzCurb: 0.6, buzzRough: 0.45, buzzScrape: 0.9, buzzSpeed: 0.2, scrapeHold: 0.25,
};

export interface RigState {
  readonly app: AppContext;
  readonly chase: ChaseCam;
  readonly fx: ShakeKick;
  readonly blend: Blend;
  session: Session | null;
  cine: CameraOverride | null;
  /** A rider:boost event already kicked the FOV this frame (the boost-state watcher skips it). */
  boostKicked: boolean;
  /** Real time until which the player counts as scraping a wall (buzz). */
  scrapeUntil: number;
}

/** FOV kick for a boost of `power` (+22 % … +35 % → 8 … 12°). */
export function boostKick(st: RigState, power: number, time: number): void {
  st.fx.kick(lerp(8, 12, clamp01((power - 0.15) / 0.2)), Math.max(0.35, time + 0.15));
}
