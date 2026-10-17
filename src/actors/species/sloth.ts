// 闪电 the sloth: shaggy brown coat with tufts, pale face disc, dark eye patches, eternal smile, slow
// sleepy blinks, long arms with hooked claws around the grips. Signature: FLASH (fast only then).
import { CapsuleGeometry, Matrix4, Quaternion, Vector3, Euler } from 'three';
import { addMouth } from '../kit/ears-tails';
import type { CharacterBuilder } from '../kit/builder';
import { addHelmet } from '../kit/gear';
import { buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import type { Prim } from '../kit/sdf';
import { B, mirror, type Joints } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0x9c8466, FACE = 0xe2d2b4, PATCH = 0x3a2e22, SHAG = 0x86704f;

function tufts(): Prim[] {
  const out: Prim[] = [];
  const spots: Array<[number, number, number, number]> = [
    [0, 0.42, 0.0, B.chest], [-0.1, 0.36, 0.05, B.spine], [0.1, 0.36, 0.05, B.spine], [0, 0.28, 0.14, B.pelvis],
    [-0.12, 0.25, 0.1, B.pelvis], [0.12, 0.25, 0.1, B.pelvis], [0, 0.82, -0.28, B.head], [-0.08, 0.8, -0.27, B.head], [0.08, 0.8, -0.27, B.head],
  ];
  for (const [x, y, z, bone] of spots) {
    out.push({ shape: { kind: 'ellipsoid', c: [x, y, z], r: [0.06, 0.05, 0.06] }, color: SHAG, bone, k: 0.05, sigma: 0.04 });
  }
  return out;
}

const spec: MammalSpec = {
  fur: FUR, belly: 0xb39b7a, muzzle: FACE, nose: 0x2a2018,
  body: { c: [0, 0.23, -0.03], r: [0.19, 0.19, 0.22], rot: 0.25 },
  chest: { c: [0, 0.38, -0.14], r: [0.16, 0.155, 0.16] },
  head: { c: [0, 0.71, -0.33], r: [0.13, 0.12, 0.12] },
  snout: { c: [0, 0.69, -0.41], r: [0.105, 0.09, 0.05] },
  noseAt: [0, 0.692, -0.465], noseR: [0.024, 0.016, 0.013],
  chin: { c: [0, 0.64, -0.42], r: [0.05, 0.026, 0.035] },
  arm: [0.056, 0.047, 0.04], leg: [0.068, 0.052, 0.044, 0.04], paw: [0.042, 0.036, 0.046], pawColor: FUR, footPaw: [0.04, 0.032, 0.055],
  eye: { at: [-0.05, 0.712, -0.437], r: 0.027, dir: [-0.3, 0.02, -0.95], pupil: 0.015 },
  extra: [
    ...tufts(),
    { shape: { kind: 'ellipsoid', c: [-0.058, 0.704, -0.432], r: [0.05, 0.026, 0.03] }, rot: [0, 0, -0.42], op: 'paint', color: PATCH, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [0.058, 0.704, -0.432], r: [0.05, 0.026, 0.03] }, rot: [0, 0, 0.42], op: 'paint', color: PATCH, bone: B.head },
  ],
  budget: 2500,
};

const J: Joints = mammalJoints(spec, {
  hat: [0, 0.8, -0.32], ear: [-0.1, 0.76, -0.3],
  shoulder: [-0.15, 0.38, -0.24], elbow: [-0.25, 0.27, -0.42], wrist: [-0.23, 0.11, -0.6],
});

/** Three hooked claws per hand, curling forward/down around the bar. */
function claws(b: CharacterBuilder): void {
  const geo = new CapsuleGeometry(0.008, 0.06, 2, 6);
  for (const side of [-1, 1] as const) {
    const w = side === -1 ? J.wrist : mirror(J.wrist);
    for (let i = 0; i < 3; i++) {
      const p = new Vector3(w[0] + (i - 1) * 0.022, w[1] - 0.035, w[2] - 0.05);
      const m = new Matrix4().compose(p, new Quaternion().setFromEuler(new Euler(1.1, 0, (i - 1) * 0.15)), new Vector3(1, 1, 1));
      b.part({ geometry: geo, matrix: m, color: 0xe8dcc0, bone: side === -1 ? B.handL : B.handR, outline: 0.6 });
    }
  }
  geo.dispose();
}

export const sloth: SpeciesDef = {
  id: 'sloth',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.35,
    neckReach: 0.04, tail: 'none', armUp: [0, -0.75, 0.66], gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.65, -0.46], skin: FUR, skillPose: 'flash',
  },
  build(b) {
    buildMammal(b, J, spec);
    addMouth(b, [[-0.046, 0.664, -0.452], [-0.024, 0.652, -0.464], [0, 0.648, -0.468], [0.024, 0.652, -0.464], [0.046, 0.664, -0.452]], 0.0045);
    addHelmet(b, { c: [0, 0.795, -0.325], r: [0.14, 0.08, 0.145], pitch: 0.12, color: 0x5b4632, stripe: 0xe2d2b4 });
    claws(b);
  },
};
