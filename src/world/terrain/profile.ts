// Terrain cross-section beyond the drivable edge (pure functions) and the ground colour palette.
import { Color } from 'three';
import { smoothstep } from '../../core/math';
import type { GroundDef } from '../layout/types';

/** Steep rising steps (rock walls) start their face this far beyond the drivable edge (m). */
export const WALL_TOE = 0.06;

/**
 * Height at distance u ≥ 0 beyond the drivable edge.
 * edgeY = road surface height at the edge (incl. bank); roadY = centre-line elevation (relative base).
 */
export function profileY(g: GroundDef, edgeY: number, roadY: number, u: number): number {
  const stepY = g.abs ? g.step : roadY + g.step;
  const targetY = g.abs ? g.target : roadY + g.target;
  const startY = g.detached ? stepY : edgeY;
  const toe = stepY - startY > 2 && g.stepW < 3 ? WALL_TOE : 0;
  if (g.stepW > 0 && u <= g.stepW) return startY + (stepY - startY) * smoothstep(toe, g.stepW, u);
  const d = u - Math.max(0, g.stepW) - g.flat;
  if (d <= 0) return stepY;
  const span = targetY - stepY;
  const run = (Math.abs(span) / Math.max(0.02, Math.abs(g.slope))) * 1.5;
  return stepY + span * smoothstep(0, run, d);
}

/** Large-scale tint noise for groundColor's n2 (≈ 110 m features). */
export const tintNoise = (noise: { get(x: number, y: number): number }, wx: number, wz: number): number =>
  noise.get(wx / 110 + 31.7, wz / 110 - 12.3);

/** True when this side's terrain ends up below sea level (beach, cliff to sea, quay, bridge). */
export const isShore = (g: GroundDef): boolean => (g.abs ? g.target : 1) < 0;

export const GROUND = {
  sand: new Color('#f2dea6'),
  wetSand: new Color('#d9bf86'),
  seabed: new Color('#c7b27e'),
  grass: new Color('#7cc04f'),
  grassDark: new Color('#5ea641'),
  grassDry: new Color('#b2c85e'),
  grassOchre: new Color('#c8bd6a'),   // sun-bleached slopes (large-scale tint)
  grassLush: new Color('#55a84a'),
  rock: new Color('#e6d7b9'),      // pale calanque limestone
  rockDark: new Color('#c8b08a'),  // ochre bands
  dirt: new Color('#b98d5a'),
  stone: new Color('#cfc2aa'),
  snowless: new Color('#9aa88a'),
  paved: new Color('#5a5c68'),
  pavedDark: new Color('#4a4c58'),
  concrete: new Color('#8a8c96'),
} as const;

const tmp = new Color();

/**
 * Ground colour from material, absolute height, steepness (normal.y), distance from the edge, a
 * noise value in [-1, 1] (patchiness), whether the side runs down to the sea and an optional
 * low-frequency noise n2 in [-1, 1] (large lush / sun-bleached areas on grass). Writes into `out`.
 */
export function groundColor(mat: GroundDef['mat'], h: number, ny: number, u: number, n: number, shore: boolean, out: Color, n2 = 0): Color {
  const steep = ny < 0.72;
  // City ground (env-city): paving on the flat, concrete on quay / retaining walls, seabed under water.
  if (mat === 'paved') {
    if (h < -0.3) return out.copy(GROUND.seabed);
    return out.copy(steep ? GROUND.concrete : GROUND.paved).lerp(GROUND.pavedDark, n > 0.2 ? 0.45 : 0);
  }
  if (h < -0.3) return out.copy(GROUND.seabed);
  if (h < 0.6 && (shore || mat === 'sand')) return out.copy(GROUND.wetSand);
  // Rock on steep faces and on low rocky shores; flat tops of rocky ground are dry scrub.
  if (steep || (mat === 'rock' && shore && h < 4.5 && u < 40)) {
    out.copy(GROUND.rock).lerp(GROUND.rockDark, n > 0.15 ? 0.55 : 0.1);
    return out;
  }
  if (mat === 'rock') return out.copy(GROUND.grassDry).lerp(GROUND.grass, n > 0 ? 0.6 : 0.15);
  if (mat === 'sand' || (shore && h < 2.2)) return out.copy(GROUND.sand).lerp(GROUND.wetSand, Math.max(0, n) * 0.25);
  if (mat === 'stone' && u < 10) return out.copy(GROUND.stone);
  if (mat === 'dirt' && u < 12) return out.copy(GROUND.dirt);
  out.copy(GROUND.grass);
  if (n > 0.25) out.lerp(GROUND.grassDark, 0.7);
  else if (n < -0.35) out.lerp(GROUND.grassDry, 0.6);
  if (n2 > 0.02) out.lerp(GROUND.grassOchre, smoothstep(0.02, 0.5, n2) * 0.65);
  else if (n2 < -0.08) out.lerp(GROUND.grassLush, smoothstep(0.08, 0.5, -n2) * 0.55);
  // High ground turns drier and greyer.
  if (h > 70) out.lerp(tmp.copy(GROUND.snowless), smoothstep(70, 140, h) * 0.6);
  return out;
}
