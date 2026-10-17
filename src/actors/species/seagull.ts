// 薯条大盗 the seagull: white with grey wings and black tips, yellow bill with the red gonys spot,
// shifty half-lidded side-eye, a stolen french fry in the beak, yellow helmet. Signature: MINE!
import { buildBird, birdJoints, type BirdSpec } from '../kit/bird';
import { addHelmet } from '../kit/gear';
import { addFry } from '../kit/props';
import type { SpeciesDef } from './types';

const WHITE = 0xf4f6f8, GREY = 0x9aa4b2, YELLOW = 0xffd23f;

const spec: BirdSpec = {
  color: WHITE,
  body: { c: [0, 0.2, -0.04], r: [0.17, 0.165, 0.23], rot: 0.35 },
  chest: { c: [0, 0.34, -0.14], r: [0.145, 0.15, 0.155] },
  neckR: [0.058, 0.052, 0.05],
  head: { c: [0, 0.73, -0.32], r: [0.08, 0.08, 0.095] },
  beak: { base: [0, 0.718, -0.4], tip: [0, 0.698, -0.53], w: 0.022, h: 0.023, color: YELLOW, lower: 0xf5c518, spot: 0xe5191c },
  eye: {
    at: [-0.05, 0.75, -0.36], r: 0.032, dir: [-0.5, 0.05, -0.86], pupil: 0.014, iris: { r: 0.022, color: 0xf2c230 },
    brow: { color: 0x7a8494, len: 0.03, thick: 0.007, tilt: -0.25, lift: 0 },
  },
  wing: { tip: [-0.18, 0.03, -0.66], color: GREY, feather: 0x8a94a3, tipColor: 0x1d1d22, tipFrac: 0.5, chord: 0.17, thick: 0.02, edgeR: [0.05, 0.036, 0.024] },
  leg: { r: [0.05, 0.026, 0.019, 0.017], thigh: WHITE, shin: 0xf2c94c },
  foot: { kind: 'web', len: 0.11, width: 0.1, color: 0xf2c94c },
  tail: { c: [0, 0.19, 0.24], r: [0.08, 0.025, 0.1], color: WHITE, up: 0.2 },
  budget: 2500,
};

const J = birdJoints(spec, {
  neck: [[0, 0.47, -0.22], [0, 0.56, -0.245], [0, 0.64, -0.275]], head: [0, 0.69, -0.3],
  hat: [0, 0.79, -0.315],
});

export const seagull: SpeciesDef = {
  id: 'seagull',
  joints: J,
  meta: {
    wings: true, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.3, lookBias: 0.3,
    neckReach: 0.08, tail: 'feather', armUp: [0, -0.75, 0.66], gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.7, -0.53], skin: WHITE, skillPose: 'grab',
  },
  build(b) {
    buildBird(b, J, spec);
    addHelmet(b, { c: [0, 0.795, -0.315], r: [0.088, 0.056, 0.104], pitch: 0.15, color: YELLOW, stripe: 0xe5191c });
    addFry(b, [0.06, 0.705, -0.47], 0.14, [0.2, 0.25, 1.15]);
  },
};
