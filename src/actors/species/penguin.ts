// 滑总 the penguin: round black-and-white egg, white face mask around the eyes, yellow bill and feet,
// short black flippers on the grips, yellow helmet. Signature: BELLY SLIDE (lies flat on the bike).
import { buildBird, birdJoints, type BirdSpec } from '../kit/bird';
import { addHelmet } from '../kit/gear';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const BLACK = 0x1d1f2b, WHITE = 0xffffff, YELLOW = 0xffcc00;

const spec: BirdSpec = {
  color: BLACK,
  body: { c: [0, 0.25, -0.05], r: [0.21, 0.24, 0.24], rot: 0.25 },
  chest: { c: [0, 0.42, -0.12], r: [0.18, 0.18, 0.18] },
  neckR: [0.11, 0.1, 0.1],
  head: { c: [0, 0.67, -0.24], r: [0.12, 0.115, 0.115] },
  beak: { base: [0, 0.664, -0.352], tip: [0, 0.644, -0.44], w: 0.026, h: 0.022, color: YELLOW, lower: 0xffa600 },
  eye: { at: [-0.052, 0.697, -0.335], r: 0.034, dir: [-0.4, 0.06, -0.92], pupil: 0.017 },
  wing: { tip: [-0.19, 0.05, -0.62], color: BLACK, feather: BLACK, tipColor: BLACK, tipFrac: 0, chord: 0.095, thick: 0.022, edgeR: [0.045, 0.03, 0.02], style: 'flipper' },
  leg: { r: [0.06, 0.04, 0.03, 0.028], thigh: BLACK, shin: 0xffb300 },
  foot: { kind: 'web', len: 0.12, width: 0.11, color: 0xffb300 },
  tail: { c: [0, 0.13, 0.22], r: [0.07, 0.03, 0.07], color: BLACK, up: 0.1 },
  extra: [
    { shape: { kind: 'ellipsoid', c: [0, 0.3, -0.2], r: [0.17, 0.26, 0.15] }, op: 'paint', color: WHITE, bone: B.spine },
    { shape: { kind: 'ellipsoid', c: [-0.055, 0.69, -0.33], r: [0.055, 0.05, 0.05] }, op: 'paint', color: WHITE, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [0.055, 0.69, -0.33], r: [0.055, 0.05, 0.05] }, op: 'paint', color: WHITE, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [0, 0.6, -0.3], r: [0.09, 0.05, 0.06] }, op: 'paint', color: WHITE, bone: B.neck3 },
  ],
  budget: 2500,
};

const J = birdJoints(spec, {
  neck: [[0, 0.48, -0.17], [0, 0.53, -0.19], [0, 0.58, -0.21]], head: [0, 0.61, -0.22],
  hat: [0, 0.76, -0.24],
  shoulder: [-0.17, 0.44, -0.16], elbow: [-0.23, 0.32, -0.34], wrist: [-0.22, 0.16, -0.52],
});

export const penguin: SpeciesDef = {
  id: 'penguin',
  joints: J,
  meta: {
    wings: true, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0,
    neckReach: 0.03, tail: 'stub', armUp: [0, -0.75, 0.66], gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.644, -0.44], skin: BLACK, skillPose: 'slide',
  },
  build(b) {
    buildBird(b, J, spec);
    addHelmet(b, { c: [0, 0.765, -0.24], r: [0.122, 0.07, 0.125], pitch: 0.12, color: YELLOW, stripe: BLACK });
  },
};
