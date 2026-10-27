// 悲伤仓鼠 the sad hamster: a golden-tan hamster with a cream belly and cream cheek pouches, tiny round ears, a
// tiny pink nose and ENORMOUS glossy black eyes (two highlights each, a tear at the lower lid). Signature:
// SAD VIOLIN (an imaginary violin, so no prop).
import { SphereGeometry, Vector3 } from 'three';
import type { CharacterBuilder } from '../kit/builder';
import { addEars, addMouth } from '../kit/ears-tails';
import { placed } from '../kit/face';
import { addHelmet } from '../kit/gear';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import type { V3 } from '../kit/sdf';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xe8c49a, CREAM = 0xfff4e6, PINK = 0xff9fb0, WET = 0xbfe6ff;

/** A second, smaller highlight on the big black eye (the hamster's eyes carry two each). */
function extraGlint(b: CharacterBuilder, eye: V3, dir: V3, r: number, side: -1 | 1): void {
  const d = new Vector3(dir[0] * (side === -1 ? 1 : -1), dir[1], dir[2]).normalize();
  const up = new Vector3(0, 1, 0);
  const h = new Vector3().crossVectors(up, d).normalize();
  const d2 = d.clone().applyAxisAngle(h, 0.45).applyAxisAngle(up, side * 0.18).normalize();
  const p = new Vector3(eye[0], eye[1], eye[2]).addScaledVector(d2, r * 1.05);
  const g = new SphereGeometry(1, 8, 6);
  b.part({ geometry: g, matrix: placed(p, d2, r * 0.21), color: 0xffffff, bone: side === -1 ? B.eyeL : B.eyeR, outline: 0 });
  g.dispose();
}

const spec: MammalSpec = {
  fur: FUR, belly: CREAM, muzzle: CREAM, nose: PINK,
  // A hamster is a ball: a wide, short barrel and a short neck (the head sits right on the shoulders).
  body: { c: [0, 0.17, -0.05], r: [0.205, 0.155, 0.19], rot: 0.28 },
  chest: { c: [0, 0.26, -0.18], r: [0.175, 0.125, 0.15] },
  head: { c: [0, 0.55, -0.29], r: [0.14, 0.13, 0.132] },
  snout: { c: [0, 0.508, -0.408], r: [0.055, 0.04, 0.045] },
  // Chubby cream cheek pouches.
  cheeks: { c: [-0.088, 0.505, -0.362], r: [0.048, 0.05, 0.05], color: CREAM },
  noseAt: [0, 0.532, -0.442], noseR: [0.014, 0.01, 0.009],
  chin: { c: [0, 0.472, -0.39], r: [0.045, 0.024, 0.038] },
  arm: [0.054, 0.05, 0.056], leg: [0.082, 0.068, 0.058, 0.052],
  hand: { r: [0.05, 0.04, 0.054], color: CREAM, toes: 3 },
  foot: { r: [0.05, 0.038, 0.072], color: CREAM, toes: 3, pad: PINK, drop: 0.01 },
  // Enormous glossy black eyes.
  eye: { at: [-0.062, 0.565, -0.398], r: 0.056, dir: [-0.28, 0.04, -0.96], pupil: 0.038, glint: 0.38 },
  extra: [
    // A fat roll of chest fur on the neck bone: the hamster's head flows straight into its ball body, no neck.
    // (A horizontal roll, so the whole neck is filled at a constant width; on a neck bone, so it does not widen
    // the head nor the torso.)
    { shape: { kind: 'capsule', a: [-0.05, 0.37, -0.28], b: [0.05, 0.37, -0.28], r: 0.13, r2: 0.13 }, color: CREAM, bone: B.neck2, k: 0.05, sigma: 0.03 },
    // A tear clinging to the lower lid.
    { shape: { kind: 'ellipsoid', c: [-0.07, 0.518, -0.408], r: [0.009, 0.013, 0.009] }, color: WET, bone: B.head, k: 0.005, sigma: 0.01, priority: 0.02 },
    { shape: { kind: 'ellipsoid', c: [0.07, 0.518, -0.408], r: [0.009, 0.013, 0.009] }, color: WET, bone: B.head, k: 0.005, sigma: 0.01, priority: 0.02 },
  ],
  budget: 3200,
  cell: 0.014,
};

const J = mammalJoints(spec, {
  hat: [0, 0.67, -0.28], ear: [-0.1, 0.66, -0.24],
  clav: [-0.07, 0.28, -0.23], shoulder: [-0.14, 0.27, -0.29], elbow: [-0.23, 0.15, -0.42], wrist: [-0.18, 0.02, -0.57],
  hip: [-0.1, 0.08, -0.04], knee: [-0.13, 0.03, -0.33], ankle: [-0.13, -0.27, -0.27], toe: [-0.13, -0.31, -0.39],
  tail: [[0, 0.16, 0.19], [0, 0.2, 0.27]],
});

export const hamster: SpeciesDef = {
  id: 'hamster',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.1, lidTilt: -0.3,
    neckReach: 0.04, tail: 'stub', earFlop: 0.06, hatWobble: 0.05, armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.47, -0.44], skin: FUR, skillPose: 'chill',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'round', w: 0.05, h: 0.045, thick: 0.018, color: FUR, inner: PINK, tilt: 0.3, back: 0.3, turn: 0.35 });
    // A small, sad mouth: the corners turn DOWN, the centre stays up (an upside-down U).
    addMouth(b, [[-0.034, 0.473, -0.43], [-0.017, 0.482, -0.44], [0, 0.486, -0.442], [0.017, 0.482, -0.44], [0.034, 0.473, -0.43]], 0.0042);
    extraGlint(b, spec.eye.at, spec.eye.dir, spec.eye.r, -1);
    extraGlint(b, spec.eye.at, spec.eye.dir, spec.eye.r, 1);
    addHelmet(b, { c: [0, 0.68, -0.28], r: [0.152, 0.1, 0.155], pitch: -0.2, color: 0xb08a5e, stripe: CREAM, round: true,
      strap: { chin: [0, 0.56, -0.37] } });
  },
};
