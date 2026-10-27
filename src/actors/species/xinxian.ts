// 新鲜哥 the stray cat: a lean orange tabby with faint stripes, a cream muzzle, alert ears (the left one
// notched), keen green eyes and a green collar with a round tag. Scrappy, not chubby. Signature: FIVE-SECOND RULE.
import { Euler, Matrix4, Quaternion, Shape, Vector3 } from 'three';
import type { CharacterBuilder } from '../kit/builder';
import { addMouth, addTail } from '../kit/ears-tails';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import { extrudeSmooth, positionsOf } from '../kit/shapes';
import type { Prim } from '../kit/sdf';
import { B, mirror, type Joints } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xf08a24, STRIPE = 0xc9640f, CREAM = 0xfff1dc, PINK = 0xff9fb0;
const COLLAR = 0x3a9b4a, TAG = 0xffcf3f;

/** Ear outline: a pointed triangle, optionally with a notch bitten out of the tip. */
function earShape(notch: boolean): Shape {
  const s = new Shape();
  const w = 0.055, h = 0.125;
  s.moveTo(-w, 0);
  s.quadraticCurveTo(-w * 0.75, h * 0.6, -w * 0.34, h * 0.92);
  if (notch) {
    s.lineTo(-w * 0.06, h * 0.5);   // the bite out of the tip
    s.lineTo(w * 0.16, h);
  } else {
    s.quadraticCurveTo(0, h * 1.04, w * 0.12, h);
  }
  s.quadraticCurveTo(w * 0.75, h * 0.6, w, 0);
  s.quadraticCurveTo(0, -h * 0.12, -w, 0);
  return s;
}

/** Both ears on the ear bones; the left one carries the notch. */
function addAlertEars(b: CharacterBuilder, J: Joints): void {
  const w = 0.055, h = 0.125;
  for (const side of [-1, 1] as const) {
    const notch = side === -1;
    const geo = extrudeSmooth(earShape(notch), { depth: 0.022, bevel: 0.45, curveSegments: 4, bevelSegments: 1 });
    const src = positionsOf(geo);
    const at = side === -1 ? J.ear : mirror(J.ear);
    const q = new Quaternion().setFromEuler(new Euler(0.1, side * -0.12, side * -0.28, 'YXZ'));
    const m = new Matrix4().compose(new Vector3(at[0], at[1], at[2]), q, new Vector3(1, 1, 1));
    const color = (i: number): number => {
      const x = src[i * 3] ?? 0, y = src[i * 3 + 1] ?? 0, z = src[i * 3 + 2] ?? 0;
      const inside = Math.abs(x) < w * 0.55 * (1 - y / h) && y > h * 0.08;
      return inside && z < 0 ? PINK : FUR;
    };
    b.part({ geometry: geo, matrix: m, color: (_x, _y, _z, _a, _b, _c, i) => color(i), bone: side === -1 ? B.earL : B.earR, outline: 0.7 });
    geo.dispose();
  }
}

/** Faint tabby stripes on the back, on the forehead and on the cheeks (painted on the coat itself). */
function stripes(): Prim[] {
  const out: Prim[] = [];
  const back: Array<[number, number, number, number, number]> = [
    [0, 0.29, 0.037, 0.16, 0.038], [0, 0.253, 0.089, 0.15, 0.036], [0, 0.203, 0.129, 0.12, 0.033],
  ];
  for (const [x, y, z, rx, ry] of back) {
    out.push({ shape: { kind: 'ellipsoid', c: [x, y, z], r: [rx, ry, 0.03] }, op: 'paint', color: STRIPE, bone: B.spine });
  }
  for (const x of [-0.04, 0.04]) {
    out.push({ shape: { kind: 'ellipsoid', c: [x, 0.655, -0.4], r: [0.013, 0.04, 0.03] }, op: 'paint', color: STRIPE, bone: B.head });
  }
  for (const s of [-1, 1]) {
    out.push({ shape: { kind: 'ellipsoid', c: [s * 0.115, 0.585, -0.39], r: [0.022, 0.013, 0.03] }, op: 'paint', color: STRIPE, bone: B.head });
  }
  return out;
}

const spec: MammalSpec = {
  fur: FUR, belly: CREAM, muzzle: CREAM, nose: 0xff8f8f,
  body: { c: [0, 0.16, -0.05], r: [0.165, 0.155, 0.21], rot: 0.4 },
  chest: { c: [0, 0.27, -0.2], r: [0.14, 0.135, 0.14] },
  head: { c: [0, 0.57, -0.3], r: [0.145, 0.135, 0.14] },
  snout: { c: [0, 0.525, -0.425], r: [0.065, 0.045, 0.05] },
  cheeks: { c: [-0.06, 0.522, -0.4], r: [0.058, 0.045, 0.05], color: CREAM },
  noseAt: [0, 0.556, -0.462], noseR: [0.017, 0.012, 0.011],
  chin: { c: [0, 0.485, -0.405], r: [0.046, 0.024, 0.04] },
  arm: [0.052, 0.05, 0.056], leg: [0.08, 0.066, 0.055, 0.05],
  hand: { r: [0.05, 0.039, 0.054], color: CREAM, toes: 3 },
  foot: { r: [0.05, 0.038, 0.07], color: CREAM, toes: 3, pad: PINK, drop: 0.01 },
  // Keen green eyes.
  eye: { at: [-0.064, 0.592, -0.418], r: 0.05, dir: [-0.3, 0.07, -0.95], pupil: 0.026, glint: 0.4,
    iris: { r: 0.038, color: 0x8ccf3a }, ring: { w: 0.006, color: 0x1e2a16 } },
  extra: [
    ...stripes(),
    // Green collar with a round tag.
    { shape: { kind: 'torus', c: [0, 0.452, -0.212], R: 0.104, r: 0.021 }, color: COLLAR, bone: B.chest, k: 0.012, sigma: 0.02 },
    { shape: { kind: 'ellipsoid', c: [0, 0.412, -0.3], r: [0.024, 0.024, 0.012] }, color: TAG, bone: B.chest, k: 0.008, sigma: 0.012 },
  ],
  budget: 2100,
};

const J = mammalJoints(spec, {
  hat: [0, 0.68, -0.29], ear: [-0.115, 0.665, -0.26],
  // Lean and springy: longer legs, arms reaching forward to the bars.
  clav: [-0.06, 0.29, -0.24], shoulder: [-0.13, 0.28, -0.3], elbow: [-0.22, 0.16, -0.44], wrist: [-0.17, 0.01, -0.58],
  hip: [-0.09, 0.08, -0.04], knee: [-0.12, 0.02, -0.35], ankle: [-0.12, -0.3, -0.28], toe: [-0.12, -0.34, -0.4],
  tail: [[0, 0.16, 0.18], [0, 0.21, 0.28]],
});

export const xinxian: SpeciesDef = {
  id: 'xinxian',
  joints: J,
  meta: {
    wings: false, hat: 'none', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.14, lidTilt: 0.2,
    neckReach: 0.06, tail: 'long', earFlop: 0.04, armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.485, -0.45], skin: FUR, skillPose: 'grab',
  },
  build(b) {
    buildMammal(b, J, spec);
    addAlertEars(b, J);
    addMouth(b, [[-0.038, 0.5, -0.452], [-0.019, 0.49, -0.462], [0, 0.5, -0.465], [0.019, 0.49, -0.462], [0.038, 0.5, -0.452]], 0.0044);
    addTail(b, J, { kind: 'long', r: 0.032, color: FUR, stripe: STRIPE, tip: CREAM });
  },
};
