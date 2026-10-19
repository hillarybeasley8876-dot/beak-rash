// Switchback terrain (env-mountain). Where two road legs run side by side (switchback legs, the
// infield of hairpins and of the chicane) the near ribbons of both would overlap and bury each
// other's road. This modifier (LayoutDef.terrainMod → TerrainField.mod) finds, per road row and
// side, the first other leg whose region the outward ray enters: ribbons stop at that mid-line
// (room) and the ground between the legs follows one shared surface — a ruled slope from one road
// edge to the other plus gentle noise — so both legs' ribbons and the far grid meet seamlessly.
import { smoothstep } from '../../core/math';
import type { TrackFrame } from '../../core/types';
import type { TerrainField, TerrainMod } from '../terrain/field';
import { flatAxes, type FlatAxes } from './mountain-frame';
import { isShore } from '../terrain/profile';

const ROW = 2;          // precomputed rows every 2 m
const ARC = 40;         // samples closer than this along the road belong to the same leg (m)
const RAY = 180;        // how far beyond the edge to look for another leg (m)
const G0 = 130, G1 = 230; // centre-to-centre gap where the shared surface fades out (m)
const FOOT_WIN = 34;    // ±window around the hint when finding the other leg's foot point (m)

export class LegBlend implements TerrainMod {
  private readonly sMin: number;
  private readonly rows: number;
  /** Per side (0 = left, 1 = right): s of the other leg near the mid-line (NaN = none) and room. */
  private readonly other: [Float32Array, Float32Array];
  private readonly roomU: [Float32Array, Float32Array];
  private readonly fr: TrackFrame;
  private readonly ax: FlatAxes = { tx: 0, tz: 0, rx: 0, rz: 0 };
  /** Build summary for the debug log (ctx.log). */
  readonly summary: string;

  constructor(private readonly field: TerrainField) {
    const L = field.L;
    this.sMin = L.sMin;
    this.rows = Math.floor((L.n - 1) / ROW) + 1;
    const mk = (v: number): Float32Array => new Float32Array(this.rows).fill(v);
    this.other = [mk(Number.NaN), mk(Number.NaN)];
    this.roomU = [mk(Infinity), mk(Infinity)];
    this.fr = field.q.frameVis(0);
    const t0 = performance.now();
    const found = this.scan();
    this.summary = `leg blend: ${found} rows next to another leg (${Math.round(performance.now() - t0)} ms)`;
  }

  /** For every row: candidates from other legs near it, then march the outward rays. */
  private scan(): number {
    const L = this.field.L;
    const step = ROW;
    const idx: number[] = [];
    for (let i = 0; i < L.n; i += step) idx.push(i);
    let found = 0;
    for (let r = 0; r < this.rows; r++) {
      const i = Math.min(L.n - 1, r * ROW);
      const xi = L.px[i] ?? 0, zi = L.pz[i] ?? 0;
      const cand: number[] = [];
      for (const j of idx) {
        if (Math.abs(j - i) <= ARC) continue;
        const dx = (L.px[j] ?? 0) - xi, dz = (L.pz[j] ?? 0) - zi;
        if (dx * dx + dz * dz < (RAY + 40) ** 2) cand.push(j);
      }
      if (!cand.length) continue;
      for (const side of [-1, 1] as const) if (this.march(r, i, side, cand)) found++;
    }
    return found;
  }

  /**
   * First point of row r's outward ray that is nearer to another leg than to its own centre point.
   * The ray point w = bound + u metres out is exactly w from the own centre point p0, so candidate q
   * is nearer for every w > |q − p0|² / (2 (q − p0)·d) (a half-line): the crossing is the smallest such
   * w over the candidates (closed form, no marching).
   */
  private march(r: number, i: number, side: -1 | 1, cand: number[]): boolean {
    const L = this.field.L;
    const s = L.sMin + i;
    const fr = this.field.q.frameVis(s, this.fr);
    const a = flatAxes(fr, this.ax);
    const rx = a.rx * side, rz = a.rz * side;
    const bound = this.field.bound(s, side);
    let wMin = Infinity, jb = -1;
    for (const j of cand) {
      const qx = (L.px[j] ?? 0) - fr.pos.x, qz = (L.pz[j] ?? 0) - fr.pos.z;
      const dot = qx * rx + qz * rz;
      if (dot <= 0) continue;
      const w = (qx * qx + qz * qz) / (2 * dot);
      if (w < wMin) { wMin = w; jb = j; }
    }
    if (jb < 0 || wMin - bound > RAY) return false;
    const k = side < 0 ? 0 : 1;
    (this.roomU[k] as Float32Array)[r] = Math.max(0, wMin - bound);
    (this.other[k] as Float32Array)[r] = L.sMin + jb;
    return true;
  }

  private row(s: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.round((s - this.sMin) / ROW)));
  }

  room(s: number, side: -1 | 1): number {
    return (this.roomU[side < 0 ? 0 : 1] as Float32Array)[this.row(s)] ?? Infinity;
  }

  /** Horizontal foot point on the road near `hint`: s and signed lateral offset x. */
  private foot(wx: number, wz: number, hint: number): { s: number; x: number } {
    const L = this.field.L;
    const c = Math.round(hint - L.sMin);
    let best = c, bestD = Infinity;
    for (let i = Math.max(0, c - FOOT_WIN); i <= Math.min(L.n - 1, c + FOOT_WIN); i++) {
      const d = ((L.px[i] ?? 0) - wx) ** 2 + ((L.pz[i] ?? 0) - wz) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    let s = L.sMin + best, segD = Infinity;
    for (const a of [best - 1, best]) {
      const b = a + 1;
      if (a < 0 || b >= L.n) continue;
      const ax = L.px[a] ?? 0, az = L.pz[a] ?? 0, ex = (L.px[b] ?? 0) - ax, ez = (L.pz[b] ?? 0) - az;
      const t = Math.min(1, Math.max(0, ((wx - ax) * ex + (wz - az) * ez) / (ex * ex + ez * ez || 1)));
      const d = (ax + ex * t - wx) ** 2 + (az + ez * t - wz) ** 2;
      if (d < segD) { segD = d; s = L.sMin + a + t; }
    }
    const fr = this.field.q.frameVis(s, this.fr);
    const a = flatAxes(fr, this.ax);
    return { s, x: (wx - fr.pos.x) * a.rx + (wz - fr.pos.z) * a.rz };
  }

  /** Sides that keep their own profile: bridges (detached), shores (lake/river) and tunnels. */
  private keeps(s: number, side: -1 | 1): boolean {
    const g = this.field.ground(s, side);
    const L = this.field.L;
    return g.detached || isShore(g) || (L.roof[this.field.q.sampleAt(s)] ?? 0) > 0;
  }

  height(s: number, side: -1 | 1, u: number, wx: number, wz: number, h: number): number {
    const k = side < 0 ? 0 : 1;
    const hint = (this.other[k] as Float32Array)[this.row(s)] ?? Number.NaN;
    if (!Number.isFinite(hint) || u <= 0 || this.keeps(s, side)) return h;
    const f = this.foot(wx, wz, hint);
    const sideB: -1 | 1 = f.x < 0 ? -1 : 1;
    if (this.keeps(f.s, sideB)) return h;
    const bA = this.field.bound(s, side), bB = this.field.bound(f.s, sideB);
    const dB = Math.abs(f.x), uB = Math.max(0, dB - bB);
    const w = 1 - smoothstep(G0, G1, bA + u + dB);
    if (w <= 0) return h;
    const t = u / (u + uB + 1e-6);
    const yA = this.field.edgeY(s, side), yB = this.field.edgeY(f.s, sideB);
    const n = this.field.noise;
    const amp = Math.min(3, 0.05 * (u + uB));
    let ruled = yA + (yB - yA) * t + amp * Math.sin(Math.PI * t) * (n.fbm(wx / 45, wz / 45, 2) + 0.3);
    // Inside the other leg's drivable area (ribbon overreach): stay under its road.
    if (dB < bB) ruled = Math.min(ruled, yB - 0.6);
    return h + (ruled - h) * w;
  }
}
