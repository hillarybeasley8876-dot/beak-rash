// Ears, tails and mouths for the rider kit. Ears are bevelled flat shapes (inner colour by shape-space
// position) on the ear bones; tails are skinned tubes on tail1/tail2; mouths are thin dark tubes.
import { Matrix4, Quaternion, Shape, Vector3, Euler } from 'three';
import type { CharacterBuilder } from './builder';
import { extrudeSmooth, positionsOf } from './shapes';
import { addTube, type TubeNode } from './tube';
import type { V3 } from './sdf';
import { B, mirror, type Joints } from '../rig/skeleton';

export interface EarOpts {
  /** Ear shape: pointy triangle (cat, shiba, corgi) or round nub (capybara). */
  kind: 'pointy' | 'round';
  w: number; h: number; thick: number;
  color: number; inner: number;
  /** Outward tilt (rad), backward tilt (rad), turn (rad, + = faces outward). */
  tilt: number; back: number; turn: number;
}

export function addEars(b: CharacterBuilder, J: Joints, o: EarOpts): void {
  const s = new Shape();
  const w = o.w / 2, h = o.h;
  if (o.kind === 'pointy') {
    s.moveTo(-w, 0);
    s.quadraticCurveTo(-w * 0.75, h * 0.6, -w * 0.1, h);
    s.quadraticCurveTo(0, h * 1.04, w * 0.1, h);
    s.quadraticCurveTo(w * 0.75, h * 0.6, w, 0);
    s.quadraticCurveTo(0, -h * 0.12, -w, 0);
  } else {
    s.absellipse(0, h * 0.5, w, h * 0.5, 0, Math.PI * 2, false, 0);
  }
  for (const side of [-1, 1] as const) {
    const geo = extrudeSmooth(s, { depth: o.thick, bevel: 0.45, curveSegments: 4, bevelSegments: 1 });
    const src = positionsOf(geo);
    const base = J.ear;
    const at = side === -1 ? base : mirror(base);
    const q = new Quaternion().setFromEuler(new Euler(o.back, side * -o.turn, side * -o.tilt, 'YXZ'));
    const m = new Matrix4().compose(new Vector3(at[0], at[1], at[2]), q, new Vector3(1, 1, 1));
    const color = (i: number): number => {
      const x = src[i * 3] ?? 0, y = src[i * 3 + 1] ?? 0, z = src[i * 3 + 2] ?? 0;
      const inside = o.kind === 'pointy' ? Math.abs(x) < w * 0.55 * (1 - y / h) && y > h * 0.08 : Math.hypot(x / w, (y - h * 0.5) / (h * 0.5)) < 0.6;
      return inside && z < 0 ? o.inner : o.color;
    };
    b.part({ geometry: geo, matrix: m, color: (_x, _y, _z, _a, _b, _c, i) => color(i), bone: side === -1 ? B.earL : B.earR, outline: 0.7 });
    geo.dispose();
  }
}

export interface TailOpts {
  kind: 'long' | 'curl' | 'stub';
  r: number;
  color: number;
  tip?: number;
  /** Stripe colour (tabby). */
  stripe?: number;
}

export function addTail(b: CharacterBuilder, J: Joints, o: TailOpts): void {
  const [t0, t1] = J.tail;
  const n = (p: V3, r: number, bone: TubeNode['bone']): TubeNode => ({ p, r, bone });
  const mix: TubeNode['bone'] = [[B.tail1, 0.5], [B.tail2, 0.5]];
  let nodes: TubeNode[];
  if (o.kind === 'long') {
    nodes = [n(t0, o.r, B.tail1), n(t1, o.r * 0.95, mix), n([0, t1[1] + 0.14, t1[2] + 0.1], o.r * 0.85, B.tail2), n([0, t1[1] + 0.3, t1[2] + 0.08], o.r * 0.75, B.tail2)];
  } else if (o.kind === 'curl') {
    nodes = [n(t0, o.r, B.tail1), n([0, t0[1] + 0.12, t0[2] + 0.06], o.r * 1.05, mix), n([0, t0[1] + 0.22, t0[2] - 0.02], o.r * 0.95, B.tail2), n([0, t0[1] + 0.2, t0[2] - 0.11], o.r * 0.7, B.tail2)];
  } else {
    nodes = [n(t0, o.r, B.tail1), n([0, t0[1] + 0.03, t0[2] + 0.06], o.r * 0.8, B.tail2)];
  }
  addTube(b, nodes, {
    sides: 9, seg: 3,
    color: (u) => (o.tip !== undefined && u > 0.8 ? o.tip : o.stripe !== undefined && Math.floor(u * 7) % 2 === 1 ? o.stripe : o.color),
  });
}

/** Mouth line through points (left corner → right corner), bound to the head. */
export function addMouth(b: CharacterBuilder, pts: readonly V3[], r: number, color = 0x2a1416): void {
  addTube(b, pts.map((p) => ({ p, r, bone: B.head })), { sides: 5, seg: 2, color, outline: 0 });
}
