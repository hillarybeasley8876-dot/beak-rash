// Shared rider skeleton: every species uses the same 34 bones (unused ones simply get no weights).
// Bind pose = identity rotations, bones placed at the species' joint positions (character space:
// origin = saddle top under the pelvis, −Z forward, +X right; "L" = rider's left = −X).
import { Bone, Matrix4, Skeleton, Vector3 } from 'three';
import type { V3 } from '../kit/sdf';

export const B = {
  pelvis: 0, spine: 1, chest: 2, neck1: 3, neck2: 4, neck3: 5, head: 6, jaw: 7, pouch: 8,
  lidL: 9, lidR: 10, eyeL: 11, eyeR: 12, browL: 13, browR: 14, hat: 15,
  clavL: 16, armL: 17, foreL: 18, handL: 19, clavR: 20, armR: 21, foreR: 22, handR: 23,
  thighL: 24, shinL: 25, footL: 26, thighR: 27, shinR: 28, footR: 29,
  tail1: 30, tail2: 31, earL: 32, earR: 33,
} as const;
export type BoneName = keyof typeof B;
export const BONE_COUNT = 34;

const PARENT: readonly number[] = [
  -1, B.pelvis, B.spine, B.chest, B.neck1, B.neck2, B.neck3, B.head, B.jaw,
  B.head, B.head, B.head, B.head, B.head, B.head, B.head,
  B.chest, B.clavL, B.armL, B.foreL, B.chest, B.clavR, B.armR, B.foreR,
  B.pelvis, B.thighL, B.shinL, B.pelvis, B.thighR, B.shinR,
  B.pelvis, B.tail1, B.head, B.head,
];

/** Joint positions in the bind pose. Paired joints are given for the LEFT side (x < 0). */
export interface Joints {
  pelvis: V3; spine: V3; chest: V3; neck: readonly [V3, V3, V3]; head: V3;
  jaw: V3; pouch: V3; eye: V3; pupil: V3; brow: V3; hat: V3; ear: V3;
  clav: V3; shoulder: V3; elbow: V3; wrist: V3;
  hip: V3; knee: V3; ankle: V3; toe: V3;
  tail: readonly [V3, V3];
}

export const mirror = (p: V3): V3 => [-p[0], p[1], p[2]];

/** Bind position of every bone, by index. */
export function bindPositions(j: Joints): Vector3[] {
  const L = (p: V3): Vector3 => new Vector3(p[0], p[1], p[2]);
  const R = (p: V3): Vector3 => L(mirror(p));
  return [
    L(j.pelvis), L(j.spine), L(j.chest), L(j.neck[0]), L(j.neck[1]), L(j.neck[2]), L(j.head), L(j.jaw), L(j.pouch),
    L(j.eye), R(j.eye), L(j.pupil), R(j.pupil), L(j.brow), R(j.brow), L(j.hat),
    L(j.clav), L(j.shoulder), L(j.elbow), L(j.wrist), R(j.clav), R(j.shoulder), R(j.elbow), R(j.wrist),
    L(j.hip), L(j.knee), L(j.ankle), R(j.hip), R(j.knee), R(j.ankle),
    L(j.tail[0]), L(j.tail[1]), L(j.ear), R(j.ear),
  ];
}

export interface Rig {
  bones: Bone[];
  skeleton: Skeleton;
  /** Bind positions (character space) per bone. */
  rest: Vector3[];
  /** Bind local offsets (bone position relative to its parent) per bone. */
  restLocal: Vector3[];
  parent: readonly number[];
}

/** Fresh bone hierarchy for one rider instance. */
export function createRig(j: Joints): Rig {
  const rest = bindPositions(j);
  const bones: Bone[] = [];
  const restLocal: Vector3[] = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const b = new Bone();
    b.name = Object.keys(B)[i] ?? `bone${i}`;
    const p = PARENT[i] ?? -1;
    const local = (rest[i] as Vector3).clone().sub(p >= 0 ? (rest[p] as Vector3) : new Vector3());
    b.position.copy(local);
    restLocal.push(local);
    bones.push(b);
    if (p >= 0) (bones[p] as Bone).add(b);
  }
  const inverses = rest.map((r) => new Matrix4().makeTranslation(-r.x, -r.y, -r.z));
  return { bones, skeleton: new Skeleton(bones, inverses), rest, restLocal, parent: PARENT };
}

/** Reset every bone to the bind pose. */
export function resetPose(rig: Rig): void {
  rig.bones.forEach((b, i) => {
    b.position.copy(rig.restLocal[i] as Vector3);
    b.quaternion.identity();
    b.scale.set(1, 1, 1);
  });
}
