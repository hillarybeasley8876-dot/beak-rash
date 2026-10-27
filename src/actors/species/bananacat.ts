// 香蕉猫 the banana cat: a small white-grey cat wearing a peeled banana as a hood — a yellow peel ring framing
// the face, the peel's flaps hanging down over the shoulders, the brown stalk on top. Big glossy wet eyes with
// tear streaks, mouth open in a wail. Signature: BANANA PEEL (the hood is the costume, so no helmet).
import { addEars, addMouth } from '../kit/ears-tails';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import type { Prim, V3 } from '../kit/sdf';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xdde2e8, CREAM = 0xf7f9fb, PINK = 0xff9fb0;
const BANANA = 0xffd84a, TIP = 0x6b4a1e, TEAR = 0x9ad9ff;

/** The peeled banana: a cap over the skull, a ring around the face, the stalk on top and three peel flaps
 *  hanging down over the shoulders and the back. Nothing hangs in front of the face. */
function hood(): Prim[] {
  const out: Prim[] = [
    { shape: { kind: 'ellipsoid', c: [0, 0.695, -0.295], r: [0.14, 0.093, 0.155] }, color: BANANA, bone: B.head, k: 0.035, sigma: 0.03 },
    { shape: { kind: 'torus', c: [0, 0.6, -0.315], R: 0.15, r: 0.044 }, rot: [Math.PI / 2, 0, 0], color: BANANA, bone: B.head, k: 0.03, sigma: 0.03 },
    { shape: { kind: 'capsule', a: [0, 0.74, -0.295], b: [0, 0.812, -0.288], r: 0.026, r2: 0.015 }, color: TIP, bone: B.head, k: 0.012, sigma: 0.02 },
  ];
  // Peel flaps (a → b): the two over the shoulders and the one down the back. Each is one smooth strip —
  // the darker inner peel is a paint band on the strip's own axis, never a second shape beside it.
  const flaps: Array<[V3, V3, number, number]> = [
    [[-0.15, 0.55, -0.30], [-0.235, 0.29, -0.02], 0.05, 0.026],
    [[0.15, 0.55, -0.30], [0.235, 0.29, -0.02], 0.05, 0.026],
    [[0, 0.575, -0.175], [0, 0.30, 0.10], 0.055, 0.028],
  ];
  for (const [a, b, r, r2] of flaps) {
    out.push({ shape: { kind: 'capsule', a, b, r, r2 }, color: BANANA, bone: B.head, k: 0.03, sigma: 0.035 });
  }
  return out;
}

const spec: MammalSpec = {
  fur: FUR, belly: CREAM, muzzle: CREAM, nose: 0xff8fa0,
  body: { c: [0, 0.17, -0.06], r: [0.185, 0.17, 0.215], rot: 0.35 },
  chest: { c: [0, 0.28, -0.21], r: [0.155, 0.15, 0.15] },
  head: { c: [0, 0.58, -0.31], r: [0.155, 0.145, 0.15] },
  snout: { c: [0, 0.535, -0.44], r: [0.07, 0.05, 0.05] },
  cheeks: { c: [-0.058, 0.512, -0.41], r: [0.05, 0.04, 0.045], color: CREAM },
  noseAt: [0, 0.566, -0.478], noseR: [0.019, 0.013, 0.011],
  chin: { c: [0, 0.492, -0.42], r: [0.05, 0.026, 0.042] },
  arm: [0.058, 0.054, 0.06], leg: [0.085, 0.07, 0.058, 0.052],
  hand: { r: [0.055, 0.042, 0.058], color: CREAM, toes: 3 },
  foot: { r: [0.055, 0.04, 0.075], color: CREAM, toes: 3, pad: PINK, drop: 0.01 },
  eye: { at: [-0.066, 0.592, -0.44], r: 0.055, dir: [-0.3, 0.06, -0.95], pupil: 0.029, glint: 0.46,
    iris: { r: 0.042, color: 0x5f86b8 }, ring: { w: 0.007, color: 0x1c2130 } },
  extra: [
    ...hood(),
    // Tear streaks running down from the eyes (raised, so they catch the light).
    { shape: { kind: 'ellipsoid', c: [-0.105, 0.545, -0.425], r: [0.011, 0.035, 0.011] }, rot: [0, 0, 0.2], color: TEAR, bone: B.head, k: 0.005, sigma: 0.012, priority: 0.02 },
    { shape: { kind: 'ellipsoid', c: [0.105, 0.545, -0.425], r: [0.011, 0.035, 0.011] }, rot: [0, 0, -0.2], color: TEAR, bone: B.head, k: 0.005, sigma: 0.012, priority: 0.02 },
    // Wailing open mouth (a dark gape with a small tongue).
    { shape: { kind: 'ellipsoid', c: [0, 0.5, -0.447], r: [0.042, 0.028, 0.018] }, color: 0x541a20, bone: B.jaw, k: 0.008, priority: 0.02 },
    { shape: { kind: 'ellipsoid', c: [0, 0.487, -0.44], r: [0.022, 0.012, 0.012] }, color: 0xff8fa0, bone: B.jaw, k: 0.005, priority: 0.03 },
  ],
  budget: 2300,
};

const J = mammalJoints(spec, {
  hat: [0, 0.7, -0.3], ear: [-0.15, 0.665, -0.27],
  // Shoulders forward/down on a hunched chest: the paws reach the bars with bent elbows.
  clav: [-0.07, 0.3, -0.25], shoulder: [-0.15, 0.29, -0.3], elbow: [-0.24, 0.17, -0.43], wrist: [-0.19, 0.02, -0.57],
  tail: [[0, 0.17, 0.19], [0, 0.22, 0.29]],
});

export const bananacat: SpeciesDef = {
  id: 'bananacat',
  joints: J,
  meta: {
    wings: false, hat: 'none', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.18, lidTilt: -0.12,
    neckReach: 0.05, tail: 'long', earFlop: 0.05, hatWobble: 0.04, armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.5, -0.47], skin: FUR, skillPose: 'grab',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'pointy', w: 0.11, h: 0.12, thick: 0.022, color: FUR, inner: PINK, tilt: 0.5, back: 0.12, turn: 0.22 });
    // Wail: the mouth corners fall away from the nose.
    addMouth(b, [[-0.04, 0.512, -0.468], [-0.02, 0.5, -0.478], [0, 0.494, -0.481], [0.02, 0.5, -0.478], [0.04, 0.512, -0.468]], 0.0045);
  },
};
