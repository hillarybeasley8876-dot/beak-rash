// 阿鹕 the pelican (hero): big round white body hunched over the bars, thick S-neck, chunky head with
// angry brows and a smirk, HUGE orange-yellow beak with a red hooked tip over an inflatable pink-orange
// pouch, red aero helmet + goggles + tuft, folded black-tipped wings with feather fists on the grips,
// short orange legs and big webbed feet on the pedals.
import type { Prim, V3 } from '../kit/sdf';
import { addMouth } from '../kit/ears-tails';
import { addEyes, pupilPoint } from '../kit/face';
import { addGoggles, addHelmet } from '../kit/gear';
import { addLeg, addWebFoot } from '../kit/limbs';
import { addFlankWing } from '../kit/wing-flank';
import { addFoldedWing } from '../kit/wing-fold';
import { B, type Joints } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const WHITE = 0xf6f3ec, GREY = 0xdfe3ea, BLACK = 0x1d1d22;
const BEAK = 0xf9b43a, BEAK_LO = 0xf2922c, HOOK = 0xd8261e, POUCH = 0xf8a07e, ORANGE = 0xf79a1e;
const RED = 0xe5191c;

const EYE: V3 = [-0.081, 0.75, -0.5048];
const EYE_DIR: V3 = [-0.45, 0.12, -0.88];
const EYE_R = 0.06;
const ARM_UP: V3 = [0, -0.75, 0.66];

const J: Joints = {
  pelvis: [0, 0.1, 0.02], spine: [0, 0.21, -0.08], chest: [0, 0.3, -0.2],
  neck: [[0, 0.44, -0.38], [0, 0.525, -0.355], [0, 0.6, -0.38]], head: [0, 0.645, -0.41],
  jaw: [0.0, 0.71, -0.5264], pouch: [0.0, 0.6668, -0.6992],
  eye: EYE, pupil: pupilPoint(EYE, EYE_DIR, EYE_R), brow: [-0.078, 0.818, -0.534], hat: [0.0, 0.855, -0.43],
  ear: [-0.0648, 0.7802, -0.3752],
  clav: [-0.09, 0.35, -0.24], shoulder: [-0.17, 0.35, -0.27], elbow: [-0.27, 0.22, -0.36], wrist: [-0.19, 0.09, -0.5],
  hip: [-0.1, 0.08, -0.04], knee: [-0.13, 0.03, -0.33], ankle: [-0.13, -0.27, -0.28], toe: [-0.13, -0.31, -0.42],
  tail: [[0, 0.17, 0.2], [0, 0.15, 0.31]],
};

function body(): Prim[] {
  return [
    { shape: { kind: 'ellipsoid', c: [0, 0.19, -0.06], r: [0.22, 0.19, 0.3] }, rot: [0.38, 0, 0], color: WHITE, bone: B.pelvis, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, 0.27, -0.16], r: [0.2, 0.18, 0.2] }, color: WHITE, bone: B.spine, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, 0.33, -0.25], r: [0.17, 0.165, 0.16] }, color: WHITE, bone: B.chest, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, 0.24, 0.22], r: [0.12, 0.07, 0.12] }, rot: [-0.35, 0, 0], color: WHITE, bone: B.tail1, k: 0.06 },
    { shape: { kind: 'ellipsoid', c: [0, 0.235, 0.33], r: [0.1, 0.028, 0.1] }, rot: [-0.3, 0, 0], color: GREY, bone: B.tail2, k: 0.04, priority: 0.01 },
    // Thick S-neck: one capsule per neck bone so the curve bends smoothly.
    { shape: { kind: 'capsule', a: [0, 0.38, -0.32], b: J.neck[0], r: 0.118, r2: 0.09 }, color: WHITE, bone: B.chest, k: 0.07, sigma: 0.03 },
    { shape: { kind: 'capsule', a: J.neck[0], b: J.neck[1], r: 0.088, r2: 0.076 }, color: WHITE, bone: B.neck1, k: 0.05, sigma: 0.03 },
    { shape: { kind: 'capsule', a: J.neck[1], b: J.neck[2], r: 0.07, r2: 0.068 }, color: WHITE, bone: B.neck2, k: 0.05, sigma: 0.03 },
    { shape: { kind: 'capsule', a: J.neck[2], b: [0.0, 0.6938, -0.4292], r: 0.068, r2: 0.078 }, color: WHITE, bone: B.neck3, k: 0.05, sigma: 0.03 },
    // Big toy head + rounded face the beak plugs into.
    { shape: { kind: 'ellipsoid', c: [0.0, 0.71, -0.44], r: [0.1296, 0.135, 0.1512] }, color: WHITE, bone: B.head, k: 0.045, sigma: 0.02 },
    { shape: { kind: 'ellipsoid', c: [0.0, 0.7046, -0.494], r: [0.1026, 0.0994, 0.0918] }, color: WHITE, bone: B.head, k: 0.04, sigma: 0.02 },
    // Paint: pale breeding patch on the chest, bare orbital skin around the eyes.
    { shape: { kind: 'ellipsoid', c: EYE, r: [0.072, 0.07, 0.072] }, op: 'paint', color: 0xffd6ae, bone: B.head },
  ];
}

function beakUpper(): Prim[] {
  return [
    { shape: { kind: 'ellipsoid', c: [0.0, 0.7338, -0.5912], r: [0.0583, 0.0378, 0.081] }, color: BEAK, bone: B.head, k: 0.03 },
    { shape: { kind: 'ellipsoid', c: [0.0, 0.7186, -0.764], r: [0.0518, 0.0292, 0.162] }, color: BEAK, bone: B.head, k: 0.03 },
    { shape: { kind: 'ellipsoid', c: [0.0, 0.7003, -0.9368], r: [0.0432, 0.0238, 0.0972] }, color: BEAK, bone: B.head, k: 0.03 },
    { shape: { kind: 'capsule', a: [0.0, 0.7564, -0.5804], b: [0.0, 0.7219, -0.9908], r: 0.0162, r2: 0.0108 }, color: 0xfbc65c, bone: B.head, k: 0.02 },
    { shape: { kind: 'capsule', a: [0.0, 0.7068, -1.007], b: [0.0, 0.6744, -1.047], r: 0.0205, r2: 0.0108 }, color: HOOK, bone: B.head, k: 0.015 },
  ];
}

function beakLower(): Prim[] {
  return [
    { shape: { kind: 'ellipsoid', c: [0.0, 0.7003, -0.6128], r: [0.0508, 0.0194, 0.0756] }, color: BEAK_LO, bone: B.jaw, k: 0.025 },
    { shape: { kind: 'ellipsoid', c: [0.0, 0.6916, -0.7748], r: [0.0443, 0.0173, 0.1512] }, color: BEAK_LO, bone: B.jaw, k: 0.025 },
    { shape: { kind: 'ellipsoid', c: [0.0, 0.6841, -0.926], r: [0.0356, 0.0151, 0.0864] }, color: BEAK_LO, bone: B.jaw, k: 0.025 },
    { shape: { kind: 'ellipsoid', c: [0.0, 0.6528, -0.7424], r: [0.054, 0.0605, 0.1836] }, rot: [0.1, 0, 0], color: POUCH, bone: B.pouch, k: 0.035, sigma: 0.02, outline: 0.8 },
    { shape: { kind: 'ellipsoid', c: [0.0, 0.669, -0.5804], r: [0.0562, 0.054, 0.0648] }, color: POUCH, bone: B.jaw, k: 0.035, sigma: 0.02 },
  ];
}

function tuft(): Prim[] {
  return [
    { shape: { kind: 'capsule', a: [0, 0.92, -0.39], b: [0, 1.02, -0.3], r: 0.022, r2: 0.007 }, color: WHITE, bone: B.hat, k: 0.02 },
    { shape: { kind: 'capsule', a: [0.014, 0.915, -0.385], b: [0.04, 0.99, -0.29], r: 0.017, r2: 0.006 }, color: WHITE, bone: B.hat, k: 0.02 },
    { shape: { kind: 'capsule', a: [-0.014, 0.915, -0.385], b: [-0.04, 0.99, -0.29], r: 0.017, r2: 0.006 }, color: WHITE, bone: B.hat, k: 0.02 },
  ];
}

export const pelican: SpeciesDef = {
  id: 'pelican',
  joints: J,
  meta: {
    wings: true, hat: 'helmet', eyeDir: EYE_DIR, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.22, lidTilt: 0.32,
    neckReach: 0.14, tail: 'feather', armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05], beak: [0.0, 0.683, -1.0448], skin: WHITE, skillPose: 'spit',
  },
  build(b, quality) {
    const fine = quality === 'low' ? 1.5 : 1;
    b.sdf(body(), 0.018 * fine, 2200);
    b.sdf(beakUpper(), 0.009 * fine, 360);
    b.sdf(beakLower(), 0.009 * fine, 360);
    b.sdf(tuft(), 0.007 * fine, 90);
    addEyes(b, J, {
      r: EYE_R, dir: EYE_DIR, pupil: 0.027, iris: { r: 0.04, color: 0xffe08a }, lid: WHITE,
      brow: { color: 0x26262c, len: 0.058, thick: 0.014, tilt: 0.45, lift: 0 },
    });
    for (const s of [-1, 1] as const) addMouth(b, [[s * 0.067, 0.7284, -0.5178], [s * 0.0594, 0.7111, -0.5588], [s * 0.054, 0.7057, -0.6236]], 0.0055);
    addHelmet(b, { c: [0.0, 0.855, -0.43], r: [0.1426, 0.0896, 0.1674], pitch: 0.12, color: RED, stripe: 0xffffff });
    addGoggles(b, { c: [0.0, 0.9, -0.56], dir: [0, 0.42, -0.91], spacing: 0.094, lensR: 0.033, frame: 0x222228, lens: 0x8fe3ff });
    for (const side of [-1, 1] as const) {
      addFoldedWing(b, J, side, {
        arm: [0.068, 0.06, 0.05], color: WHITE, feather: GREY, edge: BLACK, chord: [0.05, 0.12, 0.08], armUp: ARM_UP, trail: [-0.8, -0.5, 0.3],
        primaries: { n: 0, len: 0.2, w: 0.045, color: WHITE, tip: BLACK, tipFrac: 0.55 },
        fist: { r: [0.05, 0.04, 0.056], color: WHITE, toes: 3, curl: true, toeR: 0.019, budget: 180 },
      });
      addFlankWing(b, side, {
        root: [-0.19, 0.34, -0.27], tip: [-0.07, 0.26, 0.42], width: 0.15, body: body(), breaks: [0.29, 0.31, 0.59, 0.61],
        paint: (u, q) => (u > 0.6 || q < 0.24 ? BLACK : u < 0.3 && q > 0.54 ? WHITE : GREY),
      });
      addLeg(b, J, side, { r: [0.085, 0.052, 0.042, 0.038], thigh: WHITE, shin: ORANGE, split: 0.4 });
      addWebFoot(b, J, side, { len: 0.16, width: 0.15, thick: 0.026, drop: 0.04, color: ORANGE });
    }
  },
};
