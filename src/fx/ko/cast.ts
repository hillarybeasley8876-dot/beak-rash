// Who is who in a KO shot, for the subject mask (post/mask.ts): the victims, the attacker, and every
// other rider and vehicle as a bystander (traffic / police groups are the race unit's direct world children).
import { Vector3, type Object3D } from 'three';
import type { Session } from '../../core/contracts';
import type { ObstacleKind, RiderId } from '../../core/types';
import type { CastRole } from '../post/mask';

const BYSTANDER_GROUPS = new Set(['race:traffic', 'race:police']);
/** World group drawing each kind of moving obstacle (traffic is instanced per type, so a whole group steps aside). */
const VEHICLE_GROUP: Partial<Record<ObstacleKind, string>> = {
  car: 'race:traffic', van: 'race:traffic', truck: 'race:traffic', bus: 'race:traffic', police: 'race:police',
};

export function fillCast(cast: Map<Object3D, CastRole>, s: Session, victims: readonly RiderId[], attackers: readonly RiderId[]): void {
  cast.clear();
  for (const [id, view] of s.views) {
    cast.set(view.root, victims.includes(id) ? 'victim' : attackers.includes(id) ? 'attacker' : 'ghost');
  }
  for (const child of s.world.children) if (BYSTANDER_GROUPS.has(child.name)) cast.set(child, 'ghost');
}

const a = new Vector3();
const b = new Vector3();

/**
 * Riders and vehicles standing between the lens and a victim (nearer by > 0.6 m and over its silhouette): the
 * comic look skips them for the frame, so a bystander, a car or the attacker never hides the money shot (`keep`
 * never hides). Traffic is instanced per vehicle type, so one car in the way hides the race's traffic group.
 */
export function fillOccluders(hide: Set<Object3D>, s: Session, eye: Vector3, victims: readonly RiderId[], keep: readonly RiderId[]): void {
  hide.clear();
  for (const vid of victims) {
    const vv = s.views.get(vid);
    if (!vv) continue;
    vv.anchor('body', a).sub(eye);
    const dv = a.length();
    for (const [id, view] of s.views) {
      if (victims.includes(id) || keep.includes(id) || hide.has(view.root)) continue;
      view.anchor('body', b).sub(eye);
      if (inFront(b, dv, 0.9, 0)) hide.add(view.root);
    }
    for (const o of s.obstacles) {
      const name = VEHICLE_GROUP[o.kind];
      const root = o.active && name ? s.world.children.find((c) => c.name === name) : undefined;
      if (!root || hide.has(root)) continue;
      s.track.toWorld(o.s, o.x, o.height / 2, b).sub(eye);
      const r = Math.hypot(o.halfWidth, o.halfLength, o.height / 2);
      if (inFront(b, dv, r, r)) hide.add(root);
    }
  }
}

/** `rel` (eye-relative centre of something of angular radius `r` m) overlaps the victim at `a` (distance `dv`) and
 *  is nearer than it: its centre, or for a long vehicle its near end (`depthR` m in front of the centre). */
function inFront(rel: Vector3, dv: number, r: number, depthR: number): boolean {
  const d = rel.length();
  if (d - Math.min(depthR, d * 0.5) > dv - 0.6 || d < 1e-3) return false;
  return a.angleTo(rel) < Math.atan(r / d) + Math.atan(0.8 / dv);
}
