// Who is who in a KO shot, for the subject mask (post/mask.ts): the victims, the attacker, and every
// other rider and vehicle as a bystander (traffic / police groups are the race unit's direct world children).
import { Vector3, type Object3D } from 'three';
import type { Session } from '../../core/contracts';
import type { RiderId } from '../../core/types';
import type { CastRole } from '../post/mask';

const BYSTANDER_GROUPS = new Set(['race:traffic', 'race:police']);

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
 * Riders standing between the lens and a victim (nearer by > 0.6 m and over its silhouette): the comic look
 * skips them for the frame, so a bystander or the attacker never hides the money shot (`keep` never hides).
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
      const d = b.length();
      if (d > dv - 0.6 || d < 1e-3) continue;
      const ang = a.angleTo(b);
      if (ang < Math.atan(0.9 / d) + Math.atan(0.8 / dv)) hide.add(view.root);
    }
  }
}
