// 闪电 the sloth: shaggy brown coat with ragged tufts (silhouette from behind), pale face mask with dark eye
// stripes, closed content eyes and an eternal smile, brown domed helmet, long arms and legs ending in long
// cream hooked claws around the grips and pedals. Signature: FLASH (fast only then).
import { addMouth } from '../kit/ears-tails';
import { addHelmet } from '../kit/gear';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import type { Prim } from '../kit/sdf';
import { B, type Joints } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0x8c8068, FACE = 0xead9b8, PATCH = 0x3a2e22, SHAG = 0xb3a687, CLAW = 0xeadfc4;

/** Shaggy coat: soft bumps in the fur colour plus 15 long thin locks spread over the back, flanks and nape (off the
 *  shoulder line), hanging down-back with lighter tips for a ragged silhouette from the chase cam. */
function shag(): Prim[] {
  const out: Prim[] = [];
  const bumps: Array<[number, number, number, number]> = [
    [0, 0.42, -0.06, B.chest], [-0.13, 0.38, -0.08, B.chest], [0.13, 0.38, -0.08, B.chest], [-0.1, 0.3, 0.06, B.spine],
    [0.1, 0.3, 0.06, B.spine], [0, 0.32, 0.08, B.spine], [-0.14, 0.18, 0.1, B.pelvis], [0.14, 0.18, 0.1, B.pelvis],
  ];
  for (const [x, y, z, bone] of bumps) out.push({ shape: { kind: 'ellipsoid', c: [x, y, z], r: [0.07, 0.06, 0.07] }, color: FUR, bone, k: 0.05, sigma: 0.04 });
  const locks: Array<[number, number, number, number]> = [
    [0, 0.4, 0.02, B.chest], [-0.08, 0.36, 0.06, B.chest], [0.08, 0.36, 0.06, B.chest],
    [-0.12, 0.28, 0.12, B.spine], [0, 0.28, 0.14, B.spine], [0.12, 0.28, 0.12, B.spine],
    [-0.08, 0.2, 0.17, B.pelvis], [0.08, 0.2, 0.17, B.pelvis], [-0.17, 0.22, 0.06, B.spine], [0.17, 0.22, 0.06, B.spine],
    [-0.2, 0.13, 0.0, B.pelvis], [0.2, 0.13, 0.0, B.pelvis], [0, 0.6, -0.17, B.head], [-0.08, 0.58, -0.19, B.head], [0.08, 0.58, -0.19, B.head],
  ];
  locks.forEach(([x, y, z, bone], i) => {
    const len = 0.13 + 0.04 * ((i * 7) % 3) / 2, dx = x * 0.3, dy = -len * 0.85, dz = len * 0.45;
    const mid: [number, number, number] = [x + dx * 0.6, y + dy * 0.6, z + dz * 0.6];
    out.push({ shape: { kind: 'capsule', a: [x, y + 0.01, z - 0.015], b: mid, r: 0.03, r2: 0.02 }, color: FUR, bone, k: 0.012, sigma: 0.04 });
    out.push({ shape: { kind: 'capsule', a: mid, b: [x + dx, y + dy, z + dz], r: 0.02, r2: 0.008 }, color: SHAG, bone, k: 0.008, sigma: 0.04 });
  });
  return out;
}

const spec: MammalSpec = {
  fur: FUR, belly: 0xb39b7a, muzzle: FACE, nose: 0x2a2018, lid: 0x5e4a36,
  body: { c: [0, 0.2, -0.05], r: [0.21, 0.21, 0.24], rot: 0.3 },
  chest: { c: [0, 0.34, -0.16], r: [0.18, 0.17, 0.17] },
  head: { c: [0, 0.6, -0.33], r: [0.17, 0.155, 0.16] },
  snout: { c: [0, 0.575, -0.425], r: [0.135, 0.11, 0.07] },
  noseAt: [0, 0.578, -0.5], noseR: [0.027, 0.019, 0.015],
  chin: { c: [0, 0.525, -0.44], r: [0.06, 0.028, 0.04] },
  arm: [0.066, 0.058, 0.052], leg: [0.085, 0.07, 0.058, 0.052],
  hand: { r: [0.05, 0.04, 0.056], color: FUR, toes: 3, claw: CLAW, toeR: 0.03 },
  foot: { r: [0.05, 0.04, 0.07], color: FUR, toes: 3, claw: CLAW, toeR: 0.03, drop: 0.01 },
  eye: { at: [-0.062, 0.606, -0.472], r: 0.03, dir: [-0.3, 0.02, -0.95], pupil: 0.017 },
  extra: [
    ...shag(),
    { shape: { kind: 'ellipsoid', c: [-0.07, 0.6, -0.468], r: [0.062, 0.026, 0.032] }, rot: [0, 0, -0.35], op: 'paint', color: PATCH, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [0.07, 0.6, -0.468], r: [0.062, 0.026, 0.032] }, rot: [0, 0, 0.35], op: 'paint', color: PATCH, bone: B.head },
  ],
  budget: 2900,
  cell: 0.016,
};

const J: Joints = mammalJoints(spec, {
  hat: [0, 0.69, -0.31],
  shoulder: [-0.16, 0.36, -0.22], elbow: [-0.3, 0.24, -0.34], wrist: [-0.21, 0.11, -0.48],
});

export const sloth: SpeciesDef = {
  id: 'sloth',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.78, lidTilt: -0.15,
    neckReach: 0.04, tail: 'none', blinkTime: 0.6, armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.54, -0.49], skin: PATCH, skillPose: 'flash',
  },
  build(b) {
    buildMammal(b, J, spec);
    // Eternal smile: a wide U riding just proud of the snout surface (corners curl up into the cheeks).
    addMouth(b, [[-0.068, 0.568, -0.49], [-0.04, 0.545, -0.494], [-0.016, 0.536, -0.495], [0, 0.534, -0.495], [0.016, 0.536, -0.495], [0.04, 0.545, -0.494], [0.068, 0.568, -0.49]], 0.0068);
    addHelmet(b, { c: [0, 0.69, -0.31], r: [0.185, 0.145, 0.195], pitch: -0.2, color: 0x5b4632, stripe: FACE, strap: { chin: [0, 0.5, -0.43] } });
  },
};
