// Sunset Pass terrain modifier (env-mountain, LayoutDef.terrainMod): real mountains instead of the
// coast's rolling hills. Far from the road (non-shore sides) a ridged relief lifts the ground into
// peaks around the pass; world-space peaks rise out of the lake on its far shores; and between road
// legs the shared switchback slope (LegBlend) takes over. Lake, river and bridge sides keep their
// own profile so the water stays put.
import { smoothstep } from '../../core/math';
import type { TerrainField, TerrainMod } from '../terrain/field';
import { isShore } from '../terrain/profile';
import { flatAxes } from './mountain-frame';
import { LegBlend } from './mountain-legs';

/**
 * Peaks across the lake in track space: anchor s, offset along the anchor's tangent (only beyond the road
 * ends), lateral x, radius, height (m); converted with the anchor frame, so they move with the layout.
 * The sun sets into the gap in the WSW.
 */
const LAKE_PEAKS: Array<[number, number, number, number, number]> = [
  [631, -3, -708, 260, 330], [40, 0, -980, 330, 410], [0, -380, -640, 240, 250], [641, 1, -1109, 300, 360],
  [652, 9, -423, 220, 240], [3588, 779, -162, 280, 300], [3588, 620, -478, 260, 250], [3527, 0, -541, 300, 340],
];
/** Minimum clearance between a peak's radius and the road (m); closer peaks warn. */
const ROAD_GAP = 60;

/** Distance from world (x, z) to the nearest road sample (every 4th sample). */
function roadDistance(L: TerrainField['L'], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < L.n; i += 4) best = Math.min(best, Math.hypot((L.px[i] ?? 0) - x, (L.pz[i] ?? 0) - z));
  return best;
}

export class MountainTerrain implements TerrainMod {
  private readonly legs: LegBlend;

  constructor(private readonly field: TerrainField) {
    const L = field.L;
    // The mirrored road (SPEC §20) runs the other way: the peaks sit at the mirrored s, still on the
    // lake's side of the road.
    const mirror = L.def.reversed === true;
    for (const [s0, along, x, r, h] of LAKE_PEAKS) {
      const s = mirror ? L.length - s0 : s0;
      const fr = field.q.frameVis(Math.min(s, L.sMin + L.n - 1)), a = flatAxes(fr);
      const wx = fr.pos.x + a.tx * along + a.rx * x, wz = fr.pos.z + a.tz * along + a.rz * x;
      const gap = roadDistance(L, wx, wz) - r;
      if (gap < ROAD_GAP) console.warn(`[mountain] lake peak at s ${s} / x ${x} is only ${Math.round(gap)} m from the road`);
      field.bumps.push({ x: wx, z: wz, r, h, mat: 'rock' });
    }
    this.legs = new LegBlend(field);
  }

  /** Build summary for the debug log (ctx.log). */
  get summary(): string {
    return this.legs.summary;
  }

  room(s: number, side: -1 | 1): number {
    return this.legs.room(s, side);
  }

  /** Ridged mountain relief far from the road: up to ~300 m above the shared far terrain. */
  private relief(u: number, wx: number, wz: number): number {
    const w = smoothstep(70, 380, u);
    if (w <= 0) return 0;
    const n = this.field.noise;
    const r = n.ridge(wx / 820 + 3.1, wz / 820 - 1.7, 4);
    return w * (290 * r * r + 45 * n.fbm(wx / 260, wz / 260, 3));
  }

  height(s: number, side: -1 | 1, u: number, wx: number, wz: number, h: number): number {
    const g = this.field.ground(s, side);
    const y = g.detached || isShore(g) ? h : h + this.relief(u, wx, wz);
    return this.legs.height(s, side, u, wx, wz, y);
  }
}
