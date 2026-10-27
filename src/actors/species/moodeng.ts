// 弹跳猪 the pygmy hippo calf: a glossy dark grey barrel body with a pink belly, pink cheeks and a wide pink
// mouth, a boxy muzzle that is the widest part of the head with the nostrils as bumps on top of it, tiny eyes,
// tiny round ears and a painted shine stripe down the back. A white helmet seated on the skull. Signature:
// BOUNCE SLAM.
import { addEars, addMouth } from '../kit/ears-tails';
import { addHelmet } from '../kit/gear';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import type { Prim } from '../kit/sdf';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const GREY = 0x6f7a8c, GREY_D = 0x59636f, PINK = 0xf2a7b5, SHINE = 0xd7e2ee;

/** Pink cheeks, the wide pink mouth, the nostrils on top of the muzzle and the painted shine stripe. */
function face(): Prim[] {
  const out: Prim[] = [
    // Nostrils: two dark bumps on the front-top of the muzzle.
    { shape: { kind: 'ellipsoid', c: [-0.05, 0.506, -0.498], r: [0.024, 0.015, 0.024] }, rot: [-0.25, 0, 0], color: 0x3a3038, bone: B.head, k: 0.006, sigma: 0.012 },
    { shape: { kind: 'ellipsoid', c: [0.05, 0.506, -0.498], r: [0.024, 0.015, 0.024] }, rot: [-0.25, 0, 0], color: 0x3a3038, bone: B.head, k: 0.006, sigma: 0.012 },
    // Pink mouth: a wide painted smile across the front of the muzzle.
    { shape: { kind: 'ellipsoid', c: [0, 0.432, -0.55], r: [0.12, 0.04, 0.032] }, op: 'paint', color: PINK, bone: B.head },
    // Painted shine stripe down the back and over the muzzle (the wet-look highlight).
    { shape: { kind: 'ellipsoid', c: [0, 0.368, 0.072], r: [0.06, 0.035, 0.06] }, op: 'paint', color: SHINE, bone: B.spine },
    { shape: { kind: 'ellipsoid', c: [0, 0.517, -0.45], r: [0.055, 0.022, 0.06] }, op: 'paint', color: SHINE, bone: B.head },
  ];
  return out;
}

const spec: MammalSpec = {
  fur: GREY, belly: PINK, muzzle: GREY_D, nose: 0x3a3038,
  body: { c: [0, 0.19, -0.05], r: [0.235, 0.215, 0.25], rot: 0.2 },
  chest: { c: [0, 0.33, -0.16], r: [0.2, 0.185, 0.19] },
  // A narrow, boxy skull (kept small, so the white helmet shell encloses it) ...
  head: { c: [0, 0.575, -0.3], r: [0.145, 0.145, 0.165] },
  // ... and a low, boxy muzzle, wider than the skull (rounded boxes, like the capybara's loaf head).
  snout: { c: [0, 0.43, -0.45], r: [0.175, 0.08, 0.095] },
  // The pink cheeks sit below and behind the eyes, so they never bury them.
  cheeks: { c: [-0.148, 0.47, -0.35], r: [0.042, 0.045, 0.042], color: PINK },
  bellyPatch: { c: [0, 0.21, -0.28], r: [0.14, 0.15, 0.05] },
  noseAt: [0, 0.505, -0.545], noseR: [0.03, 0.02, 0.016],
  chin: { c: [0, 0.4, -0.44], r: [0.09, 0.028, 0.05] },
  arm: [0.075, 0.068, 0.062], leg: [0.105, 0.09, 0.075, 0.068],
  hand: { r: [0.062, 0.048, 0.064], color: GREY_D, toes: 3 },
  foot: { r: [0.066, 0.048, 0.086], color: GREY_D, toes: 3, pad: PINK, drop: 0.01 },
  // Small eyes high on the skull, above the muzzle and under the helmet's rim, bulging out so they read.
  eye: { at: [-0.125, 0.525, -0.385], r: 0.04, dir: [-0.3, 0.12, -0.95], pupil: 0.019, glint: 0.4 },
  extra: [
    ...face(),
    // Boxy skull and a squared-off muzzle: the rounded boxes are the hippo's blocky head. The skull box stays
    // well inside the helmet's shell, so no grey pokes through the white.
    { shape: { kind: 'box', c: [0, 0.565, -0.31], h: [0.1, 0.105, 0.14], round: 0.035 }, rot: [0.06, 0, 0], color: GREY, bone: B.head, k: 0.05, sigma: 0.02 },
    { shape: { kind: 'box', c: [0, 0.43, -0.475], h: [0.175, 0.075, 0.09], round: 0.05 }, rot: [0.05, 0, 0], color: GREY_D, bone: B.head, k: 0.045, sigma: 0.02 },
  ],
  budget: 3200,
  cell: 0.014,
};

const J = mammalJoints(spec, {
  hat: [0, 0.625, -0.31], ear: [-0.115, 0.68, -0.22],
  clav: [-0.08, 0.35, -0.16], shoulder: [-0.16, 0.35, -0.21], elbow: [-0.26, 0.25, -0.32], wrist: [-0.22, 0.13, -0.42],
  hip: [-0.12, 0.08, -0.03], knee: [-0.15, 0.03, -0.31], ankle: [-0.15, -0.26, -0.26], toe: [-0.15, -0.3, -0.38],
  tail: [[0, 0.18, 0.22], [0, 0.21, 0.3]],
});

export const moodeng: SpeciesDef = {
  id: 'moodeng',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.2, lidTilt: 0.18,
    neckReach: 0.04, tail: 'stub', earFlop: 0.08, hatWobble: 0.05, armUp: ARM_UP, gripDrop: 0.035, ankleLift: [0, 0.06, 0.05],
    beak: [0, 0.45, -0.54], skin: GREY, skillPose: 'flash',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'round', w: 0.045, h: 0.04, thick: 0.018, color: GREY_D, inner: 0x8a6f78, tilt: 0.3, back: 0.35, turn: 0.35 });
    addMouth(b, [[-0.065, 0.44, -0.545], [-0.033, 0.43, -0.552], [0, 0.426, -0.554], [0.033, 0.43, -0.552], [0.065, 0.44, -0.545]], 0.007);
    // A white helmet seated right down on the skull (its rim is buried in the head, so no sky shows between
    // the rim and the skull from any side), with a pink stripe and a soft pink rim.
    addHelmet(b, { c: [0, 0.625, -0.31], r: [0.161, 0.185, 0.204], pitch: -0.12, color: 0xffffff, stripe: PINK,
      vent: 0xe9b7c2, round: true, detail: 1 });
  },
};
