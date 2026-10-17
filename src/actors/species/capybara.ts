// 卡皮 the capybara: brown barrel body, big boxy head with a blunt muzzle, sleepy half-closed eyes,
// tiny round ears, accent-yellow helmet with a yuzu balanced on top. Signature: CHILL ZONE.
import { addEars, addMouth } from '../kit/ears-tails';
import { addHelmet } from '../kit/gear';
import { buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import { addYuzu } from '../kit/props';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xa8754a, DARK = 0x7a5233, MUZZLE = 0x8d6040;

const spec: MammalSpec = {
  fur: FUR, belly: 0xbb8a5c, muzzle: MUZZLE, nose: 0x3a2418,
  body: { c: [0, 0.24, -0.04], r: [0.235, 0.225, 0.27], rot: 0.25 },
  chest: { c: [0, 0.4, -0.15], r: [0.19, 0.18, 0.185] },
  head: { c: [0, 0.74, -0.36], r: [0.12, 0.11, 0.14] },
  snout: { c: [0, 0.69, -0.52], r: [0.085, 0.07, 0.06] },
  noseAt: [0, 0.735, -0.588], noseR: [0.05, 0.014, 0.012],
  chin: { c: [0, 0.635, -0.5], r: [0.075, 0.035, 0.065] },
  arm: [0.072, 0.06, 0.052], leg: [0.09, 0.066, 0.056, 0.05], paw: [0.058, 0.046, 0.064], pawColor: DARK, footPaw: [0.055, 0.04, 0.075],
  eye: { at: [-0.098, 0.805, -0.465], r: 0.036, dir: [-0.38, 0.1, -0.92], pupil: 0.019 },
  extra: [
    // Boxy head: a rounded box over the ellipsoid gives the capybara's loaf-shaped skull.
    { shape: { kind: 'box', c: [0, 0.74, -0.4], h: [0.115, 0.1, 0.17], round: 0.08 }, rot: [0.12, 0, 0], color: FUR, bone: B.head, k: 0.04, sigma: 0.02 },
    { shape: { kind: 'box', c: [0, 0.69, -0.5], h: [0.098, 0.075, 0.08], round: 0.06 }, rot: [0.12, 0, 0], color: FUR, bone: B.head, k: 0.04, sigma: 0.02 },
    { shape: { kind: 'box', c: [0, 0.69, -0.565], h: [0.1, 0.08, 0.03], round: 0.02 }, rot: [0.12, 0, 0], op: 'paint', color: MUZZLE, bone: B.head },
  ],
  budget: 2500,
};

const J = mammalJoints(spec, { hat: [0, 0.858, -0.35], ear: [-0.105, 0.815, -0.29] });

export const capybara: SpeciesDef = {
  id: 'capybara',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.55,
    neckReach: 0.04, tail: 'none', armUp: [0, -0.75, 0.66], gripDrop: 0.035, ankleLift: [0, 0.06, 0.05],
    beak: [0, 0.66, -0.57], skin: FUR, skillPose: 'chill',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'round', w: 0.055, h: 0.05, thick: 0.02, color: DARK, inner: 0x5a3a24, tilt: 0.35, back: 0.4, turn: 0.4 });
    addMouth(b, [[-0.032, 0.672, -0.585], [0, 0.664, -0.592], [0.032, 0.672, -0.585]], 0.005);
    addHelmet(b, { c: [0, 0.858, -0.35], r: [0.13, 0.072, 0.155], pitch: 0.12, color: 0xffb000, stripe: 0xffffff });
    addYuzu(b, [0, 0.948, -0.36], 0.06);
  },
};
