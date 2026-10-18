// Rough rock faces for the near terrain (LayoutDef.crags). A rising wall is a few ribbon columns,
// each one a height band of the face: pushing every band back by its own noise amount, drifting
// along s, turns the smooth face into ledges and bulges; columns just beyond the top get a lift for
// a jagged lip. Displacement only goes away from the road (or up) and fades out below 1.5 m above
// the road edge, so the wall foot stays exactly at bounds() + WALL_TOE.
import { smoothstep } from '../../core/math';
import type { GroundDef } from '../layout/types';
import type { Noise2 } from './noise';

export interface CragOffset {
  /** Extra metres away from the road (horizontal). */
  out: number;
  /** Extra height (m). */
  up: number;
}

/** Height of the rock face above the road edge when this ground rises as a wall, else 0. */
export function wallHeight(g: GroundDef, edgeY: number, roadY: number): number {
  if (g.detached || g.stepW >= 3 || g.mat !== 'rock') return 0;
  const h = (g.abs ? g.step : roadY + g.step) - edgeY;
  return h > 2.5 ? h : 0;
}

/** Buttress / recess pattern along s (0 = buttress, 1 = deep recess), ~6-12 m features. */
const recessAt = (noise: Noise2, s: number): number => smoothstep(-0.12, 0.32, noise.get(s / 8.5, 41.3));

/** Lip spur lift factor along s (0 … 1): a tall spur every ~15-25 m. */
const spurAt = (noise: Noise2, s: number): number => {
  const n = Math.max(0, noise.get(s / 7, 77.7) - 0.3) / 0.7;
  return n * n;
};

/**
 * Offsets for the ribbon vertex of column c, u metres beyond the edge at s, hRel metres above the
 * road edge, on a wall of height wallH (see wallHeight). Face bands get a small per-band offset
 * (ledges, bulges) plus a shared recess that scoops the middle of the face back between buttresses,
 * so the fixed lip overhangs each recess with a dark underside.
 */
export function cragOffset(noise: Noise2, s: number, c: number, u: number, hRel: number, g: GroundDef, wallH: number, out: CragOffset): CragOffset {
  out.out = 0;
  out.up = 0;
  if (wallH <= 0) return out;
  const amp = Math.min(1.7, 0.25 + wallH * 0.1);
  if (u < g.stepW - 0.05) {
    // Face bands: 35–100 % of the amplitude, a different phase per band.
    const n = noise.get(s / 9 + c * 1.7, c * 0.83);
    const t = Math.min(1, hRel / wallH);
    const scoop = smoothstep(0.1, 0.45, t) * (1 - 0.45 * smoothstep(0.7, 1, t));
    const recess = recessAt(noise, s) * Math.min(3.6, wallH * 0.3) * scoop;
    out.out = smoothstep(1.5, 4.5, hRel) * (amp * (0.35 + 0.65 * (0.5 + 0.5 * n)) + recess);
  } else if (u <= g.stepW + 4) {
    // Lip: blocky crenellations and taller spurs along the top edge, fading out over the plateau.
    // The lip stays in place (only lifted), so it overhangs the pushed-back bands and props on it
    // stand on ribbonHeight().
    const n = noise.get(s / 5.5, 7.3 + c * 0.4);
    const fade = 1 - smoothstep(g.stepW + 1.5, g.stepW + 4, u);
    out.up = (Math.max(0, n) * Math.min(2.6, wallH * 0.22) + spurAt(noise, s) * Math.min(5, wallH * 0.38)) * fade;
  }
  return out;
}
