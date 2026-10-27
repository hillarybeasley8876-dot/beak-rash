// 泪眼猫猫 the crying cat: a grey-beige cat with HUGE glossy eyes brimming with tears (blue drops on the
// cheeks), a wobbly mouth and one paw holding a thumbs-up on the grip. Small round helmet. Signature: TEAR RAIN.
import { addEars, addMouth } from '../kit/ears-tails';
import { addHelmet } from '../kit/gear';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import type { Prim } from '../kit/sdf';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xd9d4cc, CREAM = 0xf4efe6, PINK = 0xff9fb0, TEAR = 0x8fd3ff;

/** A blue tear drop clinging under each eye plus the wet streak it leaves down the cheek. */
function tears(): Prim[] {
  const out: Prim[] = [];
  for (const s of [-1, 1]) {
    out.push({ shape: { kind: 'ellipsoid', c: [s * 0.076, 0.556, -0.44], r: [0.017, 0.024, 0.018] }, color: TEAR, bone: B.head, k: 0.006, sigma: 0.015, priority: 0.02 });
    out.push({ shape: { kind: 'ellipsoid', c: [s * 0.108, 0.53, -0.412], r: [0.011, 0.034, 0.012] }, rot: [0, 0, s * 0.18], color: TEAR, bone: B.head, k: 0.005, sigma: 0.012, priority: 0.02 });
  }
  return out;
}

/** The thumbs-up: a stubby thumb sticking out of the top of the left paw (it rides the hand bone, so the
 *  grip IK keeps it on the bar). */
function thumb(wrist: readonly [number, number, number]): Prim {
  const [x, y, z] = wrist;
  return { shape: { kind: 'capsule', a: [x - 0.018, y + 0.02, z - 0.008], b: [x - 0.05, y + 0.095, z - 0.045], r: 0.019, r2: 0.015 },
    color: FUR, bone: B.handL, k: 0.008, sigma: 0.012 };
}

const spec: MammalSpec = {
  fur: FUR, belly: CREAM, muzzle: CREAM, nose: 0xf09aa8,
  body: { c: [0, 0.17, -0.06], r: [0.19, 0.175, 0.22], rot: 0.35 },
  chest: { c: [0, 0.28, -0.21], r: [0.16, 0.15, 0.15] },
  head: { c: [0, 0.58, -0.31], r: [0.16, 0.15, 0.155] },
  snout: { c: [0, 0.53, -0.44], r: [0.075, 0.052, 0.052] },
  cheeks: { c: [-0.07, 0.528, -0.415], r: [0.07, 0.052, 0.058], color: CREAM },
  noseAt: [0, 0.562, -0.478], noseR: [0.02, 0.014, 0.012],
  chin: { c: [0, 0.49, -0.42], r: [0.052, 0.026, 0.044] },
  arm: [0.06, 0.055, 0.062], leg: [0.088, 0.072, 0.06, 0.054],
  hand: { r: [0.056, 0.043, 0.06], color: CREAM, toes: 3 },
  foot: { r: [0.056, 0.041, 0.076], color: CREAM, toes: 3, pad: PINK, drop: 0.01 },
  // Huge glassy eyes: a big sclera, a small dark pupil and a wide highlight.
  eye: { at: [-0.072, 0.594, -0.435], r: 0.065, dir: [-0.28, 0.05, -0.96], pupil: 0.031, glint: 0.5,
    iris: { r: 0.052, color: 0x6b93c4 }, ring: { w: 0.008, color: 0x232838 } },
  extra: tears(),
  budget: 2200,
};

const J = mammalJoints(spec, {
  hat: [0, 0.7, -0.3], ear: [-0.13, 0.68, -0.28],
  clav: [-0.07, 0.3, -0.25], shoulder: [-0.15, 0.29, -0.31], elbow: [-0.25, 0.17, -0.44], wrist: [-0.2, 0.02, -0.58],
  tail: [[0, 0.17, 0.2], [0, 0.22, 0.3]],
});

export const cryingcat: SpeciesDef = {
  id: 'cryingcat',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.22, lidTilt: -0.2,
    neckReach: 0.05, tail: 'long', earFlop: 0.05, hatWobble: 0.05, armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.49, -0.47], skin: FUR, skillPose: 'chill',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'pointy', w: 0.115, h: 0.125, thick: 0.023, color: FUR, inner: PINK, tilt: 0.45, back: 0.1, turn: 0.2 });
    // Wobbly mouth: the corners lift and dip, not a straight line.
    addMouth(b, [[-0.044, 0.508, -0.466], [-0.022, 0.518, -0.474], [0, 0.5, -0.478], [0.022, 0.518, -0.474], [0.044, 0.508, -0.466]], 0.0048);
    b.sdf([thumb(J.wrist)], 0.006, 90);
    addHelmet(b, { c: [0, 0.706, -0.3], r: [0.168, 0.128, 0.176], pitch: -0.16, color: 0x9fb6c8, stripe: CREAM, round: true,
      strap: { chin: [0, 0.49, -0.43] } });
  },
};
