// Bird template (goose, pigeon, seagull, penguin): plump egg body, neck capsules per neck bone, big toy head,
// two-part beak (upper on the head, lower on the jaw), eyes with brows, folded flank wings + feathered wing
// arms with feather fists (or penguin flippers), chunky legs and big feet, tail fan.
import type { CharacterBuilder } from './builder';
import { addEyes, pupilPoint, type EyeOpts } from './face';
import { addLeg, addToeFoot, addWebFoot } from './limbs';
import { addHandMitten, type MittenOpts } from './paws';
import type { Prim, V3 } from './sdf';
import { addTube } from './tube';
import { addFlankWing, type FlankWingOpts } from './wing-flank';
import { addFoldedWing, type FoldWingOpts } from './wing-fold';
import { B, mirror, type Joints } from '../rig/skeleton';

export interface BeakSpec {
  base: V3; tip: V3;
  w: number; h: number;             // half-width / half-height at the base
  color: number; lower: number;
  nail?: number;                    // tip colour (goose nail, pigeon dark tip)
  spot?: number;                    // gull's red gonys spot on the lower mandible
  cere?: number;                    // pigeon's white cere at the base
}

export type FoldSpec = { kind: 'fold' } & Omit<FoldWingOpts, 'armUp'>;
/** Penguin flipper: a flattened tapering paddle (radii across / along per joint) ending in a flat mitten. */
export interface FlipperSpec { kind: 'flipper'; r: readonly [number, number, number]; flat: number; color: number; fist: MittenOpts }

export interface BirdSpec {
  color: number;
  body: { c: V3; r: V3; rot?: number };
  chest: { c: V3; r: V3 };
  neckR: readonly [number, number, number];
  head: { c: V3; r: V3 };
  beak: BeakSpec;
  eye: Omit<EyeOpts, 'lid'> & { at: V3 };
  wing: FoldSpec | FlipperSpec;
  flank?: Omit<FlankWingOpts, 'body'>;
  leg: { r: readonly [number, number, number, number]; thigh: number; shin: number };
  foot: { kind: 'web' | 'toes'; len: number; width: number; color: number };
  tail: { c: V3; r: V3; color: number; up?: number };
  extra?: Prim[];
  budget?: number;
}

export const ARM_UP: V3 = [0, -0.75, 0.66];

export function birdJoints(s: BirdSpec, o: Partial<Joints> & Pick<Joints, 'neck' | 'head'>): Joints {
  const e = s.eye;
  const base: Joints = {
    pelvis: [0, 0.1, 0.02], spine: [0, 0.22, -0.06], chest: [0, 0.33, -0.16],
    neck: o.neck, head: o.head,
    jaw: [0, s.beak.base[1] - s.beak.h * 0.5, s.beak.base[2] + 0.02], pouch: [0, s.beak.base[1] - s.beak.h, s.beak.base[2] - 0.05],
    eye: e.at, pupil: pupilPoint(e.at, e.dir, e.r), brow: [e.at[0], e.at[1] + e.r * 1.15, e.at[2] - e.r * 0.3],
    hat: [0, s.head.c[1] + s.head.r[1] * 0.6, s.head.c[2]], ear: [-s.head.r[0] * 0.6, s.head.c[1] + s.head.r[1] * 0.5, s.head.c[2]],
    clav: [-0.08, 0.36, -0.2], shoulder: [-0.16, 0.35, -0.24], elbow: [-0.25, 0.22, -0.35], wrist: [-0.19, 0.09, -0.5],
    hip: [-0.1, 0.08, -0.04], knee: [-0.13, 0.03, -0.33], ankle: [-0.13, -0.27, -0.28], toe: [-0.13, -0.31, -0.4],
    tail: [[0, 0.2, 0.2], [0, 0.2, 0.3]],
  };
  return { ...base, ...o };
}

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function beak(b: CharacterBuilder, s: BeakSpec): void {
  const up: Prim[] = [], lo: Prim[] = [];
  const len = Math.hypot(s.tip[0] - s.base[0], s.tip[1] - s.base[1], s.tip[2] - s.base[2]);
  for (let i = 0; i < 3; i++) {
    const t = i / 2.6, k = 1 - t * 0.55;
    const c = lerp3(s.base, s.tip, t + 0.12);
    up.push({ shape: { kind: 'ellipsoid', c: [c[0], c[1] + s.h * 0.35 * k, c[2]], r: [s.w * k, s.h * 0.62 * k, len * 0.3] }, color: s.color, bone: B.head, k: 0.02 });
    lo.push({ shape: { kind: 'ellipsoid', c: [c[0], c[1] - s.h * 0.4 * k, c[2] + 0.004], r: [s.w * 0.88 * k, s.h * 0.42 * k, len * 0.28] }, color: s.lower, bone: B.jaw, k: 0.02 });
  }
  if (s.nail !== undefined) up.push({ shape: { kind: 'ellipsoid', c: lerp3(s.base, s.tip, 0.97), r: [s.w * 0.42, s.h * 0.45, len * 0.1] }, color: s.nail, bone: B.head, k: 0.012, priority: 0.006 });
  if (s.cere !== undefined) up.push({ shape: { kind: 'ellipsoid', c: [s.base[0], s.base[1] + s.h * 0.7, s.base[2] - len * 0.08], r: [s.w * 0.9, s.h * 0.45, len * 0.16] }, op: 'paint', color: s.cere, bone: B.head });
  if (s.spot !== undefined) lo.push({ shape: { kind: 'ellipsoid', c: lerp3(s.base, s.tip, 0.82), r: [s.w * 1.1, s.h * 0.5, len * 0.08] }, op: 'paint', color: s.spot, bone: B.jaw });
  b.sdf(up, 0.008, 320);
  b.sdf(lo, 0.008, 260);
}

/** Body prims (shared by the body mesh and the flank wings that hug it). */
function bodyPrims(J: Joints, s: BirdSpec): Prim[] {
  const [n0, n1, n2] = J.neck;
  const prims: Prim[] = [
    { shape: { kind: 'ellipsoid', c: s.body.c, r: s.body.r }, rot: [s.body.rot ?? 0.35, 0, 0], color: s.color, bone: B.pelvis, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: lerp3(s.body.c, s.chest.c, 0.5), r: s.chest.r }, color: s.color, bone: B.spine, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: s.chest.c, r: s.chest.r }, color: s.color, bone: B.chest, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'capsule', a: J.chest, b: n0, r: s.neckR[0] * 1.3, r2: s.neckR[0] }, color: s.color, bone: B.chest, k: 0.07, sigma: 0.03 },
    { shape: { kind: 'capsule', a: n0, b: n1, r: s.neckR[0], r2: s.neckR[1] }, color: s.color, bone: B.neck1, k: 0.05, sigma: 0.03 },
    { shape: { kind: 'capsule', a: n1, b: n2, r: s.neckR[1], r2: s.neckR[2] }, color: s.color, bone: B.neck2, k: 0.05, sigma: 0.03 },
    { shape: { kind: 'capsule', a: n2, b: J.head, r: s.neckR[2], r2: s.neckR[2] * 1.05 }, color: s.color, bone: B.neck3, k: 0.05, sigma: 0.03 },
    { shape: { kind: 'ellipsoid', c: s.head.c, r: s.head.r }, color: s.color, bone: B.head, k: 0.05, sigma: 0.02 },
    { shape: { kind: 'ellipsoid', c: s.tail.c, r: s.tail.r }, rot: [-(s.tail.up ?? 0.15), 0, 0], color: s.tail.color, bone: B.tail1, k: 0.05, sigma: 0.03 },
  ];
  return s.extra ? [...prims, ...s.extra] : prims;
}

function flipper(b: CharacterBuilder, J: Joints, side: -1 | 1, f: FlipperSpec): void {
  const m = (p: V3): V3 => (side === -1 ? p : mirror(p));
  const [bArm, bFore, bHand] = side === -1 ? [B.armL, B.foreL, B.handL] : [B.armR, B.foreR, B.handR];
  addTube(b, [
    { p: m(J.shoulder), r: [f.r[0] * f.flat, f.r[0]], bone: bArm },
    { p: m(J.elbow), r: [f.r[1] * f.flat, f.r[1]], bone: [[bArm, 0.5], [bFore, 0.5]] },
    { p: m(J.wrist), r: [f.r[2] * f.flat, f.r[2]], bone: [[bFore, 0.5], [bHand, 0.5]] },
  ], { color: f.color, sides: 10, seg: 4, up: [side * 1, 0, 0] });
  addHandMitten(b, J, side, ARM_UP, f.fist);
}

export function buildBird(b: CharacterBuilder, J: Joints, s: BirdSpec): void {
  const prims = bodyPrims(J, s);
  b.sdf(prims, 0.018, s.budget ?? 2100);
  beak(b, s.beak);
  addEyes(b, J, { ...s.eye, lid: s.color });
  for (const side of [-1, 1] as const) {
    if (s.wing.kind === 'fold') addFoldedWing(b, J, side, { ...s.wing, armUp: ARM_UP });
    else flipper(b, J, side, s.wing);
    if (s.flank) addFlankWing(b, side, { ...s.flank, body: prims });
    addLeg(b, J, side, { r: s.leg.r, thigh: s.leg.thigh, shin: s.leg.shin, split: 0.4 });
    if (s.foot.kind === 'web') addWebFoot(b, J, side, { len: s.foot.len, width: s.foot.width, thick: 0.024, drop: 0.036, color: s.foot.color });
    else addToeFoot(b, J, side, { len: s.foot.len, color: s.foot.color });
  }
}
