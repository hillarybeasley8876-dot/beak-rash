// 薯条大盗 the seagull: white head and body, grey folded wings with black tips and white mirrors, yellow
// bill with the red gonys spot, shifty half-lidded side-eye under grumpy brows, a stolen fry in the beak,
// yellow helmet, yellow webbed feet. Signature: MINE!
import { ARM_UP, buildBird, birdJoints, type BirdSpec } from '../kit/bird';
import { addHelmet } from '../kit/gear';
import { addFry } from '../kit/props';
import type { SpeciesDef } from './types';

const WHITE = 0xf4f6f8, GREY = 0x9aa4b2, LIGHT = 0xb8c0cc, BLACK = 0x1d1d22, YELLOW = 0xffd23f;

const spec: BirdSpec = {
  color: WHITE,
  body: { c: [0, 0.2, -0.06], r: [0.2, 0.18, 0.27], rot: 0.35 },
  chest: { c: [0, 0.32, -0.2], r: [0.16, 0.16, 0.16] },
  neckR: [0.08, 0.072, 0.068],
  head: { c: [0, 0.7, -0.38], r: [0.105, 0.105, 0.12] },
  beak: { base: [0, 0.685, -0.48], tip: [0, 0.655, -0.66], w: 0.032, h: 0.034, color: YELLOW, lower: 0xf5c518, spot: 0xe5191c },
  eye: {
    at: [-0.064, 0.722, -0.44], r: 0.042, dir: [-0.5, 0.06, -0.86], pupil: 0.016, iris: { r: 0.03, color: 0xf2c230 },
    brow: { color: 0x5a6270, len: 0.05, thick: 0.012, tilt: 0.4, lift: 0 },
  },
  wing: {
    kind: 'fold', arm: [0.062, 0.055, 0.046], color: GREY, feather: LIGHT, edge: 0x5a6270, chord: [0.05, 0.12, 0.08],
    trail: [-0.8, -0.5, 0.3], primaries: { n: 0, len: 0, w: 0, color: GREY, tip: BLACK, tipFrac: 0 },
    fist: { r: [0.048, 0.038, 0.054], color: GREY, toes: 3, curl: true, toeR: 0.018, budget: 170 },
  },
  flank: {
    root: [-0.18, 0.32, -0.24], tip: [-0.08, 0.28, 0.4], width: 0.15, breaks: [0.64, 0.66, 0.86, 0.92],
    paint: (u, q) => (u > 0.65 ? (u > 0.86 && u < 0.92 && q > 0.4 ? WHITE : BLACK) : q < 0.24 ? WHITE : u < 0.3 && q > 0.58 ? LIGHT : GREY),
  },
  leg: { r: [0.078, 0.045, 0.036, 0.032], thigh: WHITE, shin: 0xf2c94c },
  foot: { kind: 'web', len: 0.14, width: 0.13, color: 0xf2c94c },
  tail: { c: [0, 0.22, 0.28], r: [0.09, 0.028, 0.12], color: GREY, up: 0.2 },
  budget: 2100,
};

const J = birdJoints(spec, {
  neck: [[0, 0.44, -0.29], [0, 0.52, -0.3], [0, 0.6, -0.33]], head: [0, 0.64, -0.35],
  hat: [0, 0.762, -0.37],
  clav: [-0.08, 0.34, -0.22], shoulder: [-0.16, 0.34, -0.25], elbow: [-0.25, 0.21, -0.36], wrist: [-0.19, 0.09, -0.5],
  tail: [[0, 0.21, 0.19], [0, 0.22, 0.3]],
});

export const seagull: SpeciesDef = {
  id: 'seagull',
  joints: J,
  meta: {
    wings: true, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.42, lidTilt: 0.3, lookBias: 0.3,
    neckReach: 0.08, tail: 'feather', armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.655, -0.66], skin: WHITE, skillPose: 'grab',
  },
  build(b) {
    buildBird(b, J, spec);
    addHelmet(b, { c: [0, 0.762, -0.37], r: [0.123, 0.105, 0.143], pitch: -0.3, color: YELLOW, stripe: 0x1d1d22, strap: { chin: [0, 0.645, -0.43] } });
    addFry(b, [0.075, 0.67, -0.54], 0.16, [0.2, 0.25, 1.15]);
  },
};
