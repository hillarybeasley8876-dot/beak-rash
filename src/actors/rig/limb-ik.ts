// Limb chains on a PoseState: two-bone IK for legs (hip → knee → ankle) and arms/wings
// (shoulder → elbow → wrist), with consistent twist from bind/runtime pole vectors.
import { Quaternion, Vector3 } from 'three';
import { aimQuat, solveTwoBone } from './ik';
import type { PoseState } from './pose-state';
import { B } from './skeleton';

export interface Chain { root: number; mid: number; end: number; side: -1 | 1 }

export const LEG: Record<'L' | 'R', Chain> = {
  L: { root: B.thighL, mid: B.shinL, end: B.footL, side: -1 },
  R: { root: B.thighR, mid: B.shinR, end: B.footR, side: 1 },
};
export const ARM: Record<'L' | 'R', Chain> = {
  L: { root: B.armL, mid: B.foreL, end: B.handL, side: -1 },
  R: { root: B.armR, mid: B.foreR, end: B.handR, side: 1 },
};

const mid = new Vector3(), end = new Vector3(), d0 = new Vector3(), d1 = new Vector3();
const q = new Quaternion();

/** Bind length of a chain's two bones (unscaled). */
export function chainLengths(ps: PoseState, c: Chain): [number, number] {
  return [ps.rest(c.mid).distanceTo(ps.rest(c.root)), ps.rest(c.end).distanceTo(ps.rest(c.mid))];
}

/**
 * Solve a chain toward `target`, bending toward `bend`. Twist: the bind vector `bindUp` (perpendicular-ish
 * to the limb) maps onto `up`. The root's parent must be current (fk). Returns reach ratio (> 1 = short).
 */
export function solveChain(ps: PoseState, c: Chain, target: Vector3, bend: Vector3, bindUp: Vector3, up: Vector3): number {
  ps.fk(c.root);
  const a = ps.mp[c.root] as Vector3;
  const [b1, b2] = chainLengths(ps, c);
  const s1 = ps.msc[c.root] ?? 1;
  const s2 = s1 * (ps.ls[c.mid] ?? 1);
  const reach = solveTwoBone(a, b1 * s1, b2 * s2, target, bend, mid, end);
  d0.subVectors(ps.rest(c.mid), ps.rest(c.root));
  d1.subVectors(mid, a);
  ps.setModelRot(c.root, aimQuat(d0, bindUp, d1, up, q));
  ps.fk(c.mid);
  d0.subVectors(ps.rest(c.end), ps.rest(c.mid));
  d1.subVectors(end, ps.mp[c.mid] as Vector3);
  ps.setModelRot(c.mid, aimQuat(d0, bindUp, d1, up, q));
  ps.fk(c.end);
  return reach;
}

/** Point the end bone so its bind direction `bindDir` maps to `dir` (twist from the poles). */
export function aimEnd(ps: PoseState, c: Chain, bindDir: Vector3, bindUp: Vector3, dir: Vector3, up: Vector3): void {
  ps.setModelRot(c.end, aimQuat(bindDir, bindUp, dir, up, q));
}
