// 鹅霸 the goose: white, long upright neck, orange bill with a black nail and the Chinese goose's knob,
// permanently ANGRY brows, red bandana instead of a helmet, orange webbed feet. Signature: HONK.
import { buildBird, birdJoints, type BirdSpec } from '../kit/bird';
import { addBandana } from '../kit/props';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const WHITE = 0xf7f5ef, ORANGE = 0xff8a00;

const spec: BirdSpec = {
  color: WHITE,
  body: { c: [0, 0.21, -0.04], r: [0.19, 0.18, 0.25], rot: 0.35 },
  chest: { c: [0, 0.36, -0.15], r: [0.155, 0.16, 0.165] },
  neckR: [0.058, 0.05, 0.047],
  head: { c: [0, 0.895, -0.3], r: [0.075, 0.074, 0.09] },
  beak: { base: [0, 0.882, -0.37], tip: [0, 0.862, -0.505], w: 0.032, h: 0.032, color: ORANGE, lower: 0xf07a00, nail: 0x1d1d22 },
  eye: { at: [-0.052, 0.912, -0.338], r: 0.034, dir: [-0.5, 0.06, -0.86], pupil: 0.017, brow: { color: 0x1d1d22, len: 0.044, thick: 0.011, tilt: 0.62, lift: 0 } },
  wing: { tip: [-0.19, 0.03, -0.68], color: WHITE, feather: 0xe3e7ee, tipColor: 0xc4cad4, tipFrac: 0.35, chord: 0.17, thick: 0.02, edgeR: [0.05, 0.036, 0.024] },
  leg: { r: [0.055, 0.03, 0.022, 0.02], thigh: WHITE, shin: ORANGE },
  foot: { kind: 'web', len: 0.12, width: 0.11, color: ORANGE },
  tail: { c: [0, 0.24, 0.23], r: [0.08, 0.04, 0.09], color: WHITE, up: 0.55 },
  extra: [
    // The Chinese goose's knob at the bill base.
    { shape: { kind: 'ellipsoid', c: [0, 0.912, -0.372], r: [0.022, 0.02, 0.022] }, color: ORANGE, bone: B.head, k: 0.015, priority: 0.006 },
  ],
};

const J = birdJoints(spec, {
  neck: [[0, 0.5, -0.24], [0, 0.64, -0.25], [0, 0.78, -0.26]], head: [0, 0.86, -0.28],
  brow: [-0.05, 0.946, -0.352],
});

export const goose: SpeciesDef = {
  id: 'goose',
  joints: J,
  meta: {
    wings: true, hat: 'bandana', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.12,
    neckReach: 0.12, tail: 'feather', armUp: [0, -0.75, 0.66], gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.86, -0.51], skin: WHITE, skillPose: 'honk',
  },
  build(b) {
    buildBird(b, J, spec);
    addBandana(b, [0, 0.958, -0.29], [0.06, 0.08, 0.076], 0xe5191c, 0.3);
  },
};
