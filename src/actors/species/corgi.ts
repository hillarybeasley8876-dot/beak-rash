// 柯基警官 the corgi police officer: orange & white, HUGE ears, stern brows over white brow spots, police cap
// with a gold badge, blue vest with a reflective band and star badge, whistle in the mouth, white mitten paws,
// legs too short for the pedals (never stretched — the little feet paddle the air). Signature: WHISTLE.
import { addEars, addTail } from '../kit/ears-tails';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import { addPoliceCap, addWhistle } from '../kit/props';
import type { Prim } from '../kit/sdf';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xe8913f, WHITE = 0xffffff, VEST = 0x1f4fd1, REFLECT = 0xd9ff3a, GOLD = 0xffd23f;

function markings(): Prim[] {
  return [
    { shape: { kind: 'ellipsoid', c: [0, 0.26, -0.12], r: [0.24, 0.17, 0.28] }, op: 'paint', color: VEST, bone: B.spine },
    { shape: { kind: 'box', c: [0, 0.24, -0.12], h: [0.3, 0.022, 0.34], round: 0.005 }, rot: [0.3, 0, 0], op: 'paint', color: REFLECT, bone: B.spine },
    { shape: { kind: 'ellipsoid', c: [0.07, 0.33, -0.33], r: [0.03, 0.03, 0.03] }, op: 'paint', color: GOLD, bone: B.chest },
    // White blaze down the forehead and white brow spots.
    { shape: { kind: 'box', c: [0, 0.64, -0.48], h: [0.024, 0.07, 0.06], round: 0.012 }, rot: [-0.5, 0, 0], op: 'paint', color: WHITE, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [-0.07, 0.676, -0.462], r: [0.024, 0.014, 0.016] }, op: 'paint', color: WHITE, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [0.07, 0.676, -0.462], r: [0.024, 0.014, 0.016] }, op: 'paint', color: WHITE, bone: B.head },
  ];
}

const spec: MammalSpec = {
  fur: FUR, belly: WHITE, muzzle: WHITE, nose: 0x1d1d22,
  body: { c: [0, 0.17, -0.05], r: [0.2, 0.18, 0.26], rot: 0.25 },
  chest: { c: [0, 0.3, -0.17], r: [0.165, 0.16, 0.16] },
  head: { c: [0, 0.6, -0.33], r: [0.175, 0.155, 0.165] },
  snout: { c: [0, 0.54, -0.48], r: [0.07, 0.056, 0.085] },
  cheeks: { c: [-0.08, 0.54, -0.42], r: [0.076, 0.058, 0.068], color: WHITE },
  blush: { c: [-0.118, 0.56, -0.415], r: [0.03, 0.018, 0.02], color: 0xffa3a3 },
  noseAt: [0, 0.576, -0.562], noseR: [0.025, 0.018, 0.016],
  chin: { c: [0, 0.5, -0.47], r: [0.05, 0.026, 0.05] },
  arm: [0.07, 0.062, 0.058], leg: [0.09, 0.075, 0.065, 0.06],
  hand: { r: [0.06, 0.045, 0.064], color: WHITE, toes: 3 },
  foot: { r: [0.058, 0.044, 0.078], color: WHITE, toes: 3, pad: 0x3a2a26, drop: 0.01 },
  eye: { at: [-0.072, 0.622, -0.46], r: 0.045, dir: [-0.28, 0.06, -0.96], pupil: 0.022, brow: { color: 0x6b3610, len: 0.046, thick: 0.011, tilt: 0.5, lift: 0 } },
  extra: markings(),
  budget: 2200,
};

const J = mammalJoints(spec, {
  hat: [0, 0.74, -0.33], ear: [-0.1, 0.72, -0.28], brow: [-0.07, 0.676, -0.47],
  shoulder: [-0.15, 0.33, -0.25], elbow: [-0.26, 0.21, -0.36], wrist: [-0.25, 0.1, -0.46],
  hip: [-0.1, 0.08, -0.04], knee: [-0.12, 0.02, -0.2], ankle: [-0.12, -0.13, -0.18], toe: [-0.12, -0.16, -0.26],
  tail: [[0, 0.17, 0.22], [0, 0.19, 0.28]],
});

export const corgi: SpeciesDef = {
  id: 'corgi',
  joints: J,
  meta: {
    wings: false, shortLegs: true, hat: 'cap', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.24, lidTilt: 0.3,
    neckReach: 0.05, tail: 'stub', armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.52, -0.56], skin: FUR, skillPose: 'whistle',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'pointy', w: 0.15, h: 0.22, thick: 0.026, color: FUR, inner: 0xffd9c0, tilt: 0.35, back: 0.1, turn: 0.15 });
    addPoliceCap(b, [0, 0.74, -0.33], 0.13, 0.1);
    addWhistle(b, [0, 0.522, -0.55]);
    addTail(b, J, { kind: 'stub', r: 0.045, color: FUR });
  },
};
