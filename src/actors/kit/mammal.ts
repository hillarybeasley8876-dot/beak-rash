// Mammal template: barrel body, short neck, big toy head with muzzle/cheeks/chin, tube arms with paws on
// the grips, tube legs with paws on the pedals. Species add ears, tails, markings and gear on top.
import type { CharacterBuilder } from './builder';
import { addEyes, pupilPoint, type EyeOpts } from './face';
import { addArm, addLeg, addPaw } from './limbs';
import type { Prim, V3 } from './sdf';
import { B, type Joints } from '../rig/skeleton';

export interface MammalSpec {
  fur: number;
  belly: number;          // belly / chest patch colour
  muzzle: number;
  nose: number;
  body: { c: V3; r: V3; rot?: number };
  chest: { c: V3; r: V3 };
  head: { c: V3; r: V3 };
  snout: { c: V3; r: V3 };
  cheeks?: { c: V3; r: V3; color: number };
  noseAt: V3; noseR: V3;
  chin: { c: V3; r: V3 };
  arm: readonly [number, number, number];
  leg: readonly [number, number, number, number];
  paw: V3;
  pawColor: number;
  footPaw: V3;
  eye: Omit<EyeOpts, 'lid'> & { at: V3 };
  /** Extra shape/paint primitives merged into the body piece (stripes, patches, shaggy tufts). */
  extra?: Prim[];
  cell?: number;
  budget?: number;
}

/** Common seated-mammal joints; species override what they need. */
export function mammalJoints(s: MammalSpec, o: Partial<Joints> = {}): Joints {
  const e = s.eye;
  const base: Joints = {
    pelvis: [0, 0.12, 0.02], spine: [0, 0.26, -0.06], chest: [0, 0.4, -0.16],
    neck: [[0, 0.49, -0.21], [0, 0.54, -0.24], [0, 0.59, -0.27]], head: [0, 0.63, -0.29],
    jaw: [0, s.chin.c[1] + 0.02, s.chin.c[2] + 0.05], pouch: [0, s.chin.c[1], s.chin.c[2]],
    eye: e.at, pupil: pupilPoint(e.at, e.dir, e.r), brow: [e.at[0], e.at[1] + e.r * 1.25, e.at[2] - e.r * 0.2],
    hat: [0, s.head.c[1] + s.head.r[1] * 0.75, s.head.c[2]], ear: [-s.head.r[0] * 0.7, s.head.c[1] + s.head.r[1] * 0.7, s.head.c[2]],
    clav: [-0.07, 0.38, -0.2], shoulder: [-0.14, 0.37, -0.25], elbow: [-0.2, 0.25, -0.42], wrist: [-0.21, 0.1, -0.57],
    hip: [-0.1, 0.1, -0.04], knee: [-0.13, 0.05, -0.36], ankle: [-0.13, -0.28, -0.3], toe: [-0.13, -0.32, -0.4],
    tail: [[0, 0.14, 0.2], [0, 0.2, 0.32]],
  };
  return { ...base, ...o };
}

export function buildMammal(b: CharacterBuilder, J: Joints, s: MammalSpec): void {
  const prims: Prim[] = [
    { shape: { kind: 'ellipsoid', c: s.body.c, r: s.body.r }, rot: [s.body.rot ?? 0.3, 0, 0], color: s.fur, bone: B.pelvis, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, (s.body.c[1] + s.chest.c[1]) / 2, (s.body.c[2] + s.chest.c[2]) / 2], r: s.chest.r }, color: s.fur, bone: B.spine, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: s.chest.c, r: s.chest.r }, color: s.fur, bone: B.chest, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'capsule', a: J.chest, b: J.head, r: s.chest.r[0] * 0.62, r2: s.head.r[0] * 0.55 }, color: s.fur, bone: B.neck2, k: 0.07, sigma: 0.04 },
    { shape: { kind: 'ellipsoid', c: s.head.c, r: s.head.r }, color: s.fur, bone: B.head, k: 0.05, sigma: 0.03 },
    { shape: { kind: 'ellipsoid', c: s.snout.c, r: s.snout.r }, color: s.muzzle, bone: B.head, k: 0.05, sigma: 0.02, priority: 0.004 },
    { shape: { kind: 'ellipsoid', c: s.chin.c, r: s.chin.r }, color: s.muzzle, bone: B.jaw, k: 0.03, sigma: 0.012, priority: 0.004 },
    // Belly patch.
    { shape: { kind: 'ellipsoid', c: [0, s.body.c[1] + 0.06, s.body.c[2] - s.body.r[2] * 0.75], r: [s.body.r[0] * 0.7, s.body.r[1] * 0.85, s.body.r[2] * 0.5] }, op: 'paint', color: s.belly, bone: B.spine },
  ];
  if (s.cheeks) {
    for (const sx of [-1, 1]) {
      prims.push({ shape: { kind: 'ellipsoid', c: [sx === -1 ? s.cheeks.c[0] : -s.cheeks.c[0], s.cheeks.c[1], s.cheeks.c[2]], r: s.cheeks.r }, color: s.cheeks.color, bone: B.head, k: 0.04, sigma: 0.02 });
    }
  }
  if (s.extra) prims.push(...s.extra);
  b.sdf(prims, s.cell ?? 0.018, s.budget ?? 2500);
  // Nose + mouth interior (dark, shows when the chin drops).
  b.sdf([
    { shape: { kind: 'ellipsoid', c: s.noseAt, r: s.noseR }, color: s.nose, bone: B.head, k: 0.01, outline: 0.6 },
  ], 0.008, 120);
  b.sdf([
    { shape: { kind: 'ellipsoid', c: [0, s.chin.c[1] + s.chin.r[1] * 0.6, s.chin.c[2] + 0.01], r: [s.chin.r[0] * 0.8, s.chin.r[1] * 0.7, s.chin.r[2] * 0.8] }, color: 0x5a1e22, bone: B.head, k: 0.01, outline: 0 },
  ], 0.012, 120);
  addEyes(b, J, { ...s.eye, lid: s.fur });
  for (const side of [-1, 1] as const) {
    addArm(b, J, side, { r: s.arm, color: s.fur });
    addPaw(b, J, side, 'hand', { r: s.paw, color: s.pawColor, offset: [0, -0.01, -0.03] });
    addLeg(b, J, side, { r: s.leg, thigh: s.fur, shin: s.fur, split: 1 });
    addPaw(b, J, side, 'foot', { r: s.footPaw, color: s.pawColor, pad: 0x3a2a26, offset: [0, -0.03, -0.04] });
  }
}
