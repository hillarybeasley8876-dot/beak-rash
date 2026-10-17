// Quadric-error mesh decimation by half-edge collapse (a vertex merges into a neighbour, so every
// surviving vertex keeps its original attributes). Colour boundaries are penalised to stay crisp.
// Returns a new index buffer over the original vertices; the caller compacts unused ones.

type Entry = [cost: number, u: number, v: number, verU: number, verV: number];

class Heap {
  private a: Entry[] = [];
  get size(): number { return this.a.length; }
  push(e: Entry): void {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((a[p] as Entry)[0] <= e[0]) break;
      a[i] = a[p] as Entry;
      i = p;
    }
    a[i] = e;
  }
  pop(): Entry | undefined {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (!top || !last || a.length === 0) return top;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      let mc = last[0];
      if (l < a.length && (a[l] as Entry)[0] < mc) { m = l; mc = (a[l] as Entry)[0]; }
      if (r < a.length && (a[r] as Entry)[0] < mc) m = r;
      if (m === i) break;
      a[i] = a[m] as Entry;
      i = m;
    }
    a[i] = last;
    return top;
  }
}

export function decimate(
  pos: Float32Array, idx: Uint32Array, targetTris: number, penalty: (u: number, v: number) => number,
): Uint32Array {
  const n = pos.length / 3, m = idx.length / 3;
  if (m <= targetTris) return idx;
  const faces = Int32Array.from(idx);
  const alive = new Uint8Array(m).fill(1);
  const dead = new Uint8Array(n);
  const ver = new Uint32Array(n);
  const vf: number[][] = Array.from({ length: n }, () => []);
  for (let f = 0; f < m; f++) for (let k = 0; k < 3; k++) vf[faces[f * 3 + k] ?? 0]?.push(f);
  const Q = new Float64Array(n * 10);
  const P = (i: number, k: number): number => pos[i * 3 + k] ?? 0;
  for (let f = 0; f < m; f++) {
    const a = faces[f * 3] ?? 0, b = faces[f * 3 + 1] ?? 0, c = faces[f * 3 + 2] ?? 0;
    const ux = P(b, 0) - P(a, 0), uy = P(b, 1) - P(a, 1), uz = P(b, 2) - P(a, 2);
    const vx = P(c, 0) - P(a, 0), vy = P(c, 1) - P(a, 1), vz = P(c, 2) - P(a, 2);
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    const area = len * 0.5;
    nx /= len; ny /= len; nz /= len;
    const d = -(nx * P(a, 0) + ny * P(a, 1) + nz * P(a, 2));
    const q = [nx * nx, nx * ny, nx * nz, nx * d, ny * ny, ny * nz, ny * d, nz * nz, nz * d, d * d];
    for (const v of [a, b, c]) for (let k = 0; k < 10; k++) Q[v * 10 + k] = (Q[v * 10 + k] ?? 0) + (q[k] ?? 0) * area;
  }
  const err = (u: number, v: number): number => {
    const x = P(v, 0), y = P(v, 1), z = P(v, 2);
    const q = (k: number): number => (Q[u * 10 + k] ?? 0) + (Q[v * 10 + k] ?? 0);
    return q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x
      + q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y + q(7) * z * z + 2 * q(8) * z + q(9);
  };
  const heap = new Heap();
  const pushEdge = (a: number, b: number): void => {
    heap.push([err(a, b) + penalty(a, b), a, b, ver[a] ?? 0, ver[b] ?? 0]);
    heap.push([err(b, a) + penalty(b, a), b, a, ver[b] ?? 0, ver[a] ?? 0]);
  };
  for (let f = 0; f < m; f++) {
    for (let k = 0; k < 3; k++) {
      const a = faces[f * 3 + k] ?? 0, b = faces[f * 3 + ((k + 1) % 3)] ?? 0;
      if (a < b) pushEdge(a, b);
    }
  }
  let live = m;
  while (live > targetTris && heap.size > 0) {
    const e = heap.pop();
    if (!e) break;
    const [, u, v, vu, vv] = e;
    if (dead[u] || dead[v] || ver[u] !== vu || ver[v] !== vv) continue;
    if (!collapseOk(u, v, faces, alive, vf, P)) continue;
    const removed = collapse(u, v, faces, alive, vf);
    live -= removed;
    dead[u] = 1;
    for (let k = 0; k < 10; k++) Q[v * 10 + k] = (Q[v * 10 + k] ?? 0) + (Q[u * 10 + k] ?? 0);
    ver[v] = (ver[v] ?? 0) + 1;
    const nb = new Set<number>();
    for (const f of vf[v] ?? []) if (alive[f]) for (let k = 0; k < 3; k++) nb.add(faces[f * 3 + k] ?? 0);
    nb.delete(v);
    for (const w of nb) pushEdge(v, w);
  }
  const out: number[] = [];
  for (let f = 0; f < m; f++) if (alive[f]) out.push(faces[f * 3] ?? 0, faces[f * 3 + 1] ?? 0, faces[f * 3 + 2] ?? 0);
  return Uint32Array.from(out);
}

type PosFn = (i: number, k: number) => number;

function faceNormal(a: number, b: number, c: number, P: PosFn, out: number[]): number {
  const ux = P(b, 0) - P(a, 0), uy = P(b, 1) - P(a, 1), uz = P(b, 2) - P(a, 2);
  const vx = P(c, 0) - P(a, 0), vy = P(c, 1) - P(a, 1), vz = P(c, 2) - P(a, 2);
  out[0] = uy * vz - uz * vy; out[1] = uz * vx - ux * vz; out[2] = ux * vy - uy * vx;
  return Math.hypot(out[0] ?? 0, out[1] ?? 0, out[2] ?? 0);
}

const n0 = [0, 0, 0], n1 = [0, 0, 0];

/** Reject collapses that flip faces or break manifoldness (link condition). */
function collapseOk(u: number, v: number, faces: Int32Array, alive: Uint8Array, vf: number[][], P: PosFn): boolean {
  const nu = new Set<number>(), nv = new Set<number>();
  for (const f of vf[u] ?? []) if (alive[f]) for (let k = 0; k < 3; k++) nu.add(faces[f * 3 + k] ?? 0);
  for (const f of vf[v] ?? []) if (alive[f]) for (let k = 0; k < 3; k++) nv.add(faces[f * 3 + k] ?? 0);
  let common = 0;
  for (const w of nu) if (w !== u && w !== v && nv.has(w)) common++;
  if (common !== 2) return false;
  for (const f of vf[u] ?? []) {
    if (!alive[f]) continue;
    const a = faces[f * 3] ?? 0, b = faces[f * 3 + 1] ?? 0, c = faces[f * 3 + 2] ?? 0;
    if (a === v || b === v || c === v) continue;
    const l0 = faceNormal(a, b, c, P, n0);
    const l1 = faceNormal(a === u ? v : a, b === u ? v : b, c === u ? v : c, P, n1);
    if (l1 < 1e-12 || l0 < 1e-12) return false;
    const dot = ((n0[0] ?? 0) * (n1[0] ?? 0) + (n0[1] ?? 0) * (n1[1] ?? 0) + (n0[2] ?? 0) * (n1[2] ?? 0)) / (l0 * l1);
    if (dot < 0.3) return false;
  }
  return true;
}

/** Merge u into v. Returns how many faces disappeared. */
function collapse(u: number, v: number, faces: Int32Array, alive: Uint8Array, vf: number[][]): number {
  let removed = 0;
  const into = vf[v] ?? [];
  for (const f of vf[u] ?? []) {
    if (!alive[f]) continue;
    const o = f * 3;
    if (faces[o] === v || faces[o + 1] === v || faces[o + 2] === v) {
      alive[f] = 0;
      removed++;
      continue;
    }
    for (let k = 0; k < 3; k++) if (faces[o + k] === u) faces[o + k] = v;
    into.push(f);
  }
  return removed;
}
