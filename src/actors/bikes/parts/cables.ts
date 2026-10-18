// Toy brake housings: chunky 5.5 mm cable loops (Catmull-Rom through a few points) with a thin outline.
// Front brakes live on the steer bone (lever → loop in front of the head tube → caliper). Rear brakes run on the
// steer bone from the lever to a cable guide on the head tube (on the steering axis' side, so they stay joined
// at normal steer angles), then on the frame along the given route to the rear brake.
import { v, ellip, tube, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';
import type { BikeBuilder } from '../template';
import type { Layout } from './layout';

export const HOUSING = '#1d1e23';
const R = 0.0055;

/** One housing through `pts`. */
export function housing(ps: PartSet, pts: V3[], seg: Seg, color = HOUSING): void {
  ps.add(tube(pts, R, seg(3 * (pts.length - 1), 4), seg(6, 4)), { color, outline: 0.004 });
}

/** Loop from a lever (`from`) arcing forward of the head tube (radius `headR`) down to the front brake (`to`). */
export function frontLoop(st: PartSet, L: Layout, from: V3, to: V3, headR: number, seg: Seg, color = HOUSING): void {
  const side = Math.sign(from.x) || 1;
  const midY = (from.y + to.y) / 2;
  const lift = from.clone().add(v(-side * 0.035, 0.035, -0.055));
  const front = L.onAxis(midY).add(v(side * 0.022, 0, -headR - 0.035));
  housing(st, [from, lift, front, to.clone().add(v(0, 0.045, -0.03)), to], seg, color);
}

/** Rear brake: lever (`from`) → guide on the head tube (steer bone), guide → `route` (frame bone, ends at the
 *  brake). Returns the guide position. */
export function rearRun(b: BikeBuilder, L: Layout, from: V3, route: V3[], headR: number, seg: Seg, color = HOUSING): V3 {
  const side = Math.sign(from.x) || 1;
  const guide = L.onAxis(L.headTop.y - 0.02).add(v(side * (headR + 0.008), 0, -0.006));
  const lift = from.clone().add(v(-side * 0.03, 0.03, -0.05));
  const front = L.onAxis(L.headTop.y + 0.02).add(v(side * (headR + 0.012), 0.0, -headR - 0.02));
  housing(b.parts('steer'), [from, lift, front, guide.clone().add(v(0, 0.012, -0.012)), guide], seg, color);
  const frame = b.parts(null);
  frame.add(ellip(guide, 0.008, 0.012, 0.01, seg(8, 6), seg(5, 4)), { color: '#3a3d44', outline: 0.004 });
  housing(frame, [guide, ...route], seg, color);
  return guide;
}

/** Points along a frame tube a → b, `off` from its centre line (e.g. up and to one side of the tube). */
export function along(a: V3, b: V3, off: V3, ts: number[] = [0.12, 0.5, 0.88]): V3[] {
  return ts.map((t) => a.clone().lerp(b, t).add(off));
}
