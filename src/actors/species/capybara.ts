// 卡皮 the capybara: brown barrel body, HUGE boxy head with a blunt muzzle and a big dark nose, zen half-closed
// eyes, tiny round ears, yellow domed helmet with a chin strap and a yuzu balanced on top, dark paws.
// Signature: CHILL ZONE.
import { addEars, addMouth } from '../kit/ears-tails';
import { addHelmet } from '../kit/gear';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import { addYuzu } from '../kit/props';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xa8754a, DARK = 0x6e4a2e, MUZZLE = 0x8f6342, BELLY = 0xbb8a5c;

const spec: MammalSpec = {
  fur: FUR, belly: BELLY, muzzle: MUZZLE, nose: 0x3a2418,
  body: { c: [0, 0.2, -0.04], r: [0.25, 0.23, 0.27], rot: 0.2 },
  chest: { c: [0, 0.36, -0.13], r: [0.21, 0.19, 0.19] },
  head: { c: [0, 0.63, -0.3], r: [0.16, 0.15, 0.17] },
  snout: { c: [0, 0.59, -0.49], r: [0.12, 0.09, 0.075] },
  noseAt: [0, 0.632, -0.567], noseR: [0.07, 0.024, 0.018],
  chin: { c: [0, 0.52, -0.48], r: [0.09, 0.036, 0.07] },
  arm: [0.08, 0.072, 0.066], leg: [0.1, 0.082, 0.07, 0.064],
  hand: { r: [0.062, 0.048, 0.066], color: DARK, toes: 3, toeColor: 0x4a3020 },
  foot: { r: [0.066, 0.046, 0.086], color: DARK, toes: 3, toeColor: 0x4a3020, drop: 0.01 },
  eye: { at: [-0.104, 0.712, -0.47], r: 0.047, dir: [-0.36, -0.06, -0.93], pupil: 0.028 },
  extra: [
    // Boxy head: rounded boxes over the ellipsoid give the capybara's loaf-shaped skull and blunt muzzle.
    { shape: { kind: 'box', c: [0, 0.63, -0.34], h: [0.15, 0.135, 0.2], round: 0.1 }, rot: [0.08, 0, 0], color: FUR, bone: B.head, k: 0.05, sigma: 0.02 },
    { shape: { kind: 'box', c: [0, 0.585, -0.47], h: [0.13, 0.1, 0.09], round: 0.07 }, rot: [0.1, 0, 0], color: FUR, bone: B.head, k: 0.05, sigma: 0.02 },
    { shape: { kind: 'box', c: [0, 0.59, -0.55], h: [0.135, 0.105, 0.035], round: 0.03 }, rot: [0.1, 0, 0], op: 'paint', color: MUZZLE, bone: B.head },
  ],
  budget: 2400,
};

const J = mammalJoints(spec, {
  hat: [0, 0.785, -0.29], ear: [-0.135, 0.75, -0.24],
  clav: [-0.08, 0.36, -0.17], shoulder: [-0.17, 0.36, -0.2], elbow: [-0.27, 0.27, -0.29], wrist: [-0.23, 0.16, -0.38],
  hip: [-0.11, 0.08, -0.03], knee: [-0.14, 0.03, -0.32], ankle: [-0.14, -0.27, -0.27], toe: [-0.14, -0.31, -0.39],
});

export const capybara: SpeciesDef = {
  id: 'capybara',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.5, lidTilt: -0.1,
    neckReach: 0.04, tail: 'none', armUp: ARM_UP, gripDrop: 0.035, ankleLift: [0, 0.06, 0.05],
    beak: [0, 0.55, -0.58], skin: FUR, skillPose: 'chill',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'round', w: 0.06, h: 0.055, thick: 0.022, color: DARK, inner: 0x5a3a24, tilt: 0.35, back: 0.4, turn: 0.4 });
    addMouth(b, [[-0.034, 0.566, -0.573], [-0.012, 0.56, -0.58], [0, 0.566, -0.582], [0.012, 0.56, -0.58], [0.034, 0.566, -0.573]], 0.0055);
    addHelmet(b, { c: [0, 0.785, -0.29], r: [0.168, 0.12, 0.2], pitch: -0.12, color: 0xffb000, stripe: 0xffffff, strap: { chin: [0, 0.5, -0.45] } });
    addYuzu(b, [0, 0.92, -0.29], 0.066);
  },
};
