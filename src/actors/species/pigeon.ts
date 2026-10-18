// 咕咕 the pigeon: very round grey body with a puffed iridescent green/purple breast, small helmeted head,
// big orange eyes with pin-prick pupils (the blank stare), dark bill with a white cere, two black wing
// bars, dark tail, pink toes, head-bob in time with the pedals. Signature: NO SHOW.
import { ARM_UP, buildBird, birdJoints, type BirdSpec } from '../kit/bird';
import { addHelmet } from '../kit/gear';
import type { Prim } from '../kit/sdf';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const GREY = 0x96a0b0, HEAD = 0x7f899a, PINK = 0xec8c9e, BAR = 0x2d3038, LIGHT = 0xb0b8c6;

/** [y, half-height, z, half-width, colour] of the neck sheen bands, top → bottom (later bands win overlaps). */
const NECK_BANDS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0.505, 0.03, -0.365, 0.15, 0x5e9e88], [0.472, 0.022, -0.36, 0.15, 0x3fbf8f], [0.443, 0.02, -0.35, 0.16, 0x3fb3a6],
  [0.417, 0.02, -0.34, 0.17, 0x5b8cc4], [0.391, 0.022, -0.335, 0.17, 0x9b59c6], [0.362, 0.02, -0.33, 0.17, 0x8a76b0],
];

const spec: BirdSpec = {
  color: GREY,
  body: { c: [0, 0.21, -0.1], r: [0.23, 0.21, 0.28], rot: 0.3 },
  chest: { c: [0, 0.33, -0.24], r: [0.19, 0.18, 0.17] },
  neckR: [0.1, 0.085, 0.078],
  head: { c: [0, 0.62, -0.4], r: [0.1, 0.1, 0.11] },
  beak: { base: [0, 0.61, -0.495], tip: [0, 0.588, -0.565], w: 0.021, h: 0.02, color: 0x3a3a40, lower: 0x3a3a40, cere: 0xf2f2f2 },
  eye: { at: [-0.062, 0.64, -0.45], r: 0.041, dir: [-0.6, 0.06, -0.8], pupil: 0.011, iris: { r: 0.034, color: 0xff7a1a } },
  wing: {
    kind: 'fold', arm: [0.064, 0.056, 0.048], color: GREY, feather: LIGHT, edge: 0x4a4f5a, chord: [0.05, 0.12, 0.08],
    trail: [-0.8, -0.5, 0.3], primaries: { n: 0, len: 0, w: 0, color: GREY, tip: BAR, tipFrac: 0 },
    fan: { n: 5, len: 0.2, w: 0.045, color: GREY, tip: BAR, tipFrac: 0.4, droop: 0.2, spread: 0.32, seg: 2 },
    fist: { r: [0.05, 0.04, 0.055], color: LIGHT, toes: 3, curl: true, toeR: 0.019, budget: 170 },
  },
  flank: {
    root: [-0.2, 0.32, -0.25], tip: [-0.1, 0.27, 0.38], width: 0.16, breaks: [0.36, 0.41, 0.48, 0.53, 0.7, 0.72],
    paint: (u, q) => (u > 0.71 ? 0x3a3e48 : q > 0.25 && ((u > 0.36 && u < 0.41) || (u > 0.48 && u < 0.53)) ? BAR
      : q < 0.24 ? 0x7e8898 : u < 0.3 && q > 0.58 ? LIGHT : GREY),
  },
  leg: { r: [0.08, 0.045, 0.036, 0.032], thigh: GREY, shin: PINK },
  foot: { kind: 'toes', len: 0.13, width: 0.1, color: PINK },
  tail: { c: [0, 0.22, 0.27], r: [0.1, 0.03, 0.12], color: 0x4d5868, up: 0.2 },
  extra: [
    { shape: { kind: 'ellipsoid', c: [0, 0.6, -0.38], r: [0.12, 0.1, 0.12] }, op: 'paint', color: HEAD, bone: B.head },
    // Iridescent neck: thin stepped bands grey-green → green → teal → blue-violet → purple → grey (a sheen, not a scarf).
    ...NECK_BANDS.map(([y, ry, z, rx, color]): Prim => ({ shape: { kind: 'ellipsoid', c: [0, y, z], r: [rx, ry, rx - 0.01] }, op: 'paint', color, bone: y > 0.43 ? B.neck1 : B.chest })),
  ],
  budget: 2000,
};

const J = birdJoints(spec, {
  neck: [[0, 0.42, -0.31], [0, 0.48, -0.33], [0, 0.53, -0.35]], head: [0, 0.56, -0.36],
  hat: [0, 0.675, -0.385],
  clav: [-0.08, 0.34, -0.24], shoulder: [-0.17, 0.34, -0.27], elbow: [-0.26, 0.2, -0.37], wrist: [-0.19, 0.09, -0.5],
  tail: [[0, 0.21, 0.19], [0, 0.22, 0.3]],
});

export const pigeon: SpeciesDef = {
  id: 'pigeon',
  joints: J,
  meta: {
    wings: true, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: -0.05, headBob: true,
    neckReach: 0.06, tail: 'feather', armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.588, -0.57], skin: HEAD, skillPose: 'ghost',
  },
  build(b) {
    buildBird(b, J, spec);
    addHelmet(b, { c: [0, 0.675, -0.385], r: [0.118, 0.1, 0.132], pitch: -0.32, color: 0x3fbf8f, stripe: 0xffffff, strap: { chin: [0, 0.57, -0.44] } });
  },
};
