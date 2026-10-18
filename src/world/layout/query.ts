// Track-space queries over a built layout: frameAt / toWorld / project / bounds / surfaceAt.
// Allocation-free where callers pass `out`; project() uses a ±window search around hintS or the
// shared kd-tree (sample-index.ts), then refines on the chords and with Newton steps on the tangent.
import { Vector3 } from 'three';
import type { Surface, TrackFrame, Vec3Like } from '../../core/types';
import type { BuiltLayout } from './build';
import { SampleIndex } from './sample-index';
import { EDGE_KINDS, SURFACES, isWaterEdge, type SideSamples } from './sides';

export const CURB_W = 0.9;           // curb strip width just outside the asphalt edge (m)
export const CURB_BLOCK = 1.5;       // red / white curb block length (m); blocks start at multiples of it
const CURB_KAPPA = 1 / 430;          // curves tighter than this get curbs
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
  private readonly index: SampleIndex;
  private readonly tmp: TrackFrame;
  private warnedNaN = false;

  constructor(readonly L: BuiltLayout) {
    this.length = L.length;
    this.i0 = Math.round(-L.sMin);
    this.runoff = Math.max(0, Math.min(RUNOFF, L.n - 1 - this.i0 - Math.round(L.length) - RUNOFF_MARGIN));
    this.iL = Math.min(L.n - 1, this.i0 + Math.round(L.length + this.runoff));
    this.curbL = new Uint8Array(L.n);
    this.curbR = new Uint8Array(L.n);
    this.markCurbs();
    this.index = new SampleIndex(L, this.i0, this.iL);
    this.tmp = this.frameAt(0);
  }

  private markCurbs(): void {
    const { L } = this;
    if (L.def.curbs === false) return;
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
    const o = out ?? newFrame();
    // Other units pass `{} as TrackFrame` scratch objects: fill in the vectors on first use.
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
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      if (!this.warnedNaN) console.warn('[track] project: non-finite point', p.x, p.y, p.z);
      this.warnedNaN = true;
      return { s: this.clampS(hintS ?? 0), x: 0, y: 0 };
    }
    let best = -1;
    if (hintS !== undefined && Number.isFinite(hintS)) {
      let bestD = Infinity;
      const c = this.i0 + Math.round(this.clampS(hintS));
      const w0 = Math.max(this.i0, c - HINT_WINDOW), w1 = Math.min(this.iL, c + HINT_WINDOW);
      for (let i = w0; i <= w1; i++) {
        const d = ((L.px[i] ?? 0) - p.x) ** 2 + ((L.pz[i] ?? 0) - p.z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      // The hint was stale if the best sample sits on the window border: fall back to a full search.
      if ((best === w0 && best !== this.i0) || (best === w1 && best !== this.iL)) best = -1;
    }
    if (best < 0) best = this.index.nearest(p.x, p.z);
    let s = this.index.refine(best, p.x, p.z);
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

  /** True when the curb block covering s on this side is drawn: both of its ends are flagged (road.ts draws the same blocks). */
  curbAt(s: number, side: -1 | 1): boolean {
    const flags = side < 0 ? this.curbL : this.curbR;
    const s0 = Math.floor(s / CURB_BLOCK) * CURB_BLOCK;
    return flags[this.sampleAt(s0)] === 1 && flags[this.sampleAt(s0 + CURB_BLOCK)] === 1;
  }

  /** Surface at (s, x); allocation-free (physics calls it per rider per substep). */
  surfaceAt(sIn: number, x: number): Surface {
    const hw = this.L.halfWidth;
    const ax = Math.abs(x);
    if (ax <= hw) return 'road';
    const side: -1 | 1 = x < 0 ? -1 : 1;
    const u = ax - hw, s = this.clampS(sIn);
    if (u > this.shoulder(s, side)) return isWaterEdge(this.edgeKindAt(s, side)) ? 'water' : 'wall';
    if (u <= CURB_W && this.curbAt(s, side)) return 'curb';
    const sd = side < 0 ? this.L.sides.left : this.L.sides.right;
    return SURFACES[sd.surface[Math.round(s - this.L.sMin)] ?? 0] ?? 'road';
  }
}

const newFrame = (): TrackFrame => ({
  s: 0, pos: new Vector3(), tangent: new Vector3(), up: new Vector3(), right: new Vector3(), curvature: 0, slope: 0, bank: 0, halfWidth: 0,
});

function setV(v: Vec3Like, x: number, y: number, z: number, normalize: boolean): void {
  if (normalize) {
    const l = Math.hypot(x, y, z) || 1;
    x /= l; y /= l; z /= l;
  }
  v.x = x; v.y = y; v.z = z;
}
