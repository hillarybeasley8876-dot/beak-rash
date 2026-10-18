// Neon Night terrain modifier (env-city, LayoutDef.terrainMod). The return leg (avenue → sprint →
// finish) runs ~56 m beside the outbound leg (riverside → underpass → tunnel), closer than the near
// ribbons reach (bound + 52 m), so each leg's street-level ribbon would lie over the other's road and
// hide the underpass ramps (and the wet overlay on them). Per 2 m row and side, the ribbon stops at
// the mid-line to the nearest other leg (+ a small overlap so no crack shows); heights stay as they are.
import type { GroundDef } from '../layout/types';
import type { TerrainField, TerrainMod } from '../terrain/field';

const ROW = 2;        // rows every 2 m, like the near ribbons
const ARC = 110;      // samples closer than this along the road belong to the same leg (m; hairpin R28 ≈ 88 m)
const REACH = 52;     // near ribbon extent beyond the edge (terrain/near.ts NEAR_EXTENT)
const STEP = 2;       // march step along the outward ray (m)
const OVERLAP = 1.5;  // each ribbon runs this far past the mid-line (m)
const END = 40;       // ignore other-leg samples this close to either end of the visual road (m)

export class CityTerrain implements TerrainMod {
  private readonly sMin: number;
  private readonly rows: number;
  private readonly roomU: [Float32Array, Float32Array];
  /** Rows next to another leg (debug / track.test logs). */
  readonly limited: number;

  constructor(private readonly field: TerrainField) {
    const L = field.L;
    this.sMin = L.sMin;
    this.rows = Math.floor((L.n - 1) / ROW) + 1;
    this.roomU = [new Float32Array(this.rows).fill(Infinity), new Float32Array(this.rows).fill(Infinity)];
    this.limited = this.scan();
  }

  private scan(): number {
    const L = this.field.L;
    const fr = this.field.q.frameVis(0);
    const coarse: number[] = [];
    for (let j = 0; j < L.n; j += 4) coarse.push(j);
    let found = 0;
    for (let r = 0; r < this.rows; r++) {
      const i = Math.min(L.n - 1, r * ROW);
      const xi = L.px[i] ?? 0, zi = L.pz[i] ?? 0;
      const cand = coarse.filter((j) => Math.abs(j - i) > ARC && ((L.px[j] ?? 0) - xi) ** 2 + ((L.pz[j] ?? 0) - zi) ** 2 < (REACH + 60) ** 2);
      if (!cand.length) continue;
      // Refine to every sample around the coarse hits, so the mid-line is accurate to < 1 m.
      const fine: number[] = [];
      for (const j of cand) for (let k = Math.max(0, j - 2); k <= Math.min(L.n - 1, j + 2); k++) fine.push(k);
      const s = L.sMin + i;
      this.field.q.frameVis(s, fr);
      const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
      for (const side of [-1, 1] as const) {
        const rx = (fr.right.x / rl) * side, rz = (fr.right.z / rl) * side;
        const bound = this.field.bound(s, side);
        for (let u = 0; u <= REACH; u += STEP) {
          const px = fr.pos.x + rx * (bound + u), pz = fr.pos.z + rz * (bound + u);
          let d = Infinity, jb = 0;
          for (const j of fine) {
            const dd = ((L.px[j] ?? 0) - px) ** 2 + ((L.pz[j] ?? 0) - pz) ** 2;
            if (dd < d) { d = dd; jb = j; }
          }
          if (Math.sqrt(d) > bound + u) continue;
          // Near either end of the visual road the other ribbon stops short, and where the two grounds
          // differ (river, bridge deck) a split would leave a step: keep this ribbon whole there.
          if (jb < END || jb > L.n - 1 - END || !this.sameGround(s, side, jb, px, pz)) break;
          (this.roomU[side < 0 ? 0 : 1] as Float32Array)[r] = Math.max(0, u - STEP / 2) + OVERLAP;
          found++;
          break;
        }
      }
    }
    return found;
  }

  /** Own ground and the other leg's ground on the side facing (px, pz) lie at the same absolute level. */
  private sameGround(s: number, side: -1 | 1, j: number, px: number, pz: number): boolean {
    const L = this.field.L;
    const s2 = L.sMin + j;
    const fr = this.field.q.frameVis(s2);
    const side2: -1 | 1 = (px - fr.pos.x) * fr.right.x + (pz - fr.pos.z) * fr.right.z < 0 ? -1 : 1;
    const level = (g: GroundDef): number => (g.detached || !g.abs ? Number.NaN : g.step);
    return level(this.field.ground(s, side)) === level(this.field.ground(s2, side2));
  }

  room(s: number, side: -1 | 1): number {
    const r = Math.min(this.rows - 1, Math.max(0, Math.round((s - this.sMin) / ROW)));
    return (this.roomU[side < 0 ? 0 : 1] as Float32Array)[r] ?? Infinity;
  }

  height(_s: number, _side: -1 | 1, _u: number, _wx: number, _wz: number, h: number): number {
    return h;
  }
}
