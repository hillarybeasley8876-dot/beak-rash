// Small geometry helpers for ribbons that follow the track (rows along s, columns across).
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import type { TrackFrame } from '../core/types';

/** Grid of rows × cols vertices; two triangles per cell, front faces up when columns run left→right. */
export class GridGeo {
  readonly pos: Float32Array;
  readonly nrm: Float32Array;
  readonly uv: Float32Array;
  readonly col: Float32Array;

  constructor(readonly rows: number, readonly cols: number) {
    const n = rows * cols;
    this.pos = new Float32Array(n * 3);
    this.nrm = new Float32Array(n * 3);
    this.uv = new Float32Array(n * 2);
    this.col = new Float32Array(n * 3).fill(1);
  }

  set(r: number, c: number, p: { x: number; y: number; z: number }, n: { x: number; y: number; z: number }, u: number, v: number): void {
    const i = r * this.cols + c;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.nrm[i * 3] = n.x; this.nrm[i * 3 + 1] = n.y; this.nrm[i * 3 + 2] = n.z;
    this.uv[i * 2] = u; this.uv[i * 2 + 1] = v;
  }

  color(r: number, c: number, color: Color): void {
    const i = (r * this.cols + c) * 3;
    this.col[i] = color.r; this.col[i + 1] = color.g; this.col[i + 2] = color.b;
  }

  /** Build the indexed geometry. `flip` reverses winding (columns running right→left). */
  build(opts: { colors?: boolean; flip?: boolean; computeNormals?: boolean } = {}): BufferGeometry {
    const { rows, cols } = this;
    const idx: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        if (opts.flip) idx.push(a, d, b, b, d, e);
        else idx.push(a, b, d, b, e, d);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new BufferAttribute(this.uv, 2));
    if (opts.colors) g.setAttribute('color', new BufferAttribute(this.col, 3));
    g.setIndex(idx);
    if (opts.computeNormals) g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** World point of track-space (x, y) offsets in a frame (no allocation when `out` is given). */
export function frameOffset(fr: TrackFrame, x: number, y: number, out = new Vector3()): Vector3 {
  return out.set(
    fr.pos.x + fr.right.x * x + fr.up.x * y,
    fr.pos.y + fr.right.y * x + fr.up.y * y,
    fr.pos.z + fr.right.z * x + fr.up.z * y,
  );
}

/** Row positions along s for ribbons: every `step` metres from s0 to s1 inclusive. */
export function rowsBetween(s0: number, s1: number, step: number): number[] {
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(s0 + ((s1 - s0) * i) / n);
  return out;
}

/** Incremental indexed mesh buffer (positions, normals, uvs, colours). */
export class MeshBuf {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  private su = 0;
  private sv = 0;

  get count(): number {
    return this.pos.length / 3;
  }

  /** Default uv for following vertices (animated batches: phase, amplitude weight). */
  stamp(u: number, v: number): this {
    this.su = u;
    this.sv = v;
    return this;
  }

  vert(p: { x: number; y: number; z: number }, n: { x: number; y: number; z: number }, c: Color, u = this.su, v = this.sv): number {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.col.push(c.r, c.g, c.b);
    this.uv.push(u, v);
    return this.count - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  /** Quad a-b-c-d in counter-clockwise order (seen from the front). */
  quad(a: number, b: number, c: number, d: number): void {
    this.idx.push(a, b, c, a, c, d);
  }

  build(opts: { colors?: boolean; computeNormals?: boolean } = {}): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2));
    if (opts.colors !== false) g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setIndex(this.idx);
    if (opts.computeNormals) g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/**
 * Outline hull: same triangles pushed out along position-averaged normals (no cracks at hard
 * edges). Render with a black BackSide material. Keeps position, uv and index.
 */
export function makeHull(src: BufferGeometry, width: number): BufferGeometry {
  const pos = src.getAttribute('position');
  const nrm = src.getAttribute('normal');
  const n = pos.count;
  const keyOf = (i: number): string =>
    `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
  const sums = new Map<string, Vector3>();
  for (let i = 0; i < n; i++) {
    const k = keyOf(i);
    const v = sums.get(k) ?? new Vector3();
    v.x += nrm.getX(i); v.y += nrm.getY(i); v.z += nrm.getZ(i);
    sums.set(k, v);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = sums.get(keyOf(i)) as Vector3;
    const l = v.length() || 1;
    out[i * 3] = pos.getX(i) + (v.x / l) * width;
    out[i * 3 + 1] = pos.getY(i) + (v.y / l) * width;
    out[i * 3 + 2] = pos.getZ(i) + (v.z / l) * width;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(out, 3));
  // Animated batches drive their vertex motion from uv: the hull keeps it to move in step.
  const uv = src.getAttribute('uv');
  if (uv) g.setAttribute('uv', uv.clone());
  const idx = src.getIndex();
  if (idx) g.setIndex(idx.clone());
  g.computeBoundingSphere();
  return g;
}
