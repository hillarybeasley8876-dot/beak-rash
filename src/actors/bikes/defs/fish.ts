// The tandem's passenger: a stiff, grumpy salted fish (咸鱼) strapped to the stoker saddle. It stands at the
// saddle's right edge and bows out past the captain with a flank and its glaring face toward the chase camera;
// the head stays ~0.3 m over the saddle (below the captain's shoulders) so the rider's back keeps reading.
import { BoxGeometry, Matrix4, Quaternion, TorusGeometry, Vector3 } from 'three';
import { tube, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';
import { fishBody, fishFins, spine, surf, type Spine } from './fish-body';
import { fishFace } from './fish-face';

const RED = '#e5191c', BAND_U = 0.2;
/** Flank normal: toward the chase camera (behind and above the bike). The spine lies in the plane ⟂ N. */
const N = new Vector3(0, 0.25, 1).normalize();
const RIGHT = new Vector3(1, 0, 0);
const UP = N.clone().cross(RIGHT).normalize();

const origin = (seat: V3): V3 => seat.clone().add(v(0, 0, 0.055));
const inPlane = (o: V3, x: number, y: number): V3 => o.clone().addScaledVector(RIGHT, x).addScaledVector(UP, y);

/** Where the fish is strapped on (its sway pivot), from the stoker saddle top. */
export function fishPivot(seat: V3): V3 {
  return inPlane(origin(seat), 0.12, 0.02);
}

/** Tail root beside the saddle's right edge, rising, then bowing out to the right (snout ~0.37 m out). */
function fishSpine(seat: V3): Spine {
  const o = origin(seat);
  return spine(inPlane(o, 0.125, -0.035), inPlane(o, 0.15, 0.17), inPlane(o, 0.37, 0.24), N);
}

/** Red band round the lower body with a yellow buckle on the camera-side flank. */
function band(ps: PartSet, s: Spine, seg: Seg): void {
  const n = seg(18, 10);
  const pts = Array.from({ length: n }, (_, j) => surf(s, BAND_U, (j / n) * Math.PI * 2, 0.004));
  ps.add(tube(pts, 0.0065, n, seg(5, 4), true), { color: RED, outline: 0.004 });
  const f = s.at(BAND_U);
  const buckle = new BoxGeometry(0.03, 0.026, 0.009).applyMatrix4(new Matrix4().makeBasis(f.t, f.d, s.n).setPosition(surf(s, BAND_U, 0, 0.009)));
  ps.add(buckle, { color: '#ffd400', outline: 0.004 });
}

/** Two straps from the band to a loop round the stoker seatpost: one over the saddle top and down its left
 *  side, one under its right side. */
function straps(ps: PartSet, s: Spine, seat: V3, post: V3, seg: Seg): void {
  const o = { color: RED, outline: 0.004 };
  const over = [surf(s, BAND_U, Math.PI / 2, 0.004), seat.clone().add(v(0.05, 0.003, 0.05)), seat.clone().add(v(-0.045, 0.002, 0.045)),
    seat.clone().add(v(-0.1, -0.035, 0.035)), post.clone().add(v(-0.024, 0.004, 0))];
  ps.add(tube(over, 0.0055, seg(12, 6), 4), o);
  const under = [surf(s, BAND_U, 2.1, 0.004), seat.clone().add(v(0.08, -0.07, 0.035)), post.clone().add(v(0.024, 0.004, 0))];
  ps.add(tube(under, 0.0055, seg(8, 5), 4), o);
}

/** The fish (on its swaying group `ps`) beside the stoker saddle (`seat`), strapped to the stoker seatpost
 *  (`post`, seat-tube direction `axis`; the strap loop sits on the static `frame`). */
export function saltFish(ps: PartSet, frame: PartSet, seat: V3, post: V3, axis: V3, seg: Seg): void {
  const s = fishSpine(seat);
  ps.add(fishBody(s, seg), { outline: 0.016 });
  fishFins(ps, s, seg);
  fishFace(ps, s, seg);
  band(ps, s, seg);
  straps(ps, s, seat, post, seg);
  const loop = new TorusGeometry(0.024, 0.0055, 3, seg(12, 8)).applyQuaternion(new Quaternion().setFromUnitVectors(v(0, 0, 1), axis));
  frame.add(loop.translate(post.x, post.y, post.z), { color: RED, outline: 0.004 });
}
