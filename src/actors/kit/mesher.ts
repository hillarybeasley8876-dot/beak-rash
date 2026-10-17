// Surface-nets mesher: SDF field → indexed triangles. Vertices are projected onto the true surface and
// get analytic-gradient normals, so coarse grids still give smooth, unfaceted toy shapes.
import type { Field } from './sdf';

export interface RawMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

const CORNER = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
] as const;
const EDGES = [
  [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7],
] as const;

/** Numeric gradient of the field (central differences). */
export function gradient(f: Field, x: number, y: number, z: number, e: number, out: number[]): void {
  out[0] = f.at(x + e, y, z) - f.at(x - e, y, z);
  out[1] = f.at(x, y + e, z) - f.at(x, y - e, z);
  out[2] = f.at(x, y, z + e) - f.at(x, y, z - e);
}

export function meshField(field: Field, cell: number): RawMesh {
  const b = field.bounds();
  const ox = b.min[0] - cell, oy = b.min[1] - cell, oz = b.min[2] - cell;
  const nx = Math.ceil((b.max[0] - b.min[0]) / cell) + 3;
  const ny = Math.ceil((b.max[1] - b.min[1]) / cell) + 3;
  const nz = Math.ceil((b.max[2] - b.min[2]) / cell) + 3;
  const sxy = nx * ny;
  const vals = new Float32Array(nx * ny * nz);
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) vals[z * sxy + y * nx + x] = field.at(ox + x * cell, oy + y * cell, oz + z * cell);
    }
  }
  const cx = nx - 1, cy = ny - 1;
  const cellVert = new Int32Array(cx * cy * (nz - 1)).fill(-1);
  const pos: number[] = [];
  const cv = new Float64Array(8);
  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        let mask = 0;
        for (let i = 0; i < 8; i++) {
          const c = CORNER[i] ?? CORNER[0];
          const v = vals[(z + c[2]) * sxy + (y + c[1]) * nx + (x + c[0])] ?? 0;
          cv[i] = v;
          if (v < 0) mask |= 1 << i;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, bb] of EDGES) {
          if (((mask >> a) & 1) === ((mask >> bb) & 1)) continue;
          const va = cv[a] ?? 0, vb = cv[bb] ?? 0;
          const t = va / (va - vb);
          const ca = CORNER[a] ?? CORNER[0], cb = CORNER[bb] ?? CORNER[0];
          sx += ca[0] + (cb[0] - ca[0]) * t;
          sy += ca[1] + (cb[1] - ca[1]) * t;
          sz += ca[2] + (cb[2] - ca[2]) * t;
          n++;
        }
        cellVert[z * cx * cy + y * cx + x] = pos.length / 3;
        pos.push(ox + (x + sx / n) * cell, oy + (y + sy / n) * cell, oz + (z + sz / n) * cell);
      }
    }
  }
  const normals = projectVertices(field, pos, cell);
  const quads = collectQuads(vals, cellVert, nx, ny, nz);
  return { positions: new Float32Array(pos), normals, indices: triangulate(quads, pos, normals) };
}

/** Two Newton steps onto the zero set, then gradient normals. Mutates `pos`; returns normals. */
function projectVertices(field: Field, pos: number[], cell: number): Float32Array {
  const normals = new Float32Array(pos.length);
  const g = [0, 0, 0];
  const e = cell * 0.2;
  const maxStep = cell * 0.75;
  for (let i = 0; i < pos.length; i += 3) {
    let x = pos[i] ?? 0, y = pos[i + 1] ?? 0, z = pos[i + 2] ?? 0;
    for (let it = 0; it < 2; it++) {
      const d = field.at(x, y, z);
      gradient(field, x, y, z, e, g);
      const gx = (g[0] ?? 0) / (2 * e), gy = (g[1] ?? 0) / (2 * e), gz = (g[2] ?? 0) / (2 * e);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 < 1e-8) break;
      let sx = (-d * gx) / g2, sy = (-d * gy) / g2, sz = (-d * gz) / g2;
      const sl = Math.hypot(sx, sy, sz);
      if (sl > maxStep) { sx *= maxStep / sl; sy *= maxStep / sl; sz *= maxStep / sl; }
      x += sx; y += sy; z += sz;
    }
    pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
    gradient(field, x, y, z, e, g);
    const l = Math.hypot(g[0] ?? 0, g[1] ?? 0, g[2] ?? 0) || 1;
    normals[i] = (g[0] ?? 0) / l; normals[i + 1] = (g[1] ?? 1) / l; normals[i + 2] = (g[2] ?? 0) / l;
  }
  return normals;
}

/** One quad per sign-changing grid edge, joining the four cells around it (winding fixed later). */
function collectQuads(vals: Float32Array, cellVert: Int32Array, nx: number, ny: number, nz: number): number[] {
  const sxy = nx * ny, cx = nx - 1, cy = ny - 1;
  const cell = (x: number, y: number, z: number): number => cellVert[z * cx * cy + y * cx + x] ?? -1;
  const quads: number[] = [];
  const push = (a: number, b: number, c: number, d: number): void => {
    if (a >= 0 && b >= 0 && c >= 0 && d >= 0) quads.push(a, b, c, d);
  };
  for (let z = 1; z < nz - 1; z++) {
    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const p = z * sxy + y * nx + x;
        const inside = (vals[p] ?? 0) < 0;
        if (inside !== (vals[p + 1] ?? 0) < 0) push(cell(x, y - 1, z - 1), cell(x, y, z - 1), cell(x, y, z), cell(x, y - 1, z));
        if (inside !== (vals[p + nx] ?? 0) < 0) push(cell(x - 1, y, z - 1), cell(x, y, z - 1), cell(x, y, z), cell(x - 1, y, z));
        if (inside !== (vals[p + sxy] ?? 0) < 0) push(cell(x - 1, y - 1, z), cell(x, y - 1, z), cell(x, y, z), cell(x - 1, y, z));
      }
    }
  }
  return quads;
}

/** Orient each quad by the surface normal and split it along its shorter diagonal. */
function triangulate(quads: number[], pos: number[], nrm: Float32Array): Uint32Array {
  const out = new Uint32Array((quads.length / 4) * 6);
  const P = (i: number, k: number): number => pos[i * 3 + k] ?? 0;
  const N = (i: number, k: number): number => nrm[i * 3 + k] ?? 0;
  let o = 0;
  for (let q = 0; q < quads.length; q += 4) {
    let a = quads[q] ?? 0, b = quads[q + 1] ?? 0;
    const c = quads[q + 2] ?? 0;
    let d = quads[q + 3] ?? 0;
    const e1x = P(c, 0) - P(a, 0), e1y = P(c, 1) - P(a, 1), e1z = P(c, 2) - P(a, 2);
    const e2x = P(d, 0) - P(b, 0), e2y = P(d, 1) - P(b, 1), e2z = P(d, 2) - P(b, 2);
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x;
    let dot = 0;
    for (const v of [a, b, c, d]) dot += fx * N(v, 0) + fy * N(v, 1) + fz * N(v, 2);
    if (dot < 0) { const t = b; b = d; d = t; }
    const ac = Math.hypot(e1x, e1y, e1z), bd = Math.hypot(e2x, e2y, e2z);
    if (ac < bd) { out.set([a, b, c, a, c, d], o); } else { out.set([a, b, d, b, c, d], o); }
    o += 6;
  }
  return out;
}
