// Horizontal frame axes shared by the Sunset Pass modules (env-mountain).
import type { TrackFrame } from '../../core/types';

export interface FlatAxes { tx: number; tz: number; rx: number; rz: number }

/** Unit tangent and right vectors of a track frame projected onto the horizontal plane. */
export function flatAxes(fr: TrackFrame, out: FlatAxes = { tx: 0, tz: 0, rx: 0, rz: 0 }): FlatAxes {
  const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1, rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  out.tx = fr.tangent.x / tl;
  out.tz = fr.tangent.z / tl;
  out.rx = fr.right.x / rl;
  out.rz = fr.right.z / rl;
  return out;
}
