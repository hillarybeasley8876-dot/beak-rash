// Nearest centre-line sample to a world point (horizontal): a 2-d kd-tree with per-node bounding
// boxes over a range of layout samples, plus the chord refinement after it. Shared by
// TrackQuery.project (drivable range) and TerrainField.sampleWorld (whole visual road).
import type { BuiltLayout } from './build';

export class SampleIndex {
  /** Sample indices in implicit-tree order: the median of [a, b) is a node, its halves the children. */
  private readonly ids: Int32Array;
  /** Bounding box of each node's subtree, keyed by the node's position in `ids`. */
  private readonly box: Float64Array;
  private qx = 0;
  private qz = 0;
  private bestI = -1;
  private bestD = Infinity;
  /** Last answer: a warm start for the next query (grid scans query neighbouring points). */
  private last = -1;

  constructor(private readonly L: BuiltLayout, readonly lo: number, readonly hi: number) {
    const n = Math.max(0, hi - lo + 1);
    this.ids = new Int32Array(n);
    this.box = new Float64Array(n * 4);
    for (let k = 0; k < n; k++) this.ids[k] = lo + k;
    this.build(0, n, 0);
  }

  private coord(i: number, axis: number): number {
    return (axis === 0 ? this.L.px[i] : this.L.pz[i]) ?? 0;
  }

  private build(a: number, b: number, axis: number): void {
    if (a >= b) return;
    const mid = (a + b) >> 1;
    if (b - a > 1) this.ids.subarray(a, b).sort((i, j) => this.coord(i, axis) - this.coord(j, axis));
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let k = a; k < b; k++) {
      const i = this.ids[k] ?? 0, x = this.L.px[i] ?? 0, z = this.L.pz[i] ?? 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    this.box.set([x0, x1, z0, z1], mid * 4);
    this.build(a, mid, 1 - axis);
    this.build(mid + 1, b, 1 - axis);
  }

  private consider(i: number): void {
    const dx = (this.L.px[i] ?? 0) - this.qx, dz = (this.L.pz[i] ?? 0) - this.qz;
    const d = dx * dx + dz * dz;
    // Ties go to the lower index, so the answer never depends on the warm start.
    if (d < this.bestD || (d === this.bestD && i < this.bestI)) { this.bestD = d; this.bestI = i; }
  }

  /** Exact nearest sample index in [lo, hi] (−1 when the range is empty). */
  nearest(wx: number, wz: number): number {
    this.qx = wx;
    this.qz = wz;
    this.bestI = -1;
    this.bestD = Infinity;
    if (this.last >= 0) this.consider(this.last);
    this.search(0, this.ids.length, 0);
    this.last = this.bestI;
    return this.bestI;
  }

  private search(a: number, b: number, axis: number): void {
    if (a >= b) return;
    const mid = (a + b) >> 1, o = mid * 4, bx = this.box;
    const ex = Math.max((bx[o] ?? 0) - this.qx, 0, this.qx - (bx[o + 1] ?? 0));
    const ez = Math.max((bx[o + 2] ?? 0) - this.qz, 0, this.qz - (bx[o + 3] ?? 0));
    if (ex * ex + ez * ez > this.bestD) return;
    const i = this.ids[mid] ?? 0;
    this.consider(i);
    const diff = axis === 0 ? this.qx - (this.L.px[i] ?? 0) : this.qz - (this.L.pz[i] ?? 0);
    if (diff < 0) {
      this.search(a, mid, 1 - axis);
      this.search(mid + 1, b, 1 - axis);
    } else {
      this.search(mid + 1, b, 1 - axis);
      this.search(a, mid, 1 - axis);
    }
  }

  /** s of the nearest point on the chords either side of sample i (chords inside [lo, hi]). */
  refine(i: number, wx: number, wz: number): number {
    const L = this.L;
    let s = L.sMin + i, bestD = Infinity;
    for (let a = i - 1; a <= i; a++) {
      const b = a + 1;
      if (a < this.lo || b > this.hi) continue;
      const ax = L.px[a] ?? 0, az = L.pz[a] ?? 0;
      const ex = (L.px[b] ?? 0) - ax, ez = (L.pz[b] ?? 0) - az;
      const t = Math.min(1, Math.max(0, ((wx - ax) * ex + (wz - az) * ez) / (ex * ex + ez * ez || 1)));
      const d = (ax + ex * t - wx) ** 2 + (az + ez * t - wz) ** 2;
      if (d < bestD) { bestD = d; s = L.sMin + a + t; }
    }
    return s;
  }
}
