// 佩德罗 the raccoon: grey fur, the black bandit mask across the eyes, white brows, a white muzzle and chin, a
// black nose, dark paws and a bushy ringed tail (grey / black bands). Signature: TRASH LOTTERY (a happy spin).
import { addEars, addMouth, addTail } from '../kit/ears-tails';
import { addHelmet } from '../kit/gear';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import type { Prim } from '../kit/sdf';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const GREY = 0x8a8f99, GREY_D = 0x5d626b, WHITE = 0xf3f3f1, MASK = 0x2b2d33, BLACK = 0x1e2026;

/** The bandit mask (a patch around each eye, joined over the nose bridge) and the white brows above it. */
function mask(): Prim[] {
  const out: Prim[] = [];
  for (const s of [-1, 1]) {
    out.push({ shape: { kind: 'ellipsoid', c: [s * 0.072, 0.612, -0.38], r: [0.095, 0.055, 0.11] }, op: 'paint', color: MASK, bone: B.head });
    out.push({ shape: { kind: 'ellipsoid', c: [s * 0.072, 0.675, -0.38], r: [0.058, 0.03, 0.11] }, op: 'paint', color: WHITE, bone: B.head });
  }
  out.push({ shape: { kind: 'box', c: [0, 0.6, -0.42], h: [0.026, 0.02, 0.07], round: 0.012 }, op: 'paint', color: MASK, bone: B.head });
  return out;
}

const spec: MammalSpec = {
  fur: GREY, belly: GREY_D, muzzle: WHITE, nose: BLACK,
  body: { c: [0, 0.18, -0.06], r: [0.2, 0.185, 0.23], rot: 0.3 },
  chest: { c: [0, 0.29, -0.2], r: [0.165, 0.16, 0.16] },
  head: { c: [0, 0.59, -0.32], r: [0.165, 0.15, 0.16] },
  snout: { c: [0, 0.545, -0.45], r: [0.075, 0.052, 0.075] },
  cheeks: { c: [-0.082, 0.53, -0.415], r: [0.055, 0.04, 0.048], color: WHITE },
  noseAt: [0, 0.575, -0.508], noseR: [0.026, 0.019, 0.016],
  chin: { c: [0, 0.495, -0.435], r: [0.055, 0.028, 0.048] },
  arm: [0.062, 0.058, 0.064], leg: [0.092, 0.075, 0.062, 0.056],
  hand: { r: [0.058, 0.044, 0.062], color: MASK, toes: 3 },
  foot: { r: [0.058, 0.043, 0.078], color: MASK, toes: 3, pad: 0x141519, drop: 0.01 },
  eye: { at: [-0.072, 0.612, -0.448], r: 0.042, dir: [-0.28, 0.05, -0.96], pupil: 0.023, glint: 0.4 },
  extra: mask(),
  budget: 2200,
};

const J = mammalJoints(spec, {
  hat: [0, 0.7, -0.31], ear: [-0.125, 0.69, -0.27],
  clav: [-0.07, 0.31, -0.25], shoulder: [-0.15, 0.3, -0.31], elbow: [-0.25, 0.18, -0.44], wrist: [-0.19, 0.03, -0.58],
  tail: [[0, 0.18, 0.21], [0, 0.23, 0.31]],
});

export const pedro: SpeciesDef = {
  id: 'pedro',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.16, lidTilt: 0.24,
    neckReach: 0.05, tail: 'long', earFlop: 0.05, hatWobble: 0.05, armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.5, -0.5], skin: GREY, skillPose: 'spin',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'round', w: 0.075, h: 0.07, thick: 0.024, color: GREY_D, inner: WHITE, tilt: 0.3, back: 0.25, turn: 0.35 });
    addMouth(b, [[-0.046, 0.518, -0.5], [-0.023, 0.508, -0.512], [0, 0.516, -0.516], [0.023, 0.508, -0.512], [0.046, 0.518, -0.5]], 0.005);
    addHelmet(b, { c: [0, 0.705, -0.31], r: [0.178, 0.135, 0.19], pitch: -0.18, color: MASK, stripe: 0xffcf3f,
      strap: { chin: [0, 0.49, -0.44] } });
    // Bushy ringed tail: the bands alternate grey / black along the tail.
    addTail(b, J, { kind: 'long', r: 0.052, color: GREY, stripe: MASK, tip: MASK });
  },
};
