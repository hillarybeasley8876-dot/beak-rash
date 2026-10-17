// 柯基警官 the corgi police officer: orange & white, HUGE ears, legs too short for the pedals (never
// stretched — the feet paddle the air), police cap, blue vest with reflective bands, whistle in mouth.
import { addEars, addTail } from '../kit/ears-tails';
import { buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import { addPoliceCap, addWhistle } from '../kit/props';
import type { Prim } from '../kit/sdf';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xe89a4f, WHITE = 0xffffff, VEST = 0x1f4fd1, REFLECT = 0xd9ff3a;

function vest(): Prim[] {
  return [
    { shape: { kind: 'ellipsoid', c: [0, 0.3, -0.09], r: [0.23, 0.15, 0.26] }, op: 'paint', color: VEST, bone: B.spine },
    { shape: { kind: 'box', c: [0, 0.3, -0.1], h: [0.3, 0.022, 0.32], round: 0.005 }, rot: [0.25, 0, 0], op: 'paint', color: REFLECT, bone: B.spine },
    // White blaze down the forehead.
    { shape: { kind: 'box', c: [0, 0.75, -0.44], h: [0.022, 0.06, 0.06], round: 0.01 }, rot: [-0.5, 0, 0], op: 'paint', color: WHITE, bone: B.head },
  ];
}

const spec: MammalSpec = {
  fur: FUR, belly: WHITE, muzzle: WHITE, nose: 0x1d1d22,
  body: { c: [0, 0.21, -0.02], r: [0.17, 0.16, 0.24], rot: 0.22 },
  chest: { c: [0, 0.35, -0.14], r: [0.15, 0.14, 0.15] },
  head: { c: [0, 0.7, -0.34], r: [0.14, 0.125, 0.13] },
  snout: { c: [0, 0.655, -0.46], r: [0.066, 0.052, 0.082] },
  cheeks: { c: [-0.07, 0.65, -0.41], r: [0.064, 0.05, 0.06], color: WHITE },
  noseAt: [0, 0.678, -0.545], noseR: [0.022, 0.016, 0.014],
  chin: { c: [0, 0.613, -0.47], r: [0.045, 0.024, 0.05] },
  arm: [0.056, 0.048, 0.042], leg: [0.066, 0.056, 0.05, 0.046], paw: [0.048, 0.04, 0.054], pawColor: WHITE, footPaw: [0.045, 0.034, 0.06],
  eye: { at: [-0.062, 0.728, -0.44], r: 0.038, dir: [-0.28, 0.06, -0.96], pupil: 0.019 },
  extra: vest(),
  budget: 2500,
};

const J = mammalJoints(spec, {
  hat: [0, 0.82, -0.33], ear: [-0.075, 0.8, -0.3],
  hip: [-0.1, 0.09, -0.04], knee: [-0.12, 0.03, -0.2], ankle: [-0.12, -0.12, -0.2], toe: [-0.12, -0.15, -0.26],
  tail: [[0, 0.16, 0.2], [0, 0.18, 0.26]],
});

export const corgi: SpeciesDef = {
  id: 'corgi',
  joints: J,
  meta: {
    wings: false, shortLegs: true, hat: 'cap', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0,
    neckReach: 0.05, tail: 'stub', armUp: [0, -0.75, 0.66], gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.64, -0.55], skin: FUR, skillPose: 'whistle',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'pointy', w: 0.12, h: 0.17, thick: 0.024, color: FUR, inner: 0xffd9c0, tilt: 0.32, back: 0.08, turn: 0.12 });
    addPoliceCap(b, [0, 0.82, -0.33], 0.1, 0.12);
    addWhistle(b, [0, 0.636, -0.555]);
    addTail(b, J, { kind: 'stub', r: 0.035, color: FUR });
  },
};
