// 咕咕 the pigeon: chubby grey body, iridescent green/purple neck, orange eyes, small dark bill with a
// white cere, dark wing tips and tail band, pink toes, head-bob while pedalling. Signature: NO SHOW.
import { buildBird, birdJoints, type BirdSpec } from '../kit/bird';
import { addHelmet } from '../kit/gear';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const GREY = 0x8e98a8, HEAD = 0x7d8798, PINK = 0xe8889a;

const spec: BirdSpec = {
  color: GREY,
  body: { c: [0, 0.2, -0.04], r: [0.17, 0.165, 0.21], rot: 0.3 },
  chest: { c: [0, 0.33, -0.13], r: [0.15, 0.15, 0.155] },
  neckR: [0.07, 0.06, 0.052],
  head: { c: [0, 0.645, -0.3], r: [0.076, 0.076, 0.082] },
  beak: { base: [0, 0.64, -0.37], tip: [0, 0.625, -0.432], w: 0.016, h: 0.016, color: 0x3a3a40, lower: 0x3a3a40, cere: 0xf2f2f2 },
  eye: { at: [-0.046, 0.66, -0.332], r: 0.029, dir: [-0.55, 0.05, -0.83], pupil: 0.012, iris: { r: 0.021, color: 0xff7a1a } },
  wing: { tip: [-0.18, 0.04, -0.64], color: 0x9aa4b4, feather: 0x8590a2, tipColor: 0x2a2d35, tipFrac: 0.4, chord: 0.15, thick: 0.02, edgeR: [0.05, 0.036, 0.024] },
  leg: { r: [0.05, 0.026, 0.018, 0.016], thigh: GREY, shin: PINK },
  foot: { kind: 'toes', len: 0.09, width: 0.08, color: PINK },
  tail: { c: [0, 0.18, 0.23], r: [0.08, 0.025, 0.095], color: 0x5d6b80, up: 0.2 },
  extra: [
    { shape: { kind: 'ellipsoid', c: [0, 0.6, -0.27], r: [0.09, 0.07, 0.09] }, op: 'paint', color: HEAD, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [0, 0.455, -0.255], r: [0.1, 0.05, 0.09] }, op: 'paint', color: 0x3fbf8f, bone: B.neck1 },
    { shape: { kind: 'ellipsoid', c: [0, 0.515, -0.27], r: [0.085, 0.04, 0.08] }, op: 'paint', color: 0x9b59c6, bone: B.neck2 },
    { shape: { kind: 'ellipsoid', c: [0, 0.385, -0.22], r: [0.11, 0.05, 0.08] }, op: 'paint', color: 0x6fa8a0, bone: B.chest },
  ],
  budget: 2500,
};

const J = birdJoints(spec, {
  neck: [[0, 0.44, -0.21], [0, 0.51, -0.235], [0, 0.57, -0.265]], head: [0, 0.6, -0.28],
  hat: [0, 0.705, -0.295],
});

export const pigeon: SpeciesDef = {
  id: 'pigeon',
  joints: J,
  meta: {
    wings: true, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.1, headBob: true,
    neckReach: 0.06, tail: 'feather', armUp: [0, -0.75, 0.66], gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.625, -0.435], skin: HEAD, skillPose: 'ghost',
  },
  build(b) {
    buildBird(b, J, spec);
    addHelmet(b, { c: [0, 0.708, -0.295], r: [0.084, 0.055, 0.096], pitch: 0.15, color: 0x3fbf8f, stripe: 0xffffff });
  },
};
