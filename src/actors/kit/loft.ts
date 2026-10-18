// Lofted parametric surfaces (beaks, pouches): a regular grid of points at(u, v) — u = 0..1 along the piece,
// v = 0..1 around its cross-section — added to the builder as one raw chunk. Regular triangles and area-weighted
// normals (welded where sections collapse to a point) shade smoothly, with none of the SDF mesher's faceting.
import { Vector3 } from 'three';
import type { CharacterBuilder, Influences } from './builder';

export interface LoftOpts {
  /** Segments along u and around v; `closed` (default true) wraps v, otherwise v = 0 and 1 are separate edges. */
  ni: number;
  nj: number;
  closed?: boolean;
  at(u: number, v: number, out: Vector3): Vector3;
  color: number | ((u: number, v: number, p: Vector3) => number);
  weights: (p: Vector3, u: number, v: number) => Influences;
  outline?: number;
  /** Reverse the winding when (∂u × ∂v) points inward. */
  flip?: boolean;
}

const key = (x: number, y: number, z: number): string => `${Math.round(x * 2e4)},${Math.round(y * 2e4)},${Math.round(z * 2e4)}`;

export function loft(b: CharacterBuilder, o: LoftOpts): void {
  const closed = o.closed ?? true, ni = o.ni, nj = o.nj, cols = closed ? nj : nj + 1;
  const n = (ni + 1) * cols;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  const hex = new Array<number>(n), inf = new Array<Influences>(n);
  const p = new Vector3();
  for (let i = 0; i <= ni; i++) for (let j = 0; j < cols; j++) {
    const u = i / ni, v = j / nj, k = i * cols + j;
    o.at(u, v, p);
    pos.set([p.x, p.y, p.z], k * 3);
    hex[k] = typeof o.color === 'number' ? o.color : o.color(u, v, p);
    inf[k] = o.weights(p, u, v);
  }
  const idx: number[] = [];
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    const j1 = closed ? (j + 1) % nj : j + 1;
    const a = i * cols + j, bq = (i + 1) * cols + j, c = (i + 1) * cols + j1, d = i * cols + j1;
    if (o.flip) idx.push(a, c, bq, a, d, c); else idx.push(a, bq, c, a, c, d);
  }
  // Area-weighted face normals, summed over vertices that share a position (pointed caps).
  const e1 = new Vector3(), e2 = new Vector3(), fn = new Vector3(), va = new Vector3(), vb = new Vector3(), vc = new Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    const ia = idx[t] ?? 0, ib = idx[t + 1] ?? 0, ic = idx[t + 2] ?? 0;
    va.fromArray(pos, ia * 3); vb.fromArray(pos, ib * 3); vc.fromArray(pos, ic * 3);
    fn.crossVectors(e1.subVectors(vb, va), e2.subVectors(vc, va));
    for (const q of [ia, ib, ic]) for (let c = 0; c < 3; c++) nrm[q * 3 + c] = (nrm[q * 3 + c] ?? 0) + fn.getComponent(c);
  }
  const groups = new Map<string, number[]>();
  for (let k = 0; k < n; k++) {
    const g = key(pos[k * 3] ?? 0, pos[k * 3 + 1] ?? 0, pos[k * 3 + 2] ?? 0);
    const list = groups.get(g);
    if (list) list.push(k); else groups.set(g, [k]);
  }
  for (const list of groups.values()) {
    fn.set(0, 0, 0);
    for (const k of list) fn.add(va.fromArray(nrm, k * 3));
    fn.normalize();
    for (const k of list) nrm.set([fn.x, fn.y, fn.z], k * 3);
  }
  b.raw(pos, nrm, new Uint32Array(idx), (k) => hex[k] ?? 0xff00ff, (k) => inf[k] ?? [[0, 1]], o.outline ?? 1);
}
