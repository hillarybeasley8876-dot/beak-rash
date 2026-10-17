// SDF primitives + smooth CSG for organic character modelling. kit/mesher.ts turns a field into a mesh
// at load time; kit/builder.ts reads the same primitives for vertex colours and skin weights.
import { Euler, Matrix4 } from 'three';

export type V3 = readonly [number, number, number];

export type PrimShape =
  | { kind: 'ellipsoid'; c: V3; r: V3 }
  /** Capsule from a to b; with r2 it becomes a rounded cone (radius r at a, r2 at b). */
  | { kind: 'capsule'; a: V3; b: V3; r: number; r2?: number }
  | { kind: 'box'; c: V3; h: V3; round: number }
  | { kind: 'torus'; c: V3; R: number; r: number };

export interface Prim {
  shape: PrimShape;
  /** Euler XYZ rotation (rad) about the shape centre (ellipsoid/box/torus; capsules use their ends). */
  rot?: V3;
  /** add = smooth union, sub = smooth subtraction, paint = colour/bone only (no shape change). */
  op?: 'add' | 'sub' | 'paint';
  k?: number;          // smooth blend radius (m)
  color: number;       // 0xRRGGBB
  bone: number;        // skinning bone index
  /** Skin-weight falloff (m): larger = softer bending across neighbouring primitives. */
  sigma?: number;
  outline?: number;    // aOutline multiplier for vertices this primitive owns (default 1)
  priority?: number;   // colour ownership bias (m): positive wins near boundaries
}

/** Compiled primitive: fast distance closure + cull box. */
export interface CPrim {
  src: Prim;
  op: 'add' | 'sub' | 'paint';
  k: number;
  dist: (x: number, y: number, z: number) => number;
  min: [number, number, number];
  max: [number, number, number];
}

const len3 = (x: number, y: number, z: number): number => Math.sqrt(x * x + y * y + z * z);

/** Polynomial smooth min (k = blend radius). */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

/** World→local transform: returns a function writing the local point into `out`. */
function localizer(center: V3, rot: V3 | undefined): (x: number, y: number, z: number, out: number[]) => void {
  const [cx, cy, cz] = center;
  if (!rot || (rot[0] === 0 && rot[1] === 0 && rot[2] === 0)) {
    return (x, y, z, out) => { out[0] = x - cx; out[1] = y - cy; out[2] = z - cz; };
  }
  const e = new Matrix4().makeRotationFromEuler(new Euler(rot[0], rot[1], rot[2])).elements;
  // Inverse of a rotation = transpose: local = Rᵀ (p − c). Column-major: R[r][c] = e[c*4 + r].
  const m00 = e[0] ?? 1, m10 = e[1] ?? 0, m20 = e[2] ?? 0;
  const m01 = e[4] ?? 0, m11 = e[5] ?? 1, m21 = e[6] ?? 0;
  const m02 = e[8] ?? 0, m12 = e[9] ?? 0, m22 = e[10] ?? 1;
  return (x, y, z, out) => {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    out[0] = m00 * dx + m10 * dy + m20 * dz;
    out[1] = m01 * dx + m11 * dy + m21 * dz;
    out[2] = m02 * dx + m12 * dy + m22 * dz;
  };
}

function roundCone(
  px: number, py: number, pz: number, a: V3, b: V3, r1: number, r2: number,
): number {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

function capsule(px: number, py: number, pz: number, a: V3, b: V3, r: number): number {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const h = l2 > 0 ? Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / l2)) : 0;
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}

/** Compile a primitive. `margin` widens the cull box (should cover the blend radius). */
export function compilePrim(p: Prim, margin: number): CPrim {
  const s = p.shape;
  const k = p.k ?? 0.03;
  const L = [0, 0, 0];
  let dist: CPrim['dist'];
  let lo: [number, number, number];
  let hi: [number, number, number];
  if (s.kind === 'ellipsoid') {
    const loc = localizer(s.c, p.rot);
    const [rx, ry, rz] = s.r;
    dist = (x, y, z) => {
      loc(x, y, z, L);
      const lx = L[0] ?? 0, ly = L[1] ?? 0, lz = L[2] ?? 0;
      const k0 = len3(lx / rx, ly / ry, lz / rz);
      const k1 = len3(lx / (rx * rx), ly / (ry * ry), lz / (rz * rz));
      return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
    };
    const m = Math.max(rx, ry, rz);
    lo = [s.c[0] - m, s.c[1] - m, s.c[2] - m];
    hi = [s.c[0] + m, s.c[1] + m, s.c[2] + m];
  } else if (s.kind === 'capsule') {
    const { a, b, r } = s;
    const r2 = s.r2 ?? r;
    dist = Math.abs(r2 - r) < 1e-6 ? (x, y, z) => capsule(x, y, z, a, b, r) : (x, y, z) => roundCone(x, y, z, a, b, r, r2);
    const m = Math.max(r, r2);
    lo = [Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.min(a[2], b[2]) - m];
    hi = [Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, Math.max(a[2], b[2]) + m];
  } else if (s.kind === 'box') {
    const loc = localizer(s.c, p.rot);
    const [hx, hy, hz] = s.h;
    const rd = s.round;
    dist = (x, y, z) => {
      loc(x, y, z, L);
      const qx = Math.abs(L[0] ?? 0) - hx + rd, qy = Math.abs(L[1] ?? 0) - hy + rd, qz = Math.abs(L[2] ?? 0) - hz + rd;
      return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rd;
    };
    const m = len3(hx, hy, hz);
    lo = [s.c[0] - m, s.c[1] - m, s.c[2] - m];
    hi = [s.c[0] + m, s.c[1] + m, s.c[2] + m];
  } else {
    const loc = localizer(s.c, p.rot);
    const { R, r } = s;
    dist = (x, y, z) => {
      loc(x, y, z, L);
      const lx = L[0] ?? 0, ly = L[1] ?? 0, lz = L[2] ?? 0;
      return Math.hypot(Math.hypot(lx, lz) - R, ly) - r;
    };
    const m = R + r;
    lo = [s.c[0] - m, s.c[1] - m, s.c[2] - m];
    hi = [s.c[0] + m, s.c[1] + m, s.c[2] + m];
  }
  const g = margin + k;
  return {
    src: p, op: p.op ?? 'add', k, dist,
    min: [lo[0] - g, lo[1] - g, lo[2] - g],
    max: [hi[0] + g, hi[1] + g, hi[2] + g],
  };
}

/** A smooth-CSG field over compiled primitives (evaluated in order: add = smin, sub = smax). */
export class Field {
  readonly prims: CPrim[];

  constructor(prims: readonly Prim[], margin = 0.02) {
    this.prims = prims.map((p) => compilePrim(p, margin));
  }

  at(x: number, y: number, z: number): number {
    let d = 1e9;
    for (const p of this.prims) {
      if (p.op === 'paint') continue;
      if (x < p.min[0] || y < p.min[1] || z < p.min[2] || x > p.max[0] || y > p.max[1] || z > p.max[2]) continue;
      const di = p.dist(x, y, z);
      d = p.op === 'add' ? smin(d, di, p.k) : smax(d, -di, p.k);
    }
    return d;
  }

  /** Union of the cull boxes of shape-adding primitives. */
  bounds(): { min: [number, number, number]; max: [number, number, number] } {
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const p of this.prims) {
      if (p.op !== 'add') continue;
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i] ?? 0, p.min[i] ?? 0);
        max[i] = Math.max(max[i] ?? 0, p.max[i] ?? 0);
      }
    }
    return { min, max };
  }
}
