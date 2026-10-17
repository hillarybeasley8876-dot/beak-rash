// Swept tubes along bone chains (necks, limbs, tails): clean low-poly topology with skin weights that
// blend smoothly between the bones of neighbouring nodes, so joints bend without creases.
import { Vector3 } from 'three';
import type { CharacterBuilder, Influences } from './builder';
import type { V3 } from './sdf';

export interface TubeNode {
  p: V3;
  /** Radius, or [side, up] radii of an elliptical section. */
  r: number | readonly [number, number];
  bone: number | Influences;
}

export interface TubeOpts {
  sides?: number;
  /** Rings per span between nodes. */
  seg?: number;
  color: number | ((t: number, angle: number) => number);
  /** Reference "up" for the first frame (section ellipse orientation). */
  up?: V3;
  capStart?: boolean;
  capEnd?: boolean;
  outline?: number;
}

const v = (a: V3): Vector3 => new Vector3(a[0], a[1], a[2]);

function catmull(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number, out: Vector3): Vector3 {
  const t2 = t * t, t3 = t2 * t;
  return out.set(0, 0, 0)
    .addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t)
    .addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1)
    .addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t)
    .addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
}

const radii = (r: TubeNode['r']): [number, number] => (typeof r === 'number' ? [r, r] : [r[0], r[1]]);
const infl = (b: TubeNode['bone']): Influences => (typeof b === 'number' ? [[b, 1]] : b.map(([i, w]) => [i, w]));

function mixInfluences(a: Influences, b: Influences, f: number): Influences {
  const m = new Map<number, number>();
  for (const [i, w] of a) m.set(i, (m.get(i) ?? 0) + w * (1 - f));
  for (const [i, w] of b) m.set(i, (m.get(i) ?? 0) + w * f);
  return [...m.entries()].filter(([, w]) => w > 1e-4);
}

interface Ring { c: Vector3; t: Vector3; n: Vector3; b: Vector3; rx: number; ry: number; inf: Influences; u: number }

/** Sample the centre line into rings with parallel-transported frames. */
function rings(nodes: readonly TubeNode[], seg: number, up: V3 | undefined): Ring[] {
  const pts = nodes.map((n) => v(n.p));
  const out: Ring[] = [];
  const count = (pts.length - 1) * seg;
  for (let k = 0; k <= count; k++) {
    const span = Math.min(Math.floor(k / seg), pts.length - 2);
    const t = k / seg - span;
    const p1 = pts[span] as Vector3, p2 = pts[span + 1] as Vector3;
    const p0 = pts[span - 1] ?? p1.clone().multiplyScalar(2).sub(p2);
    const p3 = pts[span + 2] ?? p2.clone().multiplyScalar(2).sub(p1);
    const c = catmull(p0, p1, p2, p3, t, new Vector3());
    const a = nodes[span] as TubeNode, b = nodes[span + 1] as TubeNode;
    const [ax, ay] = radii(a.r), [bx, by] = radii(b.r);
    const s = t * t * (3 - 2 * t);
    out.push({
      c, t: new Vector3(), n: new Vector3(), b: new Vector3(),
      rx: ax + (bx - ax) * s, ry: ay + (by - ay) * s, inf: mixInfluences(infl(a.bone), infl(b.bone), t), u: k / count,
    });
  }
  out.forEach((r, i) => {
    const prev = out[Math.max(0, i - 1)] as Ring, next = out[Math.min(out.length - 1, i + 1)] as Ring;
    r.t.subVectors(next.c, prev.c).normalize();
  });
  const first = out[0] as Ring;
  const ref = up ? v(up) : Math.abs(first.t.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(0, 0, -1);
  first.n.copy(ref).addScaledVector(first.t, -ref.dot(first.t)).normalize();
  for (let i = 1; i < out.length; i++) {
    const r = out[i] as Ring, p = out[i - 1] as Ring;
    r.n.copy(p.n).addScaledVector(r.t, -p.n.dot(r.t)).normalize();
  }
  for (const r of out) r.b.crossVectors(r.t, r.n).normalize();
  return out;
}

/** Hemispherical end-cap rings beyond `end` (dir = outward tangent sign). */
function capRings(end: Ring, dir: 1 | -1, steps: number): Ring[] {
  const out: Ring[] = [];
  const r = (end.rx + end.ry) * 0.5;
  for (let k = 1; k <= steps; k++) {
    const phi = (k / steps) * Math.PI * 0.5;
    const shrink = Math.max(Math.cos(phi), 0.02);
    out.push({
      ...end, c: end.c.clone().addScaledVector(end.t, dir * Math.sin(phi) * r * 0.9),
      rx: end.rx * shrink, ry: end.ry * shrink,
    });
  }
  return out;
}

/** Area-weighted smooth vertex normals for an indexed triangle list. */
export function smoothNormals(pos: Float32Array, idx: Uint32Array): Float32Array {
  const n = new Float32Array(pos.length);
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), f = new Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i] ?? 0, ib = idx[i + 1] ?? 0, ic = idx[i + 2] ?? 0;
    a.fromArray(pos, ia * 3); b.fromArray(pos, ib * 3); c.fromArray(pos, ic * 3);
    f.subVectors(c, b).cross(a.sub(b));
    for (const j of [ia, ib, ic]) { n[j * 3] = (n[j * 3] ?? 0) + f.x; n[j * 3 + 1] = (n[j * 3 + 1] ?? 0) + f.y; n[j * 3 + 2] = (n[j * 3 + 2] ?? 0) + f.z; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i] ?? 0, n[i + 1] ?? 0, n[i + 2] ?? 0) || 1;
    n[i] = (n[i] ?? 0) / l; n[i + 1] = (n[i + 1] ?? 0) / l; n[i + 2] = (n[i + 2] ?? 0) / l;
  }
  return n;
}

/** Build a tube into the character builder. */
export function addTube(builder: CharacterBuilder, nodes: readonly TubeNode[], o: TubeOpts): void {
  if (nodes.length < 2) throw new Error('[actors] tube needs at least two nodes');
  const sides = o.sides ?? 10;
  const body = rings(nodes, o.seg ?? 4, o.up);
  const first = body[0] as Ring, last = body[body.length - 1] as Ring;
  const all = [
    ...(o.capStart !== false ? capRings(first, -1, 3).reverse() : []),
    ...body,
    ...(o.capEnd !== false ? capRings(last, 1, 3) : []),
  ];
  const pos = new Float32Array(all.length * sides * 3);
  const ring: number[] = [];
  const angle: number[] = [];
  const p = new Vector3();
  all.forEach((r, i) => {
    for (let j = 0; j < sides; j++) {
      const th = (j / sides) * Math.PI * 2;
      p.copy(r.c).addScaledVector(r.b, Math.cos(th) * r.rx).addScaledVector(r.n, Math.sin(th) * r.ry);
      pos.set([p.x, p.y, p.z], (i * sides + j) * 3);
      ring.push(i);
      angle.push(th);
    }
  });
  const idx: number[] = [];
  for (let i = 0; i < all.length - 1; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + ((j + 1) % sides), c = a + sides, d = b + sides;
      idx.push(a, c, b, b, c, d);
    }
  }
  const index = Uint32Array.from(idx);
  const nrm = smoothNormals(pos, index);
  const color = o.color;
  builder.raw(
    pos, nrm, index,
    (vi) => (typeof color === 'number' ? color : color((all[ring[vi] ?? 0] as Ring).u, angle[vi] ?? 0)),
    (vi) => (all[ring[vi] ?? 0] as Ring).inf.map(([b, w]) => [b, w]),
    o.outline ?? 1,
  );
}
