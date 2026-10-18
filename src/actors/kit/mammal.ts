// Mammal template: chubby pear body, hidden neck, big toy head with muzzle/cheeks/chin, thick tube arms with
// mitten paws on the grips, thick legs with padded foot paws on the pedals, optional brows and blush.
// Species add ears, tails, markings and gear on top.
import type { CharacterBuilder } from './builder';
import { addEyes, pupilPoint, type EyeOpts } from './face';
import { addArm, addLeg } from './limbs';
import { addFootMitten, addHandMitten, type MittenOpts } from './paws';
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
  /** Rosy cheek paint (left side; mirrored). */
  blush?: { c: V3; r: V3; color: number };
  /** Belly patch paint (default: derived from the body). */
  bellyPatch?: { c: V3; r: V3 };
  noseAt: V3; noseR: V3;
  chin: { c: V3; r: V3 };
  arm: readonly [number, number, number];
  leg: readonly [number, number, number, number];
  hand: MittenOpts;
  foot: MittenOpts;
  eye: Omit<EyeOpts, 'lid'> & { at: V3 };
  /** Eyelid colour (default: fur). */
  lid?: number;
  /** Extra shape/paint primitives merged into the body piece (stripes, patches, shaggy tufts). */
  extra?: Prim[];
  cell?: number;
  budget?: number;
}

export const ARM_UP: V3 = [0, -0.75, 0.66];

/** Common seated-mammal joints (hunched chibi layout); species override what they need. */
export function mammalJoints(s: MammalSpec, o: Partial<Joints> = {}): Joints {
  const e = s.eye;
  const base: Joints = {
    pelvis: [0, 0.1, 0.02], spine: [0, 0.22, -0.06], chest: [0, 0.32, -0.15],
    neck: [[0, 0.4, -0.2], [0, 0.44, -0.22], [0, 0.48, -0.24]], head: [0, 0.5, -0.25],
    jaw: [0, s.chin.c[1] + 0.02, s.chin.c[2] + 0.05], pouch: [0, s.chin.c[1], s.chin.c[2]],
    eye: e.at, pupil: pupilPoint(e.at, e.dir, e.r), brow: [e.at[0], e.at[1] + e.r * 1.2, e.at[2] - e.r * 0.25],
    hat: [0, s.head.c[1] + s.head.r[1] * 0.6, s.head.c[2]], ear: [-s.head.r[0] * 0.7, s.head.c[1] + s.head.r[1] * 0.7, s.head.c[2]],
    clav: [-0.07, 0.34, -0.2], shoulder: [-0.15, 0.34, -0.25], elbow: [-0.24, 0.22, -0.38], wrist: [-0.18, 0.07, -0.52],
    hip: [-0.1, 0.08, -0.04], knee: [-0.13, 0.03, -0.33], ankle: [-0.13, -0.27, -0.28], toe: [-0.13, -0.31, -0.4],
    tail: [[0, 0.14, 0.2], [0, 0.2, 0.32]],
  };
  return { ...base, ...o };
}

/** Body + head prims (also used by gear that hugs the body). */
export function mammalPrims(J: Joints, s: MammalSpec): Prim[] {
  const bp = s.bellyPatch ?? { c: [0, s.body.c[1] + 0.05, s.body.c[2] - s.body.r[2] * 0.72], r: [s.body.r[0] * 0.72, s.body.r[1] * 0.9, s.body.r[2] * 0.55] };
  const prims: Prim[] = [
    { shape: { kind: 'ellipsoid', c: s.body.c, r: s.body.r }, rot: [s.body.rot ?? 0.3, 0, 0], color: s.fur, bone: B.pelvis, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: [0, (s.body.c[1] + s.chest.c[1]) / 2, (s.body.c[2] + s.chest.c[2]) / 2], r: s.chest.r }, color: s.fur, bone: B.spine, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: s.chest.c, r: s.chest.r }, color: s.fur, bone: B.chest, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'capsule', a: J.chest, b: J.head, r: s.chest.r[0] * 0.78, r2: s.head.r[0] * 0.62 }, color: s.fur, bone: B.neck2, k: 0.08, sigma: 0.04 },
    { shape: { kind: 'ellipsoid', c: s.head.c, r: s.head.r }, color: s.fur, bone: B.head, k: 0.06, sigma: 0.03 },
    { shape: { kind: 'ellipsoid', c: s.snout.c, r: s.snout.r }, color: s.muzzle, bone: B.head, k: 0.05, sigma: 0.02, priority: 0.004 },
    { shape: { kind: 'ellipsoid', c: s.chin.c, r: s.chin.r }, color: s.muzzle, bone: B.jaw, k: 0.03, sigma: 0.012, priority: 0.004 },
    { shape: { kind: 'ellipsoid', c: bp.c, r: bp.r }, op: 'paint', color: s.belly, bone: B.spine },
  ];
  for (const sx of [-1, 1]) {
    const m = (c: V3): V3 => [sx === -1 ? c[0] : -c[0], c[1], c[2]];
    if (s.cheeks) prims.push({ shape: { kind: 'ellipsoid', c: m(s.cheeks.c), r: s.cheeks.r }, color: s.cheeks.color, bone: B.head, k: 0.04, sigma: 0.02 });
    if (s.blush) prims.push({ shape: { kind: 'ellipsoid', c: m(s.blush.c), r: s.blush.r }, op: 'paint', color: s.blush.color, bone: B.head });
  }
  return s.extra ? [...prims, ...s.extra] : prims;
}

export function buildMammal(b: CharacterBuilder, J: Joints, s: MammalSpec): void {
  b.sdf(mammalPrims(J, s), s.cell ?? 0.018, s.budget ?? 2300);
  // Nose + mouth interior (dark, shows when the chin drops).
  b.sdf([{ shape: { kind: 'ellipsoid', c: s.noseAt, r: s.noseR }, color: s.nose, bone: B.head, k: 0.01, outline: 0.6 }], 0.007, 110);
  b.sdf([
    { shape: { kind: 'ellipsoid', c: [0, s.chin.c[1] + s.chin.r[1] * 0.6, s.chin.c[2] + 0.01], r: [s.chin.r[0] * 0.8, s.chin.r[1] * 0.7, s.chin.r[2] * 0.8] }, color: 0x5a1e22, bone: B.head, k: 0.01, outline: 0 },
  ], 0.012, 100);
  addEyes(b, J, { ...s.eye, lid: s.lid ?? s.fur });
  for (const side of [-1, 1] as const) {
    addArm(b, J, side, { r: s.arm, color: s.fur });
    addHandMitten(b, J, side, ARM_UP, s.hand);
    addLeg(b, J, side, { r: s.leg, thigh: s.fur, shin: s.fur, split: 1 });
    addFootMitten(b, J, side, s.foot);
  }
}
