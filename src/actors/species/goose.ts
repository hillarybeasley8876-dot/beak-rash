// 鹅霸 the goose: big plump white body, the famous long upright neck, chunky head with permanently ANGRY
// brows and slanted lids, orange bill with a black nail and the Chinese goose's knob, black bandana with
// flapping tails, folded white wings, orange webbed feet. Signature: HONK.
import { ARM_UP, buildBird, birdJoints, type BirdSpec } from '../kit/bird';
import { addBandana } from '../kit/props';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const WHITE = 0xf8f6f0, ORANGE = 0xff8a00, SHADE = 0xe4e8ee, EDGE = 0xcfd5de;

const spec: BirdSpec = {
  color: WHITE,
  body: { c: [0, 0.2, -0.04], r: [0.22, 0.2, 0.28], rot: 0.3 },
  chest: { c: [0, 0.33, -0.17], r: [0.17, 0.17, 0.17] },
  neckR: [0.074, 0.064, 0.06],
  head: { c: [0, 0.92, -0.33], r: [0.1, 0.1, 0.12] },
  beak: { base: [0, 0.905, -0.43], tip: [0, 0.88, -0.6], w: 0.044, h: 0.042, color: ORANGE, lower: 0xf07a00, nail: 0x1d1d22 },
  eye: {
    at: [-0.066, 0.94, -0.395], r: 0.043, dir: [-0.5, 0.08, -0.86], pupil: 0.02,
    brow: { color: 0x1d1d22, len: 0.062, thick: 0.017, tilt: 0.72, lift: 0 },
  },
  wing: {
    kind: 'fold', arm: [0.062, 0.055, 0.046], color: WHITE, feather: SHADE, edge: EDGE, chord: [0.05, 0.11, 0.07],
    trail: [-0.8, -0.5, 0.3], primaries: { n: 0, len: 0, w: 0, color: WHITE, tip: EDGE, tipFrac: 0 },
    fan: { n: 5, len: 0.24, w: 0.05, color: WHITE, tip: SHADE, tipFrac: 0.45, droop: 0.2, spread: 0.32, seg: 2 },
    fist: { r: [0.048, 0.038, 0.054], color: WHITE, toes: 3, curl: true, toeR: 0.018, budget: 170 },
  },
  flank: {
    root: [-0.18, 0.33, -0.2], tip: [-0.09, 0.3, 0.38], width: 0.15, breaks: [0.65, 0.67],
    paint: (u, q) => (u > 0.66 ? 0xc4cad4 : q < 0.24 ? EDGE : u < 0.3 && q > 0.58 ? WHITE : SHADE),
  },
  leg: { r: [0.085, 0.05, 0.042, 0.038], thigh: WHITE, shin: ORANGE },
  foot: { kind: 'web', len: 0.15, width: 0.14, color: ORANGE },
  tail: { c: [0, 0.28, 0.27], r: [0.09, 0.05, 0.11], color: WHITE, up: 0.6 },
  extra: [
    // The Chinese goose's knob at the bill base.
    { shape: { kind: 'ellipsoid', c: [0, 0.945, -0.432], r: [0.026, 0.024, 0.026] }, color: ORANGE, bone: B.head, k: 0.015, priority: 0.006 },
  ],
};

const J = birdJoints(spec, {
  neck: [[0, 0.5, -0.25], [0, 0.66, -0.25], [0, 0.8, -0.27]], head: [0, 0.86, -0.29], brow: [-0.064, 0.974, -0.418],
  clav: [-0.08, 0.36, -0.19], shoulder: [-0.16, 0.36, -0.22], elbow: [-0.25, 0.27, -0.27], wrist: [-0.23, 0.15, -0.37],
  tail: [[0, 0.24, 0.2], [0, 0.28, 0.3]],
});

export const goose: SpeciesDef = {
  id: 'goose',
  joints: J,
  meta: {
    wings: true, hat: 'bandana', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.3, lidTilt: 0.42,
    neckReach: 0.12, tail: 'feather', armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.88, -0.61], skin: WHITE, skillPose: 'honk',
  },
  build(b) {
    buildBird(b, J, spec);
    addBandana(b, [0, 1.0, -0.325], [0.076, 0.1, 0.09], 0x1d1d22, 0.12);
  },
};
