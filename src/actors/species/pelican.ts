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
import { addPelicanBeak } from './pelican-beak';
import { B, type Joints } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const WHITE = 0xf6f3ec, GREY = 0xdfe3ea, EDGE = 0xaeb5c2, BLACK = 0x1d1d22;
const BEAK = 0xf9b43a, BEAK_LO = 0xf2922c, HOOK = 0xd8261e, POUCH = 0xf8a07e, ORANGE = 0xf79a1e;
const RED = 0xe5191c;

/** S-neck pass: the whole head (face, beak, eyes, gear) sits 4.5 cm higher and 5 cm further forward than authored. */
const HO: V3 = [0, 0.045, -0.05];
const h = (p: V3): V3 => [p[0] + HO[0], p[1] + HO[1], p[2] + HO[2]];

const EYE: V3 = h([-0.081, 0.75, -0.5048]);
const EYE_DIR: V3 = [-0.45, 0.12, -0.88];
const EYE_R = 0.06;
const ARM_UP: V3 = [0, -0.75, 0.66];

const J: Joints = {
  pelvis: [0, 0.1, 0.02], spine: [0, 0.23, -0.07], chest: [0, 0.33, -0.19],
  // A real S: forward out of the chest, back over the shoulders, forward again under the raised head.
  neck: [[0, 0.44, -0.38], [0, 0.53, -0.29], [0, 0.635, -0.43]], head: h([0, 0.645, -0.41]),
  jaw: h([0.0, 0.71, -0.5264]), pouch: h([0.0, 0.6668, -0.6992]),
  eye: EYE, pupil: pupilPoint(EYE, EYE_DIR, EYE_R), brow: h([-0.076, 0.79, -0.566]), hat: h([0.0, 0.875, -0.43]),
  ear: h([-0.0648, 0.7802, -0.3752]),
  clav: [-0.09, 0.35, -0.24], shoulder: [-0.17, 0.35, -0.27], elbow: [-0.27, 0.22, -0.36], wrist: [-0.19, 0.09, -0.5],
  hip: [-0.1, 0.08, -0.04], knee: [-0.13, 0.03, -0.33], ankle: [-0.13, -0.27, -0.28], toe: [-0.13, -0.31, -0.42],
  tail: [[0, 0.18, 0.11], [0, 0.17, 0.19]],
};

function body(): Prim[] {
  return [
    { shape: { kind: 'ellipsoid', c: [0, 0.2, -0.07], r: [0.225, 0.2, 0.215] }, rot: [0.4, 0, 0], color: WHITE, bone: B.pelvis, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, 0.3, -0.15], r: [0.205, 0.19, 0.18] }, color: WHITE, bone: B.spine, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, 0.37, -0.23], r: [0.18, 0.17, 0.155] }, color: WHITE, bone: B.chest, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, 0.25, 0.11], r: [0.11, 0.065, 0.1] }, rot: [-0.35, 0, 0], color: WHITE, bone: B.tail1, k: 0.06 },
    { shape: { kind: 'ellipsoid', c: [0, 0.245, 0.195], r: [0.09, 0.026, 0.085] }, rot: [-0.3, 0, 0], color: GREY, bone: B.tail2, k: 0.04, priority: 0.01 },
    // Thick S-neck: one capsule per neck bone so the curve bends smoothly.
    { shape: { kind: 'capsule', a: [0, 0.41, -0.28], b: J.neck[0], r: 0.12, r2: 0.09 }, color: WHITE, bone: B.chest, k: 0.07, sigma: 0.03 },
    { shape: { kind: 'capsule', a: J.neck[0], b: J.neck[1], r: 0.088, r2: 0.076 }, color: WHITE, bone: B.neck1, k: 0.05, sigma: 0.03 },
    { shape: { kind: 'capsule', a: J.neck[1], b: J.neck[2], r: 0.07, r2: 0.068 }, color: WHITE, bone: B.neck2, k: 0.05, sigma: 0.03 },
    { shape: { kind: 'capsule', a: J.neck[2], b: h([0.0, 0.6938, -0.4292]), r: 0.068, r2: 0.078 }, color: WHITE, bone: B.neck3, k: 0.05, sigma: 0.03 },
    // Big toy head + rounded face the beak plugs into.
    { shape: { kind: 'ellipsoid', c: h([0.0, 0.71, -0.44]), r: [0.1296, 0.135, 0.1512] }, color: WHITE, bone: B.head, k: 0.045, sigma: 0.02 },
    { shape: { kind: 'ellipsoid', c: h([0.0, 0.7046, -0.494]), r: [0.1026, 0.0994, 0.0918] }, color: WHITE, bone: B.head, k: 0.04, sigma: 0.02 },
  ];
}

function tuft(): Prim[] {
  return [
    // The tuft sprouts out of the helmet's centre vent slot.
    { shape: { kind: 'capsule', a: h([0, 0.965, -0.44]), b: h([0, 1.07, -0.35]), r: 0.02, r2: 0.007 }, color: WHITE, bone: B.hat, k: 0.02 },
    { shape: { kind: 'capsule', a: h([0.012, 0.962, -0.435]), b: h([0.038, 1.04, -0.34]), r: 0.016, r2: 0.006 }, color: WHITE, bone: B.hat, k: 0.02 },
    { shape: { kind: 'capsule', a: h([-0.012, 0.962, -0.435]), b: h([-0.038, 1.04, -0.34]), r: 0.016, r2: 0.006 }, color: WHITE, bone: B.hat, k: 0.02 },
  ];
}

export const pelican: SpeciesDef = {
  id: 'pelican',
  joints: J,
  meta: {
    wings: true, hat: 'helmet', eyeDir: EYE_DIR, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.22, lidTilt: 0.32,
    neckReach: 0.14, headScale: 1.12, headSway: 0.09, tail: 'feather', armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05], beak: h([0.0, 0.683, -1.0448]), skin: WHITE, skillPose: 'spit',
  },
  build(b, quality) {
    const fine = quality === 'low' ? 1.5 : 1;
    b.sdf(body(), 0.018 * fine, 2020);
    addPelicanBeak(b, { beak: BEAK, lower: BEAK_LO, hook: HOOK, pouch: POUCH }, HO, fine);
    b.sdf(tuft(), 0.007 * fine, 44);
    addEyes(b, J, {
      r: EYE_R, dir: EYE_DIR, pupil: 0.027, iris: { r: 0.04, color: 0xffe08a }, ring: { w: 0.007, color: 0x6b4a14 }, glint: 0.62, lid: WHITE,
      brow: { color: 0x26262c, len: 0.066, thick: 0.022, tilt: 0.55, lift: 0 },
    });
    // Smirk: the gape line runs along the beak edge and curls up at the corner.
    for (const s of [-1, 1] as const) addMouth(b, [h([s * 0.088, 0.738, -0.522]), h([s * 0.088, 0.716, -0.548]), h([s * 0.084, 0.709, -0.6]), h([s * 0.08, 0.708, -0.66])], 0.006);
    // Domed aero shell (not a flat beret); a dark centre vent slot instead of a stripe, the tuft pokes out of it.
    addHelmet(b, { c: h([0.0, 0.875, -0.43]), r: [0.1426, 0.112, 0.1674], pitch: 0.12, color: RED, stripe: 0x4a0a0c, detail: 1 });
    addGoggles(b, { c: h([0.0, 0.925, -0.56]), dir: [0, 0.42, -0.91], spacing: 0.094, lensR: 0.033, frame: 0x222228, lens: 0x8fe3ff });
    for (const side of [-1, 1] as const) {
      addFoldedWing(b, J, side, {
        arm: [0.068, 0.06, 0.05], color: WHITE, feather: GREY, edge: BLACK, chord: [0.05, 0.12, 0.08], armUp: ARM_UP, trail: [-0.8, -0.5, 0.3],
        primaries: { n: 0, len: 0.2, w: 0.045, color: WHITE, tip: BLACK, tipFrac: 0.55 },
        fan: { n: 5, len: 0.25, w: 0.05, color: GREY, tip: BLACK, tipFrac: 0.5, droop: 0.2, spread: 0.32, seg: 2 },
        fist: { r: [0.05, 0.04, 0.056], color: WHITE, toes: 3, curl: true, toeR: 0.019, budget: 180 },
      });
      addFlankWing(b, side, {
        root: [-0.19, 0.36, -0.26], tip: [-0.08, 0.27, 0.27], width: 0.15, body: body(), breaks: [0.28, 0.3, 0.7, 0.72],
        // Grey coverts, a darker secondaries edge and black only on the primaries (SPEC §5).
        paint: (u, q) => (u > 0.71 ? BLACK : q < 0.24 ? EDGE : u < 0.29 && q > 0.6 ? WHITE : GREY),
      });
      addLeg(b, J, side, { r: [0.085, 0.058, 0.046, 0.032], thigh: WHITE, shin: ORANGE, split: 0.4 });
      addWebFoot(b, J, side, { len: 0.16, width: 0.15, thick: 0.026, drop: 0.04, color: ORANGE });
    }
  },
};
