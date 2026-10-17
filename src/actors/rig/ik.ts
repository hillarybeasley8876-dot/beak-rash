// IK helpers in the rider's model space. Bones have identity bind rotations, so a bone's model-space
// rotation maps its bind vectors directly; aimQuat builds that rotation from (direction, pole) pairs.
import { Matrix4, Quaternion, Vector3 } from 'three';

const mA = new Matrix4(), mB = new Matrix4();
const x0 = new Vector3(), y0 = new Vector3(), z0 = new Vector3();
const x1 = new Vector3(), y1 = new Vector3(), z1 = new Vector3();
const tDir = new Vector3(), tBend = new Vector3();

/** Orthonormal basis with x along `dir` and y as close to `up` as possible. */
function basis(dir: Vector3, up: Vector3, x: Vector3, y: Vector3, z: Vector3): void {
  x.copy(dir).normalize();
  z.crossVectors(x, up);
  if (z.lengthSq() < 1e-10) z.crossVectors(x, Math.abs(x.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0));
  z.normalize();
  y.crossVectors(z, x);
}

/** Rotation taking (bindDir, bindUp) onto (dir, up). */
export function aimQuat(bindDir: Vector3, bindUp: Vector3, dir: Vector3, up: Vector3, out: Quaternion): Quaternion {
  basis(bindDir, bindUp, x0, y0, z0);
  basis(dir, up, x1, y1, z1);
  mA.makeBasis(x0, y0, z0).transpose();
  mB.makeBasis(x1, y1, z1).multiply(mA);
  return out.setFromRotationMatrix(mB);
}

/**
 * Two-bone IK: root `a`, bone lengths l1/l2, target `t`, bend toward `pole`.
 * Writes the middle joint into `mid` and the reachable end point into `end`; returns reach ratio (≤ 1).
 */
export function solveTwoBone(
  a: Vector3, l1: number, l2: number, t: Vector3, pole: Vector3, mid: Vector3, end: Vector3,
): number {
  const dir = tDir.subVectors(t, a);
  const dist = dir.length();
  const maxR = (l1 + l2) * 0.999, minR = Math.abs(l1 - l2) + 1e-3;
  const r = Math.min(Math.max(dist, minR), maxR);
  if (dist > 1e-6) dir.multiplyScalar(1 / dist); else dir.set(0, -1, 0);
  // Distance along dir to the middle joint's projection, and its offset from the axis.
  const along = (l1 * l1 - l2 * l2 + r * r) / (2 * r);
  const h = Math.sqrt(Math.max(l1 * l1 - along * along, 0));
  const bend = tBend.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (bend.lengthSq() < 1e-10) bend.set(0, 0, -1).addScaledVector(dir, dir.z);
  bend.normalize();
  mid.copy(a).addScaledVector(dir, along).addScaledVector(bend, h);
  end.copy(a).addScaledVector(dir, r);
  return dist / (l1 + l2);
}

/** Model-space rotation → local rotation under a parent with model-space rotation `parentQ`. */
export function toLocal(parentQ: Quaternion, modelQ: Quaternion, out: Quaternion): Quaternion {
  return out.copy(parentQ).invert().multiply(modelQ);
}
