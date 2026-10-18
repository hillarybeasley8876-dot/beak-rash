// Track-space queries over a built layout: frameAt / toWorld / project / bounds / surfaceAt.
// Allocation-free where callers pass `out`; project() uses a ±window search around hintS or a
// spatial hash of the samples, then refines on the segment and with a Newton step on the tangent.
import { Vector3 } from 'three';
import type { Surface, TrackFrame, Vec3Like } from '../../core/types';
import type { BuiltLayout } from './build';
import { EDGE_KINDS, SURFACES, isWaterEdge, type SideSamples } from './sides';

export const CURB_W = 0.9;           // curb strip width just outside the asphalt edge (m)
const CURB_KAPPA = 1 / 430;          // curves tighter than this get curbs
const HASH_CELL = 24;
const HINT_WINDOW = 30;
const RUNOFF = 250;                  // drivable road past the finish line (m)
const RUNOFF_MARGIN = 30;            // visual road kept beyond the drivable run-off (m)

export interface Bounds { halfWidth: number; left: number; right: number; leftKind: Surface; rightKind: Surface }

export class TrackQuery {
  readonly length: number;
  /** Drivable run-off past the finish (m): the sampled visual road minus a margin. */
  readonly runoff: number;
  /** Curb flags per sample (1 = curb strip on that side). */
  readonly curbL: Uint8Array;
  readonly curbR: Uint8Array;
  private readonly i0: number;        // sample index of s = 0
  private readonly iL: number;        // sample index of s = length + runoff
  private readonly hash = new Map<number, number[]>();
  private readonly tmp: TrackFrame;

  constructor(readonly L: BuiltLayout) {
    this.length = L.length;
    this.i0 = Math.round(-L.sMin);
    this.runoff = Math.max(0, Math.min(RUNOFF, L.n - 1 - this.i0 - Math.round(L.length) - RUNOFF_MARGIN));
    this.iL = Math.min(L.n - 1, this.i0 + Math.round(L.length + this.runoff));
    this.curbL = new Uint8Array(L.n);
    this.curbR = new Uint8Array(L.n);
    this.markCurbs();
    for (let i = this.i0; i <= this.iL; i++) {
      const key = this.cellKey(L.px[i] ?? 0, L.pz[i] ?? 0);
      const list = this.hash.get(key);
      if (list) list.push(i); else this.hash.set(key, [i]);
    }
    this.tmp = this.frameAt(0);
  }

  private cellKey(x: number, z: number): number {
    return (Math.floor(x / HASH_CELL) + 4096) * 8192 + (Math.floor(z / HASH_CELL) + 4096);
  }

  private markCurbs(): void {
    const { L } = this;
    const minShoulder = CURB_W + 0.3;
    const flag = new Uint8Array(L.n);
    for (let i = 0; i < L.n; i++) if (Math.abs(L.curv[i] ?? 0) > CURB_KAPPA && (L.roof[i] ?? 0) === 0) flag[i] = 1;
    // Extend each run by 8 m so curbs start before the turn-in and end after the exit.
    const ext = new Uint8Array(L.n);
    for (let i = 0; i < L.n; i++) if (flag[i]) for (let j = Math.max(0, i - 8); j <= Math.min(L.n - 1, i + 8); j++) ext[j] = 1;
    const side = (sd: SideSamples, out: Uint8Array): void => {
      for (let i = 0; i < L.n; i++) out[i] = ext[i] && (sd.shoulder[i] ?? 0) >= minShoulder ? 1 : 0;
    };
    side(L.sides.left, this.curbL);
    side(L.sides.right, this.curbR);
  }

  private clampS(s: number): number {
    const end = this.length + this.runoff;
    return s < 0 ? 0 : s > end ? end : Number.isFinite(s) ? s : 0;
  }

  frameAt(sIn: number, out?: TrackFrame): TrackFrame {
    return this.frameIn(this.clampS(sIn), out);
  }

  /** Frame anywhere on the sampled road, including the visual run-up / run-off beyond [0, length]. */
  frameVis(sIn: number, out?: TrackFrame): TrackFrame {
    const { L } = this;
    const s = Number.isFinite(sIn) ? Math.min(Math.max(sIn, L.sMin), L.sMin + L.n - 1) : 0;
    return this.frameIn(s, out);
  }

  /** Nearest sample index for s, clamped to the sampled range (visual run-up/run-off included). */
  sampleAt(s: number): number {
    const { L } = this;
    return Math.min(L.n - 1, Math.max(0, Math.round(s - L.sMin)));
  }

  private frameIn(s: number, out?: TrackFrame): TrackFrame {
    const { L } = this;
    const f = s - L.sMin;
    const i = Math.min(Math.floor(f), L.n - 2);
    const t = f - i, u = 1 - t, j = i + 1;
    const o = out ?? ({ pos: new Vector3(), tangent: new Vector3(), up: new Vector3(), right: new Vector3() } as unknown as TrackFrame);
    if (!o.pos) o.pos = new Vector3();
    if (!o.tangent) o.tangent = new Vector3();
    if (!o.up) o.up = new Vector3();
    if (!o.right) o.right = new Vector3();
    o.s = s;
    setV(o.pos, (L.px[i] ?? 0) * u + (L.px[j] ?? 0) * t, (L.py[i] ?? 0) * u + (L.py[j] ?? 0) * t, (L.pz[i] ?? 0) * u + (L.pz[j] ?? 0) * t, false);
    setV(o.tangent, (L.tx[i] ?? 0) * u + (L.tx[j] ?? 0) * t, (L.ty[i] ?? 0) * u + (L.ty[j] ?? 0) * t, (L.tz[i] ?? 0) * u + (L.tz[j] ?? 0) * t, true);
    setV(o.up, (L.ux[i] ?? 0) * u + (L.ux[j] ?? 0) * t, (L.uy[i] ?? 0) * u + (L.uy[j] ?? 0) * t, (L.uz[i] ?? 0) * u + (L.uz[j] ?? 0) * t, true);
    setV(o.right, (L.rx[i] ?? 0) * u + (L.rx[j] ?? 0) * t, (L.ry[i] ?? 0) * u + (L.ry[j] ?? 0) * t, (L.rz[i] ?? 0) * u + (L.rz[j] ?? 0) * t, true);
    o.curvature = (L.curv[i] ?? 0) * u + (L.curv[j] ?? 0) * t;
    o.slope = (L.slope[i] ?? 0) * u + (L.slope[j] ?? 0) * t;
    o.bank = (L.bank[i] ?? 0) * u + (L.bank[j] ?? 0) * t;
    o.halfWidth = L.halfWidth;
    return o;
  }

  toWorld(s: number, x: number, y: number, out: Vector3): Vector3 {
    const fr = this.frameAt(s, this.tmp);
    return out.set(
      fr.pos.x + fr.right.x * x + fr.up.x * y,
      fr.pos.y + fr.right.y * x + fr.up.y * y,
      fr.pos.z + fr.right.z * x + fr.up.z * y,
    );
  }

  /** Nearest track-space coordinates of a world point (horizontal nearest point, then local frame). */
  project(p: Vec3Like, hintS?: number): { s: number; x: number; y: number } {
    const { L } = this;
    let best = -1, bestD = Infinity;
    const consider = (i: number): void => {
      const dx = (L.px[i] ?? 0) - p.x, dz = (L.pz[i] ?? 0) - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    };
    if (hintS !== undefined && Number.isFinite(hintS)) {
      const c = this.i0 + Math.round(this.clampS(hintS));
      for (let i = Math.max(this.i0, c - HINT_WINDOW); i <= Math.min(this.iL, c + HINT_WINDOW); i++) consider(i);
      // The hint was stale if the best sample sits on the window border: fall back to a full search.
      if (best === Math.max(this.i0, c - HINT_WINDOW) && best !== this.i0) best = -1;
      if (best === Math.min(this.iL, c + HINT_WINDOW) && best !== this.iL) best = -1;
    }
    if (best < 0) {
      bestD = Infinity;
      const cx = Math.floor(p.x / HASH_CELL), cz = Math.floor(p.z / HASH_CELL);
      for (let r = 0; r < 64; r++) {
        for (let gx = cx - r; gx <= cx + r; gx++) {
          for (let gz = cz - r; gz <= cz + r; gz++) {
            if (Math.max(Math.abs(gx - cx), Math.abs(gz - cz)) !== r) continue;
            const list = this.hash.get((gx + 4096) * 8192 + (gz + 4096));
            if (list) for (const i of list) consider(i);
          }
        }
        // Done once a hit exists and the next ring cannot be closer.
        if (best >= 0 && Math.sqrt(bestD) < r * HASH_CELL) break;
      }
      if (best < 0) for (let i = this.i0; i <= this.iL; i += 4) consider(i);
    }
    // Refine on the neighbouring chords.
    let s = L.sMin + best;
    let bestSeg = Infinity;
    for (const a of [best - 1, best]) {
      const b = a + 1;
      if (a < this.i0 || b > this.iL) continue;
      const ax = L.px[a] ?? 0, az = L.pz[a] ?? 0;
      const ex = (L.px[b] ?? 0) - ax, ez = (L.pz[b] ?? 0) - az;
      const t = Math.min(1, Math.max(0, ((p.x - ax) * ex + (p.z - az) * ez) / (ex * ex + ez * ez || 1)));
      const qx = ax + ex * t - p.x, qz = az + ez * t - p.z;
      const d = qx * qx + qz * qz;
      if (d < bestSeg) { bestSeg = d; s = L.sMin + a + t; }
    }
    // Newton steps on the tangent residual so project(toWorld(s, x, y)) round-trips on banked roads.
    const fr = this.tmp;
    for (let k = 0; k < 2; k++) {
      this.frameAt(s, fr);
      const dx = p.x - fr.pos.x, dy = p.y - fr.pos.y, dz = p.z - fr.pos.z;
      const along = dx * fr.tangent.x + dy * fr.tangent.y + dz * fr.tangent.z;
      const lat = dx * fr.right.x + dy * fr.right.y + dz * fr.right.z;
      const denom = Math.max(0.25, 1 - fr.curvature * lat);
      s = this.clampS(s + along / denom);
    }
    this.frameAt(s, fr);
    const dx = p.x - fr.pos.x, dy = p.y - fr.pos.y, dz = p.z - fr.pos.z;
    return {
      s,
      x: dx * fr.right.x + dy * fr.right.y + dz * fr.right.z,
      y: dx * fr.up.x + dy * fr.up.y + dz * fr.up.z,
    };
  }

  private side(x: number): { sd: SideSamples; curb: Uint8Array } {
    return x < 0 ? { sd: this.L.sides.left, curb: this.curbL } : { sd: this.L.sides.right, curb: this.curbR };
  }

  /** Shoulder width at s on one side (linear between samples). */
  shoulder(s: number, side: -1 | 1): number {
    const { L } = this;
    const sd = side < 0 ? L.sides.left : L.sides.right;
    const f = this.clampS(s) - L.sMin;
    const i = Math.min(Math.floor(f), L.n - 2), t = f - i;
    return (sd.shoulder[i] ?? 0) * (1 - t) + (sd.shoulder[i + 1] ?? 0) * t;
  }

  edgeKindAt(s: number, side: -1 | 1) {
    const sd = side < 0 ? this.L.sides.left : this.L.sides.right;
    return EDGE_KINDS[sd.edge[Math.round(this.clampS(s) - this.L.sMin)] ?? 0] ?? 'rail';
  }

  bounds(s: number): Bounds {
    const hw = this.L.halfWidth;
    return {
      halfWidth: hw,
      left: hw + this.shoulder(s, -1),
      right: hw + this.shoulder(s, 1),
      leftKind: isWaterEdge(this.edgeKindAt(s, -1)) ? 'water' : 'wall',
      rightKind: isWaterEdge(this.edgeKindAt(s, 1)) ? 'water' : 'wall',
    };
  }

  surfaceAt(s: number, x: number): Surface {
    const hw = this.L.halfWidth;
    const ax = Math.abs(x);
    if (ax <= hw) return 'road';
    const side: -1 | 1 = x < 0 ? -1 : 1;
    const u = ax - hw;
    if (u > this.shoulder(s, side)) return isWaterEdge(this.edgeKindAt(s, side)) ? 'water' : 'wall';
    const { sd, curb } = this.side(x);
    const i = Math.round(this.clampS(s) - this.L.sMin);
    if (u <= CURB_W && curb[i]) return 'curb';
    return SURFACES[sd.surface[i] ?? 0] ?? 'road';
  }
}

function setV(v: Vec3Like, x: number, y: number, z: number, normalize: boolean): void {
  if (normalize) {
    const l = Math.hypot(x, y, z) || 1;
    x /= l; y /= l; z /= l;
  }
  v.x = x; v.y = y; v.z = z;
}
