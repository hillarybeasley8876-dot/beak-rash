// Trick rotation of the whole rider + bike (SPEC §16): the view spins the rig around the bike's centre
// pivot while the sim keeps the physics untouched (the yaw, the position and the landing alignment never
// see the trick). The angle is 2π × progress; a negative sign turns the nose to the right first, so a spin
// with dir +1 (clockwise seen from above) is a negative turn about the local +Y, and a backflip (dir −1)
// is a positive turn about the local +X (the nose up first).
import { Quaternion, Vector3, type Object3D } from 'three';
import { clamp01 } from '../core/math';
import type { TrickKind, TrickState } from '../core/types';

/** The pivot in root-local space: the bike's centre, 0.6 m above the road between the wheels. */
export const PIVOT = new Vector3(0, 0.6, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_X = new Vector3(1, 0, 0);
const R = new Quaternion();
const tmp = new Vector3(), tmp2 = new Vector3();

/** The rotation axis of a trick in root-local space (null = no rotation: the superman only moves the rider). */
export function trickAxis(kind: TrickKind): Vector3 | null {
  if (kind === 'spin') return AXIS_Y;
  if (kind === 'backflip' || kind === 'frontflip') return AXIS_X;
  return null;
}

/** How far the trick has turned (0..1). The superman never turns. */
export function trickProgress(trick: TrickState): number {
  if (trick.kind === 'superman') return 0;
  return clamp01(trick.t / Math.max(trick.dur, 1e-3));
}

/**
 * Turn the root (rider + bike) by the trick around the bike's centre pivot: the pivot stays put, so the
 * bike swings around its middle instead of around a wheel. `quat`/`pos` are the physics pose.
 */
export function applyTrickPivot(root: Object3D, trick: TrickState | null, quat: Quaternion, pos: Vector3): void {
  if (!trick) return;
  const axis = trickAxis(trick.kind);
  if (!axis) return;
  const ang = -Math.PI * 2 * trickProgress(trick) * trick.dir;
  R.setFromAxisAngle(axis, ang);
  root.quaternion.copy(quat).multiply(R);
  tmp.copy(PIVOT).sub(tmp2.copy(PIVOT).applyQuaternion(R)).applyQuaternion(quat);
  root.position.copy(pos).add(tmp);
}
