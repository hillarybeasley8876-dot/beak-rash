// Sunset Pass terrain modifier (env-mountain, LayoutDef.terrainMod): real mountains instead of the
// coast's rolling hills. Far from the road (non-shore sides) a ridged relief lifts the ground into
// peaks around the pass; world-space peaks rise out of the lake on its far shores; and between road
// legs the shared switchback slope (LegBlend) takes over. Lake, river and bridge sides keep their
// own profile so the water stays put.
import { smoothstep } from '../../core/math';
import type { TerrainField, TerrainMod } from '../terrain/field';
import { isShore } from '../terrain/profile';
import { LegBlend } from './mountain-legs';

/** Peaks across the lake (world x, z, radius, height): the sun sets into the gap in the WSW. */
const LAKE_PEAKS: Array<[number, number, number, number]> = [
  [-720, -420, 260, 330], [-980, -40, 330, 410], [-640, 380, 240, 250], [-1150, -650, 300, 360],
  [-420, -820, 220, 240], [-300, 1320, 280, 300], [-40, 1560, 260, 250], [620, 1380, 300, 340],
];

export class MountainTerrain implements TerrainMod {
  private readonly legs: LegBlend;

  constructor(private readonly field: TerrainField) {
    for (const [x, z, r, h] of LAKE_PEAKS) field.bumps.push({ x, z, r, h, mat: 'rock' });
    this.legs = new LegBlend(field);
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
