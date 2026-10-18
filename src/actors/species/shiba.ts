// 神烦狗 the shiba: chubby tan doge with fluffy cream cheeks, chest and brow dots, pointy ears out of a black
// domed helmet, tilted pixel "deal-with-it" shades on the eye line with the doge side-eye peeking over, tongue-
// out smile, cream paws, big curled tail. Signature: DOGE SHIELD.
import { addEars, addMouth, addTail } from '../kit/ears-tails';
import { addHelmet } from '../kit/gear';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import { addPixelShades } from '../kit/props';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xd9a35f, CREAM = 0xfff3e2;

const spec: MammalSpec = {
  fur: FUR, belly: CREAM, muzzle: CREAM, nose: 0x1d1d22,
  body: { c: [0, 0.18, -0.06], r: [0.2, 0.19, 0.24], rot: 0.35 },
  chest: { c: [0, 0.29, -0.22], r: [0.165, 0.16, 0.16] },
  head: { c: [0, 0.6, -0.33], r: [0.18, 0.16, 0.165] },
  snout: { c: [0, 0.55, -0.48], r: [0.07, 0.058, 0.082] },
  cheeks: { c: [-0.085, 0.545, -0.42], r: [0.082, 0.062, 0.07], color: CREAM },
  noseAt: [0, 0.583, -0.556], noseR: [0.025, 0.018, 0.016],
  chin: { c: [0, 0.505, -0.47], r: [0.05, 0.028, 0.05] },
  arm: [0.064, 0.06, 0.068], leg: [0.092, 0.074, 0.06, 0.055],
  hand: { r: [0.06, 0.045, 0.064], color: CREAM, toes: 3 },
  foot: { r: [0.06, 0.044, 0.082], color: CREAM, toes: 3, pad: 0x3a2a26, drop: 0.01 },
  eye: { at: [-0.072, 0.628, -0.462], r: 0.045, dir: [-0.26, 0.05, -0.96], pupil: 0.021, aspect: 0.86 },
  extra: [
    { shape: { kind: 'ellipsoid', c: [-0.062, 0.688, -0.46], r: [0.022, 0.015, 0.015] }, op: 'paint', color: CREAM, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [0.062, 0.688, -0.46], r: [0.022, 0.015, 0.015] }, op: 'paint', color: CREAM, bone: B.head },
    // Tongue poking out under the smile.
    { shape: { kind: 'ellipsoid', c: [0.014, 0.508, -0.512], r: [0.02, 0.008, 0.026] }, rot: [0.5, 0, 0], color: 0xff7a8a, bone: B.jaw, k: 0.004, priority: 0.02 },
  ],
  budget: 2300,
};

const J = mammalJoints(spec, {
  hat: [0, 0.69, -0.31], ear: [-0.12, 0.71, -0.29],
  // Shoulders forward/down on a hunched chest: the paws reach the bars with bent elbows (no sleeve arms).
  clav: [-0.07, 0.3, -0.26], shoulder: [-0.16, 0.29, -0.31], elbow: [-0.27, 0.17, -0.42], wrist: [-0.25, 0.05, -0.53],
  tail: [[0, 0.17, 0.2], [0, 0.22, 0.3]],
});

export const shiba: SpeciesDef = {
  id: 'shiba',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.3, lidTilt: 0.15, lookBias: 0.34,
    neckReach: 0.05, tail: 'curl', earFlop: 0.05, armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.52, -0.55], skin: FUR, skillPose: 'doge',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'pointy', w: 0.11, h: 0.12, thick: 0.024, color: FUR, inner: CREAM, tilt: 0.35, back: 0.12, turn: 0.15 });
    addMouth(b, [[-0.05, 0.535, -0.51], [-0.024, 0.522, -0.535], [0, 0.528, -0.545], [0.024, 0.522, -0.535], [0.05, 0.535, -0.51]], 0.0048);
    // On the eye line, tilted a touch: the side-eye peeks over the top bar; temples anchor them to the head.
    addPixelShades(b, [0, 0.634, -0.53], 0.21, { roll: 0.07, temple: 0.1 });
    addHelmet(b, { c: [0, 0.69, -0.31], r: [0.19, 0.15, 0.2], pitch: -0.2, color: 0x2b2b2b, stripe: FUR, strap: { chin: [0, 0.49, -0.44] } });
    addTail(b, J, { kind: 'curl', r: 0.052, color: FUR, tip: CREAM });
  },
};
