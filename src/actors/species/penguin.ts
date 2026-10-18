// 滑总 the penguin: a big round black-and-white egg (no neck), white face mask around big eyes, small
// yellow bill, short black flippers on the grips, yellow helmet and feet; rides the kid bike with stubby legs
// tucked under the egg (feet on toy pedal extenders). Cool, laid-back lids. Signature: BELLY SLIDE.
import { ARM_UP, buildBird, birdJoints, type BirdSpec } from '../kit/bird';
import { addHelmet } from '../kit/gear';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const BLACK = 0x1d1f2b, WHITE = 0xffffff, YELLOW = 0xffcc00, FEET = 0xffb300;

const spec: BirdSpec = {
  color: BLACK,
  body: { c: [0, 0.32, -0.02], r: [0.26, 0.32, 0.25], rot: 0.08 },
  chest: { c: [0, 0.5, -0.06], r: [0.22, 0.2, 0.21] },
  neckR: [0.12, 0.115, 0.11],
  head: { c: [0, 0.76, -0.12], r: [0.17, 0.155, 0.16] },
  beak: { base: [0, 0.735, -0.275], tip: [0, 0.72, -0.35], w: 0.036, h: 0.026, color: YELLOW, lower: 0xffa600 },
  eye: { at: [-0.068, 0.79, -0.255], r: 0.045, dir: [-0.4, 0.06, -0.92], pupil: 0.022 },
  wing: {
    kind: 'flipper', r: [0.075, 0.06, 0.045], flat: 0.42, color: BLACK,
    fist: { r: [0.054, 0.036, 0.062], color: BLACK, budget: 140 },
  },
  leg: { r: [0.09, 0.065, 0.055, 0.045], thigh: BLACK, shin: BLACK },
  foot: { kind: 'web', len: 0.15, width: 0.14, color: FEET },
  tail: { c: [0, 0.12, 0.24], r: [0.08, 0.03, 0.07], color: BLACK, up: 0.1 },
  extra: [
    { shape: { kind: 'ellipsoid', c: [0, 0.36, -0.2], r: [0.2, 0.31, 0.2] }, op: 'paint', color: WHITE, bone: B.spine },
    { shape: { kind: 'ellipsoid', c: [-0.066, 0.785, -0.24], r: [0.075, 0.07, 0.07] }, op: 'paint', color: WHITE, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [0.066, 0.785, -0.24], r: [0.075, 0.07, 0.07] }, op: 'paint', color: WHITE, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [0, 0.715, -0.24], r: [0.11, 0.06, 0.08] }, op: 'paint', color: WHITE, bone: B.head },
  ],
  budget: 2200,
};

const J = birdJoints(spec, {
  chest: [0, 0.44, -0.05], neck: [[0, 0.56, -0.08], [0, 0.6, -0.09], [0, 0.64, -0.1]], head: [0, 0.66, -0.1],
  hat: [0, 0.855, -0.11],
  clav: [-0.1, 0.5, -0.08], shoulder: [-0.22, 0.5, -0.1], elbow: [-0.27, 0.36, -0.17], wrist: [-0.2, 0.18, -0.2],
  hip: [-0.11, 0.1, -0.03], knee: [-0.13, 0.05, -0.12], ankle: [-0.13, -0.05, -0.1], toe: [-0.13, -0.09, -0.22],
  tail: [[0, 0.12, 0.2], [0, 0.12, 0.28]],
});

export const penguin: SpeciesDef = {
  id: 'penguin',
  joints: J,
  meta: {
    wings: true, shortLegs: true, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.28, lidTilt: 0.1,
    neckReach: 0.03, tail: 'stub', armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.72, -0.35], skin: BLACK, skillPose: 'slide',
  },
  build(b) {
    buildBird(b, J, spec);
    addHelmet(b, { c: [0, 0.855, -0.11], r: [0.19, 0.15, 0.188], pitch: -0.25, color: YELLOW, round: true });
  },
};
