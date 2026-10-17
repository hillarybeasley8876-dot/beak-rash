// 阿鹕 the pelican (hero): white body, S-neck, small tufted head, HUGE orange-yellow beak with a red
// hooked tip over an inflatable pink-orange pouch, red aero helmet + goggles, black-tipped wings
// gripping the bars, orange webbed feet on the pedals.
import type { Prim, V3 } from '../kit/sdf';
import { addEyes, pupilPoint } from '../kit/face';
import { addGoggles, addHelmet } from '../kit/gear';
import { addLeg, addWebFoot } from '../kit/limbs';
import { addBirdWing } from '../kit/wing';
import { B, type Joints } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const WHITE = 0xf4f1ea, CREAM = 0xf6e7b8, GREY = 0xd3d8e0, BLACK = 0x1d1d22;
const BEAK = 0xf7b23b, BEAK_LO = 0xf08f2a, HOOK = 0xd8261e, POUCH = 0xf79a7c, ORANGE = 0xf59a23;
const RED = 0xe5191c;

const EYE: V3 = [-0.064, 0.905, -0.42];
const EYE_DIR: V3 = [-0.4, 0.1, -0.91];
const EYE_R = 0.047;

const J: Joints = {
  pelvis: [0, 0.12, 0.02], spine: [0, 0.24, -0.04], chest: [0, 0.37, -0.14],
  neck: [[0, 0.48, -0.25], [0, 0.6, -0.215], [0, 0.72, -0.275]], head: [0, 0.81, -0.34],
  jaw: [0, 0.845, -0.45], pouch: [0, 0.825, -0.6],
  eye: EYE, pupil: pupilPoint(EYE, EYE_DIR, EYE_R), brow: [-0.062, 0.957, -0.44], hat: [0, 0.91, -0.36],
  ear: [-0.06, 0.88, -0.3],
  clav: [-0.085, 0.42, -0.17], shoulder: [-0.15, 0.43, -0.21], elbow: [-0.23, 0.31, -0.42], wrist: [-0.22, 0.12, -0.59],
  hip: [-0.095, 0.1, -0.05], knee: [-0.125, 0.04, -0.36], ankle: [-0.125, -0.29, -0.3], toe: [-0.125, -0.33, -0.42],
  tail: [[0, 0.18, 0.19], [0, 0.16, 0.29]],
};

function body(): Prim[] {
  return [
    { shape: { kind: 'ellipsoid', c: [0, 0.21, -0.04], r: [0.19, 0.19, 0.25] }, rot: [0.4, 0, 0], color: WHITE, bone: B.pelvis, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, 0.29, -0.09], r: [0.175, 0.18, 0.19] }, color: WHITE, bone: B.spine, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, 0.37, -0.16], r: [0.16, 0.165, 0.17] }, color: WHITE, bone: B.chest, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, 0.2, 0.18], r: [0.11, 0.075, 0.12] }, rot: [-0.3, 0, 0], color: WHITE, bone: B.tail1, k: 0.06 },
    { shape: { kind: 'ellipsoid', c: [0, 0.17, 0.29], r: [0.085, 0.025, 0.09] }, rot: [-0.15, 0, 0], color: GREY, bone: B.tail2, k: 0.04, priority: 0.01 },
    // S-neck: one capsule per neck bone so the curve bends smoothly.
    { shape: { kind: 'capsule', a: [0, 0.4, -0.2], b: J.neck[0], r: 0.085, r2: 0.068 }, color: WHITE, bone: B.chest, k: 0.06, sigma: 0.03 },
    { shape: { kind: 'capsule', a: J.neck[0], b: J.neck[1], r: 0.064, r2: 0.057 }, color: WHITE, bone: B.neck1, k: 0.04, sigma: 0.03 },
    { shape: { kind: 'capsule', a: J.neck[1], b: J.neck[2], r: 0.055, r2: 0.054 }, color: WHITE, bone: B.neck2, k: 0.04, sigma: 0.03 },
    { shape: { kind: 'capsule', a: J.neck[2], b: [0, 0.82, -0.35], r: 0.054, r2: 0.06 }, color: WHITE, bone: B.neck3, k: 0.04, sigma: 0.03 },
    // Head (bigger than life: toy proportions) + rounded face the beak plugs into.
    { shape: { kind: 'ellipsoid', c: [0, 0.86, -0.37], r: [0.094, 0.098, 0.115] }, color: WHITE, bone: B.head, k: 0.04, sigma: 0.02 },
    { shape: { kind: 'ellipsoid', c: [0, 0.848, -0.415], r: [0.074, 0.072, 0.072] }, color: WHITE, bone: B.head, k: 0.04, sigma: 0.02 },
    // Paint: pale breeding patch on the chest, bare orbital skin around the eyes.
    { shape: { kind: 'ellipsoid', c: [0, 0.42, -0.29], r: [0.11, 0.085, 0.08] }, op: 'paint', color: CREAM, bone: B.chest },
    { shape: { kind: 'ellipsoid', c: EYE, r: [0.058, 0.056, 0.058] }, op: 'paint', color: 0xffd2a8, bone: B.head },
  ];
}

function beakUpper(): Prim[] {
  return [
    { shape: { kind: 'ellipsoid', c: [0, 0.866, -0.49], r: [0.044, 0.03, 0.062] }, color: BEAK, bone: B.head, k: 0.03 },
    { shape: { kind: 'ellipsoid', c: [0, 0.855, -0.63], r: [0.038, 0.022, 0.125] }, color: BEAK, bone: B.head, k: 0.03 },
    { shape: { kind: 'ellipsoid', c: [0, 0.842, -0.77], r: [0.031, 0.019, 0.08] }, color: BEAK, bone: B.head, k: 0.03 },
    { shape: { kind: 'capsule', a: [0, 0.883, -0.48], b: [0, 0.858, -0.81], r: 0.012, r2: 0.009 }, color: 0xf9c25a, bone: B.head, k: 0.02 },
    { shape: { kind: 'capsule', a: [0, 0.848, -0.835], b: [0, 0.823, -0.864], r: 0.016, r2: 0.009 }, color: HOOK, bone: B.head, k: 0.015 },
  ];
}

function beakLower(): Prim[] {
  return [
    { shape: { kind: 'ellipsoid', c: [0, 0.835, -0.51], r: [0.038, 0.016, 0.06] }, color: BEAK_LO, bone: B.jaw, k: 0.025 },
    { shape: { kind: 'ellipsoid', c: [0, 0.828, -0.65], r: [0.032, 0.014, 0.12] }, color: BEAK_LO, bone: B.jaw, k: 0.025 },
    { shape: { kind: 'ellipsoid', c: [0, 0.821, -0.775], r: [0.025, 0.012, 0.07] }, color: BEAK_LO, bone: B.jaw, k: 0.025 },
    { shape: { kind: 'ellipsoid', c: [0, 0.795, -0.61], r: [0.04, 0.044, 0.15] }, rot: [0.12, 0, 0], color: POUCH, bone: B.pouch, k: 0.035, sigma: 0.02, outline: 0.8 },
    { shape: { kind: 'ellipsoid', c: [0, 0.81, -0.48], r: [0.042, 0.042, 0.055] }, color: POUCH, bone: B.jaw, k: 0.035, sigma: 0.02 },
  ];
}

function tuft(): Prim[] {
  return [
    { shape: { kind: 'capsule', a: [0, 0.885, -0.28], b: [0, 0.945, -0.2], r: 0.018, r2: 0.006 }, color: WHITE, bone: B.head, k: 0.02 },
    { shape: { kind: 'capsule', a: [0.012, 0.878, -0.275], b: [0.028, 0.922, -0.19], r: 0.014, r2: 0.005 }, color: WHITE, bone: B.head, k: 0.02 },
    { shape: { kind: 'capsule', a: [-0.012, 0.878, -0.275], b: [-0.028, 0.922, -0.19], r: 0.014, r2: 0.005 }, color: WHITE, bone: B.head, k: 0.02 },
  ];
}

export const pelican: SpeciesDef = {
  id: 'pelican',
  joints: J,
  meta: {
    wings: true, hat: 'helmet', eyeDir: EYE_DIR, lid: { open: -0.85, closed: 1.45 }, sleepy: 0,
    neckReach: 0.14, tail: 'feather', armUp: [0, -0.75, 0.66], gripDrop: 0.03, ankleLift: [0, 0.05, 0.05], beak: [0, 0.83, -0.86], skin: WHITE, skillPose: 'spit',
  },
  build(b, quality) {
    const fine = quality === 'low' ? 1.5 : 1;
    b.sdf(body(), 0.018 * fine, 3200);
    b.sdf(beakUpper(), 0.009 * fine, 460);
    b.sdf(beakLower(), 0.009 * fine, 460);
    b.sdf(tuft(), 0.007 * fine, 100);
    addEyes(b, J, {
      r: EYE_R, dir: EYE_DIR, pupil: 0.021, iris: { r: 0.03, color: 0xffe08a }, lid: WHITE,
      brow: { color: 0x6d7380, len: 0.036, thick: 0.008, tilt: 0.12, lift: 0 },
    });
    addHelmet(b, { c: [0, 0.922, -0.365], r: [0.105, 0.072, 0.13], pitch: 0.18, color: RED, stripe: 0xffffff });
    addGoggles(b, {
      c: [0, 0.962, -0.475], dir: [0, 0.42, -0.91], spacing: 0.074, lensR: 0.027, frame: 0x222228, lens: 0x8fe3ff,
    });
    for (const side of [-1, 1] as const) {
      addBirdWing(b, J, side, {
        tip: [-0.2, 0.02, -0.7], color: WHITE, feather: GREY, tipColor: BLACK, tipFrac: 0.45,
        chord: 0.16, thick: 0.022, edgeR: [0.05, 0.034, 0.022], trail: [0, -0.75, 0.66],
      });
      addLeg(b, J, side, { r: [0.06, 0.032, 0.022, 0.02], thigh: WHITE, shin: ORANGE, split: 0.42 });
      addWebFoot(b, J, side, { len: 0.13, width: 0.12, thick: 0.022, drop: 0.035, color: ORANGE });
    }
  },
};
