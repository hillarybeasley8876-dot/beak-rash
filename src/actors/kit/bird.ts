// Bird template (goose, pigeon, seagull, penguin): egg body, neck capsules per neck bone, head, two-part
// beak (upper on the head, lower on the jaw), eyes, wings, legs, feet, tail fan. Species add markings
// and props through `extra` prims and their own build steps.
import type { CharacterBuilder } from './builder';
import { addEyes, pupilPoint, type EyeOpts } from './face';
import { addLeg, addToeFoot, addWebFoot } from './limbs';
import type { Prim, V3 } from './sdf';
import { addBirdWing, type WingOpts } from './wing';
import { B, type Joints } from '../rig/skeleton';

export interface BeakSpec {
  base: V3; tip: V3;
  w: number; h: number;             // half-width / half-height at the base
  color: number; lower: number;
  nail?: number;                    // tip colour (goose nail, pigeon dark tip)
  spot?: number;                    // gull's red gonys spot on the lower mandible
  cere?: number;                    // pigeon's white cere at the base
}

export interface BirdSpec {
  color: number;
  body: { c: V3; r: V3; rot?: number };
  chest: { c: V3; r: V3 };
  neckR: readonly [number, number, number];
  head: { c: V3; r: V3 };
  beak: BeakSpec;
  eye: Omit<EyeOpts, 'lid'> & { at: V3 };
  wing: Omit<WingOpts, 'trail'>;
  leg: { r: readonly [number, number, number, number]; thigh: number; shin: number };
  foot: { kind: 'web' | 'toes'; len: number; width: number; color: number };
  tail: { c: V3; r: V3; color: number; up?: number };
  extra?: Prim[];
  budget?: number;
}

export function birdJoints(s: BirdSpec, o: Partial<Joints> & Pick<Joints, 'neck' | 'head'>): Joints {
  const e = s.eye;
  const base: Joints = {
    pelvis: [0, 0.12, 0.02], spine: [0, 0.24, -0.04], chest: [0, 0.36, -0.14],
    neck: o.neck, head: o.head,
    jaw: [0, s.beak.base[1] - s.beak.h * 0.5, s.beak.base[2] + 0.02], pouch: [0, s.beak.base[1] - s.beak.h, s.beak.base[2] - 0.05],
    eye: e.at, pupil: pupilPoint(e.at, e.dir, e.r), brow: [e.at[0], e.at[1] + e.r * 1.2, e.at[2] - e.r * 0.25],
    hat: [0, s.head.c[1] + s.head.r[1] * 0.6, s.head.c[2]], ear: [-s.head.r[0] * 0.6, s.head.c[1] + s.head.r[1] * 0.5, s.head.c[2]],
    clav: [-0.08, 0.4, -0.16], shoulder: [-0.14, 0.41, -0.2], elbow: [-0.21, 0.3, -0.38], wrist: [-0.21, 0.12, -0.56],
    hip: [-0.09, 0.1, -0.04], knee: [-0.12, 0.04, -0.34], ankle: [-0.12, -0.28, -0.29], toe: [-0.12, -0.32, -0.4],
    tail: [[0, 0.17, 0.18], [0, 0.17, 0.27]],
  };
  return { ...base, ...o };
}

function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

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
  b.sdf(up, 0.008, 360);
  b.sdf(lo, 0.008, 300);
}

export function buildBird(b: CharacterBuilder, J: Joints, s: BirdSpec): void {
  const [n0, n1, n2] = J.neck;
  const prims: Prim[] = [
    { shape: { kind: 'ellipsoid', c: s.body.c, r: s.body.r }, rot: [s.body.rot ?? 0.35, 0, 0], color: s.color, bone: B.pelvis, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: lerp3(s.body.c, s.chest.c, 0.5), r: s.chest.r }, color: s.color, bone: B.spine, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'ellipsoid', c: s.chest.c, r: s.chest.r }, color: s.color, bone: B.chest, k: 0.08, sigma: 0.05 },
    { shape: { kind: 'capsule', a: J.chest, b: n0, r: s.neckR[0] * 1.25, r2: s.neckR[0] }, color: s.color, bone: B.chest, k: 0.06, sigma: 0.03 },
    { shape: { kind: 'capsule', a: n0, b: n1, r: s.neckR[0], r2: s.neckR[1] }, color: s.color, bone: B.neck1, k: 0.04, sigma: 0.03 },
    { shape: { kind: 'capsule', a: n1, b: n2, r: s.neckR[1], r2: s.neckR[2] }, color: s.color, bone: B.neck2, k: 0.04, sigma: 0.03 },
    { shape: { kind: 'capsule', a: n2, b: J.head, r: s.neckR[2], r2: s.neckR[2] * 1.05 }, color: s.color, bone: B.neck3, k: 0.04, sigma: 0.03 },
    { shape: { kind: 'ellipsoid', c: s.head.c, r: s.head.r }, color: s.color, bone: B.head, k: 0.045, sigma: 0.02 },
    { shape: { kind: 'ellipsoid', c: s.tail.c, r: s.tail.r }, rot: [-(s.tail.up ?? 0.15), 0, 0], color: s.tail.color, bone: B.tail1, k: 0.05, sigma: 0.03 },
  ];
  if (s.extra) prims.push(...s.extra);
  b.sdf(prims, 0.018, s.budget ?? 2500);
  beak(b, s.beak);
  addEyes(b, J, { ...s.eye, lid: s.color });
  for (const side of [-1, 1] as const) {
    addBirdWing(b, J, side, { ...s.wing, trail: [0, -0.75, 0.66] });
    addLeg(b, J, side, { r: s.leg.r, thigh: s.leg.thigh, shin: s.leg.shin, split: 0.42 });
    if (s.foot.kind === 'web') addWebFoot(b, J, side, { len: s.foot.len, width: s.foot.width, thick: 0.02, drop: 0.032, color: s.foot.color });
    else addToeFoot(b, J, side, { len: s.foot.len, color: s.foot.color });
  }
}
