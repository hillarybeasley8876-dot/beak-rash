// 弹跳猪 the pygmy hippo calf: a glossy dark grey barrel body with a pink belly, pink cheeks and a wide pink
// mouth, nostrils on top of the broad muzzle, tiny eyes, small round ears and a painted shine stripe down the
// back. Chubby short legs. Signature: BOUNCE SLAM.
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
    // Nostrils: two dark dots sitting on the front-top of the muzzle.
    { shape: { kind: 'ellipsoid', c: [-0.05, 0.598, -0.505], r: [0.025, 0.016, 0.026] }, rot: [-0.25, 0, 0], color: 0x3a3038, bone: B.head, k: 0.006, sigma: 0.012 },
    { shape: { kind: 'ellipsoid', c: [0.05, 0.598, -0.505], r: [0.025, 0.016, 0.026] }, rot: [-0.25, 0, 0], color: 0x3a3038, bone: B.head, k: 0.006, sigma: 0.012 },
    // Pink mouth: a wide painted band across the front of the muzzle.
    { shape: { kind: 'ellipsoid', c: [0, 0.458, -0.545], r: [0.1, 0.045, 0.03] }, op: 'paint', color: PINK, bone: B.head },
    // Painted shine stripe down the back and over the muzzle (the wet-look highlight).
    { shape: { kind: 'ellipsoid', c: [0, 0.368, 0.072], r: [0.06, 0.035, 0.06] }, op: 'paint', color: SHINE, bone: B.spine },
    { shape: { kind: 'ellipsoid', c: [0, 0.585, -0.45], r: [0.055, 0.025, 0.07] }, op: 'paint', color: SHINE, bone: B.head },
  ];
  return out;
}

const spec: MammalSpec = {
  fur: GREY, belly: PINK, muzzle: GREY_D, nose: 0x3a3038,
  body: { c: [0, 0.19, -0.05], r: [0.235, 0.215, 0.25], rot: 0.2 },
  chest: { c: [0, 0.33, -0.16], r: [0.2, 0.185, 0.19] },
  head: { c: [0, 0.58, -0.3], r: [0.2, 0.17, 0.2] },
  snout: { c: [0, 0.5, -0.47], r: [0.15, 0.11, 0.1] },
  cheeks: { c: [-0.125, 0.53, -0.42], r: [0.055, 0.05, 0.05], color: PINK },
  bellyPatch: { c: [0, 0.21, -0.28], r: [0.14, 0.15, 0.05] },
  noseAt: [0, 0.55, -0.55], noseR: [0.032, 0.022, 0.017],
  chin: { c: [0, 0.45, -0.45], r: [0.1, 0.032, 0.06] },
  arm: [0.075, 0.068, 0.062], leg: [0.105, 0.09, 0.075, 0.068],
  hand: { r: [0.062, 0.048, 0.064], color: GREY_D, toes: 3 },
  foot: { r: [0.066, 0.048, 0.086], color: GREY_D, toes: 3, pad: PINK, drop: 0.01 },
  // Tiny eyes high on the sides of the head.
  eye: { at: [-0.118, 0.628, -0.435], r: 0.038, dir: [-0.42, 0.1, -0.9], pupil: 0.019, glint: 0.4 },
  extra: face(),
  budget: 2500,
};

const J = mammalJoints(spec, {
  hat: [0, 0.755, -0.29], ear: [-0.165, 0.7, -0.2],
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
    beak: [0, 0.46, -0.53], skin: GREY, skillPose: 'flash',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'round', w: 0.055, h: 0.05, thick: 0.02, color: GREY_D, inner: 0x8a6f78, tilt: 0.3, back: 0.35, turn: 0.35 });
    addMouth(b, [[-0.06, 0.505, -0.555], [-0.03, 0.492, -0.563], [0, 0.488, -0.565], [0.03, 0.492, -0.563], [0.06, 0.505, -0.555]], 0.007);
    addHelmet(b, { c: [0, 0.765, -0.29], r: [0.2, 0.135, 0.215], pitch: -0.14, color: 0x4b5560, stripe: SHINE, round: true,
      strap: { chin: [0, 0.48, -0.43] } });
  },
};
