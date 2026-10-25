// What a KO shot keeps in frame: the victim's head (with headroom), its body and the bike while it stays
// close, as one sphere the camera fits clear of the letterbox bars. SHOWTIME frames its hero victim (the
// rider the impact knocked out nearest to it) the same way; cine-aim.ts trucks the aim toward the next victim.
import { Vector3 } from 'three';
import { smoothstep } from '../../core/math';

/** World anchors of a rider (head optional: sandbox stand-ins have none). */
export interface Anchors {
  readonly body: Vector3;
  readonly bike?: Vector3;
  readonly head?: Vector3;
  readonly ground: number;
}

export const CLUSTER_RADIUS = 25;
/** SHOWTIME: the victim nearest the hero within PAIR_MAX m shares its frame (farther ones stay out of it). */
export const PAIR_MAX = 8;
const HEADROOM = 0.3; // m above the head anchor (helmet, ears, crest)
const PAD = 0.12;     // m around the box (focus smoothing lag)

const lo = new Vector3();
const hi = new Vector3();
const tmp = new Vector3();

function grow(p: Vector3): void {
  lo.min(p);
  hi.max(p);
}

/** Bounding sphere of head + headroom, body and the bike (faded out as it flies off, from `bikeNear` m to
 *  `bikeFade` m further); returns the radius. */
export function subjectSphere(a: Anchors, out: Vector3, bikeNear = 3.5, bikeFade = 2.5): number {
  lo.copy(a.body);
  hi.copy(a.body);
  if (a.head) {
    grow(a.head);
    grow(tmp.copy(a.head).setY(a.head.y + HEADROOM));
  } else grow(tmp.copy(a.body).setY(a.body.y + 0.6 + HEADROOM));
  if (a.bike) {
    const w = 1 - smoothstep(bikeNear, bikeNear + bikeFade, a.body.distanceTo(a.bike));
    if (w > 0) grow(tmp.copy(a.body).lerp(a.bike, w));
  }
  out.addVectors(lo, hi).multiplyScalar(0.5);
  return lo.distanceTo(hi) * 0.5 + PAD;
}

/** Index of the body nearest `point` within `max` m (−1 = none). */
export function heroIndex(point: Vector3, bodies: readonly Vector3[], max = CLUSTER_RADIUS): number {
  let best = -1;
  let nd = max;
  bodies.forEach((b, i) => {
    const d = b.distanceTo(point);
    if (d <= nd) {
      nd = d;
      best = i;
    }
  });
  return best;
}
